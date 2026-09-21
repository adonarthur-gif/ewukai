-- ============================================================================
-- EWUKAI - Verrouillage lecture Trésorerie V1
-- Migration : 20260921130000_treasury_read_entitlement_enforcement.sql
--
-- Objectif :
--   1) Bloquer la lecture directe des données de trésorerie pour une
--      organisation dont features.treasury = false.
--   2) Conserver les rôles actuels de lecture.
--   3) Retirer les privilèges SELECT / EXECUTE au rôle anon.
--   4) Conserver les accès nécessaires au rôle authenticated.
--
-- Important :
--   - Les données existantes ne sont ni supprimées ni modifiées.
--   - Les RPC de lecture sont SECURITY INVOKER (comportement PostgreSQL par
--     défaut) : ils restent donc soumis aux politiques RLS des tables lues.
--   - La formule pending_payment ne donne aucun droit, conformément au moteur
--     d'entitlements déjà installé.
-- ============================================================================


-- ============================================================================
-- 1. POLITIQUES RLS DE LECTURE
-- ============================================================================

drop policy if exists
  cash_expenses_select
on public.cash_expenses;

create policy cash_expenses_select
on public.cash_expenses
for select
to authenticated
using (
  private.has_organization_role(
    organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role,
      'auditor'::public.organization_role
    ]
  )
  and public.organization_has_feature(
    organization_id,
    'treasury'
  )
);


drop policy if exists
  ledger_select_financial_roles
on public.ledger_entries;

create policy ledger_select_financial_roles
on public.ledger_entries
for select
to authenticated
using (
  private.has_organization_role(
    organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role,
      'auditor'::public.organization_role
    ]
  )
  and public.organization_has_feature(
    organization_id,
    'treasury'
  )
);


drop policy if exists
  treasury_accounts_select
on public.treasury_accounts;

create policy treasury_accounts_select
on public.treasury_accounts
for select
to authenticated
using (
  private.has_organization_role(
    organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role,
      'secretary'::public.organization_role,
      'auditor'::public.organization_role
    ]
  )
  and public.organization_has_feature(
    organization_id,
    'treasury'
  )
);


-- ============================================================================
-- 2. PRIVILEGES SELECT DES TABLES
--
-- On retire d'abord les droits héritables depuis PUBLIC et anon, puis on
-- réaccorde SELECT uniquement à authenticated.
-- ============================================================================

revoke select
on table
  public.cash_expenses,
  public.ledger_entries,
  public.treasury_accounts
from public;

revoke select
on table
  public.cash_expenses,
  public.ledger_entries,
  public.treasury_accounts
from anon;

revoke select
on table
  public.cash_expenses,
  public.ledger_entries,
  public.treasury_accounts
from authenticated;

grant select
on table
  public.cash_expenses,
  public.ledger_entries,
  public.treasury_accounts
to authenticated;


-- ============================================================================
-- 3. PRIVILEGES DES RPC DE LECTURE
--
-- Ciblage par regprocedure pour couvrir exactement les signatures existantes.
-- ============================================================================

do $block$
declare
  rpc_record record;
begin
  for rpc_record in
    select
      p.oid,
      p.oid::regprocedure as signature
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_cash_summary',
        'get_cash_year_summary',
        'get_cash_monthly_summary',
        'get_treasury_account_balances'
      )
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      rpc_record.signature
    );

    execute format(
      'grant execute on function %s to authenticated',
      rpc_record.signature
    );
  end loop;
end;
$block$;


-- ============================================================================
-- 4. VERIFICATIONS BLOQUANTES
-- ============================================================================

do $verify$
declare
  policy_missing_feature text;
  anon_table_access text;
  authenticated_table_missing text;
  anon_rpc_access text;
  authenticated_rpc_missing text;
begin
  -- ----------------------------------------------------------
  -- Chaque politique SELECT attendue doit contenir le contrôle
  -- organization_has_feature(..., 'treasury').
  -- ----------------------------------------------------------

  select string_agg(
           p.tablename || ':' || p.policyname,
           ', '
           order by p.tablename, p.policyname
         )
  into policy_missing_feature
  from pg_catalog.pg_policies as p
  where p.schemaname = 'public'
    and (
      (p.tablename = 'cash_expenses'
       and p.policyname = 'cash_expenses_select')
      or
      (p.tablename = 'ledger_entries'
       and p.policyname = 'ledger_select_financial_roles')
      or
      (p.tablename = 'treasury_accounts'
       and p.policyname = 'treasury_accounts_select')
    )
    and position(
      'organization_has_feature'
      in coalesce(p.qual, '')
    ) = 0;

  if policy_missing_feature is not null then
    raise exception
      'Treasury feature gate missing in RLS policy: %',
      policy_missing_feature;
  end if;


  -- ----------------------------------------------------------
  -- anon ne doit plus avoir SELECT sur les tables.
  -- ----------------------------------------------------------

  select string_agg(c.relname, ', ' order by c.relname)
  into anon_table_access
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'cash_expenses',
      'ledger_entries',
      'treasury_accounts'
    )
    and has_table_privilege(
      'anon',
      c.oid,
      'select'
    );

  if anon_table_access is not null then
    raise exception
      'Anon still has SELECT on treasury table(s): %',
      anon_table_access;
  end if;


  -- ----------------------------------------------------------
  -- authenticated doit conserver SELECT.
  -- ----------------------------------------------------------

  select string_agg(c.relname, ', ' order by c.relname)
  into authenticated_table_missing
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'cash_expenses',
      'ledger_entries',
      'treasury_accounts'
    )
    and not has_table_privilege(
      'authenticated',
      c.oid,
      'select'
    );

  if authenticated_table_missing is not null then
    raise exception
      'Authenticated SELECT missing on treasury table(s): %',
      authenticated_table_missing;
  end if;


  -- ----------------------------------------------------------
  -- anon ne doit plus pouvoir exécuter les RPC de lecture.
  -- ----------------------------------------------------------

  select string_agg(p.proname, ', ' order by p.proname)
  into anon_rpc_access
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_cash_summary',
      'get_cash_year_summary',
      'get_cash_monthly_summary',
      'get_treasury_account_balances'
    )
    and has_function_privilege(
      'anon',
      p.oid,
      'execute'
    );

  if anon_rpc_access is not null then
    raise exception
      'Anon still has EXECUTE on treasury read RPC(s): %',
      anon_rpc_access;
  end if;


  -- ----------------------------------------------------------
  -- authenticated doit conserver EXECUTE.
  -- ----------------------------------------------------------

  select string_agg(p.proname, ', ' order by p.proname)
  into authenticated_rpc_missing
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_cash_summary',
      'get_cash_year_summary',
      'get_cash_monthly_summary',
      'get_treasury_account_balances'
    )
    and not has_function_privilege(
      'authenticated',
      p.oid,
      'execute'
    );

  if authenticated_rpc_missing is not null then
    raise exception
      'Authenticated EXECUTE missing on treasury read RPC(s): %',
      authenticated_rpc_missing;
  end if;
end;
$verify$;


notify pgrst, 'reload schema';
