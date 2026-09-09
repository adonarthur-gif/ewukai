-- ============================================================
-- AFRI CLUB
-- MIGRATION 044
-- CONFIRMATION SERVEUR CINETPAY -> ABONNEMENT SAAS
--
-- Cette fonction est un pont très étroit entre :
--   subscription_payment_attempts
-- et :
--   confirm_platform_provider_payment(...)
--
-- Elle n'est exécutable que par service_role.
-- Aucun navigateur / utilisateur authentifié ne peut l'appeler.
-- ============================================================


create or replace function public.confirm_cinetpay_subscription_payment(
  target_attempt_id uuid,
  target_amount_xof bigint,
  target_currency text,
  target_payment_method text default null,
  target_operator_id text default null,
  target_event_ref text default null,
  target_provider_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$

declare

  attempt_record record;

  normalized_currency text;

  normalized_event_ref text;

begin

  -- ==========================================================
  -- 1. APPEL SERVEUR UNIQUEMENT
  -- ==========================================================

  if auth.role() <> 'service_role' then

    raise exception
      'Service role required';

  end if;


  if target_attempt_id is null then

    raise exception
      'Payment attempt is required';

  end if;


  -- ==========================================================
  -- 2. VERROUILLER LA TENTATIVE
  -- ==========================================================

  select
    spa.id,
    spa.organization_id,
    spa.subscription_id,
    spa.invoice_id,
    spa.provider,
    spa.provider_transaction_ref,
    spa.expected_amount_xof,
    spa.currency,
    spa.status

  into
    attempt_record

  from
    public.subscription_payment_attempts as spa

  where
    spa.id =
      target_attempt_id

  for update;


  if not found then

    raise exception
      'Payment attempt not found';

  end if;


  if attempt_record.provider <> 'cinetpay' then

    raise exception
      'Invalid payment provider';

  end if;


  -- ==========================================================
  -- 3. IDEMPOTENCE
  -- ==========================================================

  if attempt_record.status = 'confirmed' then

    return
      jsonb_build_object(

        'success',
        true,

        'idempotent',
        true,

        'attempt_id',
        attempt_record.id,

        'invoice_id',
        attempt_record.invoice_id,

        'subscription_id',
        attempt_record.subscription_id,

        'organization_id',
        attempt_record.organization_id

      );

  end if;


  -- ==========================================================
  -- 4. VERIFIER MONTANT + DEVISE
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


  if target_amount_xof is null
     or target_amount_xof
        <> attempt_record.expected_amount_xof
     or normalized_currency
        <> upper(attempt_record.currency) then

    update
      public.subscription_payment_attempts

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

        'reason',
        'amount_or_currency_mismatch',

        'attempt_id',
        attempt_record.id,

        'invoice_id',
        attempt_record.invoice_id,

        'expected_amount_xof',
        attempt_record.expected_amount_xof,

        'received_amount_xof',
        target_amount_xof,

        'expected_currency',
        upper(
          attempt_record.currency
        ),

        'received_currency',
        normalized_currency

      );

  end if;


  -- ==========================================================
  -- 5. REFERENCE EVENEMENT IDEMPOTENTE
  -- ==========================================================

  normalized_event_ref :=
    nullif(
      btrim(
        coalesce(
          target_event_ref,
          ''
        )
      ),
      ''
    );


  if normalized_event_ref is null then

    normalized_event_ref :=
      'cinetpay:'
      ||
      attempt_record.provider_transaction_ref
      ||
      ':accepted';

  end if;


  -- ==========================================================
  -- 6. CONFIRMATION CENTRALE AFRI CLUB
  --
  -- Appel POSITIONNEL volontaire :
  --   invoice_id
  --   amount_xof
  --   provider
  --   transaction_ref
  --   event_ref
  --   provider_paid_at
  --
  -- Le navigateur n'intervient jamais ici.
  -- ==========================================================

  perform
    public.confirm_platform_provider_payment(

      attempt_record.invoice_id,

      target_amount_xof,

      'cinetpay',

      attempt_record.provider_transaction_ref,

      normalized_event_ref,

      coalesce(
        target_provider_paid_at,
        now()
      )

    );


  -- ==========================================================
  -- 7. TENTATIVE CONFIRMEE
  -- ==========================================================

  update
    public.subscription_payment_attempts

  set
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

    last_verified_at =
      now(),

    confirmed_at =
      coalesce(
        target_provider_paid_at,
        now()
      ),

    failed_at =
      null,

    updated_at =
      now()

  where
    id =
      attempt_record.id;


  -- ==========================================================
  -- 8. RESULTAT
  -- ==========================================================

  return
    jsonb_build_object(

      'success',
      true,

      'idempotent',
      false,

      'attempt_id',
      attempt_record.id,

      'invoice_id',
      attempt_record.invoice_id,

      'subscription_id',
      attempt_record.subscription_id,

      'organization_id',
      attempt_record.organization_id,

      'amount_xof',
      target_amount_xof,

      'currency',
      normalized_currency,

      'provider_transaction_ref',
      attempt_record.provider_transaction_ref

    );

end;

$function$;


-- ============================================================
-- 9. PERMISSIONS
-- ============================================================

revoke all
on function public.confirm_cinetpay_subscription_payment(
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
on function public.confirm_cinetpay_subscription_payment(
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
on function public.confirm_cinetpay_subscription_payment(
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
on function public.confirm_cinetpay_subscription_payment(
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
-- 10. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst, 'reload schema';
