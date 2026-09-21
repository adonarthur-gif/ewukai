import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import { requireOrganizationFeatureAccess } from '@/lib/subscriptions/feature-access'
import { reverseCashExpense } from '../../actions'

type PageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    error?: string
  }>
}

export default async function ReverseExpensePage({
  params,
  searchParams,
}: PageProps) {
  const { id } =
    await params

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
    ].includes(role)
  ) {
    redirect('/cash')
  }

  await requireOrganizationFeatureAccess(
    {
      supabase,
      organizationId,
    },
    'treasury'
  )

  const {
    data: expense,
    error,
  } =
    await supabase
      .from('cash_expenses')
      .select(`
        id,
        expense_number,
        expense_date,
        beneficiary,
        amount,
        description,
        status
      `)
      .eq('id', id)
      .eq(
        'organization_id',
        organizationId
      )
      .maybeSingle()

  if (
    error ||
    !expense
  ) {
    redirect(
      '/cash/expenses'
    )
  }

  if (
    expense.status ===
    'reversed'
  ) {
    redirect(
      '/cash/expenses?error=already-reversed'
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-2xl px-4 py-10">

        <Link
          href="/cash/expenses"
          className="font-semibold text-slate-500"
        >
          ← Retour
        </Link>

        <div className="mt-5 rounded-2xl border bg-white p-6 shadow-sm">

          <p className="text-sm font-bold text-red-700">
            ANNULATION DE DÉPENSE
          </p>

          <h1 className="mt-2 text-2xl font-bold">
            {expense.expense_number}
          </h1>

          <div className="mt-6 space-y-2 text-sm">

            <p>
              <strong>
                Bénéficiaire :
              </strong>{' '}
              {expense.beneficiary}
            </p>

            <p>
              <strong>
                Motif :
              </strong>{' '}
              {expense.description}
            </p>

            <p>
              <strong>
                Montant :
              </strong>{' '}
              {formatMoney(
                expense.amount
              )}
            </p>

          </div>

          {query.error && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              Le motif d&apos;annulation
              est obligatoire.
            </div>
          )}

          <form
            action={reverseCashExpense}
            className="mt-7"
          >

            <input
              type="hidden"
              name="expenseId"
              value={expense.id}
            />

            <label className="block text-sm font-bold">
              Motif de l&apos;annulation *
            </label>

            <textarea
              name="reason"
              required
              minLength={3}
              rows={4}
              placeholder="Ex. Dépense enregistrée deux fois"
              className="mt-2 w-full rounded-xl border px-4 py-3"
            />

            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              La dépense ne sera pas supprimée.
              Une contre-écriture sera créée
              dans la caisse afin de conserver
              l&apos;historique.
            </div>

            <div className="mt-6 flex justify-end gap-3">

              <Link
                href="/cash/expenses"
                className="rounded-xl border px-5 py-3 font-bold"
              >
                Retour
              </Link>

              <button
                type="submit"
                className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white"
              >
                Confirmer l&apos;annulation
              </button>

            </div>

          </form>

        </div>

      </div>

    </main>
  )
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
