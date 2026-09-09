-- ============================================================
-- AFRI CLUB
-- MIGRATION 041
-- ACTIVATION DES ABONNEMENTS APRES PAIEMENT
--
-- Objectifs :
--
-- 1. Ajouter le statut pending_payment
-- 2. Ne plus désactiver l'abonnement actuel avant paiement
-- 3. Gratuit : activation immédiate
-- 4. Standard / Pro : attente de paiement
-- 5. Entreprise : activation manuelle par le Super-admin
-- 6. Créer une facture pour un abonnement pending_payment
-- 7. Paiement partiel : abonnement reste en attente
-- 8. Paiement complet : activation automatique
-- 9. Remplacer l'ancien abonnement uniquement après paiement
-- 10. Préparer les futurs webhooks Wave / Orange Money
--
-- IMPORTANT :
--
-- Cette migration complète les migrations :
-- 038 : gestion des changements d'abonnement
-- 039 : facturation
-- 040 : paiements
--
-- ============================================================


-- ============================================================
-- 1. AJOUT DU STATUT pending_payment
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
-- 2. UN SEUL CHANGEMENT EN ATTENTE PAR ORGANISATION
--
-- Une organisation peut avoir :
--
-- - 1 abonnement actif
-- - 1 abonnement pending_payment
--
-- mais jamais deux pending_payment simultanément.
-- ============================================================

create unique index if not exists
  organization_subscriptions_one_pending_payment_idx

on public.organization_subscriptions (
  organization_id
)

where
  status =
    'pending_payment';


-- ============================================================
-- 3. FICHE ABONNEMENT
--
-- Ajout :
--
-- pending_subscription
--
-- current_subscription reste l'abonnement réellement actif.
-- ============================================================

drop function if exists
  public.get_platform_subscription_detail(uuid);


