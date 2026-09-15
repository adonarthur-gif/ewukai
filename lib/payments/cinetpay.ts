import 'server-only'

import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto'

const CINETPAY_PAYMENT_URL =
  'https://api-checkout.cinetpay.com/v2/payment'

const CINETPAY_CHECK_URL =
  'https://api-checkout.cinetpay.com/v2/payment/check'

// ============================================================
// TYPES
// ============================================================

export type CinetPayCredentials = {
  apiKey: string
  siteId: string
  secretKey: string
  channels: string
}

export type CinetPayInitializationInput = {
  transactionId: string
  amountXof: number
  description: string
  notifyUrl: string
  returnUrl: string
  metadata?: string | null
  invoiceData?: Record<string, string>
}

export type CinetPayInitializationResult = {
  paymentToken: string
  paymentUrl: string
  apiResponseId?: string | null
}

export type CinetPayVerificationData = {
  amount?: string | number | null
  currency?: string | null
  status?: string | null
  payment_method?: string | null
  description?: string | null
  metadata?: string | null
  operator_id?: string | null
  payment_date?: string | null
  fund_availability_date?: string | null
}

export type CinetPayVerificationResult = {
  code?: string | null
  message?: string | null
  description?: string | null
  data?: CinetPayVerificationData | null
  api_response_id?: string | null
}

type CinetPayInitializationResponse = {
  code?: string | null
  message?: string | null
  description?: string | null

  data?: {
    payment_token?: string | null
    payment_url?: string | null
  } | null

  api_response_id?: string | null
}

// ============================================================
// INITIALISATION CINETPAY - COMPTE EWUKAI
//
// Utilisé notamment pour les abonnements SaaS.
// Continue à utiliser .env.local.
// ============================================================

export async function initializeCinetPayPayment(
  input: CinetPayInitializationInput
): Promise<CinetPayInitializationResult> {
  return initializeCinetPayPaymentWithCredentials(
    input,
    getCinetPayConfig()
  )
}

// ============================================================
// INITIALISATION CINETPAY - COMPTE D'UNE MUTUELLE
//
// Ici les identifiants sont fournis explicitement par
// le serveur après lecture et déchiffrement en base.
// ============================================================

export async function initializeCinetPayPaymentWithCredentials(
  input: CinetPayInitializationInput,
  credentials: CinetPayCredentials
): Promise<CinetPayInitializationResult> {
  const config =
    normalizeCredentials(
      credentials
    )

  validateAmount(
    input.amountXof
  )

  const response =
    await fetch(
      CINETPAY_PAYMENT_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Accept:
            'application/json',

          'User-Agent':
            'AfriClub/1.0',
        },

        body:
          JSON.stringify({
            apikey:
              config.apiKey,

            site_id:
              config.siteId,

            transaction_id:
              input.transactionId,

            amount:
              input.amountXof,

            currency:
              'XOF',

            description:
              input.description,

            notify_url:
              input.notifyUrl,

            return_url:
              input.returnUrl,

            channels:
              config.channels,

            lang:
              'FR',

            metadata:
              input.metadata ??
              undefined,

            invoice_data:
              input.invoiceData ??
              undefined,
          }),

        signal:
          AbortSignal.timeout(
            20_000
          ),
      }
    )

  const payload =
    await safeJson<CinetPayInitializationResponse>(
      response
    )

  if (
    !response.ok ||
    payload?.code !== '201' ||
    !payload.data?.payment_token ||
    !payload.data?.payment_url
  ) {
    throw new CinetPayApiError(
      payload?.message ||
        'CinetPay initialization failed.',

      payload?.code ??
        String(
          response.status
        ),

      payload?.description ??
        null
    )
  }

  assertHttpsUrl(
    payload.data.payment_url
  )

  return {
    paymentToken:
      payload.data.payment_token,

    paymentUrl:
      payload.data.payment_url,

    apiResponseId:
      payload.api_response_id ??
      null,
  }
}

// ============================================================
// VERIFICATION TRANSACTION - COMPTE EWUKAI
// ============================================================

