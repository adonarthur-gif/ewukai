'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import { requireOrganizationFeatureAccess } from '@/lib/subscriptions/feature-access'

const createSchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .positive(),

  category: z.enum([
    'social_aid',
    'operating',
    'event',
    'purchase',
    'reimbursement',
    'transport',
    'communication',
    'other',
  ]),

  beneficiary: z
    .string()
    .trim()
    .min(2)
    .max(200),

  description: z
    .string()
    .trim()
    .min(3)
    .max(500),

  paymentMethod: z.enum([
    'cash',
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
    'bank_transfer',
    'other',
  ]),

  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/),

  paymentReference: z
    .string()
    .trim()
    .max(200)
    .optional(),

  notes: z
    .string()
    .trim()
    .max(1000)
    .optional(),

  requestKey: z
    .string()
    .uuid(),
})

export async function createCashExpense(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
      'treasurer',
    ].includes(role)
  ) {
    redirect('/cash')
  }

  await requireOrganizationFeatureAccess(
    {
      supabase,
      organizationId,
    },
    'treasury'
  )

  const parsed =
    createSchema.safeParse({
      amount:
        formData.get('amount'),

      category:
        formData.get('category'),

      beneficiary:
        formData.get('beneficiary'),

      description:
        formData.get('description'),

      paymentMethod:
        formData.get('paymentMethod'),

      expenseDate:
        formData.get('expenseDate'),

      paymentReference:
        formData.get(
          'paymentReference'
        ) || undefined,

      notes:
        formData.get('notes') ||
        undefined,

      requestKey:
        formData.get('requestKey'),
    })

  if (!parsed.success) {
    redirect(
      '/cash/expenses/new?error=invalid'
    )
  }

  const data =
    parsed.data

  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  if (
    data.expenseDate >
    today
  ) {
    redirect(
      '/cash/expenses/new?error=future-date'
    )
  }

  const {
    data: expense,
    error,
  } =
    await supabase.rpc(
      'record_cash_expense',
      {
        target_organization_id:
          organizationId,

        expense_amount:
          data.amount,

        expense_category:
          data.category,

        expense_beneficiary:
          data.beneficiary,

        expense_description:
          data.description,

        selected_payment_method:
          data.paymentMethod,

        target_expense_date:
          data.expenseDate,

        payment_reference:
          data.paymentReference ||
          null,

        expense_notes:
          data.notes || null,

        supporting_document_path:
          null,

        request_key:
          data.requestKey,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - create expense:',
      error
    )

    const message =
      error.message?.includes(
        'Insufficient cash balance'
      )
        ? 'insufficient-balance'
        : 'server'

    redirect(
      `/cash/expenses/new?error=${message}`
    )
  }

  const result =
    expense?.[0]

  if (!result) {
    redirect(
      '/cash/expenses/new?error=server'
    )
  }

  revalidatePath('/cash')
  revalidatePath(
    '/cash/expenses'
  )

  redirect(
    `/cash/expenses?success=created&number=${encodeURIComponent(
      result.new_expense_number
    )}`
  )
}

export async function reverseCashExpense(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
      'treasurer',
    ].includes(role)
  ) {
    redirect('/cash')
  }

  await requireOrganizationFeatureAccess(
    {
      supabase,
      organizationId,
    },
    'treasury'
  )

  const expenseId =
    String(
      formData.get(
        'expenseId'
      ) ?? ''
    )

  const reason =
    String(
      formData.get(
        'reason'
      ) ?? ''
    ).trim()

  if (
    !expenseId ||
    reason.length < 3
  ) {
    redirect(
      `/cash/expenses/${expenseId}/reverse?error=invalid`
    )
  }

  const {
    data: expense,
    error: expenseError,
  } =
    await supabase
      .from('cash_expenses')
      .select(
        'id, organization_id, status'
      )
      .eq('id', expenseId)
      .eq(
        'organization_id',
        organizationId
      )
      .maybeSingle()

  if (
    expenseError ||
    !expense
  ) {
    redirect(
      '/cash/expenses?error=not-found'
    )
  }

  if (
    expense.status ===
    'reversed'
  ) {
    redirect(
      '/cash/expenses?error=already-reversed'
    )
  }

  const { error } =
    await supabase.rpc(
      'reverse_cash_expense',
      {
        target_expense_id:
          expenseId,

        reason,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - reverse expense:',
      error
    )

    redirect(
      `/cash/expenses/${expenseId}/reverse?error=server`
    )
  }

  revalidatePath('/cash')
  revalidatePath(
    '/cash/expenses'
  )

  redirect(
    '/cash/expenses?success=reversed'
  )
}
