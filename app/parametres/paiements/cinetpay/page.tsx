import Link from 'next/link'
import {
  redirect,
} from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  disableCinetPayConfiguration,
  enableCinetPayConfiguration,
  saveCinetPayConfiguration,
} from './actions'

// ============================================================
// EWUKAI
// PARAMETRES CINETPAY
// ============================================================

type PageProps = {
  searchParams: Promise<{
    error?: string
    success?: string
  }>
}

type CinetPayStatus = {
  configured: boolean

  provider:
    | string
    | null

  active: boolean

  site_id:
    | string
    | null

  channels:
    | string
    | null

  updated_at:
    | string
    | null
}

type RpcError = {
  code?: string
  message?: string
}

type RpcClient = {
  rpc: (
    functionName: string,
    args:
      Record<
        string,
        unknown
      >
  ) => Promise<{
    data: unknown
    error:
      | RpcError
      | null
  }>
}

const EDIT_ROLES =
  new Set([
    'owner',
    'president',
    'treasurer',
  ])

// ============================================================
// PAGE
// ============================================================

export default async function CinetPaySettingsPage({
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

  // ==========================================================
  // AUTORISATION
  // ==========================================================

  if (
    ![
      'owner',
      'president',
      'treasurer',
      'auditor',
    ].includes(
      role
    )
  ) {
    redirect(
      '/dashboard'
    )
  }

  const canEdit =
    EDIT_ROLES.has(
      role
    )

  // ==========================================================
  // ETAT DE CINETPAY
  // ==========================================================

  const rpcClient =
    supabase as unknown as
      RpcClient

  const {
    data:
      statusRaw,

    error:
      statusError,
  } =
    await rpcClient.rpc(
      'get_organization_cinetpay_status',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (
    statusError
  ) {
    console.error(
      'EWUKAI - CINETPAY STATUS:',
      {
        code:
          statusError.code,

        message:
          statusError.message,
      }
    )

    throw new Error(
      'Impossible de charger la configuration CinetPay.'
    )
  }

  const status =
    (
      statusRaw ??
      {
        configured:
          false,

        provider:
          'cinetpay',

        active:
          false,

        site_id:
          null,

        channels:
          null,

        updated_at:
          null,
      }
    ) as CinetPayStatus

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">

        <Link
          href="/parametres/paiements"
          className="text-sm font-black text-emerald-700 hover:text-emerald-800"
        >
          ← Retour aux moyens de paiement
        </Link>

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <section className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-7 text-white sm:p-9">

          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
            Prestataire de paiement
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Compte CinetPay
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            Connectez le compte marchand
            CinetPay de votre organisation.
            Les cotisations payées en ligne
            utiliseront ce compte marchand.
          </p>

        </section>

        {/* ================================================== */}
        {/* MESSAGES */}
        {/* ================================================== */}

        {query.success && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <p className="font-black text-emerald-900">
              ✓ {
                query.success
              }
            </p>

          </div>
        )}

        {query.error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              {
                query.error
              }
            </p>

          </div>
        )}

        {/* ================================================== */}
        {/* STATUT */}
        {/* ================================================== */}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                État de la connexion
              </p>

              <h2 className="mt-2 text-xl font-black text-slate-950">
                CinetPay
              </h2>

            </div>

            <StatusBadge
              configured={
                status.configured
              }
              active={
                status.active
              }
            />

          </div>

          {status.configured && (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">

              <StatusInfo
                label="SITE ID"
                value={
                  status.site_id ||
                  '—'
                }
              />

              <StatusInfo
                label="Canaux"
                value={
                  formatChannels(
                    status.channels
                  )
                }
              />

              <StatusInfo
                label="Identifiants sensibles"
                value="••••••••••••"
              />

            </div>
          )}

          {status.configured &&
            canEdit && (
            <div className="mt-6 border-t border-slate-100 pt-5">

              {status.active ? (
                <form
                  action={
                    disableCinetPayConfiguration
                  }
                >
                  <button
                    type="submit"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                  >
                    Désactiver CinetPay
                  </button>
                </form>
              ) : (
                <form
                  action={
                    enableCinetPayConfiguration
                  }
                >
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
                  >
                    Réactiver CinetPay
                  </button>
                </form>
              )}

            </div>
          )}

        </section>

        {/* ================================================== */}
        {/* FORMULAIRE */}
        {/* ================================================== */}

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Configuration
            </p>

            <h2 className="mt-2 text-xl font-black text-slate-950">
              {status.configured
                ? 'Modifier le compte marchand'
                : 'Connecter un compte marchand'}
            </h2>

          </div>

          {!canEdit ? (
            <div className="p-6">

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

                <p className="font-black text-blue-950">
                  Consultation uniquement
                </p>

                <p className="mt-2 text-sm leading-6 text-blue-800">
                  Votre rôle permet de
                  consulter l’état de la
                  connexion, mais pas de
                  modifier les identifiants
                  du prestataire.
                </p>

              </div>

            </div>
          ) : (
            <form
              action={
                saveCinetPayConfiguration
              }
              className="space-y-6 p-6"
            >

              {/* SITE ID */}

              <div>

                <label
                  htmlFor="siteId"
                  className="text-sm font-black text-slate-800"
                >
                  SITE ID
                </label>

                <input
                  id="siteId"
                  name="siteId"
                  type="text"
                  required
                  maxLength={200}
                  defaultValue={
                    status.site_id ??
                    ''
                  }
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />

              </div>

              {/* API KEY */}

              <div>

                <label
                  htmlFor="apiKey"
                  className="text-sm font-black text-slate-800"
                >
                  API KEY
                </label>

                <input
                  id="apiKey"
                  name="apiKey"
                  type="password"
                  maxLength={1000}
                  required={
                    !status.configured
                  }
                  autoComplete="new-password"
                  placeholder={
                    status.configured
                      ? 'Laisser vide pour conserver la clé actuelle'
                      : 'Saisissez votre API KEY'
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />

                {status.configured && (
                  <p className="mt-2 text-xs text-slate-500">
                    La clé actuelle reste
                    inchangée si ce champ
                    est laissé vide.
                  </p>
                )}

              </div>

              {/* SECRET KEY */}

              <div>

                <label
                  htmlFor="secretKey"
                  className="text-sm font-black text-slate-800"
                >
                  SECRET KEY
                </label>

                <input
                  id="secretKey"
                  name="secretKey"
                  type="password"
                  maxLength={1000}
                  required={
                    !status.configured
                  }
                  autoComplete="new-password"
                  placeholder={
                    status.configured
                      ? 'Laisser vide pour conserver la clé actuelle'
                      : 'Saisissez votre SECRET KEY'
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />

              </div>

              {/* CANAUX */}

              <div>

                <label
                  htmlFor="channels"
                  className="text-sm font-black text-slate-800"
                >
                  Canaux autorisés
                </label>

                <select
                  id="channels"
                  name="channels"
                  defaultValue={
                    status.channels ??
                    'MOBILE_MONEY'
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >

                  <option value="MOBILE_MONEY">
                    Mobile Money uniquement
                  </option>

                  <option value="ALL">
                    Tous les moyens disponibles
                  </option>

                  <option value="CREDIT_CARD">
                    Carte bancaire uniquement
                  </option>

                  <option value="WALLET">
                    Wallet uniquement
                  </option>

                </select>

              </div>

              {/* SECURITE */}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

                <p className="font-black text-amber-900">
                  Protection des identifiants
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  L’API KEY et la SECRET KEY
                  sont chiffrées côté serveur
                  avant leur enregistrement.
                  Elles ne seront jamais
                  réaffichées dans cette page.
                </p>

              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white transition hover:bg-emerald-800 sm:w-auto"
              >
                {status.configured
                  ? 'Enregistrer les modifications'
                  : 'Connecter CinetPay'}
              </button>

            </form>
          )}

        </section>

      </div>

    </main>
  )
}

// ============================================================
// BADGE
// ============================================================

function StatusBadge({
  configured,
  active,
}: {
  configured: boolean
  active: boolean
}) {
  if (!configured) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
        Non configuré
      </span>
    )
  }

  if (!active) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-700">
        Désactivé
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-700">
      Actif
    </span>
  )
}

// ============================================================
// INFO
// ============================================================

function StatusInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 break-words font-black text-slate-900">
        {value}
      </p>

    </div>
  )
}

// ============================================================
// CHANNEL
// ============================================================

function formatChannels(
  value:
    | string
    | null
) {
  switch (value) {
    case 'MOBILE_MONEY':
      return 'Mobile Money'

    case 'CREDIT_CARD':
      return 'Carte bancaire'

    case 'WALLET':
      return 'Wallet'

    case 'ALL':
      return 'Tous'

    default:
      return value ||
        '—'
  }
}