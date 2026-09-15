'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ============================================================
// EWUKAI
// NAVIGATION ADMINISTRATION PLATEFORME
// ============================================================

const navigationItems = [
  {
    label: 'Tableau de bord',
    href: '/admin/dashboard',
  },
  {
    label: 'Organisations',
    href: '/admin/organizations',
  },
  {
    label: 'Utilisateurs',
    href: '/admin/users',
  },
  {
    label: 'Plans',
    href: '/admin/plans',
  },
  {
    label: 'Abonnements',
    href: '/admin/subscriptions',
  },
  {
    label: 'Facturation',
    href: '/admin/billing',
  },
  {
    label: 'Activité',
    href: '/admin/activity',
  },
  {
    label: 'Paramètres',
    href: '/admin/settings',
  },
]

// ============================================================
// COMPONENT
// ============================================================

export default function AdminNavigation() {
  const pathname =
    usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020817] text-white shadow-xl">

      {/* ==================================================== */}
      {/* PARTIE HAUTE */}
      {/* ==================================================== */}

      <div className="border-b border-white/10">

        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">

          {/* ================================================= */}
          {/* MARQUE */}
          {/* ================================================= */}

          <Link
            href="/admin/dashboard"
            className="flex min-w-0 items-center gap-3"
          >

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/20">
              <Image
                src="/branding/ewukai-mark.png"
                alt="Symbole EWUKAI"
                width={48}
                height={48}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0">

              <p className="truncate text-lg font-black tracking-tight text-white">
                EWUKAI
              </p>

              <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
                Administration plateforme
              </p>

            </div>

          </Link>

          {/* ================================================= */}
          {/* ACTIONS */}
          {/* ================================================= */}

          <div className="flex flex-wrap items-center gap-2">

            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-300">
              Super administrateur
            </span>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-black text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              Retour à la gestion
            </Link>

            <form
              action="/signout"
              method="post"
            >
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-black text-slate-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
              >
                Déconnexion
              </button>
            </form>

          </div>

        </div>

      </div>

      {/* ==================================================== */}
      {/* NAVIGATION */}
      {/* ==================================================== */}

      <nav
        aria-label="Administration EWUKAI"
        className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8"
      >

        <div className="flex min-w-max items-center gap-1 py-2">

          {navigationItems.map(
            item => {
              const active =
                isActiveRoute(
                  pathname,
                  item.href
                )

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className={
                    active
                      ? 'relative rounded-lg bg-white/10 px-4 py-3 text-sm font-black text-white'
                      : 'relative rounded-lg px-4 py-3 text-sm font-black text-slate-300 transition hover:bg-white/[0.06] hover:text-white'
                  }
                >
                  {
                    item.label
                  }

                  {active && (
                    <span className="absolute inset-x-4 -bottom-2 h-0.5 rounded-full bg-emerald-400" />
                  )}

                </Link>
              )
            }
          )}

        </div>

      </nav>

    </header>
  )
}

// ============================================================
// HELPERS
// ============================================================

function isActiveRoute(
  pathname: string,
  href: string
) {
  if (
    pathname === href
  ) {
    return true
  }

  if (
    href === '/admin/dashboard'
  ) {
    return false
  }

  return pathname.startsWith(
    `${href}/`
  )
}