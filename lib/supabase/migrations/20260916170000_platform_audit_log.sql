-- ============================================================
-- EWUKAI
-- JOURNAL D'AUDIT PLATEFORME
-- ============================================================
-- Objectifs :
-- - conserver une trace immuable des opérations métier ;
-- - enregistrer l'organisation, l'auteur, le rôle et la date ;
-- - conserver les valeurs AVANT / APRES ;
-- - masquer les secrets et identifiants sensibles ;
-- - permettre la consultation uniquement au Super Admin ;
-- - journaliser aussi les opérations système automatiques.
-- ============================================================

create schema if not exists private;

-- ============================================================
-- 1. TABLE IMMUTABLE DU JOURNAL
-- ============================================================

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid,
  organization_name text,

  actor_user_id uuid,
  actor_name text,
  actor_email text,
  actor_role text,
  actor_type text not null default 'user',

  module text not null,
  action text not null,

  entity_type text not null,
  entity_id text,
  source_table text not null,

  changed_fields text[] not null default '{}'::text[],

  before_data jsonb,
  after_data jsonb,

  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_created_at_idx
  on public.platform_audit_logs (created_at desc);

create index if not exists platform_audit_logs_organization_idx
  on public.platform_audit_logs (organization_id, created_at desc);

create index if not exists platform_audit_logs_actor_idx
  on public.platform_audit_logs (actor_user_id, created_at desc);

create index if not exists platform_audit_logs_module_idx
  on public.platform_audit_logs (module, created_at desc);

create index if not exists platform_audit_logs_action_idx
  on public.platform_audit_logs (action, created_at desc);

alter table public.platform_audit_logs
  enable row level security;

revoke all on table public.platform_audit_logs from public;
revoke all on table public.platform_audit_logs from anon;
revoke all on table public.platform_audit_logs from authenticated;

-- ============================================================
-- 2. PROTECTION : UNE TRACE NE SE MODIFIE PAS
-- ============================================================

create or replace function private.prevent_platform_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'Audit log entries are immutable';
end;
$function$;

drop trigger if exists prevent_platform_audit_mutation
  on public.platform_audit_logs;

create trigger prevent_platform_audit_mutation
before update or delete
on public.platform_audit_logs
for each row
execute function private.prevent_platform_audit_mutation();

-- ============================================================
-- 3. MASQUAGE DES DONNEES SENSIBLES
-- ============================================================

