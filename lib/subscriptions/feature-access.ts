import 'server-only'

import { redirect } from 'next/navigation'

import type {
  CurrentOrganization,
} from '@/lib/auth/current-organization'

export type OrganizationFeatureKey =
  | 'basic_dashboard'
  | 'members'
  | 'contributions'
  | 'receipts'
  | 'treasury'
  | 'automation'
  | 'advanced_reports'
  | 'priority_support'
  | 'custom_integrations'

type OrganizationFeatureContext =
  Pick<
    CurrentOrganization,
    'supabase' | 'organizationId'
  >

export async function hasOrganizationFeatureAccess(
  context: OrganizationFeatureContext,
  feature: OrganizationFeatureKey
) {
  const {
    data,
    error,
  } =
    await context.supabase.rpc(
      'organization_has_feature',
      {
        target_organization_id:
          context.organizationId,
        target_feature_key:
          feature,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - FEATURE ACCESS:',
      {
        organizationId:
          context.organizationId,
        feature,
        error,
      }
    )

    throw new Error(
      "Impossible de vérifier les droits de l'organisation."
    )
  }

  return data === true
}

export async function requireOrganizationFeatureAccess(
  context: OrganizationFeatureContext,
  feature: OrganizationFeatureKey
) {
  const allowed =
    await hasOrganizationFeatureAccess(
      context,
      feature
    )

  if (allowed) {
    return
  }

  redirect(
    `/parametres/abonnement?feature=${encodeURIComponent(
      feature
    )}`
  )
}
