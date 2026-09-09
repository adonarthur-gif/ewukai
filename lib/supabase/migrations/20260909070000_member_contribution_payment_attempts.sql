-- ============================================================
-- AFRI CLUB
-- PAIEMENTS EN LIGNE DES COTISATIONS PAR LES MEMBRES
--
-- Principe :
--
-- Membre
--   -> choisit une échéance
--   -> choisit un moyen de paiement à distance
--   -> Afri Club calcule lui-même le montant restant
--   -> création d'une tentative
--   -> prestataire de paiement
--   -> confirmation serveur
--   -> paiement confirmé
--   -> affectation
--   -> caisse
--   -> reçu
--
-- IMPORTANT :
-- - aucun paiement n'est confirmé depuis le navigateur
-- - aucun paiement espèces depuis l'espace membre
-- - aucune validation manuelle du trésorier
-- ============================================================


-- ============================================================
-- 1. TABLE DES TENTATIVES
-- ============================================================

create table if not exists
public.member_payment_attempts (

  id uuid
    primary key
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

  payment_id uuid
    null
    references public.payments(id)
    on delete set null,

  selected_payment_method
    public.payment_method
    not null,

  provider text
    not null
    default 'cinetpay',

  provider_transaction_ref text
    not null,

  provider_payment_token text
    null,

  provider_payment_url text
    null,

  expected_amount_xof bigint
    not null
    check (
      expected_amount_xof > 0
    ),

  currency text
    not null
    default 'XOF'
    check (
      currency = 'XOF'
    ),

  status text
    not null
    default 'created'
    check (
      status in (
        'created',
        'checkout_ready',
        'pending',
        'confirmed',
        'failed',
        'cancelled',
        'expired',
        'anomaly'
      )
    ),

  provider_status text
    null,

  provider_payment_method text
    null,

  provider_operator_id text
    null,

  provider_event_ref text
    null,

  last_verified_at timestamptz
    null,

  confirmed_at timestamptz
    null,

  failed_at timestamptz
    null,

  created_by uuid
    not null
    references auth.users(id)
    on delete cascade,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
    member_payment_attempts_provider_ref_unique
    unique (
      provider,
      provider_transaction_ref
    ),

  constraint
    member_payment_attempts_provider_not_blank
    check (
      nullif(
        btrim(provider),
        ''
      ) is not null
    ),

  constraint
    member_payment_attempts_reference_not_blank
    check (
      nullif(
        btrim(
          provider_transaction_ref
        ),
        ''
      ) is not null
    )
);


-- ============================================================
-- 2. INDEX
-- ============================================================

create index if not exists
  member_payment_attempts_member_idx
on public.member_payment_attempts (
  member_id,
  created_at desc
);


create index if not exists
  member_payment_attempts_organization_idx
on public.member_payment_attempts (
  organization_id,
  created_at desc
);


create index if not exists
  member_payment_attempts_obligation_idx
on public.member_payment_attempts (
  obligation_id,
  created_at desc
);


create index if not exists
  member_payment_attempts_status_idx
on public.member_payment_attempts (
  status,
  created_at desc
);


-- ============================================================
-- UNE SEULE TENTATIVE OUVERTE
-- PAR MEMBRE / ECHEANCE / PRESTATAIRE
-- ============================================================

create unique index if not exists
  member_payment_attempts_one_open_idx
on public.member_payment_attempts (
  obligation_id,
  provider,
  created_by
)
where status in (
  'created',
  'checkout_ready',
  'pending'
);


-- ============================================================
-- 3. RLS
--
-- Aucun accès direct navigateur.
-- Les opérations passent par des RPC sécurisées.
-- ============================================================

alter table
  public.member_payment_attempts
enable row level security;


revoke all
on table public.member_payment_attempts
from public;


revoke all
on table public.member_payment_attempts
from anon;


revoke all
on table public.member_payment_attempts
from authenticated;


-- ============================================================
-- 4. PREPARER UN PAIEMENT MEMBRE
--
-- Le navigateur NE FOURNIT PAS LE MONTANT.
-- PostgreSQL calcule lui-même le reste exact.
-- ============================================================

create or replace function
public.prepare_member_obligation_payment(

  target_obligation_id uuid,

  selected_payment_method
    public.payment_method,

  target_provider text
    default 'cinetpay'

)
returns jsonb

language plpgsql
security definer

