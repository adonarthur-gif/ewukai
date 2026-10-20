import 'server-only'

import {
  CinetPayAuroreApiError,
  getCinetPayAuroreAccessToken,
  getCinetPayAuroreBaseUrl,
} from '@/lib/payments/cinetpay-aurore'

import type {
  CinetPayAuroreCredentials,
} from '@/lib/payments/cinetpay-aurore'

// ============================================================
// EWUKAI
// VERIFICATION D'UN PAIEMENT CINETPAY AURORE
//
// GET /v1/payment/{merchant_transaction_id}
//
// IMPORTANT :
// le webhook ne fait jamais confiance au statut reçu
// directement dans la notification.
// Cette vérification serveur-à-serveur fait foi.
// ============================================================

export type CinetPayAurorePaymentStatus = {
  code: string

  status: string

  merchantTransactionId:
    string

  transactionId:
    | string
    | null

  paymentMethod:
    | string
    | null

  user: {
    name:
      | string
      | null

    email:
      | string
      | null

    phoneNumber:
      | string
      | null
  } | null
}

// ============================================================
// REPONSE CINETPAY
// ============================================================

type CinetPayAuroreStatusData = {
  code?:
    | number
    | string
    | null

  status?:
    | string
    | null

  merchant_transaction_id?:
    | string
    | null

  transaction_id?:
    | string
    | null

  payment_method?:
    | string
    | null

  user?: {
    name?:
      | string
      | null

    email?:
      | string
      | null

    phone_number?:
      | string
      | null
  } | null

  message?:
    | string
    | null
}

type CinetPayAuroreStatusResponse =
  CinetPayAuroreStatusData & {
    data?:
      | CinetPayAuroreStatusData
      | null
  }

// ============================================================
// VERIFIER UNE TRANSACTION
// ============================================================

export async function verifyCinetPayAurorePayment(
  merchantTransactionId: string,

  credentials:
    CinetPayAuroreCredentials
): Promise<CinetPayAurorePaymentStatus> {
  const normalizedId =
    merchantTransactionId
      .trim()

  if (
    !normalizedId ||
    normalizedId.length >
      30
  ) {
    throw new Error(
      'Invalid CinetPay merchant transaction ID.'
    )
  }

  // ==========================================================
  // AUTHENTIFICATION OAUTH
  // ==========================================================

  const authentication =
    await getCinetPayAuroreAccessToken(
      credentials
    )

  const baseUrl =
    getCinetPayAuroreBaseUrl(
      credentials.environment
    )

  // ==========================================================
  // VERIFICATION CHEZ CINETPAY
  // ==========================================================

  const response =
    await fetch(
      `${baseUrl}/v1/payment/${encodeURIComponent(
        normalizedId
      )}`,
      {
        method:
          'GET',

        headers: {
          Accept:
            'application/json',

          Authorization:
            `Bearer ${authentication.accessToken}`,

          'User-Agent':
            'EWUKAI/1.0',
        },

        signal:
          AbortSignal.timeout(
            20_000
          ),
      }
    )

  const payload =
    await safeJson<CinetPayAuroreStatusResponse>(
      response
    )

  if (
    !response.ok ||
    !payload
  ) {
    throw new CinetPayAuroreApiError(
      payload?.message ||
        'CinetPay Aurore payment verification failed.',

      payload?.code != null
        ? String(
            payload.code
          )
        : String(
            response.status
          )
    )
  }

  // ==========================================================
  // DONNEES
  // ==========================================================

  const data =
    payload.data ??
    payload

  const code =
    data.code != null
      ? String(
          data.code
        )
      : String(
          response.status
        )

  const status =
    data.status
      ?.trim()
      .toUpperCase() ||
    ''

  const returnedMerchantTransactionId =
    data
      .merchant_transaction_id
      ?.trim() ||
    normalizedId

  // ==========================================================
  // COHERENCE DE LA REFERENCE
  // ==========================================================

  if (
    returnedMerchantTransactionId !==
    normalizedId
  ) {
    throw new CinetPayAuroreApiError(
      'CinetPay returned an unexpected merchant transaction ID.',

      code
    )
  }

  // ==========================================================
  // UTILISATEUR
  // ==========================================================

  const user =
    data.user
      ? {
          name:
            cleanText(
              data.user.name
            ),

          email:
            cleanText(
              data.user.email
            ),

          phoneNumber:
            cleanText(
              data.user
                .phone_number
            ),
        }
      : null

  return {
    code,

    status,

    merchantTransactionId:
      returnedMerchantTransactionId,

    transactionId:
      cleanText(
        data.transaction_id
      ),

    paymentMethod:
      cleanText(
        data.payment_method
      ),

    user,
  }
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
// JSON SAFE
// ============================================================

async function safeJson<T>(
  response: Response
): Promise<T | null> {
  try {
    return (
      await response.json()
    ) as T
  } catch {
    return null
  }
}