create or replace function private.audit_redact_json(
  input_value jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare
  result_value jsonb;
  current_key text;
  current_value jsonb;
begin
  if input_value is null then
    return null;
  end if;

  if jsonb_typeof(input_value) = 'object' then
    result_value := '{}'::jsonb;

    for current_key, current_value in
      select key, value
      from jsonb_each(input_value)
    loop
      if lower(current_key) ~ '(password|passwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key|credential|authorization|cookie|cvv|cvc|card[_-]?number|pan|encrypted.*key|encrypted.*secret)' then
        result_value := result_value || jsonb_build_object(
          current_key,
          '[PROTEGE]'
        );
      else
        result_value := result_value || jsonb_build_object(
          current_key,
          private.audit_redact_json(current_value)
        );
      end if;
    end loop;

    return result_value;
  end if;

  if jsonb_typeof(input_value) = 'array' then
    select coalesce(
      jsonb_agg(private.audit_redact_json(value)),
      '[]'::jsonb
    )
    into result_value
    from jsonb_array_elements(input_value);

    return result_value;
  end if;

  return input_value;
end;
$function$;

-- ============================================================
-- 4. LISTE DES CHAMPS REELLEMENT MODIFIES
-- ============================================================

create or replace function private.audit_changed_fields(
  before_value jsonb,
  after_value jsonb
)
returns text[]
language sql
immutable
set search_path = ''
as $function$
  with keys as (
    select key
    from jsonb_object_keys(coalesce(before_value, '{}'::jsonb)) as before_keys(key)

    union

    select key
    from jsonb_object_keys(coalesce(after_value, '{}'::jsonb)) as after_keys(key)
  )
  select coalesce(
    array_agg(key order by key)
      filter (
        where key not in ('updated_at')
          and coalesce(before_value, '{}'::jsonb) -> key
              is distinct from
              coalesce(after_value, '{}'::jsonb) -> key
      ),
    '{}'::text[]
  )
  from keys;
$function$;

-- ============================================================
-- 5. FONCTION GENERIQUE DE JOURNALISATION
-- ============================================================

create or replace function private.capture_organization_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_actor_id uuid;
  target_organization_id uuid;

  raw_before jsonb;
  raw_after jsonb;
  safe_before jsonb;
  safe_after jsonb;

  actor_name_value text;
  actor_email_value text;
  actor_role_value text;
  actor_type_value text := 'system';
  organization_name_value text;

  entity_id_value text;
  module_value text;
  action_value text;
  changed_fields_value text[];

  row_value jsonb;
begin
  raw_before := case
    when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old)
    else null
  end;

  raw_after := case
    when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new)
    else null
  end;

  row_value := coalesce(raw_after, raw_before, '{}'::jsonb);

  -- ----------------------------------------------------------
  -- ORGANISATION
  -- ----------------------------------------------------------

  if tg_table_name = 'organizations' then
    target_organization_id := nullif(row_value ->> 'id', '')::uuid;
    organization_name_value := nullif(row_value ->> 'name', '');

  elsif row_value ? 'organization_id' then
    target_organization_id := nullif(row_value ->> 'organization_id', '')::uuid;

  elsif tg_table_name = 'subscription_invoices'
        and row_value ? 'subscription_id' then
    select os.organization_id
    into target_organization_id
    from public.organization_subscriptions as os
    where os.id = nullif(row_value ->> 'subscription_id', '')::uuid;

  elsif tg_table_name = 'payment_allocations'
        and row_value ? 'payment_id' then
    select p.organization_id
    into target_organization_id
    from public.payments as p
    where p.id = nullif(row_value ->> 'payment_id', '')::uuid;

  elsif tg_table_name = 'member_access_invitations'
        and row_value ? 'member_id' then
    select m.organization_id
    into target_organization_id
    from public.members as m
    where m.id = nullif(row_value ->> 'member_id', '')::uuid;
  end if;

  if organization_name_value is null
     and target_organization_id is not null then
    select o.name
    into organization_name_value
    from public.organizations as o
    where o.id = target_organization_id;
  end if;

  -- ----------------------------------------------------------
  -- AUTEUR
  -- ----------------------------------------------------------

  current_actor_id := auth.uid();

  if current_actor_id is not null then
    actor_type_value := 'organization_user';

    if private.is_platform_super_admin(current_actor_id) then
      actor_type_value := 'super_admin';
      actor_role_value := 'super_admin';
    elsif target_organization_id is not null then
      select ou.role::text
      into actor_role_value
      from public.organization_users as ou
      where ou.organization_id = target_organization_id
        and ou.user_id = current_actor_id
      order by
        case ou.role::text
          when 'owner' then 1
          when 'president' then 2
          when 'treasurer' then 3
          when 'secretary' then 4
          when 'auditor' then 5
          when 'member' then 6
          else 99
        end
      limit 1;
    end if;

    select
      coalesce(
        nullif(btrim(p.full_name), ''),
        nullif(btrim(au.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(au.raw_user_meta_data ->> 'name'), ''),
        au.email::text
      ),
      au.email::text
    into
      actor_name_value,
      actor_email_value
    from auth.users as au
    left join public.profiles as p
      on p.id = au.id
    where au.id = current_actor_id;
  else
    actor_name_value := 'Système EWUKAI';
    actor_role_value := 'system';
    actor_type_value := 'system';
  end if;

  -- ----------------------------------------------------------
  -- MODULE
  -- ----------------------------------------------------------

  module_value := case
    when tg_table_name in (
      'organizations',
      'organization_public_profiles'
    ) then 'organisation'

    when tg_table_name in (
      'organization_users'
    ) then 'responsables'

    when tg_table_name in (
      'members',
      'membership_applications',
      'member_access_invitations'
    ) then 'membres'

    when tg_table_name in (
      'contribution_types',
      'contribution_calls',
      'contribution_obligations'
    ) then 'cotisations'

    when tg_table_name in (
      'payments',
      'payment_allocations',
      'member_payment_attempts'
    ) then 'paiements'

    when tg_table_name in (
      'treasury_accounts',
      'ledger_entries',
      'expenses',
      'cash_expenses'
    ) then 'tresorerie'

    when tg_table_name in (
      'organization_subscriptions',
      'subscription_invoices',
      'subscription_payment_attempts'
    ) then 'abonnements'

    when tg_table_name like '%payment%setting%'
      or tg_table_name like '%cinetpay%'
    then 'configuration_paiement'

    else tg_table_name
  end;

  action_value := lower(tg_op);
  entity_id_value := nullif(row_value ->> 'id', '');

  safe_before := private.audit_redact_json(raw_before);
  safe_after := private.audit_redact_json(raw_after);

  changed_fields_value := private.audit_changed_fields(
    safe_before,
    safe_after
  );

  insert into public.platform_audit_logs (
    organization_id,
    organization_name,
    actor_user_id,
    actor_name,
    actor_email,
    actor_role,
    actor_type,
    module,
    action,
    entity_type,
    entity_id,
    source_table,
    changed_fields,
    before_data,
    after_data,
    created_at
  )
  values (
    target_organization_id,
    organization_name_value,
    current_actor_id,
    actor_name_value,
    actor_email_value,
    actor_role_value,
    actor_type_value,
    module_value,
    action_value,
    tg_table_name,
    entity_id_value,
    tg_table_schema || '.' || tg_table_name,
    changed_fields_value,
    safe_before,
    safe_after,
    now()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

-- ============================================================
-- 6. ATTACHER AUTOMATIQUEMENT LE JOURNAL AUX TABLES
--    QUI PORTENT organization_id
-- ============================================================

do $block$
declare
  table_record record;
  trigger_name text;
begin
  for table_record in
    select c.table_schema, c.table_name
    from information_schema.columns as c
    join information_schema.tables as t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'organization_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'platform_audit_logs'
  loop
    trigger_name := 'audit_' || table_record.table_name;

    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_name,
      table_record.table_schema,
      table_record.table_name
    );

    execute format(
      'create trigger %I after insert or update or delete on %I.%I for each row execute function private.capture_organization_audit()',
      trigger_name,
      table_record.table_schema,
      table_record.table_name
    );
  end loop;
end;
$block$;

-- Organisations : la clé d'organisation est directement id.
drop trigger if exists audit_organizations
  on public.organizations;

create trigger audit_organizations
after insert or update or delete
on public.organizations
for each row
execute function private.capture_organization_audit();

-- ============================================================
-- 7. TABLES ENFANTS SANS organization_id DIRECT
-- ============================================================

do $block$
declare
  target_table text;
  trigger_name text;
begin
  foreach target_table in array array[
    'subscription_invoices',
    'payment_allocations',
    'member_access_invitations'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      trigger_name := 'audit_' || target_table;

      execute format(
        'drop trigger if exists %I on public.%I',
        trigger_name,
        target_table
      );

      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function private.capture_organization_audit()',
        trigger_name,
        target_table
      );
    end if;
  end loop;
end;
$block$;

-- ============================================================
-- 8. RPC SUPER ADMIN : LISTE DU JOURNAL
-- ============================================================

create or replace function public.list_platform_audit_logs(
  search_text text default null,
  organization_id_filter uuid default null,
  module_filter text default null,
  action_filter text default null,
  actor_user_id_filter uuid default null,
  from_date date default null,
  to_date date default null,
  limit_count integer default 50,
  offset_count integer default 0
)
returns table (
  audit_id uuid,
  organization_id uuid,
  organization_name text,
  actor_user_id uuid,
  actor_name text,
  actor_email text,
  actor_role text,
  actor_type text,
  module text,
  action text,
  entity_type text,
  entity_id text,
  source_table text,
  changed_fields text[],
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
  normalized_search text;
  normalized_module text;
  normalized_action text;
  safe_limit integer;
  safe_offset integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_platform_super_admin(current_user_id) then
    raise exception 'Platform super administrator required';
  end if;

  normalized_search := nullif(btrim(coalesce(search_text, '')), '');
  normalized_module := nullif(lower(btrim(coalesce(module_filter, ''))), '');
  normalized_action := nullif(lower(btrim(coalesce(action_filter, ''))), '');

  safe_limit := least(greatest(coalesce(limit_count, 50), 1), 200);
  safe_offset := greatest(coalesce(offset_count, 0), 0);

  return query
  select
    al.id,
    al.organization_id,
    al.organization_name,
    al.actor_user_id,
    al.actor_name,
    al.actor_email,
    al.actor_role,
    al.actor_type,
    al.module,
    al.action,
    al.entity_type,
    al.entity_id,
    al.source_table,
    al.changed_fields,
    al.before_data,
    al.after_data,
    al.created_at,
    count(*) over() as total_count
  from public.platform_audit_logs as al
  where
    (organization_id_filter is null or al.organization_id = organization_id_filter)
    and (actor_user_id_filter is null or al.actor_user_id = actor_user_id_filter)
    and (normalized_module is null or al.module = normalized_module)
    and (normalized_action is null or al.action = normalized_action)
    and (from_date is null or al.created_at >= from_date::timestamptz)
    and (to_date is null or al.created_at < (to_date + 1)::timestamptz)
    and (
      normalized_search is null
      or coalesce(al.organization_name, '') ilike '%' || normalized_search || '%'
      or coalesce(al.actor_name, '') ilike '%' || normalized_search || '%'
      or coalesce(al.actor_email, '') ilike '%' || normalized_search || '%'
      or coalesce(al.actor_role, '') ilike '%' || normalized_search || '%'
      or coalesce(al.module, '') ilike '%' || normalized_search || '%'
      or coalesce(al.action, '') ilike '%' || normalized_search || '%'
      or coalesce(al.entity_type, '') ilike '%' || normalized_search || '%'
      or coalesce(al.entity_id, '') ilike '%' || normalized_search || '%'
      or coalesce(al.source_table, '') ilike '%' || normalized_search || '%'
    )
  order by al.created_at desc, al.id desc
  limit safe_limit
  offset safe_offset;
end;
$function$;

revoke all on function public.list_platform_audit_logs(
  text,
  uuid,
  text,
  text,
  uuid,
  date,
  date,
  integer,
  integer
) from public;

revoke all on function public.list_platform_audit_logs(
  text,
  uuid,
  text,
  text,
  uuid,
  date,
  date,
  integer,
  integer
) from anon;

revoke all on function public.list_platform_audit_logs(
  text,
  uuid,
  text,
  text,
  uuid,
  date,
  date,
  integer,
  integer
) from authenticated;

grant execute on function public.list_platform_audit_logs(
  text,
  uuid,
  text,
  text,
  uuid,
  date,
  date,
  integer,
  integer
) to authenticated;

-- ============================================================
-- 9. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst, 'reload schema';