set search_path = ''

as $function$

declare

  current_user_id uuid;

  obligation_record record;

  normalized_provider text;

  already_paid bigint;

  remaining_amount bigint;

  existing_attempt record;

  new_attempt_id uuid;

  new_transaction_ref text;

begin

  -- ==========================================================
  -- 1. AUTHENTIFICATION
  -- ==========================================================

  current_user_id :=
    auth.uid();

  if current_user_id
     is null then

    raise exception
      'Authentication required';

  end if;


  -- ==========================================================
  -- 2. PRESTATAIRE
  -- ==========================================================

  normalized_provider :=
    lower(
      btrim(
        coalesce(
          target_provider,
          ''
        )
      )
    );

  if normalized_provider
     <> 'cinetpay' then

    raise exception
      'Unsupported payment provider';

  end if;


  -- ==========================================================
  -- 3. PAS D'AUTO-ENCAISSEMENT ESPECES
  -- ==========================================================

  if selected_payment_method =
     'cash'::public.payment_method then

    raise exception
      'Cash payment must be recorded by the organization';

  end if;


  -- ==========================================================
  -- 4. ECHEANCE + MEMBRE
  -- ==========================================================

  select

    co.id,

    co.organization_id,

    co.member_id,

    co.amount_due,

    co.status,

    co.contribution_type_id,

    co.contribution_call_id,

    m.user_id,

    m.status
      as member_status

  into
    obligation_record

  from
    public.contribution_obligations co

  join
    public.members m

    on m.id =
      co.member_id

    and m.organization_id =
      co.organization_id

  where
    co.id =
      target_obligation_id

  for update of co;


  if not found then

    raise exception
      'Obligation not found';

  end if;


  -- ==========================================================
  -- 5. LE MEMBRE DOIT ETRE ACTIF
  -- ==========================================================

  if obligation_record.member_status
     <> 'active' then

    raise exception
      'Member is not active';

  end if;


  -- ==========================================================
  -- 6. LE DOSSIER DOIT APPARTENIR AU COMPTE CONNECTE
  -- ==========================================================

  if obligation_record.user_id
     is distinct from
     current_user_id then

    raise exception
      'Not authorized';

  end if;


  -- ==========================================================
  -- 7. ETAT DE L'ECHEANCE
  -- ==========================================================

  if obligation_record.status in (
    'waived',
    'cancelled'
  ) then

    raise exception
      'Obligation cannot be paid';

  end if;


  -- ==========================================================
  -- 8. CALCULER CE QUI A DEJA ETE CONFIRME
  -- ==========================================================

  select

    coalesce(
      sum(
        pa.amount
      ),
      0
    )::bigint

  into
    already_paid

  from
    public.payment_allocations pa

  join
    public.payments p

    on p.id =
      pa.payment_id

  where
    pa.obligation_id =
      obligation_record.id

    and p.status =
      'confirmed';


  remaining_amount :=
    greatest(

      obligation_record.amount_due
      -
      already_paid,

      0
    );


  if remaining_amount <=
     0 then

    raise exception
      'Obligation is already fully paid';

  end if;


  -- ==========================================================
  -- 9. ANNULER UNE ANCIENNE TENTATIVE DEVENUE OBSOLETE
  --
  -- Exemple :
  -- une tentative de 5 000 existe,
  -- mais un paiement espèces a été enregistré entre-temps.
  -- ==========================================================

  update
    public.member_payment_attempts

  set

    status =
      'cancelled',

    updated_at =
      now()

  where
    obligation_id =
      obligation_record.id

    and provider =
      normalized_provider

    and created_by =
      current_user_id

    and status in (
      'created',
      'checkout_ready',
      'pending'
    )

    and (
      expected_amount_xof
        <>
      remaining_amount

      or

      selected_payment_method
        is distinct from
      prepare_member_obligation_payment
        .selected_payment_method
    );


  -- ==========================================================
  -- 10. REUTILISER UNE TENTATIVE ENCORE VALIDE
  -- ==========================================================

  select
    mpa.*

  into
    existing_attempt

  from
    public.member_payment_attempts mpa

  where
    mpa.obligation_id =
      obligation_record.id

    and mpa.provider =
      normalized_provider

    and mpa.created_by =
      current_user_id

    and mpa.expected_amount_xof =
      remaining_amount

    and mpa.selected_payment_method =
      selected_payment_method

    and mpa.status in (
      'created',
      'checkout_ready',
      'pending'
    )

  order by
    mpa.created_at desc

  limit 1

  for update;


  if found then

    return
      jsonb_build_object(

        'attempt_id',
          existing_attempt.id,

        'organization_id',
          obligation_record.organization_id,

        'member_id',
          obligation_record.member_id,

        'obligation_id',
          obligation_record.id,

        'amount_xof',
          existing_attempt.expected_amount_xof,

        'currency',
          existing_attempt.currency,

        'payment_method',
          existing_attempt.selected_payment_method,

        'provider',
          existing_attempt.provider,

        'provider_transaction_ref',
          existing_attempt.provider_transaction_ref,

        'provider_payment_token',
          existing_attempt.provider_payment_token,

        'provider_payment_url',
          existing_attempt.provider_payment_url,

        'attempt_status',
          existing_attempt.status

      );

  end if;


  -- ==========================================================
  -- 11. REFERENCE UNIQUE
  -- ==========================================================

  new_transaction_ref :=

    'AFCM'
    ||
    to_char(
      clock_timestamp(),
      'YYYYMMDDHH24MISSMS'
    )
    ||
    upper(
      substr(
        replace(
          gen_random_uuid()::text,
          '-',
          ''
        ),
        1,
        8
      )
    );


  -- ==========================================================
  -- 12. CREER LA TENTATIVE
  -- ==========================================================

  insert into
    public.member_payment_attempts (

      organization_id,

      member_id,

      obligation_id,

      selected_payment_method,

      provider,

      provider_transaction_ref,

      expected_amount_xof,

      currency,

      status,

      created_by

    )

  values (

    obligation_record.organization_id,

    obligation_record.member_id,

    obligation_record.id,

    selected_payment_method,

    normalized_provider,

    new_transaction_ref,

    remaining_amount,

    'XOF',

    'created',

    current_user_id

  )

  returning
    id

  into
    new_attempt_id;


  -- ==========================================================
  -- 13. RESULTAT
  -- ==========================================================

  return
    jsonb_build_object(

      'attempt_id',
        new_attempt_id,

      'organization_id',
        obligation_record.organization_id,

      'member_id',
        obligation_record.member_id,

      'obligation_id',
        obligation_record.id,

      'amount_xof',
        remaining_amount,

      'currency',
        'XOF',

      'payment_method',
        selected_payment_method,

      'provider',
        normalized_provider,

      'provider_transaction_ref',
        new_transaction_ref,

      'provider_payment_token',
        null,

      'provider_payment_url',
        null,

      'attempt_status',
        'created'

    );

