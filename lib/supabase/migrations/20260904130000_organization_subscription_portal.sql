-- ============================================================
-- AFRI CLUB
-- MIGRATION 042
-- PORTAIL ABONNEMENT ORGANISATION
-- ============================================================


-- ============================================================
-- 1. FONCTION
--
-- Permet à un responsable d'organisation de consulter :
--
-- - son organisation
-- - son nombre de membres actifs
-- - son abonnement actuel
-- - son éventuel abonnement en attente de paiement
-- - sa facture en attente
-- - le plan recommandé
-- - les plans disponibles
--
-- IMPORTANT :
--
-- Cette fonction ne retourne JAMAIS les informations
-- d'une autre organisation.
-- ============================================================

create or replace function public.get_organization_subscription_portal(
  target_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  organization_record record;

  organization_user_record record;

  active_member_count integer := 0;

  recommended_plan_code text;

  current_subscription_json jsonb := null;

  pending_subscription_json jsonb := null;

  pending_invoice_json jsonb := null;

  plans_json jsonb := '[]'::jsonb;

  can_manage_subscription boolean := false;

begin

  -- ==========================================================
  -- 2. UTILISATEUR CONNECTE
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  if target_organization_id is null then

    raise exception
      'Organization is required';

  end if;


  -- ==========================================================
  -- 3. ORGANISATION
  -- ==========================================================

  select
    o.id,
    o.name,
    o.short_name,
    o.created_at

  into
    organization_record

  from
    public.organizations as o

  where
    o.id =
      target_organization_id;


  if not found then

    raise exception
      'Organization not found';

  end if;


  -- ==========================================================
  -- 4. VERIFIER QUE L'UTILISATEUR APPARTIENT A L'ORGANISATION
  -- ==========================================================

  select
    ou.role,
    ou.is_active

  into
    organization_user_record

  from
    public.organization_users as ou

  where
    ou.organization_id =
      target_organization_id

    and ou.user_id =
      current_user_id

    and ou.is_active =
      true

  limit 1;


  if not found then

    raise exception
      'Not authorized';

  end if;


  -- ==========================================================
  -- 5. DROITS SUR L'ABONNEMENT
  --
  -- Consultation :
  -- tous les responsables actifs de l'organisation.
  --
  -- Modification / checkout :
  -- owner / president / treasurer uniquement.
  --
  -- La RPC de checkout vérifie également ces droits.
  -- ==========================================================

  can_manage_subscription :=
    organization_user_record.role::text
      in (
        'owner',
        'president',
        'treasurer'
      );


  -- ==========================================================
  -- 6. NOMBRE DE MEMBRES ACTIFS
  -- ==========================================================

  select
    count(*)::integer

  into
    active_member_count

  from
    public.members as m

  where
    m.organization_id =
      target_organization_id

    and m.status =
      'active'::public.member_status;


  -- ==========================================================
  -- 7. PLAN RECOMMANDE
  --
  -- 0 - 20     : Gratuit
  -- 21 - 50    : Standard
  -- 51 - 500   : Pro
  -- 501+       : Entreprise
  -- ==========================================================

  recommended_plan_code :=
    case

      when active_member_count <= 20 then
        'free'

      when active_member_count <= 50 then
        'standard'

      when active_member_count <= 500 then
        'pro'

      else
        'enterprise'

    end;


  -- ==========================================================
  -- 8. ABONNEMENT ACTUEL
  --
  -- On retourne également les informations du plan.
  -- ==========================================================

  select

    to_jsonb(os)
      ||
    jsonb_build_object(
      'plan',
      to_jsonb(sp)
    )

  into
    current_subscription_json

  from
    public.organization_subscriptions as os

  join
    public.subscription_plans as sp
      on sp.id =
         os.plan_id

  where
    os.organization_id =
      target_organization_id

    and os.status::text
      in (
        'active',
        'trialing',
        'past_due'
      )

  order by
    os.created_at desc

  limit 1;


  -- ==========================================================
  -- 9. ABONNEMENT EN ATTENTE DE PAIEMENT
  -- ==========================================================

  select

    to_jsonb(os)
      ||
    jsonb_build_object(
      'plan',
      to_jsonb(sp)
    )

  into
    pending_subscription_json

  from
    public.organization_subscriptions as os

  join
    public.subscription_plans as sp
      on sp.id =
         os.plan_id

  where
    os.organization_id =
      target_organization_id

    and os.status::text =
      'pending_payment'

  order by
    os.created_at desc

  limit 1;


  -- ==========================================================
  -- 10. FACTURE EN ATTENTE
  --
  -- Une formule payante doit avoir :
  --
  -- pending_payment
  -- +
  -- facture ouverte
  --
  -- Aucun paiement partiel n'est prévu.
  -- ==========================================================

  if pending_subscription_json is not null then

    select
      to_jsonb(si)

    into
      pending_invoice_json

    from
      public.subscription_invoices as si

    where
      si.subscription_id =
        (
          pending_subscription_json
            ->> 'id'
        )::uuid

      and si.status::text
        in (
          'draft',
          'open'
        )

    order by
      si.created_at desc

    limit 1;

  end if;


  -- ==========================================================
  -- 11. PLANS DISPONIBLES
  --
  -- Nous utilisons to_jsonb afin de rester alignés avec
  -- la structure réelle de subscription_plans.
  -- ==========================================================

  select
    coalesce(
      jsonb_agg(
        to_jsonb(sp)

        order by
          case sp.code

            when 'free' then
              1

            when 'standard' then
              2

            when 'pro' then
              3

            when 'enterprise' then
              4

            else
              99

          end
      ),
      '[]'::jsonb
    )

  into
    plans_json

  from
    public.subscription_plans as sp

  where
    sp.code
      in (
        'free',
        'standard',
        'pro',
        'enterprise'
      );


  -- ==========================================================
  -- 12. RESULTAT
  -- ==========================================================

  return
    jsonb_build_object(

      'organization',
      jsonb_build_object(

        'id',
        organization_record.id,

        'name',
        organization_record.name,

        'short_name',
        organization_record.short_name,

        'created_at',
        organization_record.created_at

      ),


      'viewer',
      jsonb_build_object(

        'role',
        organization_user_record.role::text,

        'can_manage_subscription',
        can_manage_subscription

      ),


      'members',
      jsonb_build_object(

        'active_count',
        active_member_count

      ),


      'recommendation',
      jsonb_build_object(

        'plan_code',
        recommended_plan_code

      ),


      'current_subscription',
      current_subscription_json,


      'pending_subscription',
      pending_subscription_json,


      'pending_invoice',
      pending_invoice_json,


      'plans',
      plans_json

    );

end;

$function$;


-- ============================================================
-- 13. SECURITE
-- ============================================================

revoke all
on function public.get_organization_subscription_portal(
  uuid
)
from public;


revoke all
on function public.get_organization_subscription_portal(
  uuid
)
from anon;


revoke all
on function public.get_organization_subscription_portal(
  uuid
)
from authenticated;


grant execute
on function public.get_organization_subscription_portal(
  uuid
)
to authenticated;


-- ============================================================
-- 14. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst, 'reload schema';