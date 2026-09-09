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
// AFRI CLUB
// SUPER ADMIN
// CHANGEMENT D'ABONNEMENT
// ============================================================

export async function changeOrganizationSubscription(
  formData: FormData
) {
  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const organizationId =
    formValue(
      formData,
      'organization_id'
    )

  const planCode =
    formValue(
      formData,
      'plan_code'
    )
      .toLowerCase()

  const note =
    formValue(
      formData,
      'note'
    )
      .slice(
        0,
        500
      )

  // ==========================================================
  // VALIDATIONS
  // ==========================================================

  if (
    !isUuid(
      organizationId
    )
  ) {
    redirect(
      '/admin/subscriptions'
    )
  }

  if (
    ![
      'free',
      'standard',
      'pro',
      'enterprise',
    ].includes(
      planCode
    )
  ) {
    redirect(
      `/admin/subscriptions/${organizationId}?error=plan`
    )
  }

  // ==========================================================
  // CHANGEMENT
  // ==========================================================

  const {
    error,
  } =
    await supabase.rpc(
      'change_platform_organization_subscription',
      {
        target_organization_id:
          organizationId,

        target_plan_code:
          planCode,

        change_note:
          note ||
          null,
      }
    )

  if (
    error
  ) {
    console.error(
      'AFRI CLUB - change subscription:',
      error
    )

    const alreadyActive =
      error.message
        ?.toLowerCase()
        .includes(
          'already active'
        )

    redirect(
      `/admin/subscriptions/${organizationId}?error=${
        alreadyActive
          ? 'same_plan'
          : 'change'
      }`
    )
  }

  // ==========================================================
  // REVALIDATION
  // ==========================================================

  revalidatePath(
    '/admin/subscriptions'
  )

  revalidatePath(
    `/admin/subscriptions/${organizationId}`
  )

  revalidatePath(
    `/admin/organizations/${organizationId}`
  )

  revalidatePath(
    '/admin/plans'
  )

  revalidatePath(
    '/admin/dashboard'
  )

  redirect(
    `/admin/subscriptions/${organizationId}?saved=1`
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

  return typeof value ===
    'string'
    ? value.trim()
    : ''
}

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}