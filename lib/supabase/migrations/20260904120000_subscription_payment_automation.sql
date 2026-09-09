-- ============================================================
-- AFRI CLUB
-- MIGRATION 041
-- AUTOMATISATION DES PAIEMENTS ET ACTIVATION DES ABONNEMENTS
--
-- Modèle SaaS :
--
-- Gratuit
--   -> activation immédiate
--
-- Standard / Pro
--   -> pending_payment
--   -> facture
--   -> paiement TOTAL obligatoire
--   -> confirmation serveur du prestataire
--   -> activation automatique
--   -> 30 jours de service
--
-- Aucun paiement partiel.
-- Aucune validation humaine dans le parcours normal.
--
-- Le Super-admin reste un outil :
-- - supervision
-- - support
-- - anomalies
-- - audit
-- - contrôles réglementaires
--
-- ============================================================


-- ============================================================
-- 1. STATUT pending_payment
-- ============================================================

alter table public.organization_subscriptions
drop constraint if exists
  organization_subscriptions_status_check;


alter table public.organization_subscriptions
add constraint
  organization_subscriptions_status_check
check (
  status in (
    'trialing',
    'pending_payment',
    'active',
    'past_due',
    'cancelled',
    'expired',
    'replaced'
  )
);


-- ============================================================
-- 2. UN SEUL ABONNEMENT EN ATTENTE PAR ORGANISATION
-- ============================================================

create unique index if not exists
  organization_subscriptions_one_pending_payment_idx

on public.organization_subscriptions (
  organization_id
)

where
  status = 'pending_payment';


-- ============================================================
-- 3. IDENTIFIANT EVENEMENT PRESTATAIRE
--
-- Permet de protéger les webhooks contre les doubles appels.
-- ============================================================

alter table public.subscription_invoice_payments
add column if not exists
  provider_event_ref text;


create unique index if not exists
  subscription_invoice_payments_provider_event_idx

on public.subscription_invoice_payments (
  provider,
  provider_event_ref
)

where
  provider_event_ref is not null;


-- ============================================================
-- 4. JOURNAL D'AUDIT PLATEFORME
--
-- Ce journal est distinct des opérations des mutuelles.
--
-- Il servira notamment pour :
--
-- - incidents ;
-- - support ;
-- - changements d'abonnement ;
-- - paiements ;
-- - contrôles ;
-- - investigations ;
-- - demandes d'autorités habilitées.
-- ============================================================

create table if not exists
  public.platform_audit_events
(
  id uuid primary key
    default gen_random_uuid(),

  event_type text not null,

  actor_type text not null
    check (
      actor_type in (
        'user',
        'platform_admin',
        'system',
        'payment_provider'
      )
    ),

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  organization_id uuid
    references public.organizations(id)
    on delete set null,

  subscription_id uuid
    references public.organization_subscriptions(id)
    on delete set null,

  invoice_id uuid
    references public.subscription_invoices(id)
    on delete set null,

  provider text,

  external_reference text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now()
);


create index if not exists
  platform_audit_events_created_at_idx
on public.platform_audit_events (
  created_at desc
);


create index if not exists
  platform_audit_events_organization_idx
on public.platform_audit_events (
  organization_id,
  created_at desc
);


create index if not exists
  platform_audit_events_event_type_idx
on public.platform_audit_events (
  event_type,
  created_at desc
);


alter table public.platform_audit_events
enable row level security;


revoke all
on public.platform_audit_events
from public, anon, authenticated;


-- ============================================================
-- 5. HELPER AUDIT
-- ============================================================

create or replace function private.write_platform_audit_event(

  target_event_type text,

  target_actor_type text,

  target_actor_user_id uuid default null,

  target_organization_id uuid default null,

  target_subscription_id uuid default null,

  target_invoice_id uuid default null,

  target_provider text default null,

  target_external_reference text default null,

  target_metadata jsonb default '{}'::jsonb

)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$

declare

  new_event_id uuid;

begin

  if nullif(
    btrim(
      coalesce(
        target_event_type,
        ''
      )
    ),
    ''
  ) is null then

    raise exception
      'Audit event type is required';

  end if;


  if target_actor_type not in (
    'user',
    'platform_admin',
    'system',
    'payment_provider'
  ) then

    raise exception
      'Invalid audit actor type';

  end if;


  insert into public.platform_audit_events
  (
    event_type,

    actor_type,

    actor_user_id,

    organization_id,

    subscription_id,

    invoice_id,

    provider,

    external_reference,

    metadata
  )
  values
  (
    target_event_type,

    target_actor_type,

    target_actor_user_id,

    target_organization_id,

    target_subscription_id,

    target_invoice_id,

    target_provider,

    target_external_reference,

    coalesce(
      target_metadata,
      '{}'::jsonb
    )
  )

  returning id
  into new_event_id;


  return new_event_id;

