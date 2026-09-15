import Link from 'next/link'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// TYPES
// ============================================================

type NumberValue =
  | number
  | string
  | null

type PlatformStats = {
  total_organizations: NumberValue
  total_members: NumberValue
  active_members: NumberValue
  registered_users: NumberValue

  new_organizations_month:
    NumberValue

  new_members_month:
    NumberValue

  organizations_with_active_management:
    NumberValue
}

type GrowthRow = {
  month_start: string

  new_organizations:
    NumberValue

  new_members:
    NumberValue
}

type OrganizationRow = {
  organization_id: string

  organization_name: string

  organization_short_name:
    | string
    | null

  public_slug:
    | string
    | null

  public_page_enabled:
    boolean

  online_membership_enabled:
    boolean

  created_at: string

  member_count:
    NumberValue

  active_member_count:
    NumberValue

  management_user_count:
    NumberValue
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminDashboardPage() {
  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  // ==========================================================
  // DONNEES
  // ==========================================================

  const [
    statsResult,
    growthResult,
    organizationsResult,
  ] =
    await Promise.all([
      supabase.rpc(
        'get_platform_dashboard_stats'
      ),

      supabase.rpc(
        'get_platform_growth',
        {
          months_count:
            6,
        }
      ),

      supabase.rpc(
        'list_platform_organizations',
        {
          search_text:
            null,

          limit_count:
            6,

          offset_count:
            0,
        }
      ),
    ])

  // ==========================================================
  // ERREURS
  // ==========================================================

  if (
    statsResult.error
  ) {
    console.error(
      'ADMIN DASHBOARD - stats:',
      statsResult.error
    )
  }

  if (
    growthResult.error
  ) {
    console.error(
      'ADMIN DASHBOARD - growth:',
      growthResult.error
    )
  }

  if (
    organizationsResult.error
  ) {
    console.error(
      'ADMIN DASHBOARD - organizations:',
      organizationsResult.error
    )
  }

  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const stats =
    (
      statsResult.data?.[0] ??
      null
    ) as PlatformStats | null

  const growth =
    (
      growthResult.data ??
      []
    ) as GrowthRow[]

  const organizations =
    (
      organizationsResult.data ??
      []
    ) as OrganizationRow[]

  const totalOrganizations =
    numberValue(
      stats?.total_organizations
    )

  const totalMembers =
    numberValue(
      stats?.total_members
    )

  const activeMembers =
    numberValue(
      stats?.active_members
    )

  const registeredUsers =
    numberValue(
      stats?.registered_users
    )

  const newOrganizationsMonth =
    numberValue(
      stats?.new_organizations_month
    )

  const newMembersMonth =
    numberValue(
      stats?.new_members_month
    )

  const organizationsWithManagement =
    numberValue(
      stats?.organizations_with_active_management
    )

  const organizationsWithoutManagement =
    Math.max(
      0,
      totalOrganizations -
        organizationsWithManagement
    )

  // ==========================================================
  // CROISSANCE
  // ==========================================================

  const normalizedGrowth =
    growth.map(
      (
        row
      ) => ({
        month:
          row.month_start,

        organizations:
          numberValue(
            row.new_organizations
          ),

        members:
          numberValue(
            row.new_members
          ),
      })
    )

  const maxGrowth =
    Math.max(
      1,

      ...normalizedGrowth.map(
        (
          item
        ) =>
          Math.max(
            item.organizations,
            item.members
          )
      )
    )

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">

        {/* ================================================== */}
        {/* HERO */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-lg sm:p-9">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                Administration plateforme
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Tableau de bord EWUKAI
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Supervisez la croissance,
                les organisations et
                l&apos;activité globale de
                la plateforme.
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              <Link
                href="/admin/organizations"
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-300"
              >
                Voir les organisations
              </Link>

              <Link
                href="/dashboard"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                Espace organisation
              </Link>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* KPI */}
        {/* ================================================== */}

        <section className="mt-8">

          <SectionTitle
            eyebrow="Plateforme"
            title="Vue globale"
            description="Les principaux indicateurs d’EWUKAI."
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <KpiCard
              label="Organisations"
              value={
                formatNumber(
                  totalOrganizations
                )
              }
              description={`${newOrganizationsMonth} créée${newOrganizationsMonth > 1 ? 's' : ''} ce mois`}
            />

            <KpiCard
              label="Membres enregistrés"
              value={
                formatNumber(
                  totalMembers
                )
              }
              description={`${activeMembers} membre${activeMembers > 1 ? 's' : ''} actif${activeMembers > 1 ? 's' : ''}`}
            />

            <KpiCard
              label="Utilisateurs"
              value={
                formatNumber(
                  registeredUsers
                )
              }
              description="Comptes EWUKAI créés"
            />

            <KpiCard
              label="Nouveaux membres"
              value={
                `+${formatNumber(
                  newMembersMonth
                )}`
              }
              description="Depuis le début du mois"
              highlight
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* CROISSANCE */}
        {/* ================================================== */}

        <section className="mt-8">

          <SectionTitle
            eyebrow="Croissance"
            title="Évolution sur 6 mois"
            description="Créations d’organisations et nouveaux membres."
          />

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

            {normalizedGrowth.length ===
            0 ? (
              <EmptyState
                text="Aucune donnée de croissance disponible."
              />
            ) : (
              <div className="grid h-72 grid-cols-6 items-end gap-2 sm:gap-5">

                {normalizedGrowth.map(
                  (
                    item
                  ) => {
                    const organizationHeight =
                      barHeight(
                        item.organizations,
                        maxGrowth
                      )

                    const membersHeight =
                      barHeight(
                        item.members,
                        maxGrowth
                      )

                    return (
                      <div
                        key={
                          item.month
                        }
                        className="flex h-full min-w-0 flex-col"
                      >

                        <div className="flex flex-1 items-end justify-center gap-1 sm:gap-2">

                          {/* ================================= */}
                          {/* ORGANISATIONS */}
                          {/* ================================= */}

                          <div className="flex h-full w-1/2 items-end justify-center">

                            <div
                              title={`${item.organizations} organisation(s)`}
                              className="w-full max-w-8 rounded-t-lg bg-slate-800 transition-all"
                              style={{
                                height:
                                  `${organizationHeight}%`,
                              }}
                            />

                          </div>

                          {/* ================================= */}
                          {/* MEMBRES */}
                          {/* ================================= */}

                          <div className="flex h-full w-1/2 items-end justify-center">

                            <div
                              title={`${item.members} membre(s)`}
                              className="w-full max-w-8 rounded-t-lg bg-emerald-500 transition-all"
                              style={{
                                height:
                                  `${membersHeight}%`,
                              }}
                            />

                          </div>

                        </div>

                        <div className="mt-3 text-center">

                          <p className="truncate text-xs font-black text-slate-600">
                            {formatMonthShort(
                              item.month
                            )}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {item.organizations} / {item.members}
                          </p>

                        </div>

                      </div>
                    )
                  }
                )}

              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-5 border-t border-slate-100 pt-5">

              <Legend
                colorClass="bg-slate-800"
                label="Nouvelles organisations"
              />

              <Legend
                colorClass="bg-emerald-500"
                label="Nouveaux membres"
              />

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* SURVEILLANCE */}
        {/* ================================================== */}

        <section className="mt-8">

          <SectionTitle
            eyebrow="Surveillance"
            title="État de la plateforme"
            description="Points nécessitant éventuellement une intervention."
          />

          <div className="mt-5 grid gap-4 lg:grid-cols-3">

            <HealthCard
              label="Organisations gérées"
              value={
                organizationsWithManagement
              }
              total={
                totalOrganizations
              }
              good={
                organizationsWithoutManagement ===
                0
              }
            />

            <HealthCard
              label="Sans gestionnaire actif"
              value={
                organizationsWithoutManagement
              }
              warning={
                organizationsWithoutManagement >
                0
              }
            />

            <HealthCard
              label="Membres actifs"
              value={
                activeMembers
              }
              total={
                totalMembers
              }
              good
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* ORGANISATIONS RECENTES */}
        {/* ================================================== */}

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Organisations
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                Créations récentes
              </h2>

            </div>

            <Link
              href="/admin/organizations"
              className="text-sm font-black text-emerald-700"
            >
              Toutes →
            </Link>

          </div>

          {organizations.length ===
          0 ? (
            <EmptyState
              text="Aucune organisation enregistrée."
            />
          ) : (
            <div>

              {organizations.map(
                (
                  organization
                ) => (
                  <div
                    key={
                      organization.organization_id
                    }
                    className="grid gap-4 border-b border-slate-100 px-6 py-5 last:border-0 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
                  >

                    <div>

                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                          {initials(
                            organization.organization_short_name ||
                            organization.organization_name
                          )}
                        </div>

                        <div className="min-w-0">

                          <p className="truncate font-black text-slate-900">
                            {
                              organization.organization_name
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Créée le{' '}
                            {formatDate(
                              organization.created_at
                            )}
                          </p>

                        </div>

                      </div>

                    </div>

                    <OrganizationMetric
                      label="Membres"
                      value={
                        numberValue(
                          organization.member_count
                        )
                      }
                    />

                    <OrganizationMetric
                      label="Actifs"
                      value={
                        numberValue(
                          organization.active_member_count
                        )
                      }
                    />

                    <StatusBadge
                      active={
                        numberValue(
                          organization.management_user_count
                        ) >
                        0
                      }
                    />

                  </div>
                )
              )}

            </div>
          )}

        </section>

      </div>

    </main>
  )
}

