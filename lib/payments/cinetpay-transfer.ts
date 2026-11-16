import 'server-only'

import {
  createHash,
} from 'node:crypto'


// ============================================================
// EWUKAI
// CINETPAY TRANSFER V1
//
// Reversements automatiques :
// EWUKAI -> Mobile Money de la mutuelle
//
// API CINETPAY V1
//
// Authentification :
// POST /v1/oauth/login
//
// Création transfert :
// POST /v1/transfer
//
// Vérification transfert :
// GET /v1/transfer/{transaction_id | merchant_transaction_id}
//
// IMPORTANT :
//
// - aucun secret exposé au navigateur
// - aucun access token stocké en base
// - aucun notify_token brut stocké en base
// - seul le hash SHA-256 du notify_token est conservé
// - un transfert créé n'est PAS automatiquement "Reversé"
// - "Reversé" est attribué uniquement après vérification
//   du statut réel auprès de CinetPay
//
// COMPORTEMENT RÉEL OBSERVÉ EN SANDBOX CINETPAY :
//
// POST /v1/transfer peut répondre :
//
// HTTP 200
// code = 2002
// status = PENDING
// merchant_transaction_id = présent
// transaction_id = absent
// notify_token = absent
//
// Ce cas est VALIDE et ne doit pas être considéré comme
// une réponse incomplète.
//
// EWUKAI conserve alors son merchant_transaction_id,
// laisse le payout en processing et attend la suite du flux.
// ============================================================


// ============================================================
// ENVIRONNEMENT
// ============================================================

export type CinetPayTransferEnvironment =
  | 'sandbox'
  | 'production'


// ============================================================
// IDENTIFIANTS
// ============================================================

export type CinetPayTransferCredentials = {

  apiKey: string

  apiPassword: string

  environment:
    CinetPayTransferEnvironment
}


// ============================================================
// TOKEN D'ACCÈS
// ============================================================

export type CinetPayTransferAccessToken = {

  accessToken: string

  tokenType:
    'Bearer'

  expiresIn: number
}


// ============================================================
// MÉTHODES MOBILE MONEY CÔTE D'IVOIRE
// ============================================================

export type CinetPayCiTransferPaymentMethod =
  | 'OM_CI'
  | 'MTN_CI'
  | 'MOOV_CI'
  | 'WAVE_CI'


// ============================================================
// STATUTS CINETPAY CONNUS
//
// On conserve néanmoins string dans les réponses afin de ne
// pas casser EWUKAI si CinetPay ajoute ultérieurement un statut.
// ============================================================

export type CinetPayKnownTransferStatus =
  | 'OK'
  | 'SUCCESS'
  | 'INITIATED'
  | 'PENDING'
  | 'FAILED'
  | 'EXPIRED'
  | 'TRANSACTION_EXIST'
  | 'INSUFFICIENT_BALANCE'
  | 'NOT_FOUND'
  | 'INVALID_PARAMS'
  | 'INVALID_CREDENTIALS'
  | 'EXPIRED_TOKEN'
  | 'INVALID_TOKEN'
  | 'USER_NOT_FOUND'
  | 'USER_IS_BLOCKED'
  | 'NOT_ALLOWED'
  | 'OPERATION_ERROR'


// ============================================================
// DONNÉES D'ENTRÉE TRANSFERT
// ============================================================

export type CinetPayTransferInput = {

  merchantTransactionId: string

  amountXof: number

  phoneNumber: string

  paymentMethod:
    CinetPayCiTransferPaymentMethod

  reason: string

  notifyUrl: string
}


// ============================================================
// RÉSULTAT CRÉATION TRANSFERT
//
// transactionId et notifyToken sont volontairement nullable.
//
// Le sandbox CinetPay peut retourner PENDING avant de les
// attribuer.
// ============================================================

