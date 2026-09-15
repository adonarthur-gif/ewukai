'use client'

import {
  useMemo,
  useState,
} from 'react'

import { recordPayment } from './actions'

// ============================================================
// EWUKAI
// FORMULAIRE D'ENCAISSEMENT
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

type PaymentFormProps = {
  obligationId: string
  year: number
  plan: PlanItem[]
}

// ============================================================
// COMPOSANT
// ============================================================

export default function PaymentForm({
  obligationId,
  year,
  plan,
}: PaymentFormProps) {
  const [amount, setAmount] =
    useState('')

  const amountNumber =
    Number(amount) || 0

  // ==========================================================
  // RESTE TOTAL A PAYER
  // ==========================================================

  const totalRemaining =
    useMemo(
      () =>
        plan.reduce(
          (total, item) =>
            total +
            Number(
              item.remaining_amount
            ),
          0
        ),
      [plan]
    )

  // ==========================================================
  // APERCU DE L'AFFECTATION
  //
  // L'ordre du plan est :
  // anciennes périodes -> nouvelles périodes
  //
  // Exemple :
  //
  // Janvier   5 000
  // Février   5 000
  // Mars      5 000
  //
  // Paiement 12 000 :
  //
  // Janvier   +5 000
  // Février   +5 000
  // Mars      +2 000
  // ==========================================================

  const preview =
    useMemo(() => {
      let remainingPayment =
        amountNumber

      const result: Array<
        PlanItem & {
          previewAllocation: number
          remainingAfter: number
          willBePaid: boolean
        }
      > = []

      for (const item of plan) {
        const currentRemaining =
          Number(
            item.remaining_amount
          )

        if (
          currentRemaining <= 0
        ) {
          continue
        }

        if (
          remainingPayment <= 0
        ) {
          break
        }

        const allocation =
          Math.min(
            remainingPayment,
            currentRemaining
          )

        const remainingAfter =
          currentRemaining -
          allocation

        result.push({
          ...item,

          previewAllocation:
            allocation,

          remainingAfter,

          willBePaid:
            remainingAfter === 0,
        })

        remainingPayment -=
          allocation
      }

      return result
    }, [
      amountNumber,
      plan,
    ])

  // ==========================================================
  // VALIDATIONS CLIENT
  // ==========================================================

  const exceeds =
    amountNumber >
    totalRemaining

  const invalidAmount =
    amountNumber <= 0

  const canSubmit =
    !invalidAmount &&
    !exceeds

  // ==========================================================
  // TOTAL QUI SERA AFFECTE
  // ==========================================================

  const totalPreview =
    preview.reduce(
      (total, item) =>
        total +
        item.previewAllocation,
      0
    )

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <div className="space-y-6">

      {/* ==================================================== */}
      {/* FORMULAIRE */}
      {/* ==================================================== */}

      <section className="rounded-2xl border bg-white p-6 shadow-sm">

        <div>
          <p className="text-sm font-semibold text-emerald-700">
            ENCAISSEMENT
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Enregistrer un paiement
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Le versement sera
            automatiquement affecté
            aux périodes les plus
            anciennes avant les
            périodes futures.
          </p>
        </div>

        <form
          action={recordPayment}
          className="mt-6 space-y-5"
        >
          {/* ================================================ */}
          {/* IDENTIFIANTS */}
          {/* ================================================ */}

          <input
            type="hidden"
            name="obligationId"
            value={
              obligationId
            }
          />

          <input
            type="hidden"
            name="year"
            value={year}
          />

          {/* ================================================ */}
          {/* MONTANT */}
          {/* ================================================ */}

          <div>
            <label
              htmlFor="amount"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Montant versé
            </label>

            <div className="flex">
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                required
                value={amount}
                onChange={(
                  event
                ) =>
                  setAmount(
                    event
                      .target
                      .value
                  )
                }
                placeholder="0"
                className="min-w-0 flex-1 rounded-l-xl border border-slate-300 px-4 py-4 text-2xl font-bold outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />

              <span className="flex items-center rounded-r-xl border border-l-0 border-slate-300 bg-slate-50 px-5 font-bold text-slate-700">
                FCFA
              </span>
            </div>

            {/* ============================================== */}
            {/* RESTE TOTAL */}
            {/* ============================================== */}

            <div className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">

              <p className="text-slate-500">
                Reste total à
                recouvrer
              </p>

              <p className="font-bold text-slate-900">
                {formatMoney(
                  totalRemaining
                )}
              </p>
            </div>

            {/* ============================================== */}
            {/* ERREUR DEPASSEMENT */}
            {/* ============================================== */}

            {exceeds && (
              <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                Le montant saisi
                dépasse le reste total
                à payer de{' '}
                <strong>
                  {formatMoney(
                    totalRemaining
                  )}
                </strong>
                .
              </div>
            )}
          </div>

          {/* ================================================ */}
          {/* MODE DE PAIEMENT */}
          {/* ================================================ */}

          <div>
            <label
              htmlFor="paymentMethod"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Mode de paiement
            </label>

            <select
              id="paymentMethod"
              name="paymentMethod"
              required
              defaultValue="cash"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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

          {/* ================================================ */}
          {/* REFERENCE */}
          {/* ================================================ */}

          <div>
            <label
              htmlFor="paymentReference"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Référence du paiement
            </label>

            <input
              id="paymentReference"
              name="paymentReference"
              type="text"
              placeholder="Ex. référence Wave, transaction Mobile Money..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />

            <p className="mt-1 text-xs text-slate-500">
              Facultatif pour les
              paiements en espèces.
            </p>
          </div>

          {/* ================================================ */}
          {/* OBSERVATION */}
          {/* ================================================ */}

          <div>
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Observation
            </label>

            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Observation facultative..."
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* ================================================ */}
          {/* BOUTON */}
          {/* ================================================ */}

          <button
            type="submit"
            disabled={
              !canSubmit
            }
            className="w-full rounded-xl bg-emerald-700 px-5 py-3.5 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Valider le paiement
          </button>

          <p className="text-center text-xs text-slate-500">
            La validation créera un
            reçu et enregistrera
            automatiquement
            l&apos;encaissement dans la
            caisse de la mutuelle.
          </p>
        </form>
      </section>

      {/* ==================================================== */}
      {/* APERCU DE L'AFFECTATION */}
      {/* ==================================================== */}

      {amountNumber > 0 &&
        !exceeds && (
          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">

            <div className="border-b bg-slate-50 px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="font-bold text-slate-900">
                    Affectation prévue
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Aperçu avant
                    validation.
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Montant affecté
                  </p>

                  <p className="font-bold text-emerald-700">
                    {formatMoney(
                      totalPreview
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* ============================================== */}
            {/* TABLEAU PREVIEW */}
            {/* ============================================== */}

            <div className="overflow-x-auto">
              <table className="w-full text-left">

                <thead className="border-b bg-white text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">
                      Période
                    </th>

                    <th className="px-5 py-3 text-right">
                      Reste avant
                    </th>

                    <th className="px-5 py-3 text-right">
                      Affectation
                    </th>

                    <th className="px-5 py-3 text-right">
                      Reste après
                    </th>

                    <th className="px-5 py-3">
                      Résultat
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {preview.map(
                    (item) => (
                      <tr
                        key={
                          item.obligation_id
                        }
                        className="border-b last:border-0"
                      >
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {formatPeriod(
                            item.period_start
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {formatMoney(
                            item.remaining_amount
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-emerald-700">
                          +
                          {formatMoney(
                            item.previewAllocation
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold">
                          {formatMoney(
                            item.remainingAfter
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {item.willBePaid ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              Soldé
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                              Partiel
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* ============================================== */}
            {/* MESSAGE EXPLICATIF */}
            {/* ============================================== */}

            <div className="border-t bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
              Le système affectera
              automatiquement ce
              paiement de la période
              la plus ancienne vers les
              périodes suivantes.
            </div>
          </section>
        )}
    </div>
  )
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
      Number(value)
    ) + ' FCFA'
  )
}

// ============================================================
// FORMAT PERIODE
// ============================================================

function formatPeriod(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}