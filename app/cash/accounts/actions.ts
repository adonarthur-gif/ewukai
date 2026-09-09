'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

const schema = z.object({
  label: z
    .string()
    .trim()
    .min(2)
    .max(120),

  paymentMethod: z.enum([
    'cash',
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
    'bank_transfer',
    'other',
  ]),

  accountHolder: z
    .string()
    .trim()
    .min(2)
    .max(200),

  phoneNumber: z
    .string()
    .trim()
    .max(50)
    .optional(),

  bankName: z
    .string()
    .trim()
    .max(150)
    .optional(),

  accountNumber: z
    .string()
    .trim()
    .max(150)
    .optional(),

  iban: z
    .string()
    .trim()
    .max(150)
    .optional(),

  paymentInstructions: z
    .string()
    .trim()
    .max(1000)
    .optional(),
})

export async function createTreasuryAccount(
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
    redirect('/cash/accounts')
  }

  const parsed = schema.safeParse({
    label:
      formData.get('label'),

    paymentMethod:
      formData.get('paymentMethod'),

    accountHolder:
      formData.get('accountHolder'),

    phoneNumber:
      formData.get('phoneNumber') ||
      undefined,

    bankName:
      formData.get('bankName') ||
      undefined,

    accountNumber:
      formData.get('accountNumber') ||
      undefined,

    iban:
      formData.get('iban') ||
      undefined,

    paymentInstructions:
      formData.get(
        'paymentInstructions'
      ) || undefined,
  })

  if (!parsed.success) {
    redirect(
      '/cash/accounts/new?error=invalid'
    )
  }

  const data = parsed.data

  const mobileMoney =
    [
      'wave',
      'orange_money',
      'mtn_momo',
      'moov_money',
    ].includes(
      data.paymentMethod
    )

  if (
    mobileMoney &&
    !data.phoneNumber
  ) {
    redirect(
      '/cash/accounts/new?error=phone-required'
    )
  }

  if (
    data.paymentMethod ===
      'bank_transfer' &&
    (
      !data.bankName ||
      !data.accountNumber
    )
  ) {
    redirect(
      '/cash/accounts/new?error=bank-required'
    )
  }

  const canReceive =
    formData.get('canReceive') ===
    'on'

  const canSpend =
    formData.get('canSpend') ===
    'on'

  const {
    data: accountId,
    error,
  } = await supabase.rpc(
    'create_treasury_account',
    {
      target_organization_id:
        organizationId,

      account_label:
        data.label,

      account_payment_method:
        data.paymentMethod,

      account_holder:
        data.accountHolder,

      account_phone_number:
        data.phoneNumber || null,

      account_bank_name:
        data.bankName || null,

      account_number:
        data.accountNumber || null,

      account_iban:
        data.iban || null,

      account_payment_instructions:
        data.paymentInstructions ||
        null,

      account_can_receive:
        canReceive,

      account_can_spend:
        canSpend,
    }
  )

  if (error) {
    console.error(
      'AFRI CLUB - treasury account:',
      error
    )

    const message =
      error.message?.toLowerCase()
        .includes('duplicate') ||
      error.message?.toLowerCase()
        .includes('unique')
        ? 'duplicate'
        : 'server'

    redirect(
      `/cash/accounts/new?error=${message}`
    )
  }

  if (!accountId) {
    redirect(
      '/cash/accounts/new?error=server'
    )
  }

  revalidatePath('/cash')
  revalidatePath('/cash/accounts')

  redirect(
    '/cash/accounts?success=created'
  )
}

export async function archiveTreasuryAccount(
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
    redirect('/cash/accounts')
  }

  const accountId =
    String(
      formData.get(
        'accountId'
      ) ?? ''
    )

  if (!accountId) {
    redirect(
      '/cash/accounts?error=invalid'
    )
  }

  const {
    data: account,
    error: accountError,
  } =
    await supabase
      .from('treasury_accounts')
      .select(
        'id, organization_id, is_active'
      )
      .eq('id', accountId)
      .eq(
        'organization_id',
        organizationId
      )
      .maybeSingle()

  if (
    accountError ||
    !account
  ) {
    redirect(
      '/cash/accounts?error=not-found'
    )
  }

  if (!account.is_active) {
    redirect(
      '/cash/accounts'
    )
  }

  const { error } =
    await supabase.rpc(
      'archive_treasury_account',
      {
        target_account_id:
          accountId,
      }
    )

  if (error) {
    console.error(
      'AFRI CLUB - archive treasury account:',
      error
    )

    redirect(
      '/cash/accounts?error=archive'
    )
  }

  revalidatePath('/cash')
  revalidatePath('/cash/accounts')

  redirect(
    '/cash/accounts?success=archived'
  )
}