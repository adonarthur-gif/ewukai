'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// EWUKAI
// SUPER ADMIN - GESTION DES ORGANISATIONS
// ============================================================

const organizationIdSchema =
  z.string().uuid()

const organizationStatusSchema =
  z.enum([
    'active',
    'inactive',
  ])

function safeReturnTo(
  value: FormDataEntryValue | null,
  organizationId: string
) {
  const raw =
    typeof value ===
    'string'
      ? value.trim()
      : ''

  if (
    raw.startsWith(
      '/admin/organizations'
    ) &&
    !raw.startsWith('//')
  ) {
    return raw
  }

  return `/admin/organizations/${organizationId}`
}

function appendQuery(
  url: string,
  key: string,
  value: string
) {
  const separator =
    url.includes('?')
      ? '&'
      : '?'

  return `${url}${separator}${key}=${encodeURIComponent(
    value
  )}`
}

function getOrganizationErrorMessage(
  message:
    | string
    | null
    | undefined
) {
  const normalized =
    message
      ?.trim()
      .toLowerCase() ??
    ''

  if (
    normalized.includes(
      'organization must be inactive'
    )
  ) {
    return 'L’organisation doit d’abord être désactivée avant toute suppression définitive.'
  }

  if (
    normalized.includes(
      'organization has billing history'
    )
  ) {
    return 'Cette organisation possède déjà un historique de facturation. La suppression définitive est bloquée ; conservez-la désactivée.'
  }

  if (
    normalized.includes(
      'organization has related data'
    )
  ) {
    return 'Cette organisation contient déjà des données. Elle ne peut pas être supprimée définitivement ; désactivez-la afin de préserver l’historique.'
  }

  if (
    normalized.includes(
      'platform super administrator required'
    )
  ) {
    return 'Cette action est réservée au Super-administrateur EWUKAI.'
  }

  if (
    normalized.includes(
      'organization not found'
    )
  ) {
    return 'Organisation introuvable.'
  }

  return 'L’opération n’a pas pu être effectuée.'
}

// ============================================================
// ACTIVER / DESACTIVER
// ============================================================

export async function setOrganizationStatus(
  formData: FormData
) {
  const idResult =
    organizationIdSchema.safeParse(
      formData.get(
        'organizationId'
      )
    )

  const statusResult =
    organizationStatusSchema.safeParse(
      formData.get(
        'nextStatus'
      )
    )

  if (
    !idResult.success ||
    !statusResult.success
  ) {
    redirect(
      '/admin/organizations'
    )
  }

  const organizationId =
    idResult.data

  const nextStatus =
    statusResult.data

  const returnTo =
    safeReturnTo(
      formData.get(
        'returnTo'
      ),
      organizationId
    )

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const {
    error,
  } =
    await supabase.rpc(
      'set_platform_organization_status',
      {
        target_organization_id:
          organizationId,

        target_status:
          nextStatus,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - set organization status:',
      error
    )

    redirect(
      appendQuery(
        returnTo,
        'error',
        getOrganizationErrorMessage(
          error.message
        )
      )
    )
  }

  revalidatePath(
    '/admin/organizations'
  )
  revalidatePath(
    `/admin/organizations/${organizationId}`
  )
  revalidatePath(
    '/admin/dashboard'
  )

  redirect(
    appendQuery(
      returnTo,
      'statusUpdated',
      nextStatus
    )
  )
}

// ============================================================
// SUPPRESSION DEFINITIVE SECURISEE
// ============================================================

export async function deleteOrganization(
  formData: FormData
) {
  const idResult =
    organizationIdSchema.safeParse(
      formData.get(
        'organizationId'
      )
    )

  if (
    !idResult.success
  ) {
    redirect(
      '/admin/organizations'
    )
  }

  const organizationId =
    idResult.data

  const confirmation =
    String(
      formData.get(
        'confirmation'
      ) ?? ''
    )
      .trim()
      .toUpperCase()

  if (
    confirmation !==
    'SUPPRIMER'
  ) {
    redirect(
      `/admin/organizations/${organizationId}?error=${encodeURIComponent(
        'Saisissez SUPPRIMER pour confirmer la suppression définitive.'
      )}`
    )
  }

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const {
    error,
  } =
    await supabase.rpc(
      'delete_platform_organization_if_safe',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - delete organization:',
      error
    )

    redirect(
      `/admin/organizations/${organizationId}?error=${encodeURIComponent(
        getOrganizationErrorMessage(
          error.message
        )
      )}`
    )
  }

  revalidatePath(
    '/admin/organizations'
  )
  revalidatePath(
    '/admin/dashboard'
  )
  revalidatePath(
    '/admin/subscriptions'
  )

  redirect(
    '/admin/organizations?deleted=1'
  )
}
