'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

const contributionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Le nom de la cotisation est obligatoire.'),

  description: z
    .string()
    .trim()
    .optional(),

  amount: z.coerce
    .number()
    .int('Le montant doit être un nombre entier.')
    .positive('Le montant doit être supérieur à zéro.'),

  frequency: z.enum([
    'monthly',
    'quarterly',
    'annual',
    'one_time',
  ]),

  dueDay: z
    .string()
    .trim()
    .optional(),

  startDate: z
    .string()
    .min(1, 'La date de début est obligatoire.'),

  endDate: z
    .string()
    .trim()
    .optional(),

  isMandatory: z
    .string()
    .optional(),
})

function nullable(value?: string) {
  const cleaned = value?.trim()
  return cleaned ? cleaned : null
}

export async function createContributionType(
  formData: FormData
) {
  const parsed = contributionSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    amount: formData.get('amount'),
    frequency: formData.get('frequency'),
    dueDay: formData.get('dueDay'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    isMandatory: formData.get('isMandatory'),
  })

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ??
      'Informations invalides.'

    redirect(
      `/contributions/new?error=${encodeURIComponent(message)}`
    )
  }

  const {
    supabase,
    userId,
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
    redirect(
      '/contributions?error=Vous ne disposez pas des droits nécessaires.'
    )
  }

  const data = parsed.data

  let dueDay: number | null = null

  if (
    data.frequency !== 'one_time' &&
    data.dueDay
  ) {
    dueDay = Number(data.dueDay)

    if (
      !Number.isInteger(dueDay) ||
      dueDay < 1 ||
      dueDay > 28
    ) {
      redirect(
        '/contributions/new?error=Le jour d’échéance doit être compris entre 1 et 28.'
      )
    }
  }

  const { error } = await supabase
    .from('contribution_types')
    .insert({
      organization_id: organizationId,
      name: data.name,
      description: nullable(data.description),
      amount: data.amount,
      frequency: data.frequency,
      due_day: dueDay,
      start_date: data.startDate,
      end_date: nullable(data.endDate),
      is_mandatory: data.isMandatory === 'on',
      is_active: true,
      created_by: userId,
    })

  if (error) {
    console.error(
      'EWUKAI - createContributionType:',
      error
    )

    redirect(
      '/contributions/new?error=Impossible de créer cette cotisation.'
    )
  }

  revalidatePath('/contributions')
  revalidatePath('/dashboard')

  redirect('/contributions?created=1')
}