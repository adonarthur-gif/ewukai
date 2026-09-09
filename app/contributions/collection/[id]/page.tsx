import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import PaymentForm from './payment-form'

// ============================================================
// AFRI CLUB
// PAGE D'ENCAISSEMENT D'UNE COTISATION
//
// Cette page prend désormais en charge :
//
// 1. Cotisations régulières
//    - mensuelles
//    - trimestrielles
//    - annuelles
//    - ponctuelles
//
// 2. Cotisations exceptionnelles
//    - appel exceptionnel précis
//    - aucun plan annuel
//
// ============================================================

type PaymentPageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    year?: string
    error?: string
    success?: string
    receipt?: string
  }>
}

// ============================================================
// ELEMENT DU PLAN DE PAIEMENT
// ============================================================

type PlanItem = {
  obligation_id: string
  period_start: string
  due_date: string
  amount_due: number
  amount_paid: number
  remaining_amount: number
  obligation_status: string
}

// ============================================================
// ECHEANCE RETOURNEE PAR
// list_contribution_obligations
// ============================================================

type ListedObligation = {
  obligation_id: string
  member_id: string
  member_number: string
  first_name: string
  last_name: string

  contribution_type_id:
    | string
    | null

  contribution_name: string

  amount_due: number
  amount_paid: number
  remaining_amount: number

  obligation_status: string
  due_date: string
}

// ============================================================
// PAGE
// ============================================================

