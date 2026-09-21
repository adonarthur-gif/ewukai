-- ============================================================================
-- EWUKAI - Automatisation V1
-- Migration : 20260921140000_automation_reminders_foundation_v1.sql
--
-- Périmètre de cette fondation :
--   - réservée aux organisations dont features.automation = true ;
--   - configuration des relances de cotisations ;
--   - génération idempotente des rappels avant échéance / jour J / retard ;
--   - historique interne des rappels générés ;
--   - cycle global prévu pour un ordonnanceur serveur (service_role) ;
--   - aucune intégration SMS / WhatsApp / e-mail dans cette V1.
--
-- Important :
--   - aucune dette, aucun paiement et aucune donnée membre existante n'est modifié ;
--   - pending_payment ne donne aucun droit ;
--   - trialing / active / past_due restent effectifs, comme le moteur
--     d'entitlements EWUKAI actuel.
-- ============================================================================


-- ============================================================================
-- 1. CONFIGURATION PAR ORGANISATION
-- ============================================================================

create table if not exists public.organization_automation_settings (
  organization_id uuid primary key
    references public.organizations(id)
    on delete cascade,

  contribution_reminders_enabled boolean
    not null
    default false,

  remind_before_days integer[]
    not null
    default array[3]::integer[],

  remind_on_due_date boolean
    not null
    default true,

  remind_after_days integer[]
    not null
    default array[1, 3, 7]::integer[],

  last_run_at timestamptz,
  last_run_date date,
  last_generated_count integer
    not null
    default 0,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  updated_by uuid
);


-- ============================================================================
-- 2. HISTORIQUE DES RAPPELS
-- ============================================================================

create table if not exists public.automation_reminders (
  id uuid primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete cascade,

  member_id uuid
    not null
    references public.members(id)
    on delete cascade,

  obligation_id uuid
    not null
    references public.contribution_obligations(id)
    on delete cascade,

  channel text
    not null
    default 'in_app'
    check (
      channel in ('in_app')
    ),

  reminder_type text
    not null
    check (
      reminder_type in (
        'before_due',
        'due_today',
        'overdue'
      )
    ),

  due_date_snapshot date
    not null,

  offset_days integer
    not null,

  scheduled_for date
    not null,

  amount_remaining_snapshot bigint
    not null
    check (
      amount_remaining_snapshot >= 0
    ),

  title text
    not null,

  message text
    not null,

  status text
    not null
    default 'generated'
    check (
      status in (
        'generated',
        'resolved',
        'cancelled'
      )
    ),

  generated_at timestamptz
    not null
    default now(),

  resolved_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  constraint automation_reminders_unique_event
    unique (
      organization_id,
      obligation_id,
      due_date_snapshot,
      offset_days,
      channel
    )
);


create index if not exists
  automation_reminders_org_generated_idx
on public.automation_reminders (
  organization_id,
  generated_at desc
);


create index if not exists
  automation_reminders_member_status_idx
on public.automation_reminders (
  member_id,
  status,
  scheduled_for desc
);


create index if not exists
  automation_reminders_obligation_idx
on public.automation_reminders (
  obligation_id
);


-- ============================================================================
-- 3. HELPER INTERNE : DROIT FONCTIONNEL EFFECTIF
--
-- Variante sans dépendance à auth.uid(), destinée aux traitements serveur.
-- Elle reproduit la logique du moteur d'entitlements :
-- trialing / active / past_due, sinon repli Gratuit.
-- ============================================================================

