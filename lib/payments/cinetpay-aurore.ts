import 'server-only'

import {
  createHash,
} from 'node:crypto'

// ============================================================
// EWUKAI
// CINETPAY AURORE 1.0
//
// Fonctions actuellement prises en charge :
// - authentification OAuth
// - initialisation d'un paiement
// - empreinte sécurisée du notify_token
//
// IMPORTANT :
// - aucun API PASSWORD n'est loggé
// - aucun access_token n'est stocké en base
// - aucun notify_token brut ne doit être stocké en base
// ============================================================

// ============================================================
// TYPES GENERAUX
// ============================================================

export type CinetPayAuroreEnvironment =
  | 'sandbox'
  | 'production'

export type CinetPayAuroreCredentials = {
  apiKey: string

  apiPassword: string

  environment:
    CinetPayAuroreEnvironment
}

// ============================================================
// AUTHENTIFICATION
// ============================================================

export type CinetPayAuroreAccessToken = {
  accessToken: string

  tokenType:
    'Bearer'

  expiresIn: number

  userEmail:
    | string
    | null
}

type CinetPayAuroreAuthResponse = {
  code?:
    | number
    | string
    | null

  status?:
    | string
    | null

  access_token?:
    | string
    | null

  token_type?:
    | string
    | null

  expires_in?:
    | number
    | string
    | null

  user_email?:
    | string
    | null

  message?:
    | string
    | null
}

// ============================================================
// INITIALISATION PAIEMENT
// ============================================================

export type CinetPayAurorePaymentInput = {
  merchantTransactionId: string

  amountXof: number

  designation: string

  clientFirstName: string

  clientLastName: string

  clientEmail: string

  clientPhoneNumber?:
    | string
    | null

  successUrl: string

  failedUrl: string

  notifyUrl: string
}

export type CinetPayAurorePaymentResult = {
  merchantTransactionId: string

  transactionId:
    | string
    | null

  paymentToken:
    | string
    | null

  notifyToken: string

  paymentUrl: string

  launchUrl:
    | string
    | null
}

// ============================================================
// REPONSE INITIALISATION
//
// Selon la réponse retournée par CinetPay,
// les informations peuvent être directement
// à la racine ou éventuellement dans "data".
// ============================================================

type CinetPayAurorePaymentData = {
  merchant_transaction_id?:
    | string
    | null

  transaction_id?:
    | string
    | null

  payment_token?:
    | string
    | null

  notify_token?:
    | string
    | null

  payment_url?:
    | string
    | null

  launch_url?:
    | string
    | null
}

type CinetPayAurorePaymentResponse =
  CinetPayAurorePaymentData & {
    code?:
      | number
      | string
      | null

    status?:
      | string
      | null

    message?:
      | string
      | null

    data?:
      | CinetPayAurorePaymentData
      | null
  }

// ============================================================
// OBTENIR UN ACCESS TOKEN
//
// POST /v1/oauth/login
// ============================================================

export async function getCinetPayAuroreAccessToken(
  credentials:
    CinetPayAuroreCredentials
): Promise<CinetPayAuroreAccessToken> {
  const apiKey =
    credentials.apiKey
      .trim()

  const apiPassword =
    credentials.apiPassword
      .trim()

  if (
    !apiKey ||
    !apiPassword
  ) {
    throw new Error(
      'CinetPay Aurore credentials are incomplete.'
    )
  }

  const baseUrl =
    getCinetPayAuroreBaseUrl(
      credentials.environment
    )

  const response =
    await fetch(
      `${baseUrl}/v1/oauth/login`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',

          Accept:
            'application/json',

          'User-Agent':
            'EWUKAI/1.0',
        },

        body:
          JSON.stringify({
            api_key:
              apiKey,

            api_password:
              apiPassword,
          }),

        signal:
          AbortSignal.timeout(
            20_000
          ),
      }
    )

  const payload =
    await safeJson<CinetPayAuroreAuthResponse>(
      response
    )

  const code =
    payload?.code != null
      ? String(
          payload.code
        )
      : String(
          response.status
        )

  const status =
    payload?.status
      ?.trim()
      .toUpperCase()

  const accessToken =
    payload?.access_token
      ?.trim()

  const tokenType =
    payload?.token_type
      ?.trim()
      .toLowerCase()

  const expiresIn =
    Number(
      payload?.expires_in
    )

  if (
    !response.ok ||
    code !== '200' ||
    status !== 'OK' ||
    !accessToken ||
    tokenType !== 'bearer' ||
    !Number.isFinite(
      expiresIn
    ) ||
    expiresIn <= 0
  ) {
    throw new CinetPayAuroreApiError(
      payload?.message ||
        'CinetPay Aurore authentication failed.',

      code
    )
  }

  return {
    accessToken,

    tokenType:
      'Bearer',

    expiresIn:
      Math.floor(
        expiresIn
      ),

    userEmail:
      payload?.user_email
        ?.trim() ||
      null,
  }
}

