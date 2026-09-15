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
// ENCAISSEMENT DES COTISATIONS
//
// Deux circuits :
//
// 1. Cotisation régulière
//    -> plan annuel / arriérés
//    -> record_multi_period_payment
//
// 2. Cotisation exceptionnelle
//    -> une obligation précise
//    -> record_obligation_payment
//
// ============================================================


// ============================================================
// VALIDATION DU FORMULAIRE
// ============================================================

const paymentSchema =
  z.object({
    obligationId:
      z
        .string()
        .uuid(
          'Échéance invalide.'
        ),

    year:
      z.coerce
        .number()
        .int()
        .min(2000)
        .max(2100),

    amount:
      z.coerce
        .number()
        .int(
          'Le montant doit être un nombre entier.'
        )
        .positive(
          'Le montant doit être supérieur à zéro.'
        ),

    paymentMethod:
      z.enum([
        'cash',
        'wave',
        'orange_money',
        'mtn_momo',
        'moov_money',
        'bank_transfer',
        'other',
      ]),

    paymentReference:
      z
        .string()
        .trim()
        .optional(),

    notes:
      z
        .string()
        .trim()
        .optional(),
  })


// ============================================================
// ENREGISTRER UN PAIEMENT
// ============================================================

export async function recordPayment(
  formData: FormData
) {
  // ==========================================================
  // 1. VALIDATION
  // ==========================================================

  const parsed =
    paymentSchema.safeParse({
      obligationId:
        formData.get(
          'obligationId'
        ),

      year:
        formData.get(
          'year'
        ),

      amount:
        formData.get(
          'amount'
        ),

      paymentMethod:
        formData.get(
          'paymentMethod'
        ),

      paymentReference:
        formData.get(
          'paymentReference'
        ),

      notes:
        formData.get(
          'notes'
        ),
    })

  if (
    !parsed.success
  ) {
    const message =
      parsed.error
        .issues[0]
        ?.message ??
      'Informations invalides.'

    const obligationId =
      String(
        formData.get(
          'obligationId'
        ) ??
          ''
      )

    const year =
      String(
        formData.get(
          'year'
        ) ??
          ''
      )

    redirect(
      `/contributions/collection/${obligationId}?year=${year}&error=${encodeURIComponent(
        message
      )}`
    )
  }

  const data =
    parsed.data

  // ==========================================================
  // 2. MUTUELLE ACTIVE
  // ==========================================================

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ==========================================================
  // 3. AUTORISATIONS
  // ==========================================================

  if (
    ![
      'owner',
      'president',
      'treasurer',
    ].includes(
      role
    )
  ) {
    redirect(
      '/contributions/collection?error=Vous ne disposez pas des droits nécessaires.'
    )
  }

  // ==========================================================
  // 4. CHARGER L'ECHEANCE
  //
  // On ne fait jamais confiance au navigateur pour déterminer
  // la nature de la cotisation.
  //
  // contribution_type_id :
  //   cotisation régulière
  //
  // contribution_call_id :
  //   cotisation exceptionnelle
  // ==========================================================

  const {
    data: obligation,
    error:
      obligationError,
  } = await supabase
    .from(
      'contribution_obligations'
    )
    .select(`
      id,
      organization_id,
      member_id,
      contribution_type_id,
      contribution_call_id,
      period_start,
      due_date,
      amount_due,
      status
    `)
    .eq(
      'id',
      data.obligationId
    )
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (
    obligationError ||
    !obligation
  ) {
    console.error(
      'EWUKAI - payment obligation:',
      obligationError
    )

    redirect(
      `/contributions/collection?error=${encodeURIComponent(
        'Échéance introuvable ou inaccessible.'
      )}`
    )
  }

  // ==========================================================
  // 5. VERIFIER QUE L'ECHEANCE EST ENCAISSABLE
  // ==========================================================

  if (
    obligation.status ===
      'cancelled' ||
    obligation.status ===
      'waived'
  ) {
    redirect(
      `/contributions/collection/${data.obligationId}?year=${data.year}&error=${encodeURIComponent(
        'Cette échéance ne peut plus être encaissée.'
      )}`
    )
  }

  // ==========================================================
  // 6. IDENTIFIER LA NATURE
  // ==========================================================

  const isExceptional =
    Boolean(
      obligation
        .contribution_call_id
    )

  // ==========================================================
  // 7. RESULTAT COMMUN
  // ==========================================================

  let paymentResult:
    | Array<{
        new_payment_id:
          string

        new_receipt_number?:
          string

        allocated_amount?:
          number

        remaining_amount?:
          number

        remaining_year_amount?:
          number
      }>
    | null =
    null

  let paymentError:
    | {
        message?:
          string
      }
    | null =
    null

  // ==========================================================
  // 8A. COTISATION EXCEPTIONNELLE
  //
  // IMPORTANT :
  //
  // - aucune préparation annuelle
  // - aucun paiement sur d'autres périodes
  // - l'argent reste attaché à cette obligation
  // ==========================================================

  if (
    isExceptional
  ) {
    const {
      data: result,
      error,
    } =
      await supabase.rpc(
        'record_obligation_payment',
        {
          target_obligation_id:
            obligation.id,

          payment_amount:
            data.amount,

          selected_payment_method:
            data.paymentMethod,

          payment_reference:
            data
              .paymentReference ||
            null,

          payment_notes:
            data.notes ||
            null,
        }
      )

    paymentResult =
      result

    paymentError =
      error
  }

  // ==========================================================
  // 8B. COTISATION REGULIERE
  // ==========================================================

  else {
    // --------------------------------------------------------
    // Une obligation régulière doit avoir un type.
    // --------------------------------------------------------

    if (
      !obligation
        .contribution_type_id
    ) {
      redirect(
        `/contributions/collection/${data.obligationId}?year=${data.year}&error=${encodeURIComponent(
          'Type de cotisation introuvable.'
        )}`
      )
    }

    // --------------------------------------------------------
    // PREPARER LE PLAN
    //
    // Utile si la page est appelée directement sans être
    // passée auparavant par openPayment().
    // --------------------------------------------------------

    const {
      error:
        prepareError,
    } =
      await supabase.rpc(
        'prepare_member_contribution_plan',
        {
          target_member_id:
            obligation.member_id,

          target_contribution_type_id:
            obligation
              .contribution_type_id,

          target_year:
            data.year,
        }
      )

    if (
      prepareError
    ) {
      console.error(
        'EWUKAI - prepare regular payment plan:',
        prepareError
      )

      redirect(
        `/contributions/collection/${data.obligationId}?year=${data.year}&error=${encodeURIComponent(
          'Impossible de préparer le plan de cotisation.'
        )}`
      )
    }

    // --------------------------------------------------------
    // PAIEMENT MULTI-PERIODES
    // --------------------------------------------------------

    const {
      data: result,
      error,
    } =
      await supabase.rpc(
        'record_multi_period_payment',
        {
          target_member_id:
            obligation.member_id,

          target_contribution_type_id:
            obligation
              .contribution_type_id,

          target_year:
            data.year,

          payment_amount:
            data.amount,

          selected_payment_method:
            data.paymentMethod,

          payment_reference:
            data
              .paymentReference ||
            null,

          payment_notes:
            data.notes ||
            null,
        }
      )

    paymentResult =
      result

    paymentError =
      error
  }

  // ==========================================================
  // 9. GESTION DES ERREURS
  // ==========================================================

  if (
    paymentError ||
    !paymentResult ||
    paymentResult.length ===
      0
  ) {
    console.error(
      'EWUKAI - record payment:',
      paymentError
    )

    let message =
      'Impossible d’enregistrer le paiement.'

    const databaseMessage =
      paymentError
        ?.message ??
      ''

    // --------------------------------------------------------
    // MONTANT TROP ELEVE
    // --------------------------------------------------------

    if (
      databaseMessage.includes(
        'exceeds remaining'
      ) ||
      databaseMessage.includes(
        'exceeds remaining balance'
      ) ||
      databaseMessage.includes(
        'Unable to allocate full payment'
      )
    ) {
      message =
        'Le montant saisi dépasse le reste dû.'
    }

    // --------------------------------------------------------
    // DEJA SOLDE
    // --------------------------------------------------------

    if (
      databaseMessage.includes(
        'already fully paid'
      ) ||
      databaseMessage.includes(
        'already paid'
      )
    ) {
      message =
        'Cette cotisation est déjà entièrement soldée.'
    }

    // --------------------------------------------------------
    // ECHEANCE NON PAYABLE
    // --------------------------------------------------------

    if (
      databaseMessage.includes(
        'Obligation cannot be paid'
      )
    ) {
      message =
        'Cette échéance ne peut plus être encaissée.'
    }

    // --------------------------------------------------------
    // AUTORISATION
    // --------------------------------------------------------

    if (
      databaseMessage.includes(
        'Not authorized'
      )
    ) {
      message =
        'Vous ne disposez pas des droits nécessaires pour effectuer cet encaissement.'
    }

    // --------------------------------------------------------
    // TYPE INACTIF / INTROUVABLE
    // --------------------------------------------------------

    if (
      databaseMessage.includes(
        'Contribution type not available'
      )
    ) {
      message =
        'Cette cotisation régulière n’est plus disponible.'
    }

    redirect(
      `/contributions/collection/${data.obligationId}?year=${data.year}&error=${encodeURIComponent(
        message
      )}`
    )
  }

  // ==========================================================
  // 10. RESULTAT
  // ==========================================================

  const payment =
    paymentResult[0]

  if (
    !payment
      .new_payment_id
  ) {
    console.error(
      'EWUKAI - payment result without payment id'
    )

    redirect(
      `/contributions/collection/${data.obligationId}?year=${data.year}&error=${encodeURIComponent(
        'Le paiement a retourné un résultat invalide.'
      )}`
    )
  }

  // ==========================================================
  // 11. RAFRAICHISSEMENT
  // ==========================================================

  revalidatePath(
    '/contributions/collection'
  )

  revalidatePath(
    `/contributions/collection/${data.obligationId}`
  )

  revalidatePath(
    '/contributions'
  )

  revalidatePath(
    '/dashboard'
  )

  revalidatePath(
    '/rapports'
  )

  revalidatePath(
    '/cash'
  )

  // ==========================================================
  // 12. REDIRECTION VERS LE RECU
  // ==========================================================

  redirect(
    `/contributions/receipts/${payment.new_payment_id}?obligation=${data.obligationId}&year=${data.year}`
  )
}