'use server'

import {
  revalidatePath,
} from 'next/cache'

import {
  redirect,
} from 'next/navigation'

import {
  z,
} from 'zod'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

// ============================================================
// EWUKAI
// MOYENS DE PAIEMENT ET COMPTES DE REVERSEMENT
// ============================================================

const MOBILE_MONEY_PROVIDERS =
  new Set([
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
  ])

// ============================================================
// RPC
// ============================================================

type RpcError = {
  code?: string
  message?: string
}

type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>
  ) => Promise<{
    data: unknown
    error: RpcError | null
  }>
}

// ============================================================
// VALIDATION
// ============================================================

const paymentMethodSchema =
  z.object({

    provider:
      z.enum([
        'wave',
        'orange_money',
        'mtn_momo',
        'moov_money',
        'bank_transfer',
        'cash',
        'other',
      ]),

    label:
      z
        .string()
        .trim()
        .min(
          2,
          'Le nom du moyen de paiement est obligatoire.'
        )
        .max(100),

    accountName:
      z
        .string()
        .trim()
        .max(150)
        .optional(),

    accountNumber:
      z
        .string()
        .trim()
        .max(100)
        .optional(),

    merchantCode:
      z
        .string()
        .trim()
        .max(100)
        .optional(),

    bankName:
      z
        .string()
        .trim()
        .max(150)
        .optional(),

    instructions:
      z
        .string()
        .trim()
        .max(1500)
        .optional(),

    displayOrder:
      z.coerce
        .number()
        .int()
        .min(0)
        .max(100),
  })

// ============================================================
// CREER
// ============================================================

