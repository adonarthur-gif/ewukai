'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

// ============================================================
// AFRI CLUB
// ACTIONS DE CONNEXION
// ============================================================


// ============================================================
// ROLES DE GESTION
// ============================================================

const MANAGEMENT_ROLES = new Set([
  'owner',
  'president',
  'treasurer',
  'secretary',
  'auditor',
])


// ============================================================
// CONNEXION MEMBRE
// ============================================================

export async function loginMember(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await authenticate(
    formData,
    '/login/membre'
  )

  // ----------------------------------------------------------
  // Vérifier que ce compte est bien rattaché
  // à un dossier membre actif.
  // ----------------------------------------------------------

  const {
    data: memberSpace,
    error: memberError,
  } = await supabase.rpc(
    'get_my_member_financial_space',
    {
      target_organization_id: null,
    }
  )

  if (
    memberError ||
    !memberSpace
  ) {
    if (memberError) {
      console.error(
        'LOGIN MEMBER:',
        memberError
      )
    }

    await supabase.auth.signOut()

    redirect(
      `/login/membre?error=${encodeURIComponent(
        "Ce compte n'est pas rattaché à un dossier membre actif."
      )}`
    )
  }

  console.log(
    'AFRI CLUB - LOGIN MEMBER:',
    userId
  )

  redirect('/my-space')
}


// ============================================================
// CONNEXION DIRIGEANT
// ============================================================
//
// RÈGLE :
//
// 1. Le compte possède une mutuelle active avec rôle de gestion
//    -> /dashboard
//
// 2. Le compte est authentifié mais ne dirige aucune mutuelle
//    -> /onboarding
//
//    IMPORTANT :
//    On NE déconnecte PAS l'utilisateur dans ce second cas,
//    puisqu'il doit pouvoir créer sa première mutuelle.
// ============================================================

export async function loginManager(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await authenticate(
    formData,
    '/login/dirigeant'
  )

  // ----------------------------------------------------------
  // RECHERCHER LES RATTACHEMENTS ACTIFS
  // ----------------------------------------------------------

  const {
    data: organizationUsers,
    error,
  } =
    await supabase
      .from('organization_users')
      .select(`
        organization_id,
        role,
        is_active
      `)
      .eq(
        'user_id',
        userId
      )
      .eq(
        'is_active',
        true
      )

  // ----------------------------------------------------------
  // ERREUR DE BASE DE DONNÉES
  // ----------------------------------------------------------

  if (error) {
    console.error(
      'AFRI CLUB - LOGIN MANAGER:',
      error
    )

    await supabase.auth.signOut()

    redirect(
      `/login/dirigeant?error=${encodeURIComponent(
        "Impossible de vérifier vos droits d'accès."
      )}`
    )
  }

  // ----------------------------------------------------------
  // RECHERCHER UN RÔLE DE GESTION
  // ----------------------------------------------------------

  const managementMembership =
    (
      organizationUsers ??
      []
    ).find(
      (membership) =>
        MANAGEMENT_ROLES.has(
          String(
            membership.role
          )
        )
    )

  // ----------------------------------------------------------
  // DIRIGEANT EXISTANT
  // ----------------------------------------------------------

  if (managementMembership) {
    console.log(
      'AFRI CLUB - LOGIN MANAGER:',
      {
        userId,
        organizationId:
          managementMembership.organization_id,
        role:
          managementMembership.role,
      }
    )

    redirect('/dashboard')
  }

  // ----------------------------------------------------------
  // AUCUNE MUTUELLE À GÉRER
  //
  // Ce n'est PAS une erreur.
  //
  // Le compte est correctement authentifié.
  // Il doit pouvoir créer sa première mutuelle.
  // ----------------------------------------------------------

  console.log(
    'AFRI CLUB - LOGIN MANAGER - ONBOARDING:',
    {
      userId,
      message:
        'Aucune mutuelle de gestion active. Redirection vers onboarding.',
    }
  )

  redirect('/onboarding')
}


// ============================================================
// LOGIN GÉNÉRAL / COMPATIBILITÉ
// ============================================================
//
// Ce login choisit automatiquement l'espace approprié.
//
// Priorité :
//
// 1. rôle de gestion -> dashboard
// 2. dossier membre -> my-space
// 3. aucun rattachement -> onboarding
// ============================================================

