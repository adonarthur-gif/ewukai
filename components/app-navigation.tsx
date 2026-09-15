'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  switchOrganization,
} from '@/app/actions/switch-organization'

// ============================================================
// EWUKAI
// NAVIGATION PRINCIPALE DE L'ESPACE DE GESTION
//
// Fonctionnalités :
// - navigation de l'organisation ;
// - changement d'organisation active ;
// - branding personnalisé ;
// - droits selon le rôle ;
// - accès à l'espace membre ;
// - accès Super-administrateur EWUKAI ;
// - responsive mobile / desktop.
// ============================================================

// ============================================================
// TYPES
// ============================================================

type ManagementOrganizationOption = {
  id: string
  name: string

  shortName:
    | string
    | null

  role:
    | string
    | null
}

type AppNavigationProps = {
  organizationId?:
    | string
    | null

  organizationName?:
    | string
    | null

  organizationShortName?:
    | string
    | null

  role?:
    | string
    | null

  logoUrl?:
    | string
    | null

  primaryColor?:
    | string
    | null

  secondaryColor?:
    | string
    | null

  accentColor?:
    | string
    | null

  memberSpaceOrganizationId?:
    | string
    | null

  managementOrganizations?:
    ManagementOrganizationOption[]

  isPlatformAdmin?:
    boolean
}

// ============================================================
// NAVIGATION
// ============================================================

const navigation = [
  {
    href:
      '/dashboard',

    label:
      'Tableau de bord',
  },

  {
    href:
      '/members',

    label:
      'Membres',
  },

  {
    href:
      '/memberships',

    label:
      'Adhésions',
  },

  {
    href:
      '/cash',

    label:
      'Trésorerie',
  },

  {
    href:
      '/contributions',

    label:
      'Cotisations',
  },

  {
    href:
      '/contributions/calls',

    label:
      'Appels',
  },

  {
    href:
      '/contributions/collection',

    label:
      'Recouvrement',
  },

  {
    href: 
      '/rapports',

    label: 
      'Rapports',
  },

  {
    href:
      '/parametres',

    label:
      'Paramètres',
  },
]

// ============================================================
// COMPOSANT
// ============================================================