create or replace function private.organization_feature_enabled(
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
  normalized_key text;
  selected_features jsonb;
  feature_value jsonb;
begin
  normalized_key :=
    lower(
      btrim(
        coalesce(
          target_feature_key,
          ''
        )
      )
    );

  if target_organization_id is null
     or normalized_key = '' then
    return false;
  end if;

  select
    coalesce(
      sp.features,
      '{}'::jsonb
    )
  into
    selected_features
  from public.organization_subscriptions as os
  join public.subscription_plans as sp
    on sp.id = os.plan_id
  where os.organization_id =
        target_organization_id
    and os.status in (
      'trialing',
      'active',
      'past_due'
    )
  limit 1;

  if selected_features is null then
    select
      coalesce(
        sp.features,
        '{}'::jsonb
      )
    into
      selected_features
    from public.subscription_plans as sp
    where lower(sp.code) = 'free'
    order by sp.created_at asc
    limit 1;
  end if;

  if selected_features is null then
    return false;
  end if;

  feature_value :=
    selected_features
      -> normalized_key;

  if feature_value is null
     or jsonb_typeof(feature_value) <> 'boolean' then
    return false;
  end if;

  return
    (feature_value #>> '{}')::boolean;
end;
$function$;


revoke all
on function private.organization_feature_enabled(
  uuid,
  text
)
from public;

revoke all
on function private.organization_feature_enabled(
  uuid,
  text
)
from anon;

revoke all
on function private.organization_feature_enabled(
  uuid,
  text
)
from authenticated;


-- ============================================================================
-- 4. HELPER INTERNE : NORMALISER UNE LISTE DE JOURS
-- ============================================================================

create or replace function private.normalize_automation_days(
  target_days integer[],
  minimum_day integer,
  maximum_day integer,
  maximum_items integer
)
returns integer[]
language plpgsql
immutable
security definer
set search_path = ''
as $function$
declare
  normalized integer[];
begin
  if minimum_day is null
     or maximum_day is null
     or maximum_items is null
     or minimum_day < 0
     or maximum_day < minimum_day
     or maximum_items < 0 then
    raise exception
      'Invalid automation day constraints';
  end if;

  select
    coalesce(
      array_agg(
        value
        order by value
      ),
      '{}'::integer[]
    )
  into
    normalized
  from (
    select distinct
      d as value
    from unnest(
      coalesce(
        target_days,
        '{}'::integer[]
      )
    ) as d
    where d between
          minimum_day
          and maximum_day
  ) as clean;

  if cardinality(normalized) >
     maximum_items then
    raise exception
      'Too many reminder days';
  end if;

  return normalized;
end;
$function$;


revoke all
on function private.normalize_automation_days(
  integer[],
  integer,
  integer,
  integer
)
from public;

revoke all
on function private.normalize_automation_days(
  integer[],
  integer,
  integer,
  integer
)
from anon;

revoke all
on function private.normalize_automation_days(
  integer[],
  integer,
  integer,
  integer
)
from authenticated;


-- ============================================================================
-- 5. RLS
-- ============================================================================

alter table public.organization_automation_settings
  enable row level security;

alter table public.automation_reminders
  enable row level security;


drop policy if exists
  organization_automation_settings_select
on public.organization_automation_settings;

create policy organization_automation_settings_select
on public.organization_automation_settings
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
    'automation'
  )
);


drop policy if exists
  automation_reminders_select
on public.automation_reminders;

create policy automation_reminders_select
on public.automation_reminders
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
    'automation'
  )
);


-- Aucun INSERT / UPDATE / DELETE direct depuis le navigateur.
revoke all
on table public.organization_automation_settings
from public;

revoke all
on table public.organization_automation_settings
from anon;

revoke all
on table public.organization_automation_settings
from authenticated;

grant select
on table public.organization_automation_settings
to authenticated;


revoke all
on table public.automation_reminders
from public;

revoke all
on table public.automation_reminders
from anon;

revoke all
on table public.automation_reminders
from authenticated;

grant select
on table public.automation_reminders
to authenticated;


-- ============================================================================
-- 6. LECTURE DE LA CONFIGURATION
-- ============================================================================

create or replace function public.get_organization_automation_settings(
  target_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  settings_record record;
begin
  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception
      'Organization id is required';
  end if;

  if not private.has_organization_role(
    target_organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role,
      'secretary'::public.organization_role,
      'auditor'::public.organization_role
    ]
  ) then
    raise exception
      'Not authorized';
  end if;

  if not public.organization_has_feature(
    target_organization_id,
    'automation'
  ) then
    raise exception
      'Feature not available: automation';
  end if;

  select
    s.*
  into
    settings_record
  from public.organization_automation_settings as s
  where s.organization_id =
        target_organization_id;

  return jsonb_build_object(
    'organization_id',
      target_organization_id,

    'contribution_reminders_enabled',
      coalesce(
        settings_record.contribution_reminders_enabled,
        false
      ),

    'remind_before_days',
      coalesce(
        settings_record.remind_before_days,
        array[3]::integer[]
      ),

    'remind_on_due_date',
      coalesce(
        settings_record.remind_on_due_date,
        true
      ),

    'remind_after_days',
      coalesce(
        settings_record.remind_after_days,
        array[1, 3, 7]::integer[]
      ),

    'last_run_at',
      settings_record.last_run_at,

    'last_run_date',
      settings_record.last_run_date,

    'last_generated_count',
      coalesce(
        settings_record.last_generated_count,
        0
      )
  );
end;
$function$;


-- ============================================================================
-- 7. ENREGISTRER LA CONFIGURATION
-- ============================================================================

