import 'server-only'

import {
  decryptPaymentCredential,
  isEncryptedPaymentCredential,
} from '@/lib/security/payment-credentials'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// COMPTE CINETPAY GLOBAL DE LA PLATEFORME
//
// AURORE V1
// - Encaissements Mobile Money
//
// CHECKOUT V2
// - Visa / Mastercard
//
// TRANSFER
// - Reversements automatiques vers les mutuelles
//
// IMPORTANT :
// - un seul compte marchand CinetPay pour EWUKAI
// - aucune dépendance à une organisation
// - déchiffrement uniquement côté serveur
// - aucune clé CinetPay exposée au navigateur
// ============================================================


// ============================================================
// TYPES BASE DE DONNEES
// ============================================================

type PlatformCinetPayRow = {

  api_key_encrypted:
    | string
    | null

  api_password_encrypted:
    | string
    | null

  checkout_api_key_encrypted:
    | string
    | null

  checkout_site_id:
    | string
    | null

  checkout_secret_key_encrypted:
    | string
    | null

  checkout_enabled:
    | boolean
    | null

  environment:
    | string
    | null

  channels:
    | string
    | null

  is_active: boolean
}


// ============================================================
// ENVIRONNEMENT
// ============================================================

export type PlatformCinetPayEnvironment =
  | 'sandbox'
  | 'production'


// ============================================================
// IDENTIFIANTS AURORE V1
//
// Utilisés pour les encaissements Mobile Money.
// ============================================================

export type PlatformCinetPayCredentials = {

  apiKey: string

  apiPassword: string

  environment:
    PlatformCinetPayEnvironment

  channels: string
}


// ============================================================
// IDENTIFIANTS CINETPAY TRANSFER
//
// Utilisés uniquement pour les reversements automatiques
// EWUKAI -> comptes Mobile Money des mutuelles.
// ============================================================

export type PlatformCinetPayTransferCredentials = {

  apiKey: string

  apiPassword: string

  environment:
    PlatformCinetPayEnvironment
}


// ============================================================
// IDENTIFIANTS CHECKOUT V2
//
// Utilisés pour Visa / Mastercard.
// ============================================================

export type PlatformCinetPayCheckoutCredentials = {

  apiKey: string

  siteId: string

  secretKey: string

  environment:
    PlatformCinetPayEnvironment

  channels:
    'CREDIT_CARD'
}


// ============================================================
// CHARGER CINETPAY AURORE GLOBAL EWUKAI
//
// Utilisé pour initier les paiements Mobile Money.
//
// Le compte appartient à EWUKAI.
// Il ne dépend jamais d'une organisation.
// ============================================================

export async function getPlatformCinetPayAuroreConfig():
  Promise<PlatformCinetPayCredentials> {

  const admin =
    createAdminClient()

  const {
    data,
    error,
  } =
    await admin
      .from(
        'platform_payment_provider_accounts'
      )
      .select(`
        api_key_encrypted,
        api_password_encrypted,
        environment,
        channels,
        is_active
      `)
      .eq(
        'provider',
        'cinetpay'
      )
      .maybeSingle()


  if (error) {

    console.error(
      'EWUKAI - PLATFORM CINETPAY AURORE CONFIG:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'Unable to load EWUKAI CinetPay Aurore configuration.'
    )
  }


  if (!data) {

    throw new Error(
      'CinetPay Aurore is not configured for EWUKAI.'
    )
  }


  const row =
    data as Pick<
      PlatformCinetPayRow,
      | 'api_key_encrypted'
      | 'api_password_encrypted'
      | 'environment'
      | 'channels'
      | 'is_active'
    >


  if (!row.is_active) {

    throw new Error(
      'CinetPay is disabled for EWUKAI.'
    )
  }


  if (
    !row.api_key_encrypted ||
    !row.api_password_encrypted ||
    !isEncryptedPaymentCredential(
      row.api_key_encrypted
    ) ||
    !isEncryptedPaymentCredential(
      row.api_password_encrypted
    )
  ) {

    throw new Error(
      'EWUKAI CinetPay Aurore credentials are not securely stored.'
    )
  }


  const apiKey =
    decryptPaymentCredential(
      row.api_key_encrypted
    )
      .trim()


  const apiPassword =
    decryptPaymentCredential(
      row.api_password_encrypted
    )
      .trim()


  if (
    !apiKey ||
    !apiPassword
  ) {

    throw new Error(
      'EWUKAI CinetPay Aurore credentials are missing.'
    )
  }


  const environment =
    normalizeEnvironment(
      row.environment
    )


  const channels =
    row.channels
      ?.trim()
      .toUpperCase() ||
    'MOBILE_MONEY'


  return {

    apiKey,

    apiPassword,

    environment,

    channels,
  }
}