export async function login(
  formData: FormData
) {
  const {
    supabase,
    userId,
  } = await authenticate(
    formData,
    '/login'
  )

  // ----------------------------------------------------------
  // 1. CHERCHER UN ACCÈS DE GESTION
  // ----------------------------------------------------------

  const {
    data: memberships,
    error: membershipsError,
  } =
    await supabase
      .from('organization_users')
      .select(`
        organization_id,
        role,
        is_active
      `)
      .eq(
        'user_id',
        userId
      )
      .eq(
        'is_active',
        true
      )

  if (membershipsError) {
    console.error(
      'AFRI CLUB - LOGIN MEMBERSHIPS:',
      membershipsError
    )
  }

  const hasManagementAccess =
    (
      memberships ??
      []
    ).some(
      (membership) =>
        MANAGEMENT_ROLES.has(
          String(
            membership.role
          )
        )
    )

  if (hasManagementAccess) {
    redirect('/dashboard')
  }

  // ----------------------------------------------------------
  // 2. CHERCHER UN ESPACE MEMBRE
  // ----------------------------------------------------------

  const {
    data: memberSpace,
    error: memberSpaceError,
  } =
    await supabase.rpc(
      'get_my_member_financial_space',
      {
        target_organization_id:
          null,
      }
    )

  if (memberSpaceError) {
    console.error(
      'AFRI CLUB - LOGIN MEMBER SPACE:',
      memberSpaceError
    )
  }

  if (memberSpace) {
    redirect('/my-space')
  }

  // ----------------------------------------------------------
  // 3. NOUVEL UTILISATEUR
  //
  // Pas de mutuelle gérée
  // Pas de dossier membre
  //
  // Il peut créer sa première mutuelle.
  // ----------------------------------------------------------

  redirect('/onboarding')
}


// ============================================================
// AUTHENTIFICATION COMMUNE
// ============================================================

async function authenticate(
  formData: FormData,
  returnPath: string
) {
  // ----------------------------------------------------------
  // EMAIL
  // ----------------------------------------------------------

  const email =
    getString(
      formData,
      'email'
    )
      .trim()
      .toLowerCase()

  // ----------------------------------------------------------
  // MOT DE PASSE
  // ----------------------------------------------------------

  const password =
    getString(
      formData,
      'password'
    )

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!email) {
    redirect(
      `${returnPath}?error=${encodeURIComponent(
        'Veuillez saisir votre adresse e-mail.'
      )}`
    )
  }

  if (!password) {
    redirect(
      `${returnPath}?error=${encodeURIComponent(
        'Veuillez saisir votre mot de passe.'
      )}`
    )
  }

  // ----------------------------------------------------------
  // CLIENT SUPABASE
  // ----------------------------------------------------------

  const supabase =
    await createClient()

  // ----------------------------------------------------------
  // NETTOYER UNE ÉVENTUELLE ANCIENNE SESSION
  //
  // On ne force pas signOut ici :
  // signInWithPassword remplacera la session correctement.
  // ----------------------------------------------------------

  const {
    data,
    error,
  } =
    await supabase.auth
      .signInWithPassword({
        email,
        password,
      })

  // ----------------------------------------------------------
  // AUTHENTIFICATION ÉCHOUÉE
  // ----------------------------------------------------------

  if (
    error ||
    !data.user
  ) {
    if (error) {
      console.error(
        'AFRI CLUB - AUTH:',
        {
          code:
            error.code,
          message:
            error.message,
        }
      )
    }

    redirect(
      `${returnPath}?error=${encodeURIComponent(
        'Adresse e-mail ou mot de passe incorrect.'
      )}`
    )
  }

  // ----------------------------------------------------------
  // AUTHENTIFICATION RÉUSSIE
  // ----------------------------------------------------------

  console.log(
    'AFRI CLUB - AUTH OK:',
    {
      userId:
        data.user.id,

      email:
        data.user.email,
    }
  )

  return {
    supabase,

    userId:
      data.user.id,
  }
}


// ============================================================
// UTILITAIRE
// ============================================================

function getString(
  formData: FormData,
  key: string
) {
  const value =
    formData.get(key)

  return typeof value ===
    'string'
    ? value.trim()
    : ''
}