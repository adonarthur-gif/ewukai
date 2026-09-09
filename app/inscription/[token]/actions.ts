'use server'

import { createHash } from 'node:crypto'

import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// TYPES
// ============================================================

type InvitationData = {
  valid: boolean

  organization_id:
    | string
    | null

  first_name:
    | string
    | null

  last_name:
    | string
    | null

  member_number:
    | string
    | null

  member_email:
    | string
    | null

  email_locked:
    | boolean

  organization_name:
    | string
    | null

  organization_short_name:
    | string
    | null

  expires_at:
    | string
    | null

  already_used:
    | boolean

  revoked:
    | boolean
}

// ============================================================
// INSCRIPTION MEMBRE
// ============================================================

export async function registerMember(
  formData: FormData
) {
  const rawToken =
    getString(
      formData,
      'token'
    )

  const submittedEmail =
    normalizeEmail(
      getString(
        formData,
        'email'
      )
    )

  const password =
    getString(
      formData,
      'password'
    )

  const passwordConfirmation =
    getString(
      formData,
      'passwordConfirmation'
    )

  // ==========================================================
  // TOKEN
  // ==========================================================

  if (!rawToken) {
    redirect(
      '/login?error=' +
        encodeURIComponent(
          'Lien d’inscription invalide.'
        )
    )
  }

  const registrationUrl =
    `/inscription/${encodeURIComponent(
      rawToken
    )}`

  // ==========================================================
  // MOT DE PASSE
  // ==========================================================

  if (password.length < 8) {
    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'Le mot de passe doit contenir au moins 8 caractères.'
      )}`
    )
  }

  if (password.length > 128) {
    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'Le mot de passe est trop long.'
      )}`
    )
  }

  if (
    password !==
    passwordConfirmation
  ) {
    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'Les deux mots de passe ne correspondent pas.'
      )}`
    )
  }

  // ==========================================================
  // HASH DU TOKEN
  // ==========================================================

  const tokenHash =
    hashToken(rawToken)

  const supabase =
    await createClient()

  // ==========================================================
  // RELIRE L'INVITATION COTE SERVEUR
  //
  // IMPORTANT :
  // On ne fait jamais confiance aux informations du formulaire.
  // ==========================================================

  const {
    data: invitationRaw,
    error: invitationError,
  } =
    await supabase.rpc(
      'get_member_access_invitation',
      {
        target_token_hash:
          tokenHash,
      }
    )

  if (
    invitationError ||
    !invitationRaw
  ) {
    console.error(
      'MEMBER REGISTRATION - invitation:',
      invitationError
    )

    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'Ce lien d’inscription est invalide.'
      )}`
    )
  }

  const invitation =
    invitationRaw as InvitationData

  // ==========================================================
  // VALIDITE DU LIEN
  // ==========================================================

  if (!invitation.valid) {
    let message =
      'Ce lien d’inscription n’est plus valide.'

    if (
      invitation.already_used
    ) {
      message =
        'Ce lien d’inscription a déjà été utilisé.'
    } else if (
      invitation.revoked
    ) {
      message =
        'Ce lien d’inscription a été annulé.'
    }

    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        message
      )}`
    )
  }

  // ==========================================================
  // EMAIL
  //
  // Si la fiche membre possède déjà une adresse :
  // cette adresse est obligatoire.
  //
  // Sinon :
  // le membre peut saisir son adresse.
  // ==========================================================

  const memberEmail =
    normalizeEmail(
      invitation.member_email ??
        ''
    )

  const email =
    memberEmail ||
    submittedEmail

  if (!email) {
    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'Veuillez saisir votre adresse e-mail.'
      )}`
    )
  }

  if (!isValidEmail(email)) {
    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'L’adresse e-mail saisie est invalide.'
      )}`
    )
  }

  // Protection contre la modification
  // d'un email imposé par la fiche membre.
  if (
    memberEmail &&
    submittedEmail &&
    memberEmail !==
      submittedEmail
  ) {
    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'L’adresse e-mail ne correspond pas à celle enregistrée pour ce membre.'
      )}`
    )
  }

  // ==========================================================
  // CLIENT ADMIN
  // ==========================================================

  const admin =
    createAdminClient()

  // ==========================================================
  // CREATION DU COMPTE
  //
  // email_confirm = true :
  // aucune validation email supplémentaire.
  // ==========================================================

  const {
    data: createdUserData,
    error: createUserError,
  } =
    await admin.auth.admin
      .createUser({
        email,
        password,

        email_confirm: true,

        user_metadata: {
          first_name:
            invitation.first_name ??
            '',

          last_name:
            invitation.last_name ??
            '',

          member_number:
            invitation.member_number ??
            '',

          organization_id:
            invitation.organization_id ??
            '',
        },
      })

  if (
    createUserError ||
    !createdUserData.user
  ) {
    console.error(
      'MEMBER REGISTRATION - create user:',
      createUserError
    )

    const rawMessage =
      createUserError?.message
        ?.toLowerCase() ??
      ''

    const existingAccount =
      rawMessage.includes(
        'already'
      ) ||
      rawMessage.includes(
        'registered'
      ) ||
      rawMessage.includes(
        'exists'
      )

    if (existingAccount) {
      redirect(
        `${registrationUrl}?existing=1`
      )
    }

    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'Impossible de créer votre compte pour le moment.'
      )}`
    )
  }

  const createdUser =
    createdUserData.user

  // ==========================================================
  // CONNEXION IMMEDIATE
  //
  // Le client SSR écrit la session dans les cookies.
  // ==========================================================

  const {
    error: signInError,
  } =
    await supabase.auth
      .signInWithPassword({
        email,
        password,
      })

  if (signInError) {
    console.error(
      'MEMBER REGISTRATION - sign in:',
      signInError
    )

    // Nettoyage du compte créé
    // puisque le rattachement n'a pas encore eu lieu.
    await admin.auth.admin
      .deleteUser(
        createdUser.id
      )

    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'Le compte a été préparé mais la connexion a échoué. Veuillez recommencer.'
      )}`
    )
  }

  // ==========================================================
  // RATTACHEMENT DU COMPTE AU DOSSIER MEMBRE
  // ==========================================================

  const {
    data: claimData,
    error: claimError,
  } =
    await supabase.rpc(
      'claim_member_access',
      {
        target_token_hash:
          tokenHash,
      }
    )

  if (
    claimError ||
    !claimData ||
    claimData.length === 0
  ) {
    console.error(
      'MEMBER REGISTRATION - claim:',
      claimError
    )

    await supabase.auth
      .signOut()

    // Le compte vient d'être créé
    // dans cette action :
    // on le supprime pour éviter
    // un utilisateur orphelin.
    await admin.auth.admin
      .deleteUser(
        createdUser.id
      )

    redirect(
      `${registrationUrl}?error=${encodeURIComponent(
        'Votre compte n’a pas pu être rattaché à votre dossier membre.'
      )}`
    )
  }

  const memberAccess =
    claimData[0] as {
      member_id: string
      member_number: string
      organization_id: string
  }

  // ==========================================================
  // SI LE MEMBRE N'AVAIT PAS D'EMAIL,
  // ENREGISTRER L'EMAIL UTILISE POUR LE COMPTE
  // ==========================================================

  if (!memberEmail) {
    const {
      error: memberEmailError,
    } =
      await admin
        .from('members')
        .update({
          email,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          memberAccess.member_id
        )
        .is(
          'email',
          null
        )

    if (memberEmailError) {
      console.error(
        'MEMBER REGISTRATION - save member email:',
        memberEmailError
      )
    }
  }

  // ==========================================================
  // FIN
  // ==========================================================

  redirect(
    '/my-space?registered=1'
  )
}

// ============================================================
// OUTILS
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

function normalizeEmail(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

function hashToken(
  token: string
) {
  return createHash(
    'sha256'
  )
    .update(token)
    .digest('hex')
    .toLowerCase()
}