// ============================================================
// CHARGER CINETPAY TRANSFER GLOBAL EWUKAI
//
// Utilisé uniquement pour les reversements automatiques.
//
// IMPORTANT :
// - le compte CinetPay appartient à EWUKAI
// - la mutuelle ne fournit aucune clé CinetPay
// - le compte Mobile Money de la mutuelle est seulement
//   la destination du reversement
//
// Pour l'instant, Aurore et Transfer utilisent le même couple :
// - API KEY
// - API PASSWORD
//
// Cette fonction permet néanmoins de garder les deux domaines
// fonctionnels séparés.
// ============================================================

export async function getPlatformCinetPayTransferConfig():
  Promise<PlatformCinetPayTransferCredentials> {

  const admin =
    createAdminClient()


  const {
    data,
    error,
  } =
    await admin
      .from(
        'platform_payment_provider_accounts'
      )
      .select(`
        api_key_encrypted,
        api_password_encrypted,
        environment,
        is_active
      `)
      .eq(
        'provider',
        'cinetpay'
      )
      .maybeSingle()


  if (error) {

    console.error(
      'EWUKAI - PLATFORM CINETPAY TRANSFER CONFIG:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'Unable to load EWUKAI CinetPay Transfer configuration.'
    )
  }


  if (!data) {

    throw new Error(
      'CinetPay Transfer is not configured for EWUKAI.'
    )
  }


  const row =
    data as Pick<
      PlatformCinetPayRow,
      | 'api_key_encrypted'
      | 'api_password_encrypted'
      | 'environment'
      | 'is_active'
    >


  if (!row.is_active) {

    throw new Error(
      'CinetPay is disabled for EWUKAI.'
    )
  }


  if (
    !row.api_key_encrypted ||
    !row.api_password_encrypted ||
    !isEncryptedPaymentCredential(
      row.api_key_encrypted
    ) ||
    !isEncryptedPaymentCredential(
      row.api_password_encrypted
    )
  ) {

    throw new Error(
      'EWUKAI CinetPay Transfer credentials are not securely stored.'
    )
  }


  const apiKey =
    decryptPaymentCredential(
      row.api_key_encrypted
    )
      .trim()


  const apiPassword =
    decryptPaymentCredential(
      row.api_password_encrypted
    )
      .trim()


  if (
    !apiKey ||
    !apiPassword
  ) {

    throw new Error(
      'EWUKAI CinetPay Transfer credentials are missing.'
    )
  }


  return {

    apiKey,

    apiPassword,

    environment:
      normalizeEnvironment(
        row.environment
      ),
  }
}


// ============================================================
// CHECKOUT V2 - INITIALISATION
//
// Utilisé uniquement pour créer un NOUVEAU paiement carte.
//
// checkout_enabled et is_active doivent être vrais.
// ============================================================

export async function getPlatformCinetPayCheckoutConfig():
  Promise<PlatformCinetPayCheckoutCredentials> {

  const config =
    await loadPlatformCinetPayCheckoutCredentials()


  if (!config.isActive) {

    throw new Error(
      'CinetPay is disabled for EWUKAI.'
    )
  }


  if (!config.checkoutEnabled) {

    throw new Error(
      'CinetPay Checkout is disabled for EWUKAI.'
    )
  }


  return {

    apiKey:
      config.apiKey,

    siteId:
      config.siteId,

    secretKey:
      config.secretKey,

    environment:
      config.environment,

    channels:
      'CREDIT_CARD',
  }
}


