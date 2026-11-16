import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

import {
  disablePlatformCinetPay,
  enablePlatformCinetPay,
  savePlatformCinetPayConfiguration,
} from './cinetpay-actions'

import {
  updatePlatformSettings,
} from './actions'

// ============================================================
// TYPES
// ============================================================

type PageProps = {
  searchParams: Promise<{
    saved?: string
    error?: string

    cinetpay_saved?: string
    cinetpay_disabled?: string
    cinetpay_enabled?: string
    cinetpay_error?: string
  }>
}

type PlatformSettings = {
  platform_name: string

  support_email:
    | string
    | null

  support_phone:
    | string
    | null

  default_country_code: string

  default_currency: string

  default_locale: string

  default_timezone: string

  created_at:
    | string
    | null

  updated_at:
    | string
    | null
}

type PlatformCinetPayStatus = {
  configured: boolean

  provider: string

  environment:
    | 'sandbox'
    | 'production'

  channels: string

  active: boolean

  has_api_key: boolean

  has_api_password: boolean

  checkout_configured: boolean

  checkout_enabled: boolean

  checkout_has_api_key: boolean

  checkout_has_secret_key: boolean

  checkout_site_id:
    | string
    | null

  credential_version:
    | number
    | null

  created_at:
    | string
    | null

  updated_at:
    | string
    | null
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminSettingsPage({
  searchParams,
}: PageProps) {
  const query =
    await searchParams

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  // ==========================================================
  // PARAMETRES GENERAUX
  // ==========================================================

  const {
    data:
      settingsData,

    error:
      settingsError,
  } =
    await supabase.rpc(
      'get_platform_settings'
    )

  if (settingsError) {
    console.error(
      'EWUKAI - platform settings:',
      settingsError
    )

    throw new Error(
      'Impossible de charger les paramètres de la plateforme.'
    )
  }

  const settings =
    settingsData as
      PlatformSettings

  // ==========================================================
  // CINETPAY GLOBAL EWUKAI
  // ==========================================================

  const {
    data:
      cinetPayData,

    error:
      cinetPayError,
  } =
    await supabase.rpc(
      'get_platform_cinetpay_status'
    )

  if (cinetPayError) {
    console.error(
      'EWUKAI - platform CinetPay status:',
      cinetPayError
    )

    throw new Error(
      'Impossible de charger la configuration CinetPay.'
    )
  }

  const cinetPay =
    cinetPayData as
      PlatformCinetPayStatus

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ===================================================== */}
      {/* HERO */}
      {/* ===================================================== */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Administration EWUKAI
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Paramètres plateforme
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
            Gérez les informations générales,
            les paramètres régionaux et les
            services de paiement globaux
            utilisés par EWUKAI.
          </p>

        </div>

      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

        {/* =================================================== */}
        {/* MESSAGES PARAMETRES GENERAUX */}
        {/* =================================================== */}

        {query.saved ===
          '1' && (
          <SuccessBox
            title="Paramètres enregistrés"
            message="La configuration générale EWUKAI a été mise à jour."
          />
        )}

        {query.error && (
          <ErrorBox
            title="Modification impossible"
            message="Vérifiez les informations saisies puis réessayez."
          />
        )}

        {/* =================================================== */}
        {/* MESSAGES CINETPAY */}
        {/* =================================================== */}

        {query.cinetpay_saved ===
          '1' && (
          <SuccessBox
            title="CinetPay enregistré"
            message="La configuration CinetPay globale d’EWUKAI a été mise à jour."
          />
        )}

        {query.cinetpay_disabled ===
          '1' && (
          <SuccessBox
            title="CinetPay désactivé"
            message="Les nouveaux paiements CinetPay sont désactivés au niveau de la plateforme."
          />
        )}

        {query.cinetpay_enabled ===
          '1' && (
          <SuccessBox
            title="CinetPay activé"
            message="Le compte marchand CinetPay global EWUKAI est maintenant actif."
          />
        )}

        {query.cinetpay_error && (
          <ErrorBox
            title="Configuration CinetPay impossible"
            message={
              cinetPayErrorMessage(
                query.cinetpay_error
              )
            }
          />
        )}

        {/* =================================================== */}
        {/* PARAMETRES GENERAUX */}
        {/* =================================================== */}

        <form
          action={
            updatePlatformSettings
          }
          className="space-y-6"
        >

          {/* IDENTITE */}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <Header
              title="Identité de la plateforme"
              description="Informations générales utilisées pour identifier EWUKAI."
            />

            <div className="grid gap-5 p-6 sm:grid-cols-2">

              <Field
                label="Nom de la plateforme"
                name="platform_name"
                defaultValue={
                  settings.platform_name
                }
                required
              />

              <Field
                label="E-mail du support"
                name="support_email"
                type="email"
                defaultValue={
                  settings.support_email ??
                  ''
                }
                placeholder="support@ewukai.com"
              />

              <Field
                label="Téléphone du support"
                name="support_phone"
                defaultValue={
                  settings.support_phone ??
                  ''
                }
                placeholder="+225 ..."
              />

            </div>

          </section>

          {/* PARAMETRES REGIONAUX */}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <Header
              title="Paramètres régionaux"
              description="Valeurs par défaut utilisées par la plateforme."
            />

            <div className="grid gap-5 p-6 sm:grid-cols-2">

              <Field
                label="Code pays"
                name="default_country_code"
                defaultValue={
                  settings.default_country_code
                }
                maxLength={2}
                required
              />

              <Field
                label="Devise"
                name="default_currency"
                defaultValue={
                  settings.default_currency
                }
                maxLength={3}
                required
              />

              <Field
                label="Langue / locale"
                name="default_locale"
                defaultValue={
                  settings.default_locale
                }
                required
              />

              <Field
                label="Fuseau horaire"
                name="default_timezone"
                defaultValue={
                  settings.default_timezone
                }
                required
              />

            </div>

          </section>

          {/* INFO NON SENSIBLE */}

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

            <p className="font-black text-blue-950">
              Configuration générale non sensible
            </p>

            <p className="mt-1 text-sm leading-6 text-blue-800">
              Les mots de passe, clés Supabase et
              autres secrets techniques ne sont
              jamais enregistrés dans les paramètres
              généraux ci-dessus.
            </p>

          </section>

          {/* ACTION */}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-xs font-semibold text-slate-400">
              Dernière modification :{' '}
              {formatDateTime(
                settings.updated_at
              )}
            </p>

            <button
              type="submit"
              className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Enregistrer les paramètres
            </button>

          </div>

        </form>

        {/* =================================================== */}
        {/* CINETPAY GLOBAL EWUKAI */}
        {/* =================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-6 py-5 sm:flex sm:items-start sm:justify-between sm:gap-4">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Paiement plateforme
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                CinetPay central EWUKAI
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Compte marchand CinetPay global
                utilisé par EWUKAI pour les
                paiements en ligne des membres.
              </p>

            </div>

            <div className="mt-4 sm:mt-0">

              {cinetPay.active
                ? (
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
                    Actif
                  </span>
                )
                : (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                    Inactif
                  </span>
                )}

            </div>

          </div>

          {/* ETAT */}

          <div className="grid gap-4 border-b border-slate-100 bg-slate-50/70 p-6 sm:grid-cols-2 lg:grid-cols-4">

            <StatusCard
              label="Configuration"
              value={
                cinetPay.configured
                  ? 'Configurée'
                  : 'Non configurée'
              }
            />

            <StatusCard
              label="Environnement"
              value={
                cinetPay.environment ===
                'production'
                  ? 'Production'
                  : 'Sandbox'
              }
            />

            <StatusCard
              label="Canaux"
              value={
                formatChannels(
                  cinetPay.channels
                )
              }
            />

            <StatusCard
              label="Identifiants"
              value={
                cinetPay.has_api_key &&
                cinetPay.has_api_password
                  ? 'Protégés'
                  : 'Incomplets'
              }
            />

          </div>

          {/* FORMULAIRE CINETPAY */}

          <form
            action={
              savePlatformCinetPayConfiguration
            }
            className="space-y-6 p-6"
          >

            <div className="grid gap-5 sm:grid-cols-2">

              <div>

                <label
                  htmlFor="environment"
                  className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
                >
                  Environnement
                </label>

                <select
                  id="environment"
                  name="environment"
                  defaultValue={
                    cinetPay.environment ||
                    'sandbox'
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                >
                  <option value="sandbox">
                    Sandbox
                  </option>

                  <option value="production">
                    Production
                  </option>
                </select>

              </div>

              <div>

                <label
                  htmlFor="channels"
                  className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
                >
                  Canaux CinetPay
                </label>

                <select
                  id="channels"
                  name="channels"
                  defaultValue={
                    cinetPay.channels ||
                    'MOBILE_MONEY'
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                >
                  <option value="MOBILE_MONEY">
                    Mobile Money
                  </option>

                  <option value="ALL">
                    Tous les canaux
                  </option>

                  <option value="CREDIT_CARD">
                    Carte bancaire
                  </option>

                  <option value="WALLET">
                    Wallet
                  </option>
                </select>

              </div>

              <div>

                <label
                  htmlFor="apiKey"
                  className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
                >
                  API KEY
                </label>

                <input
                  id="apiKey"
                  name="apiKey"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    cinetPay.has_api_key
                      ? '•••••••••••• — laisser vide pour conserver'
                      : 'Saisir l’API KEY'
                  }
                  maxLength={1000}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />

              </div>

              <div>

                <label
                  htmlFor="apiPassword"
                  className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
                >
                  API PASSWORD
                </label>

                <input
                  id="apiPassword"
                  name="apiPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    cinetPay.has_api_password
                      ? '•••••••••••• — laisser vide pour conserver'
                      : 'Saisir le mot de passe API'
                  }
                  maxLength={1000}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />

              </div>

            </div>

            {/* ================================================ */}
            {/* CHECKOUT V2 - CARTE BANCAIRE */}
            {/* ================================================ */}

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                <div>

                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                    Checkout v2
                  </p>

                  <h3 className="mt-1 text-lg font-black text-blue-950">
                    Carte bancaire — Visa / Mastercard
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-800">
                    Ces identifiants sont utilisés uniquement pour
                    les paiements par carte bancaire des membres.
                    Les champs secrets laissés vides conservent
                    leurs valeurs actuelles.
                  </p>

                </div>

                <span
                  className={
                    cinetPay.checkout_configured
                      ? 'inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800'
                      : 'inline-flex w-fit rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600'
                  }
                >
                  {cinetPay.checkout_configured
                    ? 'Configuré'
                    : 'Non configuré'}
                </span>

              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">

                <div>

                  <label
                    htmlFor="checkoutApiKey"
                    className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    API Key Checkout
                  </label>

                  <input
                    id="checkoutApiKey"
                    name="checkoutApiKey"
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      cinetPay.checkout_has_api_key
                        ? '•••••••••••• — laisser vide pour conserver'
                        : 'Saisir l’API Key Checkout'
                    }
                    maxLength={1000}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />

                </div>

                <div>

                  <label
                    htmlFor="checkoutSiteId"
                    className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    Site ID
                  </label>

                  <input
                    id="checkoutSiteId"
                    name="checkoutSiteId"
                    type="text"
                    defaultValue={
                      cinetPay.checkout_site_id ||
                      ''
                    }
                    placeholder="Ex. 123456"
                    maxLength={255}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />

                </div>

                <div>

                  <label
                    htmlFor="checkoutSecretKey"
                    className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    Secret Key
                  </label>

                  <input
                    id="checkoutSecretKey"
                    name="checkoutSecretKey"
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      cinetPay.checkout_has_secret_key
                        ? '•••••••••••• — laisser vide pour conserver'
                        : 'Saisir la Secret Key'
                    }
                    maxLength={1000}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />

                </div>

                <div className="flex items-end">

                  <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">

                    <input
                      type="checkbox"
                      name="checkoutEnabled"
                      defaultChecked={
                        cinetPay.checkout_enabled
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />

                    <span>

                      <span className="block text-sm font-black text-slate-900">
                        Activer Visa / Mastercard
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        L’activation nécessite une API Key,
                        un Site ID et une Secret Key Checkout valides.
                      </span>

                    </span>

                  </label>

                </div>

              </div>

            </div>

            {/* SECURITE */}

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

              <p className="font-black text-emerald-950">
                Identifiants protégés
              </p>

              <p className="mt-1 text-sm leading-6 text-emerald-800">
                L’API KEY et l’API PASSWORD sont
                chiffrés côté serveur avant leur
                stockage. Les valeurs enregistrées
                ne sont jamais réaffichées dans
                cette interface.
              </p>

            </div>

            {/* ARCHITECTURE */}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

              <p className="font-black text-amber-950">
                Compte marchand central EWUKAI
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Les mutuelles ne configurent pas
                les identifiants CinetPay. Elles
                définissent uniquement leurs moyens
                de paiement autorisés dans leurs
                propres paramètres. EWUKAI utilise
                ce compte central pour traiter les
                paiements en ligne.
              </p>

            </div>

            {/* ACTIONS */}

            <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 lg:flex-row lg:items-center lg:justify-between">

              <div className="text-xs font-semibold text-slate-400">

                <p>
                  Version des identifiants :{' '}
                  {cinetPay.credential_version ??
                    '—'}
                </p>

                <p className="mt-1">
                  Dernière modification :{' '}
                  {formatDateTime(
                    cinetPay.updated_at
                  )}
                </p>

              </div>

              <div className="flex flex-col gap-3 sm:flex-row">

                {cinetPay.configured &&
                  cinetPay.environment ===
                    'sandbox' && (
                    <a
                      href="/api/payments/cinetpay/aurore-auth-test"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      Tester l’authentification
                    </a>
                  )}

                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  Enregistrer CinetPay
                </button>

              </div>

            </div>

          </form>

          {/* ACTIVER / DESACTIVER */}

          {cinetPay.configured && (
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-5">

              {cinetPay.active
                ? (
                  <form
                    action={
                      disablePlatformCinetPay
                    }
                  >
                    <button
                      type="submit"
                      className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-50"
                    >
                      Désactiver CinetPay
                    </button>
                  </form>
                )
                : (
                  <form
                    action={
                      enablePlatformCinetPay
                    }
                  >
                    <button
                      type="submit"
                      className="rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
                    >
                      Réactiver CinetPay
                    </button>
                  </form>
                )}

            </div>
          )}

        </section>

      </div>

    </main>
  )
}