create or replace function public.save_organization_automation_settings(
  target_organization_id uuid,
  target_enabled boolean,
  target_remind_before_days integer[],
  target_remind_on_due_date boolean,
  target_remind_after_days integer[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_before integer[];
  normalized_after integer[];
begin
  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception
      'Organization id is required';
  end if;

  if not private.has_organization_role(
    target_organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role
    ]
  ) then
    raise exception
      'Not authorized';
  end if;

  if not public.organization_has_feature(
    target_organization_id,
    'automation'
  ) then
    raise exception
      'Feature not available: automation';
  end if;

  normalized_before :=
    private.normalize_automation_days(
      target_remind_before_days,
      1,
      30,
      5
    );

  normalized_after :=
    private.normalize_automation_days(
      target_remind_after_days,
      1,
      90,
      8
    );

  insert into public.organization_automation_settings (
    organization_id,
    contribution_reminders_enabled,
    remind_before_days,
    remind_on_due_date,
    remind_after_days,
    updated_at,
    updated_by
  )
  values (
    target_organization_id,
    coalesce(
      target_enabled,
      false
    ),
    normalized_before,
    coalesce(
      target_remind_on_due_date,
      true
    ),
    normalized_after,
    now(),
    auth.uid()
  )
  on conflict (
    organization_id
  )
  do update
  set
    contribution_reminders_enabled =
      excluded.contribution_reminders_enabled,

    remind_before_days =
      excluded.remind_before_days,

    remind_on_due_date =
      excluded.remind_on_due_date,

    remind_after_days =
      excluded.remind_after_days,

    updated_at =
      now(),

    updated_by =
      auth.uid();

  return
    public.get_organization_automation_settings(
      target_organization_id
    );
end;
$function$;


-- ============================================================================
-- 8. GÉNÉRATION INTERNE DES RAPPELS
-- ============================================================================

create or replace function private.generate_organization_contribution_reminders(
  target_organization_id uuid,
  target_run_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  settings_record record;
  reminder_record record;
  generated_count integer := 0;
  inserted_count integer := 0;
  target_offset integer;
  target_type text;
  target_title text;
  target_message text;
begin
  if target_organization_id is null
     or target_run_date is null then
    raise exception
      'Organization and run date are required';
  end if;

  if not private.organization_feature_enabled(
    target_organization_id,
    'automation'
  ) then
    return 0;
  end if;

  select
    s.*
  into
    settings_record
  from public.organization_automation_settings as s
  where s.organization_id =
        target_organization_id
  for update;

  if settings_record.organization_id is null
     or not coalesce(
       settings_record.contribution_reminders_enabled,
       false
     ) then
    return 0;
  end if;


  -- --------------------------------------------------------------------------
  -- Résoudre automatiquement les rappels dont l'échéance est désormais soldée,
  -- annulée, exonérée ou rattachée à un membre inactif.
  -- --------------------------------------------------------------------------

  update public.automation_reminders as ar
  set
    status = 'resolved',
    resolved_at = coalesce(
      ar.resolved_at,
      now()
    )
  where ar.organization_id =
        target_organization_id
    and ar.status = 'generated'
    and not exists (
      select 1
      from public.contribution_obligations as o
      join public.members as m
        on m.id = o.member_id
       and m.organization_id =
           o.organization_id

      left join lateral (
        select
          coalesce(
            sum(pa.amount),
            0
          )::bigint
            as amount_paid
        from public.payment_allocations as pa
        join public.payments as p
          on p.id = pa.payment_id
        where pa.obligation_id =
              o.id
          and p.status =
              'confirmed'
      ) as paid
        on true

      where o.id =
            ar.obligation_id
        and o.organization_id =
            target_organization_id
        and m.status =
            'active'
        and o.status not in (
          'waived',
          'cancelled'
        )
        and greatest(
          o.amount_due
          -
          coalesce(
            paid.amount_paid,
            0
          ),
          0
        ) > 0
    );


  -- --------------------------------------------------------------------------
  -- Échéances restant réellement dues.
  -- --------------------------------------------------------------------------

  for reminder_record in

    select
      o.id
        as obligation_id,

      o.member_id,

      m.member_number,

      m.first_name,

      m.last_name,

      o.due_date,

      greatest(
        o.amount_due
        -
        coalesce(
          paid.amount_paid,
          0
        ),
        0
      )::bigint
        as amount_remaining

    from public.contribution_obligations as o

    join public.members as m
      on m.id =
         o.member_id
     and m.organization_id =
         o.organization_id

    left join lateral (
      select
        coalesce(
          sum(pa.amount),
          0
        )::bigint
          as amount_paid

      from public.payment_allocations as pa

      join public.payments as p
        on p.id =
           pa.payment_id

      where pa.obligation_id =
            o.id

        and p.status =
            'confirmed'
    ) as paid
      on true

    where o.organization_id =
          target_organization_id

      and m.status =
          'active'

      and o.status not in (
        'waived',
        'cancelled'
      )

      and greatest(
        o.amount_due
        -
        coalesce(
          paid.amount_paid,
          0
        ),
        0
      ) > 0

      and (
        (
          o.due_date >
          target_run_date

          and (
            o.due_date -
            target_run_date
          ) = any(
            coalesce(
              settings_record.remind_before_days,
              '{}'::integer[]
            )
          )
        )

        or (
          o.due_date =
          target_run_date

          and coalesce(
            settings_record.remind_on_due_date,
            true
          )
        )

        or (
          o.due_date <
          target_run_date

          and (
            target_run_date -
            o.due_date
          ) = any(
            coalesce(
              settings_record.remind_after_days,
              '{}'::integer[]
            )
          )
        )
      )

  loop

    if reminder_record.due_date >
       target_run_date then

      target_offset :=
        -(
          reminder_record.due_date -
          target_run_date
        );

      target_type :=
        'before_due';

      target_title :=
        'Échéance de cotisation à venir';

      target_message :=
        format(
          'Rappel : votre cotisation arrive à échéance le %s. Solde restant : %s FCFA.',
          to_char(
            reminder_record.due_date,
            'DD/MM/YYYY'
          ),
          to_char(
            reminder_record.amount_remaining,
            'FM999G999G999G999'
          )
        );

    elsif reminder_record.due_date =
          target_run_date then

      target_offset := 0;

      target_type :=
        'due_today';

      target_title :=
        'Cotisation à régler aujourd''hui';

      target_message :=
        format(
          'Votre cotisation arrive à échéance aujourd''hui. Solde restant : %s FCFA.',
          to_char(
            reminder_record.amount_remaining,
            'FM999G999G999G999'
          )
        );

    else

      target_offset :=
        target_run_date -
        reminder_record.due_date;

      target_type :=
        'overdue';

      target_title :=
        'Cotisation en retard';

      target_message :=
        format(
          'Votre cotisation échue le %s présente encore un solde de %s FCFA.',
          to_char(
            reminder_record.due_date,
            'DD/MM/YYYY'
          ),
          to_char(
            reminder_record.amount_remaining,
            'FM999G999G999G999'
          )
        );

    end if;


    insert into public.automation_reminders (
      organization_id,
      member_id,
      obligation_id,
      channel,
      reminder_type,
      due_date_snapshot,
      offset_days,
      scheduled_for,
      amount_remaining_snapshot,
      title,
      message,
      status
    )
    values (
      target_organization_id,
      reminder_record.member_id,
      reminder_record.obligation_id,
      'in_app',
      target_type,
      reminder_record.due_date,
      target_offset,
      target_run_date,
      reminder_record.amount_remaining,
      target_title,
      target_message,
      'generated'
    )
    on conflict (
      organization_id,
      obligation_id,
      due_date_snapshot,
      offset_days,
      channel
    )
    do nothing;

    get diagnostics
      inserted_count =
        row_count;

    generated_count :=
      generated_count +
      inserted_count;

  end loop;


  update public.organization_automation_settings
  set
    last_run_at =
      now(),

    last_run_date =
      target_run_date,

    last_generated_count =
      generated_count,

    updated_at =
      now()

  where organization_id =
        target_organization_id;


  return generated_count;
end;
$function$;


revoke all
on function private.generate_organization_contribution_reminders(
  uuid,
  date
)
from public;

revoke all
on function private.generate_organization_contribution_reminders(
  uuid,
  date
)
from anon;

revoke all
on function private.generate_organization_contribution_reminders(
  uuid,
  date
)
from authenticated;


-- ============================================================================
-- 9. EXÉCUTION MANUELLE SÉCURISÉE POUR UNE ORGANISATION
--
-- Utile pour tester le moteur et pour un bouton "Exécuter maintenant".
-- ============================================================================

create or replace function public.generate_organization_automation_reminders(
  target_organization_id uuid,
  target_run_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  generated_count integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception
      'Organization id is required';
  end if;

  if not private.has_organization_role(
    target_organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role
    ]
  ) then
    raise exception
      'Not authorized';
  end if;

  if not public.organization_has_feature(
    target_organization_id,
    'automation'
  ) then
    raise exception
      'Feature not available: automation';
  end if;

  generated_count :=
    private.generate_organization_contribution_reminders(
      target_organization_id,
      coalesce(
        target_run_date,
        current_date
      )
    );

  return jsonb_build_object(
    'organization_id',
      target_organization_id,

    'run_date',
      coalesce(
        target_run_date,
        current_date
      ),

    'generated_count',
      generated_count
  );
end;
$function$;


-- ============================================================================
-- 10. HISTORIQUE POUR L'ESPACE DIRIGEANT
-- ============================================================================

create or replace function public.list_organization_automation_reminders(
  target_organization_id uuid,
  target_limit integer default 100
)
returns table (
  reminder_id uuid,
  member_id uuid,
  member_number text,
  member_name text,
  obligation_id uuid,
  reminder_type text,
  due_date date,
  offset_days integer,
  scheduled_for date,
  amount_remaining bigint,
  status text,
  title text,
  message text,
  generated_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  safe_limit integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception
      'Organization id is required';
  end if;

  if not private.has_organization_role(
    target_organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role,
      'secretary'::public.organization_role,
      'auditor'::public.organization_role
    ]
  ) then
    raise exception
      'Not authorized';
  end if;

  if not public.organization_has_feature(
    target_organization_id,
    'automation'
  ) then
    raise exception
      'Feature not available: automation';
  end if;

  safe_limit :=
    least(
      greatest(
        coalesce(
          target_limit,
          100
        ),
        1
      ),
      500
    );

  return query

  select
    ar.id,
    ar.member_id,
    m.member_number,
    concat_ws(
      ' ',
      m.first_name,
      m.last_name
    )::text,
    ar.obligation_id,
    ar.reminder_type,
    ar.due_date_snapshot,
    ar.offset_days,
    ar.scheduled_for,
    ar.amount_remaining_snapshot,
    ar.status,
    ar.title,
    ar.message,
    ar.generated_at,
    ar.resolved_at

  from public.automation_reminders as ar

  join public.members as m
    on m.id =
       ar.member_id
   and m.organization_id =
       ar.organization_id

  where ar.organization_id =
        target_organization_id

  order by
    ar.generated_at desc,
    ar.id desc

  limit safe_limit;
end;
$function$;


-- ============================================================================
-- 11. CYCLE GLOBAL POUR ORDONNANCEUR SERVEUR
--
-- Cette fonction n'est PAS accessible aux utilisateurs.
-- Elle sera appelée ensuite par un cron serveur EWUKAI.
-- ============================================================================

create or replace function public.run_automation_cycle(
  target_run_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  settings_record record;
  organization_generated integer;
  organization_count integer := 0;
  generated_count integer := 0;
  run_date_value date :=
    coalesce(
      target_run_date,
      current_date
    );
begin
  for settings_record in

    select
      s.organization_id

    from public.organization_automation_settings as s

    where s.contribution_reminders_enabled =
          true

      and private.organization_feature_enabled(
        s.organization_id,
        'automation'
      )

  loop

    organization_generated :=
      private.generate_organization_contribution_reminders(
        settings_record.organization_id,
        run_date_value
      );

    organization_count :=
      organization_count + 1;

    generated_count :=
      generated_count +
      organization_generated;

  end loop;

  return jsonb_build_object(
    'run_date',
      run_date_value,

    'organization_count',
      organization_count,

    'generated_count',
      generated_count,

    'completed_at',
      now()
  );
end;
$function$;


-- ============================================================================
-- 12. PRIVILÈGES DES RPC
-- ============================================================================

do $block$
declare
  rpc_record record;
begin
  for rpc_record in
    select
      p.oid,
      p.oid::regprocedure
        as signature
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_organization_automation_settings',
        'save_organization_automation_settings',
        'generate_organization_automation_reminders',
        'list_organization_automation_reminders'
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


revoke all
on function public.run_automation_cycle(date)
from public;

revoke all
on function public.run_automation_cycle(date)
from anon;

revoke all
on function public.run_automation_cycle(date)
from authenticated;

grant execute
on function public.run_automation_cycle(date)
to service_role;


-- ============================================================================
-- 13. COMMENTAIRES
-- ============================================================================

comment on table public.organization_automation_settings is
'Configuration des automatisations d''une organisation EWUKAI. V1 : relances de cotisations.';

comment on table public.automation_reminders is
'Historique idempotent des rappels de cotisations générés automatiquement par EWUKAI.';

comment on function public.run_automation_cycle(date) is
'Cycle global des automatisations EWUKAI, exécutable uniquement par service_role.';


notify pgrst, 'reload schema';