export type CinetPayTransferResult = {

  code: number

  status: string

  merchantTransactionId: string

  transactionId:
    | string
    | null

  notifyToken:
    | string
    | null

  amount: string

  feeAmount: string

  phoneNumber: string

  currency:
    'XOF'
}


// ============================================================
// BÉNÉFICIAIRE RETOURNÉ PAR CINETPAY
// ============================================================

export type CinetPayTransferStatusUser = {

  name: string

  email: string

  phoneNumber: string
}


// ============================================================
// RÉSULTAT VÉRIFICATION TRANSFERT
//
// transactionId reste nullable : un statut intermédiaire
// peut exister avant attribution de l'identifiant CinetPay.
// ============================================================

export type CinetPayTransferStatusResult = {

  code: number

  status: string

  merchantTransactionId: string

  transactionId:
    | string
    | null

  amount: string

  feeAmount: string

  user?:
    CinetPayTransferStatusUser

  phoneNumber?:
    string

  currency?:
    string
}


// ============================================================
// RÉPONSE AUTHENTIFICATION BRUTE
// ============================================================

type CinetPayTransferAuthResponse = {

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

  message?:
    | string
    | null

  description?:
    | string
    | null
}


// ============================================================
// RÉPONSE TRANSFERT BRUTE
// ============================================================

type CinetPayTransferRawResponse = {

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

  notify_token?:
    | string
    | null

  amount?:
    | number
    | string
    | null

  fee_amount?:
    | number
    | string
    | null

  phone_number?:
    | string
    | null

  currency?:
    | string
    | null

  message?:
    | string
    | null

  description?:
    | string
    | null

  user?:
    | {
        name?:
          | string
          | null

        email?:
          | string
          | null

        phone_number?:
          | string
          | null
      }
    | null
}


// ============================================================
// AUTHENTIFICATION CINETPAY
//
// POST /v1/oauth/login
//
// Le token reste uniquement en mémoire côté serveur.
// ============================================================

