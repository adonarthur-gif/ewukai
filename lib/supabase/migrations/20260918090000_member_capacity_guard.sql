-- ============================================================
-- EWUKAI
-- DROITS & QUOTAS V1
-- GARDE-FOU CENTRAL DE CAPACITE DES MEMBRES ACTIFS
--
-- Regles :
-- - seuls les membres avec status = active consomment une place ;
-- - inactive ne consomme aucune place ;
-- - le plafond vient de subscription_plans.member_limit ;
-- - un member_limit NULL signifie capacite non plafonnee ;
-- - le controle est effectue en base pour couvrir TOUS les flux :
--   creation, approbation d'adhesion, reactivation, import, RPC, etc. ;
-- - aucune modification des paiements, factures ou references AFC.
-- ============================================================


-- ============================================================
-- 1. RESOUDRE LE PLAN EFFECTIF ET LA CAPACITE
-- ============================================================

create or replace function private.get_organization_member_capacity(
  target_organization_id uuid
)
returns table (
  plan_id uuid,
  plan_code text,
  plan_name text,
  member_limit integer,
  active_member_count bigint,
  remaining_slots bigint,
  is_unlimited boolean,
  is_at_limit boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  selected_plan_id uuid;
  selected_plan_code text;
  selected_plan_name text;
  selected_member_limit integer;
  current_active_count bigint;
begin
  if target_organization_id is null then
    raise exception
      'Organization id is required';
  end if;

  -- Verrouille l'organisation afin de serialiser les ajouts/reactivations
  -- concurrents et d'empecher deux operations de depasser le plafond.
  perform o.id
  from public.organizations as o
  where o.id = target_organization_id
  for update;

  if not found then
    raise exception
      'Organization not found';
  end if;

  -- Abonnement courant : l'index partiel EWUKAI garantit au maximum
  -- une ligne trialing/active/past_due par organisation.
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
  where
    os.organization_id = target_organization_id
    and os.status in (
      'trialing',
      'active',
      'past_due'
    )
  limit 1;

  -- Filet de securite : si une organisation ancienne n'a pas encore
  -- d'abonnement courant, elle est traitee selon le plan Gratuit.
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
    where
      lower(sp.code) = 'free'
    order by sp.created_at asc
    limit 1;
  end if;

  if selected_plan_id is null then
    raise exception
      'Free subscription plan is not configured';
  end if;

  select count(*)::bigint
  into current_active_count
  from public.members as m
  where
    m.organization_id = target_organization_id
    and m.status::text = 'active';

  return query
  select
    selected_plan_id,
    selected_plan_code,
    selected_plan_name,
    selected_member_limit,
    current_active_count,
    case
      when selected_member_limit is null then null::bigint
      else greatest(
        selected_member_limit::bigint - current_active_count,
        0::bigint
      )
    end as remaining_slots,
    selected_member_limit is null as is_unlimited,
    case
      when selected_member_limit is null then false
      else current_active_count >= selected_member_limit::bigint
    end as is_at_limit;
end;
$function$;


revoke all
on function private.get_organization_member_capacity(uuid)
from public;

revoke all
on function private.get_organization_member_capacity(uuid)
from anon;

revoke all
on function private.get_organization_member_capacity(uuid)
from authenticated;


-- ============================================================
-- 2. TRIGGER CENTRAL DE CONTROLE
-- ============================================================

create or replace function private.enforce_member_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  capacity_record record;
  active_without_current bigint;
begin
  -- Un membre inactif ne consomme aucune place.
  if new.status::text <> 'active' then
    return new;
  end if;

  -- Une simple modification d'un membre deja actif dans la meme
  -- organisation ne consomme pas de nouvelle place.
  if tg_op = 'UPDATE'
     and old.status::text = 'active'
     and old.organization_id = new.organization_id then
    return new;
  end if;

  -- Cette fonction verrouille aussi la ligne organisation.
  select *
  into capacity_record
  from private.get_organization_member_capacity(
    new.organization_id
  );

  -- Entreprise / capacite non plafonnee.
  if capacity_record.member_limit is null then
    return new;
  end if;

  -- Pour UPDATE inactive -> active, ou changement d'organisation,
  -- on exclut la fiche en cours du comptage afin de ne compter
  -- que les autres membres deja actifs de l'organisation cible.
  select count(*)::bigint
  into active_without_current
  from public.members as m
  where
    m.organization_id = new.organization_id
    and m.status::text = 'active'
    and (
      tg_op = 'INSERT'
      or m.id <> new.id
    );

  if active_without_current >= capacity_record.member_limit::bigint then
    raise exception using
      errcode = 'P0001',
      message = format(
        'MEMBER_CAPACITY_REACHED: La formule %s autorise au maximum %s membres actifs. Passez a une formule superieure pour ajouter ou reactiver un membre.',
        coalesce(capacity_record.plan_name, capacity_record.plan_code, 'actuelle'),
        capacity_record.member_limit
      ),
      detail = format(
        'organization_id=%s; plan_code=%s; active_members=%s; member_limit=%s',
        new.organization_id,
        capacity_record.plan_code,
        active_without_current,
        capacity_record.member_limit
      );
  end if;

  return new;
end;
$function$;


revoke all
on function private.enforce_member_capacity()
from public;

revoke all
on function private.enforce_member_capacity()
from anon;

revoke all
on function private.enforce_member_capacity()
from authenticated;


-- ============================================================
-- 3. INSTALLER LE GARDE-FOU SUR public.members
-- ============================================================

drop trigger if exists
  enforce_member_capacity_before_write
on public.members;

create trigger enforce_member_capacity_before_write
before insert or update of status, organization_id
on public.members
for each row
execute function private.enforce_member_capacity();


-- ============================================================
-- 4. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst, 'reload schema';
