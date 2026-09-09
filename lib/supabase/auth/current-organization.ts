import 'server-only'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type OrganizationRole =
  | 'owner'
  | 'president'
  | 'treasurer'
  | 'secretary'
  | 'auditor'
  | 'member'

export async function requireCurrentOrganization() {
  const supabase = await createClient()

  const { data: authData, error: authError } =
    await supabase.auth.getClaims()

  const userId = authData?.claims?.sub

  if (authError || !userId) {
    redirect('/login')
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from('organization_users')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', {
        ascending: true,
      })
      .limit(1)
      .maybeSingle()

  if (membershipError) {
    throw new Error(
      'Impossible de récupérer la mutuelle active.'
    )
  }

  if (!membership) {
    redirect('/onboarding')
  }

  return {
    supabase,
    userId,
    organizationId: membership.organization_id,
    role: membership.role as OrganizationRole,
  }
}