import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// RETOUR NAVIGATEUR CINETPAY AURORE
//
// IMPORTANT :
// CETTE ROUTE NE CONFIRME JAMAIS UN PAIEMENT.
//
// La confirmation financière est effectuée uniquement
// par le webhook sécurisé :
//
// /api/payments/cinetpay/member-notify
//
// qui vérifie ensuite la transaction directement
// auprès de l'API CinetPay Aurore.
// ============================================================

export const runtime =
  'nodejs'

export const dynamic =
  'force-dynamic'

// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest
) {
  const merchantTransactionId =
    getMerchantTransactionIdFromUrl(
      request
    )

  return handleReturn(
    request,
    merchantTransactionId
  )
}

// ============================================================
// POST
//
// On accepte également POST par prudence,
// mais aucune donnée financière reçue ici n'est utilisée.
// ============================================================

export async function POST(
  request: NextRequest
) {
  let merchantTransactionId =
    getMerchantTransactionIdFromUrl(
      request
    )

  // ==========================================================
  // SI LA REFERENCE EST DEJA DANS L'URL
  // ==========================================================

  if (
    merchantTransactionId
  ) {
    return handleReturn(
      request,
      merchantTransactionId
    )
  }

  // ==========================================================
  // ESSAYER JSON
  // ==========================================================

  try {
    const contentType =
      request.headers
        .get(
          'content-type'
        )
        ?.toLowerCase() ||
      ''

    if (
      contentType.includes(
        'application/json'
      )
    ) {
      const payload =
        await request.json()

      if (
        payload &&
        typeof payload ===
          'object'
      ) {
        const record =
          payload as Record<
            string,
            unknown
          >

        merchantTransactionId =
          getRecordString(
            record,
            'r'
          ) ??
          getRecordString(
            record,
            'merchant_transaction_id'
          ) ??
          getRecordString(
            record,
            'transaction_id'
          ) ??
          getRecordString(
            record,
            'cpm_trans_id'
          )
      }
    } else {
      // ======================================================
      // ESSAYER FORM DATA
      // ======================================================

      const formData =
        await request.formData()

      merchantTransactionId =
        getFormString(
          formData,
          'r'
        ) ??
        getFormString(
          formData,
          'merchant_transaction_id'
        ) ??
        getFormString(
          formData,
          'transaction_id'
        ) ??
        getFormString(
          formData,
          'cpm_trans_id'
        )
    }
  } catch {
    merchantTransactionId =
      null
  }

  return handleReturn(
    request,
    merchantTransactionId
  )
}

// ============================================================
// TRAITEMENT DU RETOUR
// ============================================================

async function handleReturn(
  request: NextRequest,

  merchantTransactionId:
    | string
    | null
) {
  const origin =
    request.nextUrl.origin

  // ==========================================================
  // AUCUNE REFERENCE
  //
  // Aucun paiement n'est considéré comme confirmé.
  // ==========================================================

  if (
    !merchantTransactionId
  ) {
    return NextResponse.redirect(
      new URL(
        '/my-space?payment=returned',
        origin
      )
    )
  }

  // ==========================================================
  // RECHERCHER NOTRE TENTATIVE
  // ==========================================================

  const admin =
    createAdminClient()

  const {
    data:
      attempt,

    error,
  } =
    await admin
      .from(
        'member_payment_attempts'
      )
      .select(`
        id,
        organization_id,
        obligation_id,
        payment_id,
        status
      `)
      .eq(
        'provider',
        'cinetpay'
      )
      .eq(
        'provider_transaction_ref',
        merchantTransactionId
      )
      .maybeSingle()

  // ==========================================================
  // REFERENCE INCONNUE
  // ==========================================================

  if (
    error ||
    !attempt
  ) {
    if (error) {
      console.error(
        'EWUKAI - CINETPAY AURORE MEMBER RETURN:',
        {
          code:
            error.code,

          message:
            error.message,
        }
      )
    }

    return NextResponse.redirect(
      new URL(
        '/my-space?payment=returned',
        origin
      )
    )
  }

  // ==========================================================
  // RETOUR VERS LA COTISATION
  //
  // IMPORTANT :
  // le statut sera relu depuis Supabase.
  //
  // On ne considère jamais le retour navigateur
  // comme une preuve de paiement.
  // ==========================================================

  const destination =
    new URL(
      `/my-space/pay/${encodeURIComponent(
        attempt.obligation_id
      )}`,
      origin
    )

  destination
    .searchParams
    .set(
      'returned',
      '1'
    )

  destination
    .searchParams
    .set(
      'organization',
      attempt.organization_id
    )

  // ==========================================================
  // INFORMATION D'AFFICHAGE UNIQUEMENT
  //
  // Ce paramètre n'a aucune valeur financière.
  // ==========================================================

  const result =
    normalizeText(
      request.nextUrl
        .searchParams
        .get(
          'result'
        )
    )

  if (
    result ===
      'success' ||
    result ===
      'failed'
  ) {
    destination
      .searchParams
      .set(
        'result',
        result
      )
  }

  return NextResponse.redirect(
    destination
  )
}

// ============================================================
// REFERENCE DEPUIS L'URL
//
// "r" est prioritaire car il est volontairement court
// pour respecter la limite de longueur des URLs CinetPay.
// ============================================================

function getMerchantTransactionIdFromUrl(
  request: NextRequest
) {
  return normalizeText(
    request.nextUrl
      .searchParams
      .get(
        'r'
      ) ??
    request.nextUrl
      .searchParams
      .get(
        'merchant_transaction_id'
      ) ??
    request.nextUrl
      .searchParams
      .get(
        'transaction_id'
      ) ??
    request.nextUrl
      .searchParams
      .get(
        'cpm_trans_id'
      )
  )
}

// ============================================================
// FORM DATA
// ============================================================

function getFormString(
  formData: FormData,

  key: string
) {
  const value =
    formData.get(
      key
    )

  return typeof value ===
    'string'
    ? normalizeText(
        value
      )
    : null
}

// ============================================================
// JSON
// ============================================================

function getRecordString(
  record:
    Record<
      string,
      unknown
    >,

  key:
    string
) {
  const value =
    record[
      key
    ]

  return typeof value ===
    'string'
    ? normalizeText(
        value
      )
    : null
}

// ============================================================
// TEXTE
// ============================================================

function normalizeText(
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