// ============================================================
// CHECKOUT V2 - VERIFICATION / WEBHOOK
//
// IMPORTANT :
// Une transaction déjà initiée doit pouvoir être vérifiée et
// confirmée même si l'administrateur désactive ensuite les
// NOUVEAUX paiements carte.
//
// Cette fonction exige donc des identifiants valides mais ne
// bloque pas sur checkout_enabled ni is_active.
// ============================================================

export async function getPlatformCinetPayCheckoutVerificationConfig():
  Promise<PlatformCinetPayCheckoutCredentials> {

  const config =
    await loadPlatformCinetPayCheckoutCredentials()


  return {

    apiKey:
      config.apiKey,

    siteId:
      config.siteId,

    secretKey:
      config.secretKey,

    environment:
      config.environment,

    channels:
      'CREDIT_CARD',
  }
}


// ============================================================
// CHARGEUR INTERNE CHECKOUT V2
// ============================================================

async function loadPlatformCinetPayCheckoutCredentials() {

  const admin =
    createAdminClient()


  const {
    data,
    error,
  } =
    await admin
      .from(
        'platform_payment_provider_accounts'
      )
      .select(`
        checkout_api_key_encrypted,
        checkout_site_id,
        checkout_secret_key_encrypted,
        checkout_enabled,
        environment,
        is_active
      `)
      .eq(
        'provider',
        'cinetpay'
      )
      .maybeSingle()


  if (error) {

    console.error(
      'EWUKAI - PLATFORM CINETPAY CHECKOUT CONFIG:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'Unable to load EWUKAI CinetPay Checkout configuration.'
    )
  }


  if (!data) {

    throw new Error(
      'CinetPay Checkout is not configured for EWUKAI.'
    )
  }


  const row =
    data as Pick<
      PlatformCinetPayRow,
      | 'checkout_api_key_encrypted'
      | 'checkout_site_id'
      | 'checkout_secret_key_encrypted'
      | 'checkout_enabled'
      | 'environment'
      | 'is_active'
    >


  const siteId =
    row.checkout_site_id
      ?.trim() ||
    ''


  if (!siteId) {

    throw new Error(
      'EWUKAI CinetPay Checkout Site ID is missing.'
    )
  }


  if (
    !row.checkout_api_key_encrypted ||
    !row.checkout_secret_key_encrypted ||
    !isEncryptedPaymentCredential(
      row.checkout_api_key_encrypted
    ) ||
    !isEncryptedPaymentCredential(
      row.checkout_secret_key_encrypted
    )
  ) {

    throw new Error(
      'EWUKAI CinetPay Checkout credentials are not securely stored.'
    )
  }


  const apiKey =
    decryptPaymentCredential(
      row.checkout_api_key_encrypted
    )
      .trim()


  const secretKey =
    decryptPaymentCredential(
      row.checkout_secret_key_encrypted
    )
      .trim()


  if (
    !apiKey ||
    !secretKey
  ) {

    throw new Error(
      'EWUKAI CinetPay Checkout credentials are missing.'
    )
  }


  return {

    apiKey,

    siteId,

    secretKey,

    environment:
      normalizeEnvironment(
        row.environment
      ),

    checkoutEnabled:
      Boolean(
        row.checkout_enabled
      ),

    isActive:
      Boolean(
        row.is_active
      ),
  }
}


// ============================================================
// ENVIRONNEMENT
// ============================================================

function normalizeEnvironment(
  value:
    | string
    | null
    | undefined
): PlatformCinetPayEnvironment {

  return (
    value
      ?.trim()
      .toLowerCase() ===
      'production'
  )
    ? 'production'
    : 'sandbox'
}