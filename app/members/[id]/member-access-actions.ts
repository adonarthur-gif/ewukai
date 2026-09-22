'use server'

import {
  createHash,
  randomBytes,
} from 'node:crypto'


import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

// ============================================================
// EWUKAI
// ACCES PERSONNEL DU MEMBRE
// GENERATION DU LIEN D'ACTIVATION
// ============================================================

export type MemberAccessActionState = {
  status:
    | 'idle'
    | 'success'
    | 'error'

  message?: string

  activationLink?: string
}

// ============================================================
// ROLES AUTORISES
// ============================================================

const ALLOWED_ROLES = [
  'owner',
  'president',
  'secretary',
]

// ============================================================
// GENERER UN LIEN PERSONNEL D'ACTIVATION
// ============================================================

export async function generateMemberAccessLink(
  _previousState:
    MemberAccessActionState,
  formData: FormData
): Promise<MemberAccessActionState> {
  const memberId =
    String(
      formData.get(
        'memberId'
      ) ?? ''
    ).trim()

  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (!memberId) {
    return {
      status: 'error',
      message:
        'Membre invalide.',
    }
  }

  // ==========================================================
  // ORGANISATION COURANTE
  // ==========================================================

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ==========================================================
  // AUTORISATION
  // ==========================================================

  if (
    !ALLOWED_ROLES.includes(
      role
    )
  ) {
    return {
      status: 'error',
      message:
        'Vous ne disposez pas des droits nécessaires pour générer un accès membre.',
    }
  }

  // ==========================================================
  // VERIFIER LE MEMBRE
  // ==========================================================

  const {
    data: member,
    error: memberError,
  } =
    await supabase
      .from('members')
      .select(`
        id,
        organization_id,
        user_id,
        status
      `)
      .eq(
        'id',
        memberId
      )
      .eq(
        'organization_id',
        organizationId
      )
      .maybeSingle()

  if (
    memberError ||
    !member
  ) {
    console.error(
      'EWUKAI - member access lookup:',
      memberError
    )

    return {
      status: 'error',
      message:
        'Membre introuvable.',
    }
  }

  // ==========================================================
  // LE MEMBRE DOIT ETRE ACTIF
  // ==========================================================

  if (
    member.status !==
    'active'
  ) {
    return {
      status: 'error',
      message:
        'Le membre doit être actif pour recevoir un lien d’activation.',
    }
  }

  // ==========================================================
  // DEJA RATTACHE A UN COMPTE
  // ==========================================================

  if (member.user_id) {
    return {
      status: 'error',
      message:
        'Ce membre possède déjà un accès EWUKAI.',
    }
  }

  // ==========================================================
  // GENERER LE TOKEN
  //
  // Le token brut est envoyé dans l'URL.
  // Seul son hash SHA-256 est enregistré dans Supabase.
  // ==========================================================

  const rawToken =
    randomBytes(32)
      .toString(
        'base64url'
      )

  const tokenHash =
    createHash(
      'sha256'
    )
      .update(
        rawToken
      )
      .digest(
        'hex'
      )
      .toLowerCase()

  // ==========================================================
  // EXPIRATION
  //
  // 7 jours.
  // ==========================================================

  const expiresAt =
    new Date(
      Date.now() +
        7 *
          24 *
          60 *
          60 *
          1000
    ).toISOString()

  // ==========================================================
  // CREER L'INVITATION
  // ==========================================================

  const {
    error:
      invitationError,
  } =
    await supabase.rpc(
      'create_member_access_invitation',
      {
        target_member_id:
          memberId,

        target_token_hash:
          tokenHash,

        target_expires_at:
          expiresAt,
      }
    )

  if (invitationError) {
    console.error(
      'EWUKAI - create member invitation:',
      invitationError
    )

    const errorMessage =
      (
        invitationError
          .message ??
        ''
      )
        .trim()
        .toLowerCase()

    if (
      errorMessage.includes(
        'member is not active'
      )
    ) {
      return {
        status: 'error',
        message:
          'Le membre doit être actif pour recevoir un lien d’activation.',
      }
    }

    if (
      errorMessage.includes(
        'already has'
      )
    ) {
      return {
        status: 'error',
        message:
          'Ce membre possède déjà un accès EWUKAI.',
      }
    }

    if (
      errorMessage.includes(
        'not authorized'
      )
    ) {
      return {
        status: 'error',
        message:
          'Vous ne disposez pas des droits nécessaires.',
      }
    }

    return {
      status: 'error',
      message:
        'Impossible de générer le lien d’activation pour le moment.',
    }
  }

  // ==========================================================
  // CONSTRUIRE L'URL D'ACTIVATION
  // ==========================================================

  const activationLink =
    await buildActivationLink(
      rawToken
    )

  // ==========================================================
  // RESULTAT
  // ==========================================================

  return {
    status: 'success',

    message:
      'Le lien personnel d’activation a été généré.',

    activationLink,
  }
}

// ============================================================
// CONSTRUIRE L'URL ABSOLUE
// ============================================================

function buildActivationLink(
  token: string
) {
  const path =
    `/activate/${encodeURIComponent(
      token
    )}`

  const configuredSiteUrl =
    process.env
      .NEXT_PUBLIC_SITE_URL
      ?.trim()

  // En développement local uniquement.
  if (!configuredSiteUrl) {
    if (
      process.env.NODE_ENV !==
      'production'
    ) {
      return `http://localhost:3000${path}`
    }

    throw new Error(
      'NEXT_PUBLIC_SITE_URL is required in production'
    )
  }

  let siteUrl: URL

  try {
    siteUrl =
      new URL(
        configuredSiteUrl
      )
  } catch {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL is invalid'
    )
  }

  if (
    process.env.NODE_ENV ===
      'production' &&
    siteUrl.protocol !==
      'https:'
  ) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL must use HTTPS in production'
    )
  }

  return new URL(
    path,
    `${siteUrl.origin}/`
  ).toString()
}
//

export type MemberAccessState = MemberAccessActionState
