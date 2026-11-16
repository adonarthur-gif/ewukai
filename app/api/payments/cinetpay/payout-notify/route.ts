import {
  timingSafeEqual,
} from 'node:crypto'

import {
  after,
  NextResponse,
} from 'next/server'

import {
  getCinetPayTransferStatus,
  hashCinetPayTransferNotifyToken,
} from '@/lib/payments/cinetpay-transfer'

import {
  processOrganizationPayout,
} from '@/lib/payments/process-organization-payout'

import {
  getPlatformCinetPayTransferConfig,
} from '@/lib/payments/platform-cinetpay'

import {
  createAdminClient,
} from '@/lib/supabase/admin'


// ============================================================
// EWUKAI
// WEBHOOK CINETPAY TRANSFER - REVERSEMENTS ORGANISATIONS
//
// PRINCIPES :
//
// 1. le webhook CinetPay est uniquement un signal
// 2. le statut reçu dans le webhook n'est jamais utilisé
//    directement pour décider qu'un reversement est réussi
// 3. le notify_token est vérifié lorsqu'EWUKAI possède déjà
//    son hash ; son absence initiale ne bloque pas le flux
// 4. le transaction_id reçu est considéré comme non fiable
//    tant qu'il n'a pas été vérifié serveur-à-serveur
// 5. si EWUKAI ne possède pas encore transaction_id, le
//    transaction_id reçu peut servir uniquement de piste de
//    vérification canonique auprès de CinetPay
// 6. seul un statut canonique SUCCESS peut produire
//    organization_payouts.status = transferred
// 7. le webhook répond rapidement puis la vérification
//    s'exécute avec after()
// ============================================================

export const runtime =
  'nodejs'

export const dynamic =
  'force-dynamic'


// ============================================================
// TEST DE DISPONIBILITÉ
// ============================================================

