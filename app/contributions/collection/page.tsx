import Link from 'next/link'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  generateObligations,
  openPayment,
} from './actions'

// ============================================================
// AFRI CLUB
// RECOUVREMENT DES COTISATIONS
// ============================================================

type CollectionPageProps = {
  searchParams: Promise<{
    period?: string
    generated?: string
    error?: string
    q?: string
    status?: string
    page?: string
    perPage?: string
  }>
}

type Obligation = {
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

type MemberCollection = {
  memberId: string
  memberNumber: string
  firstName: string
  lastName: string

  totalDue: number
  totalPaid: number
  totalRemaining: number

  status:
    | 'paid'
    | 'partial'
    | 'unpaid'
    | 'pending'

  obligations: Obligation[]
}

type ReceiptAllocationRow = {
  payment_id: string
  obligation_id: string
}

type ReceiptPaymentRow = {
  id: string

  paid_at:
    | string
    | null

  created_at: string
  status: string
}

// ============================================================
// PAGE
// ============================================================

export default async function CollectionPage({
  searchParams,
}: CollectionPageProps) {
  const params =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ==========================================================
  // PERIODE
  // ==========================================================

  const currentPeriod =
    /^\d{4}-\d{2}$/.test(
      params.period ?? ''
    )
      ? params.period!
      : new Date()
          .toISOString()
          .slice(
            0,
            7
          )

  const selectedYear =
    Number(
      currentPeriod.slice(
        0,
        4
      )
    )

  // ==========================================================
  // RECHERCHE
  // ==========================================================

  const search =
    params.q
      ?.trim()
      .toLowerCase() ??
    ''

  const selectedStatus =
    params.status ??
    'all'

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const allowedPageSizes = [
    25,
    50,
    100,
  ]

  const requestedPageSize =
    Number(
      params.perPage
    )

  const pageSize =
    allowedPageSizes.includes(
      requestedPageSize
    )
      ? requestedPageSize
      : 25

  const currentPage =
    Math.max(
      1,
      Number.parseInt(
        params.page ??
          '1',
        10
      ) ||
        1
    )

  // ==========================================================
  // CHARGEMENT DES ECHEANCES
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'list_contribution_obligations',
      {
        target_organization_id:
          organizationId,

        target_period:
          `${currentPeriod}-01`,
      }
    )

  if (
    error
  ) {
    console.error(
      'AFRI CLUB - list obligations:',
      error
    )

    throw new Error(
      'Impossible de charger les échéances.'
    )
  }

  const obligations =
    (
      data ??
      []
    ) as Obligation[]

  // ==========================================================
  // REGROUPEMENT PAR MEMBRE
  // ==========================================================

  const memberMap =
    new Map<
      string,
      MemberCollection
    >()

  for (
    const obligation of
    obligations
  ) {
    let member =
      memberMap.get(
        obligation.member_id
      )

    if (
      !member
    ) {
      member = {
        memberId:
          obligation.member_id,

        memberNumber:
          obligation
            .member_number,

        firstName:
          obligation
            .first_name,

        lastName:
          obligation
            .last_name,

        totalDue:
          0,

        totalPaid:
          0,

        totalRemaining:
          0,

        status:
          'pending',

        obligations:
          [],
      }

      memberMap.set(
        obligation.member_id,
        member
      )
    }

    member.totalDue +=
      Number(
        obligation.amount_due
      )

    member.totalPaid +=
      Number(
        obligation.amount_paid
      )

    member.totalRemaining +=
      Number(
        obligation
          .remaining_amount
      )

    member.obligations.push(
      obligation
    )
  }

  let members =
    Array.from(
      memberMap.values()
    )

  // ==========================================================
  // CALCUL DU STATUT GLOBAL DU MEMBRE
  // ==========================================================

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )

  members =
    members.map(
      (
        member
      ) => {
        let status:
          MemberCollection['status']

        if (
          member.totalRemaining ===
          0
        ) {
          status =
            'paid'
        } else if (
          member.totalPaid >
          0
        ) {
          status =
            'partial'
        } else {
          const hasOverdue =
            member
              .obligations
              .some(
                (
                  item
                ) =>
                  item.due_date <
                  today
              )

          status =
            hasOverdue
              ? 'unpaid'
              : 'pending'
        }

        return {
          ...member,
          status,
        }
      }
    )

  // ==========================================================
  // RECHERCHE
  // ==========================================================

  if (
    search
  ) {
    members =
      members.filter(
        (
          member
        ) => {
          const searchable =
            [
              member
                .memberNumber,

              member
                .lastName,

              member
                .firstName,

              `${member.lastName} ${member.firstName}`,
            ]
              .join(
                ' '
              )
              .toLowerCase()

          return searchable.includes(
            search
          )
        }
      )
  }

  // ==========================================================
  // FILTRE PAR STATUT
  // ==========================================================

  if (
    selectedStatus !==
    'all'
  ) {
    members =
      members.filter(
        (
          member
        ) =>
          member.status ===
          selectedStatus
      )
  }

  // ==========================================================
  // TRI
  //
  // 1. Impayés
  // 2. Partiels
  // 3. À payer
  // 4. Soldés
  // ==========================================================

  const statusOrder:
    Record<
      string,
      number
    > = {
      unpaid:
        1,

      partial:
        2,

      pending:
        3,

      paid:
        4,
    }

  members.sort(
    (
      a,
      b
    ) => {
      const statusDifference =
        statusOrder[
          a.status
        ] -
        statusOrder[
          b.status
        ]

      if (
        statusDifference !==
        0
      ) {
        return statusDifference
      }

      return a.lastName.localeCompare(
        b.lastName,
        'fr'
      )
    }
  )

  // ==========================================================
  // STATISTIQUES GENERALES
  // ==========================================================

  const allMembers =
    Array.from(
      memberMap.values()
    )

  const totalExpected =
    allMembers.reduce(
      (
        total,
        member
      ) =>
        total +
        member.totalDue,
      0
    )

  const totalPaid =
    allMembers.reduce(
      (
        total,
        member
      ) =>
        total +
        member.totalPaid,
      0
    )

  const totalRemaining =
    allMembers.reduce(
      (
        total,
        member
      ) =>
        total +
        member
          .totalRemaining,
      0
    )

  const recoveryRate =
    totalExpected >
    0
      ? (
          totalPaid /
          totalExpected
        ) *
        100
      : 0

  const fullyPaidMembers =
    allMembers.filter(
      (
        member
      ) =>
        member.totalRemaining ===
          0 &&
        member.totalDue >
          0
    ).length

  const partialMembers =
    allMembers.filter(
      (
        member
      ) =>
        member.totalPaid >
          0 &&
        member.totalRemaining >
          0
    ).length

  const unpaidMembers =
    allMembers.filter(
      (
        member
      ) => {
        if (
          member.totalPaid >
            0 ||
          member.totalRemaining <=
            0
        ) {
          return false
        }

        return member
          .obligations
          .some(
            (
              item
            ) =>
              item.due_date <
              today
          )
      }
    ).length

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalMembers =
    members.length

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalMembers /
          pageSize
      )
    )

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages
    )

  const pageStart =
    (
      safeCurrentPage -
      1
    ) *
    pageSize

  const visibleMembers =
    members.slice(
      pageStart,
      pageStart +
        pageSize
    )

  // ==========================================================
  // RECUS DES ECHEANCES VISIBLES
  //
  // Pour chaque échéance affichée, on récupère le dernier
  // paiement confirmé afin d'afficher le bouton "Voir le reçu".
  //
  // Une échéance partiellement réglée peut avoir plusieurs
  // reçus. Ici nous affichons le reçu du versement le plus
  // récent.
  // ==========================================================

  const latestReceiptByObligation =
    new Map<
      string,
      string
    >()

  const visibleObligationIds =
    visibleMembers.flatMap(
      (
        member
      ) =>
        member.obligations.map(
          (
            obligation
          ) =>
            obligation
              .obligation_id
        )
    )

  if (
    visibleObligationIds.length >
    0
  ) {
    const {
      data:
        allocationData,

      error:
        allocationError,
    } =
      await supabase
        .from(
          'payment_allocations'
        )
        .select(`
          payment_id,
          obligation_id
        `)
        .in(
          'obligation_id',
          visibleObligationIds
        )

    if (
      allocationError
    ) {
      console.error(
        'AFRI CLUB - collection receipt allocations:',
        allocationError
      )
    } else {
      const allocationRows =
        (
          allocationData ??
          []
        ) as ReceiptAllocationRow[]

      const paymentIds =
        Array.from(
          new Set(
            allocationRows.map(
              (
                row
              ) =>
                row.payment_id
            )
          )
        )

      if (
        paymentIds.length >
        0
      ) {
        const {
          data:
            paymentData,

          error:
            paymentError,
        } =
          await supabase
            .from(
              'payments'
            )
            .select(`
              id,
              paid_at,
              created_at,
              status
            `)
            .eq(
              'organization_id',
              organizationId
            )
            .eq(
              'status',
              'confirmed'
            )
            .in(
              'id',
              paymentIds
            )

        if (
          paymentError
        ) {
          console.error(
            'AFRI CLUB - collection receipt payments:',
            paymentError
          )
        } else {
          const paymentRows =
            (
              paymentData ??
              []
            ) as ReceiptPaymentRow[]

          const paymentMap =
            new Map<
              string,
              ReceiptPaymentRow
            >(
              paymentRows.map(
                (
                  payment
                ) => [
                  payment.id,
                  payment,
                ]
              )
            )

          const latestReceiptMeta =
            new Map<
              string,
              {
                paymentId:
                  string

                date:
                  string
              }
            >()

          for (
            const allocation of
            allocationRows
          ) {
            const payment =
              paymentMap.get(
                allocation.payment_id
              )

            if (
              !payment
            ) {
              continue
            }

            const paymentDate =
              payment.paid_at ??
              payment.created_at

            const current =
              latestReceiptMeta.get(
                allocation
                  .obligation_id
              )

            if (
              !current ||
              paymentDate >
                current.date
            ) {
              latestReceiptMeta.set(
                allocation
                  .obligation_id,
                {
                  paymentId:
                    payment.id,

                  date:
                    paymentDate,
                }
              )
            }
          }

          for (
            const [
              obligationId,
              receipt,
            ] of
              latestReceiptMeta
          ) {
            latestReceiptByObligation.set(
              obligationId,
              receipt.paymentId
            )
          }
        }
      }
    }
  }

  // ==========================================================
  // PERMISSIONS
  // ==========================================================

  const canManage = [
    'owner',
    'president',
    'treasurer',
  ].includes(
    role
  )

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-sm font-semibold text-emerald-700">
              ESPACE MUTUELLE
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Recouvrement
            </h1>

            <p className="mt-2 text-slate-600">
              Situation des cotisations
              pour{' '}

              <strong>
                {
                  formatPeriod(
                    currentPeriod
                  )
                }
              </strong>
            </p>

          </div>

          <div className="flex flex-col gap-3 sm:flex-row">

            <Link
              href="/contributions"
              className="rounded-lg border px-5 py-3 text-center font-semibold text-slate-700 hover:bg-white"
            >
              Configuration
            </Link>

            <Link
              href="/dashboard"
              className="rounded-lg border px-5 py-3 text-center font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Tableau de bord
            </Link>

          </div>

        </div>

        {/* ================================================== */}
        {/* SELECTION DE LA PERIODE */}
        {/* ================================================== */}

        <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

            <form
              method="get"
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >

              <div>

                <label
                  htmlFor="period"
                  className="mb-1 block text-sm font-medium"
                >
                  Mois de recouvrement
                </label>

                <input
                  id="period"
                  name="period"
                  type="month"
                  defaultValue={
                    currentPeriod
                  }
                  className="rounded-lg border px-4 py-2.5"
                />

              </div>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white"
              >
                Afficher
              </button>

            </form>

            {canManage && (
              <form
                action={
                  generateObligations
                }
              >

                <input
                  type="hidden"
                  name="period"
                  value={
                    currentPeriod
                  }
                />

                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
                >
                  Générer les échéances
                </button>

              </form>
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* MESSAGES */}
        {/* ================================================== */}

        {params.generated !==
          undefined && (
          <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">

            Génération terminée :{' '}

            <strong>
              {
                params.generated
              }
            </strong>{' '}

            nouvelle(s)
            échéance(s) créée(s).

          </div>
        )}

        {params.error && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {
              params.error
            }
          </div>
        )}

        {/* ================================================== */}
        {/* INDICATEURS */}
        {/* ================================================== */}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            title="Montant attendu"
            value={
              formatMoney(
                totalExpected
              )
            }
          />

          <SummaryCard
            title="Montant encaissé"
            value={
              formatMoney(
                totalPaid
              )
            }
          />

          <SummaryCard
            title="Reste à recouvrer"
            value={
              formatMoney(
                totalRemaining
              )
            }
          />

          <SummaryCard
            title="Taux de recouvrement"
            value={`${recoveryRate.toFixed(
              1
            )} %`}
          />

        </div>

        {/* ================================================== */}
        {/* STATISTIQUES MEMBRES */}
        {/* ================================================== */}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <SmallStat
            label="Membres concernés"
            value={
              allMembers.length
            }
          />

          <SmallStat
            label="À jour"
            value={
              fullyPaidMembers
            }
          />

          <SmallStat
            label="Paiements partiels"
            value={
              partialMembers
            }
          />

          <SmallStat
            label="Impayés"
            value={
              unpaidMembers
            }
          />

        </div>

        {/* ================================================== */}
        {/* RECHERCHE ET FILTRES */}
        {/* ================================================== */}

        <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">

          <form
            method="get"
            className="grid gap-3 lg:grid-cols-[1fr_200px_130px_auto]"
          >

            <input
              type="hidden"
              name="period"
              value={
                currentPeriod
              }
            />

            <input
              type="search"
              name="q"
              defaultValue={
                params.q ??
                ''
              }
              placeholder="Matricule, nom ou prénom..."
              className="rounded-lg border px-4 py-2.5"
            />

            <select
              name="status"
              defaultValue={
                selectedStatus
              }
              className="rounded-lg border bg-white px-3 py-2.5"
            >

              <option value="all">
                Tous les statuts
              </option>

              <option value="paid">
                Soldés
              </option>

              <option value="partial">
                Partiels
              </option>

              <option value="pending">
                À payer
              </option>

              <option value="unpaid">
                Impayés
              </option>

            </select>

            <select
              name="perPage"
              defaultValue={
                String(
                  pageSize
                )
              }
              className="rounded-lg border bg-white px-3 py-2.5"
            >

              <option value="25">
                25 / page
              </option>

              <option value="50">
                50 / page
              </option>

              <option value="100">
                100 / page
              </option>

            </select>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white"
            >
              Rechercher
            </button>

          </form>

        </section>

        {/* ================================================== */}
        {/* LISTE DES MEMBRES */}
        {/* ================================================== */}

        <section className="mt-6 space-y-5">

          {visibleMembers.length ===
          0 ? (
            <div className="rounded-2xl border bg-white p-12 text-center shadow-sm">

              <p className="text-lg font-semibold">
                Aucune situation trouvée
              </p>

              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                Vérifiez les
                cotisations actives ou
                générez les échéances
                pour la période choisie.
              </p>

            </div>
          ) : (
            visibleMembers.map(
              (
                member
              ) => (
                <article
                  key={
                    member.memberId
                  }
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                >

                  {/* ======================================== */}
                  {/* SYNTHESE MEMBRE */}
                  {/* ======================================== */}

                  <div className="bg-slate-900 px-5 py-4 text-white">

                    <div className="grid gap-4 md:grid-cols-[150px_1fr_repeat(3,130px)_120px] md:items-center">

                      <div>

                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Matricule
                        </p>

                        <p className="mt-1 font-mono font-semibold">
                          {
                            member
                              .memberNumber
                          }
                        </p>

                      </div>

                      <div>

                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Membre
                        </p>

                        <p className="mt-1 font-bold">
                          {
                            member.lastName
                          }{' '}
                          {
                            member.firstName
                          }
                        </p>

                      </div>

                      <MemberAmount
                        label="Dû"
                        value={
                          member.totalDue
                        }
                      />

                      <MemberAmount
                        label="Payé"
                        value={
                          member.totalPaid
                        }
                      />

                      <MemberAmount
                        label="Reste"
                        value={
                          member
                            .totalRemaining
                        }
                      />

                      <div>

                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Statut
                        </p>

                        <div className="mt-1">

                          <MemberStatus
                            status={
                              member.status
                            }
                          />

                        </div>

                      </div>

                    </div>

                  </div>

                  {/* ======================================== */}
                  {/* DETAILS DES COTISATIONS */}
                  {/* ======================================== */}

                  <div className="overflow-x-auto">

                    <table className="w-full text-left">

                      <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                        <tr>

                          <th className="px-5 py-3">
                            Période
                          </th>

                          <th className="px-5 py-3">
                            Nature de la cotisation
                          </th>

                          <th className="px-5 py-3 text-right">
                            Dû
                          </th>

                          <th className="px-5 py-3 text-right">
                            Payé
                          </th>

                          <th className="px-5 py-3 text-right">
                            Reste
                          </th>

                          <th className="px-5 py-3">
                            Situation
                          </th>

                          <th className="px-5 py-3 text-right">
                            Action
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {member.obligations.map(
                          (
                            item
                          ) => {
                            const receiptId =
                              latestReceiptByObligation.get(
                                item
                                  .obligation_id
                              )

                            return (
                              <tr
                                key={
                                  item
                                    .obligation_id
                                }
                                className="border-b last:border-b-0 hover:bg-slate-50"
                              >

                                <td className="px-5 py-4 text-sm font-medium">
                                  {
                                    formatDateMonth(
                                      item
                                        .due_date
                                    )
                                  }
                                </td>

                                <td className="px-5 py-4">

                                  <p className="font-medium">
                                    {
                                      item
                                        .contribution_name
                                    }
                                  </p>

                                </td>

                                <td className="px-5 py-4 text-right font-medium">
                                  {
                                    formatMoney(
                                      item
                                        .amount_due
                                    )
                                  }
                                </td>

                                <td className="px-5 py-4 text-right font-medium text-emerald-700">
                                  {
                                    formatMoney(
                                      item
                                        .amount_paid
                                    )
                                  }
                                </td>

                                <td className="px-5 py-4 text-right font-bold">
                                  {
                                    formatMoney(
                                      item
                                        .remaining_amount
                                    )
                                  }
                                </td>

                                <td className="px-5 py-4">

                                  <ObligationStatus
                                    item={
                                      item
                                    }
                                  />

                                </td>

                                <td className="px-5 py-4">

                                  <div className="flex flex-wrap justify-end gap-2">

                                    {/* ====================== */}
                                    {/* ENCAISSER */}
                                    {/* ====================== */}

                                    {canManage &&
                                      Number(
                                        item
                                          .remaining_amount
                                      ) >
                                        0 && (
                                        <form
                                          action={
                                            openPayment
                                          }
                                        >

                                          <input
                                            type="hidden"
                                            name="obligationId"
                                            value={
                                              item
                                                .obligation_id
                                            }
                                          />

                                          <input
                                            type="hidden"
                                            name="year"
                                            value={
                                              selectedYear
                                            }
                                          />

                                          <button
                                            type="submit"
                                            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                                          >
                                            Encaisser
                                          </button>

                                        </form>
                                      )}

                                    {/* ====================== */}
                                    {/* VOIR LE RECU */}
                                    {/* ====================== */}

                                    {receiptId && (
                                      <Link
                                        href={`/contributions/receipts/${receiptId}?obligation=${item.obligation_id}&year=${selectedYear}`}
                                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                                      >
                                        Voir le reçu
                                      </Link>
                                    )}

                                    {/* ====================== */}
                                    {/* AUCUNE ACTION */}
                                    {/* ====================== */}

                                    {!receiptId &&
                                      !(
                                        canManage &&
                                        Number(
                                          item
                                            .remaining_amount
                                        ) >
                                          0
                                      ) && (
                                        <span className="py-2 text-sm text-slate-400">
                                          —
                                        </span>
                                      )}

                                  </div>

                                </td>

                              </tr>
                            )
                          }
                        )}

                      </tbody>

                    </table>

                  </div>

                </article>
              )
            )
          )}

        </section>

        {/* ================================================== */}
        {/* PAGINATION */}
        {/* ================================================== */}

        {totalPages >
          1 && (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-sm text-slate-500">

              Page{' '}

              <strong>
                {
                  safeCurrentPage
                }
              </strong>{' '}

              sur{' '}

              <strong>
                {
                  totalPages
                }
              </strong>{' '}

              — {totalMembers}{' '}
              membre
              {
                totalMembers !==
                1
                  ? 's'
                  : ''
              }

            </p>

            <div className="flex gap-3">

              <PaginationLink
                page={
                  safeCurrentPage -
                  1
                }
                disabled={
                  safeCurrentPage <=
                  1
                }
                period={
                  currentPeriod
                }
                q={
                  params.q ??
                  ''
                }
                status={
                  selectedStatus
                }
                perPage={
                  pageSize
                }
              >
                ← Précédent
              </PaginationLink>

              <PaginationLink
                page={
                  safeCurrentPage +
                  1
                }
                disabled={
                  safeCurrentPage >=
                  totalPages
                }
                period={
                  currentPeriod
                }
                q={
                  params.q ??
                  ''
                }
                status={
                  selectedStatus
                }
                perPage={
                  pageSize
                }
              >
                Suivant →
              </PaginationLink>

            </div>

          </div>
        )}

      </div>

    </main>
  )
}