export async function createPaymentMethod(
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
    ].includes(role)
  ) {
    redirect(
      '/dashboard'
    )
  }

  const parsed =
    paymentMethodSchema.safeParse({

      provider:
        formData.get(
          'provider'
        ),

      label:
        formData.get(
          'label'
        ),

      accountName:
        formData.get(
          'accountName'
        ) ||
        undefined,

      accountNumber:
        formData.get(
          'accountNumber'
        ) ||
        undefined,

      merchantCode:
        formData.get(
          'merchantCode'
        ) ||
        undefined,

      bankName:
        formData.get(
          'bankName'
        ) ||
        undefined,

      instructions:
        formData.get(
          'instructions'
        ) ||
        undefined,

      displayOrder:
        formData.get(
          'displayOrder'
        ) ||
        0,
    })

  if (!parsed.success) {
    redirectError(
      parsed.error
        .issues[0]
        ?.message ??
      'Informations invalides.'
    )
  }

  const isActive =
    formData.get(
      'isActive'
    ) === 'on'

  const isVisibleToMembers =
    formData.get(
      'isVisibleToMembers'
    ) === 'on'

  const isPayoutDestination =
    formData.get(
      'isPayoutDestination'
    ) === 'on'

  const isPrimaryPayout =
    formData.get(
      'isPrimaryPayout'
    ) === 'on'

  // ==========================================================
  // VALIDATION DU COMPTE DE REVERSEMENT
  // ==========================================================

  if (
    isPayoutDestination ||
    isPrimaryPayout
  ) {

    if (
      !MOBILE_MONEY_PROVIDERS.has(
        parsed.data.provider
      )
    ) {
      redirectError(
        'Seul un compte Mobile Money peut recevoir les reversements.'
      )
    }

    if (
      !parsed.data.accountName
    ) {
      redirectError(
        'Le nom du titulaire du compte de reversement est obligatoire.'
      )
    }

    if (
      !parsed.data.accountNumber
    ) {
      redirectError(
        'Le numéro Mobile Money du compte de reversement est obligatoire.'
      )
    }

    const digits =
      parsed.data
        .accountNumber
        .replace(
          /\D/g,
          ''
        )

    if (
      digits.length < 8 ||
      digits.length > 15
    ) {
      redirectError(
        'Le numéro Mobile Money semble invalide.'
      )
    }
  }

  if (
    isPrimaryPayout &&
    !isActive
  ) {
    redirectError(
      'Le compte principal de reversement doit être actif.'
    )
  }

  // ==========================================================
  // UTILISATEUR COURANT
  // ==========================================================

  const {
    data:
      claimsData,
  } =
    await supabase.auth
      .getClaims()

  const currentUserId =
    claimsData
      ?.claims
      ?.sub ??
    null

  // ==========================================================
  // CREATION
  // ==========================================================

  const {
    data:
      createdMethod,

    error,
  } =
    await supabase
      .from(
        'organization_payment_methods'
      )
      .insert({

        organization_id:
          organizationId,

        provider:
          parsed.data.provider,

        label:
          parsed.data.label,

        account_name:
          parsed.data.accountName ||
          null,

        account_number:
          parsed.data.accountNumber ||
          null,

        merchant_code:
          parsed.data.merchantCode ||
          null,

        bank_name:
          parsed.data.bankName ||
          null,

        instructions:
          parsed.data.instructions ||
          null,

        is_active:
          isActive,

        is_visible_to_members:
          isVisibleToMembers,

        accepts_remote_payment:
          MOBILE_MONEY_PROVIDERS
            .has(
              parsed.data.provider
            ),

        is_payout_destination:
          (
            isPayoutDestination ||
            isPrimaryPayout
          ),

        // Toujours false ici.
        // Le compte principal est défini ensuite par la RPC
        // afin de garantir un seul principal par mutuelle.
        is_primary_payout:
          false,

        display_order:
          parsed.data.displayOrder,

        created_by:
          currentUserId,

      })
      .select(
        'id'
      )
      .single()

  if (
    error ||
    !createdMethod?.id
  ) {
    console.error(
      'EWUKAI - create payment method:',
      error
    )

    redirectError(
      'Impossible d’ajouter ce moyen de paiement.'
    )
  }

  // ==========================================================
  // DEFINIR COMME COMPTE PRINCIPAL SI DEMANDE
  // ==========================================================

  if (
    isPrimaryPayout
  ) {
    const rpcClient =
      supabase as unknown as
        RpcClient

    const {
      error:
        primaryError,
    } =
      await rpcClient.rpc(
        'set_organization_primary_payout_method',
        {
          target_payment_method_id:
            createdMethod.id,
        }
      )

    if (primaryError) {
      console.error(
        'EWUKAI - set primary payout after create:',
        {
          code:
            primaryError.code,

          message:
            primaryError.message,
        }
      )

      // Nettoyage de sécurité :
      // on retire le moyen créé si sa configuration
      // principale n'a pas pu être finalisée.
      await supabase
        .from(
          'organization_payment_methods'
        )
        .delete()
        .eq(
          'id',
          createdMethod.id
        )
        .eq(
          'organization_id',
          organizationId
        )

      redirectError(
        'Impossible de définir ce compte comme compte principal de reversement.'
      )
    }
  }

  finishSuccess(
    'created'
  )
}

// ============================================================
// DEFINIR LE COMPTE PRINCIPAL DE REVERSEMENT
// ============================================================

export async function setPrimaryPayoutMethod(
  formData: FormData
) {
  const {
    supabase,
    role,
  } =
    await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
    ].includes(role)
  ) {
    redirect(
      '/dashboard'
    )
  }

  const id =
    String(
      formData.get(
        'id'
      ) ||
      ''
    )
      .trim()

  if (!id) {
    redirectError(
      'Compte de reversement introuvable.'
    )
  }

  const rpcClient =
    supabase as unknown as
      RpcClient

  const {
    error,
  } =
    await rpcClient.rpc(
      'set_organization_primary_payout_method',
      {
        target_payment_method_id:
          id,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - set primary payout:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    redirectError(
      payoutErrorMessage(
        error.message
      )
    )
  }

  finishSuccess(
    'primary_payout'
  )
}

// ============================================================
// ACTIVER / DESACTIVER
// ============================================================

