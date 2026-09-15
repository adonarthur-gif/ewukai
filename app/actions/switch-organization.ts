'use server'

import {
  revalidatePath,
} from 'next/cache'

import {
  cookies,
} from 'next/headers'

import {
  redirect,
} from 'next/navigation'

import {
  ACTIVE_ORGANIZATION_COOKIE,
  MANAGEMENT_ROLES,
} from '@/lib/auth/current-organization'

import {
  createClient,
} from '@/lib/supabase/server'

// ============================================================
// CHANGER D'ORGANISATION
// ============================================================

export async function switchOrganization(
  formData: FormData
) {
  // ==========================================================
  // PARAMETRES
  // ==========================================================

  const organizationId =
    String(
      formData.get(
        'organizationId'
      ) ?? ''
    ).trim()

  const returnTo =
    sanitizeReturnPath(
      String(
        formData.get(
          'returnTo'
        ) ?? ''
      )
    )

  if (
    !organizationId
  ) {
    redirect(
      returnTo
    )
  }

  // ==========================================================
  // UTILISATEUR CONNECTE
  // ==========================================================

  const supabase =
    await createClient()

  const {
    data: authData,
    error: authError,
  } =
    await supabase.auth
      .getClaims()

  const userId =
    authData
      ?.claims
      ?.sub

  if (
    authError ||
    !userId
  ) {
    redirect(
      '/login'
    )
  }

  // ==========================================================
  // VERIFICATION DES DROITS
  //
  // Un utilisateur ne peut sélectionner que
  // l'une de SES organisations de gestion actives.
  // ==========================================================

  const {
    data: membership,
    error: membershipError,
  } =
    await supabase
      .from(
        'organization_users'
      )
      .select(`
        organization_id,
        role
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'user_id',
        userId
      )
      .eq(
        'is_active',
        true
      )
      .in(
        'role',
        MANAGEMENT_ROLES
      )
      .maybeSingle()

  if (
    membershipError
  ) {
    console.error(
      'EWUKAI - switch organization:',
      membershipError
    )

    throw new Error(
      'Impossible de changer d’organisation.'
    )
  }

  if (
    !membership
  ) {
    console.warn(
      'EWUKAI - unauthorized organization switch:',
      {
        userId,
        organizationId,
      }
    )

    redirect(
      '/dashboard'
    )
  }

  // ==========================================================
  // COOKIE
  //
  // HTTP-ONLY :
  // JavaScript navigateur ne peut pas le modifier directement.
  // ==========================================================

  const cookieStore =
    await cookies()

  cookieStore.set(
    ACTIVE_ORGANIZATION_COOKIE,
    organizationId,
    {
      httpOnly:
        true,

      secure:
        process.env
          .NODE_ENV ===
        'production',

      sameSite:
        'lax',

      path:
        '/',

      maxAge:
        60 *
        60 *
        24 *
        365,
    }
  )

  // ==========================================================
  // INVALIDER LE LAYOUT ET LES PAGES
  // ==========================================================

  revalidatePath(
    '/',
    'layout'
  )

  // ==========================================================
  // RETOUR
  // ==========================================================

  redirect(
    returnTo
  )
}

// ============================================================
// SECURISER LE CHEMIN DE RETOUR
// ============================================================

function sanitizeReturnPath(
  value: string
) {
  const normalized =
    value.trim()

  if (
    !normalized ||
    !normalized.startsWith(
      '/'
    ) ||
    normalized.startsWith(
      '//'
    )
  ) {
    return '/dashboard'
  }

  return normalized
}