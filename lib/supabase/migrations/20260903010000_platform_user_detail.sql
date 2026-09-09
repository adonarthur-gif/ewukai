-- ============================================================
-- AFRI CLUB
-- MIGRATION 033
-- FICHE DETAILLEE D'UN UTILISATEUR PLATEFORME
--
-- Lecture seule - Super administrateur uniquement.
-- ============================================================

drop function if exists
  public.get_platform_user_detail(uuid);


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
  -- VALIDATION
  -- ==========================================================

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


  -- ==========================================================
  -- COMPTE + PROFIL + ADMIN PLATEFORME
  -- ==========================================================

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
        p.phone,

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

  where
    au.id =
      target_user_id;


  -- ==========================================================
  -- ROLES DANS LES ORGANISATIONS
  -- ==========================================================

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
          o.name asc

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


  -- ==========================================================
  -- DOSSIERS / ESPACES MEMBRES
  -- ==========================================================

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


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

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
-- SECURITE
-- ============================================================

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


comment on function public.get_platform_user_detail(uuid)
is
'Afri Club - fiche détaillée en lecture seule d un utilisateur, réservée au Super-admin.';


notify pgrst,
  'reload schema';