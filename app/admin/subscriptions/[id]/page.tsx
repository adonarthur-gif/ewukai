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

type CollectionRow = {
  organization_id: string
  invoice_id: string
  invoice_number: string
  plan_code: string | null
  plan_name: string | null
  stored_status: string
  effective_status: string
  currency: string
  total_xof: MoneyValue
  amount_paid_xof: MoneyValue
  amount_remaining_xof: MoneyValue
  issued_at: string | null
  due_at: string | null
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

  const [
    detailResult,
    collectionResult,
  ] =
    await Promise.all([
      supabase.rpc(
        'get_platform_subscription_detail',
        {
          target_organization_id:
            id,
        }
      ),

      supabase.rpc(
        'list_platform_subscription_collection'
      ),
    ])

  if (
    detailResult.error
  ) {
    console.error(
      'EWUKAI - subscription detail:',
      detailResult.error
    )

    if (
      detailResult.error.message
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
    collectionResult.error
  ) {
    console.error(
      'EWUKAI - subscription collection detail:',
      collectionResult.error
    )
  }

  if (
    !detailResult.data
  ) {
    notFound()
  }

  const detail =
    detailResult.data as Detail

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

  const pendingSubscription =
    history.find(
      item =>
        item.status ===
        'pending_payment'
    ) ??
    null

  const collectionRows =
    (
      Array.isArray(
        collectionResult.data
      )
        ? collectionResult.data
        : []
    ) as CollectionRow[]

  const pendingInvoice =
    collectionRows.find(
      item =>
        item.organization_id ===
        id
    ) ??
    null

  const hasPendingRequest =
    Boolean(
      pendingSubscription ||
      pendingInvoice
    )

  const administrativePlans =
    plans.filter(
      plan =>
        [
          'free',
          'enterprise',
        ].includes(
          plan.code
        )
    )

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
              Changement administratif enregistré
            </p>

            <p className="mt-1 text-sm text-emerald-700">
              La modification administrative a été appliquée.
              Les abonnements Standard et Pro restent soumis au
              circuit facture puis paiement confirmé.
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
                : query.error ===
                    'payment_required'
                  ? 'Standard et Pro ne peuvent pas être activés manuellement. La formule doit être demandée, facturée puis réglée.'
                  : query.error ===
                      'pending_request'
                    ? 'Une demande ou une facture est déjà en attente. Traitez-la avant tout changement administratif.'
                    : query.error ===
                        'billing_check'
                      ? 'Impossible de vérifier les factures ouvertes. Aucun changement n’a été effectué.'
                      : query.error ===
                          'plan'
                        ? 'La formule demandée est invalide.'
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

        {/* DEMANDE EN ATTENTE */}

        {hasPendingRequest && (
          <section className="overflow-hidden rounded-3xl border border-amber-200 bg-amber-50 shadow-sm">
            <div className="border-b border-amber-200 px-6 py-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                Demande en attente de paiement
              </p>
              <h2 className="mt-2 text-xl font-black text-slate-950">
                {pendingSubscription?.plan_name ||
                  pendingInvoice?.plan_name ||
                  'Formule payante'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                La formule actuelle reste inchangée tant qu&apos;aucun règlement intégral n&apos;a été confirmé.
              </p>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
              <Info
                label="Formule demandée"
                value={
                  pendingSubscription?.plan_name ||
                  pendingInvoice?.plan_name ||
                  '—'
                }
              />

              <Info
                label="Facture"
                value={
                  pendingInvoice?.invoice_number ||
                  'Préparée'
                }
              />

              <Info
                label="Montant restant"
                value={
                  pendingInvoice
                    ? formatInvoiceMoney(
                        numberValue(
                          pendingInvoice.amount_remaining_xof
                        )
                      )
                    : '—'
                }
              />

              <Info
                label="Statut"
                value={
                  pendingInvoice?.effective_status ===
                  'overdue'
                    ? 'En retard'
                    : 'En attente de paiement'
                }
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-amber-200 px-6 py-5">
              {pendingInvoice && (
                <Link
                  href={`/admin/billing/${pendingInvoice.invoice_id}`}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Voir la facture
                </Link>
              )}

              <Link
                href="/admin/billing"
                className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-black text-amber-900 transition hover:bg-amber-100"
              >
                Facturation & recouvrement
              </Link>
            </div>
          </section>
        )}

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

        {/* GESTION ADMINISTRATIVE */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-black text-slate-950">
              Gestion administrative
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Le Super-administrateur peut gérer directement Gratuit ou Entreprise. Standard et Pro passent obligatoirement par une demande, une facture puis un paiement confirmé.
            </p>
          </div>

          {hasPendingRequest ? (
            <div className="p-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-black text-amber-950">
                  Changement temporairement verrouillé
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Une demande payante est déjà en attente. Consultez sa facture avant d&apos;effectuer un changement administratif.
                </p>
              </div>
            </div>
          ) : (
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
                  Nouvelle formule administrative
                </label>

                <select
                  id="plan_code"
                  name="plan_code"
                  required
                  defaultValue=""
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
                >
                  <option
                    value=""
                    disabled
                  >
                    Choisir une formule
                  </option>

                  {administrativePlans.map(
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
                  placeholder="Ex. Retour au Gratuit ou activation d'une offre Entreprise après validation administrative..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-black text-blue-950">
                  Standard et Pro protégés
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  Ces deux formules ne sont plus activables manuellement depuis le Super Admin. Leur activation sera déclenchée uniquement après confirmation du règlement de la facture EWUKAI.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Appliquer le changement administratif
                </button>
              </div>
            </form>
          )}
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

      pending_payment:
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

function formatInvoiceMoney(
  value: number
) {
  return `${Math.round(
    value
  ).toLocaleString(
    'fr-FR'
  )} FCFA`
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

    case 'pending_payment':
      return 'En attente de paiement'

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