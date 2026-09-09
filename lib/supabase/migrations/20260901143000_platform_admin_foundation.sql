begin;

-- ============================================================
-- AFRI CLUB
-- MIGRATION 030
-- ADMINISTRATION DE LA PLATEFORME
-- ============================================================

-- ============================================================
-- 1. ROLE ADMINISTRATEUR DE PLATEFORME
-- ============================================================

do $$
begin
  create type public.platform_admin_role as enum (
    'super_admin'
  );
exception
  when duplicate_object then
    null;
end
$$;

-- ============================================================
-- 2. TABLE DES ADMINISTRATEURS AFRI CLUB
--
-- IMPORTANT :
-- Cette table est totalement séparée de organization_users.
--
-- Un même compte peut donc être :
--
-- organization_users
--   ATA -> owner
--
-- members
--   ATA -> membre
--
-- platform_admins
--   Afri Club -> super_admin
-- ============================================================

create table if not exists public.platform_admins (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  role public.platform_admin_role
    not null
    default 'super_admin',

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

-- ============================================================
-- 3. INDEX
-- ============================================================

create index if not exists
  idx_platform_admins_active
on public.platform_admins (
  is_active
);

-- ============================================================
-- 4. UPDATED_AT
-- ============================================================

create or replace function private.touch_platform_admin_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists
  trg_platform_admins_updated_at
on public.platform_admins;

create trigger
  trg_platform_admins_updated_at
before update
on public.platform_admins
for each row
execute function
  private.touch_platform_admin_updated_at();

-- ============================================================
-- 5. RLS
-- ============================================================

alter table public.platform_admins
enable row level security;

-- ------------------------------------------------------------
-- L'administrateur connecté peut uniquement lire
-- son propre statut depuis le client.
-- ------------------------------------------------------------

drop policy if exists
  "platform_admins_select_own"
on public.platform_admins;

create policy
  "platform_admins_select_own"
on public.platform_admins
for select
to authenticated
using (
  user_id = auth.uid()
);

-- ============================================================
-- 6. VERROUILLAGE DES ECRITURES CLIENT
--
-- Aucun utilisateur connecté ne doit pouvoir se transformer
-- lui-même en super-administrateur depuis le navigateur.
--
-- Les insertions/modifications seront réalisées par :
-- - migration,
-- - SQL sécurisé,
-- - ou future fonction spécialement protégée.
-- ============================================================

revoke all
on table public.platform_admins
from anon;

revoke insert, update, delete
on table public.platform_admins
from authenticated;

grant select
on table public.platform_admins
to authenticated;

-- ============================================================
-- 7. HELPER INTERNE :
-- EST-CE UN SUPER ADMIN AFRI CLUB ?
-- ============================================================

create or replace function private.is_platform_super_admin(
  target_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where
      pa.user_id = target_user_id
      and pa.is_active = true
      and pa.role = 'super_admin'::public.platform_admin_role
  );
$$;

revoke all
on function private.is_platform_super_admin(uuid)
from public;

-- ============================================================
-- 8. RPC :
-- STATUT ADMINISTRATEUR DU COMPTE CONNECTE
-- ============================================================

drop function if exists
  public.get_my_platform_admin();

create function public.get_my_platform_admin()
returns table (
  role text,
  is_active boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    pa.role::text,
    pa.is_active

  from public.platform_admins pa

  where
    pa.user_id = auth.uid()
    and pa.is_active = true;
$$;

revoke all
on function public.get_my_platform_admin()
from public;

grant execute
on function public.get_my_platform_admin()
to authenticated;

-- ============================================================
-- 9. RPC :
-- STATISTIQUES GLOBALES DE LA PLATEFORME
-- ============================================================

drop function if exists
  public.get_platform_dashboard_stats();

create function public.get_platform_dashboard_stats()
returns table (
  total_organizations bigint,
  total_members bigint,
  active_members bigint,
  registered_users bigint,

  new_organizations_month bigint,
  new_members_month bigint,

  organizations_with_active_management bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_month_start date;
  next_month_start date;
begin

  -- ==========================================================
  -- UTILISATEUR CONNECTE
  -- ==========================================================

  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;

  -- ==========================================================
  -- SUPER ADMIN OBLIGATOIRE
  -- ==========================================================

  if not private.is_platform_super_admin(
    current_user_id
  ) then
    raise exception
      'Platform administrator access required'
      using errcode = '42501';
  end if;

  -- ==========================================================
  -- MOIS COURANT
  -- ==========================================================

  current_month_start :=
    date_trunc(
      'month',
      current_date
    )::date;

  next_month_start :=
    (
      current_month_start
      +
      interval '1 month'
    )::date;

  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return query

  select

    -- --------------------------------------------------------
    -- ORGANISATIONS
    -- --------------------------------------------------------

    (
      select
        count(*)::bigint

      from public.organizations o
    )
    as total_organizations,

    -- --------------------------------------------------------
    -- MEMBRES
    -- --------------------------------------------------------

    (
      select
        count(*)::bigint

      from public.members m
    )
    as total_members,

    -- --------------------------------------------------------
    -- MEMBRES ACTIFS
    -- --------------------------------------------------------

    (
      select
        count(*)::bigint

      from public.members m

      where
        m.status::text = 'active'
    )
    as active_members,

    -- --------------------------------------------------------
    -- UTILISATEURS
    --
    -- profiles correspond aux comptes créés dans Afri Club.
    -- --------------------------------------------------------

    (
      select
        count(*)::bigint

      from public.profiles p
    )
    as registered_users,

    -- --------------------------------------------------------
    -- NOUVELLES ORGANISATIONS CE MOIS
    -- --------------------------------------------------------

    (
      select
        count(*)::bigint

      from public.organizations o

      where
        o.created_at >=
          current_month_start

        and o.created_at <
          next_month_start
    )
    as new_organizations_month,

    -- --------------------------------------------------------
    -- NOUVEAUX MEMBRES CE MOIS
    -- --------------------------------------------------------

    (
      select
        count(*)::bigint

      from public.members m

      where
        m.created_at >=
          current_month_start

        and m.created_at <
          next_month_start
    )
    as new_members_month,

    -- --------------------------------------------------------
    -- ORGANISATIONS AYANT AU MOINS UN GESTIONNAIRE ACTIF
    -- --------------------------------------------------------

    (
      select
        count(
          distinct ou.organization_id
        )::bigint

      from public.organization_users ou

      where
        ou.is_active = true

        and ou.role::text in (
          'owner',
          'president',
          'treasurer',
          'secretary',
          'auditor'
        )
    )
    as organizations_with_active_management;

end;
$$;

revoke all
on function public.get_platform_dashboard_stats()
from public;

grant execute
on function public.get_platform_dashboard_stats()
to authenticated;

-- ============================================================
-- 10. RPC :
-- CROISSANCE DE LA PLATEFORME SUR 6 MOIS
-- ============================================================

drop function if exists
  public.get_platform_growth(integer);

create function public.get_platform_growth(
  months_count integer default 6
)
returns table (
  month_start date,
  new_organizations bigint,
  new_members bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  current_user_id uuid;
  safe_months_count integer;
begin

  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;

  if not private.is_platform_super_admin(
    current_user_id
  ) then
    raise exception
      'Platform administrator access required'
      using errcode = '42501';
  end if;

  -- ==========================================================
  -- ENTRE 1 ET 24 MOIS
  -- ==========================================================

  safe_months_count :=
    least(
      24,
      greatest(
        1,
        coalesce(
          months_count,
          6
        )
      )
    );

  return query

  with months as (
    select
      (
        date_trunc(
          'month',
          current_date
        )
        -
        make_interval(
          months =>
            safe_months_count - series_number
        )
      )::date
      as start_date

    from generate_series(
      1,
      safe_months_count
    )
    as series_number
  )

  select
    months.start_date
      as month_start,

    (
      select
        count(*)::bigint

      from public.organizations o

      where
        o.created_at >=
          months.start_date

        and o.created_at <
          (
            months.start_date
            +
            interval '1 month'
          )
    )
    as new_organizations,

    (
      select
        count(*)::bigint

      from public.members m

      where
        m.created_at >=
          months.start_date

        and m.created_at <
          (
            months.start_date
            +
            interval '1 month'
          )
    )
    as new_members

  from months

  order by
    months.start_date asc;

end;
$$;

revoke all
on function public.get_platform_growth(integer)
from public;

grant execute
on function public.get_platform_growth(integer)
to authenticated;

-- ============================================================
-- 11. RPC :
-- LISTE DES ORGANISATIONS DE LA PLATEFORME
-- ============================================================

drop function if exists
  public.list_platform_organizations(
    text,
    integer,
    integer
  );

create function public.list_platform_organizations(
  search_text text default null,
  limit_count integer default 50,
  offset_count integer default 0
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_short_name text,
  public_slug text,

  public_page_enabled boolean,
  online_membership_enabled boolean,

  created_at timestamptz,

  member_count bigint,
  active_member_count bigint,
  management_user_count bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  current_user_id uuid;
  safe_limit integer;
  safe_offset integer;
begin

  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;

  if not private.is_platform_super_admin(
    current_user_id
  ) then
    raise exception
      'Platform administrator access required'
      using errcode = '42501';
  end if;

  safe_limit :=
    least(
      100,
      greatest(
        1,
        coalesce(
          limit_count,
          50
        )
      )
    );

  safe_offset :=
    greatest(
      0,
      coalesce(
        offset_count,
        0
      )
    );

  return query

  select
    o.id
      as organization_id,

    o.name
      as organization_name,

    o.short_name
      as organization_short_name,

    o.public_slug,

    o.public_page_enabled,

    o.online_membership_enabled,

    o.created_at,

    (
      select
        count(*)::bigint

      from public.members m

      where
        m.organization_id =
          o.id
    )
    as member_count,

    (
      select
        count(*)::bigint

      from public.members m

      where
        m.organization_id =
          o.id

        and m.status::text =
          'active'
    )
    as active_member_count,

    (
      select
        count(*)::bigint

      from public.organization_users ou

      where
        ou.organization_id =
          o.id

        and ou.is_active =
          true

        and ou.role::text in (
          'owner',
          'president',
          'treasurer',
          'secretary',
          'auditor'
        )
    )
    as management_user_count

  from public.organizations o

  where
    search_text is null

    or trim(
      search_text
    ) = ''

    or o.name ilike
      (
        '%' ||
        trim(
          search_text
        ) ||
        '%'
      )

    or coalesce(
      o.short_name,
      ''
    ) ilike
      (
        '%' ||
        trim(
          search_text
        ) ||
        '%'
      )

  order by
    o.created_at desc

  limit
    safe_limit

  offset
    safe_offset;

end;
$$;

revoke all
on function public.list_platform_organizations(
  text,
  integer,
  integer
)
from public;

grant execute
on function public.list_platform_organizations(
  text,
  integer,
  integer
)
to authenticated;

-- ============================================================
-- 12. DOCUMENTATION
-- ============================================================

comment on table public.platform_admins
is
'Administrateurs de la plateforme Afri Club. Ces rôles sont indépendants des rôles internes aux organisations.';

comment on function public.get_my_platform_admin()
is
'Retourne le rôle administrateur Afri Club du compte connecté.';

comment on function public.get_platform_dashboard_stats()
is
'Retourne les principaux indicateurs globaux de la plateforme Afri Club. Accessible uniquement au super-administrateur.';

comment on function public.get_platform_growth(integer)
is
'Retourne la croissance mensuelle des organisations et membres Afri Club.';

comment on function public.list_platform_organizations(
  text,
  integer,
  integer
)
is
'Liste les organisations Afri Club avec leurs statistiques principales. Accessible uniquement au super-administrateur.';

commit;

-- ============================================================
-- 13. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst, 'reload schema';