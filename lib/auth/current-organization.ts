import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

// ============================================================
// ROLES
// ============================================================

export type OrganizationRole =
  | 'owner'
  | 'president'
  | 'treasurer'
  | 'secretary'
  | 'auditor'
  | 'member'

export type ManagementRole =
  | 'owner'
  | 'president'
  | 'treasurer'
  | 'secretary'
  | 'auditor'

// ============================================================
// CONSTANTES
// ============================================================

export const MANAGEMENT_ROLES:
  ManagementRole[] = [
    'owner',
    'president',
    'treasurer',
    'secretary',
    'auditor',
  ]

export const ACTIVE_ORGANIZATION_COOKIE =
  'afri_club_active_organization'

// ============================================================
// TYPES INTERNES
// ============================================================

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createClient
    >
  >

type ManagementMembership = {
  organization_id: string
  role: OrganizationRole
  created_at: string
}

export type CurrentOrganization = {
  supabase: SupabaseServerClient
  userId: string
  organizationId: string
  role: OrganizationRole
}

// ============================================================
// RESOLUTION DE L'ORGANISATION ACTIVE
// ============================================================

async function resolveCurrentMembership({
  supabase,
  userId,
}: {
  supabase: SupabaseServerClient
  userId: string
}) {
  // ==========================================================
  // TOUTES LES ORGANISATIONS QUE CET UTILISATEUR PEUT GERER
  // ==========================================================

  const {
    data: membershipsRaw,
    error: membershipError,
  } =
    await supabase
      .from(
        'organization_users'
      )
      .select(`
        organization_id,
        role,
        created_at
      `)
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
      .order(
        'created_at',
        {
          ascending: true,
        }
      )

  if (
    membershipError
  ) {
    console.error(
      'AFRI CLUB - current organization - memberships:',
      membershipError
    )

    throw new Error(
      'Impossible de récupérer les organisations accessibles.'
    )
  }

  const memberships =
    (
      membershipsRaw ??
      []
    ) as ManagementMembership[]

  if (
    memberships.length ===
    0
  ) {
    return null
  }

  // ==========================================================
  // ORGANISATION MEMORISEE
  // ==========================================================

  const cookieStore =
    await cookies()

  const requestedOrganizationId =
    cookieStore
      .get(
        ACTIVE_ORGANIZATION_COOKIE
      )
      ?.value
      ?.trim() ??
    ''

  // ==========================================================
  // LE COOKIE N'EST JAMAIS FAIT CONFIANCE DIRECTEMENT
  //
  // On vérifie que cette organisation appartient réellement
  // aux organisations que l'utilisateur peut gérer.
  // ==========================================================

  if (
    requestedOrganizationId
  ) {
    const selectedMembership =
      memberships.find(
        (
          membership
        ) =>
          membership
            .organization_id ===
          requestedOrganizationId
      )

    if (
      selectedMembership
    ) {
      return selectedMembership
    }
  }

  // ==========================================================
  // FALLBACK
  //
  // Pas de cookie ou cookie invalide :
  // première organisation autorisée.
  // ==========================================================

  return memberships[0]
}

// ============================================================
// CONTEXTE OPTIONNEL
//
// Utilisé par la navigation globale.
// Ne redirige pas.
// ============================================================

export async function getCurrentOrganization():
  Promise<
    CurrentOrganization | null
  > {
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
    return null
  }

  const membership =
    await resolveCurrentMembership({
      supabase,
      userId,
    })

  if (
    !membership
  ) {
    return null
  }

  return {
    supabase,

    userId,

    organizationId:
      membership
        .organization_id,

    role:
      membership
        .role,
  }
}

// ============================================================
// CONTEXTE OBLIGATOIRE
//
// Utilisé par Dashboard, Membres, Caisse, Cotisations, etc.
// ============================================================

export async function requireCurrentOrganization():
  Promise<CurrentOrganization> {
  const supabase =
    await createClient()

  // ==========================================================
  // AUTHENTIFICATION
  // ==========================================================

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
  // ORGANISATION ACTIVE
  // ==========================================================

  const membership =
    await resolveCurrentMembership({
      supabase,
      userId,
    })

  if (
    !membership
  ) {
    redirect(
      '/onboarding'
    )
  }

  // ==========================================================
  // RESULTAT
  // ==========================================================

  return {
    supabase,

    userId,

    organizationId:
      membership
        .organization_id,

    role:
      membership
        .role,
  }
}