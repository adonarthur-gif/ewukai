'use server'

import {
  revalidatePath,
} from 'next/cache'

import {
  redirect,
} from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  encryptPaymentCredential,
} from '@/lib/security/payment-credentials'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// CONFIGURATION CINETPAY AURORE D'UNE ORGANISATION
// ============================================================

const EDIT_ROLES =
  new Set([
    'owner',
    'president',
    'treasurer',
  ])

const ALLOWED_CHANNELS =
  new Set([
    'ALL',
    'MOBILE_MONEY',
    'CREDIT_CARD',
    'WALLET',
  ])

const ALLOWED_ENVIRONMENTS =
  new Set([
    'sandbox',
    'production',
  ])

// ============================================================
// ENREGISTRER / MODIFIER CINETPAY
// ============================================================

export async function saveCinetPayConfiguration(
  formData: FormData
) {
  const {
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ==========================================================
  // AUTORISATION
  // ==========================================================

  if (
    !EDIT_ROLES.has(
      role
    )
  ) {
    redirect(
      '/parametres/paiements/cinetpay?error=' +
        encodeURIComponent(
          'Vous n’êtes pas autorisé à modifier cette configuration.'
        )
    )
  }

  const apiKey =
    getText(
      formData,
      'apiKey'
    )

  const apiPassword =
    getText(
      formData,
      'apiPassword'
    )

  const environment =
    getText(
      formData,
      'environment'
    )
      .toLowerCase()

  const channels =
    getText(
      formData,
      'channels'
    )
      .toUpperCase()

  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (
    !ALLOWED_ENVIRONMENTS.has(
      environment
    )
  ) {
    redirectError(
      'L’environnement CinetPay sélectionné est invalide.'
    )
  }

  if (
    !ALLOWED_CHANNELS.has(
      channels
    )
  ) {
    redirectError(
      'Le canal CinetPay sélectionné est invalide.'
    )
  }

  if (
    apiKey.length > 1000 ||
    apiPassword.length > 1000
  ) {
    redirectError(
      'Les identifiants CinetPay sont invalides.'
    )
  }

  // ==========================================================
  // CLIENT SERVEUR PRIVILEGIE
  // ==========================================================

  const admin =
    createAdminClient()

  // ==========================================================
  // CONFIGURATION EXISTANTE
  // ==========================================================

  const {
    data:
      existing,

    error:
      existingError,
  } =
    await admin
      .from(
        'organization_payment_provider_accounts'
      )
      .select(`
        id,
        api_key_encrypted,
        api_password_encrypted,
        credential_version
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'provider',
        'cinetpay'
      )
      .maybeSingle()

  if (
    existingError
  ) {
    console.error(
      'EWUKAI - CINETPAY CONFIG LOOKUP:',
      {
        code:
          existingError.code,

        message:
          existingError.message,
      }
    )

    redirectError(
      'Impossible de lire la configuration CinetPay.'
    )
  }

  // ==========================================================
  // PREMIERE CONFIGURATION
  // ==========================================================

  if (!existing) {
    if (
      !apiKey ||
      !apiPassword
    ) {
      redirectError(
        'L’API KEY et le mot de passe API sont obligatoires lors de la première configuration.'
      )
    }

    const encryptedApiKey =
      encryptPaymentCredential(
        apiKey
      )

    const encryptedApiPassword =
      encryptPaymentCredential(
        apiPassword
      )

    const currentUserId =
      await getCurrentUserId()

    const {
      error:
        insertError,
    } =
      await admin
        .from(
          'organization_payment_provider_accounts'
        )
        .insert({
          organization_id:
            organizationId,

          provider:
            'cinetpay',

          site_id:
            null,

          api_key_encrypted:
            encryptedApiKey,

          api_password_encrypted:
            encryptedApiPassword,

          secret_key_encrypted:
            null,

          environment,

          channels,

          is_active:
            true,

          credential_version:
            1,

          created_by:
            currentUserId,

          updated_by:
            currentUserId,
        })

    if (
      insertError
    ) {
      console.error(
        'EWUKAI - CINETPAY CONFIG CREATE:',
        {
          code:
            insertError.code,

          message:
            insertError.message,
        }
      )

      redirectError(
        'Impossible d’enregistrer la configuration CinetPay.'
      )
    }

    finishSuccess(
      'Compte CinetPay Aurore connecté.'
    )
  }

  // ==========================================================
  // MODIFICATION
  //
  // Un identifiant laissé vide conserve sa valeur existante.
  // ==========================================================

  const credentialsChanged =
    Boolean(
      apiKey ||
      apiPassword
    )

  const updateData: {
    environment: string
    channels: string
    is_active: boolean
    updated_at: string
    updated_by: string | null
    credential_version: number
    api_key_encrypted?: string
    api_password_encrypted?: string
  } = {
    environment,

    channels,

    is_active:
      true,

    updated_at:
      new Date()
        .toISOString(),

    updated_by:
      await getCurrentUserId(),

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

  const {
    error:
      updateError,
  } =
    await admin
      .from(
        'organization_payment_provider_accounts'
      )
      .update(
        updateData
      )
      .eq(
        'id',
        existing.id
      )
      .eq(
        'organization_id',
        organizationId
      )

  if (
    updateError
  ) {
    console.error(
      'EWUKAI - CINETPAY CONFIG UPDATE:',
      {
        code:
          updateError.code,

        message:
          updateError.message,
      }
    )

    redirectError(
      'Impossible de modifier la configuration CinetPay.'
    )
  }

  finishSuccess(
    'Configuration CinetPay Aurore mise à jour.'
  )
}

// ============================================================
// DESACTIVER CINETPAY
// ============================================================

export async function disableCinetPayConfiguration() {
  const {
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    !EDIT_ROLES.has(
      role
    )
  ) {
    redirectError(
      'Vous n’êtes pas autorisé à désactiver CinetPay.'
    )
  }

  const admin =
    createAdminClient()

  const {
    error,
  } =
    await admin
      .from(
        'organization_payment_provider_accounts'
      )
      .update({
        is_active:
          false,

        updated_at:
          new Date()
            .toISOString(),

        updated_by:
          await getCurrentUserId(),
      })
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'provider',
        'cinetpay'
      )

  if (error) {
    console.error(
      'EWUKAI - CINETPAY DISABLE:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    redirectError(
      'Impossible de désactiver CinetPay.'
    )
  }

  finishSuccess(
    'CinetPay a été désactivé.'
  )
}

// ============================================================
// REACTIVER CINETPAY
// ============================================================

export async function enableCinetPayConfiguration() {
  const {
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    !EDIT_ROLES.has(
      role
    )
  ) {
    redirectError(
      'Vous n’êtes pas autorisé à activer CinetPay.'
    )
  }

  const admin =
    createAdminClient()

  const {
    error,
  } =
    await admin
      .from(
        'organization_payment_provider_accounts'
      )
      .update({
        is_active:
          true,

        updated_at:
          new Date()
            .toISOString(),

        updated_by:
          await getCurrentUserId(),
      })
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'provider',
        'cinetpay'
      )

  if (error) {
    console.error(
      'EWUKAI - CINETPAY ENABLE:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    redirectError(
      'Impossible d’activer CinetPay.'
    )
  }

  finishSuccess(
    'CinetPay est maintenant actif.'
  )
}

// ============================================================
// UTILISATEUR COURANT
// ============================================================

async function getCurrentUserId() {
  const {
    supabase,
  } =
    await requireCurrentOrganization()

  const {
    data,
  } =
    await supabase.auth
      .getClaims()

  return (
    data?.claims?.sub ??
    null
  )
}

// ============================================================
// FORM DATA
// ============================================================

function getText(
  formData: FormData,
  key: string
) {
  const value =
    formData.get(
      key
    )

  return typeof value ===
    'string'
    ? value.trim()
    : ''
}

// ============================================================
// REDIRECTIONS
// ============================================================

function redirectError(
  message: string
): never {
  redirect(
    '/parametres/paiements/cinetpay?error=' +
      encodeURIComponent(
        message
      )
  )
}

function finishSuccess(
  message: string
): never {
  revalidatePath(
    '/parametres/paiements/cinetpay'
  )

  revalidatePath(
    '/parametres/paiements'
  )

  redirect(
    '/parametres/paiements/cinetpay?success=' +
      encodeURIComponent(
        message
      )
  )
}