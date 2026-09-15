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

// ============================================================
// EWUKAI
// ACTIONS - PARAMETRES PLATEFORME
// ============================================================

export async function updatePlatformSettings(
  formData: FormData
) {
  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const platformName =
    formValue(
      formData,
      'platform_name'
    )

  const supportEmail =
    formValue(
      formData,
      'support_email'
    )

  const supportPhone =
    formValue(
      formData,
      'support_phone'
    )

  const countryCode =
    formValue(
      formData,
      'default_country_code'
    )
      .toUpperCase()

  const currency =
    formValue(
      formData,
      'default_currency'
    )
      .toUpperCase()

  const locale =
    formValue(
      formData,
      'default_locale'
    )

  const timezone =
    formValue(
      formData,
      'default_timezone'
    )

  // ==========================================================
  // VALIDATION MINIMALE SERVEUR
  // ==========================================================

  if (
    platformName.length <
      2 ||
    platformName.length >
      80
  ) {
    redirect(
      '/admin/settings?error=platform_name'
    )
  }

  if (
    !/^[A-Z]{2}$/.test(
      countryCode
    )
  ) {
    redirect(
      '/admin/settings?error=country'
    )
  }

  if (
    !/^[A-Z]{3}$/.test(
      currency
    )
  ) {
    redirect(
      '/admin/settings?error=currency'
    )
  }

  // ==========================================================
  // RPC
  // ==========================================================

  const {
    error,
  } =
    await supabase.rpc(
      'update_platform_settings',
      {
        new_platform_name:
          platformName,

        new_support_email:
          supportEmail ||
          null,

        new_support_phone:
          supportPhone ||
          null,

        new_default_country_code:
          countryCode,

        new_default_currency:
          currency,

        new_default_locale:
          locale,

        new_default_timezone:
          timezone,
      }
    )

  if (
    error
  ) {
    console.error(
      'EWUKAI - update platform settings:',
      error
    )

    redirect(
      '/admin/settings?error=save'
    )
  }

  revalidatePath(
    '/admin/settings'
  )

  revalidatePath(
    '/admin/dashboard'
  )

  redirect(
    '/admin/settings?saved=1'
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

  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value.trim()
}