export default function AppNavigation({
  organizationId =
    null,

  organizationName =
    null,

  organizationShortName =
    null,

  role =
    null,

  logoUrl =
    null,

  primaryColor =
    '#047857',

  secondaryColor =
    '#0F172A',

  accentColor =
    '#ECFDF5',

  memberSpaceOrganizationId =
    null,

  managementOrganizations =
    [],

  isPlatformAdmin =
    false,
}: AppNavigationProps) {
  const pathname =
    usePathname()

  // ==========================================================
  // ROUTES SUR LESQUELLES LA NAVIGATION DE GESTION
  // NE DOIT PAS APPARAITRE
  // ==========================================================

  const shouldHideNavigation =
    pathname ===
      '/' ||

    // ========================================================
    // PAGES PUBLIQUES EWUKAI
    // Elles ne doivent jamais afficher la navigation
    // d'une organisation, même si l'utilisateur est connecté.
    // ========================================================

    pathname ===
      '/about' ||

    pathname.startsWith(
      '/about/'
    ) ||

    pathname ===
      '/contact' ||

    pathname.startsWith(
      '/contact/'
    ) ||

    pathname ===
      '/privacy' ||

    pathname.startsWith(
      '/privacy/'
    ) ||

    // ========================================================
    // AUTHENTIFICATION / INSCRIPTION
    // ========================================================

    pathname ===
      '/login' ||

    pathname.startsWith(
      '/login/'
    ) ||

    pathname ===
      '/register' ||

    pathname.startsWith(
      '/register/'
    ) ||

    pathname ===
      '/confirm' ||

    pathname.startsWith(
      '/confirm/'
    ) ||

    pathname ===
      '/onboarding' ||

    pathname.startsWith(
      '/onboarding/'
    ) ||

    pathname ===
      '/signout' ||

    // ========================================================
    // ESPACE MEMBRE ET PAGES PUBLIQUES DES ORGANISATIONS
    // ========================================================

    pathname.startsWith(
      '/my-space'
    ) ||

    pathname.startsWith(
      '/m/'
    ) ||

    pathname.startsWith(
      '/activate/'
    ) ||

    pathname.startsWith(
      '/inscription/'
    ) ||

    // ========================================================
    // IMPORTANT :
    // L'administration plateforme possède sa propre navigation.
    // ========================================================

    pathname.startsWith(
      '/admin'
    )

  if (
    shouldHideNavigation
  ) {
    return null
  }

  // ==========================================================
  // BRANDING
  // ==========================================================

  const primary =
    safeColor(
      primaryColor,
      '#047857'
    )

  const secondary =
    safeColor(
      secondaryColor,
      '#0F172A'
    )

  const accent =
    safeColor(
      accentColor,
      '#ECFDF5'
    )

  // ==========================================================
  // ORGANISATION
  // ==========================================================

  const organizationLabel =
    organizationShortName ||
    organizationName ||
    null

  const hasMultipleOrganizations = false

  // ==========================================================
  // PERMISSIONS
  // ==========================================================

  const canCreateMember =
    [
      'owner',
      'president',
      'secretary',
    ].includes(
      role ?? ''
    )

  const canViewSettings =
    [
      'owner',
      'president',
    ].includes(
      role ?? ''
    )

  // ==========================================================
  // ESPACE MEMBRE
  // ==========================================================

  const memberSpaceHref =
    memberSpaceOrganizationId
      ? `/my-space?organization=${encodeURIComponent(
          memberSpaceOrganizationId
        )}`
      : null

  // ==========================================================
  // ELEMENTS DU MENU VISIBLES
  // ==========================================================

  const visibleNavigation =
    navigation.filter(
      (
        item
      ) => {
        if (
          item.href ===
            '/parametres' &&
          !canViewSettings
        ) {
          return false
        }

        return true
      }
    )

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">

      {/* ==================================================== */}
      {/* IDENTITE + ACTIONS */}
      {/* ==================================================== */}

      <div className="border-b border-slate-100">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">

          {/* ================================================== */}
          {/* PARTIE GAUCHE */}
          {/* ================================================== */}

          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
{/* ================================================ */}
            {/* LOGO */}
            {/* ================================================ */}

            {organizationLabel && (
              <>
                {logoUrl ? (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:h-12 sm:w-12">

                    <img
                      src={
                        logoUrl
                      }
                      alt={`Logo ${organizationLabel}`}
                      className="h-full w-full object-contain"
                    />

                  </div>
                ) : (
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm sm:h-12 sm:w-12"
                    style={{
                      backgroundColor:
                        primary,
                    }}
                  >
                    {getInitials(
                      organizationLabel
                    )}
                  </div>
                )}
              </>
            )}

            {/* ================================================ */}
            {/* ORGANISATION ACTIVE */}
            {/* ================================================ */}

            {organizationLabel && (
              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  {/* ========================================== */}
                  {/* SELECTEUR MULTI-ORGANISATION */}
                  {/* ========================================== */}

                  {hasMultipleOrganizations ? (
                    <form
                      action={
                        switchOrganization
                      }
                      className="min-w-0"
                    >
                      <input
                        type="hidden"
                        name="returnTo"
                        value={
                          pathname
                        }
                      />

                      <label
                        htmlFor="organizationId"
                        className="sr-only"
                      >
                        Organisation active
                      </label>

                      <select
                        id="organizationId"
                        name="organizationId"
                        defaultValue={
                          organizationId ??
                          ''
                        }
                        onChange={(
                          event
                        ) => {
                          event
                            .currentTarget
                            .form
                            ?.requestSubmit()
                        }}
                        className="max-w-[170px] cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none transition hover:border-slate-300 focus:border-slate-400 sm:max-w-[230px]"
                        style={{
                          color:
                            secondary,
                        }}
                      >
                        {managementOrganizations.map(
                          (
                            organization
                          ) => (
                            <option
                              key={
                                organization.id
                              }
                              value={
                                organization.id
                              }
                            >
                              {organization.shortName ||
                                organization.name}
                            </option>
                          )
                        )}
                      </select>

                    </form>
                  ) : (
                    <p
                      className="max-w-[150px] truncate text-base font-black sm:max-w-[220px]"
                      style={{
                        color:
                          secondary,
                      }}
                    >
                      {
                        organizationLabel
                      }
                    </p>
                  )}

                  {/* ========================================== */}
                  {/* ROLE */}
                  {/* ========================================== */}

                  {role && (
                    <span
                      className="hidden rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide sm:inline-flex"
                      style={{
                        backgroundColor:
                          accent,

                        color:
                          primary,
                      }}
                    >
                      {formatRole(
                        role
                      )}
                    </span>
                  )}

                </div>

                {/* ============================================ */}
                {/* NOM COMPLET */}
                {/* ============================================ */}

                {organizationName &&
                  organizationShortName &&
                  organizationName !==
                    organizationShortName && (
                    <p className="mt-0.5 hidden max-w-[340px] truncate text-[10px] font-medium text-slate-400 lg:block">
                      {
                        organizationName
                      }
                    </p>
                  )}

              </div>
            )}

          </div>

          {/* ================================================== */}
          {/* ACTIONS DESKTOP */}
          {/* ================================================== */}

          <div className="flex shrink-0 items-center gap-2">

            {/* ================================================ */}
            {/* SUPER ADMIN EWUKAI */}
            {/* ================================================ */}

            {isPlatformAdmin && (
              <Link
                href="/admin/dashboard"
                className="hidden items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 xl:inline-flex"
              >
                <span
                  aria-hidden="true"
                >
                  ⚙
                </span>

                <span>
                  Administration EWUKAI
                </span>
              </Link>
            )}

            {/* ================================================ */}
            {/* ESPACE MEMBRE */}
            {/* ================================================ */}

            {memberSpaceHref && (
              <Link
                href={
                  memberSpaceHref
                }
                className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 lg:inline-flex"
              >
                <span
                  aria-hidden="true"
                >
                  👤
                </span>

                <span>
                  Mon espace membre
                </span>
              </Link>
            )}

            {/* ================================================ */}
            {/* NOUVEAU MEMBRE */}
            {/* ================================================ */}

            {canCreateMember && (
              <Link
                href="/members/new"
                className="hidden rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:opacity-90 md:inline-flex"
                style={{
                  backgroundColor:
                    primary,
                }}
              >
                + Nouveau membre
              </Link>
            )}

            {/* ================================================ */}
            {/* DECONNEXION */}
            {/* ================================================ */}

            <form
              action="/signout"
              method="post"
            >
              <button
                type="submit"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <span className="hidden sm:inline">
                  Déconnexion
                </span>

                <span className="sm:hidden">
                  Sortir
                </span>
              </button>
            </form>

          </div>

        </div>

      </div>

      {/* ==================================================== */}
      {/* ROLE MOBILE */}
      {/* ==================================================== */}

      {role && (
        <div className="border-b border-slate-100 px-4 py-1.5 sm:hidden">

          <span
            className="inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide"
            style={{
              backgroundColor:
                accent,

              color:
                primary,
            }}
          >
            {formatRole(
              role
            )}
          </span>

        </div>
      )}

      {/* ==================================================== */}
      {/* NAVIGATION PRINCIPALE */}
      {/* ==================================================== */}

      <div className="bg-white">

        <div className="mx-auto max-w-7xl px-2 sm:px-6">

          <nav
            className="flex gap-1 overflow-x-auto py-2"
            aria-label="Navigation principale"
          >

            {visibleNavigation.map(
              (
                item
              ) => {
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
                    className="shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-bold transition sm:px-4"
                    style={
                      active
                        ? {
                            backgroundColor:
                              accent,

                            color:
                              primary,
                          }
                        : {
                            color:
                              '#475569',
                          }
                    }
                  >
                    {
                      item.label
                    }
                  </Link>
                )
              }
            )}

          </nav>

        </div>

      </div>

      {/* ==================================================== */}
      {/* ACTIONS MOBILE / TABLETTE */}
      {/* ==================================================== */}

      {(
        isPlatformAdmin ||
        memberSpaceHref ||
        canCreateMember
      ) && (
        <div
          className="border-t border-slate-100 xl:hidden"
          style={{
            backgroundColor:
              accent,
          }}
        >

          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 px-4 py-2 sm:px-6">

            {/* ================================================ */}
            {/* ADMIN MOBILE */}
            {/* ================================================ */}

            {isPlatformAdmin && (
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm"
              >
                <span
                  aria-hidden="true"
                >
                  ⚙
                </span>

                Admin EWUKAI
              </Link>
            )}

            {/* ================================================ */}
            {/* ESPACE MEMBRE MOBILE */}
            {/* ================================================ */}

            {memberSpaceHref && (
              <Link
                href={
                  memberSpaceHref
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm"
              >
                <span
                  aria-hidden="true"
                >
                  👤
                </span>

                Espace membre
              </Link>
            )}

            {/* ================================================ */}
            {/* NOUVEAU MEMBRE MOBILE */}
            {/* ================================================ */}

            {canCreateMember && (
              <Link
                href="/members/new"
                className="rounded-lg px-3 py-2 text-xs font-black text-white shadow-sm"
                style={{
                  backgroundColor:
                    primary,
                }}
              >
                + Nouveau membre
              </Link>
            )}

          </div>

        </div>
      )}

    </header>
  )
}