create or replace function
  public.get_platform_subscription_detail(
    target_organization_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  organization_result jsonb;

  current_subscription_result jsonb;

  pending_subscription_result jsonb;

  recommended_plan_result jsonb;

  history_result jsonb;

  plans_result jsonb;

  active_member_count bigint := 0;

  total_member_count bigint := 0;

begin

  -- ==========================================================
  -- AUTHENTIFICATION
  -- ==========================================================

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


  -- ==========================================================
  -- ORGANISATION
  -- ==========================================================

  select

    jsonb_build_object(

      'id',
        o.id,

      'name',
        o.name,

      'short_name',
        o.short_name,

      'status',
        o.status::text,

      'organization_type',
        o.organization_type,

      'created_at',
        o.created_at

    )

  into
    organization_result

  from public.organizations as o

  where

    o.id =
      target_organization_id;


  if organization_result is null then

    raise exception
      'Organization not found';

  end if;


  -- ==========================================================
  -- MEMBRES
  -- ==========================================================

  select

    count(*),

    count(*) filter (
      where
        m.status::text =
          'active'
    )

  into

    total_member_count,

    active_member_count

  from public.members as m

  where

    m.organization_id =
      target_organization_id;


  total_member_count :=
    coalesce(
      total_member_count,
      0
    );


  active_member_count :=
    coalesce(
      active_member_count,
      0
    );


  -- ==========================================================
  -- ABONNEMENT REELLEMENT ACTIF
  -- ==========================================================

  select

    jsonb_build_object(

      'subscription_id',
        os.id,

      'status',
        os.status,

      'billing_cycle',
        os.billing_cycle,

      'starts_at',
        os.starts_at,

      'current_period_start',
        os.current_period_start,

      'current_period_end',
        os.current_period_end,

      'cancel_at_period_end',
        os.cancel_at_period_end,

      'ended_at',
        os.ended_at,

      'notes',
        os.notes,

      'created_at',
        os.created_at,

      'updated_at',
        os.updated_at,

      'plan',
        jsonb_build_object(

          'id',
            sp.id,

          'code',
            sp.code,

          'name',
            sp.name,

          'description',
            sp.description,

          'monthly_price_xof',
            sp.monthly_price_xof,

          'member_limit',
            sp.member_limit,

          'is_custom_pricing',
            sp.is_custom_pricing

        )

    )

  into
    current_subscription_result

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

  limit 1;


  -- ==========================================================
  -- ABONNEMENT EN ATTENTE DE PAIEMENT
  -- ==========================================================

  select

    jsonb_build_object(

      'subscription_id',
        os.id,

      'status',
        os.status,

      'billing_cycle',
        os.billing_cycle,

      'starts_at',
        os.starts_at,

      'current_period_start',
        os.current_period_start,

      'current_period_end',
        os.current_period_end,

      'notes',
        os.notes,

      'created_at',
        os.created_at,

      'updated_at',
        os.updated_at,

      'plan',
        jsonb_build_object(

          'id',
            sp.id,

          'code',
            sp.code,

          'name',
            sp.name,

          'description',
            sp.description,

          'monthly_price_xof',
            sp.monthly_price_xof,

          'member_limit',
            sp.member_limit,

          'is_custom_pricing',
            sp.is_custom_pricing

        ),

      'invoice',
        (

          select

            jsonb_build_object(

              'id',
                si.id,

              'invoice_number',
                si.invoice_number,

              'status',
                si.status,

              'total_xof',
                si.total_xof,

              'amount_paid_xof',
                si.amount_paid_xof,

              'amount_remaining_xof',
                greatest(
                  si.total_xof -
                  si.amount_paid_xof,
                  0
                ),

              'issued_at',
                si.issued_at,

              'due_at',
                si.due_at

            )

          from public.subscription_invoices as si

          where

            si.subscription_id =
              os.id

            and si.status <>
              'cancelled'

          order by
            si.created_at desc

          limit 1

        )

    )

  into
    pending_subscription_result

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

  limit 1;


  -- ==========================================================
  -- PLAN RECOMMANDE
  -- ==========================================================

  select

    jsonb_build_object(

      'id',
        sp.id,

      'code',
        sp.code,

      'name',
        sp.name,

      'monthly_price_xof',
        sp.monthly_price_xof,

      'member_limit',
        sp.member_limit,

      'is_custom_pricing',
        sp.is_custom_pricing

    )

  into
    recommended_plan_result

  from public.subscription_plans as sp

  where

    sp.is_active =
      true

    and sp.code =

      case

        when active_member_count <= 20 then
          'free'

        when active_member_count <= 50 then
          'standard'

        when active_member_count <= 500 then
          'pro'

        else
          'enterprise'

      end

  limit 1;


  -- ==========================================================
  -- HISTORIQUE
  -- ==========================================================

  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'subscription_id',
            os.id,

          'status',
            os.status,

          'billing_cycle',
            os.billing_cycle,

          'starts_at',
            os.starts_at,

          'current_period_start',
            os.current_period_start,

          'current_period_end',
            os.current_period_end,

          'ended_at',
            os.ended_at,

          'notes',
            os.notes,

          'created_at',
            os.created_at,

          'updated_at',
            os.updated_at,

          'created_by',
            os.created_by,

          'plan_id',
            sp.id,

          'plan_code',
            sp.code,

          'plan_name',
            sp.name,

          'monthly_price_xof',
            sp.monthly_price_xof,

          'is_custom_pricing',
            sp.is_custom_pricing

        )

        order by
          os.created_at desc

      ),

      '[]'::jsonb

    )

  into
    history_result

  from public.organization_subscriptions as os

  join public.subscription_plans as sp

    on sp.id =
      os.plan_id

  where

    os.organization_id =
      target_organization_id;


  -- ==========================================================
  -- PLANS DISPONIBLES
  -- ==========================================================

  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'id',
            sp.id,

          'code',
            sp.code,

          'name',
            sp.name,

          'description',
            sp.description,

          'monthly_price_xof',
            sp.monthly_price_xof,

          'member_limit',
            sp.member_limit,

          'is_custom_pricing',
            sp.is_custom_pricing

        )

        order by
          sp.sort_order asc

      ),

      '[]'::jsonb

    )

  into
    plans_result

  from public.subscription_plans as sp

  where

    sp.is_active =
      true;


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return

    jsonb_build_object(

      'organization',
        organization_result,

      'members',
        jsonb_build_object(

          'total',
            total_member_count,

          'active',
            active_member_count

        ),

      'current_subscription',
        current_subscription_result,

      'pending_subscription',
        pending_subscription_result,

      'recommended_plan',
        recommended_plan_result,

      'history',
        history_result,

      'available_plans',
        plans_result

    );

end;

$function$;


-- ============================================================
-- 4. CREATION D'UNE FACTURE
--
-- La migration 039 ne facturait que status = active.
--
-- Désormais :
--
-- active
-- OU
-- pending_payment
--
-- peut générer une facture.
-- ============================================================

