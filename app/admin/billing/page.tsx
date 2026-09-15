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
// FACTURATION DES ABONNEMENTS
// ============================================================
//
// Cette page concerne uniquement les revenus commerciaux
// d'EWUKAI.
//
// Elle reste séparée :
// - des cotisations des membres ;
// - de la caisse des mutuelles ;
// - des dépenses des organisations ;
// - de leur propre trésorerie.
//
// ============================================================

// ============================================================
// TYPES
// ============================================================

type PageProps = {
  searchParams: Promise<{
    q?: string
    status?: string
  }>
}

type NumberValue =
  | number
  | string
  | null

type InvoiceRow = {
  invoice_id: string

  invoice_number: string

  organization_id: string

  organization_name: string

  organization_short_name:
    | string
    | null

  subscription_id: string

  plan_code: string

  plan_name: string

  billing_cycle: string

  period_start:
    | string
    | null

  period_end:
    | string
    | null

  total_xof:
    NumberValue

  amount_paid_xof:
    NumberValue

  amount_remaining_xof:
    NumberValue

  stored_status: string

  effective_status: string

  issued_at:
    | string
    | null

  due_at:
    | string
    | null

  paid_at:
    | string
    | null

  total_count:
    NumberValue
}

type BillingStats = {
  total_invoices:
    NumberValue

  open_invoices:
    NumberValue

  overdue_invoices:
    NumberValue

  paid_invoices:
    NumberValue

  cancelled_invoices:
    NumberValue

  total_billed_xof:
    NumberValue

  total_collected_xof:
    NumberValue

  total_outstanding_xof:
    NumberValue

  confirmed_payments:
    NumberValue
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminBillingPage({
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
    invoicesResult,
    statsResult,
  ] =
    await Promise.all([

      supabase.rpc(
        'list_platform_subscription_invoices',
        {
          search_text:
            search ||
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
        'get_platform_billing_stats'
      ),

    ])

  // ==========================================================
  // ERREURS
  // ==========================================================

  if (
    invoicesResult.error
  ) {
    console.error(
      'EWUKAI - billing invoices:',
      invoicesResult.error
    )
  }

  if (
    statsResult.error
  ) {
    console.error(
      'EWUKAI - billing stats:',
      statsResult.error
    )
  }

  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const invoices =
    (
      Array.isArray(
        invoicesResult.data
      )
        ? invoicesResult.data
        : []
    ) as InvoiceRow[]

  const stats =
    (
      statsResult.data ??
      {}
    ) as BillingStats

  const totalResults =
    invoices[0]
      ? numberValue(
          invoices[0]
            .total_count
        )
      : 0

  const totalInvoices =
    numberValue(
      stats.total_invoices
    )

  const totalBilled =
    numberValue(
      stats.total_billed_xof
    )

  const totalCollected =
    numberValue(
      stats.total_collected_xof
    )

  const totalOutstanding =
    numberValue(
      stats.total_outstanding_xof
    )

  const openInvoices =
    numberValue(
      stats.open_invoices
    )

  const overdueInvoices =
    numberValue(
      stats.overdue_invoices
    )

  const paidInvoices =
    numberValue(
      stats.paid_invoices
    )

  const confirmedPayments =
    numberValue(
      stats.confirmed_payments
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
                Revenus EWUKAI
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Facturation
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                Suivez les factures
                d&apos;abonnement, les montants
                facturés, les encaissements,
                les soldes restant dus et les
                échéances des organisations.
              </p>

            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <Link
                href="/admin/plans"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Voir les plans
              </Link>

              <Link
                href="/admin/subscriptions"
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Voir les abonnements
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
        {/* KPI FINANCIERS */}
        {/* ================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            label="Total facturé"
            value={
              formatMoney(
                totalBilled
              )
            }
            note={`${formatNumber(
              totalInvoices
            )} facture(s) générée(s)`}
          />

          <StatCard
            label="Encaissé"
            value={
              formatMoney(
                totalCollected
              )
            }
            note={`${formatNumber(
              confirmedPayments
            )} paiement(s) confirmé(s)`}
            success={
              totalCollected >
              0
            }
          />

          <StatCard
            label="Reste à encaisser"
            value={
              formatMoney(
                totalOutstanding
              )
            }
            note={`${formatNumber(
              openInvoices +
              overdueInvoices
            )} facture(s) à suivre`}
            warning={
              totalOutstanding >
              0
            }
          />

          <StatCard
            label="En retard"
            value={
              formatNumber(
                overdueInvoices
              )
            }
            note="Échéances dépassées"
            danger={
              overdueInvoices >
              0
            }
          />

        </section>

        {/* ================================================== */}
        {/* RESUME */}
        {/* ================================================== */}

        <section className="grid gap-4 sm:grid-cols-3">

          <MiniStat
            label="À payer"
            value={
              openInvoices
            }
          />

          <MiniStat
            label="Payées"
            value={
              paidInvoices
            }
            success={
              paidInvoices >
              0
            }
          />

          <MiniStat
            label="En retard"
            value={
              overdueInvoices
            }
            danger={
              overdueInvoices >
              0
            }
          />

        </section>

        {/* ================================================== */}
        {/* FILTRES */}
        {/* ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <form
            action="/admin/billing"
            method="get"
            className="grid gap-4 lg:grid-cols-[1fr_220px_auto]"
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
                placeholder="Organisation, facture ou plan..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />

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
                  Tous les statuts
                </option>

                <option value="open">
                  À payer
                </option>

                <option value="overdue">
                  En retard
                </option>

                <option value="paid">
                  Payé
                </option>

                <option value="cancelled">
                  Annulé
                </option>

                <option value="draft">
                  Brouillon
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
                statusFilter) && (
                <Link
                  href="/admin/billing"
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

        {(invoicesResult.error ||
          statsResult.error) && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Impossible de charger complètement la facturation.
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              Vérifiez les fonctions de
              facturation dans Supabase.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* ALERTE RETARD */}
        {/* ================================================== */}

        {overdueInvoices >
          0 && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-950">
              Des factures sont en retard
            </p>

            <p className="mt-1 text-sm leading-6 text-red-800">
              {formatNumber(
                overdueInvoices
              )}{' '}
              facture(s) ont dépassé leur date
              d&apos;échéance et nécessitent un
              suivi.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* TABLE FACTURES */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* HEADER */}

          <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-lg font-black text-slate-950">
                Factures d&apos;abonnement
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Facturation commerciale de la
                plateforme EWUKAI.
              </p>

            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {formatNumber(
                totalResults
              )}{' '}
              facture(s)
            </span>

          </div>

          {/* ================================================== */}
          {/* AUCUNE FACTURE */}
          {/* ================================================== */}

          {!invoicesResult.error &&
            invoices.length ===
              0 && (
              <div className="px-6 py-16 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  ◫
                </div>

                <p className="mt-4 font-black text-slate-900">
                  Aucune facture trouvée
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Les factures apparaîtront ici
                  lorsqu&apos;un abonnement payant
                  Standard ou Pro sera activé.
                </p>

              </div>
            )}

          {/* ================================================== */}
          {/* DESKTOP */}
          {/* ================================================== */}

          {invoices.length >
            0 && (
            <>

              <div className="hidden overflow-x-auto lg:block">

                <table className="w-full border-collapse">

                  <thead className="bg-slate-50">

                    <tr>

                      <Heading>
                        Facture
                      </Heading>

                      <Heading>
                        Organisation
                      </Heading>

                      <Heading>
                        Plan
                      </Heading>

                      <Heading>
                        Période
                      </Heading>

                      <Heading align="right">
                        Montant
                      </Heading>

                      <Heading align="right">
                        Payé
                      </Heading>

                      <Heading align="right">
                        Reste
                      </Heading>

                      <Heading>
                        Échéance
                      </Heading>

                      <Heading>
                        Statut
                      </Heading>

                      <Heading align="right">
                        Action
                      </Heading>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {invoices.map(
                      invoice => {
                        const displayStatus =
                          getDisplayInvoiceStatus(
                            invoice
                          )

                        return (
                          <tr
                            key={
                              invoice.invoice_id
                            }
                            className="align-middle transition hover:bg-slate-50/70"
                          >

                            {/* ================================ */}
                            {/* FACTURE */}
                            {/* ================================ */}

                            <td className="whitespace-nowrap px-6 py-5">

                              <Link
                                href={`/admin/billing/${invoice.invoice_id}`}
                                className="font-black text-slate-900 transition hover:text-emerald-700"
                              >
                                {
                                  invoice.invoice_number
                                }
                              </Link>

                              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Émise le{' '}
                                {formatDate(
                                  invoice.issued_at
                                )}
                              </p>

                            </td>

                            {/* ================================ */}
                            {/* ORGANISATION */}
                            {/* ================================ */}

                            <td className="px-6 py-5">

                              <Link
                                href={`/admin/organizations/${invoice.organization_id}`}
                                className="font-black text-slate-900 transition hover:text-emerald-700"
                              >
                                {invoice.organization_short_name ||
                                  invoice.organization_name}
                              </Link>

                              {invoice.organization_short_name && (
                                <p className="mt-1 max-w-xs text-xs font-semibold text-slate-400">
                                  {
                                    invoice.organization_name
                                  }
                                </p>
                              )}

                            </td>

                            {/* ================================ */}
                            {/* PLAN */}
                            {/* ================================ */}

                            <td className="px-6 py-5">

                              <PlanBadge
                                code={
                                  invoice.plan_code
                                }
                                name={
                                  invoice.plan_name
                                }
                              />

                              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                {formatBillingCycle(
                                  invoice.billing_cycle
                                )}
                              </p>

                            </td>

                            {/* ================================ */}
                            {/* PERIODE */}
                            {/* ================================ */}

                            <td className="whitespace-nowrap px-6 py-5">

                              <p className="text-sm font-semibold text-slate-600">
                                {formatDate(
                                  invoice.period_start
                                )}
                              </p>

                              <p className="mt-1 text-xs font-semibold text-slate-400">
                                au{' '}
                                {formatDate(
                                  invoice.period_end
                                )}
                              </p>

                            </td>

                            {/* ================================ */}
                            {/* TOTAL */}
                            {/* ================================ */}

                            <td className="whitespace-nowrap px-6 py-5 text-right font-black text-slate-900">

                              {formatMoney(
                                numberValue(
                                  invoice.total_xof
                                )
                              )}

                            </td>

                            {/* ================================ */}
                            {/* PAYE */}
                            {/* ================================ */}

                            <td className="whitespace-nowrap px-6 py-5 text-right">

                              <p
                                className={
                                  numberValue(
                                    invoice.amount_paid_xof
                                  ) >
                                  0
                                    ? 'font-black text-emerald-700'
                                    : 'font-black text-slate-400'
                                }
                              >
                                {formatMoney(
                                  numberValue(
                                    invoice.amount_paid_xof
                                  )
                                )}
                              </p>

                            </td>

                            {/* ================================ */}
                            {/* RESTE */}
                            {/* ================================ */}

                            <td className="whitespace-nowrap px-6 py-5 text-right">

                              <p
                                className={
                                  numberValue(
                                    invoice.amount_remaining_xof
                                  ) >
                                  0
                                    ? 'font-black text-amber-700'
                                    : 'font-black text-emerald-700'
                                }
                              >
                                {formatMoney(
                                  numberValue(
                                    invoice.amount_remaining_xof
                                  )
                                )}
                              </p>

                            </td>

                            {/* ================================ */}
                            {/* ECHEANCE */}
                            {/* ================================ */}

                            <td className="whitespace-nowrap px-6 py-5">

                              <p
                                className={
                                  displayStatus ===
                                  'overdue'
                                    ? 'text-sm font-black text-red-700'
                                    : 'text-sm font-bold text-slate-600'
                                }
                              >
                                {formatDate(
                                  invoice.due_at
                                )}
                              </p>

                            </td>

                            {/* ================================ */}
                            {/* STATUT */}
                            {/* ================================ */}

                            <td className="px-6 py-5">

                              <InvoiceStatus
                                status={
                                  displayStatus
                                }
                              />

                            </td>

                            {/* ================================ */}
                            {/* ACTION */}
                            {/* ================================ */}

                            <td className="px-6 py-5 text-right">

                              <Link
                                href={`/admin/billing/${invoice.invoice_id}`}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                              >
                                Ouvrir
                              </Link>

                            </td>

                          </tr>
                        )
                      }
                    )}

                  </tbody>

                </table>

              </div>

              {/* ================================================== */}
              {/* MOBILE */}
              {/* ================================================== */}

              <div className="divide-y divide-slate-100 lg:hidden">

                {invoices.map(
                  invoice => {
                    const displayStatus =
                      getDisplayInvoiceStatus(
                        invoice
                      )

                    return (
                      <article
                        key={
                          invoice.invoice_id
                        }
                        className="p-5"
                      >

                        {/* HEADER */}

                        <div className="flex items-start justify-between gap-4">

                          <div className="min-w-0">

                            <Link
                              href={`/admin/billing/${invoice.invoice_id}`}
                              className="font-black text-slate-900"
                            >
                              {
                                invoice.invoice_number
                              }
                            </Link>

                            <Link
                              href={`/admin/organizations/${invoice.organization_id}`}
                              className="mt-1 block truncate text-sm font-bold text-slate-600 transition hover:text-emerald-700"
                            >
                              {invoice.organization_short_name ||
                                invoice.organization_name}
                            </Link>

                          </div>

                          <InvoiceStatus
                            status={
                              displayStatus
                            }
                          />

                        </div>

                        {/* PLAN */}

                        <div className="mt-4">

                          <PlanBadge
                            code={
                              invoice.plan_code
                            }
                            name={
                              invoice.plan_name
                            }
                          />

                        </div>

                        {/* INFOS */}

                        <div className="mt-5 grid grid-cols-2 gap-3">

                          <MobileInfo
                            label="Montant"
                            value={
                              formatMoney(
                                numberValue(
                                  invoice.total_xof
                                )
                              )
                            }
                          />

                          <MobileInfo
                            label="Payé"
                            value={
                              formatMoney(
                                numberValue(
                                  invoice.amount_paid_xof
                                )
                              )
                            }
                          />

                          <MobileInfo
                            label="Reste"
                            value={
                              formatMoney(
                                numberValue(
                                  invoice.amount_remaining_xof
                                )
                              )
                            }
                          />

                          <MobileInfo
                            label="Échéance"
                            value={
                              formatDate(
                                invoice.due_at
                              )
                            }
                          />

                          <MobileInfo
                            label="Période"
                            value={`${formatDate(
                              invoice.period_start
                            )} → ${formatDate(
                              invoice.period_end
                            )}`}
                          />

                          <MobileInfo
                            label="Cycle"
                            value={
                              formatBillingCycle(
                                invoice.billing_cycle
                              )
                            }
                          />

                        </div>

                        {/* ACTIONS */}

                        <div className="mt-5 flex flex-col gap-2 sm:flex-row">

                          <Link
                            href={`/admin/billing/${invoice.invoice_id}`}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800"
                          >
                            Ouvrir la facture →
                          </Link>

                          <Link
                            href={`/admin/subscriptions/${invoice.organization_id}`}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                          >
                            Abonnement
                          </Link>

                        </div>

                      </article>
                    )
                  }
                )}

              </div>

            </>
          )}

        </section>

        {/* ================================================== */}
        {/* RAPPEL COMMERCIAL */}
        {/* ================================================== */}

        <section className="grid gap-4 md:grid-cols-3">

          <BillingRule
            title="Standard"
            price="5 000 FCFA / mois"
            description="Pour les organisations comptant jusqu'à 50 membres."
          />

          <BillingRule
            title="Pro"
            price="10 000 FCFA / mois"
            description="Pour les organisations comptant jusqu'à 500 membres."
          />

          <BillingRule
            title="Entreprise"
            price="Sur devis"
            description="Plus de 500 membres. Pas de facturation automatique."
          />

        </section>

        {/* ================================================== */}
        {/* NOTE */}
        {/* ================================================== */}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Facturation EWUKAI ≠ trésorerie des mutuelles
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            Ces factures représentent uniquement
            les revenus commerciaux d&apos;Afri
            Club liés aux abonnements. Elles
            restent totalement séparées des
            cotisations, dépenses, encaissements
            et opérations financières réalisées
            par chaque organisation.
          </p>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  label,
  value,
  note,
  warning = false,
  danger = false,
  success = false,
}: {
  label: string
  value: string
  note: string

  warning?: boolean
  danger?: boolean
  success?: boolean
}) {
  let containerClasses =
    'border-slate-200 bg-white'

  let valueClasses =
    'text-slate-950'

  if (
    warning
  ) {
    containerClasses =
      'border-amber-200 bg-amber-50'

    valueClasses =
      'text-amber-900'
  }

  if (
    danger
  ) {
    containerClasses =
      'border-red-200 bg-red-50'

    valueClasses =
      'text-red-900'
  }

  if (
    success
  ) {
    containerClasses =
      'border-emerald-200 bg-emerald-50'

    valueClasses =
      'text-emerald-900'
  }

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${containerClasses}`}
    >

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p
        className={`mt-3 text-3xl font-black ${valueClasses}`}
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
// MINI STAT
// ============================================================

function MiniStat({
  label,
  value,
  success = false,
  danger = false,
}: {
  label: string
  value: number
  success?: boolean
  danger?: boolean
}) {
  let classes =
    'border-slate-200 bg-white'

  let valueClasses =
    'text-slate-950'

  if (
    success
  ) {
    classes =
      'border-emerald-200 bg-emerald-50'

    valueClasses =
      'text-emerald-800'
  }

  if (
    danger
  ) {
    classes =
      'border-red-200 bg-red-50'

    valueClasses =
      'text-red-800'
  }

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-5 py-4 shadow-sm ${classes}`}
    >

      <p className="text-sm font-black text-slate-600">
        {
          label
        }
      </p>

      <p
        className={`text-xl font-black ${valueClasses}`}
      >
        {formatNumber(
          value
        )}
      </p>

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
  code: string
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
        styles[code] ??
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
// STATUT FACTURE
// ============================================================

function InvoiceStatus({
  status,
}: {
  status: string
}) {
  const styles:
    Record<
      string,
      string
    > = {
      open:
        'bg-blue-50 text-blue-700',

      partial:
        'bg-amber-50 text-amber-700',

      overdue:
        'bg-red-50 text-red-700',

      paid:
        'bg-emerald-50 text-emerald-700',

      cancelled:
        'bg-slate-100 text-slate-500',

      draft:
        'bg-amber-50 text-amber-700',
    }

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
        styles[status] ??
        'bg-slate-100 text-slate-600'
      }`}
    >
      {formatInvoiceStatus(
        status
      )}
    </span>
  )
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
// BILLING RULE
// ============================================================

function BillingRule({
  title,
  price,
  description,
}: {
  title: string
  price: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <p className="font-black text-slate-950">
        {
          title
        }
      </p>

      <p className="mt-2 text-lg font-black text-emerald-700">
        {
          price
        }
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {
          description
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
  )} FCFA`
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

function formatBillingCycle(
  value: string
) {
  switch (
    value
  ) {
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

function formatInvoiceStatus(
  status: string
) {
  switch (
    status
  ) {
    case 'open':
      return 'À payer'

    case 'partial':
      return 'Partiel'

    case 'overdue':
      return 'En retard'

    case 'paid':
      return 'Payé'

    case 'cancelled':
      return 'Annulé'

    case 'draft':
      return 'Brouillon'

    default:
      return status
  }
}

// ============================================================
// STATUT D'AFFICHAGE
//
// La RPC de la migration 039 connaît :
// open / overdue / paid / cancelled / draft.
//
// Après la migration 040, un paiement partiel laisse le
// statut stocké "open". On affiche donc "Partiel" lorsque :
//
// - la facture n'est pas en retard ;
// - un montant a déjà été payé ;
// - un solde reste encore à payer.
// ============================================================

function getDisplayInvoiceStatus(
  invoice: InvoiceRow
) {
  if (
    invoice.effective_status ===
    'overdue'
  ) {
    return 'overdue'
  }

  if (
    invoice.effective_status ===
    'paid'
  ) {
    return 'paid'
  }

  if (
    invoice.effective_status ===
    'cancelled'
  ) {
    return 'cancelled'
  }

  if (
    invoice.effective_status ===
    'draft'
  ) {
    return 'draft'
  }

  const paid =
    numberValue(
      invoice.amount_paid_xof
    )

  const remaining =
    numberValue(
      invoice.amount_remaining_xof
    )

  if (
    paid >
      0 &&
    remaining >
      0
  ) {
    return 'partial'
  }

  return 'open'
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
    'open',
    'overdue',
    'paid',
    'cancelled',
    'draft',
  ].includes(
    status
  )
    ? status
    : ''
}