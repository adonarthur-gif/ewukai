-- ============================================================
-- AFRI CLUB
-- MIGRATION 043
-- TENTATIVES DE PAIEMENT DES ABONNEMENTS SAAS
--
-- Objectif :
-- - préparer l'intégration d'un prestataire externe (V1 : CinetPay)
-- - conserver une référence de transaction avant la redirection
-- - ne jamais laisser le navigateur décider du montant
-- - garder les paiements SaaS séparés des cotisations des membres
-- ============================================================


-- ============================================================
-- 1. TABLE DES TENTATIVES DE PAIEMENT
-- ============================================================

create table if not exists public.subscription_payment_attempts (

  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete cascade,

  subscription_id uuid
    not null
    references public.organization_subscriptions(id)
    on delete cascade,

  invoice_id uuid
    not null
    references public.subscription_invoices(id)
    on delete cascade,

  provider text
    not null,

  provider_transaction_ref text
    not null,

  provider_payment_token text
    null,

  provider_payment_url text
    null,

  expected_amount_xof bigint
    not null
    check (
      expected_amount_xof > 0
    ),

  currency text
    not null
    default 'XOF'
    check (
      currency ~ '^[A-Z]{3}$'
    ),

  status text
    not null
    default 'created'
    check (
      status in (
        'created',
        'checkout_ready',
        'pending',
        'confirmed',
        'failed',
        'cancelled',
        'expired',
        'anomaly'
      )
    ),

  provider_status text
    null,

  provider_payment_method text
    null,

  provider_operator_id text
    null,

  last_verified_at timestamptz
    null,

  confirmed_at timestamptz
    null,

  failed_at timestamptz
    null,

  created_by uuid
    null
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint subscription_payment_attempts_provider_ref_unique
    unique (
      provider,
      provider_transaction_ref
    ),

  constraint subscription_payment_attempts_provider_not_blank
    check (
      nullif(
        btrim(provider),
        ''
      ) is not null
    ),

  constraint subscription_payment_attempts_provider_ref_not_blank
    check (
      nullif(
        btrim(provider_transaction_ref),
        ''
      ) is not null
    )

);


-- ============================================================
-- 2. INDEX
-- ============================================================

create index if not exists
  subscription_payment_attempts_invoice_idx
on public.subscription_payment_attempts (
  invoice_id,
  created_at desc
);


create index if not exists
  subscription_payment_attempts_organization_idx
on public.subscription_payment_attempts (
  organization_id,
  created_at desc
);


create index if not exists
  subscription_payment_attempts_subscription_idx
on public.subscription_payment_attempts (
  subscription_id,
  created_at desc
);


create index if not exists
  subscription_payment_attempts_status_idx
on public.subscription_payment_attempts (
  status,
  created_at desc
);


-- Une seule tentative encore exploitable par facture et prestataire.
create unique index if not exists
  subscription_payment_attempts_one_open_attempt_idx
on public.subscription_payment_attempts (
  invoice_id,
  provider
)
where status in (
  'created',
  'checkout_ready',
  'pending'
);


-- ============================================================
-- 3. RLS
--
-- Aucun accès direct depuis le navigateur.
-- La préparation se fait uniquement via une RPC contrôlée.
-- Les mises à jour prestataire se feront plus tard via le serveur
-- avec la service role.
-- ============================================================

alter table
  public.subscription_payment_attempts
enable row level security;


revoke all
on table public.subscription_payment_attempts
from public;


revoke all
on table public.subscription_payment_attempts
from anon;


revoke all
on table public.subscription_payment_attempts
from authenticated;


-- ============================================================
-- 4. PREPARER UNE TENTATIVE DE PAIEMENT
--
-- Cette fonction :
-- - utilise auth.uid()
-- - vérifie que la facture appartient à l'organisation du user
-- - limite l'action à owner / president / treasurer
-- - exige une facture ouverte non payée
-- - exige un abonnement pending_payment
-- - exige Standard ou Pro
-- - prend le montant directement depuis la facture
-- - génère une référence prestataire côté serveur
--
-- Elle ne contacte PAS encore CinetPay.
-- ============================================================