create or replace function
  private.create_subscription_invoice(
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


  -- ==========================================================
  -- ABONNEMENT + PLAN
  -- ==========================================================

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

    on sp.id =
      os.plan_id

  where

    os.id =
      target_subscription_id

  limit 1;


  if subscription_row.subscription_id is null then

    raise exception
      'Subscription not found';

  end if;


  -- ==========================================================
  -- GRATUIT
  -- ==========================================================

  if subscription_row.plan_code =
    'free' then

    return null;

  end if;


  -- ==========================================================
  -- ENTREPRISE / TARIFICATION SUR DEVIS
  -- ==========================================================

  if coalesce(
    subscription_row.is_custom_pricing,
    false
  ) = true then

    return null;

  end if;


  -- ==========================================================
  -- STATUT FACTURABLE
  -- ==========================================================

  if subscription_row.status not in (
    'active',
    'pending_payment'
  ) then

    return null;

  end if;


  -- ==========================================================
  -- MONTANT
  -- ==========================================================

  invoice_amount :=

    case

      when subscription_row.billing_cycle =
        'monthly'

      then
        coalesce(
          subscription_row.monthly_price_xof,
          0
        )


      when subscription_row.billing_cycle =
        'yearly'

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
  -- PERIODE
  -- ==========================================================

  invoice_period_start :=

    coalesce(

      subscription_row.current_period_start,

      subscription_row.starts_at,

      now()

    );


  invoice_period_end :=

    coalesce(

      subscription_row.current_period_end,

      case

        when subscription_row.billing_cycle =
          'yearly'

        then
          invoice_period_start +
          interval '1 year'

        else
          invoice_period_start +
          interval '1 month'

      end

    );


  invoice_due_at :=
    invoice_period_end;


  -- ==========================================================
  -- ANTI DOUBLON
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

  returning
    id

  into
    new_invoice_id;


  return
    new_invoice_id;

end;

$function$;


-- ============================================================
-- 5. ACTIVATION INTERNE APRES PAIEMENT
--
-- Cette fonction sera également réutilisable plus tard
-- par les webhooks Wave / Orange Money.
-- ============================================================

create or replace function
  private.activate_paid_subscription(
    target_subscription_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $function$

declare

  pending_row record;

  previous_subscription_id uuid;

  activation_time timestamptz;

  activation_period_end timestamptz;

begin

  activation_time :=
    now();


  -- ==========================================================
  -- ABONNEMENT A ACTIVER
  -- ==========================================================

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


  -- ==========================================================
  -- SI DEJA ACTIVE :
  -- rien à faire
  --
  -- Permet notamment de payer une facture créée par
  -- l'ancien système avant cette migration.
  -- ==========================================================

  if pending_row.status =
    'active' then

    return;

  end if;


  if pending_row.status <>
    'pending_payment' then

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
  -- ANCIEN ABONNEMENT ACTIF
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


  -- ==========================================================
  -- REMPLACEMENT DE L'ANCIEN PLAN
  --
  -- C'est seulement ici, après paiement complet,
  -- que l'ancien abonnement est terminé.
  -- ==========================================================

  if previous_subscription_id is not null then

    update public.organization_subscriptions as os

    set

      status =
        'replaced',

      ended_at =
        activation_time,

      cancel_at_period_end =
        false,

      updated_at =
        activation_time

    where

      os.id =
        previous_subscription_id;

  end if;


  -- ==========================================================
  -- NOUVELLE FIN DE PERIODE
  -- ==========================================================

  activation_period_end :=

    case

      when pending_row.billing_cycle =
        'monthly'

      then
        activation_time +
        interval '1 month'


      when pending_row.billing_cycle =
        'yearly'

      then
        activation_time +
        interval '1 year'


      else
        null

    end;


  -- ==========================================================
  -- ACTIVATION
  -- ==========================================================

  update public.organization_subscriptions as os

  set

    status =
      'active',

    starts_at =
      activation_time,

    current_period_start =
      activation_time,

    current_period_end =
      activation_period_end,

    ended_at =
      null,

    cancel_at_period_end =
      false,

    updated_at =
      activation_time

  where

    os.id =
      pending_row.id;

end;

$function$;


-- ============================================================
-- 6. CHANGER DE PLAN
--
-- NOUVELLE LOGIQUE :
--
-- Gratuit :
--     activation immédiate
--
-- Standard / Pro :
--     pending_payment
--     ancienne formule reste active
--     facture créée automatiquement
--
-- Entreprise :
--     activation manuelle immédiate par Super-admin
--     car tarification sur devis
--
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

  new_plan_id uuid;

  new_plan_code text;

  new_plan_custom boolean;

  current_subscription_id uuid;

  current_plan_code text;

  pending_subscription_id uuid;

  pending_plan_code text;

  new_subscription_id uuid;

  new_billing_cycle text;

  new_status text;

  new_period_end timestamptz;

begin

  -- ==========================================================
  -- AUTHENTIFICATION
  -- ==========================================================

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


  -- ==========================================================
  -- ORGANISATION
  -- ==========================================================

  if target_organization_id is null then

    raise exception
      'Organization id is required';

  end if;


  -- Verrouillage organisation :
  -- empêche deux changements simultanés.

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
  -- PLAN
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


  if clean_plan_code =
    '' then

    raise exception
      'Plan code is required';

  end if;


  select

    sp.id,

    sp.code,

    sp.is_custom_pricing

  into

    new_plan_id,

    new_plan_code,

    new_plan_custom

  from public.subscription_plans as sp

  where

    sp.code =
      clean_plan_code

    and sp.is_active =
      true

  limit 1;


  if new_plan_id is null then

    raise exception
      'Subscription plan not found';

  end if;


  -- ==========================================================
  -- VERIFIER UN CHANGEMENT DEJA EN ATTENTE
  -- ==========================================================

  select

    os.id,

    sp.code

  into

    pending_subscription_id,

    pending_plan_code

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


  if pending_subscription_id is not null then

    if pending_plan_code =
      new_plan_code then

      raise exception
        'Selected plan is already pending payment';

    end if;


    raise exception
      'Another subscription change is already pending payment';

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


  -- ==========================================================
  -- MEME PLAN
  -- ==========================================================

  if current_subscription_id is not null
     and current_plan_code =
       new_plan_code then

    raise exception
      'Selected plan is already active';

  end if;


  -- ==========================================================
  -- CYCLE
  -- ==========================================================

  new_billing_cycle :=

    case

      when new_plan_code =
        'free'

      then
        'free'


      when new_plan_custom =
        true

      then
        'custom'


      else
        'monthly'

    end;


  -- ==========================================================
  -- STATUT INITIAL
  -- ==========================================================

  new_status :=

    case

      -- Gratuit :
      -- aucun paiement nécessaire

      when new_plan_code =
        'free'

      then
        'active'


      -- Entreprise :
      -- contrat / devis géré manuellement par Super-admin

      when new_plan_custom =
        true

      then
        'active'


      -- Standard / Pro

      else
        'pending_payment'

    end;


  -- ==========================================================
  -- PERIODE INITIALE
  -- ==========================================================

  new_period_end :=

    case

      when new_billing_cycle =
        'monthly'

      then
        now() +
        interval '1 month'


      when new_billing_cycle =
        'yearly'

      then
        now() +
        interval '1 year'


      else
        null

    end;


  -- ==========================================================
  -- GRATUIT / ENTREPRISE
  --
  -- Comme aucun paiement automatique n'est attendu,
  -- le changement est immédiat.
  -- ==========================================================

  if new_status =
    'active'
  then

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

  end if;


  -- ==========================================================
  -- CREATION
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

    new_plan_id,

    new_status,

    new_billing_cycle,

    now(),

    now(),

    new_period_end,

    false,

    clean_note,

    current_user_id

  )

  returning
    id

  into
    new_subscription_id;


  -- ==========================================================
  -- IMPORTANT
  --
  -- Le trigger de migration 039 appelle :
  --
  -- private.create_subscription_invoice(new.id)
  --
  -- La fonction ayant été modifiée plus haut,
  -- pending_payment génère désormais une facture.
  -- ==========================================================


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return

    public.get_platform_subscription_detail(
      target_organization_id
    );

end;

$function$;


-- ============================================================
-- 7. PAIEMENT
--
-- Remplacement de la fonction migration 040.
--
-- Lorsqu'une facture est complètement payée :
--
-- pending_payment
--       ↓
-- private.activate_paid_subscription()
--       ↓
-- ancien abonnement = replaced
--       ↓
-- nouveau abonnement = active
-- ============================================================

drop function if exists
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  );


