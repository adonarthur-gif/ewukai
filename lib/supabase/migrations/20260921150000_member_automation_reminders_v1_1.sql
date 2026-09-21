-- ============================================================================
-- EWUKAI - Automatisation V1.1
-- Migration : 20260921150000_member_automation_reminders_v1_1.sql
--
-- Objet :
--   exposer au membre connecté uniquement ses propres relances encore actives,
--   sans ouvrir l'accès direct à automation_reminders.
-- ============================================================================

create or replace function public.list_my_automation_reminders(
  target_organization_id uuid,
  target_limit integer default 20
)
returns table (
  reminder_id uuid,
  obligation_id uuid,
  reminder_type text,
  due_date date,
  scheduled_for date,
  amount_remaining bigint,
  title text,
  message text,
  generated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
  current_member_id uuid;
  safe_limit integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization id is required';
  end if;

  select m.id
  into current_member_id
  from public.members as m
  where m.organization_id = target_organization_id
    and m.user_id = current_user_id
    and m.status = 'active'
  order by m.created_at asc
  limit 1;

  if current_member_id is null then
    raise exception 'Not authorized';
  end if;

  if not private.organization_feature_enabled(
    target_organization_id,
    'automation'
  ) then
    return;
  end if;

  safe_limit :=
    least(
      greatest(
        coalesce(target_limit, 20),
        1
      ),
      100
    );

  return query
  select
    ar.id as reminder_id,
    ar.obligation_id,
    ar.reminder_type,
    ar.due_date_snapshot as due_date,
    ar.scheduled_for,
    greatest(
      o.amount_due - coalesce(paid.amount_paid, 0),
      0
    )::bigint as amount_remaining,
    ar.title,
    ar.message,
    ar.generated_at
  from public.automation_reminders as ar
  join public.contribution_obligations as o
    on o.id = ar.obligation_id
   and o.organization_id = ar.organization_id
   and o.member_id = ar.member_id
  left join lateral (
    select
      coalesce(sum(pa.amount), 0)::bigint as amount_paid
    from public.payment_allocations as pa
    join public.payments as p
      on p.id = pa.payment_id
    where pa.obligation_id = o.id
      and p.status = 'confirmed'
  ) as paid
    on true
  where ar.organization_id = target_organization_id
    and ar.member_id = current_member_id
    and ar.status = 'generated'
    and o.status not in ('waived', 'cancelled')
    and greatest(
      o.amount_due - coalesce(paid.amount_paid, 0),
      0
    ) > 0
  order by
    ar.generated_at desc,
    ar.id desc
  limit safe_limit;
end;
$function$;

revoke execute
on function public.list_my_automation_reminders(uuid, integer)
from public;

revoke execute
on function public.list_my_automation_reminders(uuid, integer)
from anon;

revoke execute
on function public.list_my_automation_reminders(uuid, integer)
from authenticated;

grant execute
on function public.list_my_automation_reminders(uuid, integer)
to authenticated;

comment on function public.list_my_automation_reminders(uuid, integer) is
'Retourne uniquement les relances automatiques encore actives du membre authentifié pour une organisation où la fonctionnalité automation est effective.';

notify pgrst, 'reload schema';
