'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

const activateSchema = z.object({
  callId: z
    .string()
    .uuid(),
})

export async function activateContributionCall(
  formData: FormData
) {
  const parsed =
    activateSchema.safeParse({
      callId:
        formData.get('callId'),
    })

  if (!parsed.success) {
    redirect(
      '/contributions/calls?error=Appel invalide.'
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
      'treasurer',
    ].includes(role)
  ) {
    redirect(
      '/contributions/calls?error=Vous ne pouvez pas activer cet appel.'
    )
  }

  // Vérifier que l'appel appartient bien
  // à la mutuelle active.

  const {
    data: call,
    error: callError,
  } = await supabase
    .from('contribution_calls')
    .select(`
      id,
      organization_id,
      status
    `)
    .eq(
      'id',
      parsed.data.callId
    )
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (
    callError ||
    !call
  ) {
    redirect(
      '/contributions/calls?error=Appel introuvable.'
    )
  }

  const {
    data: createdObligations,
    error,
  } = await supabase.rpc(
    'activate_contribution_call',
    {
      target_call_id:
        call.id,
    }
  )

  if (error) {
    console.error(
      'EWUKAI - activate contribution call:',
      error
    )

    redirect(
      `/contributions/calls?error=${encodeURIComponent(
        'Impossible d’activer l’appel.'
      )}`
    )
  }

  revalidatePath(
    '/contributions/calls'
  )

  revalidatePath(
    '/contributions/collection'
  )

  revalidatePath(
    '/dashboard'
  )

  redirect(
    `/contributions/calls?activated=1&count=${createdObligations ?? 0}`
  )
}