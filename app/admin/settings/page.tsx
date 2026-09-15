import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

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

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_platform_settings'
    )

  if (
    error
  ) {
    console.error(
      'EWUKAI - platform settings:',
      error
    )

    throw new Error(
      'Impossible de charger les paramètres de la plateforme.'
    )
  }

  const settings =
    data as PlatformSettings

  return (
    <main className="min-h-screen bg-slate-50">

      {/* HERO */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Administration EWUKAI
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Paramètres plateforme
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Gérez les informations générales et
            les valeurs par défaut utilisées par
            EWUKAI.
          </p>

        </div>

      </section>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">

        {/* SUCCES */}

        {query.saved ===
          '1' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <p className="font-black text-emerald-900">
              Paramètres enregistrés
            </p>

            <p className="mt-1 text-sm text-emerald-700">
              La configuration globale EWUKAI
              a été mise à jour.
            </p>

          </div>
        )}

        {/* ERREUR */}

        {query.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Modification impossible
            </p>

            <p className="mt-1 text-sm text-red-700">
              Vérifiez les informations saisies
              puis réessayez.
            </p>

          </div>
        )}

        {/* FORMULAIRE */}

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
                placeholder="support@africlub..."
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
              description="Valeurs par défaut de la plateforme."
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

          {/* INFO */}

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

            <p className="font-black text-blue-950">
              Configuration non sensible
            </p>

            <p className="mt-1 text-sm leading-6 text-blue-800">
              Les mots de passe, clés Supabase,
              clés Mobile Money et autres secrets
              ne doivent jamais être enregistrés
              dans cette section.
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
        {
          title
        }
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {
          description
        }
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
        {
          label
        }
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

// ============================================================
// HELPERS
// ============================================================

function formatDateTime(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
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