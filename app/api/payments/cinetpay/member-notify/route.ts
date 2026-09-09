import {
  NextResponse,
} from 'next/server'

import {
  verifyCinetPayHmacWithSecret,
  verifyCinetPayTransactionWithCredentials,
} from '@/lib/payments/cinetpay'

import {
  getOrganizationCinetPayConfig,
} from '@/lib/payments/organization-cinetpay'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// AFRI CLUB
// WEBHOOK CINETPAY - COTISATIONS DES MEMBRES
//
// IMPORTANT :
//
// Ce webhook est distinct du webhook utilisé pour
// les abonnements SaaS Afri Club.
//
// Le paiement n'est JAMAIS confirmé sur la seule base
// des données POST reçues.
//
// Circuit :
//
// CinetPay
//    ↓
// transaction_id
//    ↓
// tentative membre
//    ↓
// compte CinetPay de la mutuelle
//    ↓
// HMAC
//    ↓
// vérification API CinetPay
//    ↓
// confirmation PostgreSQL
// ============================================================

export const runtime =
  'nodejs'

export const dynamic =
  'force-dynamic'

// ============================================================
// TEST DE DISPONIBILITE
// ============================================================

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service:
        'member-cinetpay-notify',
    },
    {
      status: 200,
    }
  )
}

// ============================================================
// NOTIFICATION CINETPAY
// ============================================================

