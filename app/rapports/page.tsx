import type {
  ReactNode,
} from 'react'

import Link from 'next/link'

import {
  redirect,
} from 'next/navigation'

import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  ReceiptText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  buildFinancialReport,
  formatMoney,
  formatReportDate,
  money,
  resolveReportPeriod,
} from '@/lib/reports/financial-report'

import PrintReportButton from './print-button'

// ============================================================
// AFRI CLUB
// CENTRE RAPPORTS - RAPPORT FINANCIER GENERAL
// ============================================================

type ReportsPageProps = {
  searchParams: Promise<{
    start?: string
    end?: string
  }>
}

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps) {

  const query =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  const canViewFinancialReports =
    [
      'owner',
      'president',
      'treasurer',
      'auditor',
    ].includes(
      role
    )

  if (
    !canViewFinancialReports
  ) {
    redirect(
      '/dashboard'
    )
  }

  let startDate:
    string

  let endDate:
    string

  try {
    const resolved =
      resolveReportPeriod({
        start:
          query.start,

        end:
          query.end,
      })

    startDate =
      resolved.startDate

    endDate =
      resolved.endDate
  } catch {
    redirect(
      '/rapports'
    )
  }

  const report =
    await buildFinancialReport({
      supabase,
      organizationId,
      startDate,
      endDate,
    })

  const excelHref =
    `/api/reports/financial/excel?start=${encodeURIComponent(
      startDate
    )}&end=${encodeURIComponent(
      endDate
    )}`

  return (
    <main className="report-page min-h-screen bg-slate-50">

      <style>{`
        @media print {
          header.sticky {
            display: none !important;
          }

          .report-no-print {
            display: none !important;
          }

          .report-page {
            background: white !important;
          }

          .report-container {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .report-sheet {
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .report-break-before {
            break-before: page;
          }

          .report-avoid-break {
            break-inside: avoid;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>

      <div className="report-container mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* OUTILS */}
        {/* ================================================== */}

        <section className="report-no-print rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Rapports financiers
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Rapport financier général
              </h1>

              <p className="mt-3 max-w-3xl leading-7 text-slate-600">
                Consultez la situation financière de la mutuelle sur une période précise,
                puis imprimez-la en PDF ou exportez-la vers Excel.
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              <PrintReportButton />

              <a
                href={excelHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </a>

            </div>

          </div>

          <form
            method="get"
            action="/rapports"
            className="mt-7 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-[1fr_1fr_auto]"
          >

            <label className="block">

              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Date de début
              </span>

              <input
                type="date"
                name="start"
                defaultValue={startDate}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
              />

            </label>

            <label className="block">

              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Date de fin
              </span>

              <input
                type="date"
                name="end"
                defaultValue={endDate}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
              />

            </label>

            <button
              type="submit"
              className="self-end rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Générer
            </button>

          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">

            <PeriodShortcut
              label="Cette année"
              start={`${new Date().getUTCFullYear()}-01-01`}
              end={`${new Date().getUTCFullYear()}-12-31`}
            />

            <PeriodShortcut
              label="Année précédente"
              start={`${new Date().getUTCFullYear() - 1}-01-01`}
              end={`${new Date().getUTCFullYear() - 1}-12-31`}
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* DOCUMENT */}
        {/* ================================================== */}

        <article className="report-sheet mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* ENTETE */}

          <section
            className="border-b px-6 py-7 sm:px-9"
            style={{
              borderColor:
                `${report.organization.primaryColor}33`,
            }}
          >

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-5">

                {report.organization.logoUrl ? (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                    <img
                      src={report.organization.logoUrl}
                      alt={`Logo ${report.organization.shortName || report.organization.name}`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white"
                    style={{
                      backgroundColor:
                        report.organization.primaryColor,
                    }}
                  >
                    {getInitials(
                      report.organization.shortName ||
                      report.organization.name
                    )}
                  </div>
                )}

                <div>

                  <p
                    className="text-xs font-black uppercase tracking-[0.18em]"
                    style={{
                      color:
                        report.organization.primaryColor,
                    }}
                  >
                    {report.organization.shortName || 'MUTUELLE'}
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                    {report.organization.name}
                  </h2>

                  {report.organization.location && (
                    <p className="mt-1 text-sm text-slate-500">
                      {report.organization.location}
                    </p>
                  )}

                </div>

              </div>

              <div className="sm:text-right">

                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Document financier
                </p>

                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  RAPPORT FINANCIER
                </h3>

                <p className="mt-2 text-sm font-bold text-slate-600">
                  Du {formatReportDate(startDate)} au {formatReportDate(endDate)}
                </p>

              </div>

            </div>

          </section>

          {/* META */}

          <section className="grid gap-px bg-slate-200 sm:grid-cols-3">

            <DocumentMeta
              label="Période"
              value={`${formatReportDate(startDate)} → ${formatReportDate(endDate)}`}
              icon={<CalendarDays className="h-4 w-4" />}
            />

            <DocumentMeta
              label="Membres actifs"
              value={`${report.members.active}`}
              icon={<Users className="h-4 w-4" />}
            />

            <DocumentMeta
              label="Édité le"
              value={formatDateTime(report.generatedAt)}
              icon={<ReceiptText className="h-4 w-4" />}
            />

          </section>

          <div className="p-6 sm:p-9">

            {/* ================================================ */}
            {/* 1. SYNTHESE */}
            {/* ================================================ */}

            <ReportSectionTitle
              number="1"
              title="Synthèse générale"
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <MetricCard
                label="Cotisations exigibles"
                value={formatMoney(
                  report.contributions.due
                )}
                caption="Échéances de la période"
                icon={<CircleDollarSign className="h-5 w-5" />}
                tone="slate"
              />

              <MetricCard
                label="Cotisations affectées"
                value={formatMoney(
                  report.contributions.allocated
                )}
                caption={
                  report.contributions.collectionRate === null
                    ? 'Aucune échéance'
                    : `Taux de recouvrement : ${formatPercent(report.contributions.collectionRate)}`
                }
                icon={<TrendingUp className="h-5 w-5" />}
                tone="green"
              />

              <MetricCard
                label="Reste à recouvrer"
                value={formatMoney(
                  report.contributions.remaining
                )}
                caption={`${report.members.unpaid + report.members.partial} membre(s) avec reste`}
                icon={<TrendingDown className="h-5 w-5" />}
                tone="amber"
              />

              <MetricCard
                label="Solde de clôture"
                value={formatMoney(
                  report.treasury.closingBalance
                )}
                caption="Trésorerie comptabilisée"
                icon={<Wallet className="h-5 w-5" />}
                tone="blue"
              />

            </div>

            {/* ================================================ */}
            {/* 2. RECOUVREMENT */}
            {/* ================================================ */}

            <div className="mt-10">

              <ReportSectionTitle
                number="2"
                title="Situation des cotisations"
              />

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">

                <div className="overflow-hidden rounded-2xl border border-slate-200">

                  <table className="w-full text-sm">

                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <Th>Nature</Th>
                        <Th align="right">Dû</Th>
                        <Th align="right">Affecté</Th>
                        <Th align="right">Reste</Th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {report.contributions.breakdown.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            Aucune cotisation exigible sur cette période.
                          </td>
                        </tr>
                      ) : (
                        report.contributions.breakdown.map(
                          (row) => (
                            <tr key={row.name}>
                              <Td strong>
                                {row.name}
                              </Td>
                              <Td align="right">
                                {formatMoney(row.due)}
                              </Td>
                              <Td align="right">
                                {formatMoney(row.paid)}
                              </Td>
                              <Td align="right">
                                {formatMoney(row.remaining)}
                              </Td>
                            </tr>
                          )
                        )
                      )}

                    </tbody>

                    <tfoot className="bg-slate-50 font-black text-slate-950">
                      <tr>
                        <Td>Total</Td>
                        <Td align="right">
                          {formatMoney(report.contributions.due)}
                        </Td>
                        <Td align="right">
                          {formatMoney(report.contributions.allocated)}
                        </Td>
                        <Td align="right">
                          {formatMoney(report.contributions.remaining)}
                        </Td>
                      </tr>
                    </tfoot>

                  </table>

                </div>

                <div className="report-avoid-break rounded-2xl border border-slate-200 bg-slate-50 p-5">

                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Situation des membres concernés
                  </p>

                  <div className="mt-4 space-y-3">

                    <SituationLine
                      label="À jour"
                      value={report.members.paid}
                      tone="green"
                    />

                    <SituationLine
                      label="Partiellement à jour"
                      value={report.members.partial}
                      tone="amber"
                    />

                    <SituationLine
                      label="Impayés"
                      value={report.members.unpaid}
                      tone="red"
                    />

                    <SituationLine
                      label="Total concernés"
                      value={report.members.concerned}
                      tone="slate"
                    />

                  </div>

                </div>

              </div>

            </div>

            {/* ================================================ */}
            {/* 3. ENCAISSEMENTS */}
            {/* ================================================ */}

            <div className="mt-10">

              <ReportSectionTitle
                number="3"
                title="Encaissements enregistrés pendant la période"
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-3">

                <SmallStat
                  label="Montant encaissé"
                  value={formatMoney(report.payments.amount)}
                />

                <SmallStat
                  label="Nombre de paiements"
                  value={`${report.payments.count}`}
                />

                <SmallStat
                  label="Moyens utilisés"
                  value={`${report.payments.byMethod.length}`}
                />

              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">

                <table className="w-full text-sm">

                  <thead className="bg-emerald-700 text-white">
                    <tr>
                      <Th>Moyen de paiement</Th>
                      <Th align="right">Nombre</Th>
                      <Th align="right">Montant</Th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {report.payments.byMethod.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          Aucun paiement confirmé sur cette période.
                        </td>
                      </tr>
                    ) : (
                      report.payments.byMethod.map(
                        (row) => (
                          <tr key={row.method}>
                            <Td strong>
                              {row.method}
                            </Td>
                            <Td align="right">
                              {row.paymentCount}
                            </Td>
                            <Td align="right">
                              {formatMoney(row.amount)}
                            </Td>
                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </table>

              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Les encaissements de cette section correspondent aux paiements confirmés
                pendant la période. Ils sont distincts du montant affecté aux échéances :
                un paiement anticipé peut financer une période future.
              </p>

            </div>

            {/* ================================================ */}
            {/* 4. TRESORERIE */}
            {/* ================================================ */}

            <div className="mt-10 report-break-before">

              <ReportSectionTitle
                number="4"
                title="Situation de trésorerie"
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

                <SmallStat
                  label="Solde d'ouverture"
                  value={formatMoney(report.treasury.openingBalance)}
                />

                <SmallStat
                  label="Entrées"
                  value={formatMoney(report.treasury.credits)}
                  tone="green"
                />

                <SmallStat
                  label="Sorties"
                  value={formatMoney(report.treasury.debits)}
                  tone="red"
                />

                <SmallStat
                  label="Variation"
                  value={formatSignedMoney(report.treasury.net)}
                  tone={
                    report.treasury.net >= 0
                      ? 'green'
                      : 'red'
                  }
                />

                <SmallStat
                  label="Solde de clôture"
                  value={formatMoney(report.treasury.closingBalance)}
                  tone="blue"
                />

              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">

                <CategoryTable
                  title="Entrées par catégorie"
                  rows={report.treasury.creditsByCategory}
                  tone="green"
                />

                <CategoryTable
                  title="Sorties par catégorie"
                  rows={report.treasury.debitsByCategory}
                  tone="red"
                />

              </div>

            </div>

            {/* ================================================ */}
            {/* 5. JOURNAL */}
            {/* ================================================ */}

            <div className="mt-10">

              <ReportSectionTitle
                number="5"
                title="Journal financier de la période"
              />

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">

                <table className="min-w-[760px] w-full text-xs">

                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <Th>Date</Th>
                      <Th>Nature</Th>
                      <Th>Description</Th>
                      <Th align="right">Entrée</Th>
                      <Th align="right">Sortie</Th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {report.treasury.movements.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          Aucun mouvement de trésorerie sur cette période.
                        </td>
                      </tr>
                    ) : (
                      report.treasury.movements.map(
                        (movement) => (
                          <tr key={movement.id}>
                            <Td>
                              {formatReportDate(movement.entry_date)}
                            </Td>
                            <Td strong>
                              {movement.category}
                            </Td>
                            <Td>
                              {movement.description || '—'}
                            </Td>
                            <Td align="right">
                              {movement.direction === 'credit'
                                ? formatMoney(movement.amount)
                                : '—'}
                            </Td>
                            <Td align="right">
                              {movement.direction === 'debit'
                                ? formatMoney(movement.amount)
                                : '—'}
                            </Td>
                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {/* ================================================ */}
            {/* 6. CONTROLE */}
            {/* ================================================ */}

            <div className="mt-10 report-avoid-break">

              <ReportSectionTitle
                number="6"
                title="Contrôle et validation"
              />

              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

                <div className="flex gap-3">

                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                  <div>

                    <p className="font-black text-emerald-950">
                      Traçabilité du rapport
                    </p>

                    <p className="mt-1 text-sm leading-6 text-emerald-900">
                      Ce rapport est généré à partir des données de la mutuelle active.
                      Les cotisations, paiements et mouvements de trésorerie sont filtrés
                      par organisation et par période.
                    </p>

                  </div>

                </div>

              </div>

              <div className="mt-10 grid gap-8 sm:grid-cols-3">

                <SignatureBox
                  title="Le Président"
                />

                <SignatureBox
                  title="Le Trésorier"
                />

                <SignatureBox
                  title="Contrôle / Audit"
                />

              </div>

            </div>

          </div>

          {/* FOOTER */}

          <footer className="border-t border-slate-200 bg-slate-50 px-6 py-5 text-center text-xs text-slate-500">
            Rapport généré électroniquement par la mutuelle via Afri Club.
            La plateforme ne détient pas les fonds de la mutuelle.
          </footer>

        </article>

      </div>

    </main>
  )
}

// ============================================================
// COMPONENTS
// ============================================================

function PeriodShortcut({
  label,
  start,
  end,
}: {
  label: string
  start: string
  end: string
}) {
  return (
    <Link
      href={`/rapports?start=${start}&end=${end}`}
      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"
    >
      {label}
    </Link>
  )
}

function ReportSectionTitle({
  number,
  title,
}: {
  number: string
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">
        {number}
      </div>
      <h3 className="text-xl font-black text-slate-950">
        {title}
      </h3>
    </div>
  )
}

function DocumentMeta({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="bg-white px-6 py-4">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="mt-1 text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  caption,
  icon,
  tone,
}: {
  label: string
  value: string
  caption: string
  icon: ReactNode
  tone:
    | 'slate'
    | 'green'
    | 'amber'
    | 'blue'
}) {
  const classes = {
    slate:
      'border-slate-200 bg-slate-50 text-slate-800',
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber:
      'border-amber-200 bg-amber-50 text-amber-800',
    blue:
      'border-blue-200 bg-blue-50 text-blue-800',
  }[tone]

  return (
    <div className={`report-avoid-break rounded-2xl border p-5 ${classes}`}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-wide">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-4 text-xl font-black">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold opacity-70">
        {caption}
      </p>
    </div>
  )
}

function SmallStat({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: string
  tone?:
    | 'slate'
    | 'green'
    | 'red'
    | 'blue'
}) {
  const valueClass = {
    slate:
      'text-slate-950',
    green:
      'text-emerald-700',
    red:
      'text-red-700',
    blue:
      'text-blue-700',
  }[tone]

  return (
    <div className="report-avoid-break rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-lg font-black ${valueClass}`}>
        {value}
      </p>
    </div>
  )
}

