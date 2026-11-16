import 'server-only'

import {
  buildCinetPayPayoutMerchantTransactionId,
  createCinetPayTransfer,
  getCinetPayTransferStatus,
  hashCinetPayTransferNotifyToken,
  isCinetPayTransferFinalStatus,
  isCinetPayTransferSuccessful,
  mapOrganizationProviderToCinetPayTransferMethod,
} from '@/lib/payments/cinetpay-transfer'

import {
  getCinetPayPublicBaseUrl,
} from '@/lib/payments/cinetpay'

import {
  getPlatformCinetPayTransferConfig,
} from '@/lib/payments/platform-cinetpay'

import {
  createAdminClient,
} from '@/lib/supabase/admin'


// ============================================================
// EWUKAI
// PROCESSEUR DE REVERSEMENT AUTOMATIQUE
//
// Flux :
//
// organization_payouts = pending
//          ↓
// prise en charge atomique
//          ↓
// organization_payouts = processing
//          ↓
// POST CinetPay /v1/transfer
//          ↓
// stockage merchant_transaction_id
// + transaction_id / hash notify_token si fournis
//          ↓
// si transaction_id existe : vérification canonique
// sinon : maintien en processing
//          ↓
// SUCCESS confirmé par CinetPay
//          ↓
// organization_payouts = transferred
//
// IMPORTANT :
// - aucun utilisateur ne déclenche le reversement
// - aucun utilisateur ne peut mettre "Reversé"
// - seul CinetPay confirmé serveur-à-serveur le permet
// - un payment_id ne peut produire qu'un seul payout
// ============================================================


// ============================================================
// RESULTAT
// ============================================================

export type OrganizationPayoutProcessResult = {

  payoutId: string

  status:
    | 'pending'
    | 'processing'
    | 'transferred'
    | 'failed'

  idempotent: boolean

  providerStatus:
    | string
    | null
}


// ============================================================
// LIGNE PAYOUT
// ============================================================

type OrganizationPayoutRow = {

  id: string

  organization_id: string

  payment_id: string

  payout_method_id: string

  amount_xof:
    | number
    | string

  currency: string

  status:
    | 'pending'
    | 'processing'
    | 'transferred'
    | 'failed'

  provider: string

  recipient_provider: string

  recipient_account_name: string

  recipient_account_number: string

  provider_merchant_transaction_ref:
    | string
    | null

  provider_transfer_ref:
    | string
    | null

  provider_status:
    | string
    | null

  provider_notify_token_hash:
    | string
    | null

  attempts_count:
    | number
    | string

  processing_at:
    | string
    | null

  transferred_at:
    | string
    | null

  failed_at:
    | string
    | null
}


// ============================================================
// TRAITER UN REVERSEMENT
// ============================================================

