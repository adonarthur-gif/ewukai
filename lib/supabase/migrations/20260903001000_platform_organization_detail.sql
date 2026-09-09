-- ============================================================
-- AFRI CLUB
-- MIGRATION 031
-- FICHE DETAILLEE D'UNE ORGANISATION POUR LE SUPER ADMIN
--
-- Objectif :
-- - lecture globale d'une organisation ;
-- - réservée au Super-admin Afri Club ;
-- - aucune modification des données ;
-- - aucune utilisation de service_role côté application.
-- ============================================================

create or replace function public.get_platform_organization_detail(
  target_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  organization_result jsonb;

  public_profile_result jsonb;

  managers_result jsonb;

  total_members_count bigint := 0;

  active_members_count bigint := 0;

  pending_memberships_count bigint := 0;

  active_contribution_types_count bigint := 0;

  active_treasury_accounts_count bigint := 0;

  confirmed_payments_count bigint := 0;

  confirmed_payments_total bigint := 0;

  treasury_credit_total bigint := 0;

  treasury_debit_total bigint := 0;

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
  -- 3. VALIDATION DE L'ORGANISATION
  -- ==========================================================

  if target_organization_id is null then

    raise exception
      'Organization id is required';

  end if;


  if not exists (

    select 1

    from public.organizations as o

    where
      o.id =
        target_organization_id

  ) then

    raise exception
      'Organization not found';

  end if;


  -- ==========================================================
  -- 4. IDENTITE DE L'ORGANISATION
  -- ==========================================================

  select
    jsonb_build_object(

      'id',
        o.id,

      'name',
        o.name,

      'short_name',
        o.short_name,

      'description',
        o.description,

      'logo_url',
        o.logo_url,

      'phone',
        o.phone,

      'email',
        o.email,

      'address',
        o.address,

      'city',
        o.city,

      'country',
        o.country,

      'country_code',
        o.country_code,

      'currency',
        o.currency,

      'status',
        o.status::text,

      'organization_type',
        o.organization_type,

      'legal_name',
        o.legal_name,

      'registration_number',
        o.registration_number,

      'website',
        o.website,

      'public_slug',
        o.public_slug,

      'public_page_enabled',
        o.public_page_enabled,

      'online_membership_enabled',
        o.online_membership_enabled,

      'created_by',
        o.created_by,

      'created_at',
        o.created_at,

      'updated_at',
        o.updated_at

    )

  into
    organization_result

  from public.organizations as o

  where
    o.id =
      target_organization_id;


  -- ==========================================================
  -- 5. PROFIL PUBLIC / BRANDING
  -- ==========================================================

  select
    jsonb_build_object(

      'organization_id',
        opp.organization_id,

      'slogan',
        opp.slogan,

      'mission',
        opp.mission,

      'vision',
        opp.vision,

      'objectives',
        opp.objectives,

      'public_phone',
        opp.public_phone,

      'public_email',
        opp.public_email,

      'location_label',
        opp.location_label,

      'logo_path',
        opp.logo_path,

      'primary_color',
        opp.primary_color,

      'secondary_color',
        opp.secondary_color,

      'accent_color',
        opp.accent_color,

      'show_member_count',
        opp.show_member_count,

      'show_leadership',
        opp.show_leadership,

      'show_projects',
        opp.show_projects,

      'show_news',
        opp.show_news

    )

  into
    public_profile_result

  from public.organization_public_profiles as opp

  where
    opp.organization_id =
      target_organization_id;


  -- ==========================================================
  -- 6. RESPONSABLES DE L'ORGANISATION
  -- ==========================================================

  select
    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'user_id',
            ou.user_id,

          'role',
            ou.role::text,

          'is_active',
            ou.is_active,

          'full_name',
            p.full_name,

          'phone',
            p.phone,

          'created_at',
            ou.created_at

        )

        order by
          ou.created_at asc

      ),

      '[]'::jsonb

    )

  into
    managers_result

  from public.organization_users as ou

  left join public.profiles as p
    on p.id =
      ou.user_id

  where
    ou.organization_id =
      target_organization_id

    and ou.is_active =
      true

    and ou.role::text in (
      'owner',
      'president',
      'treasurer',
      'secretary',
      'auditor'
    );


  -- ==========================================================
  -- 7. MEMBRES
  -- ==========================================================

  select
    count(*)

  into
    total_members_count

  from public.members as m

  where
    m.organization_id =
      target_organization_id;


  select
    count(*)

  into
    active_members_count

  from public.members as m

  where
    m.organization_id =
      target_organization_id

    and m.status::text =
      'active';


  -- ==========================================================
  -- 8. DEMANDES D'ADHESION
  -- ==========================================================

  select
    count(*)

  into
    pending_memberships_count

  from public.membership_applications as ma

  where
    ma.organization_id =
      target_organization_id

    and ma.status::text =
      'pending';


  -- ==========================================================
  -- 9. TYPES DE COTISATION ACTIFS
  -- ==========================================================

  select
    count(*)

  into
    active_contribution_types_count

  from public.contribution_types as ct

  where
    ct.organization_id =
      target_organization_id

    and ct.is_active =
      true;


  -- ==========================================================
  -- 10. COMPTES DE TRESORERIE
  -- ==========================================================

  select
    count(*)

  into
    active_treasury_accounts_count

  from public.treasury_accounts as ta

  where
    ta.organization_id =
      target_organization_id

    and ta.is_active =
      true;


  -- ==========================================================
  -- 11. PAIEMENTS CONFIRMES
  -- ==========================================================

  select

    count(*),

    coalesce(
      sum(p.amount),
      0
    )::bigint

  into

    confirmed_payments_count,

    confirmed_payments_total

  from public.payments as p

  where
    p.organization_id =
      target_organization_id

    and p.status::text =
      'confirmed';


  -- ==========================================================
  -- 12. MOUVEMENTS DE TRESORERIE
  --
  -- Lecture uniquement.
  -- Afri Club ne détient pas les fonds.
  -- ==========================================================

  select
    coalesce(
      sum(le.amount),
      0
    )::bigint

  into
    treasury_credit_total

  from public.ledger_entries as le

  where
    le.organization_id =
      target_organization_id

    and le.direction::text =
      'credit';


  select
    coalesce(
      sum(le.amount),
      0
    )::bigint

  into
    treasury_debit_total

  from public.ledger_entries as le

  where
    le.organization_id =
      target_organization_id

    and le.direction::text =
      'debit';


  -- ==========================================================
  -- 13. RESULTAT FINAL
  -- ==========================================================

  return jsonb_build_object(

    'organization',
      organization_result,

    'public_profile',
      coalesce(
        public_profile_result,
        '{}'::jsonb
      ),

    'managers',
      coalesce(
        managers_result,
        '[]'::jsonb
      ),

    'stats',
      jsonb_build_object(

        'total_members',
          total_members_count,

        'active_members',
          active_members_count,

        'pending_memberships',
          pending_memberships_count,

        'active_contribution_types',
          active_contribution_types_count,

        'active_treasury_accounts',
          active_treasury_accounts_count,

        'confirmed_payments_count',
          confirmed_payments_count,

        'confirmed_payments_total',
          confirmed_payments_total,

        'treasury_credit_total',
          treasury_credit_total,

        'treasury_debit_total',
          treasury_debit_total,

        'treasury_balance',
          treasury_credit_total
          -
          treasury_debit_total

      )

  );

end;

$function$;


-- ============================================================
-- SECURITE
-- ============================================================

revoke all
on function public.get_platform_organization_detail(uuid)
from public;


revoke all
on function public.get_platform_organization_detail(uuid)
from anon;


revoke all
on function public.get_platform_organization_detail(uuid)
from authenticated;


grant execute
on function public.get_platform_organization_detail(uuid)
to authenticated;


-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on function public.get_platform_organization_detail(uuid)
is
'Afri Club - retourne la fiche détaillée en lecture seule d une organisation. Réservée au Super-admin de la plateforme.';


-- ============================================================
-- RECHARGER LE SCHEMA POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';