// ============================================================
// COMPONENTS
// ============================================================

function Header({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-b border-slate-100 px-6 py-5">

      <h2 className="text-lg font-black text-slate-950">
        {title}
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>

    </div>
  )
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  placeholder,
  required = false,
  maxLength,
}: {
  label: string
  name: string
  defaultValue: string

  type?: string
  placeholder?: string
  required?: boolean
  maxLength?: number
}) {
  return (
    <div>

      <label
        htmlFor={
          name
        }
        className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>

      <input
        id={
          name
        }
        name={
          name
        }
        type={
          type
        }
        defaultValue={
          defaultValue
        }
        placeholder={
          placeholder
        }
        required={
          required
        }
        maxLength={
          maxLength
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
      />

    </div>
  )
}

function StatusCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-black text-slate-900">
        {value}
      </p>

    </div>
  )
}

function SuccessBox({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

      <p className="font-black text-emerald-900">
        {title}
      </p>

      <p className="mt-1 text-sm text-emerald-700">
        {message}
      </p>

    </div>
  )
}

function ErrorBox({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">

      <p className="font-black text-red-900">
        {title}
      </p>

      <p className="mt-1 text-sm text-red-700">
        {message}
      </p>

    </div>
  )
}

// ============================================================
// HELPERS
// ============================================================

