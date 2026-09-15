import Link from 'next/link'
import type {
  ReactNode,
} from 'react'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// EWUKAI
// ADMINISTRATION PLATEFORME
// UTILISATEURS
//
// Fonctionnalités :
// - liste globale des comptes EWUKAI ;
// - recherche ;
// - rôles de gestion distincts des dossiers membres ;
// - identification Super-admin ;
// - nom utilisateur avec repli côté SQL sur la fiche membre ;
// - organisations et rôles plus lisibles ;
// - accès à la fiche détaillée /admin/users/[id] ;
// - lecture seule.
// ============================================================

// ============================================================
// TYPES
// ============================================================

type PageProps = {
  searchParams: Promise<{
    q?: string
  }>
}

type OrganizationRoleInfo = {
  organization_id: string
  organization_name: string

  organization_short_name:
    | string
    | null

  role: string
}

type PlatformUserRow = {
  user_id: string

  full_name:
    | string
    | null

  email:
    | string
    | null

  phone:
    | string
    | null

  created_at:
    | string
    | null

  last_sign_in_at:
    | string
    | null

  organization_count:
    number | string | null

  management_organization_count:
    number | string | null

  member_space_count:
    number | string | null

  is_platform_admin:
    boolean | null

  platform_admin_role:
    | string
    | null

  organization_roles:
    unknown

  total_count:
    number | string | null
}

type NormalizedUser = {
  id: string

  name:
    | string
    | null

  email:
    | string
    | null

  phone:
    | string
    | null

  createdAt:
    | string
    | null

  lastSignInAt:
    | string
    | null

  organizationCount: number

  managementOrganizationCount: number

  memberSpaceCount: number

  isPlatformAdmin: boolean

  platformAdminRole:
    | string
    | null

  organizationRoles:
    OrganizationRoleInfo[]

  totalCount: number
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminUsersPage({
  searchParams,
}: PageProps) {
  // ==========================================================
  // PARAMETRES
  // ==========================================================

  const params =
    await searchParams

  const search =
    params.q
      ?.trim()
      .slice(
        0,
        120
      ) ??
    ''

  // ==========================================================
  // SUPER ADMIN
  // ==========================================================

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  // ==========================================================
  // UTILISATEURS
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'list_platform_users',
      {
        search_text:
          search ||
          null,

        limit_count:
          100,

        offset_count:
          0,
      }
    )

  if (
    error
  ) {
    console.error(
      'EWUKAI - admin users:',
      error
    )
  }

  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const users =
    (
      Array.isArray(
        data
      )
        ? data
        : []
    )
      .map(
        normalizeUser
      )
      .filter(
        (
          user
        ): user is NormalizedUser =>
          user !==
          null
      )

  // ==========================================================
  // STATISTIQUES
  // ==========================================================

  const totalUsers =
    users[0]
      ?.totalCount ??
    0

  const platformAdmins =
    users.filter(
      (
        user
      ) =>
        user.isPlatformAdmin
    ).length

  const usersWithManagement =
    users.filter(
      (
        user
      ) =>
        user.managementOrganizationCount >
        0
    ).length

  const usersWithMemberSpace =
    users.filter(
      (
        user
      ) =>
        user.memberSpaceCount >
        0
    ).length

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ==================================================== */}
      {/* HERO */}
      {/* ==================================================== */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Administration EWUKAI
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Utilisateurs
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Consultez les comptes utilisateurs,
                leurs rôles de gestion et leurs
                espaces membres sur la plateforme.
              </p>

            </div>

            <Link
              href="/admin/dashboard"
              className="inline-flex w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ← Tableau de bord
            </Link>

          </div>

        </div>

      </section>

      {/* ==================================================== */}
      {/* CONTENU */}
      {/* ==================================================== */}

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">

        {/* ================================================== */}
        {/* KPI */}
        {/* ================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            label="Utilisateurs"
            value={
              formatNumber(
                totalUsers
              )
            }
            note={
              search
                ? 'Comptes correspondant à la recherche'
                : 'Comptes enregistrés sur la plateforme'
            }
          />

          <StatCard
            label="Dirigeants"
            value={
              formatNumber(
                usersWithManagement
              )
            }
            note="Au moins un rôle de gestion"
          />

          <StatCard
            label="Espaces membres"
            value={
              formatNumber(
                usersWithMemberSpace
              )
            }
            note="Comptes liés à un membre actif"
          />

          <StatCard
            label="Super-admins"
            value={
              formatNumber(
                platformAdmins
              )
            }
            note="Dans les résultats affichés"
          />

        </section>

        {/* ================================================== */}
        {/* RECHERCHE */}
        {/* ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <form
            action="/admin/users"
            method="get"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >

            <div className="flex-1">

              <label
                htmlFor="q"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Rechercher un utilisateur
              </label>

              <input
                id="q"
                name="q"
                type="search"
                defaultValue={
                  search
                }
                autoComplete="off"
                placeholder="Nom, email, téléphone ou organisation..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />

            </div>

            <button
              type="submit"
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Rechercher
            </button>

            {search && (
              <Link
                href="/admin/users"
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                Effacer
              </Link>
            )}

          </form>

          {search && (
            <p className="mt-4 text-sm text-slate-500">

              Résultats pour{' '}

              <span className="font-black text-slate-800">
                « {search} »
              </span>

              {' — '}

              {formatNumber(
                totalUsers
              )}{' '}
              utilisateur(s)

            </p>
          )}

        </section>

        {/* ================================================== */}
        {/* ERREUR */}
        {/* ================================================== */}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Impossible de charger les utilisateurs.
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              Vérifiez la fonction
              list_platform_users dans Supabase.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* LISTE */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* HEADER */}

          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-lg font-black text-slate-950">
                Comptes utilisateurs
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Les rôles organisationnels et les
                espaces membres sont affichés
                séparément.
              </p>

            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {formatNumber(
                users.length
              )}{' '}
              affiché(s)
            </span>

          </div>

          {/* ================================================= */}
          {/* VIDE */}
          {/* ================================================= */}

          {!error &&
            users.length ===
              0 && (
              <div className="px-6 py-16 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  👤
                </div>

                <p className="mt-4 font-black text-slate-800">
                  {search
                    ? 'Aucun utilisateur trouvé'
                    : 'Aucun compte utilisateur'}
                </p>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {search
                    ? 'Essayez un autre nom, une autre adresse e-mail ou une autre organisation.'
                    : 'Les comptes utilisateurs apparaîtront ici après leur inscription.'}
                </p>

                {search && (
                  <Link
                    href="/admin/users"
                    className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
                  >
                    Afficher tous les utilisateurs
                  </Link>
                )}

              </div>
            )}

          {/* ================================================= */}
          {/* DESKTOP */}
          {/* ================================================= */}

          {users.length >
            0 && (
            <>

              <div className="hidden overflow-x-auto lg:block">

                <table className="w-full table-fixed border-collapse">

                  <thead className="bg-slate-50">

                    <tr>

                      <TableHeading>
                        Utilisateur
                      </TableHeading>

                      <TableHeading>
                        Accès
                      </TableHeading>

                      <TableHeading>
                        Organisations
                      </TableHeading>

                      <TableHeading align="right">
                        Espaces membre
                      </TableHeading>

                      <TableHeading>
                        Activité
                      </TableHeading>

                      <TableHeading align="right">
                        Action
                      </TableHeading>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {users.map(
                      (
                        user
                      ) => (
                        <tr
                          key={
                            user.id
                          }
                          className="align-top transition hover:bg-slate-50/80"
                        >

                          {/* ================================= */}
                          {/* UTILISATEUR */}
                          {/* ================================= */}

                          <td className="px-4 py-5">

                            <div className="flex items-start gap-3">

                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">

                                {getInitials(
                                  user.name ||
                                    user.email ||
                                    'Utilisateur'
                                )}

                              </div>

                              <div className="min-w-0">

                                <Link
                                  href={`/admin/users/${user.id}`}
                                  className="block max-w-[260px] truncate font-black text-slate-900 transition hover:text-emerald-700 hover:underline"
                                >
                                  {user.name ||
                                    'Nom non renseigné'}
                                </Link>

                                <p className="mt-1 max-w-[280px] truncate text-xs font-semibold text-slate-500">
                                  {user.email ||
                                    'Email non disponible'}
                                </p>

                                {user.phone && (
                                  <p className="mt-1 text-xs text-slate-400">
                                    {
                                      user.phone
                                    }
                                  </p>
                                )}

                              </div>

                            </div>

                          </td>

                          {/* ================================= */}
                          {/* ACCES */}
                          {/* ================================= */}

                          <td className="px-4 py-5">

                            <div className="flex max-w-[190px] flex-wrap gap-1.5">

                              {user.isPlatformAdmin && (
                                <Badge
                                  variant="admin"
                                >
                                  Super-admin
                                </Badge>
                              )}

                              {user.managementOrganizationCount >
                                0 && (
                                <Badge
                                  variant="management"
                                >
                                  Gestion
                                </Badge>
                              )}

                              {user.memberSpaceCount >
                                0 && (
                                <Badge
                                  variant="member"
                                >
                                  Membre
                                </Badge>
                              )}

                              {!user.isPlatformAdmin &&
                                user.managementOrganizationCount ===
                                  0 &&
                                user.memberSpaceCount ===
                                  0 && (
                                  <Badge>
                                    Compte seul
                                  </Badge>
                                )}

                            </div>

                          </td>

                          {/* ================================= */}
                          {/* ORGANISATIONS */}
                          {/* ================================= */}

                          <td className="px-4 py-5">

                            {user.organizationRoles.length >
                            0 ? (
                              <div className="max-w-[300px] space-y-2">

                                {user.organizationRoles
                                  .slice(
                                    0,
                                    3
                                  )
                                  .map(
                                    (
                                      item
                                    ) => (
                                      <div
                                        key={`${user.id}-${item.organization_id}-${item.role}`}
                                        className="flex items-center justify-between gap-3"
                                      >

                                        <Link
                                          href={`/admin/organizations/${item.organization_id}`}
                                          className="min-w-0 truncate text-xs font-bold text-slate-700 transition hover:text-emerald-700 hover:underline"
                                        >
                                          {item.organization_short_name ||
                                            item.organization_name}
                                        </Link>

                                        <OrganizationRoleBadge
                                          role={item.role}
                                        />

                                      </div>
                                    )
                                  )}

                                {user.organizationRoles.length >
                                  3 && (
                                  <p className="text-[11px] font-black text-slate-400">
                                    +
                                    {user.organizationRoles.length -
                                      3}{' '}
                                    autre(s)
                                  </p>
                                )}

                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400">
                                Aucune organisation
                              </span>
                            )}

                          </td>

                          {/* ================================= */}
                          {/* ESPACES MEMBRES */}
                          {/* ================================= */}

                          <td className="px-4 py-5 text-right">

                            <Link
                              href={`/admin/users/${user.id}`}
                              title="Voir les espaces membre"
                              className="inline-flex min-w-8 justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              {formatNumber(
                                user.memberSpaceCount
                              )}
                            </Link>

                          </td>

                          {/* ================================= */}
                          {/* ACTIVITE */}
                          {/* ================================= */}

                          <td className="px-4 py-5">

                            <div className="min-w-[150px] space-y-2 text-xs">

                              <div>
                                <p className="font-black uppercase tracking-wide text-slate-400">
                                  Dernière connexion
                                </p>
                                <p className="mt-0.5 font-semibold text-slate-600">
                                  {formatDateTime(
                                    user.lastSignInAt
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="font-black uppercase tracking-wide text-slate-400">
                                  Inscription
                                </p>
                                <p className="mt-0.5 font-semibold text-slate-600">
                                  {formatDate(
                                    user.createdAt
                                  )}
                                </p>
                              </div>

                            </div>

                          </td>

                          {/* ================================= */}
                          {/* ACTION */}
                          {/* ================================= */}

                          <td className="px-4 py-5 text-right">

                            <Link
                              href={`/admin/users/${user.id}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              Consulter

                              <span aria-hidden="true">
                                →
                              </span>
                            </Link>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

              {/* ============================================= */}
              {/* MOBILE / TABLETTE */}
              {/* ============================================= */}

              <div className="divide-y divide-slate-100 lg:hidden">

                {users.map(
                  (
                    user
                  ) => (
                    <article
                      key={
                        user.id
                      }
                      className="p-5"
                    >

                      {/* UTILISATEUR */}

                      <div className="flex items-start gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">

                          {getInitials(
                            user.name ||
                              user.email ||
                              'Utilisateur'
                          )}

                        </div>

                        <div className="min-w-0 flex-1">

                          <Link
                            href={`/admin/users/${user.id}`}
                            className="font-black text-slate-900 transition hover:text-emerald-700"
                          >
                            {user.name ||
                              'Nom non renseigné'}
                          </Link>

                          <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                            {user.email ||
                              'Email non disponible'}
                          </p>

                          {user.phone && (
                            <p className="mt-1 text-xs text-slate-400">
                              {
                                user.phone
                              }
                            </p>
                          )}

                        </div>

                      </div>

                      {/* ACCES */}

                      <div className="mt-4 flex flex-wrap gap-2">

                        {user.isPlatformAdmin && (
                          <Badge variant="admin">
                            Super-admin
                          </Badge>
                        )}

                        {user.managementOrganizationCount >
                          0 && (
                          <Badge variant="management">
                            Gestion
                          </Badge>
                        )}

                        {user.memberSpaceCount >
                          0 && (
                          <Badge variant="member">
                            Membre
                          </Badge>
                        )}

                        {!user.isPlatformAdmin &&
                          user.managementOrganizationCount ===
                            0 &&
                          user.memberSpaceCount ===
                            0 && (
                            <Badge>
                              Compte seul
                            </Badge>
                          )}

                      </div>

                      {/* STATS */}

                      <div className="mt-4 grid grid-cols-3 gap-2">

                        <MiniStat
                          label="Organisations"
                          value={
                            user.organizationCount
                          }
                        />

                        <MiniStat
                          label="Gestion"
                          value={
                            user.managementOrganizationCount
                          }
                        />

                        <MiniStat
                          label="Membre"
                          value={
                            user.memberSpaceCount
                          }
                        />

                      </div>

                      {/* ORGANISATIONS */}

                      {user.organizationRoles.length >
                        0 && (
                        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">

                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                            Organisations
                          </p>

                          {user.organizationRoles
                            .slice(
                              0,
                              3
                            )
                            .map(
                              (
                                item
                              ) => (
                                <div
                                  key={`${user.id}-${item.organization_id}-${item.role}`}
                                  className="flex items-center justify-between gap-3"
                                >

                                  <Link
                                    href={`/admin/organizations/${item.organization_id}`}
                                    className="min-w-0 truncate text-sm font-bold text-slate-700 transition hover:text-emerald-700"
                                  >
                                    {item.organization_short_name ||
                                      item.organization_name}
                                  </Link>

                                  <OrganizationRoleBadge
                                    role={item.role}
                                  />

                                </div>
                              )
                            )}

                          {user.organizationRoles.length >
                            3 && (
                            <p className="text-xs font-black text-slate-400">
                              +
                              {user.organizationRoles.length -
                                3}{' '}
                              autre(s)
                            </p>
                          )}

                        </div>
                      )}

                      {/* DATES */}

                      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">

                        <SmallDate
                          label="Inscription"
                          value={
                            formatDate(
                              user.createdAt
                            )
                          }
                        />

                        <SmallDate
                          label="Dernière connexion"
                          value={
                            formatDateTime(
                              user.lastSignInAt
                            )
                          }
                        />

                      </div>

                      {/* ACTION */}

                      <div className="mt-4 flex justify-end">

                        <Link
                          href={`/admin/users/${user.id}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800"
                        >
                          Consulter la fiche

                          <span aria-hidden="true">
                            →
                          </span>
                        </Link>

                      </div>

                    </article>
                  )
                )}

              </div>

            </>
          )}

        </section>

        {/* ================================================== */}
        {/* NOTE SECURITE */}
        {/* ================================================== */}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Comptes et adhésions distincts
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            Un compte utilisateur peut gérer une
            organisation, être membre d&apos;une
            autre organisation, ou cumuler les
            deux situations. Cette page ne
            modifie aucun rôle ni aucune
            adhésion.
          </p>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// COMPOSANTS
// ============================================================

function StatCard({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-3 text-3xl font-black text-slate-950">
        {
          value
        }
      </p>

      <p className="mt-2 text-xs font-medium text-slate-500">
        {
          note
        }
      </p>

    </div>
  )
}

function TableHeading({
  children,
  align = 'left',
}: {
  children: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 ${
        align ===
        'right'
          ? 'text-right'
          : 'text-left'
      }`}
    >
      {
        children
      }
    </th>
  )
}

function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode

  variant?:
    | 'default'
    | 'admin'
    | 'management'
    | 'member'
}) {
  const classes = {
    default:
      'bg-slate-100 text-slate-600',

    admin:
      'bg-violet-50 text-violet-700',

    management:
      'bg-amber-50 text-amber-700',

    member:
      'bg-emerald-50 text-emerald-700',
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${classes[variant]}`}
    >
      {
        children
      }
    </span>
  )
}

function OrganizationRoleBadge({
  role,
}: {
  role: string
}) {
  const normalized =
    role
      .trim()
      .toLowerCase()

  const isMember =
    normalized ===
    'member'

  return (
    <span
      className={
        isMember
          ? 'shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700'
          : 'shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700'
      }
    >
      {formatRole(
        role
      )}
    </span>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">

      <p className="text-lg font-black text-slate-900">
        {formatNumber(
          value
        )}
      </p>

      <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

    </div>
  )
}

function SmallDate({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">

      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-1 text-xs font-bold text-slate-700">
        {
          value
        }
      </p>

    </div>
  )
}

// ============================================================
// NORMALISATION
// ============================================================

function normalizeUser(
  value: unknown
): NormalizedUser | null {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return null
  }

  const row =
    value as PlatformUserRow

  if (
    !row.user_id
  ) {
    return null
  }

  return {
    id:
      row.user_id,

    name:
      nullableString(
        row.full_name
      ),

    email:
      nullableString(
        row.email
      ),

    phone:
      nullableString(
        row.phone
      ),

    createdAt:
      nullableString(
        row.created_at
      ),

    lastSignInAt:
      nullableString(
        row.last_sign_in_at
      ),

    organizationCount:
      numberValue(
        row.organization_count
      ),

    managementOrganizationCount:
      numberValue(
        row.management_organization_count
      ),

    memberSpaceCount:
      numberValue(
        row.member_space_count
      ),

    isPlatformAdmin:
      Boolean(
        row.is_platform_admin
      ),

    platformAdminRole:
      nullableString(
        row.platform_admin_role
      ),

    organizationRoles:
      normalizeOrganizationRoles(
        row.organization_roles
      ),

    totalCount:
      numberValue(
        row.total_count
      ),
  }
}

function normalizeOrganizationRoles(
  value: unknown
): OrganizationRoleInfo[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  return value.flatMap(
    (
      item
    ) => {
      if (
        !item ||
        typeof item !==
          'object' ||
        Array.isArray(
          item
        )
      ) {
        return []
      }

      const raw =
        item as Record<
          string,
          unknown
        >

      const organizationId =
        stringValue(
          raw.organization_id
        )

      const organizationName =
        stringValue(
          raw.organization_name
        )

      const role =
        stringValue(
          raw.role
        )

      if (
        !organizationId ||
        !organizationName ||
        !role
      ) {
        return []
      }

      return [
        {
          organization_id:
            organizationId,

          organization_name:
            organizationName,

          organization_short_name:
            nullableString(
              raw.organization_short_name
            ),

          role,
        },
      ]
    }
  )
}

// ============================================================
// HELPERS
// ============================================================

function stringValue(
  value: unknown
) {
  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value.trim()
}

function nullableString(
  value: unknown
) {
  const result =
    stringValue(
      value
    )

  return result ||
    null
}

function numberValue(
  value: unknown
) {
  const parsed =
    Number(
      value ??
        0
    )

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0
}

function formatNumber(
  value: number
) {
  return value.toLocaleString(
    'fr-FR'
  )
}

function formatDate(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return '—'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl
    .DateTimeFormat(
      'fr-FR',
      {
        day:
          '2-digit',

        month:
          'short',

        year:
          'numeric',
      }
    )
    .format(
      date
    )
}

function formatDateTime(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return 'Jamais'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl
    .DateTimeFormat(
      'fr-FR',
      {
        day:
          '2-digit',

        month:
          'short',

        year:
          'numeric',

        hour:
          '2-digit',

        minute:
          '2-digit',
      }
    )
    .format(
      date
    )
}

function formatRole(
  role: string
) {
  switch (
    role
      .trim()
      .toLowerCase()
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
  }
}

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
    return 'AC'
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
        word
          .charAt(
            0
          )
    )
    .join(
      ''
    )
    .toUpperCase()
}