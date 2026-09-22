'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

// ============================================================
// EWUKAI
// GESTION DU STATUT ET SUPPRESSION SECURISEE D'UN MEMBRE
// ============================================================

const memberIdSchema =
  z.string().uuid()

const memberStatusSchema =
  z.enum([
    'active',
    'inactive',
  ])

const MANAGEMENT_ROLES = [
  'owner',
  'president',
  'secretary',
]

function memberUrl(
  memberId: string,
  key: string,
  value: string
) {
  return `/members/${memberId}?${key}=${encodeURIComponent(
    value
  )}`
}

function getErrorMessage(
  message:
    | string
    | null
    | undefined
) {
  const normalized =
    message
      ?.trim()
      .toLowerCase() ??
    ''

  if (
    normalized.includes(
      'member has an ewukai account'
    )
  ) {
    return 'Ce membre possède déjà un compte EWUKAI. Pour préserver son identité et ses accès, sa suppression définitive est bloquée. Désactivez-le.'
  }

  if (
    normalized.includes(
      'member has related history'
    )
  ) {
    return 'Ce membre possède déjà un historique dans l’organisation. Il ne peut pas être supprimé définitivement ; désactivez-le afin de conserver les données.'
  }

  if (
    normalized.includes(
      'member must be inactive'
    )
  ) {
    return 'Le membre doit d’abord être désactivé avant toute suppression définitive.'
  }

  if (
    normalized.includes(
      'not authorized'
    )
  ) {
    return 'Vous ne disposez pas des droits nécessaires.'
  }

  if (
    normalized.includes(
      'member not found'
    )
  ) {
    return 'Membre introuvable.'
  }

  return 'L’opération n’a pas pu être effectuée.'
}

// ============================================================
// ACTIVER / DESACTIVER
// ============================================================

export async function setMemberStatus(
  formData: FormData
) {
  const memberIdResult =
    memberIdSchema.safeParse(
      formData.get('memberId')
    )

  const statusResult =
    memberStatusSchema.safeParse(
      formData.get('nextStatus')
    )

  if (
    !memberIdResult.success ||
    !statusResult.success
  ) {
    redirect('/members')
  }

  const memberId =
    memberIdResult.data

  const nextStatus =
    statusResult.data

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    !MANAGEMENT_ROLES.includes(
      role
    )
  ) {
    redirect(
      memberUrl(
        memberId,
        'error',
        'Vous ne disposez pas des droits nécessaires.'
      )
    )
  }

  const {
    data: member,
    error: memberError,
  } =
    await supabase
      .from('members')
      .select(`
        id,
        organization_id
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
    redirect('/members')
  }

  const {
    error,
  } =
    await supabase.rpc(
      'set_member_management_status',
      {
        target_member_id:
          memberId,

        target_status:
          nextStatus,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - set member status:',
      error
    )

    redirect(
      memberUrl(
        memberId,
        'error',
        getErrorMessage(
          error.message
        )
      )
    )
  }

  revalidatePath('/members')
  revalidatePath(
    `/members/${memberId}`
  )
  revalidatePath('/dashboard')
  revalidatePath(
    '/contributions/collection'
  )
  revalidatePath('/my-space')

  redirect(
    `/members/${memberId}?statusUpdated=${nextStatus}`
  )
}

// ============================================================
// SUPPRESSION DEFINITIVE SECURISEE
// ============================================================

export async function deleteMember(
  formData: FormData
) {
  const memberIdResult =
    memberIdSchema.safeParse(
      formData.get('memberId')
    )

  if (
    !memberIdResult.success
  ) {
    redirect('/members')
  }

  const memberId =
    memberIdResult.data

  const confirmation =
    String(
      formData.get(
        'confirmation'
      ) ?? ''
    )
      .trim()
      .toUpperCase()

  if (
    confirmation !==
    'SUPPRIMER'
  ) {
    redirect(
      memberUrl(
        memberId,
        'error',
        'Saisissez SUPPRIMER pour confirmer la suppression définitive.'
      )
    )
  }

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    !MANAGEMENT_ROLES.includes(
      role
    )
  ) {
    redirect(
      memberUrl(
        memberId,
        'error',
        'Vous ne disposez pas des droits nécessaires.'
      )
    )
  }

  const {
    data: member,
    error: memberError,
  } =
    await supabase
      .from('members')
      .select(`
        id,
        organization_id,
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
    redirect('/members')
  }

  if (
    member.status !==
    'inactive'
  ) {
    redirect(
      memberUrl(
        memberId,
        'error',
        'Le membre doit d’abord être désactivé avant toute suppression définitive.'
      )
    )
  }

  const {
    error,
  } =
    await supabase.rpc(
      'delete_member_if_safe',
      {
        target_member_id:
          memberId,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - delete member:',
      error
    )

    redirect(
      memberUrl(
        memberId,
        'error',
        getErrorMessage(
          error.message
        )
      )
    )
  }

  revalidatePath('/members')
  revalidatePath('/dashboard')
  revalidatePath(
    '/contributions/collection'
  )

  redirect(
    '/members?deleted=1'
  )
}
