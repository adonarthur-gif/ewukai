import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

import { createContributionType } from './actions'

type NewContributionPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function NewContributionPage({
  searchParams,
}: NewContributionPageProps) {
  const params = await searchParams

  const { role } = await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
      'treasurer',
    ].includes(role)
  ) {
    redirect('/contributions')
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/contributions"
          className="text-sm font-semibold text-emerald-700"
        >
          ← Retour aux cotisations
        </Link>

        <div className="mt-5">
          <p className="text-sm font-semibold text-emerald-700">
            ESPACE MUTUELLE
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Nouvelle cotisation
          </h1>

          <p className="mt-2 text-slate-600">
            Définissez les règles de cette cotisation.
          </p>
        </div>

        {params.error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {params.error}
          </div>
        )}

        <form
          action={createContributionType}
          className="mt-8 space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium"
            >
              Nom de la cotisation *
            </label>

            <input
              id="name"
              name="name"
              required
              placeholder="Ex. Cotisation mensuelle"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium"
            >
              Description
            </label>

            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Description facultative..."
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="amount"
                className="mb-1 block text-sm font-medium"
              >
                Montant *
              </label>

              <div className="flex">
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="5000"
                  className="min-w-0 flex-1 rounded-l-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-600"
                />

                <span className="flex items-center rounded-r-lg border border-l-0 bg-slate-50 px-4 text-sm font-medium">
                  FCFA
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="frequency"
                className="mb-1 block text-sm font-medium"
              >
                Fréquence *
              </label>

              <select
                id="frequency"
                name="frequency"
                required
                defaultValue="monthly"
                className="w-full rounded-lg border bg-white px-3 py-2"
              >
                <option value="monthly">
                  Mensuelle
                </option>

                <option value="quarterly">
                  Trimestrielle
                </option>

                <option value="annual">
                  Annuelle
                </option>

                <option value="one_time">
                  Exceptionnelle / unique
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="dueDay"
                className="mb-1 block text-sm font-medium"
              >
                Jour d’échéance
              </label>

              <input
                id="dueDay"
                name="dueDay"
                type="number"
                min="1"
                max="28"
                defaultValue="5"
                className="w-full rounded-lg border px-3 py-2"
              />

              <p className="mt-1 text-xs text-slate-500">
                Entre le 1er et le 28 du mois.
              </p>
            </div>

            <div>
              <label
                htmlFor="startDate"
                className="mb-1 block text-sm font-medium"
              >
                Date de début *
              </label>

              <input
                id="startDate"
                name="startDate"
                type="date"
                required
                defaultValue={today}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="endDate"
                className="mb-1 block text-sm font-medium"
              >
                Date de fin
              </label>

              <input
                id="endDate"
                name="endDate"
                type="date"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <input
              type="checkbox"
              name="isMandatory"
              defaultChecked
              className="mt-1"
            />

            <span>
              <span className="block font-medium">
                Cotisation obligatoire
              </span>

              <span className="mt-1 block text-sm text-slate-500">
                Les membres concernés seront considérés
                comme redevables de cette cotisation.
              </span>
            </span>
          </label>

          <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            Les échéances et impayés seront générés
            automatiquement dans l’étape suivante.
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/contributions"
              className="rounded-lg border px-5 py-3 font-medium"
            >
              Annuler
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800"
            >
              Créer la cotisation
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}