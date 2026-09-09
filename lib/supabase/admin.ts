import 'server-only'

import { createClient } from '@supabase/supabase-js'

// ============================================================
// CLIENT SUPABASE ADMIN
// SERVEUR UNIQUEMENT
// ============================================================

export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const secretKey =
    process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL est manquante.'
    )
  }

  if (!secretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY est manquante.'
    )
  }

  return createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}