export async function togglePaymentMethod(
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
    ].includes(role)
  ) {
    redirect(
      '/dashboard'
    )
  }

  const id =
    String(
      formData.get(
        'id'
      ) ||
      ''
    )
      .trim()

  const nextActive =
    formData.get(
      'nextActive'
    ) === 'true'

  if (!id) {
    redirectError(
      'Moyen de paiement introuvable.'
    )
  }

  const updateData: {
    is_active: boolean
    is_primary_payout?: boolean
  } = {
    is_active:
      nextActive,
  }

  // Un compte désactivé ne doit jamais rester
  // compte principal de reversement.
  if (!nextActive) {
    updateData
      .is_primary_payout =
        false
  }

  const {
    error,
  } =
    await supabase
      .from(
        'organization_payment_methods'
      )
      .update(
        updateData
      )
      .eq(
        'id',
        id
      )
      .eq(
        'organization_id',
        organizationId
      )

  if (error) {
    console.error(
      'EWUKAI - toggle payment method:',
      error
    )

    redirectError(
      'Impossible de modifier ce moyen de paiement.'
    )
  }

  finishSuccess(
    'updated'
  )
}

// ============================================================
// SUPPRIMER
// ============================================================

export async function deletePaymentMethod(
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
    ].includes(role)
  ) {
    redirect(
      '/dashboard'
    )
  }

  const id =
    String(
      formData.get(
        'id'
      ) ||
      ''
    )
      .trim()

  if (!id) {
    redirectError(
      'Moyen de paiement introuvable.'
    )
  }

  const {
    error,
  } =
    await supabase
      .from(
        'organization_payment_methods'
      )
      .delete()
      .eq(
        'id',
        id
      )
      .eq(
        'organization_id',
        organizationId
      )

  if (error) {
    console.error(
      'EWUKAI - delete payment method:',
      error
    )

    redirectError(
      'Impossible de supprimer ce moyen de paiement.'
    )
  }

  finishSuccess(
    'deleted'
  )
}

// ============================================================
// MESSAGES D'ERREUR DE REVERSEMENT
// ============================================================

function payoutErrorMessage(
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
      'must be active'
    )
  ) {
    return 'Le compte de reversement doit être actif.'
  }

  if (
    message.includes(
      'only mobile money'
    )
  ) {
    return 'Seuls Orange Money, MTN MoMo, Moov Money ou Wave peuvent recevoir les reversements.'
  }

  if (
    message.includes(
      'account holder'
    )
  ) {
    return 'Le nom du titulaire du compte est obligatoire.'
  }

  if (
    message.includes(
      'account number'
    )
  ) {
    return 'Le numéro Mobile Money est obligatoire.'
  }

  return 'Impossible de définir ce compte comme compte principal de reversement.'
}

// ============================================================
// REDIRECTIONS
// ============================================================

function redirectError(
  message: string
): never {
  redirect(
    `/parametres/paiements?error=${encodeURIComponent(
      message
    )}`
  )
}

function finishSuccess(
  result: string
): never {
  revalidatePath(
    '/parametres/paiements'
  )

  revalidatePath(
    '/my-space'
  )

  redirect(
    `/parametres/paiements?success=${encodeURIComponent(
      result
    )}`
  )
}


export async function updatePaymentMethodAccount(formData: FormData) {
  const { supabase, organizationId, role } =
    await requireCurrentOrganization()

  if (!['owner', 'president'].includes(role)) {
    redirect('/dashboard')
  }

  const id = String(formData.get('id') || '').trim()
  const accountName = String(formData.get('accountName') || '').trim()
  const accountNumber = String(formData.get('accountNumber') || '').trim()

  if (!id) {
    redirectError('Compte introuvable.')
  }

  if (!accountName) {
    redirectError('Le nom du bénéficiaire est obligatoire.')
  }

  if (!accountNumber) {
    redirectError('Le numéro du compte est obligatoire.')
  }

  const digits = accountNumber.replace(/\D/g, '')

  if (digits.length < 8 || digits.length > 15) {
    redirectError('Le numéro saisi semble invalide.')
  }

  const { error } = await supabase
    .from('organization_payment_methods')
    .update({
      account_name: accountName,
      account_number: accountNumber,
    })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    console.error(
      'EWUKAI - update payment account:',
      error
    )

    redirectError(
      'Impossible de modifier les coordonnées du compte.'
    )
  }

  finishSuccess('account_updated')
}
