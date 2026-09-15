import Link from 'next/link'
import {
  notFound,
} from 'next/navigation'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

import {
  changeOrganizationSubscription,
} from './actions'

// ============================================================
// TYPES
// ============================================================

type PageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    saved?: string
    error?: string
  }>
}

type MoneyValue =
  | number
  | string
  | null

type Plan = {
  id: string
  code: string
  name: string

  description?:
    | string
    | null

  monthly_price_xof:
    MoneyValue

  member_limit:
    number
    | null

  is_custom_pricing:
    boolean
}

type CurrentSubscription = {
  subscription_id: string
  status: string
  billing_cycle: string

  starts_at:
    | string
    | null

  current_period_start:
    | string
    | null

  current_period_end:
    | string
    | null

  cancel_at_period_end:
    boolean

  ended_at:
    | string
    | null

  notes:
    | string
    | null

  created_at:
    | string
    | null

  updated_at:
    | string
    | null

  plan: Plan
}

type HistoryRow = {
  subscription_id: string

  status: string

  billing_cycle: string

  starts_at:
    | string
    | null

  current_period_start:
    | string
    | null

  current_period_end:
    | string
    | null

  ended_at:
    | string
    | null

  notes:
    | string
    | null

  created_at:
    | string
    | null

  plan_id: string
  plan_code: string
  plan_name: string

  monthly_price_xof:
    MoneyValue

  is_custom_pricing:
    boolean
}