export async function verifyCinetPayTransaction(
  transactionId: string
): Promise<CinetPayVerificationResult> {
  return verifyCinetPayTransactionWithCredentials(
    transactionId,
    getCinetPayConfig()
  )
}

// ============================================================
// VERIFICATION TRANSACTION - COMPTE D'UNE MUTUELLE
// ============================================================

export async function verifyCinetPayTransactionWithCredentials(
  transactionId: string,
  credentials: CinetPayCredentials
): Promise<CinetPayVerificationResult> {
  const normalizedTransactionId =
    transactionId.trim()

  if (
    !normalizedTransactionId
  ) {
    throw new Error(
      'CinetPay transaction ID is required.'
    )
  }

  const config =
    normalizeCredentials(
      credentials
    )

  const response =
    await fetch(
      CINETPAY_CHECK_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Accept:
            'application/json',

          'User-Agent':
            'AfriClub/1.0',
        },

        body:
          JSON.stringify({
            apikey:
              config.apiKey,

            site_id:
              config.siteId,

            transaction_id:
              normalizedTransactionId,
          }),

        signal:
          AbortSignal.timeout(
            20_000
          ),
      }
    )

  const payload =
    await safeJson<CinetPayVerificationResult>(
      response
    )

  if (
    !response.ok ||
    !payload
  ) {
    throw new CinetPayApiError(
      'CinetPay verification failed.',
      String(
        response.status
      ),
      null
    )
  }

  return payload
}

// ============================================================
// CHAMPS HMAC CINETPAY
// ============================================================

const HMAC_FIELDS = [
  'cpm_site_id',
  'cpm_trans_id',
  'cpm_trans_date',
  'cpm_amount',
  'cpm_currency',
  'signature',
  'payment_method',
  'cel_phone_num',
  'cpm_phone_prefixe',
  'cpm_language',
  'cpm_version',
  'cpm_payment_config',
  'cpm_page_action',
  'cpm_custom',
  'cpm_designation',
  'cpm_error_message',
] as const

// ============================================================
// HMAC - COMPTE EWUKAI
// ============================================================

export function verifyCinetPayHmac({
  formData,
  receivedToken,
}: {
  formData: FormData
  receivedToken: string | null
}) {
  return verifyCinetPayHmacWithSecret({
    formData,
    receivedToken,
    secretKey:
      getCinetPayConfig()
        .secretKey,
  })
}

// ============================================================
// HMAC - COMPTE D'UNE MUTUELLE
// ============================================================

export function verifyCinetPayHmacWithSecret({
  formData,
  receivedToken,
  secretKey,
}: {
  formData: FormData
  receivedToken: string | null
  secretKey: string
}) {
  if (!receivedToken) {
    return false
  }

  const normalizedSecret =
    secretKey.trim()

  if (
    !normalizedSecret
  ) {
    throw new Error(
      'CinetPay secret key is missing.'
    )
  }

  const source =
    HMAC_FIELDS
      .map(
        (field) =>
          formValue(
            formData,
            field
          )
      )
      .join('')

  const expected =
    createHmac(
      'sha256',
      normalizedSecret
    )
      .update(
        source,
        'utf8'
      )
      .digest('hex')
      .toLowerCase()

  const received =
    receivedToken
      .trim()
      .toLowerCase()

  if (
    received.length !==
    expected.length
  ) {
    return false
  }

  return timingSafeEqual(
    Buffer.from(
      received,
      'utf8'
    ),

    Buffer.from(
      expected,
      'utf8'
    )
  )
}

// ============================================================
// SITE ID EWUKAI
//
// Conservé pour le webhook des abonnements SaaS.
// ============================================================

export function getCinetPaySiteId() {
  return getCinetPayConfig()
    .siteId
}

// ============================================================
// URL PUBLIQUE
// ============================================================

