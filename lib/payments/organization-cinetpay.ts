import 'server-only'

import type {
  CinetPayCredentials,
} from '@/lib/payments/cinetpay'

import {
  decryptPaymentCredential,
  isEncryptedPaymentCredential,
} from '@/lib/security/payment-credentials'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// COMPTES CINETPAY D'UNE ORGANISATION
//
// IMPORTANT :
// - l'ancien chargeur V2 est conservé temporairement
// - Aurore utilise API KEY + API PASSWORD
// ============================================================

// ============================================================
// ANCIENNE CONFIGURATION V2
// Temporairement conservée pour éviter de casser
// les autres parties du projet pendant la migration.
// ============================================================

type LegacyProviderRow = {
  site_id:
    | string
    | null

  api_key_encrypted:
    | string
    | null

  secret_key_encrypted:
    | string
    | null

  channels:
    | string
    | null

  is_active: boolean
}

// ============================================================
// CONFIGURATION AURORE
// ============================================================

type AuroreProviderRow = {
  api_key_encrypted:
    | string
    | null

  api_password_encrypted:
    | string
    | null

  environment:
    | string
    | null

  channels:
    | string
    | null

  is_active: boolean
}

export type CinetPayAuroreEnvironment =
  | 'sandbox'
  | 'production'

export type CinetPayAuroreCredentials = {
  apiKey: string
  apiPassword: string
  environment:
    CinetPayAuroreEnvironment
  channels: string
}

// ============================================================
// CHARGER CINETPAY AURORE
// ============================================================

export async function getOrganizationCinetPayAuroreConfig(
  organizationId: string
): Promise<CinetPayAuroreCredentials> {
  const normalizedOrganizationId =
    organizationId.trim()

  if (
    !normalizedOrganizationId
  ) {
    throw new Error(
      'Organization ID is required.'
    )
  }

  const admin =
    createAdminClient()

  const {
    data,
    error,
  } =
    await admin
      .from(
        'organization_payment_provider_accounts'
      )
      .select(`
        api_key_encrypted,
        api_password_encrypted,
        environment,
        channels,
        is_active
      `)
      .eq(
        'organization_id',
        normalizedOrganizationId
      )
      .eq(
        'provider',
        'cinetpay'
      )
      .maybeSingle()

  if (error) {
    console.error(
      'EWUKAI - ORGANIZATION CINETPAY AURORE CONFIG:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'Unable to load organization CinetPay Aurore configuration.'
    )
  }

  if (!data) {
    throw new Error(
      'CinetPay Aurore is not configured for this organization.'
    )
  }

  const row =
    data as AuroreProviderRow

  if (
    !row.is_active
  ) {
    throw new Error(
      'CinetPay is disabled for this organization.'
    )
  }

  // ==========================================================
  // VERIFIER LE STOCKAGE CHIFFRE
  // ==========================================================

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
      'CinetPay Aurore credentials are not securely stored.'
    )
  }

  // ==========================================================
  // DECHIFFREMENT COTE SERVEUR UNIQUEMENT
  // ==========================================================

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
      'CinetPay Aurore credentials are missing.'
    )
  }

  // ==========================================================
  // ENVIRONNEMENT
  // ==========================================================

  const environment =
    normalizeEnvironment(
      row.environment
    )

  // ==========================================================
  // CANAUX
  // ==========================================================

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
// ANCIEN CHARGEUR CINETPAY V2
//
// Conserve temporairement le comportement existant.
// Il sera retiré seulement lorsque toute la migration
// Aurore aura été validée.
// ============================================================

export async function getOrganizationCinetPayConfig(
  organizationId: string
): Promise<CinetPayCredentials> {
  const normalizedOrganizationId =
    organizationId.trim()

  if (
    !normalizedOrganizationId
  ) {
    throw new Error(
      'Organization ID is required.'
    )
  }

  const admin =
    createAdminClient()

  const {
    data,
    error,
  } =
    await admin
      .from(
        'organization_payment_provider_accounts'
      )
      .select(`
        site_id,
        api_key_encrypted,
        secret_key_encrypted,
        channels,
        is_active
      `)
      .eq(
        'organization_id',
        normalizedOrganizationId
      )
      .eq(
        'provider',
        'cinetpay'
      )
      .maybeSingle()

  if (error) {
    console.error(
      'EWUKAI - ORGANIZATION CINETPAY LEGACY CONFIG:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'Unable to load legacy CinetPay configuration.'
    )
  }

  if (!data) {
    throw new Error(
      'CinetPay is not configured for this organization.'
    )
  }

  const row =
    data as LegacyProviderRow

  if (
    !row.is_active
  ) {
    throw new Error(
      'CinetPay is disabled for this organization.'
    )
  }

  const siteId =
    row.site_id
      ?.trim()

  if (!siteId) {
    throw new Error(
      'Legacy CinetPay SITE ID is missing.'
    )
  }

  if (
    !row.api_key_encrypted ||
    !row.secret_key_encrypted ||
    !isEncryptedPaymentCredential(
      row.api_key_encrypted
    ) ||
    !isEncryptedPaymentCredential(
      row.secret_key_encrypted
    )
  ) {
    throw new Error(
      'Legacy CinetPay credentials are not securely stored.'
    )
  }

  const apiKey =
    decryptPaymentCredential(
      row.api_key_encrypted
    )

  const secretKey =
    decryptPaymentCredential(
      row.secret_key_encrypted
    )

  const channels =
    row.channels
      ?.trim()
      .toUpperCase() ||
    'MOBILE_MONEY'

  return {
    siteId,
    apiKey,
    secretKey,
    channels,
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
): CinetPayAuroreEnvironment {
  return (
    value
      ?.trim()
      .toLowerCase() ===
      'production'
  )
    ? 'production'
    : 'sandbox'
}