import Link from 'next/link'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// EWUKAI
// ADMINISTRATION PLATEFORME
// ACTIVITE GLOBALE
// ============================================================

type PageProps = {
  searchParams: Promise<{
    q?: string
    type?: string
  }>
}

type RawActivityRow = {
  event_id: string
  event_type: string

  title:
    | string
    | null

  description:
    | string
    | null

  occurred_at:
    | string
    | null

  organization_id:
    | string
    | null

  organization_name:
    | string
    | null

  user_id:
    | string
    | null

  user_name:
    | string
    | null

  amount:
    | number
    | string
    | null

  metadata:
    unknown

  total_count:
    | number
    | string
    | null
}

type ActivityRow = {
  id: string
  type: string

  title: string

  description:
    | string
    | null

  occurredAt:
    | string
    | null

  organizationId:
    | string
    | null

  organizationName:
    | string
    | null

  userId:
    | string
    | null

  userName:
    | string
    | null

  amount:
    number | null

  totalCount: number
}

const allowedTypes = [
  'user',
  'organization',
  'member',
  'payment',
  'treasury',
]

// ============================================================
// PAGE
// ============================================================

export default async function AdminActivityPage({
  searchParams,
}: PageProps) {
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

  const requestedType =
    params.type
      ?.trim()
      .toLowerCase() ??
    ''

  const typeFilter =
    allowedTypes.includes(
      requestedType
    )
      ? requestedType
      : ''

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'list_platform_activity',
      {
        search_text:
          search ||
          null,

        event_type_filter:
          typeFilter ||
          null,

        limit_count:
          100,

        offset_count:
          0,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - admin activity:',
      error
    )
  }

  const activities =
    (
      Array.isArray(
        data
      )
        ? data
        : []
    )
      .map(
        normalizeActivity
      )
      .filter(
        (
          activity
        ): activity is ActivityRow =>
          activity !==
          null
      )

  const totalEvents =
    activities[0]
      ?.totalCount ??
    0

  const organizations =
    new Set(
      activities
        .map(
          item =>
            item.organizationId
        )
        .filter(
          Boolean
        )
    ).size

  const financialEvents =
    activities.filter(
      item =>
        item.type ===
          'payment' ||
        item.type ===
          'treasury'
    )

  const financialAmount =
    financialEvents.reduce(
      (
        total,
        item
      ) =>
        total +
        (
          item.amount ??
          0
        ),
      0
    )

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
                Activité plateforme
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Suivez les principaux événements
                enregistrés dans EWUKAI :
                comptes, organisations, membres
                et opérations financières.
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
      {/* CONTENT */}
      {/* ==================================================== */}

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">

        {/* KPI */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            label="Événements"
            value={
              formatNumber(
                totalEvents
              )
            }
            note="Correspondant aux filtres"
          />

          <StatCard
            label="Affichés"
            value={
              formatNumber(
                activities.length
              )
            }
            note="Maximum 100 par page"
          />

          <StatCard
            label="Organisations"
            value={
              formatNumber(
                organizations
              )
            }
            note="Présentes dans cette vue"
          />

          <StatCard
            label="Flux financiers"
            value={
              formatMoney(
                financialAmount
              )
            }
            note={`${financialEvents.length} événement(s) affiché(s)`}
          />

        </section>

        {/* ================================================== */}
        {/* FILTRES */}
        {/* ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <form
            action="/admin/activity"
            method="get"
            className="grid gap-4 lg:grid-cols-[1fr_240px_auto]"
          >

            <div>

              <label
                htmlFor="q"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Rechercher
              </label>

              <input
                id="q"
                name="q"
                type="search"
                defaultValue={
                  search
                }
                placeholder="Utilisateur, organisation, événement..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />

            </div>

            <div>

              <label
                htmlFor="type"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Type
              </label>

              <select
                id="type"
                name="type"
                defaultValue={
                  typeFilter
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none"
              >
                <option value="">
                  Toute l&apos;activité
                </option>

                <option value="user">
                  Comptes utilisateurs
                </option>

                <option value="organization">
                  Organisations
                </option>

                <option value="member">
                  Membres
                </option>

                <option value="payment">
                  Paiements
                </option>

                <option value="treasury">
                  Trésorerie
                </option>
              </select>

            </div>

            <div className="flex items-end gap-2">

              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Filtrer
              </button>

              {(search ||
                typeFilter) && (
                <Link
                  href="/admin/activity"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600"
                >
                  Effacer
                </Link>
              )}

            </div>

          </form>

        </section>

        {/* ERREUR */}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Impossible de charger
              l&apos;activité.
            </p>

            <p className="mt-1 text-sm text-red-700">
              Vérifiez la fonction
              list_platform_activity dans
              Supabase.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* TIMELINE */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">

            <div>

              <h2 className="text-lg font-black text-slate-950">
                Journal d&apos;activité
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Événements classés du plus récent
                au plus ancien.
              </p>

            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {activities.length}
            </span>

          </div>

          {!error &&
            activities.length ===
              0 && (
              <div className="px-6 py-16 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  ◷
                </div>

                <p className="mt-4 font-black text-slate-800">
                  Aucune activité trouvée
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Modifiez les critères de
                  recherche ou les filtres.
                </p>

              </div>
            )}

          {activities.length >
            0 && (
            <div className="divide-y divide-slate-100">

              {activities.map(
                activity => (
                  <article
                    key={
                      activity.id
                    }
                    className="px-5 py-5 transition hover:bg-slate-50/70 sm:px-6"
                  >

                    <div className="flex gap-4">

                      <EventMark
                        type={
                          activity.type
                        }
                      />

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <p className="font-black text-slate-900">
                                {
                                  activity.title
                                }
                              </p>

                              <EventBadge
                                type={
                                  activity.type
                                }
                              />

                            </div>

                            {activity.description && (
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {
                                  activity.description
                                }
                              </p>
                            )}

                          </div>

                          <time className="shrink-0 text-xs font-bold text-slate-400">
                            {formatDateTime(
                              activity.occurredAt
                            )}
                          </time>

                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">

                          {activity.organizationId &&
                            activity.organizationName && (
                              <Link
                                href={`/admin/organizations/${activity.organizationId}`}
                                className="font-black text-emerald-700 transition hover:underline"
                              >
                                {
                                  activity.organizationName
                                }
                              </Link>
                            )}

                          {activity.userId &&
                            activity.userName && (
                              <Link
                                href={`/admin/users/${activity.userId}`}
                                className="font-bold text-slate-500 transition hover:text-slate-900 hover:underline"
                              >
                                {
                                  activity.userName
                                }
                              </Link>
                            )}

                          {!activity.userId &&
                            activity.userName && (
                              <span className="font-bold text-slate-500">
                                {
                                  activity.userName
                                }
                              </span>
                            )}

                          {activity.amount !==
                            null && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-black text-slate-700">
                              {formatMoney(
                                activity.amount
                              )}
                            </span>
                          )}

                        </div>

                      </div>

                    </div>

                  </article>
                )
              )}

            </div>
          )}

        </section>

        {/* NOTE */}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Journal de supervision
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            Cette vue rassemble des événements
            issus des données métier existantes.
            Elle ne constitue pas encore le journal
            d&apos;audit immuable de sécurité
            d&apos;EWUKAI.
          </p>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// COMPONENTS
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

      <p className="mt-3 text-2xl font-black text-slate-950">
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