export async function processOrganizationPayout(
  payoutId: string
): Promise<OrganizationPayoutProcessResult> {

  const normalizedPayoutId =
    payoutId.trim()


  if (!normalizedPayoutId) {

    throw new Error(
      'EWUKAI payout ID is required.'
    )
  }


  const admin =
    createAdminClient()


  // ==========================================================
  // 1. CHARGER LE PAYOUT
  // ==========================================================

  const {
    data:
      initialData,

    error:
      initialError,
  } =
    await admin
      .from(
        'organization_payouts'
      )
      .select(`
        id,
        organization_id,
        payment_id,
        payout_method_id,
        amount_xof,
        currency,
        status,
        provider,
        recipient_provider,
        recipient_account_name,
        recipient_account_number,
        provider_merchant_transaction_ref,
        provider_transfer_ref,
        provider_status,
        provider_notify_token_hash,
        attempts_count,
        processing_at,
        transferred_at,
        failed_at
      `)
      .eq(
        'id',
        normalizedPayoutId
      )
      .maybeSingle()


  if (initialError) {

    console.error(
      'EWUKAI - PAYOUT LOAD:',
      {
        code:
          initialError.code,

        message:
          initialError.message,
      }
    )

    throw new Error(
      'Unable to load EWUKAI payout.'
    )
  }


  if (!initialData) {

    throw new Error(
      'EWUKAI payout not found.'
    )
  }


  const initial =
    initialData as OrganizationPayoutRow


  // ==========================================================
  // 2. IDEMPOTENCE - DEJA REVERSE
  // ==========================================================

  if (
    initial.status ===
    'transferred'
  ) {

    return {

      payoutId:
        initial.id,

      status:
        'transferred',

      idempotent:
        true,

      providerStatus:
        cleanText(
          initial.provider_status
        ),
    }
  }


  // ==========================================================
  // 3. ECHEC FINAL DEJA ENREGISTRE
  //
  // Pas de nouvel envoi automatique ici.
  // Les retries seront traités séparément et de façon contrôlée.
  // ==========================================================

  if (
    initial.status ===
    'failed'
  ) {

    return {

      payoutId:
        initial.id,

      status:
        'failed',

      idempotent:
        true,

      providerStatus:
        cleanText(
          initial.provider_status
        ),
    }
  }


  // ==========================================================
  // 4. CONFIGURATION DE BASE
  // ==========================================================

  const amountXof =
    Number(
      initial.amount_xof
    )


  if (
    !Number.isSafeInteger(
      amountXof
    ) ||
    amountXof <= 0
  ) {

    throw new Error(
      'EWUKAI payout amount is invalid.'
    )
  }


  if (
    initial.currency
      .trim()
      .toUpperCase() !==
    'XOF'
  ) {

    throw new Error(
      'EWUKAI payout currency must be XOF.'
    )
  }


  if (
    initial.provider
      .trim()
      .toLowerCase() !==
    'cinetpay'
  ) {

    throw new Error(
      'EWUKAI payout provider is not supported.'
    )
  }


  const merchantTransactionId =
    initial
      .provider_merchant_transaction_ref
      ?.trim() ||
    buildCinetPayPayoutMerchantTransactionId(
      initial.id
    )


  const paymentMethod =
    mapOrganizationProviderToCinetPayTransferMethod(
      initial.recipient_provider
    )


  const notifyUrl =
    `${getCinetPayPublicBaseUrl()}/api/payments/cinetpay/payout-notify`


  // ==========================================================
  // 5. SI LE PAYOUT EST DEJA PROCESSING
  //
  // IMPORTANT :
  //
  // Un transfert CinetPay peut avoir ete accepte avec :
  //
  // status = PENDING
  // transaction_id = null
  //
  // Dans ce cas, EWUKAI possede uniquement sa reference
  // merchant_transaction_id.
  //
  // Les tests reels du sandbox ont montre que :
  //
  // GET /v1/transfer/{merchant_transaction_id}
  //
  // peut repondre 404 / NOT_FOUND.
  //
  // EWUKAI ne doit donc pas interroger CinetPay tant qu'aucun
  // vrai transaction_id n'a ete obtenu.
  //
  // Surtout : ne jamais recreer un second transfert.
  // ==========================================================

  if (
    initial.status ===
    'processing'
  ) {

    const storedTransferRef =
      cleanText(
        initial
          .provider_transfer_ref
      )


    // ========================================================
    // AUCUN TRANSACTION_ID CINETPAY DISPONIBLE
    //
    // Le transfert a deja ete envoye.
    //
    // EWUKAI conserve le payout en processing et attend :
    //
    // - soit un webhook CinetPay contenant transaction_id ;
    // - soit une reconciliation ulterieure disposant d'une
    //   reference CinetPay verifiable.
    //
    // Aucun nouvel appel POST /v1/transfer n'est effectue.
    // ========================================================

    if (
      !storedTransferRef
    ) {

      return {

        payoutId:
          initial.id,

        status:
          'processing',

        idempotent:
          true,

        providerStatus:
          cleanText(
            initial.provider_status
          ),
      }
    }


    // ========================================================
    // TRANSACTION_ID CINETPAY DISPONIBLE
    //
    // La verification canonique peut etre effectuee avec le
    // vrai transaction_id CinetPay.
    // ========================================================

    try {

      return await verifyAndPersistPayoutStatus(
        initial,
        storedTransferRef,
        merchantTransactionId
      )

    } catch (error) {

      console.error(
        'EWUKAI - PAYOUT PROCESSING VERIFY:',
        safeError(
          error
        )
      )


      // Ne jamais recreer automatiquement un transfert.
      return {

        payoutId:
          initial.id,

        status:
          'processing',

        idempotent:
          true,

        providerStatus:
          cleanText(
            initial.provider_status
          ),
      }
    }
  }


  // ==========================================================
  // 6. LE PAYOUT DOIT ETRE PENDING
  // ==========================================================

  if (
    initial.status !==
    'pending'
  ) {

    throw new Error(
      'EWUKAI payout has an unsupported status.'
    )
  }


  // ==========================================================
  // 7. PRISE EN CHARGE ATOMIQUE
  //
  // Le WHERE status = pending garantit qu'un seul processus
  // obtient le droit d'envoyer le transfert.
  // ==========================================================

  const now =
    new Date()
      .toISOString()


  const attemptsCount =
    Number(
      initial.attempts_count
    )


  const {
    data:
      claimedData,

    error:
      claimError,
  } =
    await admin
      .from(
        'organization_payouts'
      )
      .update({

        status:
          'processing',

        provider_merchant_transaction_ref:
          merchantTransactionId,

        processing_at:
          initial.processing_at ??
          now,

        last_attempt_at:
          now,

        attempts_count:
          Number.isSafeInteger(
            attemptsCount
          )
            ? attemptsCount + 1
            : 1,

        last_error:
          null,

        updated_at:
          now,
      })
      .eq(
        'id',
        initial.id
      )
      .eq(
        'status',
        'pending'
      )
      .select(`
        id,
        organization_id,
        payment_id,
        payout_method_id,
        amount_xof,
        currency,
        status,
        provider,
        recipient_provider,
        recipient_account_name,
        recipient_account_number,
        provider_merchant_transaction_ref,
        provider_transfer_ref,
        provider_status,
        provider_notify_token_hash,
        attempts_count,
        processing_at,
        transferred_at,
        failed_at
      `)
      .maybeSingle()


  if (claimError) {

    console.error(
      'EWUKAI - PAYOUT CLAIM:',
      {
        code:
          claimError.code,

        message:
          claimError.message,
      }
    )

    throw new Error(
      'Unable to claim EWUKAI payout.'
    )
  }


  // Un autre processus a déjà pris le payout.
  if (!claimedData) {

    return {

      payoutId:
        initial.id,

      status:
        'processing',

      idempotent:
        true,

      providerStatus:
        cleanText(
          initial.provider_status
        ),
    }
  }


  const claimed =
    claimedData as OrganizationPayoutRow


  // ==========================================================
  // 8. CREER LE TRANSFERT CHEZ CINETPAY
  // ==========================================================

  let transfer:
    Awaited<
      ReturnType<
        typeof createCinetPayTransfer
      >
    >


  const credentials =
    await getPlatformCinetPayTransferConfig()


  try {

    transfer =
      await createCinetPayTransfer(
        {

          merchantTransactionId,

          amountXof,

          phoneNumber:
            claimed
              .recipient_account_number,

          paymentMethod,

          reason:
            `Reversement EWUKAI ${claimed.id}`,

          notifyUrl,
        },

        credentials
      )

  } catch (error) {

    // ========================================================
    // IMPORTANT :
    //
    // Une erreur réseau peut survenir APRES que CinetPay ait
    // accepté le transfert.
    //
    // Nous ne remettons donc PAS automatiquement le payout
    // à pending, car cela pourrait provoquer un double envoi.
    //
    // Il reste processing et sera réconcilié par sa référence
    // marchande déterministe.
    // ========================================================

    const failedAt =
      new Date()
        .toISOString()


    const message =
      errorMessage(
        error
      )


    await admin
      .from(
        'organization_payouts'
      )
      .update({

        provider_status:
          'UNKNOWN',

        provider_message:
          message,

        last_error:
          message,

        last_attempt_at:
          failedAt,

        updated_at:
          failedAt,
      })
      .eq(
        'id',
        claimed.id
      )


    console.error(
      'EWUKAI - CINETPAY PAYOUT CREATE:',
      safeError(
        error
      )
    )


    return {

      payoutId:
        claimed.id,

      status:
        'processing',

      idempotent:
        false,

      providerStatus:
        'UNKNOWN',
    }
  }


  // ==========================================================
  // 9. STOCKER LES REFERENCES DU TRANSFERT
  //
  // CinetPay peut accepter le transfert avec :
  //
  // code = 2002
  // status = PENDING
  // merchant_transaction_id = present
  // transaction_id = null
  // notify_token = null
  //
  // Ce cas est valide. EWUKAI conserve alors la reference
  // marchande et laisse le payout en processing.
  // ==========================================================

  const notifyTokenHash =
    transfer.notifyToken
      ? hashCinetPayTransferNotifyToken(
          transfer.notifyToken
        )
      : null


  const afterCreate =
    new Date()
      .toISOString()


  const {
    error:
      referenceUpdateError,
  } =
    await admin
      .from(
        'organization_payouts'
      )
      .update({

        provider_merchant_transaction_ref:
          transfer
            .merchantTransactionId,

        provider_transfer_ref:
          transfer
            .transactionId,

        provider_notify_token_hash:
          notifyTokenHash,

        provider_status:
          transfer.status,

        provider_message:
          null,

        last_error:
          null,

        updated_at:
          afterCreate,
      })
      .eq(
        'id',
        claimed.id
      )
      .eq(
        'status',
        'processing'
      )


  if (referenceUpdateError) {

    console.error(
      'EWUKAI - PAYOUT SAVE CINETPAY REFERENCES:',
      {
        code:
          referenceUpdateError.code,

        message:
          referenceUpdateError.message,
      }
    )


    // Le transfert peut deja exister chez CinetPay.
    // Ne jamais tenter un second envoi.
    throw new Error(
      'CinetPay transfer was created but EWUKAI could not save its references.'
    )
  }


  // ==========================================================
  // 10. CINETPAY PENDING SANS TRANSACTION_ID
  //
  // Sans transaction_id, aucune verification immediate fiable
  // n'est possible. Le payout reste processing.
  //
  // On ne le remet jamais a pending et on ne cree jamais un
  // second transfert pour la meme reference marchande.
  // ==========================================================

  if (
    !transfer.transactionId
  ) {

    return {

      payoutId:
        claimed.id,

      status:
        'processing',

      idempotent:
        false,

      providerStatus:
        transfer.status,
    }
  }


  // ==========================================================
  // 11. VERIFICATION IMMEDIATE
  //
  // Si CinetPay a deja fourni transaction_id, EWUKAI peut
  // interroger l'etat canonique.
  //
  // Seul SUCCESS confirme par cette verification autorise
  // le statut "transferred" / affichage "Reverse".
  // ==========================================================

  return await verifyAndPersistPayoutStatus(
    {
      ...claimed,

      provider_merchant_transaction_ref:
        transfer
          .merchantTransactionId,

      provider_transfer_ref:
        transfer
          .transactionId,

      provider_status:
        transfer.status,

      provider_notify_token_hash:
        notifyTokenHash,

      status:
        'processing',
    },

    transfer.transactionId,

    merchantTransactionId
  )
}


