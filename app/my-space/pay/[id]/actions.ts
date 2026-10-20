'use server'

import {
  redirect,
} from 'next/navigation'

import {
  CinetPayAuroreApiError,
  hashCinetPayNotifyToken,
  initializeCinetPayAurorePayment,
} from '@/lib/payments/cinetpay-aurore'

import {
  getOrganizationCinetPayAuroreConfig,
} from '@/lib/payments/organization-cinetpay'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

import {
  createClient,
} from '@/lib/supabase/server'

// ============================================================
// EWUKAI
// PAIEMENT MEMBRE VIA CINETPAY AURORE
//
// PRINCIPES :
// - aucun montant venant du navigateur
// - le RPC calcule le montant restant
// - l'initialisation CinetPay se fait côté serveur
// - le notify_token brut n'est jamais stocké
// - seul son SHA-256 est conservé
// - le retour navigateur ne confirme jamais le paiement
// ============================================================

const REMOTE_PAYMENT_METHODS =
  new Set([
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
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

type MemberData = {
  id: string

  first_name?:
    | string
    | null

  last_name?:
    | string
    | null

  full_name?:
    | string
    | null
}

type FinancialSpace = {
  member?:
    | MemberData
    | null
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
  // VALIDATION DE BASE
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
  // AUTHENTIFICATION MEMBRE
  // ==========================================================

  const {
    data:
      authData,

    error:
      authError,
  } =
    await supabase.auth
      .getClaims()

  const userId =
    authData
      ?.claims
      ?.sub

  if (
    authError ||
    !userId
  ) {
    redirect(
      '/login/membre'
    )
  }

  // ==========================================================
  // UTILISATEUR SUPABASE
  //
  // L'adresse email CinetPay est récupérée côté serveur.
  // Elle ne vient jamais du formulaire navigateur.
  // ==========================================================

  const {
    data:
      userData,

    error:
      userError,
  } =
    await supabase.auth
      .getUser()

  const authUser =
    userData?.user

  if (
    userError ||
    !authUser ||
    authUser.id !==
      userId
  ) {
    redirectError(
      obligationId,
      'Impossible de vérifier votre compte utilisateur.'
    )
  }

  const clientEmail =
    authUser.email
      ?.trim() ||
    ''

  if (
    !clientEmail
  ) {
    redirectError(
      obligationId,
      'Votre compte doit disposer d’une adresse e-mail valide pour effectuer ce paiement.'
    )
  }

  // ==========================================================
  // ESPACES MEMBRE
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

  const selectedSpace =
    memberSpaces.find(
      (
        space
      ) =>
        space.organization_id ===
        organizationId
    )

  if (
    !selectedSpace
  ) {
    redirectError(
      obligationId,
      'Vous n’êtes pas autorisé à effectuer ce paiement.'
    )
  }

  // ==========================================================
  // DONNEES DU MEMBRE
  //
  // On récupère nom/prénom depuis la base,
  // jamais depuis le navigateur.
  // ==========================================================

  const {
    data:
      financialRaw,

    error:
      financialError,
  } =
    await supabase.rpc(
      'get_my_member_financial_space',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (
    financialError ||
    !financialRaw ||
    typeof financialRaw !==
      'object'
  ) {
    if (
      financialError
    ) {
      console.error(
        'EWUKAI - PREPARE MEMBER FINANCIAL SPACE:',
        {
          code:
            financialError.code,

          message:
            financialError.message,
        }
      )
    }

    redirectError(
      obligationId,
      'Impossible de charger les informations du membre.'
    )
  }

  const financialSpace =
    financialRaw as
      FinancialSpace

  const member =
    financialSpace.member

  if (
    !member ||
    !member.id ||
    member.id !==
      selectedSpace.member_id
  ) {
    redirectError(
      obligationId,
      'Le dossier membre est invalide.'
    )
  }

  const {
    firstName,
    lastName,
  } =
    getMemberNames(
      member
    )

  if (
    !firstName ||
    !lastName
  ) {
    redirectError(
      obligationId,
      'Le prénom et le nom du membre doivent être renseignés avant le paiement.'
    )
  }

  // ==========================================================
  // MOYEN DE PAIEMENT ACTIVE
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
      (
        method
      ) =>
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
  // Le montant est calculé par PostgreSQL.
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

    redirectError(
      obligationId,
      humanizePaymentError(
        attemptError.message
      )
    )
  }

  const attempt =
    attemptRaw as
      | PaymentAttemptResult
      | null

  if (
    !attempt ||
    !attempt.attempt_id ||
    !attempt.provider_transaction_ref
  ) {
    redirectError(
      obligationId,
      'La tentative de paiement n’a pas pu être créée.'
    )
  }

  // ==========================================================
  // VERIFICATIONS DE LA TENTATIVE
  // ==========================================================

  if (
    attempt.organization_id !==
      organizationId ||
    attempt.member_id !==
      selectedSpace.member_id ||
    attempt.obligation_id !==
      obligationId
  ) {
    redirectError(
      obligationId,
      'La tentative de paiement est incohérente.'
    )
  }

  const amountXof =
    Number(
      attempt.amount_xof
    )

  if (
    !Number.isSafeInteger(
      amountXof
    ) ||
    amountXof <=
      0
  ) {
    redirectError(
      obligationId,
      'Le montant du paiement est invalide.'
    )
  }

  if (
    String(
      attempt.currency
    )
      .trim()
      .toUpperCase() !==
    'XOF'
  ) {
    redirectError(
      obligationId,
      'La devise du paiement est invalide.'
    )
  }

  const merchantTransactionId =
    attempt
      .provider_transaction_ref
      .trim()

  if (
    !merchantTransactionId ||
    merchantTransactionId.length >
      30
  ) {
    redirectError(
      obligationId,
      'La référence du paiement est invalide.'
    )
  }

  // ==========================================================
  // COMPTE CINETPAY DE LA MUTUELLE
  // ==========================================================

  let credentials:
    Awaited<
      ReturnType<
        typeof getOrganizationCinetPayAuroreConfig
      >
    >

  try {
    credentials =
      await getOrganizationCinetPayAuroreConfig(
        organizationId
      )
  } catch (error) {
    console.error(
      'EWUKAI - MEMBER CINETPAY AURORE CONFIG:',
      safeError(
        error
      )
    )

    redirectError(
      obligationId,
      'CinetPay n’est pas correctement configuré pour cette organisation.'
    )
  }

  // ==========================================================
  // SECURITE DE MIGRATION
  //
  // Tant que les tests ne sont pas terminés,
  // aucun paiement Production ne peut être initié.
  // ==========================================================

  if (
    credentials.environment !==
    'sandbox'
  ) {
    redirectError(
      obligationId,
      'Les paiements CinetPay Production ne sont pas encore activés.'
    )
  }

  // ==========================================================
  // URL PUBLIQUE EWUKAI
  //
  // CinetPay doit pouvoir atteindre ces URLs depuis Internet.
  // localhost est donc interdit.
  // ==========================================================

  let publicBaseUrl:
    string

  try {
    publicBaseUrl =
      getPublicBaseUrl()
  } catch (error) {
    console.error(
      'EWUKAI - CINETPAY PUBLIC URL:',
      safeError(
        error
      )
    )

    redirectError(
      obligationId,
      'L’adresse publique EWUKAI destinée à CinetPay n’est pas configurée.'
    )
  }

  // ==========================================================
  // URL DE RETOUR
  //
  // success_url et failed_url utilisent volontairement
  // la même route.
  //
  // Le navigateur ne décide jamais si le paiement est réussi.
  // ==========================================================

  const returnUrl =
    `${publicBaseUrl}` +
    `/api/payments/cinetpay/member-return` +
    `?transaction_id=${encodeURIComponent(
      merchantTransactionId
    )}`

  const notifyUrl =
    `${publicBaseUrl}` +
    '/api/payments/cinetpay/member-notify'

  // ==========================================================
  // INITIALISATION AURORE
  // ==========================================================

  let initialization:
    Awaited<
      ReturnType<
        typeof initializeCinetPayAurorePayment
      >
    >

  try {
    initialization =
      await initializeCinetPayAurorePayment(
        {
          merchantTransactionId,

          amountXof,

          designation:
            'Paiement cotisation EWUKAI',

          clientFirstName:
            firstName,

          clientLastName:
            lastName,

          clientEmail,

          clientPhoneNumber:
            authUser.phone
              ?.trim() ||
            null,

          successUrl:
            returnUrl,

          failedUrl:
            returnUrl,

          notifyUrl,
        },

        credentials
      )
  } catch (error) {
    console.error(
      'EWUKAI - CINETPAY AURORE INITIALIZATION:',
      safeError(
        error
      )
    )

    if (
      error instanceof
        CinetPayAuroreApiError &&
      error.code ===
        '2011'
    ) {
      redirectError(
        obligationId,
        'L’adresse IP du serveur EWUKAI n’est pas autorisée par CinetPay.'
      )
    }

    redirectError(
      obligationId,
      'CinetPay n’a pas pu initialiser le paiement.'
    )
  }

  // ==========================================================
  // ENREGISTRER LA REPONSE D'INITIALISATION
  //
  // IMPORTANT :
  // notify_token brut NON stocké.
  // ==========================================================

  const notifyTokenHash =
    hashCinetPayNotifyToken(
      initialization.notifyToken
    )

  const now =
    new Date()
      .toISOString()

  const admin =
    createAdminClient()

  const {
    error:
      updateError,
  } =
    await admin
      .from(
        'member_payment_attempts'
      )
      .update({
        status:
          'checkout_ready',

        provider_status:
          'INITIATED',

        provider_transaction_id:
          initialization
            .transactionId,

        provider_payment_token:
          initialization
            .paymentToken,

        provider_payment_url:
          initialization
            .paymentUrl,

        provider_notify_token_hash:
          notifyTokenHash,

        updated_at:
          now,
      })
      .eq(
        'id',
        attempt.attempt_id
      )
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'provider',
        'cinetpay'
      )
      .eq(
        'provider_transaction_ref',
        merchantTransactionId
      )

  if (
    updateError
  ) {
    console.error(
      'EWUKAI - CINETPAY AURORE ATTEMPT UPDATE:',
      {
        code:
          updateError.code,

        message:
          updateError.message,
      }
    )

    redirectError(
      obligationId,
      'Le paiement a été préparé mais EWUKAI n’a pas pu sécuriser la tentative. Veuillez recommencer plus tard.'
    )
  }

  // ==========================================================
  // REDIRECTION VERS LE GUICHET SECURISE CINETPAY
  // ==========================================================

  redirect(
    initialization
      .paymentUrl
  )
}

// ============================================================
// NOM DU MEMBRE
// ============================================================

function getMemberNames(
  member: MemberData
) {
  let firstName =
    member.first_name
      ?.trim() ||
    ''

  let lastName =
    member.last_name
      ?.trim() ||
    ''

  const fullName =
    member.full_name
      ?.trim() ||
    ''

  if (
    (!firstName ||
      !lastName) &&
    fullName
  ) {
    const parts =
      fullName
        .split(/\s+/)
        .filter(Boolean)

    if (
      !firstName &&
      parts.length >
        0
    ) {
      firstName =
        parts[0]
    }

    if (
      !lastName &&
      parts.length >
        1
    ) {
      lastName =
        parts
          .slice(1)
          .join(' ')
    }
  }

  return {
    firstName,
    lastName,
  }
}

// ============================================================
// URL PUBLIQUE
// ============================================================

function getPublicBaseUrl() {
  const raw =
    process.env
      .CINETPAY_PUBLIC_URL ??
    process.env
      .NEXT_PUBLIC_SITE_URL ??
    ''

  if (
    !raw.trim()
  ) {
    throw new Error(
      'Public EWUKAI URL is missing.'
    )
  }

  const url =
    new URL(
      raw
    )

  if (
    url.protocol !==
      'https:'
  ) {
    throw new Error(
      'Public EWUKAI URL must use HTTPS.'
    )
  }

  const hostname =
    url.hostname
      .trim()
      .toLowerCase()

  if (
    hostname ===
      'localhost' ||
    hostname ===
      '127.0.0.1' ||
    hostname ===
      '::1' ||
    hostname.endsWith(
      '.local'
    )
  ) {
    throw new Error(
      'Public EWUKAI URL cannot be localhost.'
    )
  }

  return url.origin
}

// ============================================================
// FORM DATA
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

// ============================================================
// ERREUR UTILISATEUR
// ============================================================

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

// ============================================================
// HUMANISER ERREUR RPC
// ============================================================

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

// ============================================================
// SAFE ERROR
//
// Aucun secret, access_token ou notify_token ne doit
// apparaître dans les logs.
// ============================================================

function safeError(
  error:
    unknown
) {
  if (
    error instanceof
      CinetPayAuroreApiError
  ) {
    return {
      name:
        error.name,

      code:
        error.code,

      message:
        error.message,
    }
  }

  if (
    error instanceof
      Error
  ) {
    return {
      name:
        error.name,

      message:
        error.message,
    }
  }

  return {
    message:
      'Unknown error',
  }
}