function EventMark({
  type,
}: {
  type: string
}) {
  const values:
    Record<
      string,
      string
    > = {
      user:
        'U',

      organization:
        'O',

      member:
        'M',

      payment:
        'P',

      treasury:
        'T',
    }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
      {values[type] ??
        'A'}
    </div>
  )
}

function EventBadge({
  type,
}: {
  type: string
}) {
  const label =
    formatEventType(
      type
    )

  const styles:
    Record<
      string,
      string
    > = {
      user:
        'bg-violet-50 text-violet-700',

      organization:
        'bg-blue-50 text-blue-700',

      member:
        'bg-emerald-50 text-emerald-700',

      payment:
        'bg-amber-50 text-amber-700',

      treasury:
        'bg-slate-100 text-slate-700',
    }

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
        styles[type] ??
        'bg-slate-100 text-slate-600'
      }`}
    >
      {
        label
      }
    </span>
  )
}

// ============================================================
// NORMALISATION
// ============================================================

function normalizeActivity(
  value: unknown
): ActivityRow | null {
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
    value as RawActivityRow

  if (
    !row.event_id ||
    !row.event_type
  ) {
    return null
  }

  const rawAmount =
    row.amount ===
    null
      ? null
      : Number(
          row.amount
        )

  return {
    id:
      row.event_id,

    type:
      row.event_type,

    title:
      row.title ||
      'Activité',

    description:
      row.description,

    occurredAt:
      row.occurred_at,

    organizationId:
      row.organization_id,

    organizationName:
      row.organization_name,

    userId:
      row.user_id,

    userName:
      row.user_name,

    amount:
      rawAmount !==
        null &&
      Number.isFinite(
        rawAmount
      )
        ? rawAmount
        : null,

    totalCount:
      numberValue(
        row.total_count
      ),
  }
}

// ============================================================
// HELPERS
// ============================================================

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

function formatMoney(
  value: number
) {
  return `${Math.round(
    value
  ).toLocaleString(
    'fr-FR'
  )} FCFA`
}

function formatEventType(
  type: string
) {
  switch (
    type
  ) {
    case 'user':
      return 'Compte'

    case 'organization':
      return 'Organisation'

    case 'member':
      return 'Membre'

    case 'payment':
      return 'Paiement'

    case 'treasury':
      return 'Trésorerie'

    default:
      return 'Activité'
  }
}

function formatDateTime(
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