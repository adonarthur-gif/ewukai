-- ============================================================
-- AFRI CLUB
-- MIGRATION 037
-- ADMINISTRATION DES ABONNEMENTS
--
-- Règles :
-- 0 - 20 membres    = Gratuit
-- 21 - 50           = Standard
-- 51 - 500          = Pro
-- 501 et plus       = Entreprise
--
-- Lecture seule pour cette première version.
-- ============================================================


-- ============================================================
-- 1. LISTE DES ABONNEMENTS
-- ============================================================

drop function if exists
  public.list_platform_subscriptions(
    text,
    text,
    text,
    integer,
    integer
  );


create or replace function public.list_platform_subscriptions(

  search_text text default null,

  plan_code_filter text default null,

  status_filter text default null,

  limit_count integer default 100,

  offset_count integer default 0

)
returns table (

  organization_id uuid,

  organization_name text,

  organization_short_name text,

  organization_status text,

  total_members bigint,

  active_members bigint,

  subscription_id uuid,

  plan_id uuid,

  plan_code text,

  plan_name text,

  monthly_price_xof bigint,

  member_limit integer,

  is_custom_pricing boolean,

  subscription_status text,

  billing_cycle text,

  starts_at timestamptz,

  current_period_start timestamptz,

  current_period_end timestamptz,

  cancel_at_period_end boolean,

  recommended_plan_id uuid,

  recommended_plan_code text,

  recommended_plan_name text,

  recommended_monthly_price_xof bigint,

  recommended_member_limit integer,

  plan_alignment text,

  total_count bigint

)
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  safe_limit integer;

  safe_offset integer;

  normalized_search text;

  normalized_plan text;

  normalized_status text;

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
  -- PARAMETRES
  -- ==========================================================

  safe_limit :=
    least(
      greatest(
        coalesce(
          limit_count,
          100
        ),
        1
      ),
      200
    );


  safe_offset :=
    greatest(
      coalesce(
        offset_count,
        0
      ),
      0
    );


  normalized_search :=
    nullif(
      btrim(
        coalesce(
          search_text,
          ''
        )
      ),
      ''
    );


  normalized_plan :=
    nullif(
      lower(
        btrim(
          coalesce(
            plan_code_filter,
            ''
          )
        )
      ),
      ''
    );


  normalized_status :=
    nullif(
      lower(
        btrim(
          coalesce(
            status_filter,
            ''
          )
        )
      ),
      ''
    );


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return query

  with subscriptions as (

    select

      o.id
        as organization_id,

      o.name
        as organization_name,

      o.short_name
        as organization_short_name,

      o.status::text
        as organization_status,


      -- ======================================================
      -- MEMBRES
      -- ======================================================

      coalesce(
        member_stats.total_members,
        0
      )::bigint
        as total_members,

      coalesce(
        member_stats.active_members,
        0
      )::bigint
        as active_members,


      -- ======================================================
      -- ABONNEMENT
      -- ======================================================

      current_subscription.id
        as subscription_id,

      current_plan.id
        as plan_id,

      current_plan.code
        as plan_code,

      current_plan.name
        as plan_name,

      current_plan.monthly_price_xof,

      current_plan.member_limit,

      current_plan.is_custom_pricing,

      current_subscription.status
        as subscription_status,

      current_subscription.billing_cycle,

      current_subscription.starts_at,

      current_subscription.current_period_start,

      current_subscription.current_period_end,

      current_subscription.cancel_at_period_end,


      -- ======================================================
      -- PLAN RECOMMANDE
      -- ======================================================

      recommended_plan.id
        as recommended_plan_id,

      recommended_plan.code
        as recommended_plan_code,

      recommended_plan.name
        as recommended_plan_name,

      recommended_plan.monthly_price_xof
        as recommended_monthly_price_xof,

      recommended_plan.member_limit
        as recommended_member_limit,


      -- ======================================================
      -- ALIGNEMENT
      -- ======================================================

      case

        when current_subscription.id is null then
          'missing'

        when current_subscription.status not in (
          'trialing',
          'active',
          'past_due'
        ) then
          'inactive'

        when current_plan.sort_order <
             recommended_plan.sort_order then
          'upgrade_recommended'

        when current_plan.sort_order >
             recommended_plan.sort_order then
          'higher_plan'

        else
          'aligned'

      end
        as plan_alignment


    from public.organizations as o


    -- ========================================================
    -- STATISTIQUES MEMBRES
    -- ========================================================

    left join lateral (

      select

        count(*)
          as total_members,

        count(*) filter (
          where m.status::text =
            'active'
        )
          as active_members

      from public.members as m

      where
        m.organization_id =
          o.id

    ) as member_stats
      on true


    -- ========================================================
    -- ABONNEMENT LE PLUS PERTINENT
    --
    -- Priorité :
    -- actif / essai / retard
    -- puis dernier abonnement historique
    -- ========================================================

    left join lateral (

      select
        os.*

      from public.organization_subscriptions as os

      where
        os.organization_id =
          o.id

      order by

        case

          when os.status = 'active'
            then 1

          when os.status = 'trialing'
            then 2

          when os.status = 'past_due'
            then 3

          when os.status = 'cancelled'
            then 4

          when os.status = 'expired'
            then 5

          else 6

        end,

        os.created_at desc

      limit 1

    ) as current_subscription
      on true


    -- ========================================================
    -- PLAN ACTUEL
    -- ========================================================

    left join public.subscription_plans
      as current_plan

      on current_plan.id =
        current_subscription.plan_id


    -- ========================================================
    -- PLAN RECOMMANDE
    -- ========================================================

    left join lateral (

      select
        rp.*

      from public.subscription_plans as rp

      where

        rp.is_active =
          true

        and rp.code =

          case

            when coalesce(
              member_stats.active_members,
              0
            ) <= 20
              then 'free'

            when coalesce(
              member_stats.active_members,
              0
            ) <= 50
              then 'standard'

            when coalesce(
              member_stats.active_members,
              0
            ) <= 500
              then 'pro'

            else
              'enterprise'

          end

      limit 1

    ) as recommended_plan
      on true

  ),


  filtered as (

    select
      subscriptions.*

    from subscriptions

    where

      -- ======================================================
      -- RECHERCHE
      -- ======================================================

      (
        normalized_search is null

        or

        subscriptions.organization_name
          ilike
            '%' ||
            normalized_search ||
            '%'

        or

        coalesce(
          subscriptions.organization_short_name,
          ''
        )
          ilike
            '%' ||
            normalized_search ||
            '%'

        or

        coalesce(
          subscriptions.plan_name,
          ''
        )
          ilike
            '%' ||
            normalized_search ||
            '%'
      )


      -- ======================================================
      -- PLAN
      -- ======================================================

      and
      (
        normalized_plan is null

        or

        subscriptions.plan_code =
          normalized_plan
      )


      -- ======================================================
      -- STATUT
      -- ======================================================

      and
      (
        normalized_status is null

        or

        (
          normalized_status = 'missing'

          and subscriptions.subscription_id
            is null
        )

        or

        subscriptions.subscription_status =
          normalized_status
      )

  )


  select

    filtered.organization_id,

    filtered.organization_name,

    filtered.organization_short_name,

    filtered.organization_status,

    filtered.total_members,

    filtered.active_members,

    filtered.subscription_id,

    filtered.plan_id,

    filtered.plan_code,

    filtered.plan_name,

    filtered.monthly_price_xof,

    filtered.member_limit,

    filtered.is_custom_pricing,

    filtered.subscription_status,

    filtered.billing_cycle,

    filtered.starts_at,

    filtered.current_period_start,

    filtered.current_period_end,

    filtered.cancel_at_period_end,

    filtered.recommended_plan_id,

    filtered.recommended_plan_code,

    filtered.recommended_plan_name,

    filtered.recommended_monthly_price_xof,

    filtered.recommended_member_limit,

    filtered.plan_alignment,

    count(*) over()
      as total_count

  from filtered

  order by

    case
      when filtered.plan_alignment =
        'upgrade_recommended'
        then 1

      when filtered.subscription_status =
        'past_due'
        then 2

      when filtered.plan_alignment =
        'missing'
        then 3

      else 4
    end,

    filtered.organization_name asc

  limit
    safe_limit

  offset
    safe_offset;

