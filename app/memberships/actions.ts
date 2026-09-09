'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

const REVIEW_ROLES = [
  'owner',
  'president',
  'secretary',
]

export async function approveApplication(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  if (!REVIEW_ROLES.includes(role)) {
    redirect('/memberships')
  }

  const applicationId = String(
    formData.get('applicationId') ?? ''
  )

  const note = String(
    formData.get('approvalNote') ?? ''
  ).trim()

  if (!applicationId) {
    redirect('/memberships?error=invalid')
  }

  // Vérifier que la demande appartient bien
  // à la mutuelle courante.
  const {
    data: application,
    error: applicationError,
  } = await supabase
    .from('membership_applications')
    .select(`
      id,
      organization_id,
      status
    `)
    .eq('id', applicationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (
    applicationError ||
    !application
  ) {
    redirect('/memberships?error=not-found')
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    'approve_membership_application',
    {
      target_application_id:
        applicationId,

      approval_note:
        note || null,
    }
  )

  if (error) {
    console.error(
      'AFRI CLUB - approve membership:',
      error
    )

    const message =
      error.message
        ?.toLowerCase()
        .includes('phone')
        ? 'phone-exists'
        : error.message
              ?.toLowerCase()
              .includes('email')
          ? 'email-exists'
          : 'server'

    redirect(
      `/memberships/${applicationId}?error=${message}`
    )
  }

  const result = data?.[0]

  if (!result) {
    redirect(
      `/memberships/${applicationId}?error=server`
    )
  }

  revalidatePath('/memberships')
  revalidatePath('/members')
  revalidatePath('/dashboard')

  redirect(
    `/memberships/${applicationId}?success=approved&member=${encodeURIComponent(
      result.member_number
    )}`
  )
}

export async function rejectApplication(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  if (!REVIEW_ROLES.includes(role)) {
    redirect('/memberships')
  }

  const applicationId = String(
    formData.get('applicationId') ?? ''
  )

  const reason = String(
    formData.get('rejectionReason') ?? ''
  ).trim()

  if (
    !applicationId ||
    reason.length < 3
  ) {
    redirect(
      `/memberships/${applicationId}?error=rejection-reason`
    )
  }

  const {
    data: application,
    error: applicationError,
  } = await supabase
    .from('membership_applications')
    .select(`
      id,
      organization_id,
      status
    `)
    .eq('id', applicationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (
    applicationError ||
    !application
  ) {
    redirect('/memberships?error=not-found')
  }

  const { error } = await supabase.rpc(
    'reject_membership_application',
    {
      target_application_id:
        applicationId,

      rejection_reason:
        reason,
    }
  )

  if (error) {
    console.error(
      'AFRI CLUB - reject membership:',
      error
    )

    redirect(
      `/memberships/${applicationId}?error=server`
    )
  }

  revalidatePath('/memberships')
  revalidatePath('/dashboard')

  redirect(
    `/memberships/${applicationId}?success=rejected`
  )
}