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

import {
  getCinetPayPublicBaseUrl,
  initializeCinetPayPayment,
} from '@/lib/payments/cinetpay'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

const onlinePlanCodes = [
  'standard',
  'pro',
] as const

type OnlinePlanCode =
  (typeof onlinePlanCodes)[number]

type CheckoutResult = {
  subscription_id?: string | null
  invoice_id?: string | null
  plan_code?: string | null
  amount_xof?: number | string | null
}

type PreparedPayment = {
  attempt_id?: string | null
  organization_id?: string | null
  subscription_id?: string | null
  invoice_id?: string | null
  plan_code?: string | null
  plan_name?: string | null
  amount_xof?: number | string | null
  currency?: string | null
  provider?: string | null
  provider_transaction_ref?: string | null
  provider_payment_token?: string | null
  provider_payment_url?: string | null
  attempt_status?: string | null
}

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
    normalizeOnlinePlanCode(
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
      'EWUKAI - SUBSCRIPTION CHECKOUT:',
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
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

  const query =
    new URLSearchParams({
      checkout: 'prepared',
      plan: planCode,
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

export async function startCinetPayPayment(
  formData: FormData
) {
  const {
    supabase,
    role,
  } =
    await requireCurrentOrganization()

  if (
    !canManageSubscription(role)
  ) {
    redirect(
      subscriptionErrorUrl(
        "Vous n'avez pas l'autorisation d'effectuer ce paiement."
      )
    )
  }

  const invoiceId =
    getUuidLikeValue(
      formData.get(
        'invoiceId'
      )
    )

  if (!invoiceId) {
    redirect(
      subscriptionErrorUrl(
        'La facture à régler est invalide.'
      )
    )
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'prepare_organization_subscription_payment',
      {
        target_invoice_id:
          invoiceId,

        target_provider:
          'cinetpay',
      }
    )

  if (
    error ||
    !data
  ) {
    console.error(
      'EWUKAI - PREPARE CINETPAY PAYMENT:',
      error
    )

    redirect(
      subscriptionErrorUrl(
        friendlyPaymentError(
          error?.message
        )
      )
    )
  }

  const prepared =
    data as PreparedPayment

  const attemptId =
    prepared.attempt_id

  const transactionId =
    prepared.provider_transaction_ref

  const amountXof =
    Number(
      prepared.amount_xof
    )

  const currency =
    (
      prepared.currency ??
      ''
    )
      .trim()
      .toUpperCase()

  const planCode =
    normalizeOnlinePlanCode(
      prepared.plan_code ??
      null
    )

  if (
    !attemptId ||
    !transactionId ||
    !Number.isSafeInteger(
      amountXof
    ) ||
    amountXof <= 0 ||
    currency !== 'XOF' ||
    !planCode
  ) {
    redirect(
      subscriptionErrorUrl(
        'Les informations de paiement préparées sont invalides.'
      )
    )
  }

  const existingPaymentUrl =
    prepared.provider_payment_url
      ?.trim()

  if (
    existingPaymentUrl
  ) {
    redirect(
      existingPaymentUrl
    )
  }

  let publicBaseUrl:
    string

  try {
    publicBaseUrl =
      getCinetPayPublicBaseUrl()
  } catch (
    configurationError
  ) {
    console.error(
      'EWUKAI - CINETPAY PUBLIC URL:',
      configurationError
    )

    redirect(
      subscriptionErrorUrl(
        'Le paiement en ligne n’est pas encore configuré sur une adresse publique.'
      )
    )
  }

  const notifyUrl =
    `${publicBaseUrl}/api/payments/cinetpay/notify`

  const returnUrl =
    `${publicBaseUrl}/api/payments/cinetpay/return`

  const admin =
    createAdminClient()

  let paymentUrl:
    string

  try {
    const result =
      await initializeCinetPayPayment({
        transactionId,

        amountXof,

        description:
          `Abonnement EWUKAI ${planCode} 30 jours`,

        notifyUrl,

        returnUrl,

        metadata:
          attemptId,

        invoiceData: {
          Formule:
            planCode ===
            'standard'
              ? 'Standard'
              : 'Pro',

          Montant:
            `${amountXof} FCFA`,

          Produit:
            'EWUKAI',
        },
      })

    const {
      error:
        updateAttemptError,
    } =
      await admin
        .from(
          'subscription_payment_attempts'
        )
        .update({
          provider_payment_token:
            result.paymentToken,

          provider_payment_url:
            result.paymentUrl,

          status:
            'checkout_ready',

          provider_status:
            'CREATED',

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          attemptId
        )
        .eq(
          'invoice_id',
          invoiceId
        )
        .eq(
          'provider',
          'cinetpay'
        )

    if (
      updateAttemptError
    ) {
      console.error(
        'EWUKAI - SAVE CINETPAY CHECKOUT:',
        updateAttemptError
      )

      throw new Error(
        'Unable to save CinetPay checkout.'
      )
    }

    paymentUrl =
      result.paymentUrl
  } catch (
    paymentError
  ) {
    console.error(
      'EWUKAI - CINETPAY INITIALIZATION:',
      paymentError
    )

    await admin
      .from(
        'subscription_payment_attempts'
      )
      .update({
        status:
          'failed',

        provider_status:
          'INITIALIZATION_FAILED',

        failed_at:
          new Date()
            .toISOString(),

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        attemptId
      )
      .eq(
        'provider',
        'cinetpay'
      )

    redirect(
      subscriptionErrorUrl(
        'Le guichet de paiement CinetPay n’a pas pu être ouvert. Veuillez réessayer.'
      )
    )
  }

  // redirect() doit rester hors du try/catch.
  redirect(
    paymentUrl
  )
}

function canManageSubscription(
  role: string
) {
  return [
    'owner',
    'president',
    'treasurer',
  ].includes(role)
}

function normalizeOnlinePlanCode(
  value:
    | FormDataEntryValue
    | string
    | null
    | undefined
): OnlinePlanCode | null {
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
    onlinePlanCodes.includes(
      normalized as OnlinePlanCode
    )
  ) {
    return normalized as OnlinePlanCode
  }

  return null
}

function getUuidLikeValue(
  value:
    | FormDataEntryValue
    | null
) {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

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

  return "Impossible de préparer le paiement de l'abonnement pour le moment."
}

function friendlyPaymentError(
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
      'not authorized'
    )
  ) {
    return "Vous n'avez pas l'autorisation d'effectuer ce paiement."
  }

  if (
    message.includes(
      'invoice is not open'
    )
  ) {
    return 'Cette facture ne peut plus être réglée.'
  }

  if (
    message.includes(
      'subscription is not awaiting payment'
    )
  ) {
    return 'Cet abonnement n’est plus en attente de paiement.'
  }

  if (
    message.includes(
      'invoice already contains a payment'
    )
  ) {
    return 'Cette facture possède déjà un règlement enregistré.'
  }

  return 'Impossible de préparer le paiement pour le moment.'
}
