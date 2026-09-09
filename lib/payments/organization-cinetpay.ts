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
// AFRI CLUB
// CHARGEMENT DU COMPTE CINETPAY D'UNE MUTUELLE
//
// JAMAIS importé dans un composant client.
// ============================================================

type ProviderRow = {
  site_id: string
  api_key_encrypted: string
  secret_key_encrypted: string
  channels: string
  is_active: boolean
}

// ============================================================
// CONFIGURATION
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
      'AFRI CLUB - ORGANIZATION CINETPAY CONFIG:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'Unable to load organization CinetPay configuration.'
    )
  }

  if (!data) {
    throw new Error(
      'CinetPay is not configured for this organization.'
    )
  }

  const row =
    data as ProviderRow

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
      'CinetPay SITE ID is missing.'
    )
  }

  if (
    !isEncryptedPaymentCredential(
      row.api_key_encrypted
    ) ||
    !isEncryptedPaymentCredential(
      row.secret_key_encrypted
    )
  ) {
    throw new Error(
      'CinetPay credentials are not securely stored.'
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