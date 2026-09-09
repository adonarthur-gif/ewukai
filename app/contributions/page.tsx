import Link from 'next/link'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

type ContributionsPageProps = {
  searchParams: Promise<{
    created?: string
    error?: string
  }>
}

const frequencyLabels: Record<string, string> = {
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  annual: 'Annuelle',
  one_time: 'Exceptionnelle',
}

export default async function ContributionsPage({
  searchParams,
}: ContributionsPageProps) {
  const params = await searchParams

  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  const { data: contributionTypes, error } =
    await supabase
      .from('contribution_types')
      .select(`
        id,
        name,
        description,
        amount,
        frequency,
        due_day,
        start_date,
        end_date,
        is_mandatory,
        is_active,
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
      'AFRI CLUB - contributions:',
      error
    )

    throw new Error(
      'Impossible de charger les cotisations.'
    )
  }

  const canManage = [
    'owner',
    'president',
    'treasurer',
  ].includes(role)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              ESPACE MUTUELLE
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Cotisations
            </h1>

            <p className="mt-2 text-slate-600">
              Configurez les cotisations de votre mutuelle.
            </p>
          </div>

          {canManage && (
            <Link
              href="/contributions/new"
              className="rounded-lg bg-emerald-700 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-800"
            >
              + Nouvelle cotisation
            </Link>
          )}
        </div>

        {params.created === '1' && (
          <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            La cotisation a été créée avec succès.
          </div>
        )}

        {params.error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {params.error}
          </div>
        )}

        {!contributionTypes ||
        contributionTypes.length === 0 ? (
          <section className="mt-8 rounded-2xl border bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold">
              Aucune cotisation configurée
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
              Créez la première cotisation de votre
              mutuelle afin de commencer le suivi
              des paiements.
            </p>

            {canManage && (
              <Link
                href="/contributions/new"
                className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white"
              >
                Créer une cotisation
              </Link>
            )}
          </section>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {contributionTypes.map(
              (item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {item.name}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {
                          frequencyLabels[
                            item.frequency
                          ] ??
                          item.frequency
                        }
                      </p>
                    </div>

                    <span
                      className={
                        item.is_active
                          ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
                          : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500'
                      }
                    >
                      {item.is_active
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </div>

                  <p className="mt-5 text-3xl font-bold text-slate-900">
                    {formatMoney(
                      Number(item.amount)
                    )}
                  </p>

                  {item.description && (
                    <p className="mt-3 text-sm text-slate-600">
                      {item.description}
                    </p>
                  )}

                  <div className="mt-5 space-y-2 border-t pt-4 text-sm">
                    <InfoLine
                      label="Obligatoire"
                      value={
                        item.is_mandatory
                          ? 'Oui'
                          : 'Non'
                      }
                    />

                    <InfoLine
                      label="Jour d’échéance"
                      value={
                        item.due_day
                          ? `Le ${item.due_day}`
                          : 'Non applicable'
                      }
                    />

                    <InfoLine
                      label="Début"
                      value={
                        item.start_date
                      }
                    />
                  </div>
                </article>
              )
            )}
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-emerald-700"
          >
            ← Retour au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  )
}

function InfoLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="font-medium">
        {value}
      </span>
    </div>
  )
}

function formatMoney(
  amount: number
) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      maximumFractionDigits: 0,
    }
  ).format(amount) + ' FCFA'
}