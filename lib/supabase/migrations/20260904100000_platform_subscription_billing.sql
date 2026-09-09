-- ============================================================
-- AFRI CLUB
-- MIGRATION 039
-- FACTURATION DES ABONNEMENTS DE LA PLATEFORME
--
-- Objectifs :
--
-- 1. Créer les factures commerciales Afri Club
-- 2. Séparer ces factures des cotisations des mutuelles
-- 3. Conserver le plan et le tarif facturés
-- 4. Préparer les paiements manuels
-- 5. Préparer Wave / Orange Money / MTN / Moov / banque
-- 6. Suivre les factures ouvertes, payées et en retard
--
-- Plans actuels :
--
-- Gratuit
--   0 FCFA / mois
--   aucune facture
--
-- Standard
--   5 000 FCFA / mois
--
-- Pro
--   10 000 FCFA / mois
--
-- Entreprise
--   sur devis
--   aucune facturation automatique
--
-- ============================================================


-- ============================================================
-- 0. EXTENSION UUID
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- 1. SEQUENCE DES NUMEROS DE FACTURE
--
-- Exemple :
-- AFC-2026-000001
-- AFC-2026-000002
-- ============================================================

create sequence if not exists
  public.subscription_invoice_number_seq

start with 1
increment by 1
minvalue 1;


-- ============================================================
-- 2. TABLE DES FACTURES D'ABONNEMENT
-- ============================================================

create table if not exists
  public.subscription_invoices
(

  id uuid primary key
    default gen_random_uuid(),


  -- ==========================================================
  -- NUMERO DE FACTURE
  -- ==========================================================

  invoice_number text not null
    unique,


  -- ==========================================================
  -- ORGANISATION
  -- ==========================================================

  organization_id uuid not null
    references public.organizations(id)
    on delete restrict,


  -- ==========================================================
  -- ABONNEMENT
  -- ==========================================================

  subscription_id uuid not null
    references public.organization_subscriptions(id)
    on delete restrict,


  plan_id uuid
    references public.subscription_plans(id)
    on delete set null,


  -- ==========================================================
  -- SNAPSHOT DU PLAN
  --
  -- On conserve ces valeurs même si le plan est modifié
  -- plus tard dans subscription_plans.
  -- ==========================================================

  plan_code text not null,

  plan_name text not null,


  -- ==========================================================
  -- CYCLE
  -- ==========================================================

  billing_cycle text not null
    check (
      billing_cycle in (
        'monthly',
        'yearly',
        'custom'
      )
    ),


  -- ==========================================================
  -- PERIODE FACTUREE
  -- ==========================================================

  period_start timestamptz not null,

  period_end timestamptz not null,

  check (
    period_end >
    period_start
  ),


  -- ==========================================================
  -- DEVISE
  -- ==========================================================

  currency text not null
    default 'XOF',


  -- ==========================================================
  -- MONTANTS
  -- ==========================================================

  subtotal_xof bigint not null
    check (
      subtotal_xof >= 0
    ),


  discount_xof bigint not null
    default 0
    check (
      discount_xof >= 0
    ),


  tax_xof bigint not null
    default 0
    check (
      tax_xof >= 0
    ),


  total_xof bigint not null
    check (
      total_xof >= 0
    ),


  amount_paid_xof bigint not null
    default 0
    check (
      amount_paid_xof >= 0
    ),


  -- ==========================================================
  -- STATUT STOCKE
  --
  -- "overdue" n'est pas stocké.
  -- Il sera calculé lorsque :
  --
  -- status = open
  -- ET due_at < maintenant
  -- ==========================================================

  status text not null
    default 'open'
    check (
      status in (
        'draft',
        'open',
        'paid',
        'cancelled'
      )
    ),


  -- ==========================================================
  -- DATES
  -- ==========================================================

  issued_at timestamptz not null
    default now(),


  due_at timestamptz not null,


  paid_at timestamptz,


  cancelled_at timestamptz,


  -- ==========================================================
  -- INFORMATIONS COMPLEMENTAIRES
  -- ==========================================================

  description text,

  notes text,


  -- ==========================================================
  -- AUDIT
  -- ==========================================================

  created_by uuid
    references auth.users(id)
    on delete set null,


  created_at timestamptz not null
    default now(),


  updated_at timestamptz not null
    default now()
);


-- ============================================================
-- 3. UNE FACTURE PAR PERIODE D'ABONNEMENT
-- ============================================================