export async function POST(
  request: Request
) {
  // ==========================================================
  // 1. LIRE LE FORMULAIRE
  // ==========================================================

  let formData:
    FormData

  try {
    formData =
      await request.formData()
  } catch {
    return jsonError(
      'invalid_payload',
      400
    )
  }

  // ==========================================================
  // 2. IDENTIFIANTS MINIMUM
  // ==========================================================

  const transactionId =
    getFormString(
      formData,
      'cpm_trans_id'
    )

  const postedSiteId =
    getFormString(
      formData,
      'cpm_site_id'
    )

  if (
    !transactionId ||
    !postedSiteId
  ) {
    return jsonError(
      'missing_transaction',
      400
    )
  }

  // ==========================================================
  // 3. RETROUVER LA TENTATIVE
  //
  // On utilise uniquement transactionId pour retrouver
  // notre propre enregistrement.
  //
  // Aucune donnée financière n'est encore acceptée ici.
  // ==========================================================

  const admin =
    createAdminClient()

  const {
    data: attempt,
    error: attemptError,
  } =
    await admin
      .from(
        'member_payment_attempts'
      )
      .select(`
        id,
        organization_id,
        member_id,
        obligation_id,
        payment_id,
        provider,
        provider_transaction_ref,
        expected_amount_xof,
        currency,
        status
      `)
      .eq(
        'provider',
        'cinetpay'
      )
      .eq(
        'provider_transaction_ref',
        transactionId
      )
      .maybeSingle()

  if (attemptError) {
    console.error(
      'AFRI CLUB - MEMBER CINETPAY ATTEMPT LOOKUP:',
      {
        code:
          attemptError.code,

        message:
          attemptError.message,
      }
    )

    return jsonError(
      'database_error',
      500
    )
  }

  // ==========================================================
  // TRANSACTION INCONNUE
  //
  // Réponse 200 volontaire :
  // inutile que CinetPay répète indéfiniment une notification
  // qui ne correspond à aucune tentative membre.
  // ==========================================================

  if (!attempt) {
    return NextResponse.json(
      {
        ok: true,
        ignored: true,
      },
      {
        status: 200,
      }
    )
  }

  // ==========================================================
  // IDEMPOTENCE
  // ==========================================================

  if (
    attempt.status ===
    'confirmed'
  ) {
    return NextResponse.json(
      {
        ok: true,
        idempotent: true,
      },
      {
        status: 200,
      }
    )
  }

  // ==========================================================
  // 4. CHARGER LE COMPTE CINETPAY DE LA MUTUELLE
  // ==========================================================

  let credentials:
    Awaited<
      ReturnType<
        typeof getOrganizationCinetPayConfig
      >
    >

  try {
    credentials =
      await getOrganizationCinetPayConfig(
        attempt.organization_id
      )
  } catch (error) {
    console.error(
      'AFRI CLUB - MEMBER CINETPAY ORGANIZATION CONFIG:',
      safeError(
        error
      )
    )

    return jsonError(
      'payment_configuration_error',
      500
    )
  }

  // ==========================================================
  // 5. SITE ID
  //
  // Le SITE ID reçu doit être celui du compte marchand
  // de CETTE mutuelle.
  // ==========================================================

  if (
    postedSiteId !==
    credentials.siteId
  ) {
    console.warn(
      'AFRI CLUB - MEMBER CINETPAY INVALID SITE'
    )

    return jsonError(
      'invalid_site',
      401
    )
  }

  // ==========================================================
  // 6. VERIFIER LE HMAC
  // ==========================================================

  let validHmac =
    false

  try {
    validHmac =
      verifyCinetPayHmacWithSecret({
        formData,

        receivedToken:
          request.headers.get(
            'x-token'
          ),

        secretKey:
          credentials.secretKey,
      })
  } catch (error) {
    console.error(
      'AFRI CLUB - MEMBER CINETPAY HMAC:',
      safeError(
        error
      )
    )

    return jsonError(
      'payment_configuration_error',
      500
    )
  }

  if (!validHmac) {
    console.warn(
      'AFRI CLUB - MEMBER CINETPAY INVALID HMAC'
    )

    return jsonError(
      'invalid_hmac',
      401
    )
  }

  // ==========================================================
  // 7. VERIFICATION DIRECTE CHEZ CINETPAY
  //
  // C'est cette réponse serveur-à-serveur qui fait foi.
  // ==========================================================

  let verification:
    Awaited<
      ReturnType<
        typeof verifyCinetPayTransactionWithCredentials
      >
    >

  try {
    verification =
      await verifyCinetPayTransactionWithCredentials(
        transactionId,
        credentials
      )
  } catch (error) {
    console.error(
      'AFRI CLUB - MEMBER CINETPAY VERIFY:',
      safeError(
        error
      )
    )

    return jsonError(
      'provider_verification_failed',
      502
    )
  }

  // ==========================================================
  // 8. DONNEES VERIFIEES
  // ==========================================================

  const providerStatus =
    (
      verification
        .data
        ?.status ??
      ''
    )
      .trim()
      .toUpperCase()

  const paymentMethod =
    cleanNullable(
      verification
        .data
        ?.payment_method
    )

  const operatorId =
    cleanNullable(
      verification
        .data
        ?.operator_id
    )

  const eventRef =
    cleanNullable(
      verification
        .api_response_id
    )

  const now =
    new Date()
      .toISOString()

  // ==========================================================
  // 9. PAIEMENT ACCEPTE
  // ==========================================================

  if (
    providerStatus ===
    'ACCEPTED'
  ) {
    const amountXof =
      parseXofAmount(
        verification
          .data
          ?.amount
      )

    const currency =
      (
        verification
          .data
          ?.currency ??
        ''
      )
        .trim()
        .toUpperCase()

    // ========================================================
    // MONTANT INVALIDE
    // ========================================================

    if (
      amountXof ===
      null
    ) {
      await markAttemptAnomaly(
        admin,
        attempt.id,
        providerStatus,
        paymentMethod,
        operatorId,
        eventRef,
        now
      )

      return NextResponse.json(
        {
          ok: true,
          anomaly: true,
          reason:
            'invalid_amount',
        },
        {
          status: 200,
        }
      )
    }

    // ========================================================
    // DEFENSE SUPPLEMENTAIRE AVANT LE RPC
    //
    // Le RPC vérifiera lui aussi montant + devise.
    // ========================================================

    if (
      amountXof !==
        Number(
          attempt.expected_amount_xof
        ) ||
      currency !==
        String(
          attempt.currency
        )
          .trim()
          .toUpperCase()
    ) {
      await markAttemptAnomaly(
        admin,
        attempt.id,
        providerStatus,
        paymentMethod,
        operatorId,
        eventRef,
        now
      )

      return NextResponse.json(
        {
          ok: true,
          anomaly: true,
          reason:
            'amount_or_currency_mismatch',
        },
        {
          status: 200,
        }
      )
    }

    // ========================================================
    // CONFIRMATION ATOMIQUE
    //
    // Le RPC crée :
    // - payment
    // - allocation
    // - mise à jour obligation
    // - ledger
    // - reçu
    //
    // exactement une seule fois.
    // ========================================================

    const {
      data: confirmation,
      error:
        confirmationError,
    } =
      await admin.rpc(
        'confirm_cinetpay_member_payment',
        {
          target_attempt_id:
            attempt.id,

          target_amount_xof:
            amountXof,

          target_currency:
            currency,

          target_payment_method:
            paymentMethod,

          target_operator_id:
            operatorId,

          target_event_ref:
            eventRef,

          target_provider_paid_at:
            now,
        }
      )

    if (
      confirmationError
    ) {
      console.error(
        'AFRI CLUB - MEMBER CINETPAY CONFIRM:',
        {
          code:
            confirmationError.code,

          message:
            confirmationError.message,
        }
      )

      return jsonError(
        'confirmation_failed',
        500
      )
    }

    return NextResponse.json(
      {
        ok: true,
        confirmation,
      },
      {
        status: 200,
      }
    )
  }

  // ==========================================================
  // 10. PAIEMENT REFUSE / ANNULE
  // ==========================================================

  if (
    [
      'REFUSED',
      'CANCELLED',
      'CANCELED',
      'FAILED',
    ].includes(
      providerStatus
    )
  ) {
    const {
      error:
        failedUpdateError,
    } =
      await admin
        .from(
          'member_payment_attempts'
        )
        .update({
          status:
            'failed',

          provider_status:
            providerStatus,

          provider_payment_method:
            paymentMethod,

          provider_operator_id:
            operatorId,

          provider_event_ref:
            eventRef,

          last_verified_at:
            now,

          failed_at:
            now,

          updated_at:
            now,
        })
        .eq(
          'id',
          attempt.id
        )

    if (
      failedUpdateError
    ) {
      console.error(
        'AFRI CLUB - MEMBER CINETPAY FAILED UPDATE:',
        {
          code:
            failedUpdateError.code,

          message:
            failedUpdateError.message,
        }
      )

      return jsonError(
        'database_error',
        500
      )
    }

    return NextResponse.json(
      {
        ok: true,
        status: 'failed',
      },
      {
        status: 200,
      }
    )
  }

  // ==========================================================
  // 11. EN ATTENTE
  // ==========================================================

  const {
    error:
      pendingUpdateError,
  } =
    await admin
      .from(
        'member_payment_attempts'
      )
      .update({
        status:
          'pending',

        provider_status:
          providerStatus ||
          verification.message ||
          'PENDING',

        provider_payment_method:
          paymentMethod,

        provider_operator_id:
          operatorId,

        provider_event_ref:
          eventRef,

        last_verified_at:
          now,

        updated_at:
          now,
      })
      .eq(
        'id',
        attempt.id
      )

  if (
    pendingUpdateError
  ) {
    console.error(
      'AFRI CLUB - MEMBER CINETPAY PENDING UPDATE:',
      {
        code:
          pendingUpdateError.code,

        message:
          pendingUpdateError.message,
      }
    )

    return jsonError(
      'database_error',
      500
    )
  }

  return NextResponse.json(
    {
      ok: true,
      status: 'pending',
    },
    {
      status: 200,
    }
  )
}

