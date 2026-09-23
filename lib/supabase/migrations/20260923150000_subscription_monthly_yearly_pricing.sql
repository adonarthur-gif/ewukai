-- ============================================================
-- EWUKAI
-- Tarification mensuelle / annuelle
--
-- Standard :
--   mensuel : 5 250 XOF
--   annuel  : 52 500 XOF
--
-- Pro :
--   mensuel : 10 500 XOF
--   annuel  : 105 000 XOF
--
-- L'euro reste une valeur d'affichage dans l'interface :
-- Standard : 8 EUR / 80 EUR
-- Pro      : 16 EUR / 160 EUR
-- ============================================================

begin;


-- ============================================================
-- 1. NOUVEAUX TARIFS
-- ============================================================

update public.subscription_plans
set
  monthly_price_xof = 5250,
  yearly_price_xof = 52500
where code = 'standard';


update public.subscription_plans
set
  monthly_price_xof = 10500,
  yearly_price_xof = 105000
where code = 'pro';


-- ============================================================
-- 2. ANNULER LES ANCIENNES DEMANDES NON PAYEES
--
-- Les anciennes factures ont été créées avec les anciens prix.
-- Elles ne doivent pas pouvoir être payées après le changement
-- de grille tarifaire.
-- ============================================================

update public.subscription_invoices as si
set
  status = 'cancelled',
  cancelled_at = coalesce(
    si.cancelled_at,
    now()
  ),
  updated_at = now()
where
  si.status in (
    'open',
    'draft'
  )
  and exists (
    select 1
    from public.organization_subscriptions as os
    join public.subscription_plans as sp
      on sp.id = os.plan_id
    where
      os.id = si.subscription_id
      and os.status = 'pending_payment'
      and sp.code in (
        'standard',
        'pro'
      )
  );


update public.organization_subscriptions as os
set
  status = 'cancelled',
  ended_at = coalesce(
    os.ended_at,
    now()
  ),
  updated_at = now()
where
  os.status = 'pending_payment'
  and exists (
    select 1
    from public.subscription_plans as sp
    where
      sp.id = os.plan_id
      and sp.code in (
        'standard',
        'pro'
      )
  );


-- ============================================================
-- 3. CALCUL CENTRAL DE LA FIN DE PERIODE
-- ============================================================

create or replace function
  private.subscription_period_end(
    target_billing_cycle text,
    period_start timestamptz
  )
returns timestamptz
language sql
immutable
strict
set search_path = ''
as $function$

  select
    case
      when lower(
        btrim(target_billing_cycle)
      ) = 'monthly'
        then period_start + interval '30 days'

      when lower(
        btrim(target_billing_cycle)
      ) = 'yearly'
        then period_start + interval '1 year'

      else null
    end;

$function$;


revoke all
on function private.subscription_period_end(
  text,
  timestamptz
)
from public, anon, authenticated;


-- ============================================================
-- 4. SECURISER LA PERIODE DES FACTURES
--
-- Même si une ancienne fonction fournit encore +30 jours,
-- la facture sera alignée sur son billing_cycle.
-- ============================================================

create or replace function
  private.enforce_subscription_invoice_period()
returns trigger
language plpgsql
set search_path = ''
as $function$

begin

  if new.period_start is not null
     and new.billing_cycle in (
       'monthly',
       'yearly'
     ) then

    new.period_end :=
      private.subscription_period_end(
        new.billing_cycle,
        new.period_start
      );

  end if;

  return new;

end;

$function$;


drop trigger if exists
  trg_enforce_subscription_invoice_period
on public.subscription_invoices;


create trigger
  trg_enforce_subscription_invoice_period
before insert
or update of
  period_start,
  billing_cycle,
  status
on public.subscription_invoices
for each row
execute function
  private.enforce_subscription_invoice_period();


-- ============================================================
-- 5. ACTIVATION APRES PAIEMENT
--
-- Mensuel = 30 jours
-- Annuel  = 1 an
-- ============================================================

create or replace function
  private.activate_paid_subscription(
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

  effective_period_end timestamptz;

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


  if pending_row.status = 'active' then

    return;

  end if;


  if pending_row.status <> 'pending_payment' then

    raise exception
      'Subscription is not pending payment';

  end if;


  effective_period_end :=
    private.subscription_period_end(
      pending_row.billing_cycle,
      effective_activation_time
    );


  if effective_period_end is null then

    raise exception
      'Unsupported subscription billing cycle';

  end if;


  -- Verrou organisation

  perform
    o.id
  from public.organizations as o
  where
    o.id =
      pending_row.organization_id
  for update;


  if not found then

    raise exception
      'Organization not found';

  end if;


  -- Ancien abonnement

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
      status = 'replaced',
      ended_at =
        effective_activation_time,
      cancel_at_period_end = false,
      updated_at =
        effective_activation_time
    where
      os.id =
        previous_subscription_id;

  end if;


  -- Activation

  update public.organization_subscriptions as os
  set
    status = 'active',
    starts_at =
      effective_activation_time,
    current_period_start =
      effective_activation_time,
    current_period_end =
      effective_period_end,
    ended_at = null,
    cancel_at_period_end = false,
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
      'billing_cycle',
        pending_row.billing_cycle,
      'starts_at',
        effective_activation_time,
      'ends_at',
        effective_period_end
    )
  );

end;

$function$;


-- ============================================================
-- 6. CHECKOUT AVEC CYCLE
-- ============================================================