function formatDateTime(
  value:
    | string
    | null
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        'long',

      year:
        'numeric',

      hour:
        '2-digit',

      minute:
        '2-digit',
    }
  ).format(
    date
  )
}

function formatChannels(
  value:
    | string
    | null
    | undefined
) {
  switch (
    value
      ?.trim()
      .toUpperCase()
  ) {
    case 'ALL':
      return 'Tous'

    case 'CREDIT_CARD':
      return 'Carte bancaire'

    case 'WALLET':
      return 'Wallet'

    case 'MOBILE_MONEY':
    default:
      return 'Mobile Money'
  }
}

function cinetPayErrorMessage(
  code: string
) {
  switch (code) {
    case 'environment':
      return 'L’environnement CinetPay sélectionné est invalide.'

    case 'channels':
      return 'Le canal CinetPay sélectionné est invalide.'

    case 'credentials':
      return 'Les identifiants CinetPay sont invalides.'

    case 'credentials_required':
      return 'L’API KEY et l’API PASSWORD sont obligatoires lors de la première configuration.'

    case 'api_key_required':
      return 'L’API KEY CinetPay est manquante.'

    case 'api_password_required':
      return 'L’API PASSWORD CinetPay est manquant.'

    case 'read':
      return 'Impossible de lire la configuration CinetPay.'

    case 'disable':
      return 'Impossible de désactiver CinetPay.'

    case 'enable':
      return 'Impossible de réactiver CinetPay.'

    case 'checkout_credentials_required':
      return 'L’API Key Checkout, le Site ID et la Secret Key sont obligatoires pour activer Visa / Mastercard.'

    case 'save':
    default:
      return 'Impossible d’enregistrer la configuration CinetPay.'
  }
}
