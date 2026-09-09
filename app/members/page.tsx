import Link from 'next/link'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

type MembersPageProps = {
  searchParams: Promise<{
    q?: string
    status?: string
    page?: string
    error?: string
  }>
}

const validStatuses = [
  'active',
  'inactive',
  'suspended',
  'deceased',
  'archived',
]

export default async function MembersPage({
  searchParams,
}: MembersPageProps) {
  const params = await searchParams

  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  const q =
    params.q?.trim() ?? ''

  const status =
    params.status &&
    validStatuses.includes(params.status)
      ? params.status
      : null

  const currentPage = Math.max(
    1,
    Number.parseInt(
      params.page ?? '1',
      10
    ) || 1
  )

  const pageSize = 25

  const { data, error } =
    await supabase.rpc('list_members', {
      target_organization_id:
        organizationId,

      search_term:
        q || null,

      status_filter:
        status,

      page_size:
        pageSize,

      page_offset:
        (currentPage - 1) * pageSize,
    })

  if (error) {
    throw new Error(
      'Impossible de charger les membres.'
    )
  }

  const members = data ?? []

  const total =
    members.length > 0
      ? Number(
          members[0].total_count
        )
      : 0

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  )

  const canCreate = [
    'owner',
    'president',
    'secretary',
  ].includes(role)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              ESPACE MUTUELLE
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Membres
            </h1>

            <p className="mt-2 text-slate-600">
              {total} membre
              {total !== 1 ? 's' : ''}
            </p>
          </div>

          {canCreate && (
            <Link
              href="/members/new"
              className="rounded-lg bg-emerald-700 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-800"
            >
              + Ajouter un membre
            </Link>
          )}
        </div>

        {params.error && (
          <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {params.error}
          </div>
        )}

        <form
          method="get"
          className="mb-6 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_220px_auto]"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nom, prénom, téléphone ou matricule..."
            className="rounded-lg border px-3 py-2"
          />

          <select
            name="status"
            defaultValue={status ?? ''}
            className="rounded-lg border bg-white px-3 py-2"
          >
            <option value="">
              Tous les statuts
            </option>

            <option value="active">
              Actifs
            </option>

            <option value="inactive">
              Inactifs
            </option>

            <option value="suspended">
              Suspendus
            </option>

            <option value="deceased">
              Décédés
            </option>

            <option value="archived">
              Archivés
            </option>
          </select>

          <button
            type="submit"
            className="rounded-lg border bg-slate-900 px-5 py-2 font-medium text-white"
          >
            Rechercher
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {members.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-lg font-semibold">
                Aucun membre trouvé
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Commencez par enregistrer le
                premier adhérent.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b bg-slate-50 text-sm text-slate-600">
                  <tr>
                    <th className="px-5 py-4">
                      Matricule
                    </th>

                    <th className="px-5 py-4">
                      Membre
                    </th>

                    <th className="px-5 py-4">
                      Téléphone
                    </th>

                    <th className="px-5 py-4">
                      Statut
                    </th>

                    <th className="px-5 py-4">
                      Adhésion
                    </th>

                    <th className="px-5 py-4" />
                  </tr>
                </thead>

                <tbody>
                  {members.map(
                    (member: any) => (
                      <tr
                        key={member.id}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-5 py-4 font-mono text-sm">
                          {member.member_number}
                        </td>

                        <td className="px-5 py-4 font-medium">
                          {member.last_name}{' '}
                          {member.first_name}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {member.phone ?? '—'}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              member.status
                            }
                          />
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {member.joined_at}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/members/${member.id}`}
                            className="font-medium text-emerald-700"
                          >
                            Voir
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <PaginationLink
              page={
                currentPage - 1
              }
              disabled={
                currentPage <= 1
              }
              q={q}
              status={status}
            >
              ← Précédent
            </PaginationLink>

            <span className="text-sm text-slate-600">
              Page {currentPage} sur{' '}
              {totalPages}
            </span>

            <PaginationLink
              page={
                currentPage + 1
              }
              disabled={
                currentPage >=
                totalPages
              }
              q={q}
              status={status}
            >
              Suivant →
            </PaginationLink>
          </div>
        )}
      </div>
    </main>
  )
}

function StatusBadge({
  status,
}: {
  status: string
}) {
  const labels: Record<
    string,
    string
  > = {
    active: 'Actif',
    inactive: 'Inactif',
    suspended: 'Suspendu',
    deceased: 'Décédé',
    archived: 'Archivé',
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
      {labels[status] ?? status}
    </span>
  )
}

function PaginationLink({
  page,
  disabled,
  q,
  status,
  children,
}: {
  page: number
  disabled: boolean
  q: string
  status: string | null
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border px-4 py-2 text-sm text-slate-400">
        {children}
      </span>
    )
  }

  const params =
    new URLSearchParams()

  params.set(
    'page',
    String(page)
  )

  if (q) {
    params.set('q', q)
  }

  if (status) {
    params.set(
      'status',
      status
    )
  }

  return (
    <Link
      href={`/members?${params.toString()}`}
      className="rounded-lg border bg-white px-4 py-2 text-sm font-medium"
    >
      {children}
    </Link>
  )
}