// ============================================================
// VERIFIER ET ENREGISTRER LE STATUT CANONIQUE
// ============================================================

async function verifyAndPersistPayoutStatus(
  payout:
    OrganizationPayoutRow,

  lookupReference:
    string,

  expectedMerchantTransactionId:
    string
): Promise<OrganizationPayoutProcessResult> {

  const admin =
    createAdminClient()


  const credentials =
    await getPlatformCinetPayTransferConfig()


  const verification =
    await getCinetPayTransferStatus(
      lookupReference,
      credentials
    )


  const now =
    new Date()
      .toISOString()


  // ==========================================================
  // COHERENCE REFERENCE
  // ==========================================================

  if (
    verification
      .merchantTransactionId !==
    expectedMerchantTransactionId
  ) {

    const message =
      'CinetPay transfer merchant transaction ID mismatch.'


    await admin
      .from(
        'organization_payouts'
      )
      .update({

        provider_status:
          verification.status,

        last_verified_at:
          now,

        last_error:
          message,

        updated_at:
          now,
      })
      .eq(
        'id',
        payout.id
      )


    throw new Error(
      message
    )
  }


  // ==========================================================
  // COHERENCE MONTANT
  // ==========================================================

  const expectedAmount =
    Number(
      payout.amount_xof
    )


  const verifiedAmountText =
    verification
      .amount
      .trim()


  const verifiedAmount =
    verifiedAmountText
      ? Number(
          verifiedAmountText
        )
      : Number.NaN


  const canonicalTransactionId =
    cleanText(
      verification.transactionId
    ) ||
    cleanText(
      payout.provider_transfer_ref
    )


  if (
    Number.isFinite(
      verifiedAmount
    ) &&
    verifiedAmount !==
      expectedAmount
  ) {

    const message =
      'CinetPay transfer amount mismatch.'


    await admin
      .from(
        'organization_payouts'
      )
      .update({

        provider_transfer_ref:
          canonicalTransactionId,

        provider_status:
          verification.status,

        last_verified_at:
          now,

        last_error:
          message,

        updated_at:
          now,
      })
      .eq(
        'id',
        payout.id
      )


    throw new Error(
      message
    )
  }


  // ==========================================================
  // SUCCESS -> REVERSÉ
  //
  // Pour un SUCCESS, le montant canonique doit aussi etre
  // present et exploitable avant de marquer le payout transfere.
  // ==========================================================

  if (
    isCinetPayTransferSuccessful(
      verification.status
    )
  ) {

    if (
      !Number.isFinite(
        verifiedAmount
      )
    ) {

      const message =
        'CinetPay SUCCESS response does not contain a valid transfer amount.'


      await admin
        .from(
          'organization_payouts'
        )
        .update({

          provider_transfer_ref:
            canonicalTransactionId,

          provider_status:
            verification.status,

          last_verified_at:
            now,

          last_error:
            message,

          updated_at:
            now,
        })
        .eq(
          'id',
          payout.id
        )


      throw new Error(
        message
      )
    }

    const {
      error,
    } =
      await admin
        .from(
          'organization_payouts'
        )
        .update({

          status:
            'transferred',

          provider_transfer_ref:
            canonicalTransactionId,

          provider_status:
            verification.status,

          provider_message:
            null,

          last_verified_at:
            now,

          transferred_at:
            now,

          failed_at:
            null,

          last_error:
            null,

          updated_at:
            now,
        })
        .eq(
          'id',
          payout.id
        )
        .eq(
          'status',
          'processing'
        )


    if (error) {

      throw new Error(
        'Unable to mark EWUKAI payout as transferred.'
      )
    }


    return {

      payoutId:
        payout.id,

      status:
        'transferred',

      idempotent:
        false,

      providerStatus:
        verification.status,
    }
  }


  // ==========================================================
  // ECHEC FINAL CINETPAY
  // ==========================================================

  if (
    isCinetPayTransferFinalStatus(
      verification.status
    )
  ) {

    const {
      error,
    } =
      await admin
        .from(
          'organization_payouts'
        )
        .update({

          status:
            'failed',

          provider_transfer_ref:
            canonicalTransactionId,

          provider_status:
            verification.status,

          last_verified_at:
            now,

          failed_at:
            now,

          last_error:
            verification.status,

          updated_at:
            now,
        })
        .eq(
          'id',
          payout.id
        )


    if (error) {

      throw new Error(
        'Unable to mark EWUKAI payout as failed.'
      )
    }


    return {

      payoutId:
        payout.id,

      status:
        'failed',

      idempotent:
        false,

      providerStatus:
        verification.status,
    }
  }


  // ==========================================================
  // ENCORE EN COURS
  // ==========================================================

  const {
    error,
  } =
    await admin
      .from(
        'organization_payouts'
      )
      .update({

        status:
          'processing',

        provider_transfer_ref:
          canonicalTransactionId,

        provider_status:
          verification.status,

        last_verified_at:
          now,

        last_error:
          null,

        updated_at:
          now,
      })
      .eq(
        'id',
        payout.id
      )


  if (error) {

    throw new Error(
      'Unable to update EWUKAI payout verification.'
    )
  }


  return {

    payoutId:
      payout.id,

    status:
      'processing',

    idempotent:
      false,

    providerStatus:
      verification.status,
  }
}


// ============================================================
// TEXTE NULLABLE
// ============================================================

function cleanText(
  value:
    | string
    | null
    | undefined
) {

  const normalized =
    value?.trim()


  return normalized ||
    null
}


// ============================================================
// MESSAGE D'ERREUR SANS SECRET
// ============================================================

function errorMessage(
  error:
    unknown
) {

  if (
    error instanceof
    Error
  ) {

    return error.message
      .slice(
        0,
        500
      )
  }


  return 'Unknown payout processing error.'
}


// ============================================================
// ERREUR JOURNALISABLE
//
// Ne jamais journaliser credentials, tokens ou payload secret.
// ============================================================

function safeError(
  error:
    unknown
) {

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