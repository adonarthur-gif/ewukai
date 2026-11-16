'use server'

import {
  revalidatePath,
} from 'next/cache'

import {
  redirect,
} from 'next/navigation'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

import {
  encryptPaymentCredential,
} from '@/lib/security/payment-credentials'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// CINETPAY GLOBAL PLATEFORME
//
// - AURORE V1 : MOBILE MONEY
// - CHECKOUT V2 : CARTE BANCAIRE VISA / MASTERCARD
// ============================================================

const ALLOWED_ENVIRONMENTS =
  new Set([
    'sandbox',
    'production',
  ])

const ALLOWED_CHANNELS =
  new Set([
    'ALL',
    'MOBILE_MONEY',
    'CREDIT_CARD',
    'WALLET',
  ])

// ============================================================
// TYPES
// ============================================================

type ExistingRow = {
  id: string

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

  credential_version:
    | number
    | null
}

// ============================================================
// ENREGISTRER / MODIFIER
// ============================================================

export async function savePlatformCinetPayConfiguration(
  formData: FormData
) {
  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  // ==========================================================
  // AURORE V1
  // ==========================================================

  const apiKey =
    formValue(
      formData,
      'apiKey'
    )

  const apiPassword =
    formValue(
      formData,
      'apiPassword'
    )

  const environment =
    formValue(
      formData,
      'environment'
    )
      .toLowerCase()

  const channels =
    formValue(
      formData,
      'channels'
    )
      .toUpperCase()

  // ==========================================================
  // CHECKOUT V2
  // VISA / MASTERCARD
  // ==========================================================

  const checkoutApiKey =
    formValue(
      formData,
      'checkoutApiKey'
    )

  const checkoutSiteId =
    formValue(
      formData,
      'checkoutSiteId'
    )

  const checkoutSecretKey =
    formValue(
      formData,
      'checkoutSecretKey'
    )

  const checkoutEnabled =
    formData.get(
      'checkoutEnabled'
    ) === 'on'

  // ==========================================================
  // VALIDATION ENVIRONNEMENT
  // ==========================================================

  if (
    !ALLOWED_ENVIRONMENTS.has(
      environment
    )
  ) {
    redirectCinetPayError(
      'environment'
    )
  }

  // ==========================================================
  // VALIDATION CANAUX
  // ==========================================================

  if (
    !ALLOWED_CHANNELS.has(
      channels
    )
  ) {
    redirectCinetPayError(
      'channels'
    )
  }

  // ==========================================================
  // VALIDATION LONGUEUR IDENTIFIANTS
  // ==========================================================

  if (
    apiKey.length > 1000 ||
    apiPassword.length > 1000 ||
    checkoutApiKey.length > 1000 ||
    checkoutSecretKey.length > 1000 ||
    checkoutSiteId.length > 255
  ) {
    redirectCinetPayError(
      'credentials'
    )
  }

  // ==========================================================
  // UTILISATEUR COURANT
  // ==========================================================

  const {
    data:
      claimsData,
  } =
    await supabase.auth
      .getClaims()

  const currentUserId =
    claimsData
      ?.claims
      ?.sub ??
    null

  // ==========================================================
  // CLIENT ADMIN
  // ==========================================================

  const admin =
    createAdminClient()

  // ==========================================================
  // CONFIGURATION EXISTANTE
  // ==========================================================

  const {
    data,
    error:
      lookupError,
  } =
    await admin
      .from(
        'platform_payment_provider_accounts'
      )
      .select(`
        id,
        api_key_encrypted,
        api_password_encrypted,
        checkout_api_key_encrypted,
        checkout_site_id,
        checkout_secret_key_encrypted,
        checkout_enabled,
        credential_version
      `)
      .eq(
        'provider',
        'cinetpay'
      )
      .maybeSingle()

  if (lookupError) {
    console.error(
      'EWUKAI - PLATFORM CINETPAY LOOKUP:',
      {
        code:
          lookupError.code,

        message:
          lookupError.message,
      }
    )

    redirectCinetPayError(
      'read'
    )
  }

  const existing =
    data as
      | ExistingRow
      | null

  // ==========================================================
  // PREMIERE CONFIGURATION
  // ==========================================================

  if (!existing) {
    // --------------------------------------------------------
    // AURORE OBLIGATOIRE
    // --------------------------------------------------------

    if (
      !apiKey ||
      !apiPassword
    ) {
      redirectCinetPayError(
        'credentials_required'
      )
    }

    // --------------------------------------------------------
    // CHECKOUT V2
    //
    // Les identifiants Checkout ne deviennent obligatoires
    // que si Visa / Mastercard est activé.
    // --------------------------------------------------------

    if (
      checkoutEnabled &&
      (
        !checkoutApiKey ||
        !checkoutSiteId ||
        !checkoutSecretKey
      )
    ) {
      redirectCinetPayError(
        'checkout_credentials_required'
      )
    }

    const {
      error:
        insertError,
    } =
      await admin
        .from(
          'platform_payment_provider_accounts'
        )
        .insert({
          provider:
            'cinetpay',

          // ================================================
          // AURORE
          // ================================================

          api_key_encrypted:
            encryptPaymentCredential(
              apiKey
            ),

          api_password_encrypted:
            encryptPaymentCredential(
              apiPassword
            ),

          environment,

          channels,

          is_active:
            true,

          // ================================================
          // CHECKOUT V2
          // ================================================

          checkout_api_key_encrypted:
            checkoutApiKey
              ? encryptPaymentCredential(
                  checkoutApiKey
                )
              : null,

          checkout_site_id:
            checkoutSiteId ||
            null,

          checkout_secret_key_encrypted:
            checkoutSecretKey
              ? encryptPaymentCredential(
                  checkoutSecretKey
                )
              : null,

          checkout_enabled:
            checkoutEnabled,

          // ================================================
          // AUDIT
          // ================================================

          credential_version:
            1,

          created_by:
            currentUserId,

          updated_by:
            currentUserId,
        })

    if (insertError) {
      console.error(
        'EWUKAI - PLATFORM CINETPAY CREATE:',
        {
          code:
            insertError.code,

          message:
            insertError.message,
        }
      )

      redirectCinetPayError(
        'save'
      )
    }

    finishCinetPay(
      'cinetpay_saved'
    )
  }

  // ==========================================================
  // MODIFICATION
  //
  // Un champ secret vide conserve toujours sa valeur actuelle.
  // ==========================================================

  // ----------------------------------------------------------
  // AURORE
  // ----------------------------------------------------------

  if (
    !apiKey &&
    !existing.api_key_encrypted
  ) {
    redirectCinetPayError(
      'api_key_required'
    )
  }

  if (
    !apiPassword &&
    !existing.api_password_encrypted
  ) {
    redirectCinetPayError(
      'api_password_required'
    )
  }

  // ----------------------------------------------------------
  // CHECKOUT V2
  // ----------------------------------------------------------

  const hasCheckoutApiKey =
    Boolean(
      checkoutApiKey ||
      existing.checkout_api_key_encrypted
    )

  const hasCheckoutSiteId =
    Boolean(
      checkoutSiteId ||
      existing.checkout_site_id
    )

  const hasCheckoutSecretKey =
    Boolean(
      checkoutSecretKey ||
      existing.checkout_secret_key_encrypted
    )

  if (
    checkoutEnabled &&
    (
      !hasCheckoutApiKey ||
      !hasCheckoutSiteId ||
      !hasCheckoutSecretKey
    )
  ) {
    redirectCinetPayError(
      'checkout_credentials_required'
    )
  }

  // ==========================================================
  // VERSION DES IDENTIFIANTS
  // ==========================================================

  const credentialsChanged =
    Boolean(
      apiKey ||
      apiPassword ||
      checkoutApiKey ||
      checkoutSiteId ||
      checkoutSecretKey
    )

  // ==========================================================
  // DONNEES A METTRE A JOUR
  // ==========================================================

  const updateData: {
    environment: string
    channels: string
    is_active: boolean

    checkout_enabled: boolean

    updated_at: string
    updated_by: string | null

    credential_version: number

    api_key_encrypted?: string
    api_password_encrypted?: string

    checkout_api_key_encrypted?: string
    checkout_site_id?: string
    checkout_secret_key_encrypted?: string
  } = {
    environment,

    channels,

    is_active:
      true,

    checkout_enabled:
      checkoutEnabled,

    updated_at:
      new Date()
        .toISOString(),

    updated_by:
      currentUserId,

    credential_version:
      Number(
        existing
          .credential_version ??
        1
      ) +
      (
        credentialsChanged
          ? 1
          : 0
      ),
  }

  // ==========================================================
  // NOUVEAUX IDENTIFIANTS AURORE
  // ==========================================================

  if (apiKey) {
    updateData
      .api_key_encrypted =
        encryptPaymentCredential(
          apiKey
        )
  }

  if (apiPassword) {
    updateData
      .api_password_encrypted =
        encryptPaymentCredential(
          apiPassword
        )
  }

  // ==========================================================
  // NOUVEAUX IDENTIFIANTS CHECKOUT V2
  // ==========================================================

  if (checkoutApiKey) {
    updateData
      .checkout_api_key_encrypted =
        encryptPaymentCredential(
          checkoutApiKey
        )
  }

  if (checkoutSiteId) {
    updateData
      .checkout_site_id =
        checkoutSiteId
  }

  if (checkoutSecretKey) {
    updateData
      .checkout_secret_key_encrypted =
        encryptPaymentCredential(
          checkoutSecretKey
        )
  }

  // ==========================================================
  // ENREGISTREMENT
  // ==========================================================

  const {
    error:
      updateError,
  } =
    await admin
      .from(
        'platform_payment_provider_accounts'
      )
      .update(
        updateData
      )
      .eq(
        'id',
        existing.id
      )
      .eq(
        'provider',
        'cinetpay'
      )

  if (updateError) {
    console.error(
      'EWUKAI - PLATFORM CINETPAY UPDATE:',
      {
        code:
          updateError.code,

        message:
          updateError.message,
      }
    )

    redirectCinetPayError(
      'save'
    )
  }

  finishCinetPay(
    'cinetpay_saved'
  )
}

