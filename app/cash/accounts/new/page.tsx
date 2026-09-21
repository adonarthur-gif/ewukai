import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import { requireOrganizationFeatureAccess } from '@/lib/subscriptions/feature-access'
import { createTreasuryAccount } from '../actions'
import SubmitButton from './submit-button'

type PageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function NewTreasuryAccountPage({
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
    redirect('/cash/accounts')
  }

  await requireOrganizationFeatureAccess(
    {
      supabase,
      organizationId,
    },
    'treasury'
  )

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
              TRÉSORERIE
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Nouveau compte de réception
            </h1>

            <p className="mt-2 max-w-2xl text-slate-500">
              Indiquez le compte réel
              utilisé par la mutuelle
              pour recevoir ou effectuer
              ses paiements.
            </p>

          </div>

          <Link
            href="/cash/accounts"
            className="font-semibold text-slate-600"
          >
            ← Retour
          </Link>

        </div>

        {query.error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            {errorMessage(
              query.error
            )}
          </div>
        )}

        <form
          action={
            createTreasuryAccount
          }
          className="mt-6 space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
        >

          <div>

            <label className="mb-2 block text-sm font-bold">
              Nom du compte *
            </label>

            <input
              name="label"
              required
              placeholder="Ex. Wave principal"
              className="w-full rounded-xl border px-4 py-3"
            />

            <p className="mt-1 text-xs text-slate-500">
              Choisissez un nom facilement
              identifiable par le trésorier.
            </p>

          </div>

          <div className="grid gap-5 sm:grid-cols-2">

            <div>

              <label className="mb-2 block text-sm font-bold">
                Canal *
              </label>

              <select
                name="paymentMethod"
                required
                defaultValue="wave"
                className="w-full rounded-xl border bg-white px-4 py-3"
              >

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
                  Compte bancaire
                </option>

                <option value="cash">
                  Espèces
                </option>

                <option value="other">
                  Autre
                </option>

              </select>

            </div>

            <div>

              <label className="mb-2 block text-sm font-bold">
                Titulaire *
              </label>

              <input
                name="accountHolder"
                required
                placeholder="Ex. MUDESAK / Trésorier"
                className="w-full rounded-xl border px-4 py-3"
              />

            </div>

          </div>

          <div className="rounded-2xl border bg-slate-50 p-5">

            <h2 className="font-bold">
              Mobile Money
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              À renseigner pour Wave,
              Orange Money, MTN MoMo
              ou Moov Money.
            </p>

            <div className="mt-4">

              <label className="mb-2 block text-sm font-bold">
                Numéro
              </label>

              <input
                name="phoneNumber"
                type="tel"
                placeholder="Ex. 0700000000"
                className="w-full rounded-xl border bg-white px-4 py-3"
              />

            </div>

          </div>

          <div className="rounded-2xl border bg-slate-50 p-5">

            <h2 className="font-bold">
              Informations bancaires
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              À renseigner uniquement
              pour un compte bancaire.
            </p>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Banque
                </label>

                <input
                  name="bankName"
                  placeholder="Ex. SGCI"
                  className="w-full rounded-xl border bg-white px-4 py-3"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold">
                  Numéro de compte
                </label>

                <input
                  name="accountNumber"
                  className="w-full rounded-xl border bg-white px-4 py-3"
                />

              </div>

            </div>

            <div className="mt-5">

              <label className="mb-2 block text-sm font-bold">
                IBAN / RIB
              </label>

              <input
                name="iban"
                className="w-full rounded-xl border bg-white px-4 py-3"
              />

            </div>

          </div>

          <div>

            <label className="mb-2 block text-sm font-bold">
              Instructions de paiement
            </label>

            <textarea
              name="paymentInstructions"
              rows={3}
              placeholder="Ex. Indiquez votre nom et votre matricule dans le motif du transfert."
              className="w-full rounded-xl border px-4 py-3"
            />

          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">

              <input
                type="checkbox"
                name="canReceive"
                defaultChecked
                className="mt-1"
              />

              <span>

                <span className="block font-bold">
                  Peut recevoir
                </span>

                <span className="mt-1 block text-sm text-slate-500">
                  Afficher ce compte lors
                  de la comptabilisation
                  des cotisations.
                </span>

              </span>

            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">

              <input
                type="checkbox"
                name="canSpend"
                defaultChecked
                className="mt-1"
              />

              <span>

                <span className="block font-bold">
                  Peut servir aux dépenses
                </span>

                <span className="mt-1 block text-sm text-slate-500">
                  Ce compte pourra être
                  sélectionné lors d&apos;un
                  décaissement.
                </span>

              </span>

            </label>

          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">

            <p className="font-bold text-emerald-900">
              Important
            </p>

            <p className="mt-1 text-sm text-emerald-800">
              La plateforme ne reçoit aucun
              fonds sur ce compte. Cette
              information sert uniquement
              à identifier où l&apos;argent
              de la mutuelle est réellement
              conservé ou reçu.
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
    case 'phone-required':
      return 'Le numéro est obligatoire pour un compte Mobile Money.'

    case 'bank-required':
      return 'Le nom de la banque et le numéro de compte sont obligatoires.'

    case 'duplicate':
      return 'Un compte actif portant ce nom existe déjà.'

    case 'invalid':
      return 'Certaines informations du formulaire sont incorrectes.'

    default:
      return 'Impossible d’enregistrer le compte de trésorerie.'
  }
}
