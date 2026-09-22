'use server'

import {
  revalidatePath,
} from 'next/cache'

import {
  redirect,
} from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

// ============================================================
// EWUKAI
// ABONNEMENT ORGANISATION
//
// Étape actuelle :
// - choisir Standard ou Pro ;
// - préparer l'abonnement pending_payment ;
// - préparer la facture ;
// - ne contacter aucun prestataire de paiement.
//
// Le branchement CinetPay sera réactivé plus tard, une fois le
// compte marchand et l'URL publique disponibles.
// ============================================================

const subscribablePlanCodes = [
  'standard',
  'pro',
] as const

type SubscribablePlanCode =
  (typeof subscribablePlanCodes)[number]

type CheckoutResult = {
  subscription_id?: string | null
  invoice_id?: string | null
  plan_code?: string | null
  amount_xof?: number | string | null
}

// ============================================================
// CHOISIR UNE FORMULE PAYANTE
// ============================================================

export async function requestSubscriptionCheckout(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    !canManageSubscription(role)
  ) {
    redirect(
      subscriptionErrorUrl(
        "Vous n'avez pas l'autorisation de modifier l'abonnement."
      )
    )
  }

  const planCode =
    normalizeSubscribablePlanCode(
      formData.get(
        'planCode'
      )
    )

  if (!planCode) {
    redirect(
      subscriptionErrorUrl(
        'La formule demandée est invalide.'
      )
    )
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'request_organization_subscription_checkout',
      {
        target_organization_id:
          organizationId,

        target_plan_code:
          planCode,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - SUBSCRIPTION REQUEST:',
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

    redirect(
      subscriptionErrorUrl(
        friendlyCheckoutError(
          error.message
        )
      )
    )
  }

  const checkout =
    data as
      | CheckoutResult
      | null

  const invoiceId =
    checkout?.invoice_id ??
    null

  revalidatePath(
    '/parametres/abonnement'
  )

  revalidatePath(
    '/admin/subscriptions'
  )

  revalidatePath(
    '/admin/billing'
  )

  revalidatePath(
    `/admin/organizations/${organizationId}`
  )

  const query =
    new URLSearchParams({
      checkout:
        'prepared',
      plan:
        planCode,
    })

  if (invoiceId) {
    query.set(
      'invoice',
      invoiceId
    )
  }

  redirect(
    `/parametres/abonnement?${query.toString()}`
  )
}

// ============================================================
// AUTORISATIONS
// ============================================================

function canManageSubscription(
  role: string
) {
  return [
    'owner',
    'president',
    'treasurer',
  ].includes(role)
}

// ============================================================
// FORMULES AUTORISÉES À CETTE ÉTAPE
// ============================================================

function normalizeSubscribablePlanCode(
  value:
    | FormDataEntryValue
    | string
    | null
    | undefined
): SubscribablePlanCode | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .toLowerCase()

  if (
    subscribablePlanCodes.includes(
      normalized as SubscribablePlanCode
    )
  ) {
    return normalized as SubscribablePlanCode
  }

  return null
}

// ============================================================
// URL D'ERREUR
// ============================================================

function subscriptionErrorUrl(
  message: string
) {
  return (
    '/parametres/abonnement?error=' +
    encodeURIComponent(
      message
    )
  )
}

// ============================================================
// ERREURS MÉTIER LISIBLES
// ============================================================

function friendlyCheckoutError(
  rawMessage:
    | string
    | null
    | undefined
) {
  const message =
    (
      rawMessage ??
      ''
    )
      .trim()
      .toLowerCase()

  if (
    message.includes(
      'same active plan'
    ) ||
    message.includes(
      'already active'
    )
  ) {
    return 'Cette formule est déjà active pour votre organisation.'
  }

  if (
    message.includes(
      'member limit'
    ) ||
    message.includes(
      'members limit'
    )
  ) {
    return "Le nombre de membres actifs de l'organisation n'est pas compatible avec cette formule."
  }

  if (
    message.includes(
      'not authorized'
    )
  ) {
    return "Vous n'avez pas l'autorisation de modifier cet abonnement."
  }

  if (
    message.includes(
      'plan'
    ) &&
    message.includes(
      'not found'
    )
  ) {
    return 'La formule demandée est indisponible.'
  }

  if (
    message.includes(
      'pending'
    ) &&
    message.includes(
      'subscription'
    )
  ) {
    return "Une demande d'abonnement est déjà en attente pour cette organisation."
  }

  return "Impossible de préparer la demande d'abonnement pour le moment."
}