create or replace function
  public.request_organization_subscription_checkout(
    target_organization_id uuid,
    target_plan_code text,
    target_billing_cycle text
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

  clean_billing_cycle text;

  requested_plan record;

  requested_amount bigint;

  requested_period_start timestamptz;

  requested_period_end timestamptz;

  current_subscription_id uuid;

  current_plan_code text;

  current_billing_cycle text;

  existing_pending_id uuid;

  existing_pending_plan_code text;

  existing_pending_billing_cycle text;

  new_subscription_id uuid;

  new_invoice_id uuid;

  active_member_count bigint := 0;

begin

  -- AUTH

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


  -- AUTORISATION

  if not exists (

    select 1

    from public.organization_users as ou

    where
      ou.organization_id =
        target_organization_id

      and ou.user_id =
        current_user_id

      and ou.is_active = true

      and ou.role::text in (
        'owner',
        'president',
        'treasurer'
      )

  ) then

    raise exception
      'Subscription management permission required';

  end if;


  -- VERROU ORGANISATION

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


  -- PLAN

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


  -- CYCLE

  clean_billing_cycle :=
    lower(
      btrim(
        coalesce(
          target_billing_cycle,
          ''
        )
      )
    );


  if clean_billing_cycle not in (
    'monthly',
    'yearly'
  ) then

    raise exception
      'Billing cycle must be monthly or yearly';

  end if;


  -- FORMULE

  select
    sp.id,
    sp.code,
    sp.name,
    sp.monthly_price_xof,
    sp.yearly_price_xof,
    sp.member_limit,
    sp.is_custom_pricing
  into
    requested_plan
  from public.subscription_plans as sp
  where
    sp.code =
      clean_plan_code
    and sp.is_active = true
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


  requested_amount :=
    case
      when clean_billing_cycle = 'monthly'
        then requested_plan.monthly_price_xof

      when clean_billing_cycle = 'yearly'
        then requested_plan.yearly_price_xof

      else null
    end;


  if requested_amount is null
     or requested_amount <= 0 then

    raise exception
      'Subscription price is invalid';

  end if;


  requested_period_start :=
    now();


  requested_period_end :=
    private.subscription_period_end(
      clean_billing_cycle,
      requested_period_start
    );


  -- NOMBRE DE MEMBRES

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


  -- ABONNEMENT ACTUEL

  select
    os.id,
    sp.code,
    os.billing_cycle
  into
    current_subscription_id,
    current_plan_code,
    current_billing_cycle
  from public.organization_subscriptions as os
  join public.subscription_plans as sp
    on sp.id = os.plan_id
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
       clean_plan_code
     and current_billing_cycle =
       clean_billing_cycle then

    raise exception
      'Selected plan and billing cycle are already active';

  end if;


  -- DEMANDE EN ATTENTE

  select
    os.id,
    sp.code,
    os.billing_cycle
  into
    existing_pending_id,
    existing_pending_plan_code,
    existing_pending_billing_cycle
  from public.organization_subscriptions as os
  join public.subscription_plans as sp
    on sp.id = os.plan_id
  where
    os.organization_id =
      target_organization_id

    and os.status =
      'pending_payment'
  order by
    os.created_at desc
  limit 1
  for update of os;


  -- Même plan + même cycle :
  -- réutiliser la demande existante.

  if existing_pending_id is not null
     and existing_pending_plan_code =
       clean_plan_code
     and existing_pending_billing_cycle =
       clean_billing_cycle then

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

      'billing_cycle',
        clean_billing_cycle,

      'status',
        'pending_payment',

      'amount_xof',
        requested_amount
    );

  end if;


  -- Une autre demande existe :
  -- l'annuler avant d'en créer une nouvelle.

  if existing_pending_id is not null then

    update public.subscription_invoices as si
    set
      status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
    where
      si.subscription_id =
        existing_pending_id

      and si.status in (
        'open',
        'draft'
      );


    update public.organization_subscriptions as os
    set
      status = 'cancelled',
      ended_at = now(),
      updated_at = now()
    where
      os.id =
        existing_pending_id;

  end if;


  -- NOUVEL ABONNEMENT

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
    clean_billing_cycle,
    requested_period_start,
    requested_period_start,
    requested_period_end,
    false,
    'Souscription EWUKAI en attente de paiement',
    current_user_id
  )
  returning id
  into new_subscription_id;


  -- Le trigger existant crée la facture.

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
      'billing_cycle',
        clean_billing_cycle,
      'amount_xof',
        requested_amount,
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

    'billing_cycle',
      clean_billing_cycle,

    'status',
      'pending_payment',

    'amount_xof',
      requested_amount
  );

end;

$function$;


-- ============================================================
-- 7. COMPATIBILITE AVEC L'APPLICATION ACTUELLE
--
-- Tant que l'interface n'envoie pas encore billing_cycle,
-- l'ancien appel à deux paramètres continue en mensuel.
-- ============================================================

create or replace function
  public.request_organization_subscription_checkout(
    target_organization_id uuid,
    target_plan_code text
  )
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$

  select
    public.request_organization_subscription_checkout(
      target_organization_id,
      target_plan_code,
      'monthly'
    );

$function$;


-- ============================================================
-- 8. DROITS
-- ============================================================

revoke all
on function public.request_organization_subscription_checkout(
  uuid,
  text,
  text
)
from public, anon, authenticated;


grant execute
on function public.request_organization_subscription_checkout(
  uuid,
  text,
  text
)
to authenticated;


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


comment on function
  public.request_organization_subscription_checkout(
    uuid,
    text,
    text
  )
is
  'Prépare une souscription EWUKAI Standard ou Pro avec cycle mensuel ou annuel.';


commit;