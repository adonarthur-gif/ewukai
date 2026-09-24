import { randomUUID } from 'crypto'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { submitMembershipApplication } from './actions'
import SubmitButton from './submit-button'

type PageProps = {
  params: Promise<{
    slug: string
  }>

  searchParams: Promise<{
    error?: string
  }>
}

type PublicMutual = {
  name: string
  short_name: string | null
  slug: string
  online_membership_enabled: boolean
}

type PublicMembershipOffer = {
  organization_id: string
  organization_name: string
  short_name: string | null
  public_slug: string
  membership_fee_enabled: boolean
  membership_fee_amount_xof:
    | number
    | string
    | null
  payment_timing: string
}

export default async function JoinPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } =
    await params

  const query =
    await searchParams

  const supabase =
    await createClient()

  // ==========================================================
  // ESPACE PUBLIC DE L'ORGANISATION
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_public_mutual_space',
      {
        target_slug: slug,
      }
    )

  if (
    error ||
    !data
  ) {
    notFound()
  }

  const mutual =
    data as PublicMutual

  if (
    !mutual.online_membership_enabled
  ) {
    notFound()
  }

  // ==========================================================
  // OFFRE D'ADHESION PUBLIQUE
  // ==========================================================
  //
  // Important :
  // - le montant affiché vient du serveur ;
  // - aucun montant n'est envoyé par le navigateur lors du dépôt ;
  // - la RPC submit_membership_application fige elle-même le tarif
  //   applicable au moment de la demande.
  // ==========================================================

  const {
    data: membershipOfferData,
    error: membershipOfferError,
  } =
    await supabase.rpc(
      'get_public_membership_offer',
      {
        target_slug: slug,
      }
    )

  if (
    membershipOfferError ||
    !membershipOfferData
  ) {
    notFound()
  }

  const membershipOffer =
    membershipOfferData as PublicMembershipOffer

  const membershipFeeEnabled =
    membershipOffer
      .membership_fee_enabled ===
    true

  const membershipFeeAmount =
    normalizeAmount(
      membershipOffer
        .membership_fee_amount_xof
    )

  if (
    membershipFeeEnabled &&
    membershipFeeAmount <= 0
  ) {
    notFound()
  }

  const membershipFeeLabel =
    formatXof(
      membershipFeeAmount
    )

  const requestKey =
    randomUUID()

  return (
    <main className="min-h-screen bg-slate-50">

      <section className="bg-gradient-to-br from-emerald-950 to-slate-950 text-white">

        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

          <Link
            href={`/m/${mutual.slug}`}
            className="text-sm font-bold text-emerald-200 hover:text-white"
          >
            ← Retour à la mutuelle
          </Link>

          <div className="mt-10 max-w-3xl">

            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
              Demande d&apos;adhésion
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Rejoindre{' '}
              {mutual.short_name ||
                mutual.name}
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-slate-200">
              Remplissez ce formulaire.
              Votre demande sera transmise
              au bureau de la mutuelle
              pour examen.
            </p>

          </div>

        </div>

      </section>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        {/* ================================================== */}
        {/* CONDITIONS FINANCIERES DE L'ADHESION              */}
        {/* ================================================== */}

        {membershipFeeEnabled ? (
          <section className="mb-6 overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">

            <div className="border-b border-amber-100 bg-amber-50 px-6 py-5">

              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                Droit d&apos;adhésion
              </p>

              <p className="mt-2 text-3xl font-black text-slate-950">
                {membershipFeeLabel}
              </p>

            </div>

            <div className="px-6 py-5">

              <p className="font-black text-slate-900">
                Aucun paiement n&apos;est demandé maintenant.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Vous paierez ce droit d&apos;adhésion uniquement
                si votre demande est acceptée par le bureau.
                Le montant applicable à votre demande sera conservé
                au moment de son dépôt.
              </p>

            </div>

          </section>
        ) : (
          <section className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Adhésion gratuite
            </p>

            <p className="mt-2 font-black text-emerald-950">
              Aucun droit d&apos;adhésion n&apos;est demandé.
            </p>

            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Vous pouvez transmettre votre demande sans effectuer
              de paiement.
            </p>

          </section>
        )}

        {query.error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            {errorMessage(
              query.error
            )}
          </div>
        )}

        <form
          action={
            submitMembershipApplication
          }
          className="space-y-7 rounded-3xl border bg-white p-6 shadow-sm sm:p-8"
        >

          <input
            type="hidden"
            name="slug"
            value={mutual.slug}
          />

          <input
            type="hidden"
            name="requestKey"
            value={requestKey}
          />

          {/* IDENTITE */}

          <section>

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Étape 1
            </p>

            <h2 className="mt-1 text-xl font-black">
              Votre identité
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">

              <Field
                label="Nom"
                name="lastName"
                placeholder="Ex. KOUASSI"
                required
              />

              <Field
                label="Prénoms"
                name="firstName"
                placeholder="Ex. Jean Marc"
                required
              />

            </div>

          </section>

          <hr />

          {/* CONTACT */}

          <section>

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Étape 2
            </p>

            <h2 className="mt-1 text-xl font-black">
              Vos coordonnées
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">

              <Field
                label="Téléphone"
                name="phone"
                type="tel"
                placeholder="Ex. 0700000000"
                required
              />

              <Field
                label="Email"
                name="email"
                type="email"
                placeholder="Ex. nom@email.com"
              />

              <Field
                label="Lieu de résidence"
                name="residence"
                placeholder="Ex. Abidjan"
              />

              <Field
                label="Profession"
                name="profession"
                placeholder="Ex. Enseignant"
              />

            </div>

          </section>

          <hr />

          {/* MOTIVATION */}

          <section>

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Étape 3
            </p>

            <h2 className="mt-1 text-xl font-black">
              Votre demande
            </h2>

            <div className="mt-5">

              <label className="mb-2 block text-sm font-bold text-slate-800">
                Pourquoi souhaitez-vous rejoindre la mutuelle ?
              </label>

              <textarea
                name="motivation"
                rows={4}
                placeholder="Vous pouvez laisser un petit message au bureau..."
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />

            </div>

          </section>

          {/* CONDITIONS */}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-slate-50 p-4">

            <input
              type="checkbox"
              name="termsAccepted"
              required
              className="mt-1"
            />

            <span className="text-sm leading-6 text-slate-600">
              J&apos;accepte que les
              informations fournies soient
              utilisées par la mutuelle
              pour examiner ma demande
              d&apos;adhésion.
            </span>

          </label>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <p className="font-black text-emerald-900">
              Que se passe-t-il ensuite ?
            </p>

            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Votre demande restera en
              attente jusqu&apos;à sa
              validation par le bureau.
              Vous ne devenez pas
              automatiquement membre
              après l&apos;envoi de ce
              formulaire.
            </p>

            {membershipFeeEnabled && (
              <p className="mt-3 text-sm font-bold leading-6 text-emerald-900">
                Si votre demande est acceptée,
                le paiement du droit d&apos;adhésion de{' '}
                {membershipFeeLabel}{' '}
                vous sera alors demandé.
              </p>
            )}

          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>

        </form>

      </div>

    </main>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required = false,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-slate-800"
      >
        {label}
        {required ? ' *' : ''}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />

    </div>
  )
}

function normalizeAmount(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(
      value ??
      0
    )

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(
      parsed
    )
  )
}

function formatXof(
  amount: number
) {
  return `${new Intl.NumberFormat(
    'fr-FR'
  ).format(
    amount
  )} FCFA`
}

function errorMessage(
  error: string
) {
  switch (error) {
    case 'terms':
      return 'Vous devez accepter les conditions pour envoyer votre demande.'

    case 'invalid':
      return 'Certaines informations du formulaire sont incorrectes.'

    default:
      return 'Impossible d’envoyer votre demande pour le moment.'
  }
}
