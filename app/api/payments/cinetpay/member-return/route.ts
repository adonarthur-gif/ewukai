import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

// ============================================================
// EWUKAI
// RETOUR NAVIGATEUR CINETPAY - COTISATION MEMBRE
//
// IMPORTANT :
// cette route ne confirme JAMAIS un paiement.
//
// La confirmation financière est faite uniquement par :
// /api/payments/cinetpay/member-notify
// ============================================================

// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest
) {
  const transactionId =
    normalizeText(
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

  return handleReturn(
    request,
    transactionId
  )
}

// ============================================================
// POST
// ============================================================

export async function POST(
  request: NextRequest
) {
  let transactionId:
    | string
    | null =
      null

  try {
    const formData =
      await request.formData()

    transactionId =
      normalizeText(
        getFormString(
          formData,
          'transaction_id'
        ) ??
          getFormString(
            formData,
            'cpm_trans_id'
          )
      )
  } catch {
    transactionId =
      null
  }

  return handleReturn(
    request,
    transactionId
  )
}

// ============================================================
// TRAITEMENT DU RETOUR
// ============================================================

async function handleReturn(
  request: NextRequest,
  transactionId:
    | string
    | null
) {
  const origin =
    request.nextUrl.origin

  // ==========================================================
  // AUCUNE REFERENCE
  // ==========================================================

  if (!transactionId) {
    return NextResponse.redirect(
      new URL(
        '/my-space?payment=returned',
        origin
      )
    )
  }

  // ==========================================================
  // RECHERCHER LA TENTATIVE
  // ==========================================================

  const admin =
    createAdminClient()

  const {
    data: attempt,
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
        transactionId
      )
      .maybeSingle()

  // ==========================================================
  // TRANSACTION INCONNUE
  // ==========================================================

  if (
    error ||
    !attempt
  ) {
    if (error) {
      console.error(
        'EWUKAI - MEMBER CINETPAY RETURN:',
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
  // RETOUR VERS L'ECHEANCE
  //
  // IMPORTANT :
  // le statut affiché sera relu depuis la base.
  // On ne considère pas ce retour navigateur comme
  // une preuve de paiement.
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

  return NextResponse.redirect(
    destination
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
    ? value
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