function SituationLine({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone:
    | 'green'
    | 'amber'
    | 'red'
    | 'slate'
}) {
  const dot = {
    green:
      'bg-emerald-500',
    amber:
      'bg-amber-500',
    red:
      'bg-red-500',
    slate:
      'bg-slate-500',
  }[tone]

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="font-bold text-slate-700">
          {label}
        </span>
      </div>
      <span className="font-black text-slate-950">
        {value}
      </span>
    </div>
  )
}

function CategoryTable({
  title,
  rows,
  tone,
}: {
  title: string
  rows: {
    category: string
    amount: number | string | null
    movement_count: number | string | null
  }[]
  tone:
    | 'green'
    | 'red'
}) {
  const header =
    tone === 'green'
      ? 'bg-emerald-700'
      : 'bg-red-700'

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className={`${header} px-5 py-4 text-white`}>
        <p className="font-black">
          {title}
        </p>
      </div>

      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="px-4 py-8 text-center text-slate-500"
              >
                Aucun mouvement.
              </td>
            </tr>
          ) : (
            rows.map(
              (row) => (
                <tr key={row.category}>
                  <Td strong>
                    {row.category}
                  </Td>
                  <Td align="right">
                    {money(row.movement_count)}
                  </Td>
                  <Td align="right">
                    {formatMoney(row.amount)}
                  </Td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

function SignatureBox({
  title,
}: {
  title: string
}) {
  return (
    <div className="report-avoid-break pt-16 text-center">
      <div className="border-t border-slate-400 pt-3">
        <p className="font-black text-slate-800">
          {title}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Nom, signature et cachet
        </p>
      </div>
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: ReactNode
  align?:
    | 'left'
    | 'right'
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-black uppercase tracking-wide ${
        align === 'right'
          ? 'text-right'
          : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  strong = false,
}: {
  children: ReactNode
  align?:
    | 'left'
    | 'right'
  strong?: boolean
}) {
  return (
    <td
      className={`px-4 py-3 ${
        align === 'right'
          ? 'text-right'
          : 'text-left'
      } ${
        strong
          ? 'font-black text-slate-900'
          : 'text-slate-600'
      }`}
    >
      {children}
    </td>
  )
}

// ============================================================
// FORMAT
// ============================================================

function formatPercent(
  value: number
) {
  return new Intl
    .NumberFormat(
      'fr-FR',
      {
        maximumFractionDigits:
          2,
      }
    )
    .format(
      value
    ) + ' %'
}

function formatSignedMoney(
  value: number
) {
  if (
    value === 0
  ) {
    return formatMoney(
      0
    )
  }

  const prefix =
    value > 0
      ? '+'
      : '-'

  return (
    prefix +
    formatMoney(
      Math.abs(
        value
      )
    )
  )
}

function formatDateTime(
  iso: string
) {
  return new Intl
    .DateTimeFormat(
      'fr-FR',
      {
        day:
          '2-digit',
        month:
          '2-digit',
        year:
          'numeric',
        hour:
          '2-digit',
        minute:
          '2-digit',
        timeZone:
          'UTC',
      }
    )
    .format(
      new Date(
        iso
      )
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
    words.length === 0
  ) {
    return 'MU'
  }

  return words
    .slice(
      0,
      2
    )
    .map(
      (word) =>
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
