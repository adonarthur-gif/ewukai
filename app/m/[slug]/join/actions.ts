'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(
      /^[a-zA-Z0-9-]+$/
    ),

  lastName: z
    .string()
    .trim()
    .min(2)
    .max(150),

  firstName: z
    .string()
    .trim()
    .min(2)
    .max(150),

  phone: z
    .string()
    .trim()
    .min(8)
    .max(30),

  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(
      z.literal('')
    ),

  residence: z
    .string()
    .trim()
    .max(200)
    .optional(),

  profession: z
    .string()
    .trim()
    .max(200)
    .optional(),

  motivation: z
    .string()
    .trim()
    .max(1500)
    .optional(),

  requestKey: z
    .string()
    .uuid(),
})

export async function submitMembershipApplication(
  formData: FormData
) {
  const parsed =
    schema.safeParse({
      slug:
        formData.get('slug'),

      lastName:
        formData.get('lastName'),

      firstName:
        formData.get('firstName'),

      phone:
        formData.get('phone'),

      email:
        formData.get('email') ??
        '',

      residence:
        formData.get(
          'residence'
        ) || undefined,

      profession:
        formData.get(
          'profession'
        ) || undefined,

      motivation:
        formData.get(
          'motivation'
        ) || undefined,

      requestKey:
        formData.get(
          'requestKey'
        ),
    })

  if (!parsed.success) {
    const slug =
      String(
        formData.get('slug') ??
        ''
      )

    redirect(
      `/m/${encodeURIComponent(
        slug
      )}/join?error=invalid`
    )
  }

  const accepted =
    formData.get(
      'termsAccepted'
    ) === 'on'

  if (!accepted) {
    redirect(
      `/m/${parsed.data.slug}/join?error=terms`
    )
  }

  const data =
    parsed.data

  const supabase =
    await createClient()

  const {
    data: applicationId,
    error,
  } =
    await supabase.rpc(
      'submit_membership_application',
      {
        target_slug:
          data.slug,

        applicant_last_name:
          data.lastName,

        applicant_first_name:
          data.firstName,

        applicant_phone:
          data.phone,

        applicant_email:
          data.email || null,

        applicant_residence:
          data.residence ||
          null,

        applicant_profession:
          data.profession ||
          null,

        applicant_motivation:
          data.motivation ||
          null,

        request_key:
          data.requestKey,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - membership application:',
      error
    )

    redirect(
      `/m/${data.slug}/join?error=server`
    )
  }

  if (!applicationId) {
    redirect(
      `/m/${data.slug}/join?error=server`
    )
  }

  redirect(
    `/m/${data.slug}/join/success`
  )
}