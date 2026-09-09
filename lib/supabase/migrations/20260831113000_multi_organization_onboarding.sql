-- ============================================================
-- AFRI CLUB
-- ONBOARDING MULTI-ORGANISATIONS
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
-- ORGANISATIONS EXISTANTES
-- ============================================================

update public.organizations
set organization_type = 'mutual'
where organization_type is null;

update public.organizations
set country_code = 'CI'
where country_code is null;


alter table public.organizations
  alter column organization_type
  set default 'mutual';

alter table public.organizations
  alter column organization_type
  set not null;


-- ============================================================
-- CONTRAINTE TYPE
-- ============================================================

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'organizations_organization_type_check'
  ) then

    alter table public.organizations
      add constraint
        organizations_organization_type_check
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


-- ============================================================
-- NOUVELLE VERSION DU RPC
--
-- On conserve le RPC actuel et on ajoute une surcharge
-- multi-organisations. Le RPC historique continue donc de
-- fonctionner.
-- ============================================================

create or replace function public.create_organization_with_profile(
  target_name text,
  target_short_name text,
  target_slogan text,
  target_objectives text,
  target_mission text,
  target_vision text,
  target_location_label text,
  target_organization_type text,
  target_legal_name text,
  target_registration_number text,
  target_country_code text,
  target_city text,
  target_phone text,
  target_email text,
  target_website text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$

declare
  created_organization_id uuid;

begin

  -- ----------------------------------------------------------
  -- VALIDATION DU TYPE
  -- ----------------------------------------------------------

  if target_organization_type not in (
    'mutual',
    'association',
    'ngo',
    'cooperative',
    'tontine',
    'club',
    'foundation',
    'community',
    'other'
  ) then

    raise exception
      'Invalid organization type';

  end if;


  -- ----------------------------------------------------------
  -- APPEL DU RPC EXISTANT
  -- ----------------------------------------------------------

  created_organization_id :=
    public.create_organization_with_profile(
      target_name =>
        target_name,

      target_short_name =>
        target_short_name,

      target_slogan =>
        target_slogan,

      target_objectives =>
        target_objectives,

      target_mission =>
        target_mission,

      target_vision =>
        target_vision,

      target_location_label =>
        target_location_label
    );


  if created_organization_id is null then

    raise exception
      'Organization creation failed';

  end if;


  -- ----------------------------------------------------------
  -- INFORMATIONS MULTI-ORGANISATIONS
  -- ----------------------------------------------------------

  update public.organizations
  set
    organization_type =
      target_organization_type,

    legal_name =
      nullif(
        btrim(target_legal_name),
        ''
      ),

    registration_number =
      nullif(
        btrim(target_registration_number),
        ''
      ),

    country_code =
      coalesce(
        nullif(
          upper(
            btrim(target_country_code)
          ),
          ''
        ),
        'CI'
      ),

    city =
      nullif(
        btrim(target_city),
        ''
      ),

    phone =
      nullif(
        btrim(target_phone),
        ''
      ),

    email =
      nullif(
        lower(
          btrim(target_email)
        ),
        ''
      ),

    website =
      nullif(
        btrim(target_website),
        ''
      ),

    updated_at =
      now()

  where id =
    created_organization_id;


  return
    created_organization_id;

end;
$function$;


grant execute
on function public.create_organization_with_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;