// ============================================================
// INITIALISER UN PAIEMENT
//
// POST /v1/payment
// ============================================================

export async function initializeCinetPayAurorePayment(
  input:
    CinetPayAurorePaymentInput,

  credentials:
    CinetPayAuroreCredentials
): Promise<CinetPayAurorePaymentResult> {
  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const merchantTransactionId =
    input.merchantTransactionId
      .trim()

  const designation =
    input.designation
      .trim()

  const clientFirstName =
    input.clientFirstName
      .trim()

  const clientLastName =
    input.clientLastName
      .trim()

  const clientEmail =
    input.clientEmail
      .trim()

  const clientPhoneNumber =
    input.clientPhoneNumber
      ?.trim() ||
    null

  // ==========================================================
  // VALIDATION DONNEES
  // ==========================================================

  if (
    !merchantTransactionId ||
    !designation ||
    !clientFirstName ||
    !clientLastName ||
    !clientEmail
  ) {
    throw new Error(
      'CinetPay payment information is incomplete.'
    )
  }

  if (
    merchantTransactionId.length >
    30
  ) {
    throw new Error(
      'CinetPay merchant transaction ID exceeds 30 characters.'
    )
  }

  validateAmount(
    input.amountXof
  )

  validateEmail(
    clientEmail
  )

  // ==========================================================
  // URLS
  // ==========================================================

  validateCallbackUrl(
    input.successUrl
  )

  validateCallbackUrl(
    input.failedUrl
  )

  validateCallbackUrl(
    input.notifyUrl
  )

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
  // APPEL CINETPAY
  // ==========================================================

  const response =
    await fetch(
      `${baseUrl}/v1/payment`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',

          Accept:
            'application/json',

          Authorization:
            `Bearer ${authentication.accessToken}`,

          'User-Agent':
            'EWUKAI/1.0',
        },

        body:
          JSON.stringify({
            currency:
              'XOF',

            merchant_transaction_id:
              merchantTransactionId,

            amount:
              input.amountXof,

            lang:
              'fr',

            designation,

            client_email:
              clientEmail,

            client_phone_number:
              clientPhoneNumber ??
              undefined,

            client_first_name:
              clientFirstName,

            client_last_name:
              clientLastName,

            direct_pay:
              false,

            success_url:
              input.successUrl,

            failed_url:
              input.failedUrl,

            notify_url:
              input.notifyUrl,
          }),

        signal:
          AbortSignal.timeout(
            25_000
          ),
      }
    )

  const payload =
    await safeJson<CinetPayAurorePaymentResponse>(
      response
    )

  // ==========================================================
  // VERIFICATION REPONSE
  // ==========================================================

  const code =
    payload?.code != null
      ? String(
          payload.code
        )
      : String(
          response.status
        )

  const status =
    payload?.status
      ?.trim()
      .toUpperCase()

  if (
    !response.ok ||
    !payload ||
    code !== '200' ||
    status !== 'OK'
  ) {
    throw new CinetPayAuroreApiError(
      payload?.message ||
        'CinetPay Aurore payment initialization failed.',

      code
    )
  }

  const paymentData =
    payload.data ??
    payload

  // ==========================================================
  // DONNEES DE PAIEMENT
  // ==========================================================

  const paymentUrl =
    paymentData
      .payment_url
      ?.trim()

  const notifyToken =
    paymentData
      .notify_token
      ?.trim()

  const returnedMerchantTransactionId =
    paymentData
      .merchant_transaction_id
      ?.trim() ||
    merchantTransactionId

  const transactionId =
    paymentData
      .transaction_id
      ?.trim() ||
    null

  const paymentToken =
    paymentData
      .payment_token
      ?.trim() ||
    null

  const launchUrl =
    paymentData
      .launch_url
      ?.trim() ||
    null

  // ==========================================================
  // REPONSE MINIMALE OBLIGATOIRE
  // ==========================================================

  if (
    !paymentUrl ||
    !notifyToken
  ) {
    throw new CinetPayAuroreApiError(
      'CinetPay returned an incomplete payment initialization response.',

      code
    )
  }

  // ==========================================================
  // SECURITE URL
  // ==========================================================

  assertHttpsUrl(
    paymentUrl
  )

  if (launchUrl) {
    assertHttpsUrl(
      launchUrl
    )
  }

  // ==========================================================
  // COHERENCE REFERENCE
  // ==========================================================

  if (
    returnedMerchantTransactionId !==
    merchantTransactionId
  ) {
    throw new CinetPayAuroreApiError(
      'CinetPay returned an unexpected merchant transaction ID.',

      code
    )
  }

  return {
    merchantTransactionId:
      returnedMerchantTransactionId,

    transactionId,

    paymentToken,

    notifyToken,

    paymentUrl,

    launchUrl,
  }
}