end;

$function$;


-- ============================================================
-- 6. CREATION FACTURE
--
-- Les abonnements pending_payment sont désormais facturables.
--
-- Pour un nouveau paiement :
--
-- période provisoire :
-- maintenant -> +30 jours
--
-- Au moment du paiement réel, la période sera recalée :
-- paid_at -> paid_at + 30 jours.
-- ============================================================

create or replace function private.create_subscription_invoice(
  target_subscription_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$

declare

  subscription_row record;

  existing_invoice_id uuid;

  new_invoice_id uuid;

  invoice_amount bigint;

  invoice_period_start timestamptz;

  invoice_period_end timestamptz;

  invoice_due_at timestamptz;

begin

  if target_subscription_id is null then

    raise exception
      'Subscription id is required';

  end if;


  select

    os.id
      as subscription_id,

    os.organization_id,

    os.plan_id,

    os.status,

    os.billing_cycle,

    os.starts_at,

    os.current_period_start,

    os.current_period_end,

    sp.code
      as plan_code,

    sp.name
      as plan_name,

    sp.monthly_price_xof,

    sp.yearly_price_xof,

    sp.is_custom_pricing

  into
    subscription_row

  from public.organization_subscriptions as os

  join public.subscription_plans as sp
    on sp.id = os.plan_id

  where
    os.id = target_subscription_id

  limit 1;


  if subscription_row.subscription_id is null then

    raise exception
      'Subscription not found';

  end if;


  -- Gratuit

  if subscription_row.plan_code = 'free' then

    return null;

  end if;


  -- Entreprise / sur devis

  if coalesce(
    subscription_row.is_custom_pricing,
    false
  ) = true then

    return null;

  end if;


  -- Facturable seulement dans ces états

  if subscription_row.status not in (
    'active',
    'pending_payment'
  ) then

    return null;

  end if;


  invoice_amount :=

    case

      when subscription_row.billing_cycle = 'monthly'
      then
        coalesce(
          subscription_row.monthly_price_xof,
          0
        )

      when subscription_row.billing_cycle = 'yearly'
      then
        coalesce(
          subscription_row.yearly_price_xof,
          0
        )

      else
        0

    end;


  if invoice_amount <= 0 then

    return null;

  end if;


  -- ==========================================================
  -- ABONNEMENT EN ATTENTE
  -- ==========================================================

  if subscription_row.status = 'pending_payment' then

    invoice_period_start :=
      now();

    invoice_period_end :=
      invoice_period_start +
      interval '30 days';

    -- La demande de paiement reste valable 24 heures.
    -- Ce n'est PAS la durée de l'abonnement.
    invoice_due_at :=
      now() +
      interval '24 hours';

  else

    invoice_period_start :=
      coalesce(
        subscription_row.current_period_start,
        subscription_row.starts_at,
        now()
      );


    invoice_period_end :=
      coalesce(
        subscription_row.current_period_end,
        invoice_period_start +
        interval '30 days'
      );


    invoice_due_at :=
      invoice_period_end;

  end if;


  -- ==========================================================
  -- ANTI-DOUBLON
  -- ==========================================================

  select
    si.id

  into
    existing_invoice_id

  from public.subscription_invoices as si

  where

    si.subscription_id =
      subscription_row.subscription_id

    and si.period_start =
      invoice_period_start

  limit 1;


  if existing_invoice_id is not null then

    return
      existing_invoice_id;

  end if;


  -- ==========================================================
  -- FACTURE
  -- ==========================================================

  insert into public.subscription_invoices
  (
    invoice_number,

    organization_id,

    subscription_id,

    plan_id,

    plan_code,

    plan_name,

    billing_cycle,

    period_start,

    period_end,

    currency,

    subtotal_xof,

    discount_xof,

    tax_xof,

    total_xof,

    amount_paid_xof,

    status,

    issued_at,

    due_at,

    description,

    created_by
  )
  values
  (
    private.generate_subscription_invoice_number(),

    subscription_row.organization_id,

    subscription_row.subscription_id,

    subscription_row.plan_id,

    subscription_row.plan_code,

    subscription_row.plan_name,

    subscription_row.billing_cycle,

    invoice_period_start,

    invoice_period_end,

    'XOF',

    invoice_amount,

    0,

    0,

    invoice_amount,

    0,

    'open',

    now(),

    invoice_due_at,

    'Abonnement Afri Club - ' ||
      subscription_row.plan_name,

    auth.uid()
  )

  returning id
  into new_invoice_id;


  perform private.write_platform_audit_event(

    'billing.invoice_created',

    'system',

    auth.uid(),

    subscription_row.organization_id,

    subscription_row.subscription_id,

    new_invoice_id,

    null,

    null,

    jsonb_build_object(
      'plan_code',
      subscription_row.plan_code,

      'amount_xof',
      invoice_amount
    )

  );


  return
    new_invoice_id;

end;

$function$;


-- ============================================================
-- 7. ACTIVATION APRES PAIEMENT COMPLET
--
-- L'ancien abonnement n'est remplacé qu'ici.
-- ============================================================

create or replace function private.activate_paid_subscription(

  target_subscription_id uuid,

  activation_time timestamptz

)
returns void
language plpgsql
security definer
set search_path = ''
as $function$

declare

  pending_row record;

  previous_subscription_id uuid;

  effective_activation_time timestamptz;

begin

  effective_activation_time :=
    coalesce(
      activation_time,
      now()
    );


  select

    os.id,

    os.organization_id,

    os.status,

    os.billing_cycle

  into
    pending_row

  from public.organization_subscriptions as os

  where
    os.id =
      target_subscription_id

  for update;


  if pending_row.id is null then

    raise exception
      'Subscription not found';

  end if;


  -- Anciennes factures du système :
  -- un abonnement déjà actif ne doit pas être réactivé.

  if pending_row.status = 'active' then

    return;

  end if;


  if pending_row.status <> 'pending_payment' then

    raise exception
      'Subscription is not pending payment';

  end if;


  -- ==========================================================
  -- VERROUILLAGE ORGANISATION
  -- ==========================================================

  perform
    o.id

  from public.organizations as o

  where
    o.id =
      pending_row.organization_id

  for update;


  -- ==========================================================
  -- ANCIEN ABONNEMENT
  -- ==========================================================

  select
    os.id

  into
    previous_subscription_id

  from public.organization_subscriptions as os

  where

    os.organization_id =
      pending_row.organization_id

    and os.id <>
      pending_row.id

    and os.status in (
      'trialing',
      'active',
      'past_due'
    )

  order by
    os.created_at desc

  limit 1

  for update;


  if previous_subscription_id is not null then

    update public.organization_subscriptions as os

    set

      status =
        'replaced',

      ended_at =
        effective_activation_time,

      cancel_at_period_end =
        false,

      updated_at =
        effective_activation_time

    where
      os.id =
        previous_subscription_id;

  end if;


  -- ==========================================================
  -- ACTIVATION : 30 JOURS EXACTEMENT
  -- ==========================================================

  update public.organization_subscriptions as os

  set

    status =
      'active',

    starts_at =
      effective_activation_time,

    current_period_start =
      effective_activation_time,

    current_period_end =
      effective_activation_time +
      interval '30 days',

    ended_at =
      null,

    cancel_at_period_end =
      false,

    updated_at =
      effective_activation_time

  where
    os.id =
      pending_row.id;


  perform private.write_platform_audit_event(

    'subscription.activated',

    'system',

    null,

    pending_row.organization_id,

    pending_row.id,

    null,

    null,

    null,

    jsonb_build_object(
      'starts_at',
      effective_activation_time,

      'ends_at',
      effective_activation_time +
      interval '30 days'
    )

  );

end;

$function$;


-- ============================================================
-- 8. DEMANDE DE SOUSCRIPTION PAR L'ORGANISATION
--
-- Accessible aux :
--
-- owner
-- president
-- treasurer
--
-- Pas besoin de Super-admin.
-- ============================================================

drop function if exists
  public.request_organization_subscription_checkout(
    uuid,
    text
  );


create or replace function
  public.request_organization_subscription_checkout
  (

    target_organization_id uuid,

    target_plan_code text

  )
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  clean_plan_code text;

  requested_plan record;

  current_subscription_id uuid;

  current_plan_code text;

  existing_pending_id uuid;

  existing_pending_plan_code text;

  new_subscription_id uuid;

  new_invoice_id uuid;

  active_member_count bigint := 0;

begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  if target_organization_id is null then

    raise exception
      'Organization id is required';

  end if;


  -- ==========================================================
  -- DROIT DE SOUSCRIRE
  -- ==========================================================

  if not exists (

    select 1

    from public.organization_users as ou

    where

      ou.organization_id =
        target_organization_id

      and ou.user_id =
        current_user_id

      and ou.is_active =
        true

      and ou.role::text in (
        'owner',
        'president',
        'treasurer'
      )

  ) then

    raise exception
      'Subscription management permission required';

  end if;


  -- ==========================================================
  -- VERROUILLER L'ORGANISATION
  -- ==========================================================

  perform
    o.id

  from public.organizations as o

  where
    o.id =
      target_organization_id

  for update;


  if not found then

    raise exception
      'Organization not found';

  end if;


  -- ==========================================================
  -- PLAN DEMANDE
  -- ==========================================================

  clean_plan_code :=

    lower(

      btrim(

        coalesce(
          target_plan_code,
          ''
        )

      )

    );


  if clean_plan_code not in (
    'standard',
    'pro'
  ) then

    raise exception
      'Only Standard and Pro can be purchased online';

  end if;


  select

    sp.id,

    sp.code,

    sp.name,

    sp.monthly_price_xof,

    sp.member_limit,

    sp.is_custom_pricing

  into
    requested_plan

  from public.subscription_plans as sp

  where

    sp.code =
      clean_plan_code

    and sp.is_active =
      true

  limit 1;


  if requested_plan.id is null then

    raise exception
      'Subscription plan not found';

  end if;


  if coalesce(
    requested_plan.is_custom_pricing,
    false
  ) = true then

    raise exception
      'Custom plan cannot be purchased online';

  end if;


  -- ==========================================================
  -- NOMBRE DE MEMBRES ACTIFS
  -- ==========================================================

  select
    count(*)

  into
    active_member_count

  from public.members as m

  where

    m.organization_id =
      target_organization_id

    and m.status::text =
      'active';


  active_member_count :=
    coalesce(
      active_member_count,
      0
    );


  if requested_plan.member_limit is not null
     and active_member_count >
       requested_plan.member_limit then

    raise exception
      'Organization exceeds selected plan member limit';

  end if;


  -- ==========================================================
  -- PLAN ACTUEL
  -- ==========================================================

  select

    os.id,

    sp.code

  into

    current_subscription_id,

    current_plan_code

  from public.organization_subscriptions as os

  join public.subscription_plans as sp
    on sp.id =
      os.plan_id

  where

    os.organization_id =
      target_organization_id

    and os.status in (
      'trialing',
      'active',
      'past_due'
    )

  order by
    os.created_at desc

  limit 1

  for update of os;


  if current_subscription_id is not null
     and current_plan_code =
       clean_plan_code then

    raise exception
      'Selected plan is already active';

  end if;


  -- ==========================================================
  -- DEMANDE DEJA EN ATTENTE
  -- ==========================================================

  select

    os.id,

    sp.code

  into

    existing_pending_id,

    existing_pending_plan_code

  from public.organization_subscriptions as os

  join public.subscription_plans as sp
    on sp.id =
      os.plan_id

  where

    os.organization_id =
      target_organization_id

    and os.status =
      'pending_payment'

  order by
    os.created_at desc

  limit 1

  for update of os;


  -- Même plan :
  -- on renvoie simplement la facture déjà existante.

  if existing_pending_id is not null
     and existing_pending_plan_code =
       clean_plan_code then

    select
      si.id

    into
      new_invoice_id

    from public.subscription_invoices as si

    where

      si.subscription_id =
        existing_pending_id

      and si.status in (
        'open',
        'draft'
      )

    order by
      si.created_at desc

    limit 1;


    return jsonb_build_object(

      'subscription_id',
        existing_pending_id,

      'invoice_id',
        new_invoice_id,

      'plan_code',
        clean_plan_code,

      'status',
        'pending_payment',

      'amount_xof',
        requested_plan.monthly_price_xof

    );

  end if;


  -- ==========================================================
  -- L'UTILISATEUR CHANGE DE PLAN AVANT DE PAYER
  --
  -- On annule proprement l'ancienne demande.
  -- ==========================================================

  if existing_pending_id is not null then

    update public.subscription_invoices as si

    set

      status =
        'cancelled',

      cancelled_at =
        now(),

      updated_at =
        now()

    where

      si.subscription_id =
        existing_pending_id

      and si.status in (
        'open',
        'draft'
      );


    update public.organization_subscriptions as os

    set

      status =
        'cancelled',

      ended_at =
        now(),

      updated_at =
        now()

    where
      os.id =
        existing_pending_id;

  end if;


  -- ==========================================================
  -- NOUVEL ABONNEMENT EN ATTENTE
  -- ==========================================================

  insert into public.organization_subscriptions
  (
    organization_id,

    plan_id,

    status,

    billing_cycle,

    starts_at,

    current_period_start,

    current_period_end,

    cancel_at_period_end,

    notes,

    created_by
  )
  values
  (
    target_organization_id,

    requested_plan.id,

    'pending_payment',

    'monthly',

    now(),

    now(),

    now() +
      interval '30 days',

    false,

    'Souscription en attente de paiement',

    current_user_id
  )

  returning id
  into new_subscription_id;


  -- Le trigger de la migration 039 appelle
  -- private.create_subscription_invoice(new.id)


  select
    si.id

  into
    new_invoice_id

  from public.subscription_invoices as si

  where
    si.subscription_id =
      new_subscription_id

  order by
    si.created_at desc

  limit 1;


  if new_invoice_id is null then

    raise exception
      'Subscription invoice was not created';

  end if;


  perform private.write_platform_audit_event(

    'subscription.checkout_requested',

    'user',

    current_user_id,

    target_organization_id,

    new_subscription_id,

    new_invoice_id,

    null,

    null,

    jsonb_build_object(

      'plan_code',
        clean_plan_code,

      'amount_xof',
        requested_plan.monthly_price_xof,

      'active_members',
        active_member_count

    )

  );


  return jsonb_build_object(

    'subscription_id',
      new_subscription_id,

    'invoice_id',
      new_invoice_id,

    'plan_code',
      clean_plan_code,

    'status',
      'pending_payment',

    'amount_xof',
      requested_plan.monthly_price_xof

  );

end;

$function$;


-- ============================================================
-- 9. MODIFIER LA FONCTION SUPER-ADMIN EXISTANTE
--
-- IMPORTANT :
--
-- Même le Super-admin ne doit plus activer Standard / Pro
-- gratuitement avec cette fonction.
--
-- Une formule payante passe par pending_payment.
-- ============================================================

drop function if exists
  public.change_platform_organization_subscription(
    uuid,
    text,
    text
  );


create or replace function
  public.change_platform_organization_subscription
  (

    target_organization_id uuid,

    target_plan_code text,

    change_note text default null

  )
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  clean_plan_code text;

  clean_note text;

  requested_plan record;

  current_subscription_id uuid;

  current_plan_code text;

  pending_subscription_id uuid;

  new_subscription_id uuid;

  new_invoice_id uuid;

begin

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  if not private.is_platform_super_admin(
    current_user_id
  ) then

    raise exception
      'Platform super administrator required';

  end if;


  if target_organization_id is null then

    raise exception
      'Organization id is required';

  end if;


  perform
    o.id

  from public.organizations as o

  where
    o.id =
      target_organization_id

  for update;


  if not found then

    raise exception
      'Organization not found';

  end if;


  clean_plan_code :=

    lower(

      btrim(

        coalesce(
          target_plan_code,
          ''
        )

      )

    );


  clean_note :=

    nullif(

      btrim(

        coalesce(
          change_note,
          ''
        )

      ),

      ''

    );


  select

    sp.id,

    sp.code,

    sp.name,

    sp.monthly_price_xof,

    sp.is_custom_pricing

  into
    requested_plan

  from public.subscription_plans as sp

  where

    sp.code =
      clean_plan_code

    and sp.is_active =
      true

  limit 1;


  if requested_plan.id is null then

    raise exception
      'Subscription plan not found';

  end if;


  -- ==========================================================
  -- ABONNEMENT ACTUEL
  -- ==========================================================

  select

    os.id,

    sp.code

  into

    current_subscription_id,

    current_plan_code

  from public.organization_subscriptions as os

  join public.subscription_plans as sp
    on sp.id =
      os.plan_id

  where

    os.organization_id =
      target_organization_id

    and os.status in (
      'trialing',
      'active',
      'past_due'
    )

  order by
    os.created_at desc

  limit 1

  for update of os;


  if current_subscription_id is not null
     and current_plan_code =
       clean_plan_code then

    raise exception
      'Selected plan is already active';

  end if;


  -- ==========================================================
  -- ANCIEN pending_payment
  -- ==========================================================

  select
    os.id

  into
    pending_subscription_id

  from public.organization_subscriptions as os

  where

    os.organization_id =
      target_organization_id

    and os.status =
      'pending_payment'

  limit 1

  for update;


  if pending_subscription_id is not null then

    update public.subscription_invoices as si

    set

      status =
        'cancelled',

      cancelled_at =
        now(),

      updated_at =
        now()

    where

      si.subscription_id =
        pending_subscription_id

      and si.status in (
        'open',
        'draft'
      );


    update public.organization_subscriptions as os

    set

      status =
        'cancelled',

      ended_at =
        now(),

      updated_at =
        now()

    where
      os.id =
        pending_subscription_id;

  end if;


  -- ==========================================================
  -- GRATUIT
  --
  -- Le gratuit ne nécessite aucun paiement.
  -- ==========================================================

  if clean_plan_code = 'free' then

    if current_subscription_id is not null then

      update public.organization_subscriptions as os

      set

        status =
          'replaced',

        ended_at =
          now(),

        cancel_at_period_end =
          false,

        updated_at =
          now()

      where
        os.id =
          current_subscription_id;

    end if;


    insert into public.organization_subscriptions
    (
      organization_id,

      plan_id,

      status,

      billing_cycle,

      starts_at,

      current_period_start,

      current_period_end,

      cancel_at_period_end,

      notes,

      created_by
    )
    values
    (
      target_organization_id,

      requested_plan.id,

      'active',

      'free',

      now(),

      now(),

      null,

      false,

      clean_note,

      current_user_id
    );


    perform private.write_platform_audit_event(

      'admin.subscription_changed_to_free',

      'platform_admin',

      current_user_id,

      target_organization_id,

      null,

      null,

      null,

      null,

      jsonb_build_object(
        'reason',
        clean_note
      )

    );


    return
      public.get_platform_subscription_detail(
        target_organization_id
      );

  end if;


  -- ==========================================================
  -- ENTREPRISE
  --
  -- Ne passe pas par paiement automatique V1.
  -- ==========================================================

  if requested_plan.is_custom_pricing = true then

    raise exception
      'Enterprise subscription requires commercial configuration';

  end if;


  -- ==========================================================
  -- STANDARD / PRO
  -- ==========================================================

  insert into public.organization_subscriptions
  (
    organization_id,

    plan_id,

    status,

    billing_cycle,

    starts_at,

    current_period_start,

    current_period_end,

    cancel_at_period_end,

    notes,

    created_by
  )
  values
  (
    target_organization_id,

    requested_plan.id,

    'pending_payment',

    'monthly',

    now(),

    now(),

    now() +
      interval '30 days',

    false,

    clean_note,

    current_user_id
  )

  returning id
  into new_subscription_id;


  select
    si.id

  into
    new_invoice_id

  from public.subscription_invoices as si

  where
    si.subscription_id =
      new_subscription_id

  order by
    si.created_at desc

  limit 1;


  perform private.write_platform_audit_event(

    'admin.subscription_payment_requested',

    'platform_admin',

    current_user_id,

    target_organization_id,

    new_subscription_id,

    new_invoice_id,

    null,

    null,

    jsonb_build_object(

      'plan_code',
        clean_plan_code,

      'amount_xof',
        requested_plan.monthly_price_xof,

      'reason',
        clean_note

    )

  );


  return
    public.get_platform_subscription_detail(
      target_organization_id
    );

end;

$function$;


-- ============================================================
-- 10. CONFIRMATION SERVEUR DU PAIEMENT
--
-- C'EST LE COEUR DU SYSTEME AUTOMATIQUE.
--
-- Cette fonction :
--
-- - n'est PAS disponible pour le navigateur ;
-- - n'est PAS disponible pour l'utilisateur ;
-- - n'est PAS disponible pour un Super-admin normal ;
-- - sera appelée uniquement par notre serveur webhook ;
-- - exige le paiement TOTAL ;
-- - est idempotente.
--
-- ============================================================

drop function if exists
  public.confirm_platform_provider_payment(
    uuid,
    bigint,
    text,
    text,
    text,
    timestamptz
  );


create or replace function
  public.confirm_platform_provider_payment
  (

    target_invoice_id uuid,

    payment_amount_xof bigint,

    payment_provider text,

    provider_transaction_reference text,

    provider_event_reference text default null,

    provider_paid_at timestamptz default null

  )
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$

declare

  invoice_row record;

  clean_provider text;

  clean_transaction_ref text;

  clean_event_ref text;

  effective_paid_at timestamptz;

  existing_payment record;

  payment_method_value text;

  new_payment_id uuid;

begin

  -- ==========================================================
  -- NORMALISATION
  -- ==========================================================

  if target_invoice_id is null then

    raise exception
      'Invoice id is required';

  end if;


  clean_provider :=

    lower(

      btrim(

        coalesce(
          payment_provider,
          ''
        )

      )

    );


  clean_transaction_ref :=

    nullif(

      btrim(

        coalesce(
          provider_transaction_reference,
          ''
        )

      ),

      ''

    );


  clean_event_ref :=

    nullif(

      btrim(

        coalesce(
          provider_event_reference,
          ''
        )

      ),

      ''

    );


  if clean_provider = '' then

    raise exception
      'Payment provider is required';

  end if;


  if clean_transaction_ref is null then

    raise exception
      'Provider transaction reference is required';

  end if;


  if payment_amount_xof is null
     or payment_amount_xof <= 0 then

    raise exception
      'Payment amount is invalid';

  end if;


  effective_paid_at :=
    coalesce(
      provider_paid_at,
      now()
    );


  -- ==========================================================
  -- IDEMPOTENCE PAR REFERENCE TRANSACTION
  -- ==========================================================

  select

    sip.id,

    sip.invoice_id,

    sip.status

  into
    existing_payment

  from public.subscription_invoice_payments as sip

  where

    sip.provider =
      clean_provider

    and sip.provider_transaction_ref =
      clean_transaction_ref

  limit 1;


  if existing_payment.id is not null then

    if existing_payment.invoice_id =
      target_invoice_id then

      return jsonb_build_object(

        'ok',
          true,

        'duplicate',
          true,

        'invoice_id',
          target_invoice_id,

        'payment_id',
          existing_payment.id

      );

    end if;


    raise exception
      'Provider transaction reference already used';

  end if;


  -- ==========================================================
  -- IDEMPOTENCE PAR EVENT WEBHOOK
  -- ==========================================================

  if clean_event_ref is not null then

    select

      sip.id,

      sip.invoice_id

    into
      existing_payment

    from public.subscription_invoice_payments as sip

    where

      sip.provider =
        clean_provider

      and sip.provider_event_ref =
        clean_event_ref

    limit 1;


    if existing_payment.id is not null then

      if existing_payment.invoice_id =
        target_invoice_id then

        return jsonb_build_object(

          'ok',
            true,

          'duplicate',
            true,

          'invoice_id',
            target_invoice_id,

          'payment_id',
            existing_payment.id

        );

      end if;


      raise exception
        'Provider event reference already used';

    end if;

  end if;


  -- ==========================================================
  -- FACTURE
  -- ==========================================================

  select

    si.id,

    si.organization_id,

    si.subscription_id,

    si.total_xof,

    si.amount_paid_xof,

    si.currency,

    si.status,

    si.plan_code

  into
    invoice_row

  from public.subscription_invoices as si

  where
    si.id =
      target_invoice_id

  for update;


  if invoice_row.id is null then

    raise exception
      'Invoice not found';

  end if;


  -- ==========================================================
  -- FACTURE DEJA PAYEE
  -- ==========================================================

  if invoice_row.status = 'paid' then

    raise exception
      'Invoice is already paid';

  end if;


  if invoice_row.status = 'cancelled' then

    raise exception
      'Cancelled invoice cannot receive payment';

  end if;


  if invoice_row.status = 'draft' then

    raise exception
      'Draft invoice cannot receive payment';

  end if;


  -- ==========================================================
  -- AUCUN PAIEMENT PARTIEL
  --
  -- Le montant doit être EXACTEMENT celui de la facture.
  -- ==========================================================

  if invoice_row.amount_paid_xof <> 0 then

    raise exception
      'Invoice already contains a payment amount';

  end if;


  if payment_amount_xof <>
    invoice_row.total_xof then

    raise exception
      'Payment amount must exactly match invoice total';

  end if;


  -- ==========================================================
  -- MODE DE PAIEMENT
  -- ==========================================================

  payment_method_value :=

    case

      when clean_provider = 'wave'
        then 'wave'

      when clean_provider in (
        'orange_money',
        'orange'
      )
        then 'orange_money'

      when clean_provider in (
        'mtn_momo',
        'mtn'
      )
        then 'mtn_momo'

      when clean_provider in (
        'moov_money',
        'moov'
      )
        then 'moov_money'

      else
        'other'

    end;


  -- ==========================================================
  -- PAIEMENT CONFIRME
  -- ==========================================================

  insert into public.subscription_invoice_payments
  (
    invoice_id,

    organization_id,

    amount_xof,

    currency,

    payment_method,

    provider,

    provider_transaction_ref,

    provider_event_ref,

    status,

    paid_at,

    confirmed_at,

    notes,

    created_by
  )
  values
  (
    target_invoice_id,

    invoice_row.organization_id,

    payment_amount_xof,

    coalesce(
      invoice_row.currency,
      'XOF'
    ),

    payment_method_value,

    clean_provider,

    clean_transaction_ref,

    clean_event_ref,

    'confirmed',

    effective_paid_at,

    effective_paid_at,

    'Paiement confirmé automatiquement par le prestataire.',

    null
  )

  returning id
  into new_payment_id;


  -- ==========================================================
  -- FACTURE PAYEE
  --
  -- La période réelle commence au paiement.
  -- ==========================================================

  update public.subscription_invoices as si

  set

    amount_paid_xof =
      si.total_xof,

    status =
      'paid',

    paid_at =
      effective_paid_at,

    period_start =
      effective_paid_at,

    period_end =
      effective_paid_at +
      interval '30 days',

    updated_at =
      now()

  where
    si.id =
      target_invoice_id;


  -- ==========================================================
  -- ACTIVATION AUTOMATIQUE
  -- ==========================================================

  perform
    private.activate_paid_subscription(

      invoice_row.subscription_id,

      effective_paid_at

    );


  -- ==========================================================
  -- AUDIT PAIEMENT
  -- ==========================================================

  perform private.write_platform_audit_event(

    'billing.payment_confirmed',

    'payment_provider',

    null,

    invoice_row.organization_id,

    invoice_row.subscription_id,

    target_invoice_id,

    clean_provider,

    clean_transaction_ref,

    jsonb_build_object(

      'amount_xof',
        payment_amount_xof,

      'provider_event_ref',
        clean_event_ref,

      'paid_at',
        effective_paid_at

    )

  );


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return jsonb_build_object(

    'ok',
      true,

    'duplicate',
      false,

    'invoice_id',
      target_invoice_id,

    'payment_id',
      new_payment_id,

    'subscription_id',
      invoice_row.subscription_id,

    'organization_id',
      invoice_row.organization_id,

    'status',
      'paid',

    'amount_xof',
      payment_amount_xof,

    'subscription_active_until',
      effective_paid_at +
      interval '30 days'

  );

end;

$function$;


-- ============================================================
-- 11. DESACTIVER LA VALIDATION MANUELLE NORMALE
--
-- La fonction de migration 040 peut rester en base pour
-- préserver l'historique, mais le rôle authenticated ne doit
-- plus pouvoir l'appeler.
-- ============================================================

revoke all
on function public.register_platform_invoice_payment(
  uuid,
  bigint,
  text,
  text,
  text
)
from public, anon, authenticated;


-- ============================================================
-- 12. DROITS : CHECKOUT UTILISATEUR
-- ============================================================

revoke all
on function public.request_organization_subscription_checkout(
  uuid,
  text
)
from public, anon, authenticated;


grant execute
on function public.request_organization_subscription_checkout(
  uuid,
  text
)
to authenticated;


-- ============================================================
-- 13. DROITS : SUPER ADMIN
-- ============================================================

revoke all
on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
from public, anon, authenticated;


grant execute
on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
to authenticated;


-- ============================================================
-- 14. DROITS : WEBHOOK SERVEUR UNIQUEMENT
--
-- IMPORTANT :
-- ne jamais exposer la clé service_role au navigateur.
-- ============================================================

revoke all
on function public.confirm_platform_provider_payment(
  uuid,
  bigint,
  text,
  text,
  text,
  timestamptz
)
from public, anon, authenticated;


grant execute
on function public.confirm_platform_provider_payment(
  uuid,
  bigint,
  text,
  text,
  text,
  timestamptz
)
to service_role;


-- ============================================================
-- 15. COMMENTAIRES
-- ============================================================

comment on function
  public.request_organization_subscription_checkout(
    uuid,
    text
  )
is
  'Crée une demande de souscription Standard ou Pro en attente de paiement pour une organisation Afri Club.';


comment on function
  public.confirm_platform_provider_payment(
    uuid,
    bigint,
    text,
    text,
    text,
    timestamptz
  )
is
  'Confirme automatiquement un paiement intégral provenant d un prestataire, solde la facture et active l abonnement pendant 30 jours.';


comment on table
  public.platform_audit_events
is
  'Journal d audit des événements sensibles de la plateforme Afri Club.';


-- ============================================================
-- 16. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';