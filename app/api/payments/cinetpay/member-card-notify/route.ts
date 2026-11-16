import {
  NextResponse,
} from 'next/server'

import {
  verifyCinetPayHmacWithSecret,
  verifyCinetPayTransactionWithCredentials,
} from '@/lib/payments/cinetpay'

import {
  getPlatformCinetPayCheckoutVerificationConfig,
} from '@/lib/payments/platform-cinetpay'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// WEBHOOK CINETPAY CHECKOUT V2 - COTISATIONS MEMBRES
//
// CARTE BANCAIRE VISA / MASTERCARD
//
// PRINCIPES DE SECURITE :
//
// 1. la notification CinetPay est seulement un signal
// 2. le HMAC x-token doit être valide
// 3. cpm_trans_id doit correspondre à une tentative EWUKAI
// 4. le statut reçu dans le POST n'est jamais utilisé
//    pour confirmer le paiement
// 5. EWUKAI interroge directement CinetPay via
//    /v2/payment/check
// 6. le montant et la devise canoniques sont comparés
//    aux valeurs attendues en base
// 7. seule la réponse serveur-à-serveur peut confirmer
//    le paiement
// 8. la confirmation PostgreSQL reste atomique et idempotente
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
        'member-cinetpay-card-notify',

      api:
        'checkout-v2',
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
// NOTIFICATION CINETPAY CHECKOUT V2
// ============================================================

