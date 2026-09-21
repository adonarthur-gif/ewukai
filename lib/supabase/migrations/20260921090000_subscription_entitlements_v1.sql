-- ============================================================================
-- EWUKAI - Droits fonctionnels V1
-- Migration : 20260921090000_subscription_entitlements_v1.sql
--
-- Objectif :
--   1) Lire les droits fonctionnels de la formule actuellement effective.
--   2) Tester une fonctionnalité par clé.
--
-- Important :
--   - Cette V1 est en lecture seule : elle ne bloque encore aucun module.
--   - Les abonnements pending_payment ne donnent aucun droit.
--   - Les statuts trialing / active / past_due restent effectifs, conformément
--     à la logique déjà utilisée par le quota membres.
--   - En l'absence de souscription courante, la formule free est utilisée.
-- ============================================================================

create or replace function public.get_organization_entitlements(
  target_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;

  selected_plan_id uuid;
  selected_plan_code text;
  selected_plan_name text;
  selected_member_limit integer;
  selected_features jsonb;

  selected_subscription_id uuid;
  selected_subscription_status text;

  entitlement_source text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization id is required';
  end if;

  if not exists (
    select 1
    from public.organizations as o
    where o.id = target_organization_id
  ) then
    raise exception 'Organization not found';
  end if;

  if not private.is_platform_super_admin(current_user_id)
     and not exists (
       select 1
       from public.organization_users as ou
       where ou.organization_id = target_organization_id
         and ou.user_id = current_user_id
         and ou.is_active = true
     ) then
    raise exception 'Not authorized';
  end if;

  select
    os.id,
    os.status,
    sp.id,
    sp.code,
    sp.name,
    sp.member_limit,
    coalesce(sp.features, '{}'::jsonb)
  into
    selected_subscription_id,
    selected_subscription_status,
    selected_plan_id,
    selected_plan_code,
    selected_plan_name,
    selected_member_limit,
    selected_features
  from public.organization_subscriptions as os
  join public.subscription_plans as sp
    on sp.id = os.plan_id
  where os.organization_id = target_organization_id
    and os.status in (
      'trialing',
      'active',
      'past_due'
    )
  limit 1;

  if selected_plan_id is not null then
    entitlement_source := 'current_subscription';
  end if;

  if selected_plan_id is null then
    select
      sp.id,
      sp.code,
      sp.name,
      sp.member_limit,
      coalesce(sp.features, '{}'::jsonb)
    into
      selected_plan_id,
      selected_plan_code,
      selected_plan_name,
      selected_member_limit,
      selected_features
    from public.subscription_plans as sp
    where lower(sp.code) = 'free'
    order by sp.created_at asc
    limit 1;

    selected_subscription_id := null;
    selected_subscription_status := null;
    entitlement_source := 'free_fallback';
  end if;

  if selected_plan_id is null then
    raise exception 'Free subscription plan is not configured';
  end if;

  return jsonb_build_object(
    'organization_id', target_organization_id,
    'subscription_id', selected_subscription_id,
    'subscription_status', selected_subscription_status,
    'source', entitlement_source,
    'plan_id', selected_plan_id,
    'plan_code', selected_plan_code,
    'plan_name', selected_plan_name,
    'member_limit', selected_member_limit,
    'features', coalesce(selected_features, '{}'::jsonb)
  );
end;
$function$;

revoke all
on function public.get_organization_entitlements(uuid)
from public;

revoke all
on function public.get_organization_entitlements(uuid)
from anon;

revoke all
on function public.get_organization_entitlements(uuid)
from authenticated;

grant execute
on function public.get_organization_entitlements(uuid)
to authenticated;

comment on function public.get_organization_entitlements(uuid) is
'Retourne les droits fonctionnels effectifs d''une organisation à partir de sa souscription courante. Les statuts trialing, active et past_due sont effectifs. pending_payment est ignoré. Repli sur la formule free si aucune souscription courante n''existe.';


create or replace function public.organization_has_feature(
  target_organization_id uuid,
  target_feature_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  normalized_feature_key text;
  entitlements jsonb;
  feature_value jsonb;
begin
  normalized_feature_key := lower(
    btrim(
      coalesce(target_feature_key, '')
    )
  );

  if normalized_feature_key = '' then
    raise exception 'Feature key is required';
  end if;

  entitlements :=
    public.get_organization_entitlements(
      target_organization_id
    );

  feature_value :=
    entitlements
      -> 'features'
      -> normalized_feature_key;

  if feature_value is null then
    return false;
  end if;

  if jsonb_typeof(feature_value) <> 'boolean' then
    return false;
  end if;

  return (feature_value #>> '{}')::boolean;
end;
$function$;

revoke all
on function public.organization_has_feature(uuid, text)
from public;

revoke all
on function public.organization_has_feature(uuid, text)
from anon;

revoke all
on function public.organization_has_feature(uuid, text)
from authenticated;

grant execute
on function public.organization_has_feature(uuid, text)
to authenticated;

comment on function public.organization_has_feature(uuid, text) is
'Indique si la formule effective d''une organisation autorise une fonctionnalité booléenne donnée. Refus par défaut si la clé est absente ou non booléenne.';

notify pgrst, 'reload schema';
