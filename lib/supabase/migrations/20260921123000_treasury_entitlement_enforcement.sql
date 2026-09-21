-- ============================================================================
-- EWUKAI - Verrouillage SQL Trésorerie V1
-- Migration : 20260921123000_treasury_entitlement_enforcement.sql
--
-- Objectif :
--   - imposer features.treasury = true à l'intérieur des RPC d'écriture ;
--   - supprimer l'exécution anonyme ;
--   - conserver l'exécution pour les utilisateurs authentifiés ;
--   - ne supprimer ni modifier aucune donnée existante.
--
-- Prérequis :
--   public.organization_has_feature(uuid, text)
--   créé par 20260921090000_subscription_entitlements_v1.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_treasury_account(target_organization_id uuid, account_label text, account_payment_method payment_method, account_holder text, account_phone_number text DEFAULT NULL::text, account_bank_name text DEFAULT NULL::text, account_number text DEFAULT NULL::text, account_iban text DEFAULT NULL::text, account_payment_instructions text DEFAULT NULL::text, account_can_receive boolean DEFAULT true, account_can_spend boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

  new_account_id uuid;

begin

  -- ==========================================================
  -- AUTORISATION
  -- ==========================================================

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

  -- ==========================================================
  -- DROIT FONCTIONNEL : TRESORERIE
  -- ==========================================================

  if not public.organization_has_feature(
    target_organization_id,
    'treasury'
  ) then

    raise exception
      'Feature not available: treasury';

  end if;


  -- ==========================================================
  -- VALIDATIONS
  -- ==========================================================

  if nullif(
    btrim(account_label),
    ''
  ) is null then

    raise exception
      'Account label is required';

  end if;


  if nullif(
    btrim(account_holder),
    ''
  ) is null then

    raise exception
      'Account holder is required';

  end if;


  -- Mobile Money :
  -- numéro obligatoire

  if account_payment_method in (

    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money'

  ) and nullif(
    btrim(account_phone_number),
    ''
  ) is null then

    raise exception
      'Phone number is required for mobile money';

  end if;


  -- Banque :
  -- banque + compte obligatoires

  if account_payment_method =
     'bank_transfer' then

    if nullif(
      btrim(account_bank_name),
      ''
    ) is null then

      raise exception
        'Bank name is required';

    end if;


    if nullif(
      btrim(account_number),
      ''
    ) is null then

      raise exception
        'Bank account number is required';

    end if;

  end if;


  -- ==========================================================
  -- CREATION
  -- ==========================================================

  insert into public.treasury_accounts (

    organization_id,

    label,

    payment_method,

    account_holder,

    phone_number,

    bank_name,

    account_number,

    iban,

    payment_instructions,

    can_receive,

    can_spend,

    created_by

  )

  values (

    target_organization_id,

    btrim(account_label),

    account_payment_method,

    btrim(account_holder),

    nullif(
      btrim(account_phone_number),
      ''
    ),

    nullif(
      btrim(account_bank_name),
      ''
    ),

    nullif(
      btrim(account_number),
      ''
    ),

    nullif(
      btrim(account_iban),
      ''
    ),

    nullif(
      btrim(account_payment_instructions),
      ''
    ),

    account_can_receive,

    account_can_spend,

    auth.uid()

  )

  returning id
  into new_account_id;


  return new_account_id;

end;
$function$;

CREATE OR REPLACE FUNCTION public.archive_treasury_account(target_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

  account_record record;

begin

  select
    ta.id,
    ta.organization_id,
    ta.is_active

  into account_record

  from public.treasury_accounts ta

  where
    ta.id =
      target_account_id

  for update;


  if account_record.id is null then

    raise exception
      'Treasury account not found';

  end if;


  if not private.has_organization_role(

    account_record.organization_id,

    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role
    ]

  ) then

    raise exception
      'Not authorized';

  end if;

  -- ==========================================================
  -- DROIT FONCTIONNEL : TRESORERIE
  -- ==========================================================

  if not public.organization_has_feature(
    account_record.organization_id,
    'treasury'
  ) then

    raise exception
      'Feature not available: treasury';

  end if;


  update public.treasury_accounts

  set

    is_active = false,

    archived_at = now(),

    archived_by = auth.uid(),

    updated_at = now()

  where
    id =
      target_account_id;

end;
$function$;

CREATE OR REPLACE FUNCTION public.record_cash_expense(target_organization_id uuid, expense_amount bigint, expense_category cash_expense_category, expense_beneficiary text, expense_description text, selected_payment_method payment_method, target_expense_date date DEFAULT CURRENT_DATE, payment_reference text DEFAULT NULL::text, expense_notes text DEFAULT NULL::text, supporting_document_path text DEFAULT NULL::text, request_key uuid DEFAULT NULL::uuid)
 RETURNS TABLE(new_expense_id uuid, new_expense_number text, cash_balance_after bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

  expense_id_value uuid;

  expense_number_value text;

  sequence_value bigint;

  organization_prefix text;

  current_cash_balance bigint;

  existing_expense record;

  request_key_value uuid :=
    request_key;

begin

  -- ==========================================================
  -- AUTORISATION
  -- ==========================================================

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

  -- ==========================================================
  -- DROIT FONCTIONNEL : TRESORERIE
  -- ==========================================================

  if not public.organization_has_feature(
    target_organization_id,
    'treasury'
  ) then

    raise exception
      'Feature not available: treasury';

  end if;


  -- ==========================================================
  -- IDEMPOTENCE
  -- ==========================================================

  if request_key_value is not null then

    select
      ce.id,
      ce.expense_number

    into existing_expense

    from public.cash_expenses ce

    where
      ce.organization_id =
        target_organization_id

      and ce.request_key =
        request_key_value

    limit 1;


    if existing_expense.id is not null then

      select

        coalesce(
          sum(
            case
              when le.direction = 'credit'
              then le.amount
              else -le.amount
            end
          ),
          0
        )::bigint

      into current_cash_balance

      from public.ledger_entries le

      where
        le.organization_id =
          target_organization_id;


      return query

      select
        existing_expense.id,
        existing_expense.expense_number,
        current_cash_balance;

      return;

    end if;

  end if;


  -- ==========================================================
  -- VALIDATIONS
  -- ==========================================================

  if expense_amount is null
     or expense_amount <= 0 then

    raise exception
      'Expense amount must be greater than zero';

  end if;


  if nullif(
    btrim(expense_beneficiary),
    ''
  ) is null then

    raise exception
      'Beneficiary is required';

  end if;


  if nullif(
    btrim(expense_description),
    ''
  ) is null then

    raise exception
      'Description is required';

  end if;


  if target_expense_date is null then

    raise exception
      'Expense date is required';

  end if;


  -- ==========================================================
  -- COMPTEUR
  -- ==========================================================

  insert into private.organization_counters (
    organization_id
  )

  values (
    target_organization_id
  )

  on conflict (
    organization_id
  )

  do nothing;


  perform 1

  from private.organization_counters

  where
    organization_id =
      target_organization_id

  for update;


  -- ==========================================================
  -- SOLDE DISPONIBLE
  -- ==========================================================

  select

    coalesce(
      sum(
        case

          when le.direction = 'credit'
          then le.amount

          else -le.amount

        end
      ),
      0
    )::bigint

  into current_cash_balance

  from public.ledger_entries le

  where
    le.organization_id =
      target_organization_id;


  if expense_amount >
     current_cash_balance then

    raise exception
      'Insufficient cash balance';

  end if;


  -- ==========================================================
  -- NUMERO
  -- ==========================================================

  update private.organization_counters

  set
    expense_sequence =
      expense_sequence + 1

  where
    organization_id =
      target_organization_id

  returning
    expense_sequence

  into sequence_value;


  select

    upper(
      regexp_replace(
        coalesce(
          nullif(
            btrim(o.short_name),
            ''
          ),
          'AC'
        ),
        '[^A-Za-z0-9]',
        '',
        'g'
      )
    )

  into organization_prefix

  from public.organizations o

  where
    o.id =
      target_organization_id;


  if organization_prefix is null
     or organization_prefix = '' then

    organization_prefix := 'AC';

  end if;


  expense_number_value :=

    'DEP-'
    ||
    organization_prefix
    ||
    '-'
    ||
    extract(
      year
      from target_expense_date
    )::integer::text
    ||
    '-'
    ||
    lpad(
      sequence_value::text,
      6,
      '0'
    );


  -- ==========================================================
  -- DEPENSE
  -- ==========================================================

  begin

    insert into public.cash_expenses (

      organization_id,
      expense_number,
      expense_date,
      category,
      beneficiary,
      amount,
      payment_method,
      payment_reference,
      description,
      notes,
      supporting_document_path,
      request_key,
      status,
      created_by

    )

    values (

      target_organization_id,
      expense_number_value,
      target_expense_date,
      expense_category,
      btrim(expense_beneficiary),
      expense_amount,
      selected_payment_method,

      nullif(
        btrim(payment_reference),
        ''
      ),

      btrim(expense_description),

      nullif(
        btrim(expense_notes),
        ''
      ),

      nullif(
        btrim(supporting_document_path),
        ''
      ),

      request_key_value,

      'confirmed',

      auth.uid()

    )

    returning id
    into expense_id_value;


  exception
    when unique_violation then

      if request_key_value is null then
        raise;
      end if;


      select
        ce.id,
        ce.expense_number

      into existing_expense

      from public.cash_expenses ce

      where
        ce.organization_id =
          target_organization_id

        and ce.request_key =
          request_key_value;


      return query

      select
        existing_expense.id,
        existing_expense.expense_number,
        current_cash_balance;

      return;

  end;


  -- ==========================================================
  -- JOURNAL DE CAISSE
  -- ==========================================================

  insert into public.ledger_entries (

    organization_id,
    direction,
    category,
    amount,
    description,
    reference_type,
    reference_id,
    entry_date,
    created_by

  )

  values (

    target_organization_id,

    'debit',

    expense_category::text,

    expense_amount,

    'Décaissement '
      ||
      expense_number_value
      ||
      ' - '
      ||
      btrim(expense_description),

    'cash_expense',

    expense_id_value,

    target_expense_date,

    auth.uid()

  );


  return query

  select

    expense_id_value,

    expense_number_value,

    (
      current_cash_balance
      -
      expense_amount
    )::bigint;

end;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_cash_expense(target_expense_id uuid, reason text)
 RETURNS TABLE(reversed_expense_id uuid, expense_number text, cash_balance_after bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

  expense_record record;

  current_cash_balance bigint;

begin

  -- ==========================================================
  -- CHARGER + VERROUILLER
  -- ==========================================================

  select
    e.*

  into expense_record

  from public.cash_expenses e

  where
    e.id =
      target_expense_id

  for update;


  if expense_record.id is null then

    raise exception
      'Expense not found';

  end if;


  -- ==========================================================
  -- AUTORISATION
  -- ==========================================================

  if not private.has_organization_role(

    expense_record.organization_id,

    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role
    ]

  ) then

    raise exception
      'Not authorized';

  end if;

  -- ==========================================================
  -- DROIT FONCTIONNEL : TRESORERIE
  -- ==========================================================

  if not public.organization_has_feature(
    expense_record.organization_id,
    'treasury'
  ) then

    raise exception
      'Feature not available: treasury';

  end if;


  -- ==========================================================
  -- CONTROLES
  -- ==========================================================

  if expense_record.status =
     'reversed' then

    raise exception
      'Expense already reversed';

  end if;


  if nullif(
    btrim(reason),
    ''
  ) is null then

    raise exception
      'Reversal reason is required';

  end if;


  -- ==========================================================
  -- SOLDE AVANT CONTRE-ECRITURE
  -- ==========================================================

  select

    coalesce(
      sum(
        case

          when le.direction =
            'credit'
          then le.amount

          else -le.amount

        end
      ),
      0
    )::bigint

  into current_cash_balance

  from public.ledger_entries le

  where
    le.organization_id =
      expense_record.organization_id;


  -- ==========================================================
  -- MARQUER LA DEPENSE ANNULEE
  -- ==========================================================

  update public.cash_expenses

  set
    status =
      'reversed',

    reversed_at =
      now(),

    reversed_by =
      auth.uid(),

    reversal_reason =
      btrim(reason),

    updated_at =
      now()

  where
    id =
      expense_record.id;


  -- ==========================================================
  -- CONTRE-ECRITURE : CREDIT
  -- ==========================================================

  insert into public.ledger_entries (

    organization_id,

    direction,

    category,

    amount,

    description,

    reference_type,

    reference_id,

    created_by

  )

  values (

    expense_record.organization_id,

    'credit',

    'expense_reversal',

    expense_record.amount,

    'Annulation de '
      ||
      expense_record.expense_number
      ||
      ' - '
      ||
      btrim(reason),

    'cash_expense_reversal',

    expense_record.id,

    auth.uid()

  );


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return query

  select

    expense_record.id,

    expense_record.expense_number,

    (
      current_cash_balance
      +
      expense_record.amount
    )::bigint;

end;
$function$;

-- ============================================================================
-- PRIVILEGES RPC
--
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut sur une nouvelle fonction.
-- On le retire explicitement, puis on n'autorise que authenticated.
-- ============================================================================

revoke all
on function public.archive_treasury_account(uuid)
from public;

revoke all
on function public.archive_treasury_account(uuid)
from anon;

revoke all
on function public.archive_treasury_account(uuid)
from authenticated;

grant execute
on function public.archive_treasury_account(uuid)
to authenticated;


revoke all
on function public.create_treasury_account(
  uuid,
  text,
  public.payment_method,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
)
from public;

revoke all
on function public.create_treasury_account(
  uuid,
  text,
  public.payment_method,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
)
from anon;

revoke all
on function public.create_treasury_account(
  uuid,
  text,
  public.payment_method,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
)
from authenticated;

grant execute
on function public.create_treasury_account(
  uuid,
  text,
  public.payment_method,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
)
to authenticated;


revoke all
on function public.record_cash_expense(
  uuid,
  bigint,
  public.cash_expense_category,
  text,
  text,
  public.payment_method,
  date,
  text,
  text,
  text,
  uuid
)
from public;

revoke all
on function public.record_cash_expense(
  uuid,
  bigint,
  public.cash_expense_category,
  text,
  text,
  public.payment_method,
  date,
  text,
  text,
  text,
  uuid
)
from anon;

revoke all
on function public.record_cash_expense(
  uuid,
  bigint,
  public.cash_expense_category,
  text,
  text,
  public.payment_method,
  date,
  text,
  text,
  text,
  uuid
)
from authenticated;

grant execute
on function public.record_cash_expense(
  uuid,
  bigint,
  public.cash_expense_category,
  text,
  text,
  public.payment_method,
  date,
  text,
  text,
  text,
  uuid
)
to authenticated;


revoke all
on function public.reverse_cash_expense(uuid, text)
from public;

revoke all
on function public.reverse_cash_expense(uuid, text)
from anon;

revoke all
on function public.reverse_cash_expense(uuid, text)
from authenticated;

grant execute
on function public.reverse_cash_expense(uuid, text)
to authenticated;


comment on function public.archive_treasury_account(uuid) is
'Archive un compte de trésorerie après contrôle du rôle et du droit fonctionnel treasury.';

comment on function public.create_treasury_account(
  uuid,
  text,
  public.payment_method,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
) is
'Crée un compte de trésorerie après contrôle du rôle et du droit fonctionnel treasury.';

comment on function public.record_cash_expense(
  uuid,
  bigint,
  public.cash_expense_category,
  text,
  text,
  public.payment_method,
  date,
  text,
  text,
  text,
  uuid
) is
'Enregistre une dépense après contrôle du rôle et du droit fonctionnel treasury.';

comment on function public.reverse_cash_expense(uuid, text) is
'Annule une dépense par contre-écriture après contrôle du rôle et du droit fonctionnel treasury.';

notify pgrst, 'reload schema';
