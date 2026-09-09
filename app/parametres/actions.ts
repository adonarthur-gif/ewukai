'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

// ============================================================
// PARAMETRES DE LA MUTUELLE
// ============================================================

const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      2,
      'Le nom de la mutuelle est obligatoire.'
    )
    .max(
      200,
      'Le nom de la mutuelle est trop long.'
    ),

  shortName: z
    .string()
    .trim()
    .max(
      30,
      'Le sigle est trop long.'
    )
    .optional(),

  publicSlug: z
    .string()
    .trim()
    .max(
      80,
      'L’adresse publique est trop longue.'
    )
    .optional(),

  slogan: z
    .string()
    .trim()
    .max(
      250,
      'Le slogan est trop long.'
    )
    .optional(),

  shortDescription: z
    .string()
    .trim()
    .max(
      600,
      'La description courte est trop longue.'
    )
    .optional(),

  about: z
    .string()
    .trim()
    .max(
      10000,
      'La présentation est trop longue.'
    )
    .optional(),

  history: z
    .string()
    .trim()
    .max(
      10000,
      'L’historique est trop long.'
    )
    .optional(),

  mission: z
    .string()
    .trim()
    .max(
      5000,
      'La mission est trop longue.'
    )
    .optional(),

  vision: z
    .string()
    .trim()
    .max(
      5000,
      'La vision est trop longue.'
    )
    .optional(),

  valuesText: z
    .string()
    .trim()
    .max(
      5000,
      'La liste des valeurs est trop longue.'
    )
    .optional(),

  objectives: z
    .string()
    .trim()
    .max(
      10000,
      'Les objectifs sont trop longs.'
    )
    .optional(),

  presidentMessage: z
    .string()
    .trim()
    .max(
      10000,
      'Le message du Président est trop long.'
    )
    .optional(),

  publicPhone: z
    .string()
    .trim()
    .max(
      50,
      'Le numéro de téléphone est trop long.'
    )
    .optional(),

  publicEmail: z
    .string()
    .trim()
    .max(
      200,
      'L’adresse e-mail est trop longue.'
    )
    .optional(),

  locationLabel: z
    .string()
    .trim()
    .max(
      250,
      'La localisation est trop longue.'
    )
    .optional(),
})

// ============================================================
// ACTION
// ============================================================

