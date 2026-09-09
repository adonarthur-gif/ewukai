-- ============================================================
-- AFRI CLUB
-- CORRECTION DU MOYEN DE PAIEMENT CINETPAY MEMBRE
--
-- Objectifs :
-- - enregistrer le moyen réellement confirmé par CinetPay
-- - ne pas faire confiance au choix initial du navigateur
-- - conserver un fallback sûr
-- - éviter qu'un moyen inconnu soit attribué à tort à Wave,
--   Orange Money, MTN ou Moov
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

  normalized_provider_method text;

  resolved_payment_method
    public.payment_method;

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

  if auth.role() <>
     'service_role'
  then

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


  if attempt_record.provider <>
     'cinetpay'
  then

    raise exception
      'Invalid payment provider';

  end if;


  -- ==========================================================
  -- 3. IDEMPOTENCE
  -- ==========================================================

  if attempt_record.status =
     'confirmed'
  then

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
        attempt_record
          .expected_amount_xof

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
  -- 7. PROTECTION DOUBLE ENCAISSEMENT
  -- ==========================================================

  if remaining_before <>
     attempt_record.expected_amount_xof
  then

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
  -- 8. MOYEN REEL CONFIRME PAR CINETPAY
  --
  -- On ne caste jamais directement le texte fournisseur
  -- vers l'enum PostgreSQL.
  --
  -- Exemples possibles :
  -- WAVE
  -- WAVE_CI
  -- ORANGE
  -- ORANGE_CI
  -- MTN
  -- MTN_CI
  -- MOOV
  -- MOOV_CI
  --
  -- Le matching reste volontairement tolérant.
  -- ==========================================================

  normalized_provider_method :=
    lower(
      btrim(
        coalesce(
          target_payment_method,
          ''
        )
      )
    );


  if normalized_provider_method = '' then

    -- Aucun moyen retourné :
    -- on conserve celui utilisé pour préparer
    -- la tentative.

    resolved_payment_method :=
      attempt_record
        .selected_payment_method;


  elsif normalized_provider_method
        like '%wave%'
  then

    resolved_payment_method :=
      'wave'
        ::public.payment_method;


  elsif normalized_provider_method
        like '%orange%'
  then

    resolved_payment_method :=
      'orange_money'
        ::public.payment_method;


  elsif normalized_provider_method
        like '%mtn%'
  then

    resolved_payment_method :=
      'mtn_momo'
        ::public.payment_method;


  elsif normalized_provider_method
        like '%moov%'
  then

    resolved_payment_method :=
      'moov_money'
        ::public.payment_method;


  else

    -- Le prestataire a bien fourni une valeur,
    -- mais Afri Club ne la reconnaît pas.
    --
    -- On préfère "other" plutôt que d'inventer
    -- Wave / Orange / MTN / Moov.

    resolved_payment_method :=
      'other'
        ::public.payment_method;

  end if;


  -- ==========================================================
  -- 9. NUMERO DE RECU
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
  -- 10. PAIEMENT CONFIRME
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

    resolved_payment_method,

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
  -- 11. AFFECTATION
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
  -- 12. ECHEANCE SOLDEE
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
  -- 13. JOURNAL DE CAISSE
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
        obligation_record
          .contribution_call_id
        is not null

      then
        'exceptional_contribution'

      else
        'contribution'

    end,

    attempt_record.expected_amount_xof,

    case

      when
        obligation_record
          .contribution_call_id
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
  -- 14. CONFIRMER LA TENTATIVE
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
  -- 15. RESULTAT
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

      'payment_method',
        resolved_payment_method,

      'provider_payment_method',
        nullif(
          btrim(
            coalesce(
              target_payment_method,
              ''
            )
          ),
          ''
        ),

      'remaining_amount',
        0

    );

end;

$function$;


-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all
on function
public.confirm_cinetpay_member_payment(
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
on function
public.confirm_cinetpay_member_payment(
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
on function
public.confirm_cinetpay_member_payment(
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
on function
public.confirm_cinetpay_member_payment(
  uuid,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz
)
to service_role;


notify pgrst, 'reload schema';