// ============================================================
// EMPREINTE DU NOTIFY TOKEN
//
// On conserve uniquement SHA-256 en base.
// Le token brut reste uniquement en mémoire pendant
// l'initialisation.
// ============================================================

export function hashCinetPayNotifyToken(
  value: string
) {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new Error(
      'CinetPay notify token is required.'
    )
  }

  return createHash(
    'sha256'
  )
    .update(
      normalized,
      'utf8'
    )
    .digest(
      'hex'
    )
}

// ============================================================
// BASE URL CINETPAY
// ============================================================

export function getCinetPayAuroreBaseUrl(
  environment:
    CinetPayAuroreEnvironment
) {
  if (
    environment ===
    'production'
  ) {
    return 'https://api.cinetpay.co'
  }

  return 'https://api.cinetpay.net'
}

// ============================================================
// VALIDATION MONTANT
// ============================================================

function validateAmount(
  amountXof: number
) {
  if (
    !Number.isSafeInteger(
      amountXof
    ) ||
    amountXof <= 0
  ) {
    throw new Error(
      'Invalid CinetPay payment amount.'
    )
  }
}

// ============================================================
// VALIDATION EMAIL
// ============================================================

function validateEmail(
  value: string
) {
  if (
    value.length >
      254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(
        value
      )
  ) {
    throw new Error(
      'Invalid CinetPay client email.'
    )
  }
}

// ============================================================
// VALIDATION URL CALLBACK
//
// La documentation Aurore limite les URLs à 120 caractères.
// ============================================================

function validateCallbackUrl(
  value: string
) {
  const normalized =
    value.trim()

  if (
    !normalized ||
    normalized.length >
      120
  ) {
    throw new Error(
      'Invalid CinetPay callback URL.'
    )
  }

  assertHttpsUrl(
    normalized
  )
}

// ============================================================
// VALIDATION HTTPS
// ============================================================

function assertHttpsUrl(
  value: string
) {
  let url:
    URL

  try {
    url =
      new URL(
        value
      )
  } catch {
    throw new Error(
      'Invalid CinetPay URL.'
    )
  }

  if (
    url.protocol !==
    'https:'
  ) {
    throw new Error(
      'CinetPay URL must use HTTPS.'
    )
  }
}

// ============================================================
// ERREUR API CINETPAY
// ============================================================

export class CinetPayAuroreApiError
  extends Error {
  readonly code: string

  constructor(
    message: string,
    code: string
  ) {
    super(
      message
    )

    this.name =
      'CinetPayAuroreApiError'

    this.code =
      code
  }
}

// ============================================================
// LECTURE JSON SECURISEE
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