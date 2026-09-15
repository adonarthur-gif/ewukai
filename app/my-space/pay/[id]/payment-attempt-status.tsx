import 'server-only'

import {
  createAdminClient,
} from '@/lib/supabase/admin'

import PaymentStatusClient from './payment-status-client'

// ============================================================
// EWUKAI
// LECTURE SERVEUR DE LA DERNIERE TENTATIVE DE PAIEMENT
// ============================================================

type Props = {
  organizationId: string
  memberId: string
  obligationId: string
  returned: boolean
}

type Attempt = {
  id: string

  status: string

  selected_payment_method:
    | string
    | null

  payment_id:
    | string
    | null
}

// ============================================================
// COMPONENT
// ============================================================

export default async function MemberPaymentAttemptStatus({
  organizationId,
  memberId,
  obligationId,
  returned,
}: Props) {
  if (!returned) {
    return null
  }

  const admin =
    createAdminClient()

  const {
    data,
    error,
  } =
    await admin
      .from(
        'member_payment_attempts'
      )
      .select(`
        id,
        status,
        selected_payment_method,
        payment_id
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'member_id',
        memberId
      )
      .eq(
        'obligation_id',
        obligationId
      )
      .eq(
        'provider',
        'cinetpay'
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        }
      )
      .limit(1)
      .maybeSingle()

  if (error) {
    console.error(
      'EWUKAI - MEMBER PAYMENT STATUS:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    return (
      <PaymentStatusClient
        attemptId={null}
        status={null}
        selectedPaymentMethod={null}
        paymentId={null}
        returned
      />
    )
  }

  const attempt =
    data as
      | Attempt
      | null

  return (
    <PaymentStatusClient
      attemptId={
        attempt?.id ??
        null
      }
      status={
        attempt?.status ??
        null
      }
      selectedPaymentMethod={
        attempt
          ?.selected_payment_method ??
        null
      }
      paymentId={
        attempt
          ?.payment_id ??
        null
      }
      returned
    />
  )
}