// ============================================================
// COMPOSANTS
// ============================================================

function SummaryCard({
  title,
  value,
}: {
  title: string
  value: string
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
          value
        }
      </p>

    </div>
  )
}

function SmallStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border bg-white px-5 py-4">

      <p className="text-xs uppercase tracking-wide text-slate-500">
        {
          label
        }
      </p>

      <p className="mt-1 text-xl font-bold">
        {
          value
        }
      </p>

    </div>
  )
}

function MemberAmount({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-1 font-bold">
        {
          formatMoney(
            value
          )
        }
      </p>

    </div>
  )
}

function MemberStatus({
  status,
}: {
  status:
    | 'paid'
    | 'partial'
    | 'unpaid'
    | 'pending'
}) {
  const styles = {
    paid:
      'bg-emerald-500/20 text-emerald-200',

    partial:
      'bg-blue-500/20 text-blue-200',

    unpaid:
      'bg-red-500/20 text-red-200',

    pending:
      'bg-amber-500/20 text-amber-200',
  }

  const labels = {
    paid:
      'Soldé',

    partial:
      'Partiel',

    unpaid:
      'Impayé',

    pending:
      'À payer',
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {
        labels[
          status
        ]
      }
    </span>
  )
}

function ObligationStatus({
  item,
}: {
  item: Obligation
}) {
  if (
    Number(
      item.remaining_amount
    ) ===
    0
  ) {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Soldé
      </span>
    )
  }

  if (
    Number(
      item.amount_paid
    ) >
    0
  ) {
    return (
      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
        Partiel
      </span>
    )
  }

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )

  if (
    item.due_date <
    today
  ) {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
        Impayé
      </span>
    )
  }

  return (
    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      À payer
    </span>
  )
}