export async function getCinetPayTransferAccessToken(
  credentials:
    CinetPayTransferCredentials
): Promise<CinetPayTransferAccessToken> {

  const apiKey =
    credentials
      .apiKey
      .trim()


  const apiPassword =
    credentials
      .apiPassword
      .trim()


  if (
    !apiKey ||
    !apiPassword
  ) {

    throw new Error(
      'CinetPay Transfer credentials are incomplete.'
    )
  }


  const baseUrl =
    getCinetPayTransferBaseUrl(
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
    await safeJson<CinetPayTransferAuthResponse>(
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
    payload
      ?.status
      ?.trim()
      .toUpperCase() ||
    ''


  const accessToken =
    payload
      ?.access_token
      ?.trim() ||
    ''


  const tokenType =
    payload
      ?.token_type
      ?.trim()
      .toLowerCase() ||
    ''


  const expiresIn =
    Number(
      payload
        ?.expires_in
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

    throw new CinetPayTransferApiError(
      payload?.description ||
        payload?.message ||
        'CinetPay Transfer authentication failed.',

      code,

      status ||
        null
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
  }
}


// ============================================================
// CRÉER UN TRANSFERT
//
// POST /v1/transfer
//
// IMPORTANT :
//
// Cette fonction confirme seulement que CinetPay a accepté
// la demande.
//
// Elle ne signifie jamais que le reversement est terminé.
//
// Cas possible observé :
//
// code 2002
// status PENDING
// merchant_transaction_id présent
// transaction_id absent
// notify_token absent
//
// Ce cas est accepté.
// ============================================================

export async function createCinetPayTransfer(
  input:
    CinetPayTransferInput,

  credentials:
    CinetPayTransferCredentials
): Promise<CinetPayTransferResult> {

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const merchantTransactionId =
    validateCinetPayTransferMerchantTransactionId(
      input.merchantTransactionId
    )


  const amountXof =
    validateCinetPayTransferAmount(
      input.amountXof
    )


  const phoneNumber =
    normalizeCinetPayCiPhoneNumber(
      input.phoneNumber
    )


  const paymentMethod =
    input.paymentMethod


  validateCinetPayCiTransferPaymentMethod(
    paymentMethod
  )


  const reason =
    validateCinetPayTransferReason(
      input.reason
    )


  const notifyUrl =
    validateCinetPayTransferNotifyUrl(
      input.notifyUrl
    )


  // ==========================================================
  // AUTHENTIFICATION
  // ==========================================================

  const authentication =
    await getCinetPayTransferAccessToken(
      credentials
    )


  const baseUrl =
    getCinetPayTransferBaseUrl(
      credentials.environment
    )


  // ==========================================================
  // ENVOI CINETPAY
  // ==========================================================

  const response =
    await fetch(
      `${baseUrl}/v1/transfer`,
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

            phone_number:
              phoneNumber,

            amount:
              amountXof,

            payment_method:
              paymentMethod,

            reason,

            notify_url:
              notifyUrl,
          }),

        signal:
          AbortSignal.timeout(
            30_000
          ),
      }
    )


  const payload =
    await safeJson<CinetPayTransferRawResponse>(
      response
    )


  if (!payload) {

    throw new CinetPayTransferApiError(
      'CinetPay returned an unreadable transfer response.',

      String(
        response.status
      ),

      null
    )
  }


  const code =
    normalizeApiCode(
      payload.code,
      response.status
    )


  const status =
    cleanText(
      payload.status
    )
      ?.toUpperCase() ||
    ''


  // ==========================================================
  // CODES DE CRÉATION ACCEPTÉS
  //
  // 200  = OK
  // 100  = SUCCESS
  // 2001 = INITIATED
  // 2002 = PENDING
  // ==========================================================

  const acceptedCodes =
    new Set<number>([
      200,
      100,
      2001,
      2002,
    ])


  if (
    !response.ok ||
    !acceptedCodes.has(
      code
    )
  ) {

    throw new CinetPayTransferApiError(
      payload.description ||
        payload.message ||
        'CinetPay Transfer creation failed.',

      String(
        code
      ),

      status ||
        null
    )
  }


  const returnedMerchantTransactionId =
    cleanText(
      payload
        .merchant_transaction_id
    )


  const transactionId =
    cleanText(
      payload
        .transaction_id
    )


  const notifyToken =
    cleanText(
      payload
        .notify_token
    )


  // ==========================================================
  // RÉPONSE MINIMALE OBLIGATOIRE
  //
  // transaction_id et notify_token NE SONT PLUS obligatoires.
  //
  // Ils peuvent être absents lors d'un PENDING initial.
  // ==========================================================

  if (
    !status ||
    !returnedMerchantTransactionId
  ) {

    throw new CinetPayTransferApiError(
      'CinetPay returned an incomplete transfer response.',

      String(
        code
      ),

      status ||
        null
    )
  }


  // ==========================================================
  // COHÉRENCE DE LA RÉFÉRENCE EWUKAI
  // ==========================================================

  if (
    returnedMerchantTransactionId !==
    merchantTransactionId
  ) {

    throw new CinetPayTransferApiError(
      'CinetPay returned an unexpected merchant transaction ID.',

      String(
        code
      ),

      status
    )
  }


  return {
    code,

    status,

    merchantTransactionId:
      returnedMerchantTransactionId,

    transactionId,

    notifyToken,

    amount:
      String(
        payload.amount ??
        amountXof
      ),

    feeAmount:
      String(
        payload.fee_amount ??
        ''
      ),

    phoneNumber:
      cleanText(
        payload.phone_number
      ) ||
      phoneNumber,

    currency:
      'XOF',
  }
}


// ============================================================
// VÉRIFIER LE STATUT RÉEL D'UN TRANSFERT
//
// GET /v1/transfer/{reference}
//
// reference peut être :
//
// - transaction_id CinetPay
// - merchant_transaction_id EWUKAI
//
// IMPORTANT :
//
// CinetPay peut retourner NOT_FOUND pendant certaines phases
// intermédiaires du sandbox.
//
// Cette fonction laisse remonter cette réponse sous forme
// CinetPayTransferApiError.
//
// Une réponse HTTP valide PENDING peut également ne pas encore
// contenir transaction_id.
// ============================================================