create or replace function public.prepare_organization_subscription_payment(
  target_invoice_id uuid,
  target_provider text default 'cinetpay'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  normalized_provider text;

  invoice_record record;

  existing_attempt record;

  new_attempt_id uuid;

  new_transaction_ref text;

begin

  -- ==========================================================
  -- UTILISATEUR
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  if target_invoice_id is null then

    raise exception
      'Invoice is required';

  end if;


  normalized_provider :=
    lower(
      btrim(
        coalesce(
          target_provider,
          ''
        )
      )
    );


  -- V1 : un seul prestataire.
  if normalized_provider <> 'cinetpay' then

    raise exception
      'Unsupported payment provider';

  end if;


  -- ==========================================================
  -- FACTURE + ABONNEMENT + PLAN
  -- ==========================================================

  select

    si.id
      as invoice_id,

    si.subscription_id,

    si.status::text
      as invoice_status,

    si.currency,

    si.total_xof,

    si.amount_paid_xof,

    os.organization_id,

    os.status::text
      as subscription_status,

    sp.code
      as plan_code,

    sp.name
      as plan_name

  into
    invoice_record

  from
    public.subscription_invoices as si

  join
    public.organization_subscriptions as os
      on os.id =
         si.subscription_id

  join
    public.subscription_plans as sp
      on sp.id =
         os.plan_id

  where
    si.id =
      target_invoice_id

  for update
    of si, os;


  if not found then

    raise exception
      'Invoice not found';

  end if;


  -- ==========================================================
  -- DROITS ORGANISATION
  -- ==========================================================

  if not exists (

    select
      1

    from
      public.organization_users as ou

    where
      ou.organization_id =
        invoice_record.organization_id

      and ou.user_id =
        current_user_id

      and ou.is_active =
        true

      and ou.role::text
        in (
          'owner',
          'president',
          'treasurer'
        )

  ) then

    raise exception
      'Not authorized';

  end if;


  -- ==========================================================
  -- CONTROLES METIER
  -- ==========================================================

  if invoice_record.invoice_status <> 'open' then

    raise exception
      'Invoice is not open';

  end if;


  if coalesce(
    invoice_record.amount_paid_xof,
    0
  ) <> 0 then

    raise exception
      'Invoice already contains a payment';

  end if;


  if invoice_record.total_xof is null
     or invoice_record.total_xof <= 0 then

    raise exception
      'Invalid invoice amount';

  end if;


  if upper(
    coalesce(
      invoice_record.currency,
      ''
    )
  ) <> 'XOF' then

    raise exception
      'Unsupported invoice currency';

  end if;


  if invoice_record.subscription_status
     <> 'pending_payment' then

    raise exception
      'Subscription is not awaiting payment';

  end if;


  if invoice_record.plan_code
     not in (
       'standard',
       'pro'
     ) then

    raise exception
      'Plan is not payable online';

  end if;


  -- ==========================================================
  -- REUTILISER UNE TENTATIVE OUVERTE
  -- ==========================================================

  select
    spa.*

  into
    existing_attempt

  from
    public.subscription_payment_attempts as spa

  where
    spa.invoice_id =
      invoice_record.invoice_id

    and spa.provider =
      normalized_provider

    and spa.status
      in (
        'created',
        'checkout_ready',
        'pending'
      )

  order by
    spa.created_at desc

  limit 1

  for update;


  if found then

    return
      jsonb_build_object(

        'attempt_id',
        existing_attempt.id,

        'organization_id',
        invoice_record.organization_id,

        'subscription_id',
        invoice_record.subscription_id,

        'invoice_id',
        invoice_record.invoice_id,

        'plan_code',
        invoice_record.plan_code,

        'plan_name',
        invoice_record.plan_name,

        'amount_xof',
        invoice_record.total_xof,

        'currency',
        upper(
          invoice_record.currency
        ),

        'provider',
        existing_attempt.provider,

        'provider_transaction_ref',
        existing_attempt.provider_transaction_ref,

        'provider_payment_token',
        existing_attempt.provider_payment_token,

        'provider_payment_url',
        existing_attempt.provider_payment_url,

        'attempt_status',
        existing_attempt.status

      );

  end if;


  -- ==========================================================
  -- REFERENCE CINETPAY
  --
  -- Pas de caractères spéciaux.
  -- Exemple :
  -- AFC20260904143530123A1B2C3D4
  -- ==========================================================

  new_transaction_ref :=
    'AFC'
    ||
    to_char(
      clock_timestamp(),
      'YYYYMMDDHH24MISSMS'
    )
    ||
    upper(
      substr(
        replace(
          gen_random_uuid()::text,
          '-',
          ''
        ),
        1,
        8
      )
    );


  -- ==========================================================
  -- CREATION
  -- ==========================================================

  insert into
    public.subscription_payment_attempts (

      organization_id,

      subscription_id,

      invoice_id,

      provider,

      provider_transaction_ref,

      expected_amount_xof,

      currency,

      status,

      created_by

    )

  values (

    invoice_record.organization_id,

    invoice_record.subscription_id,

    invoice_record.invoice_id,

    normalized_provider,

    new_transaction_ref,

    invoice_record.total_xof,

    upper(
      invoice_record.currency
    ),

    'created',

    current_user_id

  )

  returning
    id

  into
    new_attempt_id;


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return
    jsonb_build_object(

      'attempt_id',
      new_attempt_id,

      'organization_id',
      invoice_record.organization_id,

      'subscription_id',
      invoice_record.subscription_id,

      'invoice_id',
      invoice_record.invoice_id,

      'plan_code',
      invoice_record.plan_code,

      'plan_name',
      invoice_record.plan_name,

      'amount_xof',
      invoice_record.total_xof,

      'currency',
      upper(
        invoice_record.currency
      ),

      'provider',
      normalized_provider,

      'provider_transaction_ref',
      new_transaction_ref,

      'provider_payment_token',
      null,

      'provider_payment_url',
      null,

      'attempt_status',
      'created'

    );

end;

$function$;


-- ============================================================
-- 5. PERMISSIONS RPC
-- ============================================================

revoke all
on function public.prepare_organization_subscription_payment(
  uuid,
  text
)
from public;


revoke all
on function public.prepare_organization_subscription_payment(
  uuid,
  text
)
from anon;


revoke all
on function public.prepare_organization_subscription_payment(
  uuid,
  text
)
from authenticated;


grant execute
on function public.prepare_organization_subscription_payment(
  uuid,
  text
)
to authenticated;


-- ============================================================
-- 6. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst, 'reload schema';