end;

$function$;


-- ============================================================
-- 2. STATISTIQUES ADMIN ABONNEMENTS
-- ============================================================

drop function if exists
  public.get_platform_subscription_admin_stats();


create or replace function public.get_platform_subscription_admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

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


  return (

    with organization_data as (

      select

        o.id,

        coalesce(
          member_stats.active_members,
          0
        )::bigint
          as active_members,

        current_subscription.status
          as subscription_status,

        current_plan.code
          as plan_code,

        current_plan.sort_order
          as current_sort_order,

        current_plan.monthly_price_xof,

        current_plan.is_custom_pricing,

        recommended_plan.sort_order
          as recommended_sort_order


      from public.organizations as o


      left join lateral (

        select

          count(*) filter (
            where m.status::text =
              'active'
          )
            as active_members

        from public.members as m

        where
          m.organization_id =
            o.id

      ) as member_stats
        on true


      left join lateral (

        select
          os.*

        from public.organization_subscriptions as os

        where
          os.organization_id =
            o.id

        order by

          case
            when os.status = 'active'
              then 1
            when os.status = 'trialing'
              then 2
            when os.status = 'past_due'
              then 3
            when os.status = 'cancelled'
              then 4
            when os.status = 'expired'
              then 5
            else 6
          end,

          os.created_at desc

        limit 1

      ) as current_subscription
        on true


      left join public.subscription_plans
        as current_plan

        on current_plan.id =
          current_subscription.plan_id


      left join lateral (

        select
          rp.*

        from public.subscription_plans as rp

        where

          rp.is_active =
            true

          and rp.code =

            case

              when coalesce(
                member_stats.active_members,
                0
              ) <= 20
                then 'free'

              when coalesce(
                member_stats.active_members,
                0
              ) <= 50
                then 'standard'

              when coalesce(
                member_stats.active_members,
                0
              ) <= 500
                then 'pro'

              else
                'enterprise'

            end

        limit 1

      ) as recommended_plan
        on true

    )


    select
      jsonb_build_object(

        'total_organizations',
          count(*),


        'active_subscriptions',

          count(*) filter (

            where subscription_status
              in (
                'active',
                'trialing'
              )

          ),


        'paid_subscriptions',

          count(*) filter (

            where

              subscription_status
                in (
                  'active',
                  'trialing',
                  'past_due'
                )

              and plan_code
                in (
                  'standard',
                  'pro',
                  'enterprise'
                )

          ),


        'free_subscriptions',

          count(*) filter (

            where

              subscription_status
                in (
                  'active',
                  'trialing',
                  'past_due'
                )

              and plan_code =
                'free'

          ),


        'past_due_subscriptions',

          count(*) filter (

            where subscription_status =
              'past_due'

          ),


        'upgrade_recommended',

          count(*) filter (

            where

              current_sort_order
                is not null

              and recommended_sort_order
                is not null

              and current_sort_order <
                recommended_sort_order

          ),


        'estimated_monthly_revenue_xof',

          coalesce(

            sum(

              case

                when subscription_status
                  in (
                    'active',
                    'trialing'
                  )

                  and coalesce(
                    is_custom_pricing,
                    false
                  ) = false

                then coalesce(
                  monthly_price_xof,
                  0
                )

                else 0

              end

            ),

            0

          )

      )

    from organization_data

  );

end;

$function$;


-- ============================================================
-- 3. DROITS
-- ============================================================

revoke all
on function public.list_platform_subscriptions(
  text,
  text,
  text,
  integer,
  integer
)
from public, anon, authenticated;


grant execute
on function public.list_platform_subscriptions(
  text,
  text,
  text,
  integer,
  integer
)
to authenticated;


revoke all
on function public.get_platform_subscription_admin_stats()
from public, anon, authenticated;


grant execute
on function public.get_platform_subscription_admin_stats()
to authenticated;


-- ============================================================
-- 4. COMMENTAIRES
-- ============================================================

comment on function public.list_platform_subscriptions(
  text,
  text,
  text,
  integer,
  integer
)
is
'Liste Super-admin des abonnements Afri Club avec plan actuel, nombre de membres et plan recommandé.';


comment on function public.get_platform_subscription_admin_stats()
is
'Statistiques générales de supervision des abonnements Afri Club.';


-- ============================================================
-- 5. POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';