export async function getCinetPayTransferStatus(
  transactionReference:
    string,

  credentials:
    CinetPayTransferCredentials
): Promise<CinetPayTransferStatusResult> {

  const normalizedReference =
    transactionReference
      .trim()


  if (!normalizedReference) {

    throw new Error(
      'CinetPay Transfer transaction reference is required.'
    )
  }


  if (
    normalizedReference.length >
    128
  ) {

    throw new Error(
      'Invalid CinetPay Transfer transaction reference.'
    )
  }


  const authentication =
    await getCinetPayTransferAccessToken(
      credentials
    )


  const baseUrl =
    getCinetPayTransferBaseUrl(
      credentials.environment
    )


  const response =
    await fetch(
      `${baseUrl}/v1/transfer/${encodeURIComponent(
        normalizedReference
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
            30_000
          ),
      }
    )


  const payload =
    await safeJson<CinetPayTransferRawResponse>(
      response
    )


  if (!payload) {

    throw new CinetPayTransferApiError(
      'CinetPay returned an unreadable transfer status response.',

      String(
        response.status
      ),

      null
    )
  }


  const code =
    normalizeApiCode(
      payload.code,
      response.status
    )


  const status =
    cleanText(
      payload.status
    )
      ?.toUpperCase() ||
    ''


  if (!response.ok) {

    throw new CinetPayTransferApiError(
      payload.description ||
        payload.message ||
        'Unable to verify CinetPay transfer.',

      String(
        code
      ),

      status ||
        null
    )
  }


  const merchantTransactionId =
    cleanText(
      payload
        .merchant_transaction_id
    )


  const transactionId =
    cleanText(
      payload
        .transaction_id
    )


  // ==========================================================
  // RÉPONSE MINIMALE
  //
  // Pour une réponse HTTP valide, EWUKAI exige :
  //
  // - un statut
  // - un merchant_transaction_id
  //
  // transaction_id reste nullable tant que CinetPay ne l'a
  // pas encore attribué.
  // ==========================================================

  if (
    !status ||
    !merchantTransactionId
  ) {

    throw new CinetPayTransferApiError(
      payload.description ||
        payload.message ||
        'CinetPay returned an incomplete transfer status.',

      String(
        code
      ),

      status ||
        null
    )
  }


  const result:
    CinetPayTransferStatusResult = {
      code,

      status,

      merchantTransactionId,

      transactionId,

      amount:
        String(
          payload.amount ??
          ''
        ),

      feeAmount:
        String(
          payload.fee_amount ??
          ''
        ),
    }


  const phoneNumber =
    cleanText(
      payload.phone_number
    )


  if (phoneNumber) {

    result.phoneNumber =
      phoneNumber
  }


  const currency =
    cleanText(
      payload.currency
    )


  if (currency) {

    result.currency =
      currency
        .toUpperCase()
  }


  if (
    payload.user
  ) {

    result.user = {
      name:
        cleanText(
          payload.user.name
        ) ||
        '',

      email:
        cleanText(
          payload.user.email
        ) ||
        '',

      phoneNumber:
        cleanText(
          payload.user.phone_number
        ) ||
        '',
    }
  }


  return result
}


// ============================================================
// TRANSFERT RÉUSSI
//
// Seul SUCCESS autorise EWUKAI à afficher "Reversé".
// ============================================================

export function isCinetPayTransferSuccessful(
  status: string
) {

  return (
    status
      .trim()
      .toUpperCase() ===
    'SUCCESS'
  )
}


// ============================================================
// TRANSFERT EN COURS
// ============================================================

export function isCinetPayTransferPending(
  status: string
) {

  const normalized =
    status
      .trim()
      .toUpperCase()


  return (
    normalized ===
      'PENDING' ||
    normalized ===
      'INITIATED' ||
    normalized ===
      'OK'
  )
}


// ============================================================
// STATUT FINAL
//
// PENDING, INITIATED et OK ne sont pas finaux.
// ============================================================

export function isCinetPayTransferFinalStatus(
  status: string
) {

  const normalized =
    status
      .trim()
      .toUpperCase()


  return new Set<string>([
    'SUCCESS',
    'FAILED',
    'TRANSACTION_EXIST',
    'INSUFFICIENT_BALANCE',
  ])
    .has(
      normalized
    )
}


// ============================================================
// HASH DU NOTIFY TOKEN
//
// Le token brut ne doit jamais être stocké en base.
//
// Cette fonction ne doit être appelée QUE si CinetPay a
// réellement fourni un notify_token.
// ============================================================

export function hashCinetPayTransferNotifyToken(
  value: string
) {

  const normalized =
    value
      .trim()


  if (!normalized) {

    throw new Error(
      'CinetPay Transfer notify token is required.'
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
// GÉNÉRER LA RÉFÉRENCE CINETPAY À PARTIR DU PAYOUT EWUKAI
//
// organization_payouts.id est un UUID de 36 caractères.
// CinetPay limite merchant_transaction_id à 30 caractères.
//
// Exemple :
//
// EWKP1A2B3C4D...
//
// La référence reste déterministe :
// un même payout produit toujours la même référence.
// ============================================================

export function buildCinetPayPayoutMerchantTransactionId(
  payoutId: string
) {

  const normalized =
    payoutId
      .trim()
      .toLowerCase()


  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(
        normalized
      )
  ) {

    throw new Error(
      'Invalid EWUKAI payout ID.'
    )
  }


  const compact =
    normalized
      .replaceAll(
        '-',
        ''
      )


  // 4 caractères "EWKP" + 26 caractères UUID = 30
  return `EWKP${compact.slice(
    0,
    26
  )}`
}


// ============================================================
// NORMALISER NUMÉRO MOBILE MONEY CÔTE D'IVOIRE
//
// Exemples acceptés :
//
// 0145678912
// 01 45 67 89 12
// 2250145678912
// +2250145678912
//
// Retour :
//
// +2250145678912
// ============================================================

export function normalizeCinetPayCiPhoneNumber(
  value: string
) {

  const digits =
    value
      .replace(
        /\D/g,
        ''
      )


  // Format ivoirien local
  if (
    digits.length ===
      10 &&
    digits.startsWith(
      '0'
    )
  ) {

    return `+225${digits}`
  }


  // Format international sans +
  if (
    digits.length ===
      13 &&
    digits.startsWith(
      '2250'
    )
  ) {

    return `+${digits}`
  }


  throw new Error(
    'Invalid Côte d’Ivoire Mobile Money phone number.'
  )
}


// ============================================================
// CONVERSION OPÉRATEUR EWUKAI -> CINETPAY
//
// EWUKAI              CINETPAY
//
// orange_money     -> OM_CI
// mtn_momo         -> MTN_CI
// moov_money       -> MOOV_CI
// wave             -> WAVE_CI
// ============================================================

export function mapOrganizationProviderToCinetPayTransferMethod(
  provider: string
): CinetPayCiTransferPaymentMethod {

  const normalized =
    provider
      .trim()
      .toLowerCase()


  switch (
    normalized
  ) {

    case 'orange_money':

      return 'OM_CI'


    case 'mtn_momo':

      return 'MTN_CI'


    case 'moov_money':

      return 'MOOV_CI'


    case 'wave':

      return 'WAVE_CI'


    default:

      throw new Error(
        'Unsupported EWUKAI Mobile Money payout provider.'
      )
  }
}


// ============================================================
// VALIDATION MÉTHODE TRANSFERT CI
// ============================================================

export function validateCinetPayCiTransferPaymentMethod(
  value: string
): asserts value is CinetPayCiTransferPaymentMethod {

  const allowed =
    new Set<string>([
      'OM_CI',
      'MTN_CI',
      'MOOV_CI',
      'WAVE_CI',
    ])


  if (
    !allowed.has(
      value
    )
  ) {

    throw new Error(
      'Invalid CinetPay Côte d’Ivoire transfer payment method.'
    )
  }
}


// ============================================================
// VALIDATION IDENTIFIANT TRANSACTION
//
// CinetPay : 1 à 30 caractères.
// ============================================================

export function validateCinetPayTransferMerchantTransactionId(
  value: string
) {

  const normalized =
    value
      .trim()


  if (
    !normalized ||
    normalized.length >
      30
  ) {

    throw new Error(
      'Invalid CinetPay transfer merchant transaction ID.'
    )
  }


  return normalized
}


// ============================================================
// VALIDATION MONTANT
//
// CinetPay Transfer :
//
// 100 XOF minimum
// 1 500 000 XOF maximum
// ============================================================

export function validateCinetPayTransferAmount(
  amountXof: number
) {

  if (
    !Number.isSafeInteger(
      amountXof
    ) ||
    amountXof <
      100 ||
    amountXof >
      1_500_000
  ) {

    throw new Error(
      'Invalid CinetPay transfer amount.'
    )
  }


  return amountXof
}


// ============================================================
// VALIDATION MOTIF
//
// CinetPay : 1 à 255 caractères.
// ============================================================

export function validateCinetPayTransferReason(
  value: string
) {

  const normalized =
    value
      .trim()


  if (
    !normalized ||
    normalized.length >
      255
  ) {

    throw new Error(
      'Invalid CinetPay transfer reason.'
    )
  }


  return normalized
}


// ============================================================
// VALIDATION URL NOTIFICATION
//
// CinetPay accepte jusqu'à 120 caractères.
//
// EWUKAI impose volontairement HTTPS.
// ============================================================

export function validateCinetPayTransferNotifyUrl(
  value: string
) {

  const normalized =
    value
      .trim()


  if (
    !normalized ||
    normalized.length >
      120
  ) {

    throw new Error(
      'Invalid CinetPay Transfer notification URL.'
    )
  }


  let url:
    URL


  try {

    url =
      new URL(
        normalized
      )

  } catch {

    throw new Error(
      'Invalid CinetPay Transfer notification URL.'
    )
  }


  if (
    url.protocol !==
      'https:'
  ) {

    throw new Error(
      'CinetPay Transfer notification URL must use HTTPS.'
    )
  }


  return normalized
}


// ============================================================
// BASE URL CINETPAY
//
// Sandbox :
// https://api.cinetpay.net
//
// Production :
// https://api.cinetpay.co
// ============================================================

export function getCinetPayTransferBaseUrl(
  environment:
    CinetPayTransferEnvironment
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
// NORMALISATION CODE API
// ============================================================

function normalizeApiCode(
  value:
    | number
    | string
    | null
    | undefined,

  fallback:
    number
) {

  const parsed =
    Number(
      value
    )


  if (
    Number.isFinite(
      parsed
    )
  ) {

    return parsed
  }


  return fallback
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
// ERREUR API CINETPAY TRANSFER
// ============================================================

export class CinetPayTransferApiError
  extends Error {

  readonly code: string

  readonly apiStatus:
    | string
    | null


  constructor(
    message: string,

    code: string,

    apiStatus:
      | string
      | null =
        null
  ) {

    super(
      message
    )


    this.name =
      'CinetPayTransferApiError'


    this.code =
      code


    this.apiStatus =
      apiStatus
  }
}


// ============================================================
// LECTURE JSON SÉCURISÉE
// ============================================================

async function safeJson<T>(
  response:
    Response
): Promise<T | null> {

  try {

    return (
      await response.json()
    ) as T

  } catch {

    return null
  }
}