// ============================================================
// DESACTIVER CINETPAY GLOBAL
// ============================================================

export async function disablePlatformCinetPay() {
  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const {
    data:
      claimsData,
  } =
    await supabase.auth
      .getClaims()

  const admin =
    createAdminClient()

  const {
    error,
  } =
    await admin
      .from(
        'platform_payment_provider_accounts'
      )
      .update({
        is_active:
          false,

        updated_at:
          new Date()
            .toISOString(),

        updated_by:
          claimsData
            ?.claims
            ?.sub ??
          null,
      })
      .eq(
        'provider',
        'cinetpay'
      )

  if (error) {
    console.error(
      'EWUKAI - PLATFORM CINETPAY DISABLE:',
      error
    )

    redirectCinetPayError(
      'disable'
    )
  }

  finishCinetPay(
    'cinetpay_disabled'
  )
}

// ============================================================
// REACTIVER CINETPAY GLOBAL
// ============================================================

export async function enablePlatformCinetPay() {
  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const {
    data:
      claimsData,
  } =
    await supabase.auth
      .getClaims()

  const admin =
    createAdminClient()

  const {
    error,
  } =
    await admin
      .from(
        'platform_payment_provider_accounts'
      )
      .update({
        is_active:
          true,

        updated_at:
          new Date()
            .toISOString(),

        updated_by:
          claimsData
            ?.claims
            ?.sub ??
          null,
      })
      .eq(
        'provider',
        'cinetpay'
      )

  if (error) {
    console.error(
      'EWUKAI - PLATFORM CINETPAY ENABLE:',
      error
    )

    redirectCinetPayError(
      'enable'
    )
  }

  finishCinetPay(
    'cinetpay_enabled'
  )
}

// ============================================================
// HELPERS
// ============================================================

function formValue(
  formData: FormData,
  name: string
) {
  const value =
    formData.get(
      name
    )

  return typeof value ===
    'string'
    ? value.trim()
    : ''
}

// ============================================================
// ERREUR
// ============================================================

function redirectCinetPayError(
  code: string
): never {
  redirect(
    `/admin/settings?cinetpay_error=${encodeURIComponent(
      code
    )}`
  )
}

// ============================================================
// SUCCES
// ============================================================

function finishCinetPay(
  result: string
): never {
  revalidatePath(
    '/admin/settings'
  )

  revalidatePath(
    '/admin/dashboard'
  )

  redirect(
    `/admin/settings?${result}=1`
  )
}