function PaginationLink({
  page,
  disabled,
  period,
  q,
  status,
  perPage,
  children,
}: {
  page: number
  disabled: boolean
  period: string
  q: string
  status: string
  perPage: number
  children: React.ReactNode
}) {
  if (
    disabled
  ) {
    return (
      <span className="rounded-lg border px-4 py-2 text-sm text-slate-400">
        {
          children
        }
      </span>
    )
  }

  const params =
    new URLSearchParams()

  params.set(
    'period',
    period
  )

  params.set(
    'page',
    String(
      page
    )
  )

  params.set(
    'perPage',
    String(
      perPage
    )
  )

  if (
    q
  ) {
    params.set(
      'q',
      q
    )
  }

  if (
    status &&
    status !==
      'all'
  ) {
    params.set(
      'status',
      status
    )
  }

  return (
    <Link
      href={`/contributions/collection?${params.toString()}`}
      className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
    >
      {
        children
      }
    </Link>
  )
}

// ============================================================
// FORMATAGE
// ============================================================

function formatMoney(
  amount: number
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
        amount
      )
    ) +
    ' FCFA'
  )
}

function formatPeriod(
  period: string
) {
  const [
    year,
    month,
  ] =
    period.split(
      '-'
    )

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
      Date.UTC(
        Number(
          year
        ),
        Number(
          month
        ) -
          1,
        1
      )
    )
  )
}

function formatDateMonth(
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