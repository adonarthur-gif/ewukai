import Link from 'next/link'
import type {
  ReactNode,
} from 'react'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// EWUKAI
// SUPER ADMIN
// ABONNEMENTS DES ORGANISATIONS
// ============================================================
//
// Grille EWUKAI :
//
// Gratuit
//   0 à 20 membres
//   0 FCFA / mois
//
// Standard
//   21 à 50 membres
//   5 000 FCFA / mois
//
// Pro
//   51 à 500 membres
//   10 000 FCFA / mois
//
// Entreprise
//   501 membres et plus
//   Sur devis
//
// ============================================================

// ============================================================
// TYPES
// ============================================================

type PageProps = {
  searchParams: Promise<{
    q?: string
    plan?: string
    status?: string
  }>
}

type MoneyValue =
  | number
  | string
  | null

type SubscriptionRow = {
  organization_id: string

  organization_name: string

  organization_short_name:
    | string
    | null

  organization_status:
    | string
    | null

  total_members:
    MoneyValue

  active_members:
    MoneyValue

  subscription_id:
    | string
    | null

  plan_id:
    | string
    | null

  plan_code:
    | string
    | null

  plan_name:
    | string
    | null

  monthly_price_xof:
    MoneyValue

  member_limit:
    number
    | null

  is_custom_pricing:
    boolean
    | null

  subscription_status:
    | string
    | null

  billing_cycle:
    | string
    | null

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
    | null

  recommended_plan_id:
    | string
    | null

  recommended_plan_code:
    | string
    | null

  recommended_plan_name:
    | string
    | null

  recommended_monthly_price_xof:
    MoneyValue

  recommended_member_limit:
    number
    | null

  plan_alignment: string

  total_count:
    MoneyValue
}

type Stats = {
  total_organizations:
    MoneyValue

  active_subscriptions:
    MoneyValue

  paid_subscriptions:
    MoneyValue

  free_subscriptions:
    MoneyValue

  past_due_subscriptions:
    MoneyValue

  upgrade_recommended:
    MoneyValue

  estimated_monthly_revenue_xof:
    MoneyValue
}