create or replace function
  public.register_platform_invoice_payment
  (

    target_invoice_id uuid,

    payment_amount_xof bigint,

    target_payment_method text,

    transaction_reference text default null,

    payment_note text default null

  )
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  invoice_row record;

  clean_payment_method text;

  clean_transaction_reference text;

  clean_note text;

  new_payment_id uuid;

  confirmed_total bigint;

  invoice_fully_paid boolean := false;

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


  if not private.is_platform_super_admin(
    current_user_id
  ) then

    raise exception
      'Platform super administrator required';

  end if;


  -- ==========================================================
  -- VALIDATION
  -- ==========================================================

  if target_invoice_id is null then

    raise exception
      'Invoice id is required';

  end if;


  if payment_amount_xof is null
     or payment_amount_xof <= 0 then

    raise exception
      'Payment amount must be greater than zero';

  end if;


  clean_payment_method :=

    lower(

      btrim(

        coalesce(
          target_payment_method,
          ''
        )

      )

    );


  if clean_payment_method not in (

    'manual',
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
    'bank_transfer',
    'cash',
    'other'

  ) then

    raise exception
      'Invalid payment method';

  end if;


  clean_transaction_reference :=

    nullif(

      btrim(

        coalesce(
          transaction_reference,
          ''
        )

      ),

      ''

    );


  clean_note :=

    nullif(

      btrim(

        coalesce(
          payment_note,
          ''
        )

      ),

      ''

    );


  -- ==========================================================
  -- VERROUILLAGE FACTURE
  -- ==========================================================

  select

    si.id,

    si.organization_id,

    si.subscription_id,

    si.total_xof,

    si.amount_paid_xof,

    si.status,

    si.currency

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
  -- FACTURE NON PAYABLE
  -- ==========================================================

  if invoice_row.status =
    'cancelled' then

    raise exception
      'Cancelled invoice cannot receive payment';

  end if;


  if invoice_row.status =
    'paid' then

    raise exception
      'Invoice is already paid';

  end if;


  if invoice_row.status =
    'draft' then

    raise exception
      'Draft invoice cannot receive payment';

  end if;


  -- ==========================================================
  -- SURPAIEMENT
  -- ==========================================================

  if payment_amount_xof >

    greatest(

      invoice_row.total_xof -
      invoice_row.amount_paid_xof,

      0

    )

  then

    raise exception
      'Payment amount exceeds invoice balance';

  end if;


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

    clean_payment_method,

    case

      when clean_payment_method in (
        'wave',
        'orange_money',
        'mtn_momo',
        'moov_money'
      )

      then
        clean_payment_method

      else
        null

    end,

    clean_transaction_reference,

    'confirmed',

    now(),

    now(),

    clean_note,

    current_user_id

  )

  returning
    id

  into
    new_payment_id;


  -- ==========================================================
  -- TOTAL CONFIRME
  -- ==========================================================

  select

    coalesce(

      sum(
        sip.amount_xof
      ),

      0

    )::bigint

  into
    confirmed_total

  from public.subscription_invoice_payments as sip

  where

    sip.invoice_id =
      target_invoice_id

    and sip.status =
      'confirmed';


  invoice_fully_paid :=

    confirmed_total >=
      invoice_row.total_xof;


  -- ==========================================================
  -- FACTURE
  -- ==========================================================

  update public.subscription_invoices as si

  set

    amount_paid_xof =
      confirmed_total,


    status =

      case

        when invoice_fully_paid

        then
          'paid'

        else
          'open'

      end,


    paid_at =

      case

        when invoice_fully_paid

        then
          coalesce(
            si.paid_at,
            now()
          )

        else
          null

      end,


    updated_at =
      now()

  where

    si.id =
      target_invoice_id;


  -- ==========================================================
  -- ACTIVATION AUTOMATIQUE
  -- ==========================================================

  if invoice_fully_paid then

    perform

      private.activate_paid_subscription(
        invoice_row.subscription_id
      );

  end if;


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return

    public.get_platform_subscription_invoice_detail(
      target_invoice_id
    );

end;

$function$;


-- ============================================================
-- 8. DROITS
-- ============================================================

revoke all
on function
  public.get_platform_subscription_detail(uuid)
from public, anon, authenticated;


grant execute
on function
  public.get_platform_subscription_detail(uuid)
to authenticated;


revoke all
on function
  public.change_platform_organization_subscription(
    uuid,
    text,
    text
  )
from public, anon, authenticated;


grant execute
on function
  public.change_platform_organization_subscription(
    uuid,
    text,
    text
  )
to authenticated;


revoke all
on function
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  )
from public, anon, authenticated;


grant execute
on function
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  )
to authenticated;


-- ============================================================
-- 9. COMMENTAIRES
-- ============================================================

comment on function
  public.change_platform_organization_subscription(
    uuid,
    text,
    text
  )
is
  'Demande un changement de formule Afri Club. Les plans payants restent pending_payment jusqu au règlement complet de leur facture.';


comment on function
  private.activate_paid_subscription(uuid)
is
  'Active un abonnement Afri Club après règlement complet et remplace alors seulement l ancien abonnement.';


comment on function
  private.create_subscription_invoice(uuid)
is
  'Crée une facture pour un abonnement Afri Club actif ou en attente de paiement.';


-- ============================================================
-- 10. POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';