export default async function PaymentPage({
  params,
  searchParams,
}: PaymentPageProps) {
  const {
    id,
  } =
    await params

  const query =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ==========================================================
  // 1. AUTORISATIONS
  // ==========================================================

  if (
    ![
      'owner',
      'president',
      'treasurer',
    ].includes(role)
  ) {
    redirect(
      '/contributions/collection'
    )
  }

  // ==========================================================
  // 2. ECHEANCE DE DEPART
  // ==========================================================

  const {
    data: obligation,
    error: obligationError,
  } = await supabase
    .from(
      'contribution_obligations'
    )
    .select(`
      id,
      organization_id,
      member_id,
      contribution_type_id,
      contribution_call_id,
      period_start,
      due_date,
      amount_due,
      status
    `)
    .eq(
      'id',
      id
    )
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (
    obligationError ||
    !obligation
  ) {
    console.error(
      'AFRI CLUB - payment obligation:',
      obligationError
    )

    notFound()
  }

  // ==========================================================
  // 3. NATURE DE L'ECHEANCE
  // ==========================================================

  const isExceptional =
    Boolean(
      obligation.contribution_call_id
    )

  // ==========================================================
  // 4. ANNEE
  // ==========================================================

  const defaultYear =
    Number(
      obligation.period_start.slice(
        0,
        4
      )
    )

  const requestedYear =
    Number(
      query.year
    )

  const year =
    Number.isInteger(
      requestedYear
    ) &&
    requestedYear >= 2000 &&
    requestedYear <= 2100
      ? requestedYear
      : defaultYear

  // ==========================================================
  // 5. PERIODE DE RETOUR
  // ==========================================================

  const returnPeriod =
    obligation.period_start.slice(
      0,
      7
    )

  // ==========================================================
  // 6. MEMBRE
  // ==========================================================

  const {
    data: member,
    error: memberError,
  } = await supabase
    .from(
      'members'
    )
    .select(`
      id,
      member_number,
      first_name,
      last_name,
      phone,
      status
    `)
    .eq(
      'id',
      obligation.member_id
    )
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (
    memberError ||
    !member
  ) {
    console.error(
      'AFRI CLUB - payment member:',
      memberError
    )

    notFound()
  }

  // ==========================================================
  // 7. VARIABLES COMMUNES
  // ==========================================================

  let contributionName =
    'Cotisation'

  let contributionAmount =
    Number(
      obligation.amount_due
    )

  let frequencyLabel =
    'Ponctuelle'

  let contributionDescription:
    | string
    | null =
    null

  let plan:
    PlanItem[] = []

  // ==========================================================
  // 8A. COTISATION EXCEPTIONNELLE
  //
  // Une cotisation exceptionnelle :
  //
  // - possède contribution_call_id
  // - ne possède pas contribution_type_id
  // - correspond à une obligation précise
  // - ne possède pas de plan annuel
  // ==========================================================

  if (
    isExceptional
  ) {
    const {
      data: periodData,
      error: periodError,
    } = await supabase.rpc(
      'list_contribution_obligations',
      {
        target_organization_id:
          organizationId,

        target_period:
          obligation.period_start,
      }
    )

    if (periodError) {
      console.error(
        'AFRI CLUB - exceptional obligation:',
        periodError
      )

      throw new Error(
        'Impossible de charger cette cotisation exceptionnelle.'
      )
    }

    const periodObligations =
      (
        periodData ??
        []
      ) as ListedObligation[]

    const currentObligation =
      periodObligations.find(
        (
          item
        ) =>
          item.obligation_id ===
          obligation.id
      )

    if (
      !currentObligation
    ) {
      notFound()
    }

    contributionName =
      currentObligation
        .contribution_name ||
      'Cotisation exceptionnelle'

    contributionAmount =
      Number(
        currentObligation
          .amount_due
      )

    frequencyLabel =
      'Exceptionnelle'

    plan = [
      {
        obligation_id:
          currentObligation
            .obligation_id,

        period_start:
          obligation.period_start,

        due_date:
          currentObligation
            .due_date,

        amount_due:
          Number(
            currentObligation
              .amount_due
          ),

        amount_paid:
          Number(
            currentObligation
              .amount_paid
          ),

        remaining_amount:
          Number(
            currentObligation
              .remaining_amount
          ),

        obligation_status:
          currentObligation
            .obligation_status,
      },
    ]
  }

  // ==========================================================
  // 8B. COTISATION REGULIERE
  //
  // Une cotisation régulière possède contribution_type_id.
  //
  // Le plan complet permet :
  //
  // - arriérés
  // - période courante
  // - périodes futures
  // - paiements anticipés
  // ==========================================================

  else {
    if (
      !obligation.contribution_type_id
    ) {
      console.error(
        'AFRI CLUB - regular obligation without contribution type:',
        obligation.id
      )

      notFound()
    }

    // --------------------------------------------------------
    // TYPE DE COTISATION
    // --------------------------------------------------------

    const {
      data: contribution,
      error:
        contributionError,
    } = await supabase
      .from(
        'contribution_types'
      )
      .select(`
        id,
        name,
        description,
        amount,
        frequency,
        due_day,
        is_mandatory,
        is_active
      `)
      .eq(
        'id',
        obligation.contribution_type_id
      )
      .eq(
        'organization_id',
        organizationId
      )
      .maybeSingle()

    if (
      contributionError ||
      !contribution
    ) {
      console.error(
        'AFRI CLUB - payment contribution:',
        contributionError
      )

      notFound()
    }

    contributionName =
      contribution.name

    contributionAmount =
      Number(
        contribution.amount
      )

    contributionDescription =
      contribution.description ??
      null

    frequencyLabel =
      getFrequencyLabel(
        contribution.frequency
      )

    // --------------------------------------------------------
    // PLAN COMPLET DU MEMBRE
    // --------------------------------------------------------

    const {
      data: planData,
      error: planError,
    } = await supabase.rpc(
      'get_member_contribution_full_plan',
      {
        target_member_id:
          member.id,

        target_contribution_type_id:
          contribution.id,

        target_year:
          year,
      }
    )

    if (planError) {
      console.error(
        'AFRI CLUB - payment plan:',
        planError
      )

      throw new Error(
        'Impossible de charger le plan de cotisation.'
      )
    }

    plan =
      (
        planData ??
        []
      ) as PlanItem[]
  }

  // ==========================================================
  // 9. TOTAUX
  // ==========================================================

  const totalDue =
    plan.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.amount_due
        ),
      0
    )

  const totalPaid =
    plan.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.amount_paid
        ),
      0
    )

  const totalRemaining =
    plan.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.remaining_amount
        ),
      0
    )

  const paymentRate =
    totalDue > 0
      ? (
          totalPaid /
          totalDue
        ) *
        100
      : 0

  // ==========================================================
  // 10. ETAT GLOBAL
  // ==========================================================

  const globalStatus =
    getGlobalStatus(
      plan,
      totalPaid,
      totalRemaining
    )

  // ==========================================================
  // 11. RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* RETOUR */}
        {/* ================================================== */}

        <Link
          href={`/contributions/collection?period=${returnPeriod}`}
          className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Retour au recouvrement
        </Link>

        {/* ================================================== */}
        {/* MEMBRE */}
        {/* ================================================== */}

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">

          <div className="bg-slate-900 px-6 py-6 text-white">

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="font-mono text-sm font-semibold text-emerald-300">
                  {
                    member.member_number
                  }
                </p>

                <h1 className="mt-1 text-3xl font-bold">
                  {
                    member.last_name
                  }{' '}
                  {
                    member.first_name
                  }
                </h1>

                {member.phone && (
                  <p className="mt-2 text-sm text-slate-300">
                    {
                      member.phone
                    }
                  </p>
                )}

              </div>

              <div className="md:text-right">

                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Situation
                </p>

                <div className="mt-2">

                  <GlobalStatusBadge
                    status={
                      globalStatus
                    }
                  />

                </div>

              </div>

            </div>

          </div>

          {/* ================================================= */}
          {/* COTISATION */}
          {/* ================================================= */}

          <div className="grid gap-5 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">

            <InfoItem
              label={
                isExceptional
                  ? 'Appel'
                  : 'Cotisation'
              }
              value={
                contributionName
              }
            />

            <InfoItem
              label="Nature"
              value={
                frequencyLabel
              }
            />

            <InfoItem
              label={
                isExceptional
                  ? 'Montant appelé'
                  : 'Montant de référence'
              }
              value={
                formatMoney(
                  contributionAmount
                )
              }
            />

            <InfoItem
              label={
                isExceptional
                  ? 'Date d’échéance'
                  : 'Année de traitement'
              }
              value={
                isExceptional
                  ? formatDate(
                      obligation
                        .due_date
                    )
                  : String(
                      year
                    )
              }
            />

          </div>

          {/* ================================================= */}
          {/* DESCRIPTION */}
          {/* ================================================= */}

          {contributionDescription && (
            <div className="border-t bg-slate-50 px-6 py-4">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-700">
                {
                  contributionDescription
                }
              </p>

            </div>
          )}

        </section>

        {/* ================================================== */}
        {/* MESSAGE TYPE EXCEPTIONNEL */}
        {/* ================================================== */}

        {isExceptional && (
          <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">

            <p className="font-semibold text-amber-900">
              Cotisation exceptionnelle
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              Cet encaissement concerne uniquement cet appel exceptionnel.
              Le montant enregistré ne sera pas affecté aux cotisations
              régulières du membre.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* MESSAGES */}
        {/* ================================================== */}

        {query.error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {
              query.error
            }
          </div>
        )}

        {query.success ===
          '1' && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">

            <p className="font-semibold">
              Paiement enregistré
              avec succès.
            </p>

            {query.receipt && (
              <p className="mt-1 text-sm">
                Numéro de reçu :{' '}
                <strong className="font-mono">
                  {
                    query.receipt
                  }
                </strong>
              </p>
            )}

          </div>
        )}

        {/* ================================================== */}
        {/* SYNTHESE FINANCIERE */}
        {/* ================================================== */}

        <section className="mt-6">

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <Summary
              title="Dû"
              value={
                totalDue
              }
            />

            <Summary
              title="Payé"
              value={
                totalPaid
              }
              variant="success"
            />

            <Summary
              title="Reste"
              value={
                totalRemaining
              }
              variant={
                totalRemaining > 0
                  ? 'danger'
                  : 'success'
              }
            />

            <PercentageSummary
              title="Taux de règlement"
              value={
                paymentRate
              }
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* SITUATION DES ECHEANCES */}
        {/* ================================================== */}

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">

          <div className="border-b px-5 py-5 sm:px-6">

            <h2 className="text-lg font-bold text-slate-900">
              {
                isExceptional
                  ? 'Situation de l’appel'
                  : 'Situation des périodes'
              }
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {
                isExceptional
                  ? 'Cet appel exceptionnel est traité indépendamment des cotisations régulières.'
                  : 'Les périodes sont présentées de la plus ancienne à la plus récente.'
              }
            </p>

          </div>

          {plan.length ===
          0 ? (
            <div className="p-10 text-center">

              <p className="font-semibold text-slate-700">
                Aucune échéance
                disponible.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Aucune obligation
                payable n&apos;est
                actuellement disponible
                pour ce membre.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                  <tr>

                    <th className="px-5 py-4">
                      Période
                    </th>

                    <th className="px-5 py-4">
                      Échéance
                    </th>

                    <th className="px-5 py-4 text-right">
                      Dû
                    </th>

                    <th className="px-5 py-4 text-right">
                      Payé
                    </th>

                    <th className="px-5 py-4 text-right">
                      Reste
                    </th>

                    <th className="px-5 py-4">
                      Statut
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {plan.map(
                    (
                      item
                    ) => (
                      <tr
                        key={
                          item.obligation_id
                        }
                        className="border-b last:border-0 hover:bg-slate-50"
                      >

                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {
                            formatPeriod(
                              item.period_start
                            )
                          }
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {
                            formatDate(
                              item.due_date
                            )
                          }
                        </td>

                        <td className="px-5 py-4 text-right font-medium">
                          {
                            formatMoney(
                              Number(
                                item.amount_due
                              )
                            )
                          }
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                          {
                            formatMoney(
                              Number(
                                item.amount_paid
                              )
                            )
                          }
                        </td>

                        <td className="px-5 py-4 text-right font-bold">
                          {
                            formatMoney(
                              Number(
                                item.remaining_amount
                              )
                            )
                          }
                        </td>

                        <td className="px-5 py-4">

                          <PlanStatus
                            item={
                              item
                            }
                          />

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
        {/* ENCAISSEMENT */}
        {/* ================================================== */}

        {totalRemaining > 0 &&
          plan.length > 0 && (
            <div className="mt-6">

              <PaymentForm
                obligationId={
                  id
                }
                year={
                  year
                }
                plan={
                  plan
                }
              />

            </div>
          )}

        {/* ================================================== */}
        {/* COTISATION ENTIEREMENT SOLDEE */}
        {/* ================================================== */}

        {totalRemaining === 0 &&
          plan.length > 0 && (
            <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">

              <p className="text-lg font-bold text-emerald-800">
                {
                  isExceptional
                    ? 'Appel exceptionnel soldé'
                    : 'Cotisation soldée'
                }
              </p>

              <p className="mt-2 text-sm text-emerald-700">

                {isExceptional
                  ? 'Le membre a entièrement réglé cet appel exceptionnel.'
                  : 'Le membre ne présente plus aucun reste à payer pour les périodes affichées.'}

              </p>

            </section>
          )}

      </div>

    </main>
  )
}

// ============================================================
// INFO MEMBRE / COTISATION
// ============================================================

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wide text-slate-500">
        {
          label
        }
      </p>

      <p className="mt-1 font-semibold text-slate-900">
        {
          value
        }
      </p>

    </div>
  )
}

// ============================================================
// CARTE MONTANT
// ============================================================

function Summary({
  title,
  value,
  variant = 'default',
}: {
  title: string
  value: number

  variant?:
    | 'default'
    | 'success'
    | 'danger'
}) {
  const valueClass =
    variant ===
    'success'
      ? 'text-emerald-700'
      : variant ===
          'danger'
        ? 'text-red-700'
        : 'text-slate-900'

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">

      <p className="text-sm text-slate-500">
        {
          title
        }
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${valueClass}`}
      >
        {
          formatMoney(
            value
          )
        }
      </p>

    </div>
  )
}

// ============================================================
// POURCENTAGE
// ============================================================

function PercentageSummary({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">

      <p className="text-sm text-slate-500">
        {
          title
        }
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {
          value.toFixed(
            1
          )
        } %
      </p>

    </div>
  )
}

// ============================================================
// STATUT D'UNE PERIODE
// ============================================================

function PlanStatus({
  item,
}: {
  item: PlanItem
}) {
  const remaining =
    Number(
      item.remaining_amount
    )

  const paid =
    Number(
      item.amount_paid
    )

  // ----------------------------------------------------------
  // SOLDE
  // ----------------------------------------------------------

  if (
    remaining === 0
  ) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        Soldé
      </span>
    )
  }

  // ----------------------------------------------------------
  // PARTIEL
  // ----------------------------------------------------------

  if (
    paid > 0
  ) {
    return (
      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
        Partiel
      </span>
    )
  }

  // ----------------------------------------------------------
  // DATE DU JOUR
  // ----------------------------------------------------------

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )

  // ----------------------------------------------------------
  // IMPAYE
  // ----------------------------------------------------------

  if (
    item.due_date <
    today
  ) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
        Impayé
      </span>
    )
  }

  // ----------------------------------------------------------
  // A VENIR
  // ----------------------------------------------------------

  return (
    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
      À venir
    </span>
  )
}

// ============================================================
// STATUT GENERAL
// ============================================================

type GlobalStatus =
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'pending'

// ============================================================
// CALCUL DU STATUT GENERAL
// ============================================================

function getGlobalStatus(
  plan: PlanItem[],
  totalPaid: number,
  totalRemaining: number
): GlobalStatus {
  // ----------------------------------------------------------
  // SOLDE
  // ----------------------------------------------------------

  if (
    totalRemaining === 0 &&
    plan.length > 0
  ) {
    return 'paid'
  }

  // ----------------------------------------------------------
  // PARTIEL
  // ----------------------------------------------------------

  if (
    totalPaid > 0
  ) {
    return 'partial'
  }

  // ----------------------------------------------------------
  // DATE DU JOUR
  // ----------------------------------------------------------

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )

  // ----------------------------------------------------------
  // IMPAYE
  // ----------------------------------------------------------

  const hasOverdue =
    plan.some(
      (
        item
      ) =>
        Number(
          item.remaining_amount
        ) >
          0 &&
        item.due_date <
          today
    )

  if (
    hasOverdue
  ) {
    return 'unpaid'
  }

  // ----------------------------------------------------------
  // A PAYER
  // ----------------------------------------------------------

  return 'pending'
}

// ============================================================
// BADGE DU STATUT GENERAL
// ============================================================

function GlobalStatusBadge({
  status,
}: {
  status: GlobalStatus
}) {
  const labels:
    Record<
      GlobalStatus,
      string
    > = {
      paid:
        'Soldé',

      partial:
        'Partiel',

      unpaid:
        'Impayé',

      pending:
        'À payer',
    }

  const styles:
    Record<
      GlobalStatus,
      string
    > = {
      paid:
        'bg-emerald-500/20 text-emerald-200',

      partial:
        'bg-blue-500/20 text-blue-200',

      unpaid:
        'bg-red-500/20 text-red-200',

      pending:
        'bg-amber-500/20 text-amber-200',
    }

  return (
    <span
      className={`inline-flex rounded-full px-4 py-1.5 text-sm font-bold ${styles[status]}`}
    >
      {
        labels[
          status
        ]
      }
    </span>
  )
}

// ============================================================
// LIBELLE DE FREQUENCE
// ============================================================

function getFrequencyLabel(
  frequency: string
) {
  switch (
    frequency
  ) {
    case 'monthly':
      return 'Mensuelle'

    case 'quarterly':
      return 'Trimestrielle'

    case 'annual':
      return 'Annuelle'

    case 'one_time':
      return 'Ponctuelle'

    default:
      return frequency
  }
}

// ============================================================
// FORMAT MONETAIRE
// ============================================================

function formatMoney(
  value: number
) {
  return (
    new Intl.NumberFormat(
      'fr-FR',
      {
        maximumFractionDigits:
          0,
      }
    ).format(
      Number(
        value
      )
    ) +
    ' FCFA'
  )
}

// ============================================================
// FORMAT MOIS
// ============================================================

function formatPeriod(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      month:
        'long',

      year:
        'numeric',

      timeZone:
        'UTC',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}

// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(
  date: string
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

      timeZone:
        'UTC',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}