import 'server-only'

import {
  redirect,
} from 'next/navigation'

import {
  createClient,
} from '@/lib/supabase/server'

// ============================================================
// EWUKAI
// AUTHENTIFICATION ADMINISTRATION PLATEFORME
// ============================================================

export type PlatformAdminRole =
  'super_admin'

type PlatformAdminRow = {
  user_id: string
  role: string
  is_active: boolean
}

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createClient
    >
  >

export type PlatformAdminContext = {
  supabase:
    SupabaseServerClient

  userId:
    string

  role:
    PlatformAdminRole
}

// ============================================================
// ADMIN PLATEFORME OPTIONNEL
// ============================================================

export async function getPlatformAdmin():
  Promise<
    PlatformAdminContext | null
  > {

  const supabase =
    await createClient()

  // ==========================================================
  // UTILISATEUR CONNECTE
  // ==========================================================

  const {
    data:
      authData,

    error:
      authError,
  } =
    await supabase
      .auth
      .getClaims()

  const userId =
    authData
      ?.claims
      ?.sub

  if (
    authError ||
    !userId
  ) {
    if (
      authError
    ) {
      console.error(
        'EWUKAI - platform admin - erreur auth :',
        authError
      )
    }

    return null
  }

  // ==========================================================
  // ROLE PLATEFORME
  // ==========================================================

  const {
    data:
      adminData,

    error:
      adminError,
  } =
    await supabase
      .from(
        'platform_admins'
      )
      .select(`
        user_id,
        role,
        is_active
      `)
      .eq(
        'user_id',
        userId
      )
      .maybeSingle()

  if (
    adminError
  ) {
    console.error(
      'EWUKAI - platform admin - erreur lookup :',
      adminError
    )

    return null
  }

  const admin =
    adminData as
      PlatformAdminRow | null

  if (
    !admin
  ) {
    return null
  }

  if (
    !admin.is_active
  ) {
    return null
  }

  if (
    admin.role !==
    'super_admin'
  ) {
    return null
  }

  return {
    supabase,

    userId,

    role:
      'super_admin',
  }
}

// ============================================================
// SUPER ADMIN OBLIGATOIRE
// ============================================================

export async function requirePlatformSuperAdmin():
  Promise<
    PlatformAdminContext
  > {

  const supabase =
    await createClient()

  // ==========================================================
  // UTILISATEUR CONNECTE
  // ==========================================================

  const {
    data:
      authData,

    error:
      authError,
  } =
    await supabase
      .auth
      .getClaims()

  const userId =
    authData
      ?.claims
      ?.sub

  if (
    authError ||
    !userId
  ) {
    if (
      authError
    ) {
      console.error(
        'EWUKAI - require platform admin - erreur auth :',
        authError
      )
    }

    redirect(
      '/login'
    )
  }

  // ==========================================================
  // VERIFICATION SUPER ADMIN
  // ==========================================================

  const {
    data:
      adminData,

    error:
      adminError,
  } =
    await supabase
      .from(
        'platform_admins'
      )
      .select(`
        user_id,
        role,
        is_active
      `)
      .eq(
        'user_id',
        userId
      )
      .maybeSingle()

  if (
    adminError
  ) {
    console.error(
      'EWUKAI - require platform admin - erreur lookup :',
      adminError
    )

    redirect(
      '/dashboard'
    )
  }

  const admin =
    adminData as
      PlatformAdminRow | null

  if (
    !admin ||
    !admin.is_active ||
    admin.role !==
      'super_admin'
  ) {
    redirect(
      '/dashboard'
    )
  }

  return {
    supabase,

    userId,

    role:
      'super_admin',
  }
}