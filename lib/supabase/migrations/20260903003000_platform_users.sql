-- ============================================================
-- AFRI CLUB
-- MIGRATION 032
-- ADMINISTRATION PLATEFORME - UTILISATEURS
--
-- Objectifs :
-- - permettre au Super-admin de consulter les comptes ;
-- - rechercher par nom, email, téléphone ou organisation ;
-- - distinguer compte, rôles de gestion et espace membre ;
-- - aucune modification des utilisateurs ;
-- - aucune service_role côté navigateur.
-- ============================================================


-- ============================================================
-- SUPPRIMER UNE ANCIENNE VERSION EVENTUELLE
-- ============================================================

drop function if exists
  public.list_platform_users(
    text,
    integer,
    integer
  );


-- ============================================================
-- LISTE GLOBALE DES UTILISATEURS
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

  -- ==========================================================
  -- 1. UTILISATEUR CONNECTE
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  -- ==========================================================
  -- 2. SUPER ADMIN OBLIGATOIRE
  -- ==========================================================

  if not private.is_platform_super_admin(
    current_user_id
  ) then

    raise exception
      'Platform super administrator required';

  end if;


  -- ==========================================================
  -- 3. PARAMETRES
  -- ==========================================================

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


  -- ==========================================================
  -- 4. RESULTAT
  -- ==========================================================

  return query

  select

    au.id
      as user_id,


    -- --------------------------------------------------------
    -- NOM
    --
    -- Priorité :
    -- 1. public.profiles
    -- 2. metadata Auth
    -- --------------------------------------------------------

    coalesce(

      nullif(
        btrim(
          p.full_name
        ),
        ''
      ),

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


    p.phone
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


  -- ==========================================================
  -- PROFIL
  -- ==========================================================

  left join public.profiles as p
    on p.id =
      au.id


  -- ==========================================================
  -- ADMIN PLATEFORME
  -- ==========================================================

  left join public.platform_admins as pa
    on pa.user_id =
      au.id


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
            o.name asc

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
  --
  -- On utilise members.user_id :
  -- un dossier membre lié à ce compte Auth.
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
      au.raw_user_meta_data
        ->> 'full_name',
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


  -- ==========================================================
  -- ORDRE
  -- ==========================================================

  order by
    au.created_at desc


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


-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on function public.list_platform_users(
  text,
  integer,
  integer
)
is
'Afri Club - liste sécurisée et en lecture seule des utilisateurs de la plateforme. Accessible uniquement au Super-admin.';


-- ============================================================
-- POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';