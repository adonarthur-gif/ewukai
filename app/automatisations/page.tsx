import Link from 'next/link'

import {
  redirect,
} from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  requireOrganizationFeatureAccess,
} from '@/lib/subscriptions/feature-access'

import {
  runAutomationNow,
  saveAutomationSettings,
} from './actions'

type AutomationPageProps = {
  searchParams: Promise<{
    saved?: string
    run?: string
    generated?: string
    error?: string
  }>
}

type AutomationSettings = {
  organization_id?: string | null
  contribution_reminders_enabled?: boolean | null
  remind_before_days?: number[] | null
  remind_on_due_date?: boolean | null
  remind_after_days?: number[] | null
  last_run_at?: string | null
  last_run_date?: string | null
  last_generated_count?: number | string | null
}

type ReminderRow = {
  reminder_id: string
  member_id: string
  member_number: string | null
  member_name: string | null
  obligation_id: string
  reminder_type: string
  due_date: string
  offset_days: number | string
  scheduled_for: string
  amount_remaining: number | string
  status: string
  title: string
  message: string
  generated_at: string
  resolved_at: string | null
}

const BEFORE_OPTIONS = [
  1,
  3,
  7,
  14,
]

const AFTER_OPTIONS = [
  1,
  3,
  7,
  14,
  30,
]

const MANAGER_ROLES = [
  'owner',
  'president',
  'treasurer',
]