export async function GET() {

  return NextResponse.json(
    {
      ok: true,

      service:
        'cinetpay-payout-notify',

      api:
        'transfer',
    },
    {
      status: 200,

      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  )
}


// ============================================================
// NOTIFICATION CINETPAY
// ============================================================

export async function POST(
  request: Request
) {

  // ==========================================================
  // 1. LIRE LE PAYLOAD
  // ==========================================================

  let body:
    unknown


  try {

    body =
      await request.json()

  } catch {

    return jsonError(
      'invalid_payload',
      400
    )
  }


  if (
    !body ||
    typeof body !==
      'object'
  ) {

    return jsonError(
      'invalid_payload',
      400
    )
  }


  const payload =
    body as Record<
      string,
      unknown
    >


  // ==========================================================
  // 2. IDENTIFIANTS DE LA NOTIFICATION
  //
  // merchant_transaction_id est indispensable pour retrouver
  // le payout EWUKAI.
  //
  // transaction_id et notify_token sont optionnels car le
  // comportement réel observé en sandbox montre qu'ils peuvent
  // être absents pendant la phase PENDING.
  // ==========================================================

  const notifyToken =
    getString(
      payload,
      'notify_token'
    )


  const merchantTransactionId =
    getString(
      payload,
      'merchant_transaction_id'
    )


  const notificationTransactionId =
    getString(
      payload,
      'transaction_id'
    )


  if (
    !merchantTransactionId
  ) {

    return jsonError(
      'missing_merchant_transaction_id',
      400
    )
  }


  // ==========================================================
  // 3. RETROUVER LE PAYOUT EWUKAI
  // ==========================================================

  const admin =
    createAdminClient()


  const {
    data:
      payout,

    error:
      payoutError,
  } =
    await admin
      .from(
        'organization_payouts'
      )
      .select(`
        id,
        payment_id,
        status,
        provider,
        amount_xof,
        provider_merchant_transaction_ref,
        provider_transfer_ref,
        provider_notify_token_hash,
        provider_status
      `)
      .eq(
        'provider',
        'cinetpay'
      )
      .eq(
        'provider_merchant_transaction_ref',
        merchantTransactionId
      )
      .maybeSingle()


  if (payoutError) {

    console.error(
      'EWUKAI - CINETPAY PAYOUT WEBHOOK LOOKUP:',
      {
        code:
          payoutError.code,

        message:
          payoutError.message,
      }
    )


    return jsonError(
      'database_error',
      500
    )
  }


  // ==========================================================
  // 4. TRANSACTION INCONNUE
  //
  // Réponse 200 volontaire :
  // inutile de provoquer des répétitions pour une référence
  // qui n'appartient pas à EWUKAI.
  // ==========================================================

  if (!payout) {

    return NextResponse.json(
      {
        ok: true,

        ignored: true,
      },
      {
        status: 200,

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  }


  // ==========================================================
  // 5. CONTRÔLE DU NOTIFY TOKEN LORSQU'IL EST VÉRIFIABLE
  //
  // Cas A :
  // EWUKAI possède déjà un hash ET CinetPay envoie un token.
  // -> comparaison obligatoire.
  //
  // Cas B :
  // aucun hash n'existe encore.
  // -> le token ne peut pas servir de preuve d'authenticité.
  //    Le webhook reste seulement un signal.
  //
  // Cas C :
  // un hash existe mais le webhook n'envoie pas de token.
  // -> on ne marque rien comme réussi ; on continue uniquement
  //    vers la vérification canonique serveur-à-serveur.
  // ==========================================================

  const storedNotifyTokenHash =
    cleanText(
      payout
        .provider_notify_token_hash
    )


  if (
    storedNotifyTokenHash &&
    notifyToken
  ) {

    const receivedNotifyTokenHash =
      hashCinetPayTransferNotifyToken(
        notifyToken
      )


    if (
      !safeEqualHex(
        receivedNotifyTokenHash,
        storedNotifyTokenHash
      )
    ) {

      console.warn(
        'EWUKAI - CINETPAY PAYOUT INVALID NOTIFY TOKEN:',
        {
          payoutId:
            payout.id,
        }
      )


      return NextResponse.json(
        {
          ok: true,

          ignored: true,

          anomaly:
            true,

          reason:
            'invalid_notify_token',
        },
        {
          status: 200,

          headers: {
            'Cache-Control':
              'no-store',
          },
        }
      )
    }
  }


  if (
    storedNotifyTokenHash &&
    !notifyToken
  ) {

    console.warn(
      'EWUKAI - CINETPAY PAYOUT WEBHOOK WITHOUT NOTIFY TOKEN:',
      {
        payoutId:
          payout.id,
      }
    )
  }


  // ==========================================================
  // 6. COHÉRENCE TRANSACTION_ID DÉJÀ CONNU
  //
  // Si EWUKAI possède déjà la référence CinetPay et que le
  // webhook en présente une autre, on ne la remplace jamais.
  // ==========================================================

  const storedTransferRef =
    cleanText(
      payout
        .provider_transfer_ref
    )


  if (
    storedTransferRef &&
    notificationTransactionId &&
    storedTransferRef !==
      notificationTransactionId
  ) {

    const now =
      new Date()
        .toISOString()


    const {
      error:
        anomalyUpdateError,
    } =
      await admin
        .from(
          'organization_payouts'
        )
        .update({
          last_verified_at:
            now,

          last_error:
            'CINETPAY_WEBHOOK_TRANSACTION_ID_MISMATCH',

          updated_at:
            now,
        })
        .eq(
          'id',
          payout.id
        )


    if (
      anomalyUpdateError
    ) {

      console.error(
        'EWUKAI - CINETPAY PAYOUT WEBHOOK ANOMALY UPDATE:',
        {
          code:
            anomalyUpdateError.code,

          message:
            anomalyUpdateError.message,
        }
      )
    }


    console.warn(
      'EWUKAI - CINETPAY PAYOUT TRANSACTION ID MISMATCH:',
      {
        payoutId:
          payout.id,
      }
    )


    return NextResponse.json(
      {
        ok: true,

        anomaly: true,

        reason:
          'transaction_id_mismatch',
      },
      {
        status: 200,

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  }


  // ==========================================================
  // 7. VÉRIFICATION ASYNCHRONE
  //
  // Le webhook ne déclenche jamais directement "Reversé".
  //
  // Si transaction_id n'était pas encore connu d'EWUKAI mais
  // qu'il est présent dans le webhook, on l'utilise seulement
  // comme piste pour interroger CinetPay avec nos credentials.
  //
  // On ne le stocke qu'après confirmation canonique que le
  // merchant_transaction_id retourné correspond bien au payout.
  // ==========================================================

  after(
    async () => {

      try {

        if (
          !storedTransferRef &&
          notificationTransactionId
        ) {

          const credentials =
            await getPlatformCinetPayTransferConfig()


          const verification =
            await getCinetPayTransferStatus(
              notificationTransactionId,
              credentials
            )


          if (
            verification
              .merchantTransactionId !==
            merchantTransactionId
          ) {

            const now =
              new Date()
                .toISOString()


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
                  'CINETPAY_WEBHOOK_CANONICAL_MERCHANT_ID_MISMATCH',

                updated_at:
                  now,
              })
              .eq(
                'id',
                payout.id
              )


            console.warn(
              'EWUKAI - CINETPAY PAYOUT CANONICAL MERCHANT ID MISMATCH:',
              {
                payoutId:
                  payout.id,
              }
            )


            return
          }


          const canonicalTransactionId =
            cleanText(
              verification.transactionId
            ) ||
            notificationTransactionId


          const now =
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


          if (
            referenceUpdateError
          ) {

            throw new Error(
              'Unable to save verified CinetPay transfer reference.'
            )
          }
        }


        const result =
          await processOrganizationPayout(
            payout.id
          )


        console.info(
          'EWUKAI - CINETPAY PAYOUT WEBHOOK VERIFIED:',
          {
            payoutId:
              result.payoutId,

            status:
              result.status,

            idempotent:
              result.idempotent,

            providerStatus:
              result.providerStatus,
          }
        )

      } catch (error) {

        console.error(
          'EWUKAI - CINETPAY PAYOUT WEBHOOK PROCESSING:',
          safeError(
            error
          )
        )
      }
    }
  )


  // ==========================================================
  // 8. RÉPONSE IMMÉDIATE À CINETPAY
  // ==========================================================

  return NextResponse.json(
    {
      ok: true,

      accepted: true,
    },
    {
      status: 200,

      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  )
}


// ============================================================
// LIRE UNE CHAÎNE DU JSON
// ============================================================

function getString(
  payload:
    Record<
      string,
      unknown
    >,

  key:
    string
) {

  const value =
    payload[
      key
    ]


  if (
    typeof value !==
      'string'
  ) {

    return null
  }


  const normalized =
    value
      .trim()


  return normalized ||
    null
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
    value
      ?.trim()


  return normalized ||
    null
}


// ============================================================
// COMPARAISON CONSTANT-TIME DE SHA-256
// ============================================================

function safeEqualHex(
  left:
    string,

  right:
    string
) {

  const normalizedLeft =
    left
      .trim()
      .toLowerCase()


  const normalizedRight =
    right
      .trim()
      .toLowerCase()


  if (
    !/^[0-9a-f]{64}$/
      .test(
        normalizedLeft
      ) ||
    !/^[0-9a-f]{64}$/
      .test(
        normalizedRight
      )
  ) {

    return false
  }


  const leftBuffer =
    Buffer.from(
      normalizedLeft,
      'hex'
    )


  const rightBuffer =
    Buffer.from(
      normalizedRight,
      'hex'
    )


  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {

    return false
  }


  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  )
}


// ============================================================
// JSON ERROR
// ============================================================

function jsonError(
  error:
    string,

  status:
    number
) {

  return NextResponse.json(
    {
      ok: false,

      error,
    },
    {
      status,

      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  )
}


// ============================================================
// SAFE ERROR
//
// Ne jamais journaliser notify_token,
// credentials ou informations sensibles.
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
