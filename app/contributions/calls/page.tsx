import Link from 'next/link'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

import {
  activateContributionCall,
} from './actions'

type CallsPageProps = {
  searchParams: Promise<{
    created?: string
    activated?: string
    count?: string
    error?: string
  }>
}

type CallRow = {
  id: string
  title: string
  description: string | null
  beneficiary_member_id: string | null
  beneficiary_name: string | null
  amount: number
  launch_date: string
  due_date: string
  scope: string
  status: string
  created_at: string
}

export default async function ContributionCallsPage({
  searchParams,
}: CallsPageProps) {
  const query =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  const {
    data,
    error,
  } = await supabase
    .from('contribution_calls')
    .select(`
      id,
      title,
      description,
      beneficiary_member_id,
      beneficiary_name,
      amount,
      launch_date,
      due_date,
      scope,
      status,
      created_at
    `)
    .eq(
      'organization_id',
      organizationId
    )
    .order(
      'created_at',
      {
        ascending: false,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - calls:',
      error
    )

    throw new Error(
      'Impossible de charger les appels de cotisation.'
    )
  }

  const calls =
    (data ?? []) as CallRow[]

  // ==========================================================
  // BENEFICIAIRES MEMBRES
  // ==========================================================

  const beneficiaryIds =
    Array.from(
      new Set(
        calls
          .map(
            (call) =>
              call.beneficiary_member_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          )
      )
    )

  const beneficiaryMap =
    new Map<
      string,
      string
    >()

  if (
    beneficiaryIds.length > 0
  ) {
    const {
      data: beneficiaries,
    } = await supabase
      .from('members')
      .select(`
        id,
        member_number,
        first_name,
        last_name
      `)
      .in(
        'id',
        beneficiaryIds
      )

    for (
      const member of
        beneficiaries ?? []
    ) {
      beneficiaryMap.set(
        member.id,
        `${member.last_name} ${member.first_name}`
      )
    }
  }

  const canCreate = [
    'owner',
    'president',
    'treasurer',
    'secretary',
  ].includes(role)

  const canActivate = [
    'owner',
    'president',
    'treasurer',
  ].includes(role)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* HEADER */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="text-sm font-bold text-emerald-700">
              ESPACE MUTUELLE
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Appels de cotisations
            </h1>

            <p className="mt-2 text-slate-500">
              Gérez les cotisations exceptionnelles et les collectes
              ponctuelles de la mutuelle.
            </p>
          </div>

          {canCreate && (
            <Link
              href="/contributions/calls/new"
              className="rounded-xl bg-emerald-700 px-5 py-3 text-center font-bold text-white hover:bg-emerald-800"
            >
              + Nouvel appel
            </Link>
          )}

        </div>

        {/* MESSAGES */}

        {query.created ===
          '1' && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            L&apos;appel a été enregistré en brouillon.
            Vérifiez les informations avant de l&apos;activer.
          </div>
        )}

        {query.activated ===
          '1' && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            Appel activé avec succès :{' '}
            <strong>
              {query.count ?? '0'}
            </strong>{' '}
            obligation(s) créée(s).
          </div>
        )}

        {query.error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {query.error}
          </div>
        )}

        {/* LISTE */}

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">

          {calls.length ===
          0 ? (
            <div className="p-12 text-center">

              <p className="text-lg font-bold">
                Aucun appel de cotisation
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Créez votre premier appel exceptionnel.
              </p>

              {canCreate && (
                <Link
                  href="/contributions/calls/new"
                  className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white"
                >
                  Créer un appel
                </Link>
              )}

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">
                      Appel
                    </th>

                    <th className="px-5 py-4">
                      Bénéficiaire
                    </th>

                    <th className="px-5 py-4 text-right">
                      Montant / membre
                    </th>

                    <th className="px-5 py-4">
                      Date limite
                    </th>

                    <th className="px-5 py-4">
                      Portée
                    </th>

                    <th className="px-5 py-4">
                      Statut
                    </th>

                    <th className="px-5 py-4 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {calls.map(
                    (call) => {
                      const beneficiary =
                        call.beneficiary_member_id
                          ? beneficiaryMap.get(
                              call.beneficiary_member_id
                            )
                          : call.beneficiary_name

                      return (
                        <tr
                          key={call.id}
                          className="border-b align-top last:border-0 hover:bg-slate-50"
                        >

                          <td className="px-5 py-4">

                            <p className="font-bold text-slate-900">
                              {call.title}
                            </p>

                            {call.description && (
                              <p className="mt-1 max-w-md text-sm text-slate-500">
                                {call.description}
                              </p>
                            )}

                            <p className="mt-2 text-xs text-slate-400">
                              Lancé le{' '}
                              {formatDate(
                                call.launch_date
                              )}
                            </p>

                          </td>

                          <td className="px-5 py-4 text-sm">
                            {beneficiary ||
                              'Non renseigné'}
                          </td>

                          <td className="px-5 py-4 text-right font-bold">
                            {formatMoney(
                              call.amount
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {formatDate(
                              call.due_date
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {call.scope ===
                            'all_active'
                              ? 'Tous les membres'
                              : 'Sélection'}
                          </td>

                          <td className="px-5 py-4">
                            <CallStatus
                              status={
                                call.status
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-right">

                            {call.status ===
                              'draft' &&
                            canActivate ? (
                              <form
                                action={
                                  activateContributionCall
                                }
                              >
                                <input
                                  type="hidden"
                                  name="callId"
                                  value={
                                    call.id
                                  }
                                />

                                <button
                                  type="submit"
                                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
                                >
                                  Activer
                                </button>
                              </form>
                            ) : (
                              <span className="text-sm text-slate-400">
                                —
                              </span>
                            )}

                          </td>

                        </tr>
                      )
                    }
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

function CallStatus({
  status,
}: {
  status: string
}) {
  const labels:
    Record<
      string,
      string
    > = {
    draft: 'Brouillon',
    active: 'Actif',
    closed: 'Clôturé',
    cancelled: 'Annulé',
  }

  const styles:
    Record<
      string,
      string
    > = {
    draft:
      'bg-slate-100 text-slate-700',

    active:
      'bg-emerald-50 text-emerald-700',

    closed:
      'bg-blue-50 text-blue-700',

    cancelled:
      'bg-red-50 text-red-700',
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        styles[status] ??
        'bg-slate-100 text-slate-700'
      }`}
    >
      {labels[status] ??
        status}
    </span>
  )
}

function formatMoney(
  amount: number
) {
  return (
    new Intl.NumberFormat(
      'fr-FR',
      {
        maximumFractionDigits:
          0,
      }
    ).format(
      Number(amount)
    ) + ' FCFA'
  )
}

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}