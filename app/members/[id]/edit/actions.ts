'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

const memberSchema = z.object({
  memberId: z
    .string()
    .uuid(),

  firstName: z
    .string()
    .trim()
    .min(
      2,
      'Le prénom est obligatoire.'
    )
    .max(100),

  lastName: z
    .string()
    .trim()
    .min(
      2,
      'Le nom est obligatoire.'
    )
    .max(100),

  phone: z
    .string()
    .trim()
    .max(30)
    .optional(),
})

export async function updateMember(
  formData: FormData
) {
  const parsed =
    memberSchema.safeParse({
      memberId:
        formData.get('memberId'),

      firstName:
        formData.get('firstName'),

      lastName:
        formData.get('lastName'),

      phone:
        formData.get('phone'),
    })

  if (!parsed.success) {
    const id =
      String(
        formData.get(
          'memberId'
        ) ?? ''
      )

    const message =
      parsed.error.issues[0]
        ?.message ??
      'Informations invalides.'

    redirect(
      `/members/${id}/edit?error=${encodeURIComponent(
        message
      )}`
    )
  }

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
      'secretary',
    ].includes(role)
  ) {
    redirect(
      `/members/${parsed.data.memberId}?error=${encodeURIComponent(
        'Vous ne disposez pas des droits nécessaires.'
      )}`
    )
  }

  const {
    data: member,
  } = await supabase
    .from('members')
    .select('id')
    .eq(
      'id',
      parsed.data.memberId
    )
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (!member) {
    redirect('/members')
  }

  const {
    error,
  } = await supabase
    .from('members')
    .update({
      first_name:
        parsed.data.firstName,

      last_name:
        parsed.data.lastName,

      phone:
        parsed.data.phone ||
        null,
    })
    .eq(
      'id',
      parsed.data.memberId
    )
    .eq(
      'organization_id',
      organizationId
    )

  if (error) {
    console.error(
      'EWUKAI - update member:',
      error
    )

    redirect(
      `/members/${parsed.data.memberId}/edit?error=${encodeURIComponent(
        'Impossible de modifier le membre.'
      )}`
    )
  }

  revalidatePath(
    '/members'
  )

  revalidatePath(
    `/members/${parsed.data.memberId}`
  )

  revalidatePath(
    '/dashboard'
  )

  revalidatePath(
    '/contributions/collection'
  )

  redirect(
    `/members/${parsed.data.memberId}?updated=1`
  )
}
