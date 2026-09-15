'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

// ============================================================
// VALIDATION
// ============================================================

const paymentMethodSchema = z.object({
  provider: z.enum([
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
    'bank_transfer',
    'cash',
    'other',
  ]),

  label: z
    .string()
    .trim()
    .min(
      2,
      'Le nom du moyen de paiement est obligatoire.'
    )
    .max(100),

  accountName: z
    .string()
    .trim()
    .max(150)
    .optional(),

  accountNumber: z
    .string()
    .trim()
    .max(100)
    .optional(),

  merchantCode: z
    .string()
    .trim()
    .max(100)
    .optional(),

  bankName: z
    .string()
    .trim()
    .max(150)
    .optional(),

  instructions: z
    .string()
    .trim()
    .max(1500)
    .optional(),

  displayOrder: z.coerce
    .number()
    .int()
    .min(0)
    .max(100),
})

// ============================================================
// CREER
// ============================================================

export async function createPaymentMethod(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
    ].includes(role)
  ) {
    redirect('/dashboard')
  }

  const parsed =
    paymentMethodSchema.safeParse({

      provider:
        formData.get('provider'),

      label:
        formData.get('label'),

      accountName:
        formData.get('accountName') ||
        undefined,

      accountNumber:
        formData.get('accountNumber') ||
        undefined,

      merchantCode:
        formData.get('merchantCode') ||
        undefined,

      bankName:
        formData.get('bankName') ||
        undefined,

      instructions:
        formData.get('instructions') ||
        undefined,

      displayOrder:
        formData.get('displayOrder') ||
        0,
    })

  if (!parsed.success) {
    redirect(
      `/parametres/paiements?error=${encodeURIComponent(
        parsed.error.issues[0]
          ?.message ??
          'Informations invalides.'
      )}`
    )
  }

  const isActive =
    formData.get('isActive') ===
    'on'

  const isVisibleToMembers =
    formData.get(
      'isVisibleToMembers'
    ) === 'on'

  const {
    error,
  } =
    await supabase
      .from(
        'organization_payment_methods'
      )
      .insert({

        organization_id:
          organizationId,

        provider:
          parsed.data.provider,

        label:
          parsed.data.label,

        account_name:
          parsed.data.accountName ||
          null,

        account_number:
          parsed.data.accountNumber ||
          null,

        merchant_code:
          parsed.data.merchantCode ||
          null,

        bank_name:
          parsed.data.bankName ||
          null,

        instructions:
          parsed.data.instructions ||
          null,

        is_active:
          isActive,

        is_visible_to_members:
          isVisibleToMembers,

        accepts_remote_payment:
          false,

        display_order:
          parsed.data.displayOrder,

        created_by:
          (
            await supabase.auth
              .getClaims()
          )
            .data
            ?.claims
            ?.sub,

      })

  if (error) {
    console.error(
      'EWUKAI - create payment method:',
      error
    )

    redirect(
      `/parametres/paiements?error=${encodeURIComponent(
        'Impossible d’ajouter ce moyen de paiement.'
      )}`
    )
  }

  revalidatePath(
    '/parametres/paiements'
  )

  redirect(
    '/parametres/paiements?success=created'
  )
}

// ============================================================
// ACTIVER / DESACTIVER
// ============================================================

export async function togglePaymentMethod(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
    ].includes(role)
  ) {
    redirect('/dashboard')
  }

  const id =
    String(
      formData.get('id') || ''
    )

  const nextActive =
    formData.get('nextActive') ===
    'true'

  if (!id) {
    redirect(
      '/parametres/paiements?error=Moyen%20de%20paiement%20introuvable.'
    )
  }

  const {
    error,
  } =
    await supabase
      .from(
        'organization_payment_methods'
      )
      .update({
        is_active:
          nextActive,
      })
      .eq(
        'id',
        id
      )
      .eq(
        'organization_id',
        organizationId
      )

  if (error) {
    console.error(
      'EWUKAI - toggle payment method:',
      error
    )

    redirect(
      `/parametres/paiements?error=${encodeURIComponent(
        'Impossible de modifier ce moyen de paiement.'
      )}`
    )
  }

  revalidatePath(
    '/parametres/paiements'
  )

  redirect(
    '/parametres/paiements?success=updated'
  )
}

// ============================================================
// SUPPRIMER
// ============================================================

export async function deletePaymentMethod(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
    ].includes(role)
  ) {
    redirect('/dashboard')
  }

  const id =
    String(
      formData.get('id') || ''
    )

  if (!id) {
    redirect(
      '/parametres/paiements?error=Moyen%20de%20paiement%20introuvable.'
    )
  }

  const {
    error,
  } =
    await supabase
      .from(
        'organization_payment_methods'
      )
      .delete()
      .eq(
        'id',
        id
      )
      .eq(
        'organization_id',
        organizationId
      )

  if (error) {
    console.error(
      'EWUKAI - delete payment method:',
      error
    )

    redirect(
      `/parametres/paiements?error=${encodeURIComponent(
        'Impossible de supprimer ce moyen de paiement.'
      )}`
    )
  }

  revalidatePath(
    '/parametres/paiements'
  )

  redirect(
    '/parametres/paiements?success=deleted'
  )
}