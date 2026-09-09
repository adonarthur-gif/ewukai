-- ============================================================
-- AFRI CLUB
-- MIGRATION 038
-- GESTION DES CHANGEMENTS D'ABONNEMENT
--
-- Objectifs :
-- - conserver l'historique complet ;
-- - ne jamais écraser l'ancien abonnement ;
-- - permettre au Super-admin de changer une formule ;
-- - afficher le détail et l'historique d'une organisation.
-- ============================================================


-- ============================================================
-- 1. AJOUT DU STATUT "replaced"
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
    'active',
    'past_due',
    'cancelled',
    'expired',
    'replaced'
  )
);


-- ============================================================
-- 2. FICHE DETAILLEE D'ABONNEMENT
-- ============================================================

drop function if exists
  public.get_platform_subscription_detail(uuid);


create or replace function public.get_platform_subscription_detail(
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
      where m.status::text =
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
  -- ABONNEMENT COURANT
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

  return jsonb_build_object(

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
-- 3. CHANGER OFFICIELLEMENT LE PLAN
-- ============================================================

drop function if exists
  public.change_platform_organization_subscription(
    uuid,
    text,
    text
  );


create or replace function public.change_platform_organization_subscription(

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

  new_billing_cycle text;

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
  -- VALIDATION ORGANISATION
  -- ==========================================================

  if target_organization_id is null then

    raise exception
      'Organization id is required';

  end if;


  if not exists (

    select 1

    from public.organizations as o

    where
      o.id =
        target_organization_id

  ) then

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


  if clean_plan_code = '' then

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
  -- VERROUILLAGE DE L'ABONNEMENT COURANT
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
  -- TERMINER L'ANCIEN ABONNEMENT
  -- ==========================================================

  if current_subscription_id is not null then

    update public.organization_subscriptions

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
      id =
        current_subscription_id;

  end if;


  -- ==========================================================
  -- CYCLE DU NOUVEAU PLAN
  -- ==========================================================

  new_billing_cycle :=

    case

      when new_plan_code =
        'free'
        then 'free'

      when new_plan_custom =
        true
        then 'custom'

      else
        'monthly'

    end;


  -- ==========================================================
  -- FIN DE PERIODE
  -- ==========================================================

  new_period_end :=

    case

      when new_billing_cycle =
        'monthly'

        then
          now() +
          interval '1 month'

      else
        null

    end;


  -- ==========================================================
  -- NOUVEL ABONNEMENT
  -- ==========================================================

  insert into public.organization_subscriptions (

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
  values (

    target_organization_id,

    new_plan_id,

    'active',

    new_billing_cycle,

    now(),

    now(),

    new_period_end,

    false,

    clean_note,

    current_user_id

  );


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
-- 4. DROITS
-- ============================================================

revoke all
on function public.get_platform_subscription_detail(uuid)
from public, anon, authenticated;


grant execute
on function public.get_platform_subscription_detail(uuid)
to authenticated;


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
-- 5. COMMENTAIRES
-- ============================================================

comment on function public.get_platform_subscription_detail(uuid)
is
'Fiche Super-admin complète de l abonnement d une organisation Afri Club.';


comment on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
is
'Change le plan d une organisation en conservant intégralement l historique des abonnements.';


-- ============================================================
-- 6. POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';