// ============================================================
// SECTION TITLE
// ============================================================

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>

      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
        {eyebrow}
      </p>

      <h2 className="mt-1 text-2xl font-black text-slate-950">
        {title}
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>

    </div>
  )
}

// ============================================================
// KPI
// ============================================================

function KpiCard({
  label,
  value,
  description,
  highlight = false,
}: {
  label: string
  value: string
  description: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        highlight
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white'
      }`}
    >

      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-black ${
          highlight
            ? 'text-emerald-800'
            : 'text-slate-950'
        }`}
      >
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>

    </div>
  )
}

// ============================================================
// HEALTH
// ============================================================

function HealthCard({
  label,
  value,
  total,
  good = false,
  warning = false,
}: {
  label: string
  value: number
  total?: number
  good?: boolean
  warning?: boolean
}) {
  const classes =
    warning
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : good
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-slate-200 bg-white text-slate-900'

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${classes}`}
    >

      <p className="text-sm font-black">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {formatNumber(
          value
        )}
      </p>

      {total !==
        undefined && (
        <p className="mt-1 text-xs opacity-70">
          sur{' '}
          {formatNumber(
            total
          )}
        </p>
      )}

    </div>
  )
}

// ============================================================
// ORGANIZATION METRIC
// ============================================================

function OrganizationMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div>

      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-black text-slate-900">
        {formatNumber(
          value
        )}
      </p>

    </div>
  )
}

// ============================================================
// STATUS
// ============================================================

function StatusBadge({
  active,
}: {
  active: boolean
}) {
  return (
    <span
      className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${
        active
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-amber-100 text-amber-800'
      }`}
    >
      {active
        ? 'Gestion active'
        : 'À vérifier'}
    </span>
  )
}

