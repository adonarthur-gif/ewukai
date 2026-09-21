import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import { requireOrganizationFeatureAccess } from '@/lib/subscriptions/feature-access'
import { archiveTreasuryAccount } from './actions'

type PageProps = {
  searchParams: Promise<{
    success?: string
    error?: string
  }>
}

type TreasuryAccount = {
  id: string
  label: string
  payment_method: string
  account_holder: string
  phone_number: string | null
  bank_name: string | null
  account_number: string | null
  can_receive: boolean
  can_spend: boolean
  is_active: boolean
}

type AccountBalance = {
  treasury_account_id: string | null
  account_label: string
  payment_method: string
  account_holder: string
  total_credits: number
  total_debits: number
  current_balance: number
  is_active: boolean
}

export default async function TreasuryAccountsPage({
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
      'secretary',
      'auditor',
    ].includes(role)
  ) {
    redirect('/dashboard')
  }

  await requireOrganizationFeatureAccess(
    {
      supabase,
      organizationId,
    },
    'treasury'
  )

  const canManage =
    [
      'owner',
      'president',
      'treasurer',
    ].includes(role)

  const [
    accountsResult,
    balancesResult,
  ] =
    await Promise.all([

      supabase
        .from(
          'treasury_accounts'
        )
        .select(`
          id,
          label,
          payment_method,
          account_holder,
          phone_number,
          bank_name,
          account_number,
          can_receive,
          can_spend,
          is_active
        `)
        .eq(
          'organization_id',
          organizationId
        )
        .order(
          'is_active',
          {
            ascending: false,
          }
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        ),

      supabase.rpc(
        'get_treasury_account_balances',
        {
          target_organization_id:
            organizationId,
        }
      ),
    ])

  if (
    accountsResult.error
  ) {
    throw new Error(
      'Impossible de charger les comptes de trésorerie.'
    )
  }

  if (
    balancesResult.error
  ) {
    throw new Error(
      'Impossible de calculer les soldes par compte.'
    )
  }

  const accounts =
    (
      accountsResult.data ??
      []
    ) as TreasuryAccount[]

  const balances =
    (
      balancesResult.data ??
      []
    ) as AccountBalance[]

  const balanceMap =
    new Map(
      balances
        .filter(
          (item) =>
            item.treasury_account_id
        )
        .map(
          (item) => [
            item.treasury_account_id!,
            item,
          ]
        )
    )

  const legacyBalance =
    balances.find(
      (item) =>
        item.treasury_account_id ===
        null
    )

  const totalBalance =
    balances.reduce(
      (
        total,
        account
      ) =>
        total +
        Number(
          account.current_balance
        ),
      0
    )

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
              TRÉSORERIE
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Comptes de réception
            </h1>

            <p className="mt-2 max-w-2xl text-slate-500">
              Numéros Mobile Money,
              comptes bancaires et
              autres lieux où les fonds
              de la mutuelle sont
              réellement conservés.
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/cash"
              className="rounded-xl border bg-white px-4 py-3 font-bold"
            >
              ← Trésorerie
            </Link>

            {canManage && (
              <Link
                href="/cash/accounts/new"
                className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white"
              >
                + Nouveau compte
              </Link>
            )}

          </div>

        </div>

        {query.success ===
          'created' && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">
            Compte de trésorerie
            enregistré avec succès.
          </div>
        )}

        {query.success ===
          'archived' && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-800">
            Le compte a été archivé.
            Son historique financier est
            conservé.
          </div>
        )}

        <section className="mt-6 rounded-3xl bg-slate-900 p-7 text-white">

          <p className="text-sm uppercase tracking-wide text-slate-400">
            Solde de trésorerie enregistré
          </p>

          <p className="mt-2 text-4xl font-black text-emerald-300">
            {formatMoney(
              totalBalance
            )}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Total calculé à partir des opérations comptabilisées par votre mutuelle.
          </p>

        </section>

        {accounts.length === 0 ? (
          <section className="mt-6 rounded-2xl border bg-white p-10 text-center">

            <h2 className="text-xl font-bold">
              Aucun compte configuré
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-slate-500">
              Commencez par enregistrer
              le numéro Wave, Orange
              Money, MTN, Moov, le compte
              bancaire ou la caisse
              espèces réellement utilisée
              par la mutuelle.
            </p>

            {canManage && (
              <Link
                href="/cash/accounts/new"
                className="mt-6 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white"
              >
                Créer le premier compte
              </Link>
            )}

          </section>
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">

            {accounts.map(
              (account) => {
                const balance =
                  balanceMap.get(
                    account.id
                  )

                return (
                  <article
                    key={
                      account.id
                    }
                    className={`rounded-2xl border bg-white p-6 shadow-sm ${
                      account.is_active
                        ? ''
                        : 'opacity-60'
                    }`}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                          {paymentLabel(
                            account.payment_method
                          )}
                        </p>

                        <h2 className="mt-1 text-xl font-bold">
                          {
                            account.label
                          }
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Titulaire :{' '}
                          {
                            account.account_holder
                          }
                        </p>

                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          account.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {account.is_active
                          ? 'Actif'
                          : 'Archivé'}
                      </span>

                    </div>

                    {account.phone_number && (
                      <div className="mt-5 rounded-xl bg-slate-50 p-4">

                        <p className="text-xs uppercase text-slate-500">
                          Numéro
                        </p>

                        <p className="mt-1 text-lg font-black">
                          {
                            account.phone_number
                          }
                        </p>

                      </div>
                    )}

                    {account.bank_name && (
                      <div className="mt-5 rounded-xl bg-slate-50 p-4">

                        <p className="font-bold">
                          {
                            account.bank_name
                          }
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Compte :{' '}
                          {
                            account.account_number
                          }
                        </p>

                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-3 gap-3">

                      <MiniStat
                        label="Entrées"
                        value={
                          balance?.total_credits ??
                          0
                        }
                      />

                      <MiniStat
                        label="Sorties"
                        value={
                          balance?.total_debits ??
                          0
                        }
                      />

                      <MiniStat
                        label="Solde"
                        value={
                          balance?.current_balance ??
                          0
                        }
                        strong
                      />

                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">

                      {account.can_receive && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                          Réception autorisée
                        </span>
                      )}

                      {account.can_spend && (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                          Dépenses autorisées
                        </span>
                      )}

                    </div>

                    {canManage &&
                      account.is_active && (
                        <form
                          action={
                            archiveTreasuryAccount
                          }
                          className="mt-6 border-t pt-4"
                        >

                          <input
                            type="hidden"
                            name="accountId"
                            value={
                              account.id
                            }
                          />

                          <button
                            type="submit"
                            className="text-sm font-bold text-red-700 hover:underline"
                          >
                            Archiver ce compte
                          </button>

                        </form>
                      )}

                  </article>
                )
              }
            )}

          </section>
        )}

        {legacyBalance && (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h2 className="font-bold text-amber-900">
                  Historique non affecté
                </h2>

                <p className="mt-1 text-sm text-amber-800">
                  Ces opérations ont été
                  enregistrées avant la
                  création des comptes de
                  trésorerie. La plateforme ne
                  suppose pas sur quel
                  compte elles se trouvent.
                </p>

              </div>

              <p className="text-2xl font-black text-amber-900">
                {formatMoney(
                  legacyBalance.current_balance
                )}
              </p>

            </div>

          </section>
        )}

      </div>

    </main>
  )
}

function MiniStat({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="rounded-xl border p-3">

      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 font-black ${
          strong
            ? 'text-emerald-700'
            : 'text-slate-900'
        }`}
      >
        {formatMoney(
          value
        )}
      </p>

    </div>
  )
}

function paymentLabel(
  method: string
) {
  const labels:
    Record<string, string> = {
      cash: 'Espèces',
      wave: 'Wave',
      orange_money:
        'Orange Money',
      mtn_momo:
        'MTN MoMo',
      moov_money:
        'Moov Money',
      bank_transfer:
        'Compte bancaire',
      other: 'Autre',
    }

  return (
    labels[method] ??
    method
  )
}

function formatMoney(
  value: number
) {
  return (
    new Intl.NumberFormat(
      'fr-FR'
    ).format(
      Number(value)
    ) +
    ' FCFA'
  )
}
