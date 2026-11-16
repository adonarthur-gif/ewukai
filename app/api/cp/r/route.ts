import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// RETOUR COURT CINETPAY AURORE
//
// URL volontairement courte afin de respecter
// la limite de 120 caractères imposée par CinetPay.
//
// Exemple :
// https://...trycloudflare.com/api/cp/r?r=AFCM...
//
// IMPORTANT :
// CETTE ROUTE NE CONFIRME JAMAIS LE PAIEMENT.
//
// La confirmation est effectuée uniquement par
// le webhook sécurisé CinetPay.
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
// ============================================================

export async function POST(
  request: NextRequest
) {
  let merchantTransactionId =
    getMerchantTransactionIdFromUrl(
      request
    )

  // ==========================================================
  // REFERENCE DEJA PRESENTE DANS L'URL
  // ==========================================================

  if (
    merchantTransactionId
  ) {
    return handleReturn(
      request,
      merchantTransactionId
    )
  }

  try {
    const contentType =
      request.headers
        .get(
          'content-type'
        )
        ?.toLowerCase() ||
      ''

    // ========================================================
    // JSON
    // ========================================================

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
    }

    // ========================================================
    // FORM DATA
    // ========================================================

    else {
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
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    request.nextUrl.origin

  // ==========================================================
  // AUCUNE REFERENCE
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
  // RECHERCHE DE LA TENTATIVE EWUKAI
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
    if (
      error
    ) {
      console.error(
        'EWUKAI - CINETPAY SHORT RETURN:',
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
  // REDIRECTION VERS LA COTISATION
  //
  // Aucun statut CinetPay reçu dans le navigateur
  // n'est utilisé comme preuve de paiement.
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
// REFERENCE DEPUIS URL
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

  key: string
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
// NORMALISATION
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