// ============================================================
// LEGEND
// ============================================================

function Legend({
  colorClass,
  label,
}: {
  colorClass: string
  label: string
}) {
  return (
    <div className="flex items-center gap-2">

      <span
        className={`h-3 w-3 rounded-full ${colorClass}`}
      />

      <span className="text-xs font-bold text-slate-500">
        {label}
      </span>

    </div>
  )
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({
  text,
}: {
  text: string
}) {
  return (
    <div className="p-10 text-center text-sm text-slate-500">
      {text}
    </div>
  )
}

// ============================================================
// HELPERS
// ============================================================

function numberValue(
  value:
    | NumberValue
    | undefined
) {
  const parsed =
    Number(
      value ?? 0
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
  return new Intl.NumberFormat(
    'fr-FR'
  ).format(
    Math.round(
      value
    )
  )
}

function barHeight(
  value: number,
  max: number
) {
  if (
    value <= 0
  ) {
    return 2
  }

  return Math.max(
    10,
    Math.min(
      100,
      (
        value /
        max
      ) *
        100
    )
  )
}

function formatMonthShort(
  value: string
) {
  return capitalize(
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month:
          'short',

        timeZone:
          'UTC',
      }
    ).format(
      new Date(
        `${value.slice(0, 10)}T00:00:00Z`
      )
    )
  )
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    }
  ).format(
    new Date(
      value
    )
  )
}

function initials(
  value: string
) {
  const words =
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)

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
        word.charAt(0)
    )
    .join('')
    .toUpperCase()
}

function capitalize(
  value: string
) {
  if (!value) {
    return value
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  )
}