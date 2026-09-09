-- ============================================================
-- AFRI CLUB
-- MIGRATION 046
-- IDENTITE UTILISATEUR ADMIN - REPLI SUR FICHE MEMBRE
--
-- IMPORTANT :
-- - ne pas modifier les migrations 032 et 033 déjà appliquées ;
-- - cette migration remplace uniquement les fonctions existantes ;
-- - aucun droit d'écriture supplémentaire ;
-- - lecture Super-admin uniquement.
-- ============================================================


-- ============================================================
-- 1. LISTE PLATEFORME UTILISATEURS
-- ============================================================

create or replace function public.list_platform_users(
  search_text text default null,
  limit_count integer default 50,
  offset_count integer default 0
)
returns table (

  user_id uuid,

  full_name text,

  email text,

  phone text,

  created_at timestamptz,

  last_sign_in_at timestamptz,

  organization_count bigint,

  management_organization_count bigint,

  member_space_count bigint,

  is_platform_admin boolean,

  platform_admin_role text,

  organization_roles jsonb,

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


  safe_limit :=
    least(
      greatest(
        coalesce(
          limit_count,
          50
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


  return query

  select

    au.id
      as user_id,


    -- --------------------------------------------------------
    -- NOM
    --
    -- Priorité :
    -- 1. public.profiles.full_name
    -- 2. fiche membre liée au compte
    -- 3. metadata Auth
    -- --------------------------------------------------------

    coalesce(

      nullif(
        btrim(
          p.full_name
        ),
        ''
      ),

      member_identity.member_full_name,

      nullif(
        btrim(
          au.raw_user_meta_data
            ->> 'full_name'
        ),
        ''
      ),

      nullif(
        btrim(
          au.raw_user_meta_data
            ->> 'name'
        ),
        ''
      )

    )
      as full_name,


    au.email::text
      as email,


    coalesce(

      nullif(
        btrim(
          p.phone
        ),
        ''
      ),

      member_identity.member_phone

    )
      as phone,


    au.created_at
      as created_at,


    au.last_sign_in_at
      as last_sign_in_at,


    coalesce(
      role_stats.organization_count,
      0
    )::bigint
      as organization_count,


    coalesce(
      role_stats.management_organization_count,
      0
    )::bigint
      as management_organization_count,


    coalesce(
      member_stats.member_space_count,
      0
    )::bigint
      as member_space_count,


    coalesce(
      pa.is_active,
      false
    )
      as is_platform_admin,


    case
      when pa.is_active = true
        then pa.role::text
      else null
    end
      as platform_admin_role,


    coalesce(
      role_stats.organization_roles,
      '[]'::jsonb
    )
      as organization_roles,


    count(*) over()
      as total_count


  from auth.users as au


  left join public.profiles as p
    on p.id =
      au.id


  left join public.platform_admins as pa
    on pa.user_id =
      au.id


  -- ==========================================================
  -- IDENTITE DE REPLI DEPUIS UNE FICHE MEMBRE
  --
  -- On privilégie une fiche active puis la plus récente.
  -- ==========================================================

  left join lateral (

    select

      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(
              btrim(
                m.first_name
              ),
              ''
            ),
            nullif(
              btrim(
                m.last_name
              ),
              ''
            )
          )
        ),
        ''
      )
        as member_full_name,

      nullif(
        btrim(
          m.phone
        ),
        ''
      )
        as member_phone

    from public.members as m

    where
      m.user_id =
        au.id

    order by

      case
        when m.status::text = 'active'
          then 0
        else 1
      end asc,

      m.created_at desc

    limit 1

  ) as member_identity
    on true


  -- ==========================================================
  -- ROLES DANS LES ORGANISATIONS
  -- ==========================================================

  left join lateral (

    select

      count(
        distinct ou.organization_id
      )::bigint
        as organization_count,


      count(
        distinct ou.organization_id
      )
      filter (
        where
          ou.role::text in (
            'owner',
            'president',
            'treasurer',
            'secretary',
            'auditor'
          )
      )::bigint
        as management_organization_count,


      coalesce(

        jsonb_agg(

          jsonb_build_object(

            'organization_id',
              o.id,

            'organization_name',
              o.name,

            'organization_short_name',
              o.short_name,

            'role',
              ou.role::text

          )

          order by
            o.name asc,
            ou.role::text asc

        ),

        '[]'::jsonb

      )
        as organization_roles


    from public.organization_users as ou

    join public.organizations as o
      on o.id =
        ou.organization_id

    where
      ou.user_id =
        au.id

      and ou.is_active =
        true

  ) as role_stats
    on true


  -- ==========================================================
  -- ESPACES MEMBRES
  -- ==========================================================

  left join lateral (

    select

      count(
        distinct m.organization_id
      )::bigint
        as member_space_count

    from public.members as m

    where
      m.user_id =
        au.id

      and m.status::text =
        'active'

  ) as member_stats
    on true


  -- ==========================================================
  -- RECHERCHE
  -- ==========================================================

  where

    normalized_search is null

    or

    coalesce(
      p.full_name,
      ''
    )
      ilike
        '%' ||
        normalized_search ||
        '%'

    or

    coalesce(
      member_identity.member_full_name,
      ''
    )
      ilike
        '%' ||
        normalized_search ||
        '%'

    or

    coalesce(
      au.email,
      ''
    )
      ilike
        '%' ||
        normalized_search ||
        '%'

    or

    coalesce(
      p.phone,
      ''
    )
      ilike
        '%' ||
        normalized_search ||
        '%'

    or

    coalesce(
      member_identity.member_phone,
      ''
    )
      ilike
        '%' ||
        normalized_search ||
        '%'

    or

    coalesce(
      au.raw_user_meta_data
        ->> 'full_name',
      ''
    )
      ilike
        '%' ||
        normalized_search ||
        '%'

    or

    coalesce(
      au.raw_user_meta_data
        ->> 'name',
      ''
    )
      ilike
        '%' ||
        normalized_search ||
        '%'

    or

    exists (

      select 1

      from public.organization_users
        as search_ou

      join public.organizations
        as search_o
        on search_o.id =
          search_ou.organization_id

      where
        search_ou.user_id =
          au.id

        and search_ou.is_active =
          true

        and (

          search_o.name
            ilike
              '%' ||
              normalized_search ||
              '%'

          or

          coalesce(
            search_o.short_name,
            ''
          )
            ilike
              '%' ||
              normalized_search ||
              '%'

        )

    )


  order by
    au.created_at desc


  limit
    safe_limit

  offset
    safe_offset;

end;

$function$;


-- ============================================================
-- 2. FICHE DETAILLEE UTILISATEUR
-- ============================================================

create or replace function public.get_platform_user_detail(
  target_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  user_result jsonb;

  organization_roles_result jsonb;

  member_spaces_result jsonb;

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


  if target_user_id is null then
    raise exception
      'User id is required';
  end if;


  if not exists (

    select 1

    from auth.users as au

    where au.id =
      target_user_id

  ) then
    raise exception
      'User not found';
  end if;


  select

    jsonb_build_object(

      'id',
        au.id,

      'email',
        au.email,

      'created_at',
        au.created_at,

      'last_sign_in_at',
        au.last_sign_in_at,

      'full_name',
        coalesce(

          nullif(
            btrim(
              p.full_name
            ),
            ''
          ),

          member_identity.member_full_name,

          nullif(
            btrim(
              au.raw_user_meta_data
                ->> 'full_name'
            ),
            ''
          ),

          nullif(
            btrim(
              au.raw_user_meta_data
                ->> 'name'
            ),
            ''
          )

        ),

      'phone',
        coalesce(

          nullif(
            btrim(
              p.phone
            ),
            ''
          ),

          member_identity.member_phone

        ),

      'is_platform_admin',
        coalesce(
          pa.is_active,
          false
        ),

      'platform_admin_role',
        case
          when pa.is_active = true
            then pa.role::text
          else null
        end,

      'platform_admin_created_at',
        case
          when pa.is_active = true
            then pa.created_at
          else null
        end

    )

  into
    user_result

  from auth.users as au

  left join public.profiles as p
    on p.id =
      au.id

  left join public.platform_admins as pa
    on pa.user_id =
      au.id

  left join lateral (

    select

      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(
              btrim(
                m.first_name
              ),
              ''
            ),
            nullif(
              btrim(
                m.last_name
              ),
              ''
            )
          )
        ),
        ''
      )
        as member_full_name,

      nullif(
        btrim(
          m.phone
        ),
        ''
      )
        as member_phone

    from public.members as m

    where
      m.user_id =
        au.id

    order by

      case
        when m.status::text = 'active'
          then 0
        else 1
      end asc,

      m.created_at desc

    limit 1

  ) as member_identity
    on true

  where
    au.id =
      target_user_id;


  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'organization_id',
            o.id,

          'organization_name',
            o.name,

          'organization_short_name',
            o.short_name,

          'organization_status',
            o.status::text,

          'role',
            ou.role::text,

          'is_active',
            ou.is_active,

          'created_at',
            ou.created_at

        )

        order by
          o.name asc,
          ou.role::text asc

      ),

      '[]'::jsonb

    )

  into
    organization_roles_result

  from public.organization_users as ou

  join public.organizations as o
    on o.id =
      ou.organization_id

  where
    ou.user_id =
      target_user_id;


  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'member_id',
            m.id,

          'organization_id',
            o.id,

          'organization_name',
            o.name,

          'organization_short_name',
            o.short_name,

          'member_number',
            m.member_number,

          'first_name',
            m.first_name,

          'last_name',
            m.last_name,

          'phone',
            m.phone,

          'email',
            m.email,

          'status',
            m.status::text,

          'joined_at',
            m.joined_at,

          'created_at',
            m.created_at

        )

        order by
          o.name asc,
          m.created_at asc

      ),

      '[]'::jsonb

    )

  into
    member_spaces_result

  from public.members as m

  join public.organizations as o
    on o.id =
      m.organization_id

  where
    m.user_id =
      target_user_id;


  return jsonb_build_object(

    'user',
      user_result,

    'organization_roles',
      coalesce(
        organization_roles_result,
        '[]'::jsonb
      ),

    'member_spaces',
      coalesce(
        member_spaces_result,
        '[]'::jsonb
      )

  );

end;

$function$;


-- ============================================================
-- 3. SECURITE
-- ============================================================

revoke all
on function public.list_platform_users(
  text,
  integer,
  integer
)
from public;

revoke all
on function public.list_platform_users(
  text,
  integer,
  integer
)
from anon;

revoke all
on function public.list_platform_users(
  text,
  integer,
  integer
)
from authenticated;

grant execute
on function public.list_platform_users(
  text,
  integer,
  integer
)
to authenticated;


revoke all
on function public.get_platform_user_detail(uuid)
from public;

revoke all
on function public.get_platform_user_detail(uuid)
from anon;

revoke all
on function public.get_platform_user_detail(uuid)
from authenticated;

grant execute
on function public.get_platform_user_detail(uuid)
to authenticated;


comment on function public.list_platform_users(
  text,
  integer,
  integer
)
is
'Afri Club - liste sécurisée des utilisateurs avec repli d identité sur la fiche membre. Super-admin uniquement.';


comment on function public.get_platform_user_detail(uuid)
is
'Afri Club - fiche détaillée utilisateur avec repli d identité sur la fiche membre. Super-admin uniquement.';


notify pgrst,
  'reload schema';
