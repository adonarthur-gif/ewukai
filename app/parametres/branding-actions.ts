'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

const brandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur principale invalide.'),

  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur secondaire invalide.'),

  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur d'accent invalide."),
})

const allowedMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

const MAX_LOGO_SIZE = 5 * 1024 * 1024

export async function updateOrganizationBranding(
  formData: FormData
) {
  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  if (!['owner', 'president'].includes(role)) {
    redirect('/dashboard')
  }

  const parsed = brandingSchema.safeParse({
    primaryColor: formData.get('primaryColor'),
    secondaryColor: formData.get('secondaryColor'),
    accentColor: formData.get('accentColor'),
  })

  if (!parsed.success) {
    redirect(
      `/parametres?brandingError=${encodeURIComponent(
        parsed.error.issues[0]?.message ??
          'Couleurs invalides.'
      )}`
    )
  }

  // =========================================================
  // ANCIEN LOGO
  // =========================================================

  const { data: currentProfile } = await supabase
    .from('organization_public_profiles')
    .select('logo_path')
    .eq('organization_id', organizationId)
    .maybeSingle()

  let logoPath =
    currentProfile?.logo_path ?? null

  let uploadedLogoPath: string | null = null

  // =========================================================
  // NOUVEAU LOGO
  // =========================================================

  const logo = formData.get('logo')

  if (
    logo instanceof File &&
    logo.size > 0
  ) {
    if (!allowedMimeTypes.includes(logo.type)) {
      redirect(
        `/parametres?brandingError=${encodeURIComponent(
          'Le logo doit être au format PNG, JPG ou WEBP.'
        )}`
      )
    }

    if (logo.size > MAX_LOGO_SIZE) {
      redirect(
        `/parametres?brandingError=${encodeURIComponent(
          'Le logo ne doit pas dépasser 5 Mo.'
        )}`
      )
    }

    const extension =
      getExtensionFromMimeType(logo.type)

    const path =
      `${organizationId}/logo-${Date.now()}.${extension}`

    const arrayBuffer =
      await logo.arrayBuffer()

    const { error: uploadError } =
      await supabase.storage
        .from('organization-branding')
        .upload(
          path,
          arrayBuffer,
          {
            contentType: logo.type,
            upsert: false,
          }
        )

    if (uploadError) {
      console.error(
        'AFRI CLUB - logo upload:',
        uploadError
      )

      redirect(
        `/parametres?brandingError=${encodeURIComponent(
          "Impossible d'importer le logo."
        )}`
      )
    }

    logoPath = path
    uploadedLogoPath = path
  }

  // =========================================================
  // ENREGISTRER IDENTITE VISUELLE
  // =========================================================

  const { error } = await supabase.rpc(
    'update_organization_branding',
    {
      target_organization_id:
        organizationId,

      target_primary_color:
        parsed.data.primaryColor,

      target_secondary_color:
        parsed.data.secondaryColor,

      target_accent_color:
        parsed.data.accentColor,

      target_logo_path:
        logoPath,
    }
  )

  if (error) {
    console.error(
      'AFRI CLUB - update branding:',
      error
    )

    // Supprimer le nouveau fichier si la BDD échoue
    if (uploadedLogoPath) {
      await supabase.storage
        .from('organization-branding')
        .remove([uploadedLogoPath])
    }

    redirect(
      `/parametres?brandingError=${encodeURIComponent(
        "Impossible d'enregistrer l'identité visuelle."
      )}`
    )
  }

  // =========================================================
  // SUPPRIMER ANCIEN LOGO
  // =========================================================

  if (
    uploadedLogoPath &&
    currentProfile?.logo_path &&
    currentProfile.logo_path !== uploadedLogoPath
  ) {
    await supabase.storage
      .from('organization-branding')
      .remove([
        currentProfile.logo_path,
      ])
  }

  revalidatePath('/parametres')
  revalidatePath('/dashboard')
  revalidatePath('/members')
  revalidatePath('/memberships')
  revalidatePath('/cash')
  revalidatePath('/contributions')

  redirect(
    '/parametres?brandingSuccess=1'
  )
}

function getExtensionFromMimeType(
  mimeType: string
) {
  switch (mimeType) {
    case 'image/png':
      return 'png'

    case 'image/webp':
      return 'webp'

    default:
      return 'jpg'
  }
}
