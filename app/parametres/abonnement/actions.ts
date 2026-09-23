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
// Etape actuelle :
// - choisir Standard ou Pro ;
// - choisir mensuel ou annuel ;
// - preparer l'abonnement pending_payment ;
// - preparer la facture ;
// - ne contacter aucun prestataire de paiement.
//
// Le branchement CinetPay sera reactive lorsque le compte
// marchand sera totalement operationnel.
// ============================================================

const subscribablePlanCodes = [
  'standard',
  'pro',
] as const

type SubscribablePlanCode =
  (typeof subscribablePlanCodes)[number]

// ============================================================
// CYCLES DE FACTURATION
// ============================================================

const billingCycles = [
  'monthly',
  'yearly',
] as const

type BillingCycle =
  (typeof billingCycles)[number]

// ============================================================
// RESULTAT DU CHECKOUT SUPABASE
// ============================================================

type CheckoutResult = {
  subscription_id?: string | null
  invoice_id?: string | null
  plan_code?: string | null
  billing_cycle?: string | null
  status?: string | null
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

  // ==========================================================
  // AUTORISATION
  // ==========================================================

  if (
    !canManageSubscription(role)
  ) {
    redirect(
      subscriptionErrorUrl(
        "Vous n'avez pas l'autorisation de modifier l'abonnement."
      )
    )
  }

  // ==========================================================
  // FORMULE
  // ==========================================================

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

  // ==========================================================
  // PERIODICITE
  // ==========================================================

  const billingCycle =
    normalizeBillingCycle(
      formData.get(
        'billingCycle'
      )
    )

  if (!billingCycle) {
    redirect(
      subscriptionErrorUrl(
        'La périodicité demandée est invalide.'
      )
    )
  }

  // ==========================================================
  // PREPARATION DE LA SOUSCRIPTION
  //
  // Supabase determine ensuite :
  //
  // Standard mensuel :
  // 5 250 FCFA
  //
  // Standard annuel :
  // 52 500 FCFA
  //
  // Pro mensuel :
  // 10 500 FCFA
  //
  // Pro annuel :
  // 105 000 FCFA
  // ==========================================================

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

        target_billing_cycle:
          billingCycle,
      }
    )

  // ==========================================================
  // ERREUR SUPABASE / METIER
  // ==========================================================

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

        organizationId,

        planCode,

        billingCycle,
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

  // ==========================================================
  // RESULTAT
  // ==========================================================

  const checkout =
    data as
      | CheckoutResult
      | null

  const invoiceId =
    checkout?.invoice_id ??
    null

  // ==========================================================
  // REVALIDATION
  // ==========================================================

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

  // ==========================================================
  // RETOUR PAGE ABONNEMENT
  // ==========================================================

  const query =
    new URLSearchParams({
      checkout:
        'prepared',

      plan:
        planCode,

      cycle:
        billingCycle,
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
// FORMULES AUTORISEES
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
// PERIODICITES AUTORISEES
// ============================================================

function normalizeBillingCycle(
  value:
    | FormDataEntryValue
    | string
    | null
    | undefined
): BillingCycle | null {
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
    billingCycles.includes(
      normalized as BillingCycle
    )
  ) {
    return normalized as BillingCycle
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
// ERREURS METIER LISIBLES
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

  // ==========================================================
  // FORMULE + CYCLE DEJA ACTIFS
  // ==========================================================

  if (
    message.includes(
      'already active'
    ) ||
    message.includes(
      'same active plan'
    )
  ) {
    return 'Cette formule avec cette périodicité est déjà active pour votre organisation.'
  }

  // ==========================================================
  // LIMITE DE MEMBRES
  // ==========================================================

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

  // ==========================================================
  // AUTORISATION
  // ==========================================================

  if (
    message.includes(
      'not authorized'
    ) ||
    message.includes(
      'permission required'
    )
  ) {
    return "Vous n'avez pas l'autorisation de modifier cet abonnement."
  }

  // ==========================================================
  // FORMULE INEXISTANTE
  // ==========================================================

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

  // ==========================================================
  // FORMULE NON ACHETABLE EN LIGNE
  // ==========================================================

  if (
    message.includes(
      'only standard and pro'
    )
  ) {
    return 'Seules les formules Standard et Pro peuvent être souscrites directement en ligne.'
  }

  // ==========================================================
  // CYCLE INVALIDE
  // ==========================================================

  if (
    message.includes(
      'billing cycle'
    )
  ) {
    return 'La périodicité choisie doit être mensuelle ou annuelle.'
  }

  // ==========================================================
  // PRIX INVALIDE
  // ==========================================================

  if (
    message.includes(
      'price is invalid'
    )
  ) {
    return 'Le tarif de cette formule est temporairement indisponible.'
  }

  // ==========================================================
  // DEMANDE DEJA EN ATTENTE
  // ==========================================================

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

  // ==========================================================
  // ORGANISATION
  // ==========================================================

  if (
    message.includes(
      'organization not found'
    )
  ) {
    return "L'organisation associée à cet abonnement est introuvable."
  }

  // ==========================================================
  // ERREUR GENERIQUE
  // ==========================================================

  return "Impossible de préparer la demande d'abonnement pour le moment."
}