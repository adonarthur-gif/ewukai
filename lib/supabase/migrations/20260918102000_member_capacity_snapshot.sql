-- ============================================================
-- EWUKAI
-- DROITS & QUOTAS V2
-- SNAPSHOT DE CAPACITE LISIBLE PAR L'INTERFACE
--
-- La V1 reste la protection forte en base.
-- Cette fonction est uniquement une lecture securisee pour l'UI.
-- Aucun verrou de ligne n'est pris pendant l'affichage.
-- ============================================================

create or replace function public.get_organization_member_capacity_snapshot(
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
  current_active_count bigint;
  remaining_count bigint;
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
    sp.id,
    sp.code,
    sp.name,
    sp.member_limit
  into
    selected_plan_id,
    selected_plan_code,
    selected_plan_name,
    selected_member_limit
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

  if selected_plan_id is null then
    select
      sp.id,
      sp.code,
      sp.name,
      sp.member_limit
    into
      selected_plan_id,
      selected_plan_code,
      selected_plan_name,
      selected_member_limit
    from public.subscription_plans as sp
    where lower(sp.code) = 'free'
    order by sp.created_at asc
    limit 1;
  end if;

  if selected_plan_id is null then
    raise exception 'Free subscription plan is not configured';
  end if;

  select count(*)::bigint
  into current_active_count
  from public.members as m
  where m.organization_id = target_organization_id
    and m.status::text = 'active';

  remaining_count :=
    case
      when selected_member_limit is null then null
      else greatest(
        selected_member_limit::bigint - current_active_count,
        0::bigint
      )
    end;

  return jsonb_build_object(
    'organization_id', target_organization_id,
    'plan_id', selected_plan_id,
    'plan_code', selected_plan_code,
    'plan_name', selected_plan_name,
    'member_limit', selected_member_limit,
    'active_member_count', current_active_count,
    'remaining_slots', remaining_count,
    'is_unlimited', selected_member_limit is null,
    'is_at_limit',
      case
        when selected_member_limit is null then false
        else current_active_count >= selected_member_limit::bigint
      end
  );
end;
$function$;

revoke all
on function public.get_organization_member_capacity_snapshot(uuid)
from public;

revoke all
on function public.get_organization_member_capacity_snapshot(uuid)
from anon;

revoke all
on function public.get_organization_member_capacity_snapshot(uuid)
from authenticated;

grant execute
on function public.get_organization_member_capacity_snapshot(uuid)
to authenticated;

notify pgrst, 'reload schema';
