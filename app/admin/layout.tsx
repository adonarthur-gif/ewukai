import type {
  ReactNode,
} from 'react'

import AdminNavigation from '@/components/admin/admin-navigation'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// LAYOUT ADMIN
// ============================================================

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  // ==========================================================
  // SECURITE
  // ==========================================================

  await requirePlatformSuperAdmin()

  return (
    <div className="min-h-screen bg-slate-50">

      <AdminNavigation />

      {children}

    </div>
  )
}