export default async function AutomationsPage({
  searchParams,
}: AutomationPageProps) {
  const query =
    await searchParams

  const context =
    await requireCurrentOrganization()

  const {
    supabase,
    organizationId,
    role,
  } = context

  if (
    role ===
    'member'
  ) {
    redirect(
      '/my-space'
    )
  }

  await requireOrganizationFeatureAccess(
    context,
    'automation'
  )

  const {
    data: organization,
    error: organizationError,
  } =
    await supabase
      .from(
        'organizations'
      )
      .select(`
        name,
        short_name
      `)
      .eq(
        'id',
        organizationId
      )
      .maybeSingle()

  if (organizationError) {
    console.error(
      'EWUKAI - AUTOMATION ORGANIZATION:',
      organizationError
    )
  }

  const [
    settingsResult,
    remindersResult,
  ] =
    await Promise.all([
      supabase.rpc(
        'get_organization_automation_settings',
        {
          target_organization_id:
            organizationId,
        }
      ),

      supabase.rpc(
        'list_organization_automation_reminders',
        {
          target_organization_id:
            organizationId,

          target_limit:
            100,
        }
      ),
    ])

  if (
    settingsResult.error
  ) {
    console.error(
      'EWUKAI - AUTOMATION SETTINGS PAGE:',
      settingsResult.error
    )

    throw new Error(
      "Impossible de charger la configuration d'automatisation."
    )
  }

  if (
    remindersResult.error
  ) {
    console.error(
      'EWUKAI - AUTOMATION HISTORY PAGE:',
      remindersResult.error
    )

    throw new Error(
      "Impossible de charger l'historique des automatisations."
    )
  }

  const settings =
    (
      settingsResult.data &&
      typeof settingsResult.data ===
        'object'
        ? settingsResult.data
        : {}
    ) as AutomationSettings

  const reminders =
    (
      remindersResult.data ??
      []
    ) as ReminderRow[]

  const enabled =
    Boolean(
      settings.contribution_reminders_enabled
    )

  const remindOnDueDate =
    settings.remind_on_due_date !==
    false

  const beforeDays =
    new Set(
      settings.remind_before_days ??
      [3]
    )

  const afterDays =
    new Set(
      settings.remind_after_days ??
      [1, 3, 7]
    )

  const canManage =
    MANAGER_ROLES.includes(
      role
    )

  const organizationLabel =
    organization?.short_name ||
    organization?.name ||
    'Votre organisation'

  const generatedNow =
    Math.max(
      0,
      Number(
        query.generated ??
        0
      ) || 0
    )

  const generatedOpen =
    reminders.filter(
      (item) =>
        item.status ===
        'generated'
    ).length

  const resolved =
    reminders.filter(
      (item) =>
        item.status ===
        'resolved'
    ).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              {organizationLabel}
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Automatisations
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              PrÃ©parez automatiquement les relances liÃ©es aux cotisations
              avant l&apos;Ã©chÃ©ance, le jour prÃ©vu et aprÃ¨s retard.
            </p>
          </div>

          <Link
            href="/parametres/abonnement"
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Voir ma formule
          </Link>
        </div>

        {query.saved === '1' && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-black">
              Configuration enregistrÃ©e.
            </p>
            <p className="mt-1 leading-6 text-emerald-800">
              Les prochaines exÃ©cutions utiliseront ces rÃ¨gles.
            </p>
          </div>
        )}

        {query.run === '1' && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-black">
              Automatisation exÃ©cutÃ©e.
            </p>
            <p className="mt-1 leading-6 text-blue-800">
              {generatedNow} nouvelle
              {generatedNow !== 1 ? 's' : ''} relance
              {generatedNow !== 1 ? 's' : ''} gÃ©nÃ©rÃ©e
              {generatedNow !== 1 ? 's' : ''} aujourd&apos;hui.
            </p>
          </div>
        )}

        {query.error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-black">
              OpÃ©ration impossible
            </p>
            <p className="mt-1 leading-6 text-red-800">
              {query.error}
            </p>
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Automatisation"
            value={
              enabled
                ? 'Active'
                : 'Inactive'
            }
            note="Relances de cotisations"
          />

          <MetricCard
            label="Relances ouvertes"
            value={String(generatedOpen)}
            note="Encore liÃ©es Ã  un solde dÃ»"
          />

          <MetricCard
            label="Relances rÃ©solues"
            value={String(resolved)}
            note="Dette soldÃ©e ou devenue non applicable"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  Relances automatiques
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  RÃ¨gles de rappel
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cette fonctionnalitÃ© est incluse dans les formules
                  Pro et Entreprise.
                </p>
              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                Pro
              </span>
            </div>

            <form
              action={saveAutomationSettings}
              className="mt-6 space-y-6"
            >
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={enabled}
                  disabled={!canManage}
                  className="mt-1 h-4 w-4"
                />

                <span>
                  <span className="block font-black text-slate-950">
                    Activer les relances de cotisations
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    EWUKAI gÃ©nÃ©rera les rappels correspondant aux jours
                    sÃ©lectionnÃ©s lorsque le cycle automatique sera exÃ©cutÃ©.
                  </span>
                </span>
              </label>

              <div>
                <p className="text-sm font-black text-slate-950">
                  Avant l&apos;Ã©chÃ©ance
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BEFORE_OPTIONS.map(
                    (day) => (
                      <DayOption
                        key={day}
                        name="beforeDays"
                        day={day}
                        checked={
                          beforeDays.has(
                            day
                          )
                        }
                        disabled={!canManage}
                      />
                    )
                  )}
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  name="remindOnDueDate"
                  defaultChecked={remindOnDueDate}
                  disabled={!canManage}
                  className="h-4 w-4"
                />

                <span className="font-bold text-slate-800">
                  GÃ©nÃ©rer Ã©galement un rappel le jour de l&apos;Ã©chÃ©ance
                </span>
              </label>

              <div>
                <p className="text-sm font-black text-slate-950">
                  AprÃ¨s l&apos;Ã©chÃ©ance
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {AFTER_OPTIONS.map(
                    (day) => (
                      <DayOption
                        key={day}
                        name="afterDays"
                        day={day}
                        checked={
                          afterDays.has(
                            day
                          )
                        }
                        disabled={!canManage}
                      />
                    )
                  )}
                </div>
              </div>

              {canManage ? (
                <button
                  type="submit"
                  className="inline-flex w-full justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Enregistrer les rÃ¨gles
                </button>
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-500">
                  Votre rÃ´le permet de consulter cette configuration,
                  mais pas de la modifier.
                </p>
              )}
            </form>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <p className="text-sm font-black text-slate-950">
                ExÃ©cution de contrÃ´le
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Utilisez ce bouton pour exÃ©cuter immÃ©diatement le moteur
                sur les Ã©chÃ©ances du jour. L&apos;idempotence empÃªche de crÃ©er
                deux fois la mÃªme relance.
              </p>

              {canManage && (
                <form
                  action={runAutomationNow}
                  className="mt-4"
                >
                  <button
                    type="submit"
                    className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 transition hover:bg-slate-50"
                  >
                    ExÃ©cuter maintenant
                  </button>
                </form>
              )}

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
                <p className="font-black">
                  Canal V1 : gÃ©nÃ©ration interne
                </p>

                <p className="mt-1 text-blue-800">
                  Cette Ã©tape crÃ©e et historise les relances dans EWUKAI.
                  L&apos;affichage dans l&apos;espace membre puis les canaux
                  e-mail, SMS ou WhatsApp seront raccordÃ©s sÃ©parÃ©ment.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Historique
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                DerniÃ¨res relances gÃ©nÃ©rÃ©es
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Jusqu&apos;aux 100 Ã©vÃ©nements les plus rÃ©cents.
              </p>
            </div>

            {reminders.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-black text-slate-800">
                  Aucune relance gÃ©nÃ©rÃ©e
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Activez les rÃ¨gles puis exÃ©cutez le moteur lorsqu&apos;une
                  Ã©chÃ©ance correspond Ã  vos critÃ¨res.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reminders.map(
                  (reminder) => (
                    <ReminderItem
                      key={
                        reminder.reminder_id
                      }
                      reminder={
                        reminder
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            DerniÃ¨re exÃ©cution
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Date"
              value={
                settings.last_run_date
                  ? formatDate(
                      settings.last_run_date
                    )
                  : 'Jamais'
              }
              note="Date mÃ©tier du dernier cycle"
            />

            <MetricCard
              label="Nouvelles relances"
              value={String(
                Number(
                  settings.last_generated_count ??
                  0
                ) || 0
              )}
              note="CrÃ©Ã©es au dernier cycle"
            />

            <MetricCard
              label="Horodatage"
              value={
                settings.last_run_at
                  ? formatDateTime(
                      settings.last_run_at
                    )
                  : 'Non disponible'
              }
              note="DerniÃ¨re exÃ©cution enregistrÃ©e"
            />
          </div>
        </section>
      </div>
    </main>
  )
}

function DayOption({
  name,
  day,
  checked,
  disabled,
}: {
  name: string
  day: number
  checked: boolean
  disabled: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700">
      <input
        type="checkbox"
        name={name}
        value={day}
        defaultChecked={checked}
        disabled={disabled}
        className="h-4 w-4"
      />

      <span>
        J{day}
      </span>
    </label>
  )
}

function ReminderItem({
  reminder,
}: {
  reminder: ReminderRow
}) {
  const amount =
    Math.max(
      0,
      Number(
        reminder.amount_remaining
      ) || 0
    )

  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-slate-950">
              {reminder.member_name ||
                reminder.member_number ||
                'Membre'}
            </p>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
              {formatReminderType(
                reminder.reminder_type
              )}
            </span>

            <span
              className={
                reminder.status ===
                'resolved'
                  ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700'
                  : 'rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700'
              }
            >
              {reminder.status ===
              'resolved'
                ? 'RÃ©solue'
                : 'Ouverte'}
            </span>
          </div>

          <p className="mt-2 text-sm font-bold text-slate-800">
            {reminder.title}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {reminder.message}
          </p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="font-black text-slate-950">
            {formatMoney(
              amount
            )}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            Ã‰chÃ©ance{' '}
            {formatDate(
              reminder.due_date
            )}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold text-slate-400">
        GÃ©nÃ©rÃ©e le{' '}
        {formatDateTime(
          reminder.generated_at
        )}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs font-semibold text-slate-500">
        {note}
      </p>
    </div>
  )
}

function formatReminderType(
  value: string
) {
  switch (value) {
    case 'before_due':
      return 'Avant Ã©chÃ©ance'

    case 'due_today':
      return 'Jour J'

    case 'overdue':
      return 'Retard'

    default:
      return value
  }
}

function formatMoney(
  value: number
) {
  return `${new Intl.NumberFormat(
    'fr-FR'
  ).format(value)} FCFA`
}

function formatDate(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00`
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  ).format(date)
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(date)
}