create unique index if not exists
  subscription_invoices_subscription_period_idx

on public.subscription_invoices (
  subscription_id,
  period_start
);


-- ============================================================
-- 4. INDEX FACTURES
-- ============================================================

create index if not exists
  subscription_invoices_organization_idx

on public.subscription_invoices (
  organization_id
);


create index if not exists
  subscription_invoices_subscription_idx

on public.subscription_invoices (
  subscription_id
);


create index if not exists
  subscription_invoices_plan_idx

on public.subscription_invoices (
  plan_id
);


create index if not exists
  subscription_invoices_status_idx

on public.subscription_invoices (
  status
);


create index if not exists
  subscription_invoices_due_at_idx

on public.subscription_invoices (
  due_at
);


create index if not exists
  subscription_invoices_created_at_idx

on public.subscription_invoices (
  created_at desc
);


-- ============================================================
-- 5. TABLE DES PAIEMENTS DES FACTURES
--
-- IMPORTANT :
--
-- Cette table contient uniquement les paiements reçus
-- par AFRI CLUB pour ses abonnements.
--
-- Elle est totalement distincte de :
--
-- public.payments
-- treasury
-- cotisations
-- encaissements des mutuelles
-- ============================================================

create table if not exists
  public.subscription_invoice_payments
(

  id uuid primary key
    default gen_random_uuid(),


  -- ==========================================================
  -- FACTURE
  -- ==========================================================

  invoice_id uuid not null
    references public.subscription_invoices(id)
    on delete restrict,


  organization_id uuid not null
    references public.organizations(id)
    on delete restrict,


  -- ==========================================================
  -- MONTANT
  -- ==========================================================

  amount_xof bigint not null
    check (
      amount_xof > 0
    ),


  currency text not null
    default 'XOF',


  -- ==========================================================
  -- MODE DE PAIEMENT
  -- ==========================================================

  payment_method text not null
    check (
      payment_method in (
        'manual',
        'wave',
        'orange_money',
        'mtn_momo',
        'moov_money',
        'bank_transfer',
        'cash',
        'other'
      )
    ),


  -- ==========================================================
  -- PRESTATAIRE
  -- ==========================================================

  provider text,


  provider_transaction_ref text,


  -- ==========================================================
  -- STATUT
  -- ==========================================================

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'failed',
        'cancelled',
        'refunded'
      )
    ),


  -- ==========================================================
  -- DATES
  -- ==========================================================

  paid_at timestamptz,


  confirmed_at timestamptz,


  failed_at timestamptz,


  -- ==========================================================
  -- INFORMATIONS
  -- ==========================================================

  notes text,


  -- ==========================================================
  -- AUDIT
  -- ==========================================================

  created_by uuid
    references auth.users(id)
    on delete set null,


  created_at timestamptz not null
    default now(),


  updated_at timestamptz not null
    default now()
);


-- ============================================================
-- 6. INDEX DES PAIEMENTS
-- ============================================================

create index if not exists
  subscription_invoice_payments_invoice_idx

on public.subscription_invoice_payments (
  invoice_id
);


create index if not exists
  subscription_invoice_payments_organization_idx

on public.subscription_invoice_payments (
  organization_id
);


create index if not exists
  subscription_invoice_payments_status_idx

on public.subscription_invoice_payments (
  status
);


create index if not exists
  subscription_invoice_payments_created_at_idx

on public.subscription_invoice_payments (
  created_at desc
);


-- ============================================================
-- 7. REFERENCE PRESTATAIRE UNIQUE
--
-- Exemple :
--
-- provider = wave
-- provider_transaction_ref = transaction Wave
-- ============================================================

create unique index if not exists
  subscription_invoice_payments_provider_ref_idx

on public.subscription_invoice_payments (
  provider,
  provider_transaction_ref
)

where
  provider_transaction_ref is not null;


-- ============================================================
-- 8. NUMERO AUTOMATIQUE DE FACTURE
-- ============================================================

create or replace function
  private.generate_subscription_invoice_number()
returns text
language plpgsql
security definer
set search_path = ''
as $function$

declare

  sequence_value bigint;

begin

  sequence_value :=
    nextval(
      'public.subscription_invoice_number_seq'::regclass
    );


  return

    'AFC-' ||

    to_char(
      now(),
      'YYYY'
    )

    || '-' ||

    lpad(
      sequence_value::text,
      6,
      '0'
    );

