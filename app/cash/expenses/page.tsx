import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import { requireOrganizationFeatureAccess } from '@/lib/subscriptions/feature-access'

type PageProps = {
  searchParams: Promise<{
    success?: string
    number?: string
    error?: string
  }>
}

type Expense = {
  id: string
  expense_number: string
  expense_date: string
  category: string
  beneficiary: string
  amount: number
  payment_method: string
  description: string
  status: 'confirmed' | 'reversed'
  created_at: string
}

export default async function ExpensesPage({
  searchParams,
}: PageProps) {
  const query =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

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

  await requireOrganizationFeatureAccess(
    {
      supabase,
      organizationId,
    },
    'treasury'
  )

  const canManage =
    [
      'owner',
      'president',
      'treasurer',
    ].includes(role)

  const {
    data,
    error,
  } =
    await supabase
      .from('cash_expenses')
      .select(`
        id,
        expense_number,
        expense_date,
        category,
        beneficiary,
        amount,
        payment_method,
        description,
        status,
        created_at
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .order(
        'expense_date',
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
      .limit(200)

  if (error) {
    throw new Error(
      'Impossible de charger les dépenses.'
    )
  }

  const expenses =
    (data ?? []) as Expense[]

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <p className="text-sm font-bold text-emerald-700">
              CAISSE
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Dépenses
            </h1>

            <p className="mt-2 text-slate-500">
              Historique des décaissements
              de la mutuelle.
            </p>

          </div>

          <div className="flex gap-3">

            <Link
              href="/cash"
              className="rounded-xl border bg-white px-4 py-3 font-bold"
            >
              Caisse
            </Link>

            {canManage && (
              <Link
                href="/cash/expenses/new"
                className="rounded-xl bg-red-700 px-4 py-3 font-bold text-white"
              >
                + Nouvelle dépense
              </Link>
            )}

          </div>

        </div>

        {query.success ===
          'created' && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">

            Dépense{' '}
            {query.number
              ? `${query.number} `
              : ''}
            enregistrée avec succès.

          </div>
        )}

        {query.success ===
          'reversed' && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-800">
            La dépense a été annulée par
            contre-écriture.
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">

          {expenses.length ===
          0 ? (
            <div className="p-12 text-center">

              <p className="font-bold">
                Aucune dépense
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Les décaissements apparaîtront
                ici après leur enregistrement.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">

                  <tr>
                    <th className="px-5 py-4">
                      Date
                    </th>

                    <th className="px-5 py-4">
                      N°
                    </th>

                    <th className="px-5 py-4">
                      Bénéficiaire
                    </th>

                    <th className="px-5 py-4">
                      Motif
                    </th>

                    <th className="px-5 py-4">
                      Catégorie
                    </th>

                    <th className="px-5 py-4 text-right">
                      Montant
                    </th>

                    <th className="px-5 py-4">
                      Statut
                    </th>

                    <th className="px-5 py-4">
                      Action
                    </th>
                  </tr>

                </thead>

                <tbody>

                  {expenses.map(
                    (expense) => (
                      <tr
                        key={expense.id}
                        className="border-b last:border-0"
                      >

                        <td className="whitespace-nowrap px-5 py-4 text-sm">
                          {formatDate(
                            expense.expense_date
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold">
                          {expense.expense_number}
                        </td>

                        <td className="px-5 py-4 font-semibold">
                          {expense.beneficiary}
                        </td>

                        <td className="px-5 py-4 text-sm">
                          {expense.description}
                        </td>

                        <td className="px-5 py-4 text-sm">
                          {categoryLabel(
                            expense.category
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-black text-red-700">
                          {formatMoney(
                            expense.amount
                          )}
                        </td>

                        <td className="px-5 py-4">

                          {expense.status ===
                          'confirmed' ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                              Validée
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                              Annulée
                            </span>
                          )}

                        </td>

                        <td className="px-5 py-4">

                          {canManage &&
                          expense.status ===
                            'confirmed' ? (
                            <Link
                              href={`/cash/expenses/${expense.id}/reverse`}
                              className="text-sm font-bold text-red-700 hover:underline"
                            >
                              Annuler
                            </Link>
                          ) : (
                            '—'
                          )}

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </div>

    </main>
  )
}

function categoryLabel(
  category: string
) {
  const labels:
    Record<string, string> = {
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

      other:
        'Autre',
    }

  return labels[category] ??
    category
}

function formatMoney(
  value: number
) {
  return (
    new Intl.NumberFormat(
      'fr-FR'
    ).format(
      Number(value)
    ) +
    ' FCFA'
  )
}

function formatDate(
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