end;

$function$;


-- ============================================================
-- 5. CONFIRMATION SERVEUR DU PAIEMENT MEMBRE
--
-- Cette fonction n'est JAMAIS appelée par le navigateur.
-- Elle sera appelée uniquement par notre webhook serveur
-- après vérification chez CinetPay.
-- ============================================================

create or replace function
public.confirm_cinetpay_member_payment(

  target_attempt_id uuid,

  target_amount_xof bigint,

  target_currency text,

  target_payment_method text
    default null,

  target_operator_id text
    default null,

  target_event_ref text
    default null,

  target_provider_paid_at timestamptz
    default now()

)
returns jsonb

language plpgsql
security definer

set search_path = ''

as $function$

declare

  attempt_record record;

  obligation_record record;

  normalized_currency text;

  already_paid bigint;

  remaining_before bigint;

  organization_prefix text;

  receipt_seq bigint;

  receipt_value text;

  payment_id_value uuid;

begin

  -- ==========================================================
  -- 1. SERVEUR UNIQUEMENT
  -- ==========================================================

  if auth.role()
     <> 'service_role' then

    raise exception
      'Service role required';

  end if;


  -- ==========================================================
  -- 2. TENTATIVE
  -- ==========================================================

  select
    mpa.*

  into
    attempt_record

  from
    public.member_payment_attempts mpa

  where
    mpa.id =
      target_attempt_id

  for update;


  if not found then

    raise exception
      'Payment attempt not found';

  end if;


  if attempt_record.provider
     <> 'cinetpay' then

    raise exception
      'Invalid payment provider';

  end if;


  -- ==========================================================
  -- 3. IDEMPOTENCE
  -- ==========================================================

  if attempt_record.status =
     'confirmed' then

    return
      jsonb_build_object(

        'success',
          true,

        'idempotent',
          true,

        'attempt_id',
          attempt_record.id,

        'payment_id',
          attempt_record.payment_id

      );

  end if;


  -- ==========================================================
  -- 4. MONTANT + DEVISE
  -- ==========================================================

  normalized_currency :=
    upper(
      btrim(
        coalesce(
          target_currency,
          ''
        )
      )
    );


  if target_amount_xof
       is null

     or target_amount_xof
       <>
       attempt_record.expected_amount_xof

     or normalized_currency
       <>
       'XOF'
  then

    update
      public.member_payment_attempts

    set

      status =
        'anomaly',

      provider_status =
        'ACCEPTED',

      provider_payment_method =
        nullif(
          btrim(
            coalesce(
              target_payment_method,
              ''
            )
          ),
          ''
        ),

      provider_operator_id =
        nullif(
          btrim(
            coalesce(
              target_operator_id,
              ''
            )
          ),
          ''
        ),

      provider_event_ref =
        nullif(
          btrim(
            coalesce(
              target_event_ref,
              ''
            )
          ),
          ''
        ),

      last_verified_at =
        now(),

      updated_at =
        now()

    where
      id =
        attempt_record.id;


    return
      jsonb_build_object(

        'success',
          false,

        'anomaly',
          true,

        'reason',
          'amount_or_currency_mismatch'

      );

  end if;


  -- ==========================================================
  -- 5. VERROUILLER L'ECHEANCE
  -- ==========================================================

  select

    co.id,

    co.organization_id,

    co.member_id,

    co.amount_due,

    co.status,

    co.contribution_call_id

  into
    obligation_record

  from
    public.contribution_obligations co

  where
    co.id =
      attempt_record.obligation_id

    and co.organization_id =
      attempt_record.organization_id

    and co.member_id =
      attempt_record.member_id

  for update;


  if not found then

    raise exception
      'Obligation not found';

  end if;


  if obligation_record.status in (
    'waived',
    'cancelled'
  ) then

    raise exception
      'Obligation cannot be paid';

  end if;


  -- ==========================================================
  -- 6. RECALCULER LE RESTE
  -- ==========================================================

  select

    coalesce(
      sum(
        pa.amount
      ),
      0
    )::bigint

  into
    already_paid

  from
    public.payment_allocations pa

  join
    public.payments p

    on p.id =
      pa.payment_id

  where
    pa.obligation_id =
      obligation_record.id

    and p.status =
      'confirmed';


  remaining_before :=
    greatest(

      obligation_record.amount_due
      -
      already_paid,

      0
    );


  -- ==========================================================
  -- 7. PROTECTION CONTRE DOUBLE ENCAISSEMENT
  -- ==========================================================

  if remaining_before
     <>
     attempt_record.expected_amount_xof then

    update
      public.member_payment_attempts

    set

      status =
        'anomaly',

      provider_status =
        'ACCEPTED',

      last_verified_at =
        now(),

      updated_at =
        now()

    where
      id =
        attempt_record.id;


    return
      jsonb_build_object(

        'success',
          false,

        'anomaly',
          true,

        'reason',
          'obligation_balance_changed'

      );

  end if;


  -- ==========================================================
  -- 8. NUMERO DE RECU
  -- ==========================================================

  insert into
    private.organization_counters
      as c (
        organization_id,
        receipt_sequence
      )

  values (
    obligation_record.organization_id,
    1
  )

  on conflict (
    organization_id
  )

  do update

  set
    receipt_sequence =
      c.receipt_sequence + 1

  returning
    receipt_sequence

  into
    receipt_seq;


  select

    upper(
      regexp_replace(
        coalesce(
          nullif(
            btrim(
              o.short_name
            ),
            ''
          ),
          'AC'
        ),
        '[^A-Za-z0-9]',
        '',
        'g'
      )
    )

  into
    organization_prefix

  from
    public.organizations o

  where
    o.id =
      obligation_record.organization_id;


  if organization_prefix
       is null

     or organization_prefix =
       ''
  then

    organization_prefix :=
      'AC';

  end if;


  receipt_value :=

    'REC-'
    ||
    organization_prefix
    ||
    '-'
    ||
    extract(
      year
      from current_date
    )::integer::text
    ||
    '-'
    ||
    lpad(
      receipt_seq::text,
      6,
      '0'
    );


  -- ==========================================================
  -- 9. PAIEMENT CONFIRME
  -- ==========================================================

  insert into
    public.payments (

      organization_id,

      member_id,

      amount,

      payment_method,

      payment_reference,

      receipt_number,

      status,

      notes,

      paid_at,

      created_by

    )

  values (

    obligation_record.organization_id,

    obligation_record.member_id,

    attempt_record.expected_amount_xof,

    attempt_record.selected_payment_method,

    attempt_record.provider_transaction_ref,

    receipt_value,

    'confirmed',

    'Paiement en ligne confirmé automatiquement',

    coalesce(
      target_provider_paid_at,
      now()
    ),

    attempt_record.created_by

  )

  returning
    id

  into
    payment_id_value;


  -- ==========================================================
  -- 10. AFFECTATION
  -- ==========================================================

  insert into
    public.payment_allocations (

      payment_id,

      obligation_id,

      amount

    )

  values (

    payment_id_value,

    obligation_record.id,

    attempt_record.expected_amount_xof

  );


  -- ==========================================================
  -- 11. ECHEANCE SOLDEE
  --
  -- V1 paiement membre :
  -- le prestataire reçoit exactement le reste de l'échéance.
  -- ==========================================================

  update
    public.contribution_obligations

  set
    status =
      'paid'
        ::public.obligation_status

  where
    id =
      obligation_record.id;


  -- ==========================================================
  -- 12. JOURNAL DE CAISSE
  -- ==========================================================

  insert into
    public.ledger_entries (

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

    obligation_record.organization_id,

    'credit',

    case

      when
        obligation_record.contribution_call_id
          is not null

      then
        'exceptional_contribution'

      else
        'contribution'

    end,

    attempt_record.expected_amount_xof,

    case

      when
        obligation_record.contribution_call_id
          is not null

      then
        'Paiement en ligne cotisation exceptionnelle - '
        ||
        receipt_value

      else
        'Paiement en ligne cotisation - '
        ||
        receipt_value

    end,

    'payment',

    payment_id_value,

    attempt_record.created_by

  );


  -- ==========================================================
  -- 13. CONFIRMER LA TENTATIVE
  -- ==========================================================

  update
    public.member_payment_attempts

  set

    payment_id =
      payment_id_value,

    status =
      'confirmed',

    provider_status =
      'ACCEPTED',

    provider_payment_method =
      nullif(
        btrim(
          coalesce(
            target_payment_method,
            ''
          )
        ),
        ''
      ),

    provider_operator_id =
      nullif(
        btrim(
          coalesce(
            target_operator_id,
            ''
          )
        ),
        ''
      ),

    provider_event_ref =
      nullif(
        btrim(
          coalesce(
            target_event_ref,
            ''
          )
        ),
        ''
      ),

    last_verified_at =
      now(),

    confirmed_at =
      now(),

    updated_at =
      now()

  where
    id =
      attempt_record.id;


  -- ==========================================================
  -- 14. RESULTAT
  -- ==========================================================

  return
    jsonb_build_object(

      'success',
        true,

      'idempotent',
        false,

      'attempt_id',
        attempt_record.id,

      'payment_id',
        payment_id_value,

      'receipt_number',
        receipt_value,

      'amount_xof',
        attempt_record.expected_amount_xof,

      'remaining_amount',
        0

    );

end;

$function$;


-- ============================================================
-- 6. PERMISSIONS
-- ============================================================

revoke all
on function public.prepare_member_obligation_payment(
  uuid,
  public.payment_method,
  text
)
from public;


revoke all
on function public.prepare_member_obligation_payment(
  uuid,
  public.payment_method,
  text
)
from anon;


grant execute
on function public.prepare_member_obligation_payment(
  uuid,
  public.payment_method,
  text
)
to authenticated;


revoke all
on function public.confirm_cinetpay_member_payment(
  uuid,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz
)
from public;


revoke all
on function public.confirm_cinetpay_member_payment(
  uuid,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz
)
from anon;


revoke all
on function public.confirm_cinetpay_member_payment(
  uuid,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz
)
from authenticated;


grant execute
on function public.confirm_cinetpay_member_payment(
  uuid,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz
)
to service_role;


-- ============================================================
-- 7. RECHARGER LE SCHEMA POSTGREST
-- ============================================================

notify pgrst, 'reload schema';