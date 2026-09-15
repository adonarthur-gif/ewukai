-- ============================================================
-- AFRI CLUB
-- RECOUVREMENT DES ABONNEMENTS - SUPER ADMIN
--
-- Objectif :
-- - exposer en lecture les factures Afri Club encore ouvertes ;
-- - calculer le reste à recouvrer côté serveur ;
-- - distinguer "à payer" et "en retard" ;
-- - alimenter /admin/subscriptions et, plus tard, /admin/recouvrement ;
-- - ne JAMAIS valider manuellement un paiement.
-- ============================================================

create or replace function public.list_platform_subscription_collection()
returns table (
  organization_id uuid,
  organization_name text,
  organization_short_name text,
  invoice_id uuid,
  invoice_number text,
  plan_code text,
  plan_name text,
  stored_status text,
  effective_status text,
  currency text,
  total_xof bigint,
  amount_paid_xof bigint,
  amount_remaining_xof bigint,
  issued_at timestamptz,
  due_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_platform_super_admin(
    current_user_id
  ) then
    raise exception 'Platform super administrator required';
  end if;

  return query
  select
    o.id as organization_id,
    o.name::text as organization_name,
    o.short_name::text as organization_short_name,
    si.id as invoice_id,
    si.invoice_number::text as invoice_number,
    sp.code::text as plan_code,
    sp.name::text as plan_name,
    si.status::text as stored_status,
    case
      when si.status::text = 'open'
           and si.due_at is not null
           and si.due_at < now()
      then 'overdue'
      else si.status::text
    end::text as effective_status,
    upper(coalesce(si.currency, 'XOF'))::text as currency,
    coalesce(si.total_xof, 0)::bigint as total_xof,
    coalesce(si.amount_paid_xof, 0)::bigint as amount_paid_xof,
    greatest(
      coalesce(si.total_xof, 0)
      - coalesce(si.amount_paid_xof, 0),
      0
    )::bigint as amount_remaining_xof,
    si.issued_at,
    si.due_at
  from public.subscription_invoices as si
  join public.organization_subscriptions as os
    on os.id = si.subscription_id
  join public.organizations as o
    on o.id = os.organization_id
  left join public.subscription_plans as sp
    on sp.id = os.plan_id
  where
    si.status::text = 'open'
    and greatest(
      coalesce(si.total_xof, 0)
      - coalesce(si.amount_paid_xof, 0),
      0
    ) > 0
  order by
    case
      when si.due_at is not null
           and si.due_at < now()
      then 0
      else 1
    end asc,
    si.due_at asc nulls last,
    si.issued_at asc nulls last,
    si.created_at asc;
end;
$function$;

revoke all
on function public.list_platform_subscription_collection()
from public;

revoke all
on function public.list_platform_subscription_collection()
from anon;

revoke all
on function public.list_platform_subscription_collection()
from authenticated;

grant execute
on function public.list_platform_subscription_collection()
to authenticated;

notify pgrst, 'reload schema';
