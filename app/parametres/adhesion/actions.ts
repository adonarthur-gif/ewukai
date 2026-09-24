'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

// ============================================================
// EWUKAI
// PARAMETRES D'ADHESION
// ============================================================

export async function updateMembershipSettings(
  formData: FormData
) {
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
    ].includes(
      role
    )
  ) {
    redirect(
      '/parametres/adhesion?error=forbidden'
    )
  }

  const onlineMembershipEnabled =
    formData.get(
      'onlineMembershipEnabled'
    ) ===
    'on'

  const membershipType =
    String(
      formData.get(
        'membershipType'
      ) ??
      'free'
    )
      .trim()
      .toLowerCase()

  const feeEnabled =
    membershipType ===
    'paid'

  const feeAmountRaw =
    String(
      formData.get(
        'membershipFeeAmountXof'
      ) ??
      ''
    )
      .replace(
        /\s/g,
        ''
      )
      .trim()

  const allowFeeWaiver =
    formData.get(
      'allowFeeWaiver'
    ) ===
    'on'

  let feeAmountXof =
    0

  if (
    feeEnabled
  ) {
    if (
      !/^\d+$/.test(
        feeAmountRaw
      )
    ) {
      redirect(
        '/parametres/adhesion?error=invalid-amount'
      )
    }

    feeAmountXof =
      Number(
        feeAmountRaw
      )

    if (
      !Number.isSafeInteger(
        feeAmountXof
      ) ||
      feeAmountXof <=
        0
    ) {
      redirect(
        '/parametres/adhesion?error=invalid-amount'
      )
    }
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'update_organization_membership_settings',
      {
        target_organization_id:
          organizationId,

        target_online_membership_enabled:
          onlineMembershipEnabled,

        target_fee_enabled:
          feeEnabled,

        target_fee_amount_xof:
          feeAmountXof,

        target_allow_fee_waiver:
          allowFeeWaiver,
      }
    )

  if (
    error
  ) {
    console.error(
      'EWUKAI - membership settings:',
      {
        code:
          error.code,
        message:
          error.message,
        details:
          error.details,
        hint:
          error.hint,
      }
    )

    const normalizedMessage =
      (
        error.message ??
        ''
      )
        .toLowerCase()

    if (
      normalizedMessage.includes(
        'not authorized'
      )
    ) {
      redirect(
        '/parametres/adhesion?error=forbidden'
      )
    }

    if (
      normalizedMessage.includes(
        'greater than zero'
      )
    ) {
      redirect(
        '/parametres/adhesion?error=invalid-amount'
      )
    }

    redirect(
      '/parametres/adhesion?error=server'
    )
  }

  const result =
    data &&
    typeof data ===
      'object' &&
    !Array.isArray(
      data
    )
      ? data as Record<
          string,
          unknown
        >
      : null

  const publicSlug =
    typeof result
      ?.public_slug ===
      'string'
      ? result
          .public_slug
          .trim()
      : ''

  revalidatePath(
    '/parametres/adhesion'
  )

  revalidatePath(
    '/dashboard'
  )

  if (
    publicSlug
  ) {
    revalidatePath(
      `/m/${publicSlug}`
    )

    revalidatePath(
      `/m/${publicSlug}/join`
    )
  }

  redirect(
    '/parametres/adhesion?saved=1'
  )
}