export async function POST(
  request: Request
) {
  // ==========================================================
  // 1. LIRE LE FORMULAIRE CINETPAY
  //
  // Checkout v2 transmet les valeurs cpm_* dans le corps POST.
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

  const merchantTransactionId =
    formValue(
      formData,
      'cpm_trans_id'
    )

  const notifiedSiteId =
    formValue(
      formData,
      'cpm_site_id'
    )

  const receivedToken =
    request.headers.get(
      'x-token'
    )

  if (
    !merchantTransactionId ||
    !notifiedSiteId ||
    !receivedToken
  ) {
    return jsonError(
      'missing_notification_data',
      400
    )
  }

  // ==========================================================
  // 2. CHARGER LES IDENTIFIANTS CHECKOUT V2
  //
  // IMPORTANT :
  // Le chargeur de vérification continue à fonctionner pour une
  // transaction déjà initiée même si les nouveaux paiements carte
  // ont ensuite été désactivés dans l'administration.
  // ==========================================================

  let credentials:
    Awaited<
      ReturnType<
        typeof getPlatformCinetPayCheckoutVerificationConfig
      >
    >

  try {
    credentials =
      await getPlatformCinetPayCheckoutVerificationConfig()
  } catch (error) {
    console.error(
      'EWUKAI - CINETPAY CHECKOUT WEBHOOK CONFIG:',
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
  // 3. VERIFIER LE HMAC x-token
  // ==========================================================

  let validHmac =
    false

  try {
    validHmac =
      verifyCinetPayHmacWithSecret({
        formData,

        receivedToken,

        secretKey:
          credentials.secretKey,
      })
  } catch (error) {
    console.error(
      'EWUKAI - CINETPAY CHECKOUT HMAC:',
      safeError(
        error
      )
    )

    return jsonError(
      'hmac_verification_error',
      500
    )
  }

  if (!validHmac) {
    console.warn(
      'EWUKAI - CINETPAY CHECKOUT INVALID HMAC'
    )

    return jsonError(
      'invalid_hmac',
      401
    )
  }

  // ==========================================================
  // 4. COHERENCE DU SITE ID
  // ==========================================================

  if (
    notifiedSiteId !==
      credentials.siteId
  ) {
    console.warn(
      'EWUKAI - CINETPAY CHECKOUT SITE ID MISMATCH'
    )

    return jsonError(
      'invalid_site_id',
      401
    )
  }

  // ==========================================================
  // 5. RETROUVER LA TENTATIVE EWUKAI
  // ==========================================================

  const admin =
    createAdminClient()

  const {
    data:
      attempt,

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
      'EWUKAI - CINETPAY CHECKOUT ATTEMPT LOOKUP:',
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
  // 200 volontaire : une référence étrangère ne doit pas
  // provoquer des répétitions inutiles.
  // ==========================================================

  if (!attempt) {
    return NextResponse.json(
      {
        ok: true,

        ignored: true,
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

  // ==========================================================
  // 6. IDEMPOTENCE
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

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  }

  // ==========================================================
  // 7. CETTE ROUTE EST RESERVEE AUX TENTATIVES CARTE
  //
  // Le flux carte crée la tentative avec payment_method=other.
  // Cela empêche un webhook Checkout v2 de traiter par erreur
  // une tentative Aurore Mobile Money.
  // ==========================================================

  if (
    cleanText(
      attempt.selected_payment_method
    ) !==
      'other'
  ) {
    await markAttemptAnomaly(
      admin,
      attempt.id,
      'CHECKOUT_METHOD_MISMATCH',
      null,
      merchantTransactionId
    )

    return NextResponse.json(
      {
        ok: true,

        anomaly: true,

        reason:
          'payment_method_mismatch',
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

  // ==========================================================
  // 8. VERIFICATION CANONIQUE CHEZ CINETPAY
  //
  // POST /v2/payment/check
  //
  // Aucun statut reçu directement dans le webhook n'est utilisé
  // pour confirmer la cotisation.
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
        merchantTransactionId,
        {
          apiKey:
            credentials.apiKey,

          siteId:
            credentials.siteId,

          secretKey:
            credentials.secretKey,

          channels:
            'CREDIT_CARD',
        }
      )
  } catch (error) {
    console.error(
      'EWUKAI - CINETPAY CHECKOUT VERIFY:',
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
  // 9. DONNEES CANONIQUES
  // ==========================================================

  const providerCode =
    cleanText(
      verification.code
    )
      ?.toUpperCase() ||
    ''

  const providerStatus =
    cleanText(
      verification.data
        ?.status
    )
      ?.toUpperCase() ||
    ''

  const paymentMethod =
    cleanText(
      verification.data
        ?.payment_method
    )

  const operatorId =
    cleanText(
      verification.data
        ?.operator_id
    )

  const apiResponseId =
    cleanText(
      verification.api_response_id
    )

  const eventRef =
    apiResponseId ??
    operatorId ??
    merchantTransactionId

  const now =
    new Date()
      .toISOString()

  // ==========================================================
  // 10. SUCCES CANONIQUE
  //
  // Checkout v2 :
  // - code 00
  // - status ACCEPTED
  // ==========================================================

  if (
    providerCode ===
      '00' &&
    providerStatus ===
      'ACCEPTED'
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

    const verifiedAmountXof =
      normalizeAmount(
        verification.data
          ?.amount
      )

    const verifiedCurrency =
      cleanText(
        verification.data
          ?.currency
      )
        ?.toUpperCase() ||
      ''

    // --------------------------------------------------------
    // Montant ou devise attendus invalides en base
    // --------------------------------------------------------

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
        'INVALID_EXPECTED_AMOUNT',
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

          headers: {
            'Cache-Control':
              'no-store',
          },
        }
      )
    }

    // --------------------------------------------------------
    // Montant retourné par CinetPay absent ou incohérent
    // --------------------------------------------------------

    if (
      verifiedAmountXof ===
        null ||
      verifiedAmountXof !==
        expectedAmountXof
    ) {
      await markAttemptAnomaly(
        admin,
        attempt.id,
        'AMOUNT_MISMATCH',
        paymentMethod,
        eventRef
      )

      return NextResponse.json(
        {
          ok: true,

          anomaly: true,

          reason:
            'amount_mismatch',
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

    // --------------------------------------------------------
    // Devise retournée par CinetPay incohérente
    // --------------------------------------------------------

    if (
      verifiedCurrency !==
        expectedCurrency
    ) {
      await markAttemptAnomaly(
        admin,
        attempt.id,
        'CURRENCY_MISMATCH',
        paymentMethod,
        eventRef
      )

      return NextResponse.json(
        {
          ok: true,

          anomaly: true,

          reason:
            'currency_mismatch',
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

    // --------------------------------------------------------
    // Confirmation atomique PostgreSQL
    // --------------------------------------------------------

    const providerPaidAt =
      normalizeProviderDate(
        verification.data
          ?.payment_date
      ) ??
      now

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
            verifiedAmountXof,

          target_currency:
            verifiedCurrency,

          target_payment_method:
            paymentMethod,

          target_operator_id:
            operatorId,

          target_event_ref:
            eventRef,

          target_provider_paid_at:
            providerPaidAt,
        }
      )

    if (
      confirmationError
    ) {
      console.error(
        'EWUKAI - CINETPAY CHECKOUT CONFIRM:',
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

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  }

  // ==========================================================
  // 11. ECHEC FINAL CANONIQUE
  //
  // On ne se base jamais sur cpm_error_message du webhook.
  // Seul le statut renvoyé par /v2/payment/check est utilisé.
  // ==========================================================

  if (
    isFinalFailure(
      providerCode,
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
            providerStatus ||
            providerCode ||
            'FAILED',

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
        'EWUKAI - CINETPAY CHECKOUT FAILED UPDATE:',
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

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  }

  // ==========================================================
  // 12. STATUT EN ATTENTE / NON FINAL
  //
  // Exemple : WAITING_FOR_CUSTOMER.
  // On ne confirme ni n'échoue définitivement la cotisation.
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
      'EWUKAI - CINETPAY CHECKOUT PENDING UPDATE:',
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

      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  )
}

// ============================================================
// ECHEC FINAL
// ============================================================

function isFinalFailure(
  providerCode: string,
  providerStatus: string
) {
  if (
    [
      'REFUSED',
      'REJECTED',
      'FAILED',
      'CANCELLED',
      'CANCELED',
    ].includes(
      providerStatus
    )
  ) {
    return true
  }

  // 627 est documenté par CinetPay comme transaction annulée.
  if (
    providerCode ===
      '627'
  ) {
    return true
  }

  return false
}

// ============================================================
// NORMALISER LE MONTANT
// ============================================================

function normalizeAmount(
  value:
    | string
    | number
    | null
    | undefined
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  const amount =
    Number(
      value
    )

  if (
    !Number.isSafeInteger(
      amount
    ) ||
    amount <=
      0
  ) {
    return null
  }

  return amount
}

// ============================================================
// DATE FOURNISSEUR
// ============================================================

function normalizeProviderDate(
  value:
    | string
    | null
    | undefined
) {
  const text =
    value
      ?.trim()

  if (!text) {
    return null
  }

  // Format CinetPay fréquemment observé :
  // YYYY-MM-DD HH:mm:ss
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
      .test(
        text
      )
      ? `${text.replace(
          ' ',
          'T'
        )}Z`
      : text

  const date =
    new Date(
      normalized
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date.toISOString()
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
      'EWUKAI - CINETPAY CHECKOUT ANOMALY:',
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

function formValue(
  formData: FormData,
  key: string
) {
  const value =
    formData.get(
      key
    )

  if (
    typeof value !==
      'string'
  ) {
    return ''
  }

  return value.trim()
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
    value
      ?.trim()

  return normalized ||
    null
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
// Ne jamais journaliser les identifiants CinetPay,
// Secret Key, API Key, x-token ou données bancaires.
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