type Detail = {
  organization: {
    id: string
    name: string

    short_name:
      | string
      | null

    status:
      | string
      | null

    organization_type:
      | string
      | null

    created_at:
      | string
      | null
  }

  members: {
    total:
      MoneyValue

    active:
      MoneyValue
  }

  current_subscription:
    CurrentSubscription
    | null

  recommended_plan:
    Plan
    | null

  history:
    HistoryRow[]

  available_plans:
    Plan[]
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminSubscriptionDetailPage({
  params,
  searchParams,
}: PageProps) {
  const {
    id,
  } =
    await params

  const query =
    await searchParams

  if (
    !isUuid(
      id
    )
  ) {
    notFound()
  }

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_platform_subscription_detail',
      {
        target_organization_id:
          id,
      }
    )

  if (
    error
  ) {
    console.error(
      'EWUKAI - subscription detail:',
      error
    )

    if (
      error.message
        ?.toLowerCase()
        .includes(
          'organization not found'
        )
    ) {
      notFound()
    }

    throw new Error(
      'Impossible de charger cet abonnement.'
    )
  }

  if (
    !data
  ) {
    notFound()
  }

  const detail =
    data as Detail

  const organization =
    detail.organization

  const current =
    detail.current_subscription

  const recommended =
    detail.recommended_plan

  const plans =
    Array.isArray(
      detail.available_plans
    )
      ? detail.available_plans
      : []

  const history =
    Array.isArray(
      detail.history
    )
      ? detail.history
      : []

  const activeMembers =
    numberValue(
      detail.members?.active
    )

  const totalMembers =
    numberValue(
      detail.members?.total
    )

  const isAligned =
    current?.plan?.code &&
    recommended?.code &&
    current.plan.code ===
      recommended.code

  return (
    <main className="min-h-screen bg-slate-50">

      {/* HERO */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <Link
            href="/admin/subscriptions"
            className="text-sm font-black text-slate-500 transition hover:text-slate-900"
          >
            ← Abonnements
          </Link>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Gestion d&apos;abonnement
              </p>

              <h1 className="mt-2 text-3xl font-black text-slate-950">
                {organization.short_name ||
                  organization.name}
              </h1>

              {organization.short_name && (
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {
                    organization.name
                  }
                </p>
              )}

            </div>

            <Link
              href={`/admin/organizations/${organization.id}`}
              className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"
            >
              Voir l&apos;organisation
            </Link>

          </div>

        </div>

      </section>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">

        {/* SUCCES */}

        {query.saved ===
          '1' && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <p className="font-black text-emerald-900">
              Abonnement modifié
            </p>

            <p className="mt-1 text-sm text-emerald-700">
              Le nouveau plan est actif et
              l&apos;ancien abonnement a été
              conservé dans l&apos;historique.
            </p>

          </section>
        )}

        {/* ERREUR */}

        {query.error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Changement impossible
            </p>

            <p className="mt-1 text-sm text-red-700">
              {query.error ===
              'same_plan'
                ? 'Cette organisation utilise déjà ce plan.'
                : 'Le changement de formule n’a pas pu être enregistré.'}
            </p>

          </section>
        )}

        {/* KPI */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <Stat
            label="Membres actifs"
            value={
              formatNumber(
                activeMembers
              )
            }
            note={`${formatNumber(
              totalMembers
            )} membre(s) au total`}
          />

          <Stat
            label="Plan actuel"
            value={
              current?.plan
                ?.name ||
              'Aucun'
            }
            note={
              current
                ? formatSubscriptionStatus(
                    current.status
                  )
                : 'Sans abonnement'
            }
          />

          <Stat
            label="Plan recommandé"
            value={
              recommended?.name ||
              '—'
            }
            note={
              getPlanRange(
                recommended?.code
              )
            }
          />

          <Stat
            label="Situation"
            value={
              isAligned
                ? 'Conforme'
                : 'À vérifier'
            }
            note={
              isAligned
                ? 'Plan adapté au nombre de membres'
                : 'Une autre formule est recommandée'
            }
            warning={
              !isAligned
            }
          />

        </section>

        {/* PLAN ACTUEL + RECOMMANDE */}

        <section className="grid gap-6 lg:grid-cols-2">

          <PlanPanel
            title="Abonnement actuel"
            plan={
              current?.plan ??
              null
            }
            subtitle={
              current
                ? `Statut : ${formatSubscriptionStatus(
                    current.status
                  )}`
                : 'Aucun abonnement courant'
            }
          />

          <PlanPanel
            title="Plan recommandé"
            plan={
              recommended
            }
            subtitle={`${formatNumber(
              activeMembers
            )} membre(s) actif(s)`}
            recommended
          />

        </section>

        {/* CHANGEMENT */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-6 py-5">

            <h2 className="text-lg font-black text-slate-950">
              Changer la formule
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Le changement crée un nouvel
              abonnement. L&apos;abonnement
              précédent reste conservé dans
              l&apos;historique.
            </p>

          </div>

          <form
            action={
              changeOrganizationSubscription
            }
            className="space-y-5 p-6"
          >

            <input
              type="hidden"
              name="organization_id"
              value={
                organization.id
              }
            />

            <div>

              <label
                htmlFor="plan_code"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Nouvelle formule
              </label>

              <select
                id="plan_code"
                name="plan_code"
                required
                defaultValue={
                  recommended?.code &&
                  recommended.code !==
                    current?.plan?.code
                    ? recommended.code
                    : ''
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
              >

                <option
                  value=""
                  disabled
                >
                  Choisir une formule
                </option>

                {plans.map(
                  plan => (
                    <option
                      key={
                        plan.id
                      }
                      value={
                        plan.code
                      }
                      disabled={
                        plan.code ===
                        current?.plan?.code
                      }
                    >
                      {plan.name}
                      {' — '}
                      {formatPlanPrice(
                        plan
                      )}
                      {' — '}
                      {getPlanRange(
                        plan.code
                      )}
                      {plan.code ===
                      current?.plan?.code
                        ? ' (actuel)'
                        : ''}
                    </option>
                  )
                )}

              </select>

            </div>

            <div>

              <label
                htmlFor="note"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Motif / note
              </label>

              <textarea
                id="note"
                name="note"
                rows={4}
                maxLength={500}
                placeholder="Ex. Passage au plan Standard après validation de l'abonnement..."
                className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />

            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">

              <p className="text-sm font-black text-amber-950">
                Confirmation administrative
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800">
                Pour le moment, cette action
                active manuellement la formule.
                Lorsque les paiements
                d&apos;abonnement seront
                intégrés, nous rattacherons cette
                activation à une transaction
                confirmée.
              </p>

            </div>

            <div className="flex justify-end">

              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Confirmer le changement
              </button>

            </div>

          </form>

        </section>

        {/* PERIODE ACTUELLE */}

        {current && (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <Header
              title="Période actuelle"
              description="Informations de l’abonnement actuellement actif."
            />

            <div className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">

              <Info
                label="Début"
                value={
                  formatDateTime(
                    current.starts_at
                  )
                }
              />

              <Info
                label="Cycle"
                value={
                  formatBillingCycle(
                    current.billing_cycle
                  )
                }
              />

              <Info
                label="Fin de période"
                value={
                  current.current_period_end
                    ? formatDateTime(
                        current.current_period_end
                      )
                    : 'Sans échéance'
                }
              />

              <Info
                label="Tarif"
                value={
                  formatPlanPrice(
                    current.plan
                  )
                }
              />

            </div>

          </section>
        )}

        {/* HISTORIQUE */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <Header
            title="Historique des abonnements"
            description={`${history.length} abonnement(s) enregistré(s).`}
          />

          {history.length ===
          0 ? (

            <div className="p-10 text-center text-sm font-semibold text-slate-500">
              Aucun historique disponible.
            </div>

          ) : (

            <div className="divide-y divide-slate-100">

              {history.map(
                item => (
                  <article
                    key={
                      item.subscription_id
                    }
                    className="p-6"
                  >

                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <p className="font-black text-slate-900">
                            {
                              item.plan_name
                            }
                          </p>

                          <HistoryStatus
                            status={
                              item.status
                            }
                          />

                        </div>

                        <p className="mt-2 text-sm font-semibold text-slate-500">
                          {item.is_custom_pricing
                            ? 'Sur devis'
                            : formatMoney(
                                numberValue(
                                  item.monthly_price_xof
                                )
                              )}
                        </p>

                        {item.notes && (
                          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                            {
                              item.notes
                            }
                          </p>
                        )}

                      </div>

                      <div className="text-sm md:text-right">

                        <p className="font-bold text-slate-700">
                          Début :{' '}
                          {formatDate(
                            item.starts_at
                          )}
                        </p>

                        <p className="mt-1 font-semibold text-slate-400">
                          Fin :{' '}
                          {item.ended_at
                            ? formatDate(
                                item.ended_at
                              )
                            : 'En cours'}
                        </p>

                      </div>

                    </div>

                  </article>
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
// COMPONENTS
// ============================================================

function Stat({
  label,
  value,
  note,
  warning = false,
}: {
  label: string
  value: string
  note: string
  warning?: boolean
}) {
  return (
    <div
      className={
        warning
          ? 'rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm'
          : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
      }
    >
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p
        className={`mt-3 text-2xl font-black ${
          warning
            ? 'text-amber-900'
            : 'text-slate-950'
        }`}
      >
        {
          value
        }
      </p>

      <p className="mt-2 text-xs font-semibold text-slate-500">
        {
          note
        }
      </p>
    </div>
  )
}

function PlanPanel({
  title,
  plan,
  subtitle,
  recommended = false,
}: {
  title: string

  plan:
    | Plan
    | null

  subtitle: string

  recommended?: boolean
}) {
  return (
    <section
      className={
        recommended
          ? 'rounded-3xl border-2 border-emerald-400 bg-white p-6 shadow-sm'
          : 'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'
      }
    >

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          title
        }
      </p>

      {plan ? (
        <>
          <h2 className="mt-3 text-2xl font-black text-slate-950">
            {
              plan.name
            }
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            {
              subtitle
            }
          </p>

          <p className="mt-5 text-xl font-black text-emerald-700">
            {formatPlanPrice(
              plan
            )}
          </p>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            {getPlanRange(
              plan.code
            )}
          </p>
        </>
      ) : (
        <p className="mt-4 font-black text-slate-500">
          Aucun abonnement
        </p>
      )}

    </section>
  )
}

function Header({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-b border-slate-100 px-6 py-5">

      <h2 className="text-lg font-black text-slate-950">
        {
          title
        }
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {
          description
        }
      </p>

    </div>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-2 text-sm font-black text-slate-800">
        {
          value
        }
      </p>

    </div>
  )
}

function HistoryStatus({
  status,
}: {
  status: string
}) {
  const styles:
    Record<string, string> = {
      active:
        'bg-emerald-50 text-emerald-700',

      trialing:
        'bg-blue-50 text-blue-700',

      past_due:
        'bg-amber-50 text-amber-700',

      replaced:
        'bg-slate-100 text-slate-600',

      cancelled:
        'bg-red-50 text-red-700',

      expired:
        'bg-slate-100 text-slate-500',
  }

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
        styles[status] ??
        'bg-slate-100 text-slate-600'
      }`}
    >
      {formatSubscriptionStatus(
        status
      )}
    </span>
  )
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
  return Math.round(
    value
  ).toLocaleString(
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
  )} FCFA / mois`
}

function formatPlanPrice(
  plan: Plan
) {
  if (
    plan.is_custom_pricing
  ) {
    return 'Sur devis'
  }

  const amount =
    numberValue(
      plan.monthly_price_xof
    )

  if (
    amount === 0
  ) {
    return 'Gratuit'
  }

  return formatMoney(
    amount
  )
}

function getPlanRange(
  code:
    | string
    | null
    | undefined
) {
  switch (
    code
  ) {
    case 'free':
      return '0 à 20 membres'

    case 'standard':
      return '21 à 50 membres'

    case 'pro':
      return '51 à 500 membres'

    case 'enterprise':
      return '501 membres et plus'

    default:
      return '—'
  }
}

function formatSubscriptionStatus(
  status:
    | string
    | null
) {
  switch (
    status
  ) {
    case 'active':
      return 'Actif'

    case 'trialing':
      return 'Essai'

    case 'past_due':
      return 'En retard'

    case 'replaced':
      return 'Remplacé'

    case 'cancelled':
      return 'Annulé'

    case 'expired':
      return 'Expiré'

    default:
      return 'Inconnu'
  }
}

function formatBillingCycle(
  value: string
) {
  switch (
    value
  ) {
    case 'free':
      return 'Gratuit'

    case 'monthly':
      return 'Mensuel'

    case 'yearly':
      return 'Annuel'

    case 'custom':
      return 'Personnalisé'

    default:
      return value
  }
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

  return new Intl.DateTimeFormat(
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
  ).format(
    date
  )
}

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}