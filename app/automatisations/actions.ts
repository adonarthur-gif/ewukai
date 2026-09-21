'use server'

import {
  revalidatePath,
} from 'next/cache'

import {
  redirect,
} from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  requireOrganizationFeatureAccess,
} from '@/lib/subscriptions/feature-access'

const MANAGER_ROLES = [
  'owner',
  'president',
  'treasurer',
] as const

export async function saveAutomationSettings(
  formData: FormData
) {
  const context =
    await requireCurrentOrganization()

  const {
    supabase,
    organizationId,
    role,
  } = context

  await requireOrganizationFeatureAccess(
    context,
    'automation'
  )

  if (
    !MANAGER_ROLES.includes(
      role as (typeof MANAGER_ROLES)[number]
    )
  ) {
    redirect(
      automationErrorUrl(
        "Vous n'avez pas l'autorisation de modifier les automatisations."
      )
    )
  }

  const enabled =
    formData.get('enabled') ===
    'on'

  const remindOnDueDate =
    formData.get(
      'remindOnDueDate'
    ) === 'on'

  const beforeDays =
    normalizeDays(
      formData.getAll(
        'beforeDays'
      )
    )

  const afterDays =
    normalizeDays(
      formData.getAll(
        'afterDays'
      )
    )

  const {
    error,
  } =
    await supabase.rpc(
      'save_organization_automation_settings',
      {
        target_organization_id:
          organizationId,

        target_enabled:
          enabled,

        target_remind_before_days:
          beforeDays,

        target_remind_on_due_date:
          remindOnDueDate,

        target_remind_after_days:
          afterDays,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - AUTOMATION SETTINGS:',
      {
        organizationId,
        code: error.code,
        message: error.message,
        details: error.details,
      }
    )

    redirect(
      automationErrorUrl(
        friendlyAutomationError(
          error.message
        )
      )
    )
  }

  revalidatePath(
    '/automatisations'
  )

  redirect(
    '/automatisations?saved=1'
  )
}

export async function runAutomationNow() {
  const context =
    await requireCurrentOrganization()

  const {
    supabase,
    organizationId,
    role,
  } = context

  await requireOrganizationFeatureAccess(
    context,
    'automation'
  )

  if (
    !MANAGER_ROLES.includes(
      role as (typeof MANAGER_ROLES)[number]
    )
  ) {
    redirect(
      automationErrorUrl(
        "Vous n'avez pas l'autorisation d'exÃ©cuter les automatisations."
      )
    )
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'generate_organization_automation_reminders',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - AUTOMATION RUN:',
      {
        organizationId,
        code: error.code,
        message: error.message,
        details: error.details,
      }
    )

    redirect(
      automationErrorUrl(
        friendlyAutomationError(
          error.message
        )
      )
    )
  }

  const result =
    data &&
    typeof data === 'object'
      ? data as {
          generated_count?:
            | number
            | string
            | null
        }
      : null

  const generatedCount =
    Math.max(
      0,
      Number(
        result?.generated_count ??
        0
      ) || 0
    )

  revalidatePath(
    '/automatisations'
  )

  redirect(
    `/automatisations?run=1&generated=${generatedCount}`
  )
}

function normalizeDays(
  values: FormDataEntryValue[]
) {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            Number(
              String(value)
            )
        )
        .filter(
          (value) =>
            Number.isInteger(
              value
            ) &&
            value > 0 &&
            value <= 90
        )
    )
  ).sort(
    (a, b) =>
      a - b
  )
}

function automationErrorUrl(
  message: string
) {
  const query =
    new URLSearchParams({
      error: message,
    })

  return `/automatisations?${query.toString()}`
}

function friendlyAutomationError(
  message: string
) {
  const normalized =
    message
      .trim()
      .toLowerCase()

  if (
    normalized.includes(
      'feature not available'
    )
  ) {
    return 'Cette fonctionnalitÃ© nÃ©cessite la formule Pro ou Entreprise.'
  }

  if (
    normalized.includes(
      'not authorized'
    )
  ) {
    return "Vous n'avez pas l'autorisation d'effectuer cette opÃ©ration."
  }

  return "L'opÃ©ration d'automatisation n'a pas pu Ãªtre effectuÃ©e."
}