-- ============================================================
-- AFRI CLUB
-- MIGRATION 035
-- PARAMETRES GLOBAUX DE LA PLATEFORME
-- ============================================================

create table if not exists public.platform_settings (

  id smallint primary key
    default 1
    check (id = 1),

  platform_name text not null
    default 'Afri Club',

  support_email text,

  support_phone text,

  default_country_code text not null
    default 'CI',

  default_currency text not null
    default 'XOF',

  default_locale text not null
    default 'fr-CI',

  default_timezone text not null
    default 'Africa/Abidjan',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  updated_by uuid
    references auth.users(id)
    on delete set null
);


-- ============================================================
-- LIGNE UNIQUE
-- ============================================================

insert into public.platform_settings (
  id,
  platform_name,
  default_country_code,
  default_currency,
  default_locale,
  default_timezone
)
values (
  1,
  'Afri Club',
  'CI',
  'XOF',
  'fr-CI',
  'Africa/Abidjan'
)
on conflict (id)
do nothing;


-- ============================================================
-- RLS
-- ============================================================

alter table public.platform_settings
enable row level security;


revoke all
on public.platform_settings
from public;


revoke all
on public.platform_settings
from anon;


revoke all
on public.platform_settings
from authenticated;


-- ============================================================
-- LECTURE SUPER ADMIN
-- ============================================================

drop function if exists
  public.get_platform_settings();


create or replace function public.get_platform_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  result jsonb;

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


  select
    jsonb_build_object(

      'platform_name',
        ps.platform_name,

      'support_email',
        ps.support_email,

      'support_phone',
        ps.support_phone,

      'default_country_code',
        ps.default_country_code,

      'default_currency',
        ps.default_currency,

      'default_locale',
        ps.default_locale,

      'default_timezone',
        ps.default_timezone,

      'created_at',
        ps.created_at,

      'updated_at',
        ps.updated_at

    )

  into result

  from public.platform_settings as ps

  where ps.id = 1;


  return result;

end;

$function$;


-- ============================================================
-- MODIFICATION SUPER ADMIN
-- ============================================================

drop function if exists
  public.update_platform_settings(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  );


create or replace function public.update_platform_settings(

  new_platform_name text,

  new_support_email text,

  new_support_phone text,

  new_default_country_code text,

  new_default_currency text,

  new_default_locale text,

  new_default_timezone text

)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  clean_platform_name text;

  clean_support_email text;

  clean_support_phone text;

  clean_country_code text;

  clean_currency text;

  clean_locale text;

  clean_timezone text;

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


  -- ==========================================================
  -- NETTOYAGE
  -- ==========================================================

  clean_platform_name :=
    btrim(
      coalesce(
        new_platform_name,
        ''
      )
    );


  clean_support_email :=
    nullif(
      lower(
        btrim(
          coalesce(
            new_support_email,
            ''
          )
        )
      ),
      ''
    );


  clean_support_phone :=
    nullif(
      btrim(
        coalesce(
          new_support_phone,
          ''
        )
      ),
      ''
    );


  clean_country_code :=
    upper(
      btrim(
        coalesce(
          new_default_country_code,
          ''
        )
      )
    );


  clean_currency :=
    upper(
      btrim(
        coalesce(
          new_default_currency,
          ''
        )
      )
    );


  clean_locale :=
    btrim(
      coalesce(
        new_default_locale,
        ''
      )
    );


  clean_timezone :=
    btrim(
      coalesce(
        new_default_timezone,
        ''
      )
    );


  -- ==========================================================
  -- VALIDATIONS
  -- ==========================================================

  if char_length(clean_platform_name) < 2
     or char_length(clean_platform_name) > 80 then

    raise exception
      'Invalid platform name';

  end if;


  if clean_support_email is not null
     and clean_support_email !~*
       '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then

    raise exception
      'Invalid support email';

  end if;


  if clean_country_code !~ '^[A-Z]{2}$' then

    raise exception
      'Invalid country code';

  end if;


  if clean_currency !~ '^[A-Z]{3}$' then

    raise exception
      'Invalid currency';

  end if;


  if clean_locale = ''
     or char_length(clean_locale) > 20 then

    raise exception
      'Invalid locale';

  end if;


  if clean_timezone = ''
     or char_length(clean_timezone) > 100 then

    raise exception
      'Invalid timezone';

  end if;


  -- ==========================================================
  -- MISE A JOUR
  -- ==========================================================

  update public.platform_settings

  set

    platform_name =
      clean_platform_name,

    support_email =
      clean_support_email,

    support_phone =
      clean_support_phone,

    default_country_code =
      clean_country_code,

    default_currency =
      clean_currency,

    default_locale =
      clean_locale,

    default_timezone =
      clean_timezone,

    updated_at =
      now(),

    updated_by =
      current_user_id

  where id = 1;


  return
    public.get_platform_settings();

end;

$function$;


-- ============================================================
-- DROITS RPC
-- ============================================================

revoke all
on function public.get_platform_settings()
from public, anon, authenticated;


grant execute
on function public.get_platform_settings()
to authenticated;


revoke all
on function public.update_platform_settings(
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;


grant execute
on function public.update_platform_settings(
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;


comment on table public.platform_settings
is
'Configuration globale non sensible de la plateforme Afri Club.';


notify pgrst,
  'reload schema';