type CollectionRow = {
  organization_id: string

  organization_name: string

  organization_short_name:
    | string
    | null

  invoice_id: string

  invoice_number: string

  plan_code:
    | string
    | null

  plan_name:
    | string
    | null

  stored_status: string

  effective_status: string

  currency: string

  total_xof:
    MoneyValue

  amount_paid_xof:
    MoneyValue

  amount_remaining_xof:
    MoneyValue

  issued_at:
    | string
    | null

  due_at:
    | string
    | null
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminSubscriptionsPage({
  searchParams,
}: PageProps) {
  const query =
    await searchParams

  // ==========================================================
  // FILTRES
  // ==========================================================

  const search =
    query.q
      ?.trim()
      .slice(
        0,
        120
      ) ??
    ''

  const planFilter =
    normalizePlanFilter(
      query.plan
    )

  const statusFilter =
    normalizeStatusFilter(
      query.status
    )

  // ==========================================================
  // SUPER ADMIN
  // ==========================================================

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  // ==========================================================
  // DONNEES
  // ==========================================================

  const [
    subscriptionsResult,
    statsResult,
    collectionResult,
  ] =
    await Promise.all([

      supabase.rpc(
        'list_platform_subscriptions',
        {
          search_text:
            search ||
            null,

          plan_code_filter:
            planFilter ||
            null,

          status_filter:
            statusFilter ||
            null,

          limit_count:
            100,

          offset_count:
            0,
        }
      ),

      supabase.rpc(
        'get_platform_subscription_admin_stats'
      ),

      supabase.rpc(
        'list_platform_subscription_collection'
      ),

    ])

  // ==========================================================
  // ERREURS
  // ==========================================================

  if (
    subscriptionsResult.error
  ) {
    console.error(
      'EWUKAI - admin subscriptions:',
      subscriptionsResult.error
    )
  }

  if (
    statsResult.error
  ) {
    console.error(
      'EWUKAI - subscription stats:',
      statsResult.error
    )
  }

  if (
    collectionResult.error
  ) {
    console.error(
      'EWUKAI - subscription collection:',
      collectionResult.error
    )
  }

  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const subscriptions =
    (
      Array.isArray(
        subscriptionsResult.data
      )
        ? subscriptionsResult.data
        : []
    ) as SubscriptionRow[]

  const stats =
    (
      statsResult.data ??
      {}
    ) as Stats

  const collectionRows =
    (
      Array.isArray(
        collectionResult.data
      )
        ? collectionResult.data
        : []
    ) as CollectionRow[]

  const collectionByOrganization =
    new Map<
      string,
      CollectionRow
    >()

  for (
    const collection of
      collectionRows
  ) {
    if (
      !collectionByOrganization.has(
        collection.organization_id
      )
    ) {
      collectionByOrganization.set(
        collection.organization_id,
        collection
      )
    }
  }

  const invoiceCountToCollect =
    collectionRows.length

  const pendingPlanRequests =
    collectionRows.filter(
      item =>
        [
          'standard',
          'pro',
        ].includes(
          item.plan_code
            ?.trim()
            .toLowerCase() ??
          ''
        ) &&
        numberValue(
          item.amount_remaining_xof
        ) > 0
    ).length

  const overdueInvoiceCount =
    collectionRows.filter(
      item =>
        item.effective_status ===
        'overdue'
    ).length

  const amountToCollect =
    collectionRows.reduce(
      (total, item) =>
        total +
        numberValue(
          item.amount_remaining_xof
        ),
      0
    )

  const totalResults =
    subscriptions[0]
      ? numberValue(
          subscriptions[0]
            .total_count
        )
      : 0

  const totalOrganizations =
    numberValue(
      stats.total_organizations
    )

  const paidSubscriptions =
    numberValue(
      stats.paid_subscriptions
    )

  const freeSubscriptions =
    numberValue(
      stats.free_subscriptions
    )

  const upgradesRecommended =
    numberValue(
      stats.upgrade_recommended
    )

  const pastDueSubscriptions =
    numberValue(
      stats.past_due_subscriptions
    )

  const estimatedRevenue =
    numberValue(
      stats.estimated_monthly_revenue_xof
    )

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
                Monétisation EWUKAI
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Abonnements
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                Supervisez les formules utilisées
                par les organisations, contrôlez
                leur nombre de membres et repérez
                les structures ayant dépassé les
                limites de leur abonnement.
              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              <Link
                href="/admin/billing"
                className="inline-flex w-fit items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
              >
                Facturation & recouvrement →
              </Link>

              <Link
                href="/admin/plans"
                className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Voir les plans
              </Link>

            </div>

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
            label="Organisations"
            value={
              formatNumber(
                totalOrganizations
              )
            }
            note="Sur la plateforme"
          />

          <StatCard
            label="Plans payants"
            value={
              formatNumber(
                paidSubscriptions
              )
            }
            note={`${formatNumber(
              freeSubscriptions
            )} sur le plan Gratuit`}
          />

          <StatCard
            label="Montées en gamme"
            value={
              formatNumber(
                upgradesRecommended
              )
            }
            note="Plan inférieur au besoin réel"
            warning={
              upgradesRecommended >
              0
            }
          />

          <StatCard
            label="Revenu mensuel estimé"
            value={
              formatMoney(
                estimatedRevenue
              )
            }
            note="Hors offres Entreprise sur devis"
          />

        </section>

        {/* ================================================== */}
        {/* RESUME SECONDAIRE */}
        {/* ================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <MiniStat
            label="Demandes de formule"
            value={
              pendingPlanRequests
            }
            warning={
              pendingPlanRequests >
              0
            }
          />

          <MiniStat
            label="Abonnements en retard"
            value={
              pastDueSubscriptions
            }
            warning={
              pastDueSubscriptions >
              0
            }
          />

          <CollectionMiniStat
            label="Factures à recouvrer"
            value={formatNumber(
              invoiceCountToCollect
            )}
            note={`${formatNumber(
              overdueInvoiceCount
            )} en retard`}
            warning={
              overdueInvoiceCount >
              0
            }
          />

          <CollectionMiniStat
            label="Montant à recouvrer"
            value={formatInvoiceMoney(
              amountToCollect
            )}
            note="Factures ouvertes EWUKAI"
            warning={
              amountToCollect >
              0
            }
          />

        </section>

        {/* ================================================== */}
        {/* FILTRES */}
        {/* ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <form
            action="/admin/subscriptions"
            method="get"
            className="grid gap-4 lg:grid-cols-[1fr_190px_190px_auto]"
          >

            {/* RECHERCHE */}

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
                placeholder="Nom de l'organisation..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />

            </div>

            {/* PLAN */}

            <div>

              <label
                htmlFor="plan"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Plan
              </label>

              <select
                id="plan"
                name="plan"
                defaultValue={
                  planFilter
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500"
              >

                <option value="">
                  Tous
                </option>

                <option value="free">
                  Gratuit
                </option>

                <option value="standard">
                  Standard
                </option>

                <option value="pro">
                  Pro
                </option>

                <option value="enterprise">
                  Entreprise
                </option>

              </select>

            </div>

            {/* STATUT */}

            <div>

              <label
                htmlFor="status"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Statut
              </label>

              <select
                id="status"
                name="status"
                defaultValue={
                  statusFilter
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-500"
              >

                <option value="">
                  Tous
                </option>

                <option value="active">
                  Actif
                </option>

                <option value="trialing">
                  Essai
                </option>

                <option value="past_due">
                  En retard
                </option>

                <option value="cancelled">
                  Annulé
                </option>

                <option value="expired">
                  Expiré
                </option>

                <option value="missing">
                  Sans abonnement
                </option>

              </select>

            </div>

            {/* ACTIONS */}

            <div className="flex items-end gap-2">

              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Filtrer
              </button>

              {(search ||
                planFilter ||
                statusFilter) && (
                <Link
                  href="/admin/subscriptions"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Effacer
                </Link>
              )}

            </div>

          </form>

        </section>

        {/* ================================================== */}
        {/* ERREURS */}
        {/* ================================================== */}

        {(subscriptionsResult.error ||
          statsResult.error ||
          collectionResult.error) && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Certaines informations n&apos;ont
              pas pu être chargées.
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              Vérifiez les fonctions
              d&apos;administration des
              abonnements dans Supabase.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* ALERTE MISE A NIVEAU */}
        {/* ================================================== */}

        {upgradesRecommended >
          0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

            <p className="font-black text-amber-950">
              Des organisations dépassent leur formule
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              {formatNumber(
                upgradesRecommended
              )}{' '}
              organisation(s) disposent
              actuellement d&apos;un plan inférieur
              à celui recommandé selon leur nombre
              de membres.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* LISTE */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* HEADER */}

          <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-lg font-black text-slate-950">
                Organisations & abonnements
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Comparez le plan actuel avec le
                besoin réel de chaque
                organisation.
              </p>

            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {formatNumber(
                totalResults
              )}{' '}
              résultat(s)
            </span>

          </div>

          {/* ================================================== */}
          {/* VIDE */}
          {/* ================================================== */}

          {!subscriptionsResult.error &&
            subscriptions.length ===
              0 && (
              <div className="px-6 py-16 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  ◫
                </div>

                <p className="mt-4 font-black text-slate-900">
                  Aucun abonnement trouvé
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Modifiez vos critères de
                  recherche ou vérifiez les
                  abonnements disponibles.
                </p>

              </div>
            )}

          {/* ================================================== */}
          {/* DESKTOP */}
          {/* ================================================== */}

          {subscriptions.length >
            0 && (
            <>

              <div className="hidden overflow-x-auto lg:block">

                <table className="w-full border-collapse">

                  <thead className="bg-slate-50">

                    <tr>

                      <Heading>
                        Organisation
                      </Heading>

                      <Heading align="right">
                        Membres
                      </Heading>

                      <Heading>
                        Plan actuel
                      </Heading>

                      <Heading>
                        Plan recommandé
                      </Heading>

                      <Heading>
                        Statut
                      </Heading>

                      <Heading align="right">
                        Tarif
                      </Heading>

                      <Heading>
                        Situation
                      </Heading>

                      <Heading>
                        Recouvrement
                      </Heading>

                      <Heading align="right">
                        Action
                      </Heading>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {subscriptions.map(
                      item => (
                        <tr
                          key={
                            item.organization_id
                          }
                          className="align-middle transition hover:bg-slate-50/70"
                        >

                          {/* ================================== */}
                          {/* ORGANISATION */}
                          {/* ================================== */}

                          <td className="px-6 py-5">

                            <Link
                              href={`/admin/organizations/${item.organization_id}`}
                              className="font-black text-slate-900 transition hover:text-emerald-700"
                            >
                              {item.organization_short_name ||
                                item.organization_name}
                            </Link>

                            {item.organization_short_name && (
                              <p className="mt-1 max-w-xs text-xs font-semibold text-slate-400">
                                {
                                  item.organization_name
                                }
                              </p>
                            )}

                            <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                              {formatOrganizationStatus(
                                item.organization_status
                              )}
                            </p>

                          </td>

                          {/* ================================== */}
                          {/* MEMBRES */}
                          {/* ================================== */}

                          <td className="whitespace-nowrap px-6 py-5 text-right">

                            <p className="font-black text-slate-900">
                              {formatNumber(
                                numberValue(
                                  item.active_members
                                )
                              )}
                            </p>

                            <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                              actifs /{' '}
                              {formatNumber(
                                numberValue(
                                  item.total_members
                                )
                              )}{' '}
                              total
                            </p>

                          </td>

                          {/* ================================== */}
                          {/* PLAN ACTUEL */}
                          {/* ================================== */}

                          <td className="px-6 py-5">

                            {item.plan_name ? (
                              <>

                                <PlanBadge
                                  code={
                                    item.plan_code
                                  }
                                  name={
                                    item.plan_name
                                  }
                                />

                                <p className="mt-2 text-[10px] font-bold text-slate-400">
                                  {getPlanRange(
                                    item.plan_code
                                  )}
                                </p>

                              </>
                            ) : (
                              <span className="text-xs font-black text-red-600">
                                Aucun
                              </span>
                            )}

                          </td>

                          {/* ================================== */}
                          {/* PLAN RECOMMANDE */}
                          {/* ================================== */}

                          <td className="px-6 py-5">

                            <PlanBadge
                              code={
                                item.recommended_plan_code
                              }
                              name={
                                item.recommended_plan_name ||
                                '—'
                              }
                            />

                            <p className="mt-2 text-[10px] font-bold text-slate-400">
                              {getPlanRange(
                                item.recommended_plan_code
                              )}
                            </p>

                          </td>

                          {/* ================================== */}
                          {/* STATUT */}
                          {/* ================================== */}

                          <td className="px-6 py-5">

                            <SubscriptionStatus
                              status={
                                item.subscription_status
                              }
                            />

                            {item.cancel_at_period_end && (
                              <p className="mt-2 text-[10px] font-black uppercase text-amber-600">
                                Résiliation prévue
                              </p>
                            )}

                          </td>

                          {/* ================================== */}
                          {/* TARIF */}
                          {/* ================================== */}

                          <td className="whitespace-nowrap px-6 py-5 text-right">

                            <p className="font-black text-slate-900">

                              {item.is_custom_pricing
                                ? 'Sur devis'
                                : formatCurrentPlanPrice(
                                    item
                                  )}

                            </p>

                            {item.billing_cycle && (
                              <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                                {formatBillingCycle(
                                  item.billing_cycle
                                )}
                              </p>
                            )}

                          </td>

                          {/* ================================== */}
                          {/* SITUATION */}
                          {/* ================================== */}

                          <td className="px-6 py-5">

                            <AlignmentBadge
                              alignment={
                                item.plan_alignment
                              }
                            />

                          </td>

                          {/* ================================== */}
                          {/* RECOUVREMENT */}
                          {/* ================================== */}

                          <td className="px-6 py-5">

                            <CollectionCell
                              collection={
                                collectionByOrganization.get(
                                  item.organization_id
                                )
                              }
                            />

                          </td>

                          {/* ================================== */}
                          {/* ACTION */}
                          {/* ================================== */}

                          <td className="px-6 py-5 text-right">

                            <Link
                              href={`/admin/subscriptions/${item.organization_id}`}
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              Gérer
                            </Link>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

              {/* ================================================== */}
              {/* MOBILE */}
              {/* ================================================== */}

              <div className="divide-y divide-slate-100 lg:hidden">

                {subscriptions.map(
                  item => (
                    <article
                      key={
                        item.organization_id
                      }
                      className="p-5"
                    >

                      {/* HEADER MOBILE */}

                      <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">

                          <Link
                            href={`/admin/organizations/${item.organization_id}`}
                            className="font-black text-slate-900 transition hover:text-emerald-700"
                          >
                            {item.organization_short_name ||
                              item.organization_name}
                          </Link>

                          {item.organization_short_name && (
                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              {
                                item.organization_name
                              }
                            </p>
                          )}

                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {formatNumber(
                              numberValue(
                                item.active_members
                              )
                            )}{' '}
                            membre(s) actif(s)
                          </p>

                        </div>

                        <AlignmentBadge
                          alignment={
                            item.plan_alignment
                          }
                        />

                      </div>

                      {/* INFOS MOBILE */}

                      <div className="mt-5 grid grid-cols-2 gap-3">

                        <MobileInfo
                          label="Plan actuel"
                          value={
                            item.plan_name ||
                            'Aucun'
                          }
                        />

                        <MobileInfo
                          label="Plan recommandé"
                          value={
                            item.recommended_plan_name ||
                            '—'
                          }
                        />

                        <MobileInfo
                          label="Statut"
                          value={
                            formatSubscriptionStatus(
                              item.subscription_status
                            )
                          }
                        />

                        <MobileInfo
                          label="Tarif"
                          value={
                            item.is_custom_pricing
                              ? 'Sur devis'
                              : formatCurrentPlanPrice(
                                  item
                                )
                          }
                        />

                        <MobileInfo
                          label="Membres"
                          value={`${formatNumber(
                            numberValue(
                              item.active_members
                            )
                          )} / ${formatNumber(
                            numberValue(
                              item.total_members
                            )
                          )}`}
                        />

                        <MobileInfo
                          label="Cycle"
                          value={
                            formatBillingCycle(
                              item.billing_cycle
                            )
                          }
                        />

                      </div>

                      <MobileCollection
                        collection={
                          collectionByOrganization.get(
                            item.organization_id
                          )
                        }
                      />

                      {/* ACTIONS MOBILE */}

                      <div className="mt-5 flex flex-col gap-2 sm:flex-row">

                        <Link
                          href={`/admin/subscriptions/${item.organization_id}`}
                          className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800"
                        >
                          Gérer l&apos;abonnement →
                        </Link>

                        <Link
                          href={`/admin/organizations/${item.organization_id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                        >
                          Voir l&apos;organisation
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
        {/* REGLES TARIFAIRES */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-6 py-5">

            <h2 className="text-lg font-black text-slate-950">
              Règles de recommandation
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Le plan recommandé dépend du nombre
              de membres actifs de
              l&apos;organisation.
            </p>

          </div>

          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">

            <PlanRule
              name="Gratuit"
              members="0 à 20"
              price="0 FCFA"
            />

            <PlanRule
              name="Standard"
              members="21 à 50"
              price="5 000 FCFA / mois"
            />

            <PlanRule
              name="Pro"
              members="51 à 500"
              price="10 000 FCFA / mois"
            />

            <PlanRule
              name="Entreprise"
              members="501 et plus"
              price="Sur devis"
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* NOTE */}
        {/* ================================================== */}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Le changement de formule reste une action contrôlée
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            Cette page détecte automatiquement
            les dépassements, recommande une
            formule adaptée et fait maintenant
            apparaître les factures à recouvrer.
            Le bouton <strong>Recouvrer</strong> ouvre
            la facture concernée pour son suivi.
            La validation du règlement reste
            automatique après confirmation du
            prestataire : le Super-administrateur
            ne marque pas une facture payée
            manuellement.
          </p>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// KPI
// ============================================================

function StatCard({
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
        className={`mt-3 text-3xl font-black ${
          warning
            ? 'text-amber-900'
            : 'text-slate-950'
        }`}
      >
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

// ============================================================
// MINI KPI
// ============================================================

function MiniStat({
  label,
  value,
  warning = false,
}: {
  label: string
  value: number
  warning?: boolean
}) {
  return (
    <div
      className={
        warning
          ? 'flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4'
          : 'flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm'
      }
    >

      <p
        className={
          warning
            ? 'text-sm font-black text-amber-900'
            : 'text-sm font-black text-slate-700'
        }
      >
        {
          label
        }
      </p>

      <p
        className={
          warning
            ? 'text-xl font-black text-amber-900'
            : 'text-xl font-black text-slate-950'
        }
      >
        {formatNumber(
          value
        )}
      </p>

    </div>
  )
}

// ============================================================
// KPI RECOUVREMENT
// ============================================================

function CollectionMiniStat({
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
          ? 'rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4'
          : 'rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4'
      }
    >

      <div className="flex items-center justify-between gap-3">

        <p
          className={
            warning
              ? 'text-sm font-black text-amber-900'
              : 'text-sm font-black text-emerald-900'
          }
        >
          {label}
        </p>

        <span
          className={
            warning
              ? 'rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700'
              : 'rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700'
          }
        >
          Recouvrement
        </span>

      </div>

      <p
        className={
          warning
            ? 'mt-2 text-xl font-black text-amber-950'
            : 'mt-2 text-xl font-black text-emerald-950'
        }
      >
        {value}
      </p>

      <p
        className={
          warning
            ? 'mt-1 text-[11px] font-semibold text-amber-700'
            : 'mt-1 text-[11px] font-semibold text-emerald-700'
        }
      >
        {note}
      </p>

    </div>
  )
}

// ============================================================
// CELLULE RECOUVREMENT
// ============================================================

function CollectionCell({
  collection,
}: {
  collection?: CollectionRow
}) {
  if (!collection) {
    return (
      <div>
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
          À jour
        </span>
        <p className="mt-2 text-[10px] font-semibold text-slate-400">
          Aucune facture ouverte
        </p>
      </div>
    )
  }

  const overdue =
    collection.effective_status ===
      'overdue'

  return (
    <div className="min-w-[150px]">

      {collection.plan_name && (
        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-amber-700">
          Demande {collection.plan_name}
        </p>
      )}

      <p
        className={
          overdue
            ? 'font-black text-red-700'
            : 'font-black text-slate-900'
        }
      >
        {formatInvoiceMoney(
          numberValue(
            collection.amount_remaining_xof
          )
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">

        <span
          className={
            overdue
              ? 'rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-red-700'
              : 'rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700'
          }
        >
          {overdue
            ? 'En retard'
            : 'À payer'}
        </span>

        <Link
          href={`/admin/billing/${collection.invoice_id}`}
          className={
            overdue
              ? 'text-[10px] font-black text-red-700 underline underline-offset-2'
              : 'text-[10px] font-black text-emerald-700 underline underline-offset-2'
          }
        >
          Voir facture →
        </Link>

      </div>

      <p className="mt-2 text-[10px] font-semibold text-slate-400">
        {collection.invoice_number}
      </p>

      <p className="mt-1 text-[10px] font-semibold text-slate-400">
        Échéance {formatShortDate(
          collection.due_at
        )}
      </p>

    </div>
  )
}

// ============================================================
// RECOUVREMENT MOBILE
// ============================================================

function MobileCollection({
  collection,
}: {
  collection?: CollectionRow
}) {
  if (!collection) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-xs font-black uppercase text-emerald-700">
          Recouvrement à jour
        </p>
        <p className="mt-1 text-xs font-semibold text-emerald-800">
          Aucune facture EWUKAI ouverte.
        </p>
      </div>
    )
  }

  const overdue =
    collection.effective_status ===
      'overdue'

  return (
    <div
      className={
        overdue
          ? 'mt-4 rounded-2xl border border-red-200 bg-red-50 p-4'
          : 'mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4'
      }
    >

      <div className="flex items-start justify-between gap-3">

        <div>
          <p
            className={
              overdue
                ? 'text-[10px] font-black uppercase text-red-700'
                : 'text-[10px] font-black uppercase text-blue-700'
            }
          >
            {collection.plan_name
              ? `Demande ${collection.plan_name}`
              : overdue
                ? 'Recouvrement en retard'
                : 'Facture à régler'}
          </p>

          <p
            className={
              overdue
                ? 'mt-1 text-lg font-black text-red-950'
                : 'mt-1 text-lg font-black text-blue-950'
            }
          >
            {formatInvoiceMoney(
              numberValue(
                collection.amount_remaining_xof
              )
            )}
          </p>

          <p
            className={
              overdue
                ? 'mt-1 text-xs font-semibold text-red-700'
                : 'mt-1 text-xs font-semibold text-blue-700'
            }
          >
            {collection.invoice_number} · échéance{' '}
            {formatShortDate(
              collection.due_at
            )}
          </p>
        </div>

        <Link
          href={`/admin/billing/${collection.invoice_id}`}
          className={
            overdue
              ? 'inline-flex shrink-0 items-center justify-center rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700'
              : 'inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-800'
          }
        >
          Voir facture
        </Link>

      </div>

    </div>
  )
}

// ============================================================
// TABLE HEADING
// ============================================================

function Heading({
  children,
  align = 'left',
}: {
  children: ReactNode
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

// ============================================================
// PLAN BADGE
// ============================================================

function PlanBadge({
  code,
  name,
}: {
  code:
    | string
    | null

  name: string
}) {
  const styles:
    Record<
      string,
      string
    > = {
      free:
        'bg-slate-100 text-slate-700',

      standard:
        'bg-blue-50 text-blue-700',

      pro:
        'bg-emerald-50 text-emerald-700',

      enterprise:
        'bg-violet-50 text-violet-700',
    }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
        styles[code ?? ''] ??
        'bg-slate-100 text-slate-600'
      }`}
    >
      {
        name
      }
    </span>
  )
}

// ============================================================
// STATUT ABONNEMENT
// ============================================================

function SubscriptionStatus({
  status,
}: {
  status:
    | string
    | null
}) {
  const label =
    formatSubscriptionStatus(
      status
    )

  const styles:
    Record<
      string,
      string
    > = {
      active:
        'bg-emerald-50 text-emerald-700',

      trialing:
        'bg-blue-50 text-blue-700',

      past_due:
        'bg-amber-50 text-amber-700',

      pending_payment:
        'bg-amber-50 text-amber-700',

      cancelled:
        'bg-red-50 text-red-700',

      expired:
        'bg-slate-100 text-slate-600',

      replaced:
        'bg-slate-100 text-slate-500',
    }

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
        styles[status ?? ''] ??
        'bg-red-50 text-red-700'
      }`}
    >
      {
        label
      }
    </span>
  )
}

// ============================================================
// ALIGNEMENT
// ============================================================

function AlignmentBadge({
  alignment,
}: {
  alignment: string
}) {
  switch (
    alignment
  ) {
    case 'aligned':
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
          Conforme
        </span>
      )

    case 'upgrade_recommended':
      return (
        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">
          Mise à niveau
        </span>
      )

    case 'higher_plan':
      return (
        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700">
          Plan supérieur
        </span>
      )

    case 'inactive':
      return (
        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-red-700">
          Abonnement inactif
        </span>
      )

    case 'missing':
      return (
        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-red-700">
          Sans abonnement
        </span>
      )

    default:
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
          À vérifier
        </span>
      )
  }
}

// ============================================================
// MOBILE INFO
// ============================================================

function MobileInfo({
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

      <p className="mt-1 text-sm font-black text-slate-800">
        {
          value
        }
      </p>

    </div>
  )
}

// ============================================================
// REGLE PLAN
// ============================================================

function PlanRule({
  name,
  members,
  price,
}: {
  name: string
  members: string
  price: string
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">

      <p className="font-black text-slate-900">
        {
          name
        }
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-500">
        {
          members
        }{' '}
        membres
      </p>

      <p className="mt-3 text-sm font-black text-emerald-700">
        {
          price
        }
      </p>

    </div>
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

function formatShortDate(
  value:
    | string
    | null
) {
  if (!value) {
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
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  ).format(
    date
  )
}

function formatCurrentPlanPrice(
  item: SubscriptionRow
) {
  if (
    item.is_custom_pricing
  ) {
    return 'Sur devis'
  }

  const amount =
    numberValue(
      item.monthly_price_xof
    )

  if (
    amount ===
    0
  ) {
    return 'Gratuit'
  }

  return formatMoney(
    amount
  )
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

    case 'cancelled':
      return 'Annulé'

    case 'expired':
      return 'Expiré'

    case 'replaced':
      return 'Remplacé'

    default:
      return 'Sans abonnement'
  }
}

function formatBillingCycle(
  value:
    | string
    | null
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
      return '—'
  }
}

function formatOrganizationStatus(
  status:
    | string
    | null
) {
  switch (
    status
  ) {
    case 'active':
      return 'Organisation active'

    case 'inactive':
      return 'Organisation inactive'

    case 'suspended':
      return 'Organisation suspendue'

    default:
      return status ||
        'Statut non renseigné'
  }
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

function normalizePlanFilter(
  value:
    | string
    | undefined
) {
  const plan =
    value
      ?.trim()
      .toLowerCase() ??
    ''

  return [
    'free',
    'standard',
    'pro',
    'enterprise',
  ].includes(
    plan
  )
    ? plan
    : ''
}

function normalizeStatusFilter(
  value:
    | string
    | undefined
) {
  const status =
    value
      ?.trim()
      .toLowerCase() ??
    ''

  return [
    'active',
    'trialing',
    'past_due',
    'cancelled',
    'expired',
    'missing',
  ].includes(
    status
  )
    ? status
    : ''
}