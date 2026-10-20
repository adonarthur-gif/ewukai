import {
  timingSafeEqual,
} from 'node:crypto'

import {
  NextResponse,
} from 'next/server'

import {
  hashCinetPayNotifyToken,
} from '@/lib/payments/cinetpay-aurore'

import {
  verifyCinetPayAurorePayment,
} from '@/lib/payments/cinetpay-aurore-status'

import {
  getOrganizationCinetPayAuroreConfig,
} from '@/lib/payments/organization-cinetpay'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// WEBHOOK CINETPAY AURORE - COTISATIONS MEMBRES
//
// PRINCIPES DE SECURITE :
//
// 1. la notification CinetPay est seulement un signal
// 2. le notify_token doit correspondre à celui reçu
//    lors de l'initialisation
// 3. le statut reçu dans le webhook n'est jamais utilisé
// 4. EWUKAI interroge directement CinetPay
// 5. seule la réponse serveur-à-serveur peut confirmer
//    le paiement
// 6. la confirmation PostgreSQL reste atomique
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

      api:
        'aurore',
    },
    {
      status: 200,

      headers: {
        'Cache-Control':
          'no-store',
      },
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
  // 1. LIRE LE JSON
  // ==========================================================

  let body:
    unknown

  try {
    body =
      await request.json()
  } catch {
    return jsonError(
      'invalid_payload',
      400
    )
  }

  if (
    !body ||
    typeof body !==
      'object'
  ) {
    return jsonError(
      'invalid_payload',
      400
    )
  }

  const payload =
    body as Record<
      string,
      unknown
    >

  // ==========================================================
  // 2. IDENTIFIANTS DE LA NOTIFICATION
  // ==========================================================

  const notifyToken =
    getString(
      payload,
      'notify_token'
    )

  const merchantTransactionId =
    getString(
      payload,
      'merchant_transaction_id'
    )

  const notificationTransactionId =
    getString(
      payload,
      'transaction_id'
    )

  if (
    !notifyToken ||
    !merchantTransactionId
  ) {
    return jsonError(
      'missing_transaction',
      400
    )
  }

  // ==========================================================
  // 3. RETROUVER NOTRE TENTATIVE
  //
  // merchant_transaction_id est la référence créée par EWUKAI.
  // ==========================================================

  const admin =
    createAdminClient()

  const {
    data: attempt,
    error:
      attemptError,
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
        provider_transaction_id,
        provider_notify_token_hash,
        expected_amount_xof,
        currency,
        selected_payment_method,
        status
      `)
      .eq(
        'provider',
        'cinetpay'
      )
      .eq(
        'provider_transaction_ref',
        merchantTransactionId
      )
      .maybeSingle()

  if (attemptError) {
    console.error(
      'EWUKAI - CINETPAY AURORE ATTEMPT LOOKUP:',
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
  // Réponse 200 volontaire pour ne pas provoquer
  // des répétitions inutiles d'une référence inconnue.
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
  // 4. VERIFIER LE NOTIFY TOKEN
  //
  // La base contient uniquement SHA-256 du token original.
  // ==========================================================

  const storedNotifyTokenHash =
    cleanText(
      attempt
        .provider_notify_token_hash
    )

  if (
    !storedNotifyTokenHash
  ) {
    console.warn(
      'EWUKAI - CINETPAY AURORE NOTIFY TOKEN HASH MISSING'
    )

    return jsonError(
      'notify_token_not_configured',
      401
    )
  }

  const receivedNotifyTokenHash =
    hashCinetPayNotifyToken(
      notifyToken
    )

  if (
    !safeEqualHex(
      receivedNotifyTokenHash,
      storedNotifyTokenHash
    )
  ) {
    console.warn(
      'EWUKAI - CINETPAY AURORE INVALID NOTIFY TOKEN'
    )

    return jsonError(
      'invalid_notify_token',
      401
    )
  }

  // ==========================================================
  // 5. COHERENCE TRANSACTION ID DE LA NOTIFICATION
  // ==========================================================

  const storedTransactionId =
    cleanText(
      attempt
        .provider_transaction_id
    )

  if (
    storedTransactionId &&
    notificationTransactionId &&
    storedTransactionId !==
      notificationTransactionId
  ) {
    await markAttemptAnomaly(
      admin,
      attempt.id,
      'TRANSACTION_ID_MISMATCH',
      null,
      notificationTransactionId
    )

    return NextResponse.json(
      {
        ok: true,
        anomaly: true,
        reason:
          'transaction_id_mismatch',
      },
      {
        status: 200,
      }
    )
  }

  // ==========================================================
  // 6. CHARGER LES IDENTIFIANTS AURORE DE L'ORGANISATION
  // ==========================================================

  let credentials:
    Awaited<
      ReturnType<
        typeof getOrganizationCinetPayAuroreConfig
      >
    >

  try {
    credentials =
      await getOrganizationCinetPayAuroreConfig(
        attempt.organization_id
      )
  } catch (error) {
    console.error(
      'EWUKAI - CINETPAY AURORE ORGANIZATION CONFIG:',
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
  // 7. VERIFICATION CANONIQUE CHEZ CINETPAY
  //
  // GET /v1/payment/{merchant_transaction_id}
  //
  // Aucun statut venant du webhook n'est utilisé.
  // ==========================================================

  let verification:
    Awaited<
      ReturnType<
        typeof verifyCinetPayAurorePayment
      >
    >

  try {
    verification =
      await verifyCinetPayAurorePayment(
        merchantTransactionId,
        credentials
      )
  } catch (error) {
    console.error(
      'EWUKAI - CINETPAY AURORE VERIFY:',
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
  // 8. COHERENCE TRANSACTION ID CANONIQUE
  // ==========================================================

  const verifiedTransactionId =
    cleanText(
      verification
        .transactionId
    )

  if (
    storedTransactionId &&
    verifiedTransactionId &&
    storedTransactionId !==
      verifiedTransactionId
  ) {
    await markAttemptAnomaly(
      admin,
      attempt.id,
      'TRANSACTION_ID_MISMATCH',
      verification
        .paymentMethod,
      verifiedTransactionId
    )

    return NextResponse.json(
      {
        ok: true,
        anomaly: true,
        reason:
          'transaction_id_mismatch',
      },
      {
        status: 200,
      }
    )
  }

  if (
    notificationTransactionId &&
    verifiedTransactionId &&
    notificationTransactionId !==
      verifiedTransactionId
  ) {
    await markAttemptAnomaly(
      admin,
      attempt.id,
      'TRANSACTION_ID_MISMATCH',
      verification
        .paymentMethod,
      verifiedTransactionId
    )

    return NextResponse.json(
      {
        ok: true,
        anomaly: true,
        reason:
          'transaction_id_mismatch',
      },
      {
        status: 200,
      }
    )
  }

  // ==========================================================
  // 9. DONNEES CANONIQUES
  // ==========================================================

  const providerCode =
    verification.code
      .trim()

  const providerStatus =
    verification.status
      .trim()
      .toUpperCase()

  const paymentMethod =
    cleanText(
      verification
        .paymentMethod
    )

  const eventRef =
    verifiedTransactionId ??
    notificationTransactionId ??
    null

  const now =
    new Date()
      .toISOString()

  // ==========================================================
  // 10. SUCCES
  //
  // Aurore :
  // code 100 + status SUCCESS
  //
  // Le endpoint de statut Aurore observé ne renvoie pas
  // le montant ni la devise.
  //
  // Le montant utilisé ci-dessous est donc le montant
  // sécurisé déjà enregistré lors de l'initialisation
  // authentifiée de CETTE référence.
  //
  // Le RPC PostgreSQL vérifiera encore :
  // - montant attendu
  // - devise XOF
  // - solde restant
  // - absence de double encaissement
  // ==========================================================

  if (
    providerCode ===
      '100' &&
    providerStatus ===
      'SUCCESS'
  ) {
    const expectedAmountXof =
      Number(
        attempt
          .expected_amount_xof
      )

    const expectedCurrency =
      String(
        attempt.currency ??
        ''
      )
        .trim()
        .toUpperCase()

    if (
      !Number.isSafeInteger(
        expectedAmountXof
      ) ||
      expectedAmountXof <=
        0 ||
      expectedCurrency !==
        'XOF'
    ) {
      await markAttemptAnomaly(
        admin,
        attempt.id,
        providerStatus,
        paymentMethod,
        eventRef
      )

      return NextResponse.json(
        {
          ok: true,
          anomaly: true,
          reason:
            'invalid_expected_amount',
        },
        {
          status: 200,
        }
      )
    }

    const {
      data:
        confirmation,

      error:
        confirmationError,
    } =
      await admin.rpc(
        'confirm_cinetpay_member_payment',
        {
          target_attempt_id:
            attempt.id,

          target_amount_xof:
            expectedAmountXof,

          target_currency:
            'XOF',

          target_payment_method:
            paymentMethod,

          target_operator_id:
            verifiedTransactionId,

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
        'EWUKAI - CINETPAY AURORE CONFIRM:',
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
        status:
          'confirmed',
        confirmation,
      },
      {
        status: 200,
      }
    )
  }

  // ==========================================================
  // 11. ECHEC FINAL
  //
  // Codes documentés comme finaux :
  // 2005 = INSUFFICIENT_BALANCE
  // 2010 = FAILED
  // ==========================================================

  if (
    [
      '2005',
      '2010',
    ].includes(
      providerCode
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
            providerStatus ||
            providerCode,

          provider_payment_method:
            paymentMethod,

          provider_operator_id:
            verifiedTransactionId,

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
        'EWUKAI - CINETPAY AURORE FAILED UPDATE:',
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
        status:
          'failed',
      },
      {
        status: 200,
      }
    )
  }

  // ==========================================================
  // 12. AUTRES STATUTS
  //
  // INITIATED / PENDING / EXPIRED / OTP...
  //
  // On ne confirme rien.
  // On conserve la tentative en attente car CinetPay
  // peut encore renvoyer un nouvel état.
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
          providerCode ||
          'PENDING',

        provider_payment_method:
          paymentMethod,

        provider_operator_id:
          verifiedTransactionId,

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
      'EWUKAI - CINETPAY AURORE PENDING UPDATE:',
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

      status:
        'pending',

      provider_code:
        providerCode,

      provider_status:
        providerStatus,
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

  eventRef:
    | string
    | null
) {
  const now =
    new Date()
      .toISOString()

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
      'EWUKAI - CINETPAY AURORE ANOMALY:',
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
// LIRE UNE CHAINE DU JSON
// ============================================================

function getString(
  payload:
    Record<
      string,
      unknown
    >,

  key:
    string
) {
  const value =
    payload[
      key
    ]

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
// TEXTE NULLABLE
// ============================================================

function cleanText(
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
// COMPARAISON CONSTANT-TIME DES HASH
// ============================================================

function safeEqualHex(
  left:
    string,

  right:
    string
) {
  const normalizedLeft =
    left
      .trim()
      .toLowerCase()

  const normalizedRight =
    right
      .trim()
      .toLowerCase()

  if (
    !/^[0-9a-f]{64}$/
      .test(
        normalizedLeft
      ) ||
    !/^[0-9a-f]{64}$/
      .test(
        normalizedRight
      )
  ) {
    return false
  }

  const leftBuffer =
    Buffer.from(
      normalizedLeft,
      'hex'
    )

  const rightBuffer =
    Buffer.from(
      normalizedRight,
      'hex'
    )

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  )
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

      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  )
}

// ============================================================
// SAFE ERROR
//
// Ne jamais journaliser les identifiants ou tokens.
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