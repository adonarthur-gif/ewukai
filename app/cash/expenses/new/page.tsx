import { randomUUID } from 'crypto'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import { createCashExpense } from '../actions'
import SubmitButton from './submit-button'

type PageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function NewExpensePage({
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
    ].includes(role)
  ) {
    redirect('/cash')
  }

  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  const {
    data: cashData,
    error: cashError,
  } =
    await supabase.rpc(
      'get_cash_summary',
      {
        target_organization_id:
          organizationId,

        target_month: today,
      }
    )

  if (cashError) {
    throw new Error(
      'Impossible de récupérer le solde de caisse.'
    )
  }

  const balance =
    Number(
      cashData?.[0]
        ?.current_balance ?? 0
    )

  const requestKey =
    randomUUID()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="text-sm font-bold text-emerald-700">
              CAISSE
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Nouvelle dépense
            </h1>

            <p className="mt-2 text-slate-500">
              Enregistrer un décaissement
              réel de la mutuelle.
            </p>
          </div>

          <Link
            href="/cash/expenses"
            className="font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Retour aux dépenses
          </Link>

        </div>

        <section className="mt-6 rounded-2xl bg-slate-900 p-6 text-white">

          <p className="text-sm text-slate-400">
            Solde disponible avant opération
          </p>

          <p className="mt-2 text-3xl font-black text-emerald-300">
            {formatMoney(balance)}
          </p>

        </section>

        {query.error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage(
              query.error
            )}
          </div>
        )}

        <form
          action={createCashExpense}
          className="mt-6 space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
        >

          <input
            type="hidden"
            name="requestKey"
            value={requestKey}
          />

          <div className="grid gap-5 sm:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-bold">
                Date de la dépense *
              </label>

              <input
                type="date"
                name="expenseDate"
                required
                defaultValue={today}
                max={today}
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                Montant *
              </label>

              <input
                type="number"
                name="amount"
                required
                min="1"
                step="1"
                placeholder="25000"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

          </div>

          <div className="grid gap-5 sm:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-bold">
                Catégorie *
              </label>

              <select
                name="category"
                required
                defaultValue="social_aid"
                className="w-full rounded-xl border bg-white px-4 py-3"
              >
                <option value="social_aid">
                  Aide sociale
                </option>

                <option value="operating">
                  Fonctionnement
                </option>

                <option value="event">
                  Événement
                </option>

                <option value="purchase">
                  Achat
                </option>

                <option value="reimbursement">
                  Remboursement
                </option>

                <option value="transport">
                  Transport
                </option>

                <option value="communication">
                  Communication
                </option>

                <option value="other">
                  Autre
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                Mode de paiement *
              </label>

              <select
                name="paymentMethod"
                required
                defaultValue="cash"
                className="w-full rounded-xl border bg-white px-4 py-3"
              >
                <option value="cash">
                  Espèces
                </option>

                <option value="wave">
                  Wave
                </option>

                <option value="orange_money">
                  Orange Money
                </option>

                <option value="mtn_momo">
                  MTN MoMo
                </option>

                <option value="moov_money">
                  Moov Money
                </option>

                <option value="bank_transfer">
                  Virement bancaire
                </option>

                <option value="other">
                  Autre
                </option>
              </select>
            </div>

          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">
              Bénéficiaire *
            </label>

            <input
              type="text"
              name="beneficiary"
              required
              placeholder="Ex. KOUASSI Jean Marc"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">
              Motif de la dépense *
            </label>

            <textarea
              name="description"
              required
              rows={3}
              placeholder="Ex. Soutien suite à accident"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-bold">
                Référence du paiement
              </label>

              <input
                type="text"
                name="paymentReference"
                placeholder="Référence Wave, chèque..."
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                Observations
              </label>

              <input
                type="text"
                name="notes"
                placeholder="Informations complémentaires"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

            <p className="font-bold text-amber-900">
              Attention
            </p>

            <p className="mt-1 text-sm text-amber-800">
              La validation crée immédiatement
              une sortie de caisse. Une dépense
              validée ne pourra pas être supprimée,
              seulement annulée avec justification.
            </p>

          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>

        </form>

      </div>
    </main>
  )
}

function errorMessage(
  error: string
) {
  switch (error) {
    case 'insufficient-balance':
      return 'Le solde disponible est insuffisant pour cette dépense.'

    case 'future-date':
      return 'Une dépense confirmée ne peut pas avoir une date future.'

    case 'invalid':
      return 'Certaines informations du formulaire sont incorrectes.'

    default:
      return 'Impossible d’enregistrer la dépense.'
  }
}

function formatMoney(
  value: number
) {
  return (
    new Intl.NumberFormat(
      'fr-FR'
    ).format(value) +
    ' FCFA'
  )
}