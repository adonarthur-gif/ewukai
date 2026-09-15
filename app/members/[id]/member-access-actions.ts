'use server'

import { revalidatePath } from 'next/cache'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import {
  generateMemberAccessToken,
  hashMemberAccessToken,
} from '@/lib/security/member-access-token'

export type MemberAccessState = {
  status:
    | 'idle'
    | 'success'
    | 'error'

  activationLink?: string
  message?: string
}

export async function generateMemberAccessLink(
  _previousState: MemberAccessState,
  formData: FormData
): Promise<MemberAccessState> {
  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
      'secretary',
    ].includes(role)
  ) {
    return {
      status: 'error',
      message:
        'Vous n’êtes pas autorisé à générer un accès membre.',
    }
  }

  const memberId =
    String(
      formData.get(
        'memberId'
      ) ?? ''
    )

  if (!memberId) {
    return {
      status: 'error',
      message:
        'Membre invalide.',
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
        member_number,
        first_name,
        last_name,
        user_id,
        status
      `)
      .eq('id', memberId)
      .eq(
        'organization_id',
        organizationId
      )
      .maybeSingle()

  if (
    memberError ||
    !member
  ) {
    return {
      status: 'error',
      message:
        'Membre introuvable.',
    }
  }

  if (
    member.status !==
    'active'
  ) {
    return {
      status: 'error',
      message:
        'Seul un membre actif peut recevoir un espace membre.',
    }
  }

  if (member.user_id) {
    return {
      status: 'error',
      message:
        'Ce membre possède déjà un espace membre.',
    }
  }

  // ==========================================================
  // GENERER LE TOKEN
  // ==========================================================

  const rawToken =
    generateMemberAccessToken()

  const tokenHash =
    hashMemberAccessToken(
      rawToken
    )

  // Invitation valable 7 jours.

  const expiresAt =
    new Date(
      Date.now() +
        7 *
          24 *
          60 *
          60 *
          1000
    ).toISOString()

  const {
    data: invitationId,
    error,
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

  if (error) {
    console.error(
      'EWUKAI - create member invitation:',
      error
    )

    return {
      status: 'error',
      message:
        'Impossible de générer le lien d’activation.',
    }
  }

  if (!invitationId) {
    return {
      status: 'error',
      message:
        'Impossible de créer l’invitation.',
    }
  }

  const siteUrl =
    (
      process.env
        .NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000'
    ).replace(
      /\/$/,
      ''
    )

  const activationLink =
    `${siteUrl}/inscription/${rawToken}`

  revalidatePath(
    `/members/${memberId}`
  )

  return {
    status: 'success',
    activationLink,
    message:
      'Le lien personnel d’activation a été généré.',
  }
}