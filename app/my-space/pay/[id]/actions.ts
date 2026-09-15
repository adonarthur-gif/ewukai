'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

// ============================================================
// EWUKAI
// PREPARATION PAIEMENT MEMBRE
// ============================================================

const REMOTE_PAYMENT_METHODS =
  new Set([
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
    'bank_transfer',
  ])

// ============================================================
// TYPES
// ============================================================

type MemberSpaceOption = {
  member_id: string
  organization_id: string
}

type PaymentMethod = {
  id: string
  provider: string

  accepts_remote_payment:
    | boolean
    | null
}

type PaymentAttemptResult = {
  attempt_id: string
  organization_id: string
  member_id: string
  obligation_id: string
  amount_xof:
    | number
    | string
  currency: string
  payment_method: string
  provider: string
  provider_transaction_ref: string
  attempt_status: string
}

type RpcError = {
  code?: string
  message?: string
}

type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<
      string,
      unknown
    >
  ) => Promise<{
    data: unknown
    error:
      | RpcError
      | null
  }>
}

// ============================================================
// ACTION
// ============================================================

export async function prepareMemberPayment(
  formData: FormData
) {
  const obligationId =
    getText(
      formData,
      'obligationId'
    )

  const organizationId =
    getText(
      formData,
      'organizationId'
    )

  const paymentMethod =
    getText(
      formData,
      'paymentMethod'
    )

  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (
    !obligationId ||
    !organizationId
  ) {
    redirect(
      `/my-space?error=${encodeURIComponent(
        'Paiement invalide.'
      )}`
    )
  }

  if (
    !paymentMethod ||
    !REMOTE_PAYMENT_METHODS.has(
      paymentMethod
    )
  ) {
    redirectError(
      obligationId,
      'Ce moyen de paiement n’est pas disponible.'
    )
  }

  const supabase =
    await createClient()

  const rpcClient =
    supabase as unknown as
      RpcClient

  // ==========================================================
  // AUTHENTIFICATION
  // ==========================================================

  const {
    data: authData,
    error: authError,
  } =
    await supabase.auth
      .getClaims()

  const userId =
    authData?.claims?.sub

  if (
    authError ||
    !userId
  ) {
    redirect('/login/membre')
  }

  // ==========================================================
  // VERIFIER QUE L'ORGANISATION APPARTIENT BIEN
  // AUX ESPACES MEMBRE DU COMPTE CONNECTE
  // ==========================================================

  const {
    data:
      memberSpacesRaw,

    error:
      memberSpacesError,
  } =
    await supabase.rpc(
      'list_my_member_spaces'
    )

  if (
    memberSpacesError
  ) {
    console.error(
      'EWUKAI - PREPARE MEMBER PAYMENT SPACES:',
      {
        code:
          memberSpacesError.code,

        message:
          memberSpacesError.message,
      }
    )

    redirectError(
      obligationId,
      'Impossible de vérifier votre espace membre.'
    )
  }

  const memberSpaces =
    Array.isArray(
      memberSpacesRaw
    )
      ? (
          memberSpacesRaw as
            MemberSpaceOption[]
        )
      : []

  const belongsToOrganization =
    memberSpaces.some(
      (space) =>
        space.organization_id ===
        organizationId
    )

  if (
    !belongsToOrganization
  ) {
    redirectError(
      obligationId,
      'Vous n’êtes pas autorisé à effectuer ce paiement.'
    )
  }

  // ==========================================================
  // VERIFIER LE MOYEN DE PAIEMENT DE L'ORGANISATION
  // ==========================================================

  const {
    data:
      paymentMethodsRaw,

    error:
      paymentMethodsError,
  } =
    await supabase.rpc(
      'get_visible_payment_methods',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (
    paymentMethodsError
  ) {
    console.error(
      'EWUKAI - PREPARE MEMBER PAYMENT METHODS:',
      {
        code:
          paymentMethodsError.code,

        message:
          paymentMethodsError.message,
      }
    )

    redirectError(
      obligationId,
      'Impossible de vérifier le moyen de paiement.'
    )
  }

  const paymentMethods =
    Array.isArray(
      paymentMethodsRaw
    )
      ? (
          paymentMethodsRaw as
            PaymentMethod[]
        )
      : []

  const selectedMethod =
    paymentMethods.find(
      (method) =>
        method.provider ===
          paymentMethod &&
        method
          .accepts_remote_payment ===
          true
    )

  if (
    !selectedMethod
  ) {
    redirectError(
      obligationId,
      'Ce moyen de paiement n’est pas activé pour votre organisation.'
    )
  }

  // ==========================================================
  // CREER / REUTILISER LA TENTATIVE
  //
  // IMPORTANT :
  // - aucun montant venant du navigateur
  // - le RPC recalcule lui-même le reste
  // - aucune confirmation de paiement ici
  // ==========================================================

  const {
    data:
      attemptRaw,

    error:
      attemptError,
  } =
    await rpcClient.rpc(
      'prepare_member_obligation_payment',
      {
        target_obligation_id:
          obligationId,

        selected_payment_method:
          paymentMethod,

        target_provider:
          'cinetpay',
      }
    )

  if (
    attemptError
  ) {
    console.error(
      'EWUKAI - PREPARE MEMBER PAYMENT:',
      {
        code:
          attemptError.code,

        message:
          attemptError.message,
      }
    )

    const message =
      humanizePaymentError(
        attemptError.message
      )

    redirectError(
      obligationId,
      message
    )
  }

  const attempt =
    attemptRaw as
      | PaymentAttemptResult
      | null

  if (
    !attempt ||
    !attempt.attempt_id
  ) {
    redirectError(
      obligationId,
      'La tentative de paiement n’a pas pu être créée.'
    )
  }

  // ==========================================================
  // IMPORTANT
  //
  // Pour l'instant :
  // la tentative existe,
  // mais on ne redirige PAS encore vers CinetPay.
  //
  // L'étape suivante branchera le compte marchand
  // de l'organisation au prestataire.
  // ==========================================================

  redirect(
    `/my-space/pay/${encodeURIComponent(
      obligationId
    )}?prepared=1`
  )
}

// ============================================================
// HELPERS
// ============================================================

function getText(
  formData: FormData,
  key: string
) {
  const value =
    formData.get(
      key
    )

  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value.trim()
}

function redirectError(
  obligationId: string,
  message: string
): never {
  redirect(
    `/my-space/pay/${encodeURIComponent(
      obligationId
    )}?error=${encodeURIComponent(
      message
    )}`
  )
}

function humanizePaymentError(
  value:
    | string
    | undefined
) {
  const message =
    (
      value ??
      ''
    )
      .toLowerCase()

  if (
    message.includes(
      'already fully paid'
    )
  ) {
    return 'Cette cotisation est déjà entièrement payée.'
  }

  if (
    message.includes(
      'not authorized'
    )
  ) {
    return 'Vous n’êtes pas autorisé à payer cette cotisation.'
  }

  if (
    message.includes(
      'member is not active'
    )
  ) {
    return 'Votre dossier membre n’est pas actif.'
  }

  if (
    message.includes(
      'obligation cannot be paid'
    )
  ) {
    return 'Cette cotisation ne peut plus être réglée.'
  }

  if (
    message.includes(
      'cash payment'
    )
  ) {
    return 'Les paiements en espèces doivent être enregistrés par le responsable.'
  }

  if (
    message.includes(
      'obligation not found'
    )
  ) {
    return 'Cette cotisation est introuvable.'
  }

  return 'Impossible de préparer le paiement pour le moment.'
}