-- ============================================================
-- AFRI CLUB
-- MIGRATION 034
-- ACTIVITE GLOBALE DE LA PLATEFORME
--
-- Lecture seule - Super administrateur uniquement.
--
-- Sources :
-- - auth.users
-- - organizations
-- - members
-- - payments
-- - ledger_entries
-- ============================================================


drop function if exists
  public.list_platform_activity(
    text,
    text,
    integer,
    integer
  );


create or replace function public.list_platform_activity(
  search_text text default null,
  event_type_filter text default null,
  limit_count integer default 100,
  offset_count integer default 0
)
returns table (

  event_id text,

  event_type text,

  title text,

  description text,

  occurred_at timestamptz,

  organization_id uuid,

  organization_name text,

  user_id uuid,

  user_name text,

  amount bigint,

  metadata jsonb,

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

  normalized_type text;

begin

  -- ==========================================================
  -- UTILISATEUR CONNECTE
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  -- ==========================================================
  -- SUPER ADMIN
  -- ==========================================================

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


  normalized_type :=
    nullif(
      lower(
        btrim(
          coalesce(
            event_type_filter,
            ''
          )
        )
      ),
      ''
    );


  if normalized_type = 'all' then
    normalized_type := null;
  end if;


  -- ==========================================================
  -- ACTIVITE
  -- ==========================================================

  return query

  with activity as (

    -- ========================================================
    -- 1. CREATION COMPTE UTILISATEUR
    -- ========================================================

    select

      'user:' ||
      au.id::text
        as event_id,

      'user'
        as event_type,

      'Nouveau compte utilisateur'
        as title,

      coalesce(

        nullif(
          btrim(
            p.full_name
          ),
          ''
        ),

        nullif(
          btrim(
            au.email
          ),
          ''
        ),

        'Compte utilisateur'

      )
        as description,

      au.created_at
        as occurred_at,

      null::uuid
        as organization_id,

      null::text
        as organization_name,

      au.id
        as user_id,

      coalesce(

        nullif(
          btrim(
            p.full_name
          ),
          ''
        ),

        nullif(
          btrim(
            au.email
          ),
          ''
        )

      )
        as user_name,

      null::bigint
        as amount,

      jsonb_build_object(
        'source',
          'auth.users',

        'email',
          au.email
      )
        as metadata


    from auth.users as au

    left join public.profiles as p
      on p.id =
        au.id


    union all


    -- ========================================================
    -- 2. CREATION ORGANISATION
    -- ========================================================

    select

      'organization:' ||
      o.id::text
        as event_id,

      'organization'
        as event_type,

      'Nouvelle organisation'
        as title,

      o.name
        as description,

      o.created_at
        as occurred_at,

      o.id
        as organization_id,

      o.name
        as organization_name,

      o.created_by
        as user_id,

      coalesce(

        nullif(
          btrim(
            creator_profile.full_name
          ),
          ''
        ),

        nullif(
          btrim(
            creator_auth.email
          ),
          ''
        )

      )
        as user_name,

      null::bigint
        as amount,

      jsonb_build_object(

        'source',
          'organizations',

        'short_name',
          o.short_name,

        'status',
          o.status::text,

        'organization_type',
          o.organization_type

      )
        as metadata


    from public.organizations as o

    left join public.profiles
      as creator_profile
      on creator_profile.id =
        o.created_by

    left join auth.users
      as creator_auth
      on creator_auth.id =
        o.created_by


    union all


    -- ========================================================
    -- 3. NOUVEAU MEMBRE
    -- ========================================================

    select

      'member:' ||
      m.id::text
        as event_id,

      'member'
        as event_type,

      'Nouveau membre'
        as title,

      concat_ws(
        ' ',
        m.first_name,
        m.last_name
      )
        as description,

      m.created_at
        as occurred_at,

      o.id
        as organization_id,

      o.name
        as organization_name,

      m.user_id
        as user_id,

      nullif(
        btrim(
          concat_ws(
            ' ',
            m.first_name,
            m.last_name
          )
        ),
        ''
      )
        as user_name,

      null::bigint
        as amount,

      jsonb_build_object(

        'source',
          'members',

        'member_id',
          m.id,

        'member_number',
          m.member_number,

        'member_status',
          m.status::text

      )
        as metadata


    from public.members as m

    join public.organizations as o
      on o.id =
        m.organization_id


    union all


    -- ========================================================
    -- 4. PAIEMENT CONFIRME
    -- ========================================================

    select

      'payment:' ||
      pay.id::text
        as event_id,

      'payment'
        as event_type,

      'Paiement confirmé'
        as title,

      'Paiement enregistré dans l''organisation'
        as description,

      pay.created_at
        as occurred_at,

      o.id
        as organization_id,

      o.name
        as organization_name,

      null::uuid
        as user_id,

      null::text
        as user_name,

      pay.amount::bigint
        as amount,

      jsonb_build_object(

        'source',
          'payments',

        'payment_id',
          pay.id,

        'status',
          pay.status

      )
        as metadata


    from public.payments as pay

    join public.organizations as o
      on o.id =
        pay.organization_id

    where
      pay.status =
        'confirmed'


    union all


    -- ========================================================
    -- 5. MOUVEMENTS DE TRESORERIE
    -- ========================================================

    select

      'ledger:' ||
      le.id::text
        as event_id,

      'treasury'
        as event_type,

      case

        when le.direction::text =
          'credit'
          then 'Entrée de trésorerie'

        when le.direction::text =
          'debit'
          then 'Sortie de trésorerie'

        else
          'Mouvement de trésorerie'

      end
        as title,

      coalesce(

        nullif(
          btrim(
            le.description
          ),
          ''
        ),

        replace(
          coalesce(
            le.category,
            'Mouvement'
          ),
          '_',
          ' '
        )

      )
        as description,

      le.created_at
        as occurred_at,

      o.id
        as organization_id,

      o.name
        as organization_name,

      null::uuid
        as user_id,

      null::text
        as user_name,

      le.amount::bigint
        as amount,

      jsonb_build_object(

        'source',
          'ledger_entries',

        'ledger_entry_id',
          le.id,

        'direction',
          le.direction::text,

        'category',
          le.category,

        'entry_date',
          le.entry_date

      )
        as metadata


    from public.ledger_entries as le

    join public.organizations as o
      on o.id =
        le.organization_id

  ),


  filtered as (

    select
      activity.*

    from activity

    where

      (
        normalized_type is null

        or

        activity.event_type =
          normalized_type
      )

      and

      (
        normalized_search is null

        or

        coalesce(
          activity.title,
          ''
        )
          ilike
            '%' ||
            normalized_search ||
            '%'

        or

        coalesce(
          activity.description,
          ''
        )
          ilike
            '%' ||
            normalized_search ||
            '%'

        or

        coalesce(
          activity.organization_name,
          ''
        )
          ilike
            '%' ||
            normalized_search ||
            '%'

        or

        coalesce(
          activity.user_name,
          ''
        )
          ilike
            '%' ||
            normalized_search ||
            '%'
      )

  )


  select

    filtered.event_id,

    filtered.event_type,

    filtered.title,

    filtered.description,

    filtered.occurred_at,

    filtered.organization_id,

    filtered.organization_name,

    filtered.user_id,

    filtered.user_name,

    filtered.amount,

    filtered.metadata,

    count(*) over()
      as total_count


  from filtered

  order by
    filtered.occurred_at desc


  limit
    safe_limit

  offset
    safe_offset;

end;

$function$;


-- ============================================================
-- SECURITE
-- ============================================================

revoke all
on function public.list_platform_activity(
  text,
  text,
  integer,
  integer
)
from public;


revoke all
on function public.list_platform_activity(
  text,
  text,
  integer,
  integer
)
from anon;


revoke all
on function public.list_platform_activity(
  text,
  text,
  integer,
  integer
)
from authenticated;


grant execute
on function public.list_platform_activity(
  text,
  text,
  integer,
  integer
)
to authenticated;


comment on function public.list_platform_activity(
  text,
  text,
  integer,
  integer
)
is
'Afri Club - flux global de supervision plateforme, accessible uniquement au Super-administrateur.';


notify pgrst,
  'reload schema';