export function getCinetPayPublicBaseUrl() {
  const raw =
    process.env
      .CINETPAY_PUBLIC_URL ??
    process.env
      .NEXT_PUBLIC_SITE_URL ??
    ''

  if (!raw) {
    throw new Error(
      'CINETPAY_PUBLIC_URL is missing.'
    )
  }

  const url =
    new URL(raw)

  if (
    ![
      'http:',
      'https:',
    ].includes(
      url.protocol
    )
  ) {
    throw new Error(
      'CINETPAY_PUBLIC_URL must be an HTTP(S) URL.'
    )
  }

  if (
    isPrivateHost(
      url.hostname
    )
  ) {
    throw new Error(
      'CINETPAY_PUBLIC_URL must be publicly accessible.'
    )
  }

  return url.origin
}

// ============================================================
// CONFIGURATION GLOBALE EWUKAI
//
// Ne pas utiliser cette fonction pour les cotisations des
// membres d'une mutuelle.
// ============================================================

function getCinetPayConfig(): CinetPayCredentials {
  const apiKey =
    process.env
      .CINETPAY_API_KEY
      ?.trim()

  const siteId =
    process.env
      .CINETPAY_SITE_ID
      ?.trim()

  const secretKey =
    process.env
      .CINETPAY_SECRET_KEY
      ?.trim()

  const channels =
    process.env
      .CINETPAY_CHANNELS
      ?.trim() ||
    'ALL'

  if (
    !apiKey ||
    !siteId ||
    !secretKey
  ) {
    throw new Error(
      'CinetPay credentials are not configured.'
    )
  }

  return normalizeCredentials({
    apiKey,
    siteId,
    secretKey,
    channels,
  })
}

// ============================================================
// NORMALISATION IDENTIFIANTS
// ============================================================

function normalizeCredentials(
  credentials: CinetPayCredentials
): CinetPayCredentials {
  const apiKey =
    credentials.apiKey
      .trim()

  const siteId =
    credentials.siteId
      .trim()

  const secretKey =
    credentials.secretKey
      .trim()

  const channels =
    credentials.channels
      ?.trim()
      .toUpperCase() ||
    'ALL'

  if (
    !apiKey ||
    !siteId ||
    !secretKey
  ) {
    throw new Error(
      'CinetPay credentials are incomplete.'
    )
  }

  if (
    ![
      'ALL',
      'MOBILE_MONEY',
      'CREDIT_CARD',
      'WALLET',
    ].includes(
      channels
    )
  ) {
    throw new Error(
      'Unsupported CinetPay channel.'
    )
  }

  return {
    apiKey,
    siteId,
    secretKey,
    channels,
  }
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
    amountXof <= 0 ||
    amountXof % 5 !== 0
  ) {
    throw new Error(
      'Invalid CinetPay amount.'
    )
  }
}

// ============================================================
// ERREUR API
// ============================================================

export class CinetPayApiError extends Error {
  readonly code:
    | string
    | null

  readonly description:
    | string
    | null

  constructor(
    message: string,

    code:
      | string
      | null,

    description:
      | string
      | null
  ) {
    super(message)

    this.name =
      'CinetPayApiError'

    this.code =
      code

    this.description =
      description
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

  return typeof value ===
    'string'
    ? value
    : ''
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

// ============================================================
// URL DE PAIEMENT
// ============================================================

function assertHttpsUrl(
  value: string
) {
  const url =
    new URL(value)

  if (
    url.protocol !==
    'https:'
  ) {
    throw new Error(
      'CinetPay returned an insecure payment URL.'
    )
  }
}

// ============================================================
// HOST PRIVE
// ============================================================

function isPrivateHost(
  hostname: string
) {
  const value =
    hostname
      .trim()
      .toLowerCase()

  if (
    value ===
      'localhost' ||
    value ===
      '::1' ||
    value ===
      '[::1]' ||
    value.endsWith(
      '.local'
    )
  ) {
    return true
  }

  if (
    /^127\./.test(
      value
    ) ||
    /^10\./.test(
      value
    ) ||
    /^192\.168\./.test(
      value
    )
  ) {
    return true
  }

  const match =
    value.match(
      /^172\.(\d{1,2})\./
    )

  if (match) {
    const second =
      Number(
        match[1]
      )

    if (
      second >= 16 &&
      second <= 31
    ) {
      return true
    }
  }

  return false
}