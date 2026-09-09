import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import {
  approveApplication,
  rejectApplication,
} from '../actions'

type PageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    success?: string
    error?: string
    member?: string
  }>
}

const VIEW_ROLES = [
  'owner',
  'president',
  'secretary',
  'auditor',
]

const REVIEW_ROLES = [
  'owner',
  'president',
  'secretary',
]

export default async function MembershipApplicationPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const query = await searchParams

  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  if (!VIEW_ROLES.includes(role)) {
    redirect('/dashboard')
  }

  const {
    data: application,
    error,
  } = await supabase
    .from('membership_applications')
    .select(`
      id,
      last_name,
      first_name,
      phone,
      email,
      residence,
      profession,
      motivation,
      status,
      approved_member_id,
      created_at,
      reviewed_at,
      review_note
    `)
    .eq('id', id)
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (error || !application) {
    notFound()
  }

  const canReview =
    REVIEW_ROLES.includes(role)

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        <Link
          href="/memberships"
          className="font-bold text-slate-500 hover:text-slate-800"
        >
          ← Retour aux adhésions
        </Link>

        {query.success === 'approved' && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">

            <p className="font-black">
              Demande acceptée.
            </p>

            <p className="mt-1 text-sm">
              Le candidat est maintenant
              membre officiel
              {query.member
                ? ` sous le matricule ${query.member}.`
                : '.'}
            </p>

          </div>
        )}

        {query.success === 'rejected' && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 font-semibold text-amber-800">
            La demande a été refusée.
          </div>
        )}

        {query.error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {errorMessage(query.error)}
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">

          <div className="border-b bg-slate-900 p-7 text-white">

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              Demande d&apos;adhésion
            </p>

            <h1 className="mt-2 text-3xl font-black">
              {application.last_name}{' '}
              {application.first_name}
            </h1>

            <div className="mt-4">
              <StatusBadge
                status={application.status}
              />
            </div>

          </div>

          <div className="p-6 sm:p-8">

            <div className="grid gap-6 sm:grid-cols-2">

              <Info
                label="Téléphone"
                value={application.phone}
              />

              <Info
                label="Email"
                value={
                  application.email ||
                  'Non renseigné'
                }
              />

              <Info
                label="Résidence"
                value={
                  application.residence ||
                  'Non renseignée'
                }
              />

              <Info
                label="Profession"
                value={
                  application.profession ||
                  'Non renseignée'
                }
              />

              <Info
                label="Date de la demande"
                value={formatDateTime(
                  application.created_at
                )}
              />

              {application.reviewed_at && (
                <Info
                  label="Date de traitement"
                  value={formatDateTime(
                    application.reviewed_at
                  )}
                />
              )}

            </div>

            <div className="mt-7">

              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Motivation
              </p>

              <div className="mt-2 rounded-2xl bg-slate-50 p-5 leading-7 text-slate-700">
                {application.motivation ||
                  'Aucun message particulier.'}
              </div>

            </div>

            {application.review_note && (
              <div className="mt-7">

                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Observation du bureau
                </p>

                <div className="mt-2 rounded-2xl border p-5 leading-7 text-slate-700">
                  {application.review_note}
                </div>

              </div>
            )}

            {application.approved_member_id && (
              <div className="mt-7">

                <Link
                  href={`/members/${application.approved_member_id}`}
                  className="inline-flex rounded-xl bg-emerald-50 px-5 py-3 font-black text-emerald-700"
                >
                  Voir la fiche du membre →
                </Link>

              </div>
            )}

          </div>

        </section>

        {/* DECISION */}

        {canReview &&
          application.status ===
            'pending' && (
            <section className="mt-7 grid gap-5 lg:grid-cols-2">

              {/* ACCEPTER */}

              <form
                action={approveApplication}
                className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"
              >

                <input
                  type="hidden"
                  name="applicationId"
                  value={application.id}
                />

                <h2 className="text-lg font-black text-emerald-800">
                  Accepter la demande
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Le dossier membre sera créé automatiquement
                  automatiquement le membre
                  et lui attribuera son
                  matricule.
                </p>

                <textarea
                  name="approvalNote"
                  rows={3}
                  placeholder="Observation éventuelle..."
                  className="mt-5 w-full rounded-xl border px-4 py-3"
                />

                <button
                  type="submit"
                  className="mt-4 w-full rounded-xl bg-emerald-700 px-5 py-3 font-black text-white hover:bg-emerald-800"
                >
                  Accepter et créer le membre
                </button>

              </form>

              {/* REFUSER */}

              <form
                action={rejectApplication}
                className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm"
              >

                <input
                  type="hidden"
                  name="applicationId"
                  value={application.id}
                />

                <h2 className="text-lg font-black text-red-800">
                  Refuser la demande
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Le motif est obligatoire
                  et restera dans l&apos;historique.
                </p>

                <textarea
                  name="rejectionReason"
                  rows={3}
                  required
                  minLength={3}
                  placeholder="Motif du refus..."
                  className="mt-5 w-full rounded-xl border px-4 py-3"
                />

                <button
                  type="submit"
                  className="mt-4 w-full rounded-xl bg-red-700 px-5 py-3 font-black text-white hover:bg-red-800"
                >
                  Refuser la demande
                </button>

              </form>

            </section>
          )}

      </div>

    </main>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-semibold text-slate-900">
        {value}
      </p>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: string
}) {
  const label =
    status === 'approved'
      ? 'Acceptée'
      : status === 'rejected'
        ? 'Refusée'
        : status === 'cancelled'
          ? 'Annulée'
          : 'En attente'

  const style =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800'
        : status === 'cancelled'
          ? 'bg-slate-200 text-slate-700'
          : 'bg-amber-100 text-amber-800'

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${style}`}
    >
      {label}
    </span>
  )
}

function errorMessage(
  error: string
) {
  switch (error) {
    case 'phone-exists':
      return 'Un membre possédant déjà ce numéro de téléphone existe dans la mutuelle.'

    case 'email-exists':
      return 'Un membre possédant déjà cette adresse email existe dans la mutuelle.'

    case 'rejection-reason':
      return 'Le motif du refus est obligatoire.'

    default:
      return 'Impossible de traiter cette demande pour le moment.'
  }
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone:
        'Africa/Abidjan',
    }
  ).format(new Date(value))
}