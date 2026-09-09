-- ============================================================
-- AFRI CLUB
-- Synchronisation automatique des cotisations régulières
-- lorsqu'un membre devient actif.
--
-- IMPORTANT :
-- - uniquement les périodes régulières DEJA générées ;
-- - aucune cotisation exceptionnelle rétroactive ;
-- - aucune création de doublons ;
-- - respect de la date d'adhésion.
-- ============================================================


-- ============================================================
-- 1. SYNCHRONISER UN MEMBRE
-- ============================================================

create or replace function
private.ensure_member_obligations_for_generated_periods(
  target_member_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$

declare

  member_org_id uuid;
  member_joined_at date;

  inserted_count integer := 0;

begin

  -- ----------------------------------------------------------
  -- MEMBRE ACTIF
  -- ----------------------------------------------------------

  select
    m.organization_id,
    m.joined_at
  into
    member_org_id,
    member_joined_at
  from public.members m
  where
    m.id = target_member_id
    and m.status = 'active';


  if member_org_id is null then
    return 0;
  end if;


  -- ----------------------------------------------------------
  -- PERIODES REGULIERES DEJA GENEREES
  --
  -- On utilise les obligations existantes comme référence.
  -- Ainsi on ne crée pas arbitrairement les mois futurs.
  -- ----------------------------------------------------------

  with generated_periods as (

    select

      o.contribution_type_id,

      o.period_start,

      min(
        o.due_date
      ) as due_date,

      min(
        o.amount_due
      )::bigint as amount_due

    from
      public.contribution_obligations o

    join
      public.contribution_types ct
        on ct.id =
          o.contribution_type_id

    where

      o.organization_id =
        member_org_id

      -- Cotisations régulières uniquement
      and o.contribution_call_id
        is null

      and o.contribution_type_id
        is not null

      -- Type toujours valable
      and ct.organization_id =
        member_org_id

      and ct.is_active =
        true

      and ct.is_mandatory =
        true

    group by

      o.contribution_type_id,
      o.period_start

    -- Sécurité :
    -- les membres déjà concernés doivent avoir
    -- la même échéance et le même montant.
    having

      count(
        distinct o.due_date
      ) = 1

      and

      count(
        distinct o.amount_due
      ) = 1
  )


  insert into
    public.contribution_obligations (
      organization_id,
      contribution_type_id,
      member_id,
      period_start,
      due_date,
      amount_due,
      status
    )

  select

    member_org_id,

    gp.contribution_type_id,

    target_member_id,

    gp.period_start,

    gp.due_date,

    gp.amount_due,

    'open'
      ::public.obligation_status

  from
    generated_periods gp

  join
    public.contribution_types ct
      on ct.id =
        gp.contribution_type_id

  where

    -- Le membre doit être adhérent
    -- au moment de l'échéance.
    member_joined_at <=
      gp.due_date

    -- Respect du début de la cotisation.
    and gp.due_date >=
      ct.start_date

    -- Respect de la date de fin.
    and (
      ct.end_date is null

      or

      gp.due_date <=
        ct.end_date
    )

  on conflict (
    organization_id,
    contribution_type_id,
    member_id,
    period_start
  )
  where contribution_call_id is null
  do nothing;


  get diagnostics
    inserted_count =
      row_count;


  return
    inserted_count;

end;

$function$;



-- ============================================================
-- 2. FONCTION TRIGGER
-- ============================================================

create or replace function
private.sync_member_regular_obligations_on_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$

begin

  -- ----------------------------------------------------------
  -- NOUVEAU MEMBRE DEJA ACTIF
  -- ----------------------------------------------------------

  if tg_op = 'INSERT' then

    if new.status = 'active' then

      perform
        private.ensure_member_obligations_for_generated_periods(
          new.id
        );

    end if;


  -- ----------------------------------------------------------
  -- MEMBRE QUI DEVIENT ACTIF
  -- ----------------------------------------------------------

  elsif tg_op = 'UPDATE' then

    if
      new.status = 'active'
      and old.status is distinct from
        new.status
    then

      perform
        private.ensure_member_obligations_for_generated_periods(
          new.id
        );

    end if;

  end if;


  return new;

end;

$function$;



-- ============================================================
-- 3. TRIGGER MEMBRES
-- ============================================================

drop trigger if exists
members_sync_regular_obligations
on public.members;


create trigger
members_sync_regular_obligations

after insert
or update of status
on public.members

for each row

execute function
private.sync_member_regular_obligations_on_activation();



-- ============================================================
-- 4. SECURITE
-- ============================================================

revoke all
on function
private.ensure_member_obligations_for_generated_periods(uuid)
from public;


revoke all
on function
private.sync_member_regular_obligations_on_activation()
from public;