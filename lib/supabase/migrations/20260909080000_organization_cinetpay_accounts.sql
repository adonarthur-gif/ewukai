-- ============================================================
-- AFRI CLUB
-- COMPTE CINETPAY PROPRE A CHAQUE ORGANISATION
--
-- IMPORTANT :
-- - SITE ID : stocké normalement
-- - API KEY : stockée uniquement chiffrée
-- - SECRET KEY : stockée uniquement chiffrée
-- - aucun secret accessible directement au navigateur
-- - aucune clé CinetPay d'Afri Club utilisée pour les cotisations
-- ============================================================


-- ============================================================
-- 1. TABLE
-- ============================================================

create table if not exists
public.organization_payment_provider_accounts (

  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete cascade,

  provider text
    not null
    default 'cinetpay',

  site_id text
    not null,

  api_key_encrypted text
    not null,

  secret_key_encrypted text
    not null,

  channels text
    not null
    default 'MOBILE_MONEY',

  is_active boolean
    not null
    default true,

  credential_version integer
    not null
    default 1,

  created_by uuid
    null
    references auth.users(id)
    on delete set null,

  updated_by uuid
    null
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
    organization_payment_provider_accounts_org_provider_unique
    unique (
      organization_id,
      provider
    ),

  constraint
    organization_payment_provider_accounts_provider_check
    check (
      provider in (
        'cinetpay'
      )
    ),

  constraint
    organization_payment_provider_accounts_site_id_not_blank
    check (
      nullif(
        btrim(site_id),
        ''
      ) is not null
    ),

  constraint
    organization_payment_provider_accounts_api_key_not_blank
    check (
      nullif(
        btrim(api_key_encrypted),
        ''
      ) is not null
    ),

  constraint
    organization_payment_provider_accounts_secret_key_not_blank
    check (
      nullif(
        btrim(secret_key_encrypted),
        ''
      ) is not null
    ),

  constraint
    organization_payment_provider_accounts_channels_check
    check (
      channels in (
        'ALL',
        'MOBILE_MONEY',
        'CREDIT_CARD',
        'WALLET'
      )
    )
);


-- ============================================================
-- 2. INDEX
-- ============================================================

create index if not exists
  organization_payment_provider_accounts_organization_idx
on public.organization_payment_provider_accounts (
  organization_id
);


create index if not exists
  organization_payment_provider_accounts_active_idx
on public.organization_payment_provider_accounts (
  provider,
  is_active
);


-- ============================================================
-- 3. RLS
--
-- Aucun utilisateur authentifié ne lit directement cette table.
-- Les secrets ne doivent jamais être envoyés au navigateur.
-- ============================================================

alter table
  public.organization_payment_provider_accounts
enable row level security;


revoke all
on table public.organization_payment_provider_accounts
from public;


revoke all
on table public.organization_payment_provider_accounts
from anon;


revoke all
on table public.organization_payment_provider_accounts
from authenticated;


-- Le serveur Afri Club pourra lire / écrire cette table.
grant
  select,
  insert,
  update,
  delete
on table public.organization_payment_provider_accounts
to service_role;


-- ============================================================
-- 4. RPC :
-- ETAT PUBLIC DE LA CONNEXION POUR LE BUREAU
--
-- ATTENTION :
-- aucune API KEY ni SECRET KEY ne sont retournées.
-- ============================================================

create or replace function
public.get_organization_cinetpay_status(
  target_organization_id uuid
)
returns jsonb

language plpgsql
stable
security definer

set search_path = ''

as $function$

declare

  provider_record record;

begin

  -- ==========================================================
  -- AUTHENTIFICATION / AUTORISATION
  -- ==========================================================

  if auth.uid()
     is null then

    raise exception
      'Authentication required';

  end if;


  if not private.has_organization_role(
    target_organization_id,

    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role,
      'auditor'::public.organization_role
    ]
  ) then

    raise exception
      'Not authorized';

  end if;


  -- ==========================================================
  -- CONFIGURATION
  -- ==========================================================

  select

    p.id,

    p.site_id,

    p.channels,

    p.is_active,

    p.created_at,

    p.updated_at

  into
    provider_record

  from
    public.organization_payment_provider_accounts
      as p

  where
    p.organization_id =
      target_organization_id

    and p.provider =
      'cinetpay'

  limit 1;


  -- ==========================================================
  -- PAS ENCORE CONFIGURE
  -- ==========================================================

  if not found then

    return
      jsonb_build_object(

        'configured',
          false,

        'provider',
          'cinetpay',

        'active',
          false,

        'site_id',
          null,

        'channels',
          null,

        'updated_at',
          null

      );

  end if;


  -- ==========================================================
  -- CONFIGURE
  -- ==========================================================

  return
    jsonb_build_object(

      'configured',
        true,

      'provider',
        'cinetpay',

      'active',
        provider_record.is_active,

      'site_id',
        provider_record.site_id,

      'channels',
        provider_record.channels,

      'updated_at',
        provider_record.updated_at

    );

end;

$function$;


-- ============================================================
-- 5. PERMISSIONS RPC
-- ============================================================

revoke all
on function public.get_organization_cinetpay_status(
  uuid
)
from public;


revoke all
on function public.get_organization_cinetpay_status(
  uuid
)
from anon;


grant execute
on function public.get_organization_cinetpay_status(
  uuid
)
to authenticated;


-- ============================================================
-- 6. SCHEMA CACHE
-- ============================================================

notify pgrst, 'reload schema';