end;

$function$;


-- ============================================================
-- 9. CREER UNE FACTURE POUR UN ABONNEMENT
--
-- Fonction interne.
--
-- Ne facture pas :
--
-- - Gratuit
-- - Entreprise / custom pricing
-- - abonnement non actif
-- ============================================================

create or replace function
  private.create_subscription_invoice(
    target_subscription_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$

declare

  subscription_row record;

  existing_invoice_id uuid;

  new_invoice_id uuid;

  invoice_amount bigint;

  invoice_period_start timestamptz;

  invoice_period_end timestamptz;

  invoice_due_at timestamptz;

begin

  -- ==========================================================
  -- VALIDATION
  -- ==========================================================

  if target_subscription_id is null then

    raise exception
      'Subscription id is required';

  end if;


  -- ==========================================================
  -- ABONNEMENT + PLAN
  -- ==========================================================

  select

    os.id
      as subscription_id,

    os.organization_id,

    os.plan_id,

    os.status,

    os.billing_cycle,

    os.starts_at,

    os.current_period_start,

    os.current_period_end,

    sp.code
      as plan_code,

    sp.name
      as plan_name,

    sp.monthly_price_xof,

    sp.yearly_price_xof,

    sp.is_custom_pricing

  into
    subscription_row

  from public.organization_subscriptions as os

  join public.subscription_plans as sp

    on sp.id =
      os.plan_id

  where

    os.id =
      target_subscription_id

  limit 1;


  -- ==========================================================
  -- ABONNEMENT INTROUVABLE
  -- ==========================================================

  if subscription_row.subscription_id is null then

    raise exception
      'Subscription not found';

  end if;


  -- ==========================================================
  -- PLAN GRATUIT
  -- ==========================================================

  if subscription_row.plan_code =
    'free' then

    return null;

  end if;


  -- ==========================================================
  -- ENTREPRISE / SUR DEVIS
  -- ==========================================================

  if coalesce(
    subscription_row.is_custom_pricing,
    false
  ) = true then

    return null;

  end if;


  -- ==========================================================
  -- ABONNEMENT NON ACTIF
  -- ==========================================================

  if subscription_row.status <>
    'active' then

    return null;

  end if;


  -- ==========================================================
  -- MONTANT A FACTURER
  -- ==========================================================

  invoice_amount :=

    case

      when subscription_row.billing_cycle =
        'monthly'

        then
          coalesce(
            subscription_row.monthly_price_xof,
            0
          )


      when subscription_row.billing_cycle =
        'yearly'

        then
          coalesce(
            subscription_row.yearly_price_xof,
            0
          )


      else
        0

    end;


  -- ==========================================================
  -- PAS DE MONTANT = PAS DE FACTURE
  -- ==========================================================

  if invoice_amount <= 0 then

    return null;

  end if;


  -- ==========================================================
  -- DEBUT DE PERIODE
  -- ==========================================================

  invoice_period_start :=

    coalesce(

      subscription_row.current_period_start,

      subscription_row.starts_at,

      now()

    );


  -- ==========================================================
  -- FIN DE PERIODE
  -- ==========================================================

  invoice_period_end :=

    coalesce(

      subscription_row.current_period_end,

      case

        when subscription_row.billing_cycle =
          'yearly'

          then
            invoice_period_start +
            interval '1 year'


        else
            invoice_period_start +
            interval '1 month'

      end

    );


  -- ==========================================================
  -- ECHEANCE
  --
  -- Pour cette V1 :
  -- l'échéance correspond à la fin de la période.
  -- ==========================================================

  invoice_due_at :=
    invoice_period_end;


  -- ==========================================================
  -- ANTI-DOUBLON
  -- ==========================================================

  select
    si.id

  into
    existing_invoice_id

  from public.subscription_invoices as si

  where

    si.subscription_id =
      subscription_row.subscription_id

    and si.period_start =
      invoice_period_start

  limit 1;


  if existing_invoice_id is not null then

    return
      existing_invoice_id;

  end if;


  -- ==========================================================
  -- CREATION DE LA FACTURE
  -- ==========================================================

  insert into public.subscription_invoices
  (

    invoice_number,

    organization_id,

    subscription_id,

    plan_id,

    plan_code,

    plan_name,

    billing_cycle,

    period_start,

    period_end,

    currency,

    subtotal_xof,

    discount_xof,

    tax_xof,

    total_xof,

    amount_paid_xof,

    status,

    issued_at,

    due_at,

    description,

    created_by

  )
  values
  (

    private.generate_subscription_invoice_number(),

    subscription_row.organization_id,

    subscription_row.subscription_id,

    subscription_row.plan_id,

    subscription_row.plan_code,

    subscription_row.plan_name,

    subscription_row.billing_cycle,

    invoice_period_start,

    invoice_period_end,

    'XOF',

    invoice_amount,

    0,

    0,

    invoice_amount,

    0,

    'open',

    now(),

    invoice_due_at,

    'Abonnement Afri Club - ' ||
      subscription_row.plan_name,

    auth.uid()

  )

  returning
    id

  into
    new_invoice_id;


  return
    new_invoice_id;

end;

$function$;


-- ============================================================
-- 10. TRIGGER :
-- CREER UNE FACTURE APRES CREATION D'UN ABONNEMENT
-- ============================================================

create or replace function
  private.create_invoice_after_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$

begin

  perform
    private.create_subscription_invoice(
      new.id
    );


  return
    new;

end;

$function$;


drop trigger if exists
  trg_create_invoice_after_subscription

on public.organization_subscriptions;


create trigger
  trg_create_invoice_after_subscription

after insert

on public.organization_subscriptions

for each row

execute function
  private.create_invoice_after_subscription();


-- ============================================================
-- 11. BACKFILL
--
-- Création automatique d'une facture pour les abonnements
-- Standard / Pro déjà actifs avant la migration.
--
-- La fonction est idempotente :
-- elle ne recrée pas une facture déjà existante.
-- ============================================================

do $block$

declare

  subscription_item record;

begin

  for subscription_item in

    select
      os.id

    from public.organization_subscriptions as os

    join public.subscription_plans as sp

      on sp.id =
        os.plan_id

    where

      os.status =
        'active'

      and os.billing_cycle in (
        'monthly',
        'yearly'
      )

      and sp.code in (
        'standard',
        'pro'
      )

      and coalesce(
        sp.is_custom_pricing,
        false
      ) =
        false

  loop

    perform
      private.create_subscription_invoice(
        subscription_item.id
      );

  end loop;

end;

$block$;


-- ============================================================
-- 12. RLS
-- ============================================================

alter table public.subscription_invoices
enable row level security;


alter table public.subscription_invoice_payments
enable row level security;


-- ============================================================
-- 13. BLOQUER L'ACCES DIRECT AUX TABLES
--
-- Les opérations passeront par des RPC sécurisées.
-- ============================================================

revoke all
on public.subscription_invoices
from public;


revoke all
on public.subscription_invoices
from anon;


revoke all
on public.subscription_invoices
from authenticated;


revoke all
on public.subscription_invoice_payments
from public;


revoke all
on public.subscription_invoice_payments
from anon;


revoke all
on public.subscription_invoice_payments
from authenticated;


revoke all
on sequence public.subscription_invoice_number_seq
from public;


revoke all
on sequence public.subscription_invoice_number_seq
from anon;


revoke all
on sequence public.subscription_invoice_number_seq
from authenticated;


-- ============================================================
-- 14. RPC SUPER ADMIN
-- LISTE DES FACTURES
--
-- IMPORTANT :
-- Toutes les colonnes des CTE sont qualifiées
-- pour éviter les ambiguïtés PL/pgSQL.
-- ============================================================

drop function if exists
  public.list_platform_subscription_invoices(
    text,
    text,
    integer,
    integer
  );


create or replace function
  public.list_platform_subscription_invoices
  (

    search_text text default null,

    status_filter text default null,

    limit_count integer default 100,

    offset_count integer default 0

  )
returns table
(

  invoice_id uuid,

  invoice_number text,

  organization_id uuid,

  organization_name text,

  organization_short_name text,

  subscription_id uuid,

  plan_code text,

  plan_name text,

  billing_cycle text,

  period_start timestamptz,

  period_end timestamptz,

  total_xof bigint,

  amount_paid_xof bigint,

  amount_remaining_xof bigint,

  stored_status text,

  effective_status text,

  issued_at timestamptz,

  due_at timestamptz,

  paid_at timestamptz,

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

  normalized_status text;

begin

  -- ==========================================================
  -- AUTHENTIFICATION
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  -- ==========================================================
  -- SUPER ADMIN UNIQUEMENT
  -- ==========================================================

  if not private.is_platform_super_admin(
    current_user_id
  ) then

    raise exception
      'Platform super administrator required';

  end if;


  -- ==========================================================
  -- LIMITE
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


  -- ==========================================================
  -- OFFSET
  -- ==========================================================

  safe_offset :=

    greatest(

      coalesce(
        offset_count,
        0
      ),

      0

    );


  -- ==========================================================
  -- RECHERCHE
  -- ==========================================================

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
  -- STATUT
  -- ==========================================================

  normalized_status :=

    nullif(

      lower(

        btrim(

          coalesce(
            status_filter,
            ''
          )

        )

      ),

      ''

    );


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return query


  -- ==========================================================
  -- DONNEES DES FACTURES
  -- ==========================================================

  with invoice_data as
  (

    select

      si.id
        as invoice_id,

      si.invoice_number
        as invoice_number,

      si.organization_id
        as organization_id,

      o.name
        as organization_name,

      o.short_name
        as organization_short_name,

      si.subscription_id
        as subscription_id,

      si.plan_code
        as plan_code,

      si.plan_name
        as plan_name,

      si.billing_cycle
        as billing_cycle,

      si.period_start
        as period_start,

      si.period_end
        as period_end,

      si.total_xof
        as total_xof,

      si.amount_paid_xof
        as amount_paid_xof,


      greatest(

        si.total_xof -
        si.amount_paid_xof,

        0

      )::bigint
        as amount_remaining_xof,


      si.status
        as stored_status,


      case

        when si.status =
          'paid'

          then
            'paid'


        when si.status =
          'cancelled'

          then
            'cancelled'


        when

          si.status =
            'open'

          and si.due_at <
            now()

          then
            'overdue'


        else
          si.status

      end
        as effective_status,


      si.issued_at
        as issued_at,

      si.due_at
        as due_at,

      si.paid_at
        as paid_at


    from public.subscription_invoices as si


    join public.organizations as o

      on o.id =
        si.organization_id

  ),


  -- ==========================================================
  -- FILTRAGE
  -- ==========================================================

  filtered as
  (

    select
      i.*

    from invoice_data as i

    where

      -- ======================================================
      -- RECHERCHE TEXTE
      -- ======================================================

      (

        normalized_search
          is null


        or

        i.invoice_number
          ilike
            '%' ||
            normalized_search ||
            '%'


        or

        i.organization_name
          ilike
            '%' ||
            normalized_search ||
            '%'


        or

        coalesce(
          i.organization_short_name,
          ''
        )
          ilike
            '%' ||
            normalized_search ||
            '%'


        or

        i.plan_name
          ilike
            '%' ||
            normalized_search ||
            '%'

      )


      -- ======================================================
      -- FILTRE STATUT
      -- ======================================================

      and
      (

        normalized_status
          is null


        or

        i.effective_status =
          normalized_status

      )

  )


  -- ==========================================================
  -- SELECT FINAL
  -- ==========================================================

  select

    f.invoice_id,

    f.invoice_number,

    f.organization_id,

    f.organization_name,

    f.organization_short_name,

    f.subscription_id,

    f.plan_code,

    f.plan_name,

    f.billing_cycle,

    f.period_start,

    f.period_end,

    f.total_xof,

    f.amount_paid_xof,

    f.amount_remaining_xof,

    f.stored_status,

    f.effective_status,

    f.issued_at,

    f.due_at,

    f.paid_at,

    (
      count(*) over()
    )::bigint
      as total_count


  from filtered as f


  order by

    case

      when f.effective_status =
        'overdue'

        then 1


      when f.effective_status =
        'open'

        then 2


      when f.effective_status =
        'paid'

        then 3


      when f.effective_status =
        'draft'

        then 4


      else 5

    end,


    f.due_at asc,


    f.issued_at desc


  limit
    safe_limit


  offset
    safe_offset;

end;

$function$;


-- ============================================================
-- 15. RPC
-- STATISTIQUES DE FACTURATION
-- ============================================================

drop function if exists
  public.get_platform_billing_stats();


create or replace function
  public.get_platform_billing_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

begin

  -- ==========================================================
  -- AUTHENTIFICATION
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  -- ==========================================================
  -- SUPER ADMIN UNIQUEMENT
  -- ==========================================================

  if not private.is_platform_super_admin(
    current_user_id
  ) then

    raise exception
      'Platform super administrator required';

  end if;


  -- ==========================================================
  -- STATISTIQUES
  -- ==========================================================

  return
  (

    select

      jsonb_build_object(


        -- ====================================================
        -- TOTAL FACTURES
        -- ====================================================

        'total_invoices',

          count(*),


        -- ====================================================
        -- A PAYER
        -- ====================================================

        'open_invoices',

          count(*) filter
          (

            where

              si.status =
                'open'

              and si.due_at >=
                now()

          ),


        -- ====================================================
        -- EN RETARD
        -- ====================================================

        'overdue_invoices',

          count(*) filter
          (

            where

              si.status =
                'open'

              and si.due_at <
                now()

          ),


        -- ====================================================
        -- PAYEES
        -- ====================================================

        'paid_invoices',

          count(*) filter
          (

            where
              si.status =
                'paid'

          ),


        -- ====================================================
        -- ANNULEES
        -- ====================================================

        'cancelled_invoices',

          count(*) filter
          (

            where
              si.status =
                'cancelled'

          ),


        -- ====================================================
        -- TOTAL FACTURE
        --
        -- Factures annulées exclues.
        -- ====================================================

        'total_billed_xof',

          coalesce(

            sum(

              case

                when si.status <>
                  'cancelled'

                then
                  si.total_xof

                else
                  0

              end

            ),

            0

          ),


        -- ====================================================
        -- TOTAL ENCAISSE
        -- ====================================================

        'total_collected_xof',

          coalesce(

            sum(
              si.amount_paid_xof
            ),

            0

          ),


        -- ====================================================
        -- RESTE A ENCAISSER
        -- ====================================================

        'total_outstanding_xof',

          coalesce(

            sum(

              case

                when si.status =
                  'open'

                then

                  greatest(

                    si.total_xof -
                    si.amount_paid_xof,

                    0

                  )

                else
                  0

              end

            ),

            0

          ),


        -- ====================================================
        -- PAIEMENTS CONFIRMES
        -- ====================================================

        'confirmed_payments',

          (

            select
              count(*)

            from
              public.subscription_invoice_payments
                as sip

            where
              sip.status =
                'confirmed'

          )

      )


    from public.subscription_invoices
      as si

  );

end;

$function$;


-- ============================================================
-- 16. DROITS RPC : LISTE DES FACTURES
-- ============================================================

revoke all
on function
  public.list_platform_subscription_invoices(
    text,
    text,
    integer,
    integer
  )
from public;


revoke all
on function
  public.list_platform_subscription_invoices(
    text,
    text,
    integer,
    integer
  )
from anon;


revoke all
on function
  public.list_platform_subscription_invoices(
    text,
    text,
    integer,
    integer
  )
from authenticated;


grant execute
on function
  public.list_platform_subscription_invoices(
    text,
    text,
    integer,
    integer
  )
to authenticated;


-- ============================================================
-- 17. DROITS RPC : STATISTIQUES
-- ============================================================

revoke all
on function
  public.get_platform_billing_stats()
from public;


revoke all
on function
  public.get_platform_billing_stats()
from anon;


revoke all
on function
  public.get_platform_billing_stats()
from authenticated;


grant execute
on function
  public.get_platform_billing_stats()
to authenticated;


-- ============================================================
-- 18. COMMENTAIRES
-- ============================================================

comment on table
  public.subscription_invoices
is
  'Factures commerciales liées aux abonnements Afri Club. Ces factures sont distinctes des cotisations et opérations financières des mutuelles.';


comment on table
  public.subscription_invoice_payments
is
  'Paiements reçus par Afri Club pour les factures d abonnement des organisations.';


comment on function
  public.list_platform_subscription_invoices(
    text,
    text,
    integer,
    integer
  )
is
  'Liste Super-admin des factures d abonnement Afri Club avec statut réel, montant payé et reste à encaisser.';


comment on function
  public.get_platform_billing_stats()
is
  'Indicateurs globaux de facturation et d encaissement de la plateforme Afri Club.';


comment on function
  private.create_subscription_invoice(uuid)
is
  'Crée de manière idempotente une facture pour une période d abonnement payante Afri Club.';


comment on function
  private.generate_subscription_invoice_number()
is
  'Génère les numéros de facture Afri Club sous la forme AFC-AAAA-000001.';


-- ============================================================
-- 19. RECHARGEMENT DU CACHE POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';