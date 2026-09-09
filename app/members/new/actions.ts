'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

const memberSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'Le prénom est obligatoire.'),

  lastName: z
    .string()
    .trim()
    .min(2, 'Le nom est obligatoire.'),

  phone: z
    .string()
    .trim()
    .optional(),

  email: z
    .string()
    .trim()
    .optional(),

  gender: z
    .string()
    .trim()
    .optional(),

  birthDate: z
    .string()
    .trim()
    .optional(),

  profession: z
    .string()
    .trim()
    .optional(),

  address: z
    .string()
    .trim()
    .optional(),

  emergencyContactName: z
    .string()
    .trim()
    .optional(),

  emergencyContactPhone: z
    .string()
    .trim()
    .optional(),

  joinedAt: z
    .string()
    .trim()
    .min(1, "La date d'adhésion est obligatoire."),
})

function nullable(value?: string) {
  const cleaned = value?.trim()

  return cleaned ? cleaned : null
}

export async function createMember(
  formData: FormData
) {
  const parsed = memberSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    gender: formData.get('gender'),
    birthDate: formData.get('birthDate'),
    profession: formData.get('profession'),
    address: formData.get('address'),
    emergencyContactName:
      formData.get('emergencyContactName'),
    emergencyContactPhone:
      formData.get('emergencyContactPhone'),
    joinedAt: formData.get('joinedAt'),
  })

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ??
      'Informations invalides.'

    redirect(
      `/members/new?error=${encodeURIComponent(
        message
      )}`
    )
  }

  const {
    supabase,
    userId,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  const allowedRoles = [
    'owner',
    'president',
    'secretary',
  ]

  if (!allowedRoles.includes(role)) {
    redirect(
      '/members?error=Vous ne disposez pas des droits nécessaires.'
    )
  }

  const data = parsed.data

  const { data: createdMember, error } =
    await supabase
      .from('members')
      .insert({
        organization_id: organizationId,

        first_name: data.firstName,
        last_name: data.lastName,

        phone: nullable(data.phone),
        email: nullable(data.email),

        gender: nullable(data.gender),

        birth_date:
          nullable(data.birthDate),

        profession:
          nullable(data.profession),

        address:
          nullable(data.address),

        emergency_contact_name:
          nullable(
            data.emergencyContactName
          ),

        emergency_contact_phone:
          nullable(
            data.emergencyContactPhone
          ),

        joined_at: data.joinedAt,

        status: 'active',

        created_by: userId,
      })
      .select(
        'id, member_number'
      )
      .single()

  if (error || !createdMember) {
    console.error(
      'AFRI CLUB - createMember:',
      error
    )

    redirect(
      '/members/new?error=Impossible d’enregistrer ce membre.'
    )
  }

  revalidatePath('/members')
  revalidatePath('/dashboard')
  revalidatePath('/contributions/collection')
  revalidatePath('/rapports')

  redirect(
    `/members/${createdMember.id}?created=1`
  )
}