export async function updateOrganization(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ==========================================================
  // AUTORISATION
  // ==========================================================

  if (
    ![
      'owner',
      'president',
    ].includes(role)
  ) {
    redirect('/dashboard')
  }

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const parsed =
    organizationSchema.safeParse({
      name:
        getString(
          formData,
          'name'
        ),

      shortName:
        getString(
          formData,
          'shortName'
        ),

      publicSlug:
        getString(
          formData,
          'publicSlug'
        ),

      slogan:
        getString(
          formData,
          'slogan'
        ),

      shortDescription:
        getString(
          formData,
          'shortDescription'
        ),

      about:
        getString(
          formData,
          'about'
        ),

      history:
        getString(
          formData,
          'history'
        ),

      mission:
        getString(
          formData,
          'mission'
        ),

      vision:
        getString(
          formData,
          'vision'
        ),

      valuesText:
        getString(
          formData,
          'valuesText'
        ),

      objectives:
        getString(
          formData,
          'objectives'
        ),

      presidentMessage:
        getString(
          formData,
          'presidentMessage'
        ),

      publicPhone:
        getString(
          formData,
          'publicPhone'
        ),

      publicEmail:
        getString(
          formData,
          'publicEmail'
        ),

      locationLabel:
        getString(
          formData,
          'locationLabel'
        ),
    })

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]
        ?.message ??
      'Les informations saisies sont invalides.'

    redirect(
      `/parametres?error=${encodeURIComponent(
        message
      )}`
    )
  }

  // ==========================================================
  // NORMALISATION DU SLUG
  // ==========================================================

  const publicSlug =
    normalizeSlug(
      parsed.data.publicSlug ??
      ''
    )

  if (
    publicSlug &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      publicSlug
    )
  ) {
    redirect(
      `/parametres?error=${encodeURIComponent(
        'L’adresse publique contient des caractères invalides.'
      )}`
    )
  }

  // ==========================================================
  // EMAIL PUBLIC
  // ==========================================================

  const publicEmail =
    emptyToNull(
      parsed.data.publicEmail
    )

  if (
    publicEmail &&
    !z
      .string()
      .email()
      .safeParse(
        publicEmail
      )
      .success
  ) {
    redirect(
      `/parametres?error=${encodeURIComponent(
        'L’adresse e-mail publique est invalide.'
      )}`
    )
  }

  // ==========================================================
  // OPTIONS
  // ==========================================================

  const publicPageEnabled =
    formData.get(
      'publicPageEnabled'
    ) === 'on'

  const onlineMembershipEnabled =
    formData.get(
      'onlineMembershipEnabled'
    ) === 'on'

  const showMemberCount =
    formData.get(
      'showMemberCount'
    ) === 'on'

  const showLeadership =
    formData.get(
      'showLeadership'
    ) === 'on'

  const showProjects =
    formData.get(
      'showProjects'
    ) === 'on'

  const showNews =
    formData.get(
      'showNews'
    ) === 'on'

  // ==========================================================
  // MISE A JOUR ORGANISATION
  // ==========================================================

  const {
    error: organizationError,
  } =
    await supabase
      .from('organizations')
      .update({
        name:
          parsed.data.name,

        short_name:
          emptyToNull(
            parsed.data.shortName
          ),

        public_slug:
          publicSlug ||
          null,

        public_page_enabled:
          publicPageEnabled,

        online_membership_enabled:
          onlineMembershipEnabled,
      })
      .eq(
        'id',
        organizationId
      )

  if (organizationError) {
    console.error(
      'PARAMETRES - update organization:',
      organizationError
    )

    const message =
      organizationError.code ===
      '23505'
        ? 'Cette adresse publique est déjà utilisée par une autre mutuelle.'
        : 'Impossible de modifier les informations générales de la mutuelle.'

    redirect(
      `/parametres?error=${encodeURIComponent(
        message
      )}`
    )
  }

  // ==========================================================
  // PROFIL PUBLIC
  // ==========================================================

  const {
    error: profileError,
  } =
    await supabase
      .from(
        'organization_public_profiles'
      )
      .upsert(
        {
          organization_id:
            organizationId,

          slogan:
            emptyToNull(
              parsed.data.slogan
            ),

          short_description:
            emptyToNull(
              parsed.data
                .shortDescription
            ),

          about:
            emptyToNull(
              parsed.data.about
            ),

          history:
            emptyToNull(
              parsed.data.history
            ),

          mission:
            emptyToNull(
              parsed.data.mission
            ),

          vision:
            emptyToNull(
              parsed.data.vision
            ),

          values_text:
            emptyToNull(
              parsed.data.valuesText
            ),

          objectives:
            emptyToNull(
              parsed.data.objectives
            ),

          president_message:
            emptyToNull(
              parsed.data
                .presidentMessage
            ),

          public_phone:
            emptyToNull(
              parsed.data.publicPhone
            ),

          public_email:
            publicEmail,

          location_label:
            emptyToNull(
              parsed.data
                .locationLabel
            ),

          show_member_count:
            showMemberCount,

          show_leadership:
            showLeadership,

          show_projects:
            showProjects,

          show_news:
            showNews,

          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            'organization_id',
        }
      )

  if (profileError) {
    console.error(
      'PARAMETRES - update public profile:',
      profileError
    )

    redirect(
      `/parametres?error=${encodeURIComponent(
        'Les informations générales ont été modifiées, mais le profil public n’a pas pu être enregistré.'
      )}`
    )
  }

  // ==========================================================
  // RAFRAICHISSEMENT
  // ==========================================================

  revalidatePath(
    '/parametres'
  )

  revalidatePath(
    '/dashboard'
  )

  revalidatePath(
    '/my-space'
  )

  if (publicSlug) {
    revalidatePath(
      `/m/${publicSlug}`
    )
  }

  // ==========================================================
  // REDIRECTION
  // ==========================================================

  redirect(
    '/parametres?success=1'
  )
}

// ============================================================
// UTILITAIRES
// ============================================================

function getString(
  formData: FormData,
  key: string
) {
  const value =
    formData.get(key)

  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value.trim()
}

function emptyToNull(
  value:
    | string
    | null
    | undefined
) {
  const normalized =
    value?.trim()

  return normalized
    ? normalized
    : null
}

function normalizeSlug(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
}