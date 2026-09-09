-- ============================================================
-- AFRI CLUB
-- TYPES D'ORGANISATIONS
-- ============================================================

alter table public.organizations
  add column if not exists organization_type text;

alter table public.organizations
  add column if not exists legal_name text;

alter table public.organizations
  add column if not exists registration_number text;

alter table public.organizations
  add column if not exists country_code text;

alter table public.organizations
  add column if not exists city text;

alter table public.organizations
  add column if not exists phone text;

alter table public.organizations
  add column if not exists email text;

alter table public.organizations
  add column if not exists website text;

-- ============================================================
-- VALEURS PAR DEFAUT POUR LES ORGANISATIONS EXISTANTES
-- ============================================================

update public.organizations
set organization_type = 'mutual'
where organization_type is null;

update public.organizations
set country_code = 'CI'
where country_code is null;

-- ============================================================
-- CONTRAINTES
-- ============================================================

alter table public.organizations
  alter column organization_type
  set default 'mutual';

alter table public.organizations
  alter column organization_type
  set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_organization_type_check'
  ) then
    alter table public.organizations
      add constraint organizations_organization_type_check
      check (
        organization_type in (
          'mutual',
          'association',
          'ngo',
          'cooperative',
          'tontine',
          'club',
          'foundation',
          'community',
          'other'
        )
      );
  end if;
end
$$;

-- ============================================================
-- INDEX
-- ============================================================

create index if not exists
  organizations_organization_type_idx
on public.organizations (
  organization_type
);