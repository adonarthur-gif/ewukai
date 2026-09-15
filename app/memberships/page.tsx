import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

type PageProps = {
  searchParams: Promise<{
    status?: string
    error?: string
  }>
}

type ApplicationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

type Application = {
  id: string
  last_name: string
  first_name: string
  phone: string
  email: string | null
  residence: string | null
  profession: string | null
  status: ApplicationStatus
  approved_member_id: string | null
  created_at: string
  reviewed_at: string | null
}

const ALLOWED_ROLES = [
  'owner',
  'president',
  'secretary',
  'auditor',
]

export default async function MembershipsPage({
  searchParams,
}: PageProps) {
  const query = await searchParams

  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  if (!ALLOWED_ROLES.includes(role)) {
    redirect('/dashboard')
  }

  const requestedStatus =
    query.status ?? 'pending'

  const selectedStatus:
    | ApplicationStatus
    | 'all' =
    [
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'all',
    ].includes(requestedStatus)
      ? (requestedStatus as
          | ApplicationStatus
          | 'all')
      : 'pending'

  const [
    pendingResult,
    approvedResult,
    rejectedResult,
  ] = await Promise.all([
    supabase
      .from('membership_applications')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('organization_id', organizationId)
      .eq('status', 'pending'),

    supabase
      .from('membership_applications')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('organization_id', organizationId)
      .eq('status', 'approved'),

    supabase
      .from('membership_applications')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('organization_id', organizationId)
      .eq('status', 'rejected'),
  ])

  let applicationsQuery = supabase
    .from('membership_applications')
    .select(`
      id,
      last_name,
      first_name,
      phone,
      email,
      residence,
      profession,
      status,
      approved_member_id,
      created_at,
      reviewed_at
    `)
    .eq('organization_id', organizationId)
    .order('created_at', {
      ascending: false,
    })
    .limit(200)

  if (selectedStatus !== 'all') {
    applicationsQuery =
      applicationsQuery.eq(
        'status',
        selectedStatus
      )
  }

  const {
    data,
    error,
  } = await applicationsQuery

  if (error) {
    console.error(
      'EWUKAI - memberships:',
      error
    )

    throw new Error(
      'Impossible de charger les demandes d’adhésion.'
    )
  }

  const applications =
    (data ?? []) as Application[]

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* HEADER */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
              ESPACE MUTUELLE
            </p>

            <h1 className="mt-1 text-3xl font-black text-slate-900">
              Adhésions
            </h1>

            <p className="mt-2 max-w-2xl text-slate-500">
              Examinez les demandes reçues
              depuis la vitrine publique
              de votre mutuelle.
            </p>
          </div>

          <Link
            href="/members"
            className="rounded-xl border bg-white px-5 py-3 font-bold text-slate-700"
          >
            Voir les membres
          </Link>

        </div>

        {/* ERREUR */}

        {query.error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            Impossible de traiter cette demande.
          </div>
        )}

        {/* COMPTEURS */}

        <section className="mt-7 grid gap-4 sm:grid-cols-3">

          <StatCard
            label="En attente"
            value={pendingResult.count ?? 0}
            href="/memberships?status=pending"
            highlight
          />

          <StatCard
            label="Acceptées"
            value={approvedResult.count ?? 0}
            href="/memberships?status=approved"
          />

          <StatCard
            label="Refusées"
            value={rejectedResult.count ?? 0}
            href="/memberships?status=rejected"
          />

        </section>

        {/* FILTRES */}

        <div className="mt-7 flex flex-wrap gap-2">

          <FilterLink
            href="/memberships?status=pending"
            label="En attente"
            active={selectedStatus === 'pending'}
          />

          <FilterLink
            href="/memberships?status=approved"
            label="Acceptées"
            active={selectedStatus === 'approved'}
          />

          <FilterLink
            href="/memberships?status=rejected"
            label="Refusées"
            active={selectedStatus === 'rejected'}
          />

          <FilterLink
            href="/memberships?status=all"
            label="Toutes"
            active={selectedStatus === 'all'}
          />

        </div>

        {/* LISTE */}

        <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">

          {applications.length === 0 ? (
            <div className="p-12 text-center">

              <p className="text-lg font-black text-slate-800">
                Aucune demande
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Aucune demande ne correspond
                au filtre sélectionné.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                  <tr>
                    <th className="px-5 py-4">
                      Candidat
                    </th>

                    <th className="px-5 py-4">
                      Contact
                    </th>

                    <th className="px-5 py-4">
                      Résidence
                    </th>

                    <th className="px-5 py-4">
                      Profession
                    </th>

                    <th className="px-5 py-4">
                      Demande
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

                  {applications.map(
                    (application) => (
                      <tr
                        key={application.id}
                        className="border-b last:border-0 hover:bg-slate-50"
                      >

                        <td className="px-5 py-4">

                          <p className="font-black text-slate-900">
                            {application.last_name}{' '}
                            {application.first_name}
                          </p>

                        </td>

                        <td className="px-5 py-4">

                          <p className="font-semibold">
                            {application.phone}
                          </p>

                          {application.email && (
                            <p className="mt-1 text-xs text-slate-500">
                              {application.email}
                            </p>
                          )}

                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {application.residence || '—'}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {application.profession || '—'}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatDateTime(
                            application.created_at
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={application.status}
                          />
                        </td>

                        <td className="px-5 py-4">

                          <Link
                            href={`/memberships/${application.id}`}
                            className="font-bold text-emerald-700 hover:underline"
                          >
                            Examiner
                          </Link>

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

function StatCard({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string
  value: number
  href: string
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 ${
        highlight
          ? 'border-emerald-200 bg-emerald-50'
          : 'bg-white'
      }`}
    >
      <p className="text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-slate-900">
        {value}
      </p>
    </Link>
  )
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-bold ${
        active
          ? 'bg-slate-900 text-white'
          : 'border bg-white text-slate-600'
      }`}
    >
      {label}
    </Link>
  )
}

function StatusBadge({
  status,
}: {
  status: ApplicationStatus
}) {
  const styles:
    Record<ApplicationStatus, string> = {
      pending:
        'bg-amber-100 text-amber-800',

      approved:
        'bg-emerald-100 text-emerald-800',

      rejected:
        'bg-red-100 text-red-800',

      cancelled:
        'bg-slate-200 text-slate-700',
    }

  const labels:
    Record<ApplicationStatus, string> = {
      pending: 'En attente',
      approved: 'Acceptée',
      rejected: 'Refusée',
      cancelled: 'Annulée',
    }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone:
        'Africa/Abidjan',
    }
  ).format(
    new Date(value)
  )
}