// ============================================================
// ROUTE ACTIVE
// ============================================================

function isActiveRoute(
  pathname: string,
  href: string
) {
  // ==========================================================
  // DASHBOARD
  // ==========================================================

  if (
    href ===
    '/dashboard'
  ) {
    return (
      pathname ===
      '/dashboard'
    )
  }

  // ==========================================================
  // MEMBRES
  // ==========================================================

  if (
    href ===
    '/members'
  ) {
    return (
      pathname ===
        '/members' ||
      pathname.startsWith(
        '/members/'
      )
    )
  }

  // ==========================================================
  // ADHESIONS
  // ==========================================================

  if (
    href ===
    '/memberships'
  ) {
    return (
      pathname ===
        '/memberships' ||
      pathname.startsWith(
        '/memberships/'
      )
    )
  }

  // ==========================================================
  // TRESORERIE
  // ==========================================================

  if (
    href ===
    '/cash'
  ) {
    return (
      pathname ===
        '/cash' ||
      pathname.startsWith(
        '/cash/'
      )
    )
  }

  // ==========================================================
  // COTISATIONS
  //
  // Attention :
  // /contributions/calls et /collection ont leurs propres menus.
  // ==========================================================

  if (
    href ===
    '/contributions'
  ) {
    return (
      pathname ===
        '/contributions' ||
      pathname ===
        '/contributions/new'
    )
  }

  // ==========================================================
  // APPELS
  // ==========================================================

  if (
    href ===
    '/contributions/calls'
  ) {
    return (
      pathname ===
        '/contributions/calls' ||
      pathname.startsWith(
        '/contributions/calls/'
      )
    )
  }

  // ==========================================================
  // RECOUVREMENT
  // ==========================================================

  if (
    href ===
    '/contributions/collection'
  ) {
    return (
      pathname ===
        '/contributions/collection' ||
      pathname.startsWith(
        '/contributions/collection/'
      )
    )
  }

  // ==========================================================
  // PARAMETRES
  // ==========================================================

  if (
    href ===
    '/parametres'
  ) {
    return (
      pathname ===
        '/parametres' ||
      pathname.startsWith(
        '/parametres/'
      )
    )
  }

  return (
    pathname ===
    href
  )
}

// ============================================================
// INITIALLES
// ============================================================

function getInitials(
  value: string
) {
  const words =
    value
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      )

  if (
    words.length ===
    0
  ) {
    return 'OR'
  }

  if (
    words.length ===
    1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase()
  }

  return words
    .slice(
      0,
      2
    )
    .map(
      (
        word
      ) =>
        word.charAt(
          0
        )
    )
    .join(
      ''
    )
    .toUpperCase()
}

// ============================================================
// LIBELLE ROLE
// ============================================================

function formatRole(
  role: string
) {
  switch (
    role
  ) {
    case 'owner':
      return 'Responsable'

    case 'president':
      return 'Président'

    case 'treasurer':
      return 'Trésorier'

    case 'secretary':
      return 'Secrétaire'

    case 'auditor':
      return 'Auditeur'

    case 'member':
      return 'Membre'

    default:
      return role
        .replace(
          /_/g,
          ' '
        )
        .toUpperCase()
  }
}

// ============================================================
// COULEURS
// ============================================================

function safeColor(
  value:
    | string
    | null
    | undefined,

  fallback:
    string
) {
  if (
    value &&
    /^#[0-9A-Fa-f]{6}$/.test(
      value
    )
  ) {
    return value
  }

  return fallback
}