// ============================================================
// MARQUER UNE ANOMALIE
// ============================================================

async function markAttemptAnomaly(
  admin:
    ReturnType<
      typeof createAdminClient
    >,

  attemptId:
    string,

  providerStatus:
    string,

  paymentMethod:
    | string
    | null,

  operatorId:
    | string
    | null,

  eventRef:
    | string
    | null,

  now:
    string
) {
  const {
    error,
  } =
    await admin
      .from(
        'member_payment_attempts'
      )
      .update({
        status:
          'anomaly',

        provider_status:
          providerStatus,

        provider_payment_method:
          paymentMethod,

        provider_operator_id:
          operatorId,

        provider_event_ref:
          eventRef,

        last_verified_at:
          now,

        updated_at:
          now,
      })
      .eq(
        'id',
        attemptId
      )

  if (error) {
    console.error(
      'AFRI CLUB - MEMBER CINETPAY ANOMALY:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )
  }
}

// ============================================================
// FORM DATA
// ============================================================

function getFormString(
  formData:
    FormData,

  key:
    string
) {
  const value =
    formData.get(
      key
    )

  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized ||
    null
}

// ============================================================
// NULLABLE STRING
// ============================================================

function cleanNullable(
  value:
    | string
    | null
    | undefined
) {
  const normalized =
    value?.trim()

  return normalized ||
    null
}

// ============================================================
// MONTANT XOF
// ============================================================

function parseXofAmount(
  value:
    | string
    | number
    | null
    | undefined
) {
  const amount =
    typeof value ===
    'number'
      ? value
      : Number(
          value
        )

  if (
    !Number.isSafeInteger(
      amount
    ) ||
    amount <= 0
  ) {
    return null
  }

  return amount
}

// ============================================================
// JSON ERROR
// ============================================================

function jsonError(
  error:
    string,

  status:
    number
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    {
      status,
    }
  )
}

// ============================================================
// SAFE ERROR
//
// Evite d'afficher accidentellement des secrets.
// ============================================================

function safeError(
  error:
    unknown
) {
  if (
    error instanceof
    Error
  ) {
    return {
      name:
        error.name,

      message:
        error.message,
    }
  }

  return {
    message:
      'Unknown error',
  }
}