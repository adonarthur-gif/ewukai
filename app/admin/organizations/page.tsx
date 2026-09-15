import Link from 'next/link'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// EWUKAI
// ADMINISTRATION PLATEFORME
// LISTE DES ORGANISATIONS
//
// Fonctionnalités :
// - accès réservé au Super-admin ;
// - recherche d'organisations ;
// - synthèse des membres ;
// - identification du statut ;
// - accès à la fiche détaillée ;
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

type RawOrganizationRow =
  Record<
    string,
    unknown
  >

type OrganizationRow = {
  id: string

  name: string

  shortName:
    | string
    | null

  status:
    | string
    | null

  organizationType:
    | string
    | null

  city:
    | string
    | null

  country:
    | string
    | null

  totalMembers: number

  activeMembers: number

  managersCount: number

  createdAt:
    | string
    | null
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminOrganizationsPage({
  searchParams,
}: PageProps) {
  // ==========================================================
  // 1. PARAMETRES
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
  // 2. SUPER ADMIN
  // ==========================================================

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  // ==========================================================
  // 3. ORGANISATIONS
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'list_platform_organizations',
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
      'EWUKAI - admin organizations:',
      error
    )
  }

  // ==========================================================
  // 4. NORMALISATION
  //
  // Cette normalisation rend la page plus résistante si les
  // alias SQL de la RPC diffèrent légèrement.
  // ==========================================================

  const organizations =
    (
      Array.isArray(
        data
      )
        ? data
        : []
    )
      .map(
        normalizeOrganization
      )
      .filter(
        (
          organization
        ): organization is OrganizationRow =>
          organization !==
          null
      )

  // ==========================================================
  // 5. INDICATEURS
  // ==========================================================

  const organizationsCount =
    organizations.length

  const totalMembers =
    organizations.reduce(
      (
        total,
        organization
      ) =>
        total +
        organization.totalMembers,
      0
    )

  const activeMembers =
    organizations.reduce(
      (
        total,
        organization
      ) =>
        total +
        organization.activeMembers,
      0
    )

  const managedOrganizations =
    organizations.filter(
      (
        organization
      ) =>
        organization.managersCount >
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
                Organisations
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Consultez les mutuelles,
                associations et autres
                organisations enregistrées sur
                la plateforme.
              </p>

            </div>

            <Link
              href="/admin/dashboard"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
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
            label="Organisations affichées"
            value={
              formatNumber(
                organizationsCount
              )
            }
            note={
              search
                ? 'Résultat de la recherche'
                : 'Dans la liste actuelle'
            }
          />

          <StatCard
            label="Membres enregistrés"
            value={
              formatNumber(
                totalMembers
              )
            }
            note="Toutes organisations confondues"
          />

          <StatCard
            label="Membres actifs"
            value={
              formatNumber(
                activeMembers
              )
            }
            note="Statut actif"
          />

          <StatCard
            label="Organisations gérées"
            value={
              formatNumber(
                managedOrganizations
              )
            }
            note="Au moins un responsable actif"
          />

        </section>

        {/* ================================================== */}
        {/* RECHERCHE */}
        {/* ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

            <form
              action="/admin/organizations"
              method="get"
              className="flex flex-1 flex-col gap-3 sm:flex-row"
            >

              <div className="flex-1">

                <label
                  htmlFor="q"
                  className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
                >
                  Rechercher une organisation
                </label>

                <input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={
                    search
                  }
                  placeholder="Nom, sigle..."
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />

              </div>

              <div className="flex items-end gap-2">

                <button
                  type="submit"
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Rechercher
                </button>

                {search && (
                  <Link
                    href="/admin/organizations"
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                  >
                    Effacer
                  </Link>
                )}

              </div>

            </form>

          </div>

          {search && (
            <p className="mt-4 text-sm text-slate-500">
              Résultats pour{' '}
              <span className="font-black text-slate-800">
                « {search} »
              </span>
              {' — '}
              {formatNumber(
                organizationsCount
              )}{' '}
              organisation(s)
            </p>
          )}

        </section>

        {/* ================================================== */}
        {/* ERREUR RPC */}
        {/* ================================================== */}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Impossible de charger correctement
              les organisations.
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              Vérifiez la fonction
              list_platform_organizations dans
              Supabase.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* TABLEAU */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* HEADER */}

          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-lg font-black text-slate-950">
                Liste des organisations
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Cliquez sur une organisation
                pour consulter sa fiche
                détaillée.
              </p>

            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {formatNumber(
                organizationsCount
              )}{' '}
              résultat(s)
            </span>

          </div>

          {/* ================================================= */}
          {/* VIDE */}
          {/* ================================================= */}

          {!error &&
            organizations.length ===
              0 && (
              <div className="px-6 py-16 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  🏢
                </div>

                <p className="mt-4 font-black text-slate-800">
                  {search
                    ? 'Aucune organisation trouvée'
                    : 'Aucune organisation enregistrée'}
                </p>

                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                  {search
                    ? 'Essayez un autre nom ou sigle.'
                    : 'Les nouvelles organisations apparaîtront ici après leur création.'}
                </p>

                {search && (
                  <Link
                    href="/admin/organizations"
                    className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
                  >
                    Afficher toutes les organisations
                  </Link>
                )}

              </div>
            )}

          {/* ================================================= */}
          {/* TABLE DESKTOP */}
          {/* ================================================= */}

          {organizations.length >
            0 && (
            <>

              <div className="hidden overflow-x-auto md:block">

                <table className="w-full border-collapse">

                  <thead className="bg-slate-50">

                    <tr>

                      <TableHeading>
                        Organisation
                      </TableHeading>

                      <TableHeading>
                        Statut
                      </TableHeading>

                      <TableHeading align="right">
                        Membres
                      </TableHeading>

                      <TableHeading align="right">
                        Actifs
                      </TableHeading>

                      <TableHeading align="right">
                        Responsables
                      </TableHeading>

                      <TableHeading>
                        Création
                      </TableHeading>

                      <TableHeading align="right">
                        Action
                      </TableHeading>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {organizations.map(
                      (
                        organization
                      ) => (
                        <tr
                          key={
                            organization.id
                          }
                          className="transition hover:bg-slate-50/80"
                        >

                          {/* ORGANISATION */}

                          <td className="px-6 py-5">

                            <div className="flex items-center gap-3">

                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                                {getInitials(
                                  organization.shortName ||
                                    organization.name
                                )}
                              </div>

                              <div className="min-w-0">

                                <Link
                                  href={`/admin/organizations/${organization.id}`}
                                  className="block max-w-[320px] truncate font-black text-slate-900 transition hover:text-emerald-700 hover:underline"
                                >
                                  {
                                    organization.name
                                  }
                                </Link>

                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">

                                  {organization.shortName && (
                                    <span className="font-black text-slate-500">
                                      {
                                        organization.shortName
                                      }
                                    </span>
                                  )}

                                  {organization.organizationType && (
                                    <>
                                      <span>
                                        •
                                      </span>

                                      <span>
                                        {formatOrganizationType(
                                          organization.organizationType
                                        )}
                                      </span>
                                    </>
                                  )}

                                  {(organization.city ||
                                    organization.country) && (
                                    <>
                                      <span>
                                        •
                                      </span>

                                      <span>
                                        {[
                                          organization.city,
                                          organization.country,
                                        ]
                                          .filter(
                                            Boolean
                                          )
                                          .join(
                                            ', '
                                          )}
                                      </span>
                                    </>
                                  )}

                                </div>

                              </div>

                            </div>

                          </td>

                          {/* STATUT */}

                          <td className="px-6 py-5">

                            <StatusBadge
                              status={
                                organization.status
                              }
                            />

                          </td>

                          {/* MEMBRES */}

                          <td className="px-6 py-5 text-right text-sm font-black text-slate-900">
                            {formatNumber(
                              organization.totalMembers
                            )}
                          </td>

                          {/* ACTIFS */}

                          <td className="px-6 py-5 text-right">

                            <p className="text-sm font-black text-slate-900">
                              {formatNumber(
                                organization.activeMembers
                              )}
                            </p>

                            {organization.totalMembers >
                              0 && (
                              <p className="mt-1 text-[11px] font-bold text-slate-400">
                                {Math.round(
                                  (
                                    organization.activeMembers /
                                    organization.totalMembers
                                  ) *
                                    100
                                )}
                                %
                              </p>
                            )}

                          </td>

                          {/* RESPONSABLES */}

                          <td className="px-6 py-5 text-right">

                            <span
                              className={
                                organization.managersCount >
                                0
                                  ? 'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700'
                                  : 'inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700'
                              }
                            >
                              {formatNumber(
                                organization.managersCount
                              )}
                            </span>

                          </td>

                          {/* DATE */}

                          <td className="whitespace-nowrap px-6 py-5 text-sm font-semibold text-slate-500">
                            {formatDate(
                              organization.createdAt
                            )}
                          </td>

                          {/* ACTION */}

                          <td className="px-6 py-5 text-right">

                            <Link
                              href={`/admin/organizations/${organization.id}`}
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
              {/* MOBILE */}
              {/* ============================================= */}

              <div className="divide-y divide-slate-100 md:hidden">

                {organizations.map(
                  (
                    organization
                  ) => (
                    <article
                      key={
                        organization.id
                      }
                      className="p-5"
                    >

                      <div className="flex items-start gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                          {getInitials(
                            organization.shortName ||
                              organization.name
                          )}
                        </div>

                        <div className="min-w-0 flex-1">

                          <Link
                            href={`/admin/organizations/${organization.id}`}
                            className="font-black leading-5 text-slate-900"
                          >
                            {
                              organization.name
                            }
                          </Link>

                          {organization.shortName && (
                            <p className="mt-1 text-xs font-black text-slate-400">
                              {
                                organization.shortName
                              }
                            </p>
                          )}

                        </div>

                        <StatusBadge
                          status={
                            organization.status
                          }
                        />

                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2">

                        <MiniStat
                          label="Membres"
                          value={
                            organization.totalMembers
                          }
                        />

                        <MiniStat
                          label="Actifs"
                          value={
                            organization.activeMembers
                          }
                        />

                        <MiniStat
                          label="Gestion"
                          value={
                            organization.managersCount
                          }
                        />

                      </div>

                      {(organization.organizationType ||
                        organization.city ||
                        organization.country) && (
                        <div className="mt-4 text-xs font-medium leading-5 text-slate-500">

                          {organization.organizationType && (
                            <span>
                              {formatOrganizationType(
                                organization.organizationType
                              )}
                            </span>
                          )}

                          {organization.organizationType &&
                            (organization.city ||
                              organization.country) && (
                              <span>
                                {' '}
                                •{' '}
                              </span>
                            )}

                          {[
                            organization.city,
                            organization.country,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              ', '
                            )}

                        </div>
                      )}

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">

                        <p className="text-xs font-semibold text-slate-400">
                          Créée le{' '}
                          {formatDate(
                            organization.createdAt
                          )}
                        </p>

                        <Link
                          href={`/admin/organizations/${organization.id}`}
                          className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"
                        >
                          Consulter →
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
        {/* NOTE */}
        {/* ================================================== */}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Supervision plateforme
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            L&apos;administration EWUKAI
            dispose ici d&apos;une vue de
            supervision. Les opérations propres
            aux organisations restent séparées
            des droits du Super-administrateur.
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
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`whitespace-nowrap px-6 py-3 text-xs font-black uppercase tracking-wide text-slate-400 ${
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

function StatusBadge({
  status,
}: {
  status:
    | string
    | null
}) {
  const normalized =
    status
      ?.trim()
      .toLowerCase() ??
    ''

  if (
    normalized ===
    'active'
  ) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
        Active
      </span>
    )
  }

  if (
    normalized ===
      'inactive' ||
    normalized ===
      'suspended'
  ) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">
        {normalized ===
        'suspended'
          ? 'Suspendue'
          : 'Inactive'}
      </span>
    )
  }

  if (
    normalized ===
    'pending'
  ) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
        En attente
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
      {normalized
        ? capitalize(
            normalized
          )
        : 'Non défini'}
    </span>
  )
}

// ============================================================
// NORMALISATION RPC
// ============================================================

function normalizeOrganization(
  rawValue: unknown
): OrganizationRow | null {
  if (
    !rawValue ||
    typeof rawValue !==
      'object' ||
    Array.isArray(
      rawValue
    )
  ) {
    return null
  }

  const raw =
    rawValue as RawOrganizationRow

  const id =
    stringValue(
      raw.organization_id ??
        raw.id
    )

  if (
    !id
  ) {
    return null
  }

  const name =
    stringValue(
      raw.organization_name ??
        raw.name
    ) ||
    'Organisation sans nom'

  return {
    id,

    name,

    shortName:
      nullableString(
        raw.organization_short_name ??
          raw.short_name
      ),

    status:
      nullableString(
        raw.organization_status ??
          raw.status
      ),

    organizationType:
      nullableString(
        raw.organization_type ??
          raw.type
      ),

    city:
      nullableString(
        raw.city
      ),

    country:
      nullableString(
        raw.country ??
          raw.country_code
      ),

    totalMembers:
      numberValue(
        raw.total_members ??
          raw.member_count ??
          raw.members_count
      ),

    activeMembers:
      numberValue(
        raw.active_members ??
          raw.active_member_count ??
          raw.active_members_count
      ),

    managersCount:
      numberValue(
        raw.managers_count ??
          raw.manager_count ??
          raw.management_users ??
          raw.management_users_count ??
          raw.active_managers
      ),

    createdAt:
      nullableString(
        raw.created_at ??
          raw.organization_created_at
      ),
  }
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
  const normalized =
    stringValue(
      value
    )

  return normalized ||
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
    return value
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
        word.charAt(
          0
        )
    )
    .join(
      ''
    )
    .toUpperCase()
}

function formatOrganizationType(
  value: string
) {
  switch (
    value
      .trim()
      .toLowerCase()
  ) {
    case 'mutual':
    case 'mutuelle':
      return 'Mutuelle'

    case 'association':
      return 'Association'

    case 'tontine':
      return 'Tontine'

    case 'cooperative':
    case 'coopérative':
      return 'Coopérative'

    default:
      return value
        .replace(
          /_/g,
          ' '
        )
  }
}

function capitalize(
  value: string
) {
  if (
    !value
  ) {
    return value
  }

  return (
    value
      .charAt(
        0
      )
      .toUpperCase() +
    value.slice(
      1
    )
  )
}