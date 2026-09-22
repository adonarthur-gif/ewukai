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
// EWUKAI
// SUPER ADMIN
// GESTION ADMINISTRATIVE DES ABONNEMENTS
//
// Standard et Pro ne sont jamais activés manuellement ici.
// Ils passent par : demande -> facture -> paiement confirmé.
//
// Les changements directs restent réservés à :
// - Gratuit ;
// - Entreprise (offre / contrat géré administrativement).
// ============================================================

const administrativePlanCodes = [
  'free',
  'enterprise',
] as const

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

  // Standard / Pro doivent suivre le circuit de paiement.
  if (
    planCode === 'standard' ||
    planCode === 'pro'
  ) {
    redirect(
      `/admin/subscriptions/${organizationId}?error=payment_required`
    )
  }

  if (
    !administrativePlanCodes.includes(
      planCode as
        (typeof administrativePlanCodes)[number]
    )
  ) {
    redirect(
      `/admin/subscriptions/${organizationId}?error=plan`
    )
  }

  // Une facture ouverte doit d'abord être traitée avant tout
  // changement administratif afin de ne pas créer deux états
  // commerciaux contradictoires.
  const {
    data:
      collectionData,
    error:
      collectionError,
  } =
    await supabase.rpc(
      'list_platform_subscription_collection'
    )

  if (collectionError) {
    console.error(
      'EWUKAI - subscription collection check:',
      collectionError
    )

    redirect(
      `/admin/subscriptions/${organizationId}?error=billing_check`
    )
  }

  const collectionRows =
    (
      Array.isArray(
        collectionData
      )
        ? collectionData
        : []
    ) as Array<{
      organization_id?:
        | string
        | null
    }>

  const hasOpenInvoice =
    collectionRows.some(
      item =>
        item.organization_id ===
        organizationId
    )

  if (hasOpenInvoice) {
    redirect(
      `/admin/subscriptions/${organizationId}?error=pending_request`
    )
  }

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

  if (error) {
    console.error(
      'EWUKAI - change subscription:',
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
    '/admin/billing'
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
