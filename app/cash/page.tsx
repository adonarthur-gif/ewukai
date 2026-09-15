import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

// ============================================================
// EWUKAI
// TRESORERIE
//
// EWUKAI ne détient pas les fonds.
// Cette page présente les opérations comptabilisées
// et les soldes enregistrés dans la plateforme.
// ============================================================

type CashPageProps = {
  searchParams: Promise<{
    year?: string
    period?: string
  }>
}

type CashSummary = {
  total_credits: number
  total_debits: number
  current_balance: number
  month_credits: number
  month_debits: number
  month_balance: number
  month_movements: number
}

type YearSummary = {
  opening_balance: number
  year_credits: number
  year_debits: number
  year_net_movement: number
  closing_balance: number
}

type MonthlySummary = {
  month_start: string
  opening_balance: number
  credits: number
  debits: number
  net_movement: number
  closing_balance: number
  movement_count: number
}

type LedgerEntry = {
  id: string
  direction: 'credit' | 'debit'
  category: string
  amount: number
  description: string
  reference_type: string | null
  reference_id: string | null
  entry_date: string
  created_at: string
}

// ============================================================
// PAGE
// ============================================================

export default async function CashPage({
  searchParams,
}: CashPageProps) {
  const query = await searchParams

  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  // ==========================================================
  // AUTORISATIONS
  // ==========================================================

  if (
    ![
      'owner',
      'president',
      'treasurer',
      'auditor',
    ].includes(role)
  ) {
    redirect('/dashboard')
  }

  const canManage = [
    'owner',
    'president',
    'treasurer',
  ].includes(role)

  // ==========================================================
  // DATE COURANTE
  // ==========================================================

  const now = new Date()

  const currentYear =
    now.getUTCFullYear()

  const currentMonth =
    String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')

  // ==========================================================
  // ANNEE SELECTIONNEE
  // ==========================================================

  const requestedYear =
    Number(query.year)

  const selectedYear =
    Number.isInteger(
      requestedYear
    ) &&
    requestedYear >= 2000 &&
    requestedYear <= 2100
      ? requestedYear
      : currentYear

  // ==========================================================
  // MOIS SELECTIONNE
  // ==========================================================

  const requestedPeriod =
    query.period ?? ''

  const validPeriod =
    /^\d{4}-\d{2}$/.test(
      requestedPeriod
    ) &&
    Number(
      requestedPeriod.slice(
        0,
        4
      )
    ) === selectedYear

  const selectedPeriod =
    validPeriod
      ? requestedPeriod
      : selectedYear ===
          currentYear
        ? `${selectedYear}-${currentMonth}`
        : `${selectedYear}-01`

  // ==========================================================
  // BORNES DU MOIS
  // ==========================================================

  const [
    periodYear,
    periodMonth,
  ] =
    selectedPeriod
      .split('-')
      .map(Number)

  const monthStart =
    `${selectedPeriod}-01`

  const nextMonth =
    periodMonth === 12
      ? `${periodYear + 1}-01-01`
      : `${periodYear}-${String(
          periodMonth + 1
        ).padStart(
          2,
          '0'
        )}-01`

  // ==========================================================
  // CHARGEMENT DES DONNEES
  // ==========================================================

  const [
    cashSummaryResult,
    yearSummaryResult,
    monthlySummaryResult,
    movementsResult,
  ] =
    await Promise.all([

      // ------------------------------------------------------
      // Situation globale + mois sélectionné
      // ------------------------------------------------------

      supabase.rpc(
        'get_cash_summary',
        {
          target_organization_id:
            organizationId,

          target_month:
            monthStart,
        }
      ),

      // ------------------------------------------------------
      // Synthèse annuelle
      // ------------------------------------------------------

      supabase.rpc(
        'get_cash_year_summary',
        {
          target_organization_id:
            organizationId,

          target_year:
            selectedYear,
        }
      ),

      // ------------------------------------------------------
      // Les 12 mois
      // ------------------------------------------------------

      supabase.rpc(
        'get_cash_monthly_summary',
        {
          target_organization_id:
            organizationId,

          target_year:
            selectedYear,
        }
      ),

      // ------------------------------------------------------
      // Journal du mois
      //
      // Important :
      // on utilise entry_date et non created_at.
      // ------------------------------------------------------

      supabase
        .from('ledger_entries')
        .select(`
          id,
          direction,
          category,
          amount,
          description,
          reference_type,
          reference_id,
          entry_date,
          created_at
        `)
        .eq(
          'organization_id',
          organizationId
        )
        .gte(
          'entry_date',
          monthStart
        )
        .lt(
          'entry_date',
          nextMonth
        )
        .order(
          'entry_date',
          {
            ascending: false,
          }
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
        .limit(200),
    ])

  // ==========================================================
  // ERREURS
  // ==========================================================

  if (
    cashSummaryResult.error
  ) {
    console.error(
      'EWUKAI - treasury summary:',
      cashSummaryResult.error
    )

    throw new Error(
      'Impossible de charger la situation de trésorerie.'
    )
  }

  if (
    yearSummaryResult.error
  ) {
    console.error(
      'EWUKAI - yearly treasury summary:',
      yearSummaryResult.error
    )

    throw new Error(
      'Impossible de charger la synthèse annuelle.'
    )
  }

  if (
    monthlySummaryResult.error
  ) {
    console.error(
      'EWUKAI - monthly treasury summary:',
      monthlySummaryResult.error
    )

    throw new Error(
      'Impossible de charger la situation mensuelle.'
    )
  }

  if (
    movementsResult.error
  ) {
    console.error(
      'EWUKAI - treasury movements:',
      movementsResult.error
    )

    throw new Error(
      'Impossible de charger le journal de trésorerie.'
    )
  }

  // ==========================================================
  // RESULTATS
  // ==========================================================

  const cashSummary =
    (
      cashSummaryResult
        .data?.[0] ?? {
        total_credits: 0,
        total_debits: 0,
        current_balance: 0,
        month_credits: 0,
        month_debits: 0,
        month_balance: 0,
        month_movements: 0,
      }
    ) as CashSummary

  const yearSummary =
    (
      yearSummaryResult
        .data?.[0] ?? {
        opening_balance: 0,
        year_credits: 0,
        year_debits: 0,
        year_net_movement: 0,
        closing_balance: 0,
      }
    ) as YearSummary

  const monthlySummary =
    (
      monthlySummaryResult
        .data ?? []
    ) as MonthlySummary[]

  const movements =
    (
      movementsResult.data ??
      []
    ) as LedgerEntry[]

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">

          <div>

            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">
              ESPACE MUTUELLE
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Trésorerie
            </h1>

            <p className="mt-2 max-w-2xl text-slate-500">
              Suivez les fonds
              comptabilisés de la
              mutuelle, les entrées,
              les sorties et les soldes
              enregistrés par mois et
              par année.
            </p>

            {/* ============================================== */}
            {/* ACTIONS RAPIDES */}
            {/* ============================================== */}

            <div className="mt-5 flex flex-wrap gap-3">

              <Link
                href="/contributions/collection"
                className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white transition hover:bg-emerald-800"
              >
                Recouvrement
              </Link>

              {canManage && (
                <Link
                  href="/cash/expenses/new"
                  className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white transition hover:bg-red-800"
                >
                  + Nouvelle dépense
                </Link>
              )}

              <Link
                href="/cash/expenses"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Voir les dépenses
              </Link>

              <Link
                href="/cash/accounts"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Comptes de trésorerie
              </Link>

            </div>

          </div>

          {/* ================================================ */}
          {/* FILTRES */}
          {/* ================================================ */}

          <div className="flex flex-col gap-3 sm:flex-row">

            {/* ============================================== */}
            {/* ANNEE */}
            {/* ============================================== */}

            <form
              method="get"
              className="flex items-end gap-2"
            >

              <div>

                <label
                  htmlFor="year"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Année
                </label>

                <input
                  id="year"
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  defaultValue={
                    selectedYear
                  }
                  className="w-28 rounded-xl border bg-white px-3 py-2.5"
                />

              </div>

              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white transition hover:bg-slate-800"
              >
                Afficher
              </button>

            </form>

            {/* ============================================== */}
            {/* MOIS */}
            {/* ============================================== */}

            <form
              method="get"
              className="flex items-end gap-2"
            >

              <input
                type="hidden"
                name="year"
                value={
                  selectedYear
                }
              />

              <div>

                <label
                  htmlFor="period"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Mois
                </label>

                <input
                  id="period"
                  name="period"
                  type="month"
                  defaultValue={
                    selectedPeriod
                  }
                  className="rounded-xl border bg-white px-3 py-2.5"
                />

              </div>

              <button
                type="submit"
                className="rounded-xl bg-emerald-700 px-4 py-2.5 font-bold text-white transition hover:bg-emerald-800"
              >
                Voir
              </button>

            </form>

          </div>

        </div>

        {/* ================================================== */}
        {/* INFORMATION DE POSITIONNEMENT */}
        {/* ================================================== */}

        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">

          <p className="font-bold text-blue-900">
            Trésorerie comptabilisée
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            La plateforme ne conserve ni ne
            transfère les fonds de la
            mutuelle. Les montants affichés
            correspondent aux opérations
            enregistrées et confirmées
            dans la plateforme.
          </p>

        </section>

        {/* ================================================== */}
        {/* SOLDE ACTUEL */}
        {/* ================================================== */}

        <section className="mt-7 overflow-hidden rounded-3xl bg-slate-900 text-white shadow-sm">

          <div className="px-7 py-8 sm:px-8">

            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">

              <div>

                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Solde de trésorerie enregistré
                </p>

                <p className="mt-3 text-4xl font-black text-emerald-300 sm:text-5xl">
                  {formatMoney(
                    cashSummary.current_balance
                  )}
                </p>

                <p className="mt-3 max-w-xl text-sm text-slate-400">
                  Solde calculé à partir
                  de toutes les entrées et
                  sorties comptabilisées
                  dans cet espace.
                </p>

              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:min-w-[430px]">

                <DarkStat
                  label="Entrées cumulées"
                  value={
                    cashSummary.total_credits
                  }
                />

                <DarkStat
                  label="Sorties cumulées"
                  value={
                    cashSummary.total_debits
                  }
                />

              </div>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* SYNTHESE ANNUELLE */}
        {/* ================================================== */}

        <section className="mt-8">

          <div>

            <h2 className="text-xl font-bold text-slate-900">
              Synthèse annuelle{' '}
              {selectedYear}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Situation globale de la
              trésorerie comptabilisée
              pour l&apos;année.
            </p>

          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

            <FinanceCard
              label="Solde au 1er janvier"
              value={
                yearSummary.opening_balance
              }
            />

            <FinanceCard
              label="Entrées de l'année"
              value={
                yearSummary.year_credits
              }
              type="credit"
            />

            <FinanceCard
              label="Sorties de l'année"
              value={
                yearSummary.year_debits
              }
              type="debit"
            />

            <FinanceCard
              label="Mouvement net"
              value={
                yearSummary.year_net_movement
              }
              type={
                Number(
                  yearSummary.year_net_movement
                ) >= 0
                  ? 'credit'
                  : 'debit'
              }
              signed
            />

            <FinanceCard
              label="Solde fin d'année"
              value={
                yearSummary.closing_balance
              }
              strong
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* TABLEAU DES 12 MOIS */}
        {/* ================================================== */}

        <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">

          <div className="border-b px-6 py-5">

            <h2 className="text-lg font-bold text-slate-900">
              Évolution mensuelle —{' '}
              {selectedYear}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Solde d&apos;ouverture,
              entrées, sorties et
              solde de clôture pour
              chacun des douze mois.
            </p>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-left">

              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                <tr>

                  <th className="px-5 py-4">
                    Mois
                  </th>

                  <th className="px-5 py-4 text-right">
                    Solde début
                  </th>

                  <th className="px-5 py-4 text-right">
                    Entrées
                  </th>

                  <th className="px-5 py-4 text-right">
                    Sorties
                  </th>

                  <th className="px-5 py-4 text-right">
                    Mouvement net
                  </th>

                  <th className="px-5 py-4 text-right">
                    Solde fin
                  </th>

                  <th className="px-5 py-4 text-center">
                    Mouv.
                  </th>

                </tr>

              </thead>

              <tbody>

                {monthlySummary.map(
                  (month) => {
                    const monthPeriod =
                      month.month_start.slice(
                        0,
                        7
                      )

                    const selected =
                      monthPeriod ===
                      selectedPeriod

                    return (
                      <tr
                        key={
                          month.month_start
                        }
                        className={`border-b last:border-0 ${
                          selected
                            ? 'bg-emerald-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >

                        <td className="px-5 py-4">

                          <Link
                            href={`/cash?year=${selectedYear}&period=${monthPeriod}`}
                            className="font-bold capitalize text-slate-900 hover:text-emerald-700"
                          >
                            {formatMonth(
                              month.month_start
                            )}
                          </Link>

                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-medium">
                          {formatMoney(
                            month.opening_balance
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-emerald-700">
                          {formatMoney(
                            month.credits
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-red-700">
                          {formatMoney(
                            month.debits
                          )}
                        </td>

                        <td
                          className={`whitespace-nowrap px-5 py-4 text-right font-bold ${
                            Number(
                              month.net_movement
                            ) >= 0
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {formatSignedMoney(
                            month.net_movement
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-black text-slate-900">
                          {formatMoney(
                            month.closing_balance
                          )}
                        </td>

                        <td className="px-5 py-4 text-center font-semibold">
                          {
                            month.movement_count
                          }
                        </td>

                      </tr>
                    )
                  }
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* ================================================== */}
        {/* MOIS SELECTIONNE */}
        {/* ================================================== */}

        <section className="mt-8">

          <div>

            <h2 className="text-xl font-bold capitalize text-slate-900">
              Situation de{' '}
              {formatPeriod(
                selectedPeriod
              )}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Mouvements comptabilisés
              pendant le mois sélectionné.
            </p>

          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <FinanceCard
              label="Entrées du mois"
              value={
                cashSummary.month_credits
              }
              type="credit"
            />

            <FinanceCard
              label="Sorties du mois"
              value={
                cashSummary.month_debits
              }
              type="debit"
            />

            <FinanceCard
              label="Mouvement net du mois"
              value={
                cashSummary.month_balance
              }
              type={
                Number(
                  cashSummary.month_balance
                ) >= 0
                  ? 'credit'
                  : 'debit'
              }
              signed
            />

            <div className="rounded-2xl border bg-white p-5 shadow-sm">

              <p className="text-sm text-slate-500">
                Nombre de mouvements
              </p>

              <p className="mt-2 text-3xl font-black text-slate-900">
                {
                  cashSummary.month_movements
                }
              </p>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* JOURNAL DU MOIS */}
        {/* ================================================== */}

        <section className="mt-7 overflow-hidden rounded-2xl border bg-white shadow-sm">

          <div className="border-b px-6 py-5">

            <h2 className="text-lg font-bold capitalize text-slate-900">
              Journal de trésorerie —{' '}
              {formatPeriod(
                selectedPeriod
              )}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Détail chronologique des
              opérations enregistrées.
            </p>

          </div>

          {movements.length === 0 ? (
            <div className="p-12 text-center">

              <p className="font-bold text-slate-700">
                Aucun mouvement
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Aucune entrée ou sortie
                n&apos;a été comptabilisée
                pour cette période.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                  <tr>

                    <th className="px-5 py-4">
                      Date comptable
                    </th>

                    <th className="px-5 py-4">
                      Opération
                    </th>

                    <th className="px-5 py-4">
                      Catégorie
                    </th>

                    <th className="px-5 py-4 text-right">
                      Entrée
                    </th>

                    <th className="px-5 py-4 text-right">
                      Sortie
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {movements.map(
                    (movement) => (
                      <tr
                        key={
                          movement.id
                        }
                        className="border-b last:border-0 hover:bg-slate-50"
                      >

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">

                          <p className="font-semibold text-slate-800">
                            {formatAccountingDate(
                              movement.entry_date
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Saisi le{' '}
                            {formatDateTime(
                              movement.created_at
                            )}
                          </p>

                        </td>

                        <td className="px-5 py-4">

                          <p className="font-semibold text-slate-900">
                            {
                              movement.description
                            }
                          </p>

                          {movement.reference_type && (
                            <p className="mt-1 text-xs text-slate-400">
                              Type :{' '}
                              {
                                movement.reference_type
                              }
                            </p>
                          )}

                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {categoryLabel(
                            movement.category
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-emerald-700">

                          {movement.direction ===
                          'credit'
                            ? formatMoney(
                                movement.amount
                              )
                            : '—'}

                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-red-700">

                          {movement.direction ===
                          'debit'
                            ? formatMoney(
                                movement.amount
                              )
                            : '—'}

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* ================================================== */}
        {/* RAPPEL */}
        {/* ================================================== */}

        <section className="mt-7 rounded-2xl border bg-white p-6">

          <h2 className="font-bold text-slate-900">
            À propos du solde affiché
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Le solde présenté par Afri
            Club est un solde de
            trésorerie comptabilisé. Il
            correspond aux opérations
            enregistrées dans la
            plateforme. Les comptes de
            trésorerie permettent ensuite
            d&apos;identifier précisément
            où les fonds sont réellement
            détenus : Wave, Orange Money,
            MTN MoMo, compte bancaire,
            espèces ou autre compte de la
            mutuelle.
          </p>

          <Link
            href="/cash/accounts"
            className="mt-4 inline-flex font-bold text-emerald-700 hover:underline"
          >
            Gérer les comptes de trésorerie →
          </Link>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// STATISTIQUE SUR FOND SOMBRE
// ============================================================

function DarkStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-white">
        {formatMoney(
          value
        )}
      </p>

    </div>
  )
}

// ============================================================
// CARTE FINANCIERE
// ============================================================

function FinanceCard({
  label,
  value,
  type,
  signed = false,
  strong = false,
}: {
  label: string
  value: number
  type?:
    | 'credit'
    | 'debit'
  signed?: boolean
  strong?: boolean
}) {
  const valueClass =
    type === 'credit'
      ? 'text-emerald-700'
      : type === 'debit'
        ? 'text-red-700'
        : 'text-slate-900'

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">

      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 ${
          strong
            ? 'text-3xl'
            : 'text-2xl'
        } font-black ${valueClass}`}
      >
        {signed
          ? formatSignedMoney(
              value
            )
          : formatMoney(
              value
            )}
      </p>

    </div>
  )
}

// ============================================================
// LIBELLES DES CATEGORIES
// ============================================================

function categoryLabel(
  category: string
) {
  const labels:
    Record<string, string> = {

      contribution:
        'Cotisation',

      exceptional_contribution:
        'Cotisation exceptionnelle',

      social_aid:
        'Aide sociale',

      operating:
        'Fonctionnement',

      event:
        'Événement',

      purchase:
        'Achat',

      reimbursement:
        'Remboursement',

      transport:
        'Transport',

      communication:
        'Communication',

      expense:
        'Dépense',

      expense_reversal:
        'Annulation de dépense',
    }

  return (
    labels[category] ??
    category
  )
}

// ============================================================
// FORMAT MONTANT
// ============================================================

function formatMoney(
  value: number
) {
  return (
    new Intl.NumberFormat(
      'fr-FR',
      {
        maximumFractionDigits: 0,
      }
    ).format(
      Number(value)
    ) +
    ' FCFA'
  )
}

// ============================================================
// FORMAT MONTANT SIGNE
// ============================================================

function formatSignedMoney(
  value: number
) {
  const amount =
    Number(value)

  const prefix =
    amount > 0
      ? '+'
      : ''

  return (
    prefix +
    new Intl.NumberFormat(
      'fr-FR',
      {
        maximumFractionDigits: 0,
      }
    ).format(
      amount
    ) +
    ' FCFA'
  )
}

// ============================================================
// NOM DU MOIS
// ============================================================

function formatMonth(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      month: 'long',
      timeZone: 'UTC',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}

// ============================================================
// PERIODE MOIS + ANNEE
// ============================================================

function formatPeriod(
  period: string
) {
  const [
    year,
    month,
  ] =
    period.split('-')

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }
  ).format(
    new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        1
      )
    )
  )
}

// ============================================================
// DATE COMPTABLE
// ============================================================

function formatAccountingDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}

// ============================================================
// DATE / HEURE DE SAISIE
// ============================================================

function formatDateTime(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone:
        'Africa/Abidjan',
    }
  ).format(
    new Date(date)
  )
}