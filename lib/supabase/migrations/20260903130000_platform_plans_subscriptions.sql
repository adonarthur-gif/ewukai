-- ============================================================
-- AFRI CLUB
-- MIGRATION 036
-- PLANS & ABONNEMENTS
--
-- Grille commerciale :
--
-- GRATUIT
--   0 FCFA / mois
--   Jusqu'à 20 membres
--
-- STANDARD
--   5 000 FCFA / mois
--   De 21 à 50 membres
--
-- PRO
--   10 000 FCFA / mois
--   De 51 à 500 membres
--
-- ENTREPRISE
--   Sur devis
--   Plus de 500 membres
--
-- ============================================================


-- ============================================================
-- 0. EXTENSION UUID
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- 1. TABLE DES PLANS
-- ============================================================

create table if not exists public.subscription_plans (

  id uuid primary key
    default gen_random_uuid(),

  -- Code technique stable :
  -- free / standard / pro / enterprise
  code text not null unique,

  -- Nom commercial
  name text not null,

  -- Description commerciale
  description text,

  -- Prix mensuel en FCFA
  monthly_price_xof bigint not null
    default 0
    check (
      monthly_price_xof >= 0
    ),

  -- Prix annuel éventuel.
  -- NULL pour le moment.
  yearly_price_xof bigint
    check (
      yearly_price_xof is null
      or yearly_price_xof >= 0
    ),

  -- Nombre maximum de membres.
  -- NULL = illimité / contrat personnalisé.
  member_limit integer
    check (
      member_limit is null
      or member_limit > 0
    ),

  -- true pour Entreprise / tarif sur devis
  is_custom_pricing boolean not null
    default false,

  -- Plan utilisable
  is_active boolean not null
    default true,

  -- Plan visible commercialement
  is_public boolean not null
    default true,

  -- Ordre d'affichage
  sort_order integer not null
    default 0,

  -- Fonctionnalités du plan
  features jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- ============================================================
-- 2. TABLE DES ABONNEMENTS DES ORGANISATIONS
-- ============================================================

create table if not exists public.organization_subscriptions (

  id uuid primary key
    default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  plan_id uuid not null
    references public.subscription_plans(id)
    on delete restrict,

  -- Etat de l'abonnement
  status text not null
    default 'active'
    check (
      status in (
        'trialing',
        'active',
        'past_due',
        'cancelled',
        'expired'
      )
    ),

  -- Mode de facturation
  billing_cycle text not null
    default 'free'
    check (
      billing_cycle in (
        'free',
        'monthly',
        'yearly',
        'custom'
      )
    ),

  -- Date de début de l'abonnement
  starts_at timestamptz not null
    default now(),

  -- Période de facturation courante
  current_period_start timestamptz,

  current_period_end timestamptz,

  -- Résiliation à la fin de la période
  cancel_at_period_end boolean not null
    default false,

  -- Date effective de fin
  ended_at timestamptz,

  -- Futur prestataire de paiement
  -- Ex. Wave, Orange Money, Stripe...
  provider text,

  -- Référence abonnement chez le prestataire
  provider_subscription_ref text,

  -- Notes internes
  notes text,

  -- Administrateur / utilisateur à l'origine
  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- ============================================================
-- 3. INDEX
-- ============================================================

create index if not exists
  organization_subscriptions_organization_idx
on public.organization_subscriptions (
  organization_id
);


create index if not exists
  organization_subscriptions_plan_idx
on public.organization_subscriptions (
  plan_id
);


create index if not exists
  organization_subscriptions_status_idx
on public.organization_subscriptions (
  status
);


create index if not exists
  subscription_plans_code_idx
on public.subscription_plans (
  code
);


-- ============================================================
-- 4. UNE SEULE SOUSCRIPTION COURANTE PAR ORGANISATION
-- ============================================================

create unique index if not exists
  organization_subscriptions_one_current_idx
on public.organization_subscriptions (
  organization_id
)
where status in (
  'trialing',
  'active',
  'past_due'
);


-- ============================================================
-- 5. CREATION / MISE A JOUR DES PLANS
-- ============================================================

insert into public.subscription_plans (

  code,
  name,
  description,
  monthly_price_xof,
  yearly_price_xof,
  member_limit,
  is_custom_pricing,
  is_active,
  is_public,
  sort_order,
  features

)
values

-- ============================================================
-- GRATUIT
-- Jusqu'à 20 membres
-- ============================================================

(
  'free',

  'Gratuit',

  'Pour démarrer simplement avec une petite organisation comptant jusqu''à 20 membres.',

  0,

  0,

  20,

  false,

  true,

  true,

  10,

  jsonb_build_object(

    'members',
      true,

    'contributions',
      true,

    'basic_dashboard',
      true,

    'receipts',
      true,

    'treasury',
      false,

    'advanced_reports',
      false,

    'automation',
      false,

    'priority_support',
      false,

    'custom_integrations',
      false

  )
),


-- ============================================================
-- STANDARD
-- 21 à 50 membres
-- 5 000 FCFA / mois
-- ============================================================

(
  'standard',

  'Standard',

  'Pour les associations, mutuelles et organisations comptant jusqu''à 50 membres.',

  5000,

  null,

  50,

  false,

  true,

  true,

  20,

  jsonb_build_object(

    'members',
      true,

    'contributions',
      true,

    'basic_dashboard',
      true,

    'receipts',
      true,

    'treasury',
      true,

    'advanced_reports',
      false,

    'automation',
      false,

    'priority_support',
      false,

    'custom_integrations',
      false

  )
),


-- ============================================================
-- PRO
-- 51 à 500 membres
-- 10 000 FCFA / mois
-- ============================================================

(
  'pro',

  'Pro',

  'Pour les organisations en croissance et les grandes mutuelles comptant jusqu''à 500 membres.',

  10000,

  null,

  500,

  false,

  true,

  true,

  30,

  jsonb_build_object(

    'members',
      true,

    'contributions',
      true,

    'basic_dashboard',
      true,

    'receipts',
      true,

    'treasury',
      true,

    'advanced_reports',
      true,

    'automation',
      true,

    'priority_support',
      true,

    'custom_integrations',
      false

  )
),


-- ============================================================
-- ENTREPRISE
-- Plus de 500 membres
-- Tarif sur devis
-- ============================================================

(
  'enterprise',

  'Entreprise',

  'Pour les organisations de plus de 500 membres, fédérations, réseaux et structures nécessitant une offre personnalisée.',

  0,

  null,

  null,

  true,

  true,

  true,

  40,

  jsonb_build_object(

    'members',
      true,

    'contributions',
      true,

    'basic_dashboard',
      true,

    'receipts',
      true,

    'treasury',
      true,

    'advanced_reports',
      true,

    'automation',
      true,

    'priority_support',
      true,

    'custom_integrations',
      true

  )
)


-- ============================================================
-- SI LES PLANS EXISTENT DEJA
-- ON LES MET A JOUR
-- ============================================================

on conflict (code)
do update set

  name =
    excluded.name,

  description =
    excluded.description,

  monthly_price_xof =
    excluded.monthly_price_xof,

  yearly_price_xof =
    excluded.yearly_price_xof,

  member_limit =
    excluded.member_limit,

  is_custom_pricing =
    excluded.is_custom_pricing,

  is_active =
    excluded.is_active,

  is_public =
    excluded.is_public,

  sort_order =
    excluded.sort_order,

  features =
    excluded.features,

  updated_at =
    now();


-- ============================================================
-- 6. ATTRIBUER LE PLAN GRATUIT
-- AUX ORGANISATIONS EXISTANTES
-- ============================================================

insert into public.organization_subscriptions (

  organization_id,
  plan_id,
  status,
  billing_cycle,
  starts_at,
  current_period_start,
  created_by

)

select

  o.id,

  p.id,

  'active',

  'free',

  coalesce(
    o.created_at,
    now()
  ),

  coalesce(
    o.created_at,
    now()
  ),

  o.created_by

from public.organizations as o

cross join public.subscription_plans as p

where

  p.code =
    'free'

  and not exists (

    select
      1

    from public.organization_subscriptions as os

    where

      os.organization_id =
        o.id

      and os.status in (
        'trialing',
        'active',
        'past_due'
      )

  );


-- ============================================================
-- 7. ATTRIBUTION AUTOMATIQUE DU PLAN GRATUIT
-- POUR TOUTE NOUVELLE ORGANISATION
-- ============================================================

create or replace function private.assign_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$

declare

  free_plan_id uuid;

begin

  -- ==========================================================
  -- RECHERCHE DU PLAN GRATUIT
  -- ==========================================================

  select
    sp.id

  into
    free_plan_id

  from public.subscription_plans as sp

  where

    sp.code =
      'free'

    and sp.is_active =
      true

  limit 1;


  -- ==========================================================
  -- SECURITE
  -- ==========================================================

  if free_plan_id is null then

    raise exception
      'Default free subscription plan not found';

  end if;


  -- ==========================================================
  -- CREATION DE L'ABONNEMENT GRATUIT
  -- ==========================================================

  insert into public.organization_subscriptions (

    organization_id,
    plan_id,
    status,
    billing_cycle,
    starts_at,
    current_period_start,
    created_by

  )
  values (

    new.id,

    free_plan_id,

    'active',

    'free',

    now(),

    now(),

    new.created_by

  );


  return new;

end;

$function$;


-- ============================================================
-- 8. TRIGGER NOUVELLE ORGANISATION
-- ============================================================

drop trigger if exists
  trg_assign_default_subscription
on public.organizations;


create trigger
  trg_assign_default_subscription

after insert
on public.organizations

for each row

execute function
  private.assign_default_subscription();


-- ============================================================
-- 9. RLS
-- ============================================================

alter table public.subscription_plans
enable row level security;


alter table public.organization_subscriptions
enable row level security;


-- ============================================================
-- 10. BLOQUER LES ACCES DIRECTS
-- ============================================================

revoke all
on public.subscription_plans
from public;


revoke all
on public.subscription_plans
from anon;


revoke all
on public.subscription_plans
from authenticated;


revoke all
on public.organization_subscriptions
from public;


revoke all
on public.organization_subscriptions
from anon;


revoke all
on public.organization_subscriptions
from authenticated;


-- ============================================================
-- 11. RPC SUPER ADMIN
-- LISTE DES PLANS
-- ============================================================

drop function if exists
  public.list_platform_plans();


create or replace function public.list_platform_plans()
returns table (

  plan_id uuid,

  code text,

  name text,

  description text,

  monthly_price_xof bigint,

  yearly_price_xof bigint,

  member_limit integer,

  is_custom_pricing boolean,

  is_active boolean,

  is_public boolean,

  sort_order integer,

  features jsonb,

  active_organizations bigint,

  created_at timestamptz,

  updated_at timestamptz

)
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

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
  -- SUPER ADMIN UNIQUEMENT
  -- ==========================================================

  if not private.is_platform_super_admin(
    current_user_id
  ) then

    raise exception
      'Platform super administrator required';

  end if;


  -- ==========================================================
  -- LISTE DES PLANS
  -- ==========================================================

  return query

  select

    sp.id
      as plan_id,

    sp.code,

    sp.name,

    sp.description,

    sp.monthly_price_xof,

    sp.yearly_price_xof,

    sp.member_limit,

    sp.is_custom_pricing,

    sp.is_active,

    sp.is_public,

    sp.sort_order,

    sp.features,

    (
      select
        count(*)

      from public.organization_subscriptions as os

      where

        os.plan_id =
          sp.id

        and os.status in (
          'trialing',
          'active',
          'past_due'
        )

    )::bigint
      as active_organizations,

    sp.created_at,

    sp.updated_at

  from public.subscription_plans as sp

  order by

    sp.sort_order asc,

    sp.monthly_price_xof asc,

    sp.name asc;

end;

$function$;


-- ============================================================
-- 12. RPC SUPER ADMIN
-- STATISTIQUES GENERALES DES ABONNEMENTS
-- ============================================================

drop function if exists
  public.get_platform_subscription_stats();


create or replace function public.get_platform_subscription_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

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


  return jsonb_build_object(

    'total_subscriptions',

      (
        select
          count(*)

        from public.organization_subscriptions as os

        where os.status in (
          'trialing',
          'active',
          'past_due'
        )
      ),


    'free_subscriptions',

      (
        select
          count(*)

        from public.organization_subscriptions as os

        join public.subscription_plans as sp
          on sp.id =
            os.plan_id

        where

          os.status in (
            'trialing',
            'active',
            'past_due'
          )

          and sp.code =
            'free'
      ),


    'standard_subscriptions',

      (
        select
          count(*)

        from public.organization_subscriptions as os

        join public.subscription_plans as sp
          on sp.id =
            os.plan_id

        where

          os.status in (
            'trialing',
            'active',
            'past_due'
          )

          and sp.code =
            'standard'
      ),


    'pro_subscriptions',

      (
        select
          count(*)

        from public.organization_subscriptions as os

        join public.subscription_plans as sp
          on sp.id =
            os.plan_id

        where

          os.status in (
            'trialing',
            'active',
            'past_due'
          )

          and sp.code =
            'pro'
      ),


    'enterprise_subscriptions',

      (
        select
          count(*)

        from public.organization_subscriptions as os

        join public.subscription_plans as sp
          on sp.id =
            os.plan_id

        where

          os.status in (
            'trialing',
            'active',
            'past_due'
          )

          and sp.code =
            'enterprise'
      ),


    'paid_subscriptions',

      (
        select
          count(*)

        from public.organization_subscriptions as os

        join public.subscription_plans as sp
          on sp.id =
            os.plan_id

        where

          os.status in (
            'trialing',
            'active',
            'past_due'
          )

          and sp.code in (
            'standard',
            'pro',
            'enterprise'
          )
      )

  );

end;

$function$;


-- ============================================================
-- 13. RPC
-- TROUVER LE PLAN RECOMMANDE SELON LE NOMBRE DE MEMBRES
-- ============================================================

drop function if exists
  public.get_recommended_subscription_plan(integer);


create or replace function public.get_recommended_subscription_plan(
  target_member_count integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  safe_member_count integer;

  selected_plan record;

begin

  -- ==========================================================
  -- NORMALISATION
  -- ==========================================================

  safe_member_count :=
    greatest(
      coalesce(
        target_member_count,
        0
      ),
      0
    );


  -- ==========================================================
  -- 0 A 20
  -- GRATUIT
  -- ==========================================================

  if safe_member_count <= 20 then

    select *
    into selected_plan
    from public.subscription_plans
    where
      code = 'free'
      and is_active = true
    limit 1;


  -- ==========================================================
  -- 21 A 50
  -- STANDARD
  -- ==========================================================

  elsif safe_member_count <= 50 then

    select *
    into selected_plan
    from public.subscription_plans
    where
      code = 'standard'
      and is_active = true
    limit 1;


  -- ==========================================================
  -- 51 A 500
  -- PRO
  -- ==========================================================

  elsif safe_member_count <= 500 then

    select *
    into selected_plan
    from public.subscription_plans
    where
      code = 'pro'
      and is_active = true
    limit 1;


  -- ==========================================================
  -- PLUS DE 500
  -- ENTREPRISE
  -- ==========================================================

  else

    select *
    into selected_plan
    from public.subscription_plans
    where
      code = 'enterprise'
      and is_active = true
    limit 1;

  end if;


  if selected_plan.id is null then

    return null;

  end if;


  return jsonb_build_object(

    'plan_id',
      selected_plan.id,

    'code',
      selected_plan.code,

    'name',
      selected_plan.name,

    'monthly_price_xof',
      selected_plan.monthly_price_xof,

    'member_limit',
      selected_plan.member_limit,

    'is_custom_pricing',
      selected_plan.is_custom_pricing,

    'member_count',
      safe_member_count

  );

end;

$function$;


-- ============================================================
-- 14. DROITS RPC
-- ============================================================

revoke all
on function public.list_platform_plans()
from public;


revoke all
on function public.list_platform_plans()
from anon;


revoke all
on function public.list_platform_plans()
from authenticated;


grant execute
on function public.list_platform_plans()
to authenticated;


-- ------------------------------------------------------------

revoke all
on function public.get_platform_subscription_stats()
from public;


revoke all
on function public.get_platform_subscription_stats()
from anon;


revoke all
on function public.get_platform_subscription_stats()
from authenticated;


grant execute
on function public.get_platform_subscription_stats()
to authenticated;


-- ------------------------------------------------------------

revoke all
on function public.get_recommended_subscription_plan(integer)
from public;


revoke all
on function public.get_recommended_subscription_plan(integer)
from anon;


revoke all
on function public.get_recommended_subscription_plan(integer)
from authenticated;


grant execute
on function public.get_recommended_subscription_plan(integer)
to authenticated;


-- ============================================================
-- 15. COMMENTAIRES
-- ============================================================

comment on table public.subscription_plans
is
'Catalogue des plans commerciaux Afri Club : Gratuit, Standard, Pro et Entreprise.';


comment on table public.organization_subscriptions
is
'Historique et abonnement courant des organisations Afri Club.';


comment on function public.list_platform_plans()
is
'Liste des plans Afri Club et nombre d organisations actuellement abonnées.';


comment on function public.get_platform_subscription_stats()
is
'Statistiques globales des abonnements Afri Club pour le Super-administrateur.';


comment on function public.get_recommended_subscription_plan(integer)
is
'Détermine le plan Afri Club recommandé selon le nombre de membres : 0-20 Gratuit, 21-50 Standard, 51-500 Pro, 501+ Entreprise.';


-- ============================================================
-- 16. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';