import {
  NextResponse,
} from 'next/server'

import {
  getCinetPaySiteId,
  verifyCinetPayHmac,
  verifyCinetPayTransaction,
} from '@/lib/payments/cinetpay'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

export const runtime =
  'nodejs'

export const dynamic =
  'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
    },
    {
      status: 200,
    }
  )
}

export async function POST(
  request: Request
) {
  let formData:
    FormData

  try {
    formData =
      await request.formData()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_payload',
      },
      {
        status: 400,
      }
    )
  }

  let validHmac =
    false

  try {
    validHmac =
      verifyCinetPayHmac({
        formData,

        receivedToken:
          request.headers.get(
            'x-token'
          ),
      })
  } catch (
    error
  ) {
    console.error(
      'AFRI CLUB - CINETPAY HMAC CONFIG:',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          'payment_configuration_error',
      },
      {
        status: 500,
      }
    )
  }

  if (!validHmac) {
    console.warn(
      'AFRI CLUB - CINETPAY INVALID HMAC'
    )

    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_hmac',
      },
      {
        status: 401,
      }
    )
  }

  const transactionId =
    getFormString(
      formData,
      'cpm_trans_id'
    )

  const postedSiteId =
    getFormString(
      formData,
      'cpm_site_id'
    )

  if (
    !transactionId ||
    !postedSiteId
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'missing_transaction',
      },
      {
        status: 400,
      }
    )
  }

  let expectedSiteId:
    string

  try {
    expectedSiteId =
      getCinetPaySiteId()
  } catch (
    error
  ) {
    console.error(
      'AFRI CLUB - CINETPAY SITE CONFIG:',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          'payment_configuration_error',
      },
      {
        status: 500,
      }
    )
  }

  if (
    postedSiteId !==
    expectedSiteId
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_site',
      },
      {
        status: 401,
      }
    )
  }

  const admin =
    createAdminClient()

  const {
    data:
      attempt,

    error:
      attemptError,
  } =
    await admin
      .from(
        'subscription_payment_attempts'
      )
      .select(`
        id,
        organization_id,
        subscription_id,
        invoice_id,
        provider,
        provider_transaction_ref,
        expected_amount_xof,
        currency,
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

  if (
    attemptError
  ) {
    console.error(
      'AFRI CLUB - CINETPAY ATTEMPT LOOKUP:',
      attemptError
    )

    return NextResponse.json(
      {
        ok: false,
        error: 'database_error',
      },
      {
        status: 500,
      }
    )
  }

  if (!attempt) {
    return NextResponse.json(
      {
        ok: true,
        ignored: true,
      },
      {
        status: 200,
      }
    )
  }

  if (
    attempt.status ===
    'confirmed'
  ) {
    return NextResponse.json(
      {
        ok: true,
        idempotent: true,
      },
      {
        status: 200,
      }
    )
  }

  let verification:
    Awaited<
      ReturnType<
        typeof verifyCinetPayTransaction
      >
    >

  try {
    verification =
      await verifyCinetPayTransaction(
        transactionId
      )
  } catch (
    error
  ) {
    console.error(
      'AFRI CLUB - CINETPAY VERIFY:',
      error
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          'provider_verification_failed',
      },
      {
        status: 502,
      }
    )
  }

  const providerStatus =
    (
      verification.data?.status ??
      ''
    )
      .trim()
      .toUpperCase()

  const paymentMethod =
    cleanNullable(
      verification
        .data
        ?.payment_method
    )

  const operatorId =
    cleanNullable(
      verification
        .data
        ?.operator_id
    )

  const now =
    new Date()
      .toISOString()

  if (
    providerStatus ===
    'ACCEPTED'
  ) {
    const amountXof =
      parseXofAmount(
        verification.data?.amount
      )

    const currency =
      (
        verification
          .data
          ?.currency ??
        ''
      )
        .trim()
        .toUpperCase()

    if (
      amountXof === null
    ) {
      await markAttemptAnomaly(
        admin,
        attempt.id,
        providerStatus,
        paymentMethod,
        operatorId,
        now
      )

      return NextResponse.json(
        {
          ok: true,
          anomaly: true,
        },
        {
          status: 200,
        }
      )
    }

    const {
      data:
        confirmation,

      error:
        confirmationError,
    } =
      await admin.rpc(
        'confirm_cinetpay_subscription_payment',
        {
          target_attempt_id:
            attempt.id,

          target_amount_xof:
            amountXof,

          target_currency:
            currency,

          target_payment_method:
            paymentMethod,

          target_operator_id:
            operatorId,

          target_event_ref:
            null,

          target_provider_paid_at:
            now,
        }
      )

    if (
      confirmationError
    ) {
      console.error(
        'AFRI CLUB - CINETPAY CONFIRM:',
        confirmationError
      )

      return NextResponse.json(
        {
          ok: false,
          error:
            'activation_failed',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        confirmation,
      },
      {
        status: 200,
      }
    )
  }

  if (
    providerStatus ===
      'REFUSED' ||
    providerStatus ===
      'CANCELLED' ||
    providerStatus ===
      'CANCELED'
  ) {
    const {
      error:
        failedUpdateError,
    } =
      await admin
        .from(
          'subscription_payment_attempts'
        )
        .update({
          status: 'failed',
          provider_status:
            providerStatus,
          provider_payment_method:
            paymentMethod,
          provider_operator_id:
            operatorId,
          last_verified_at: now,
          failed_at: now,
          updated_at: now,
        })
        .eq(
          'id',
          attempt.id
        )

    if (
      failedUpdateError
    ) {
      console.error(
        'AFRI CLUB - CINETPAY FAILED UPDATE:',
        failedUpdateError
      )

      return NextResponse.json(
        {
          ok: false,
          error: 'database_error',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        status: 'failed',
      },
      {
        status: 200,
      }
    )
  }

  const {
    error:
      pendingUpdateError,
  } =
    await admin
      .from(
        'subscription_payment_attempts'
      )
      .update({
        status: 'pending',
        provider_status:
          providerStatus ||
          verification.message ||
          'PENDING',
        provider_payment_method:
          paymentMethod,
        provider_operator_id:
          operatorId,
        last_verified_at: now,
        updated_at: now,
      })
      .eq(
        'id',
        attempt.id
      )

  if (
    pendingUpdateError
  ) {
    console.error(
      'AFRI CLUB - CINETPAY PENDING UPDATE:',
      pendingUpdateError
    )

    return NextResponse.json(
      {
        ok: false,
        error: 'database_error',
      },
      {
        status: 500,
      }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      status: 'pending',
    },
    {
      status: 200,
    }
  )
}

function getFormString(
  formData: FormData,
  key: string
) {
  const value =
    formData.get(key)

  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized ||
    null
}

function cleanNullable(
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

function parseXofAmount(
  value:
    | string
    | number
    | null
    | undefined
) {
  const amount =
    typeof value ===
      'number'
      ? value
      : Number(value)

  if (
    !Number.isSafeInteger(
      amount
    ) ||
    amount <= 0
  ) {
    return null
  }

  return amount
}

async function markAttemptAnomaly(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  attemptId: string,
  providerStatus: string,
  paymentMethod:
    | string
    | null,
  operatorId:
    | string
    | null,
  now: string
) {
  const {
    error,
  } =
    await admin
      .from(
        'subscription_payment_attempts'
      )
      .update({
        status: 'anomaly',
        provider_status:
          providerStatus,
        provider_payment_method:
          paymentMethod,
        provider_operator_id:
          operatorId,
        last_verified_at: now,
        updated_at: now,
      })
      .eq(
        'id',
        attemptId
      )

  if (error) {
    console.error(
      'AFRI CLUB - CINETPAY ANOMALY UPDATE:',
      error
    )
  }
}
