import Link from 'next/link'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

type PageProps = {
  searchParams: Promise<{
    q?: string
    organization?: string
    module?: string
    action?: string
    from?: string
    to?: string
    page?: string
  }>
}

type AuditRow = {
  audit_id: string
  organization_id: string | null
  organization_name: string | null
  actor_user_id: string | null
  actor_name: string | null
  actor_email: string | null
  actor_role: string | null
  actor_type: string | null
  module: string
  action: string
  entity_type: string
  entity_id: string | null
  source_table: string
  changed_fields: string[] | null
  before_data: unknown
  after_data: unknown
  created_at: string
  total_count: number | string | null
}

type OrganizationOption = {
  id: string
  name: string
  short_name: string | null
}

const PAGE_SIZE = 50

const MODULE_OPTIONS = [
  ['organisation', 'Organisation'],
  ['responsables', 'Responsables'],
  ['membres', 'Membres'],
  ['cotisations', 'Cotisations'],
  ['paiements', 'Paiements'],
  ['tresorerie', 'Trésorerie'],
  ['abonnements', 'Abonnements'],
  ['configuration_paiement', 'Configuration paiement'],
] as const

const ACTION_OPTIONS = [
  ['insert', 'Création'],
  ['update', 'Modification'],
  ['delete', 'Suppression'],
] as const

export default async function AdminActivityPage({
  searchParams,
}: PageProps) {
  const params = await searchParams

  const search = cleanText(params.q, 120)
  const organizationFilter = isUuid(params.organization)
    ? params.organization!
    : null
  const moduleFilter = normalizeModule(params.module)
  const actionFilter = normalizeAction(params.action)
  const fromDate = normalizeDate(params.from)
  const toDate = normalizeDate(params.to)
  const page = positiveInteger(params.page)
  const offset = (page - 1) * PAGE_SIZE

  const {
    supabase,
  } = await requirePlatformSuperAdmin()

  const [
    auditResult,
    organizationsResult,
  ] = await Promise.all([
    supabase.rpc(
      'list_platform_audit_logs',
      {
        search_text: search || null,
        organization_id_filter: organizationFilter,
        module_filter: moduleFilter,
        action_filter: actionFilter,
        actor_user_id_filter: null,
        from_date: fromDate,
        to_date: toDate,
        limit_count: PAGE_SIZE,
        offset_count: offset,
      }
    ),

    supabase.rpc(
      'list_platform_organizations',
      {
        search_text: null,
        limit_count: 200,
        offset_count: 0,
      }
    ),
  ])

  if (auditResult.error) {
    console.error(
      'EWUKAI - audit journal:',
      auditResult.error
    )
  }

  if (organizationsResult.error) {
    console.error(
      'EWUKAI - audit organization filter:',
      organizationsResult.error
    )
  }

  const rows = (
    Array.isArray(auditResult.data)
      ? auditResult.data
      : []
  ) as AuditRow[]

  const organizations = normalizeOrganizations(
    organizationsResult.data
  )

  const total = rows[0]
    ? numberValue(rows[0].total_count)
    : 0

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  )

  const userActions = rows.filter(
    row => row.actor_type !== 'system'
  ).length

  const systemActions = rows.filter(
    row => row.actor_type === 'system'
  ).length

  const organizationsVisible = new Set(
    rows
      .map(row => row.organization_id)
      .filter(Boolean)
  ).size

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Administration EWUKAI
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Journal d&apos;audit
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                Historique de contrôle des créations, modifications et suppressions effectuées dans les organisations. Les valeurs avant et après modification sont conservées et les secrets sont masqués.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={buildReportUrl(params)}
                className="inline-flex w-fit items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
              >
                Rapport PDF
              </Link>

              <Link
                href="/admin/dashboard"
                className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                ← Tableau de bord
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
        {auditResult.error && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">
            Le journal d&apos;audit n&apos;est pas encore disponible. Vérifie que la migration Supabase du journal a bien été exécutée.
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Événements trouvés"
            value={formatNumber(total)}
            note="Selon les filtres appliqués"
          />
          <StatCard
            label="Actions utilisateurs"
            value={formatNumber(userActions)}
            note="Sur cette page"
          />
          <StatCard
            label="Actions système"
            value={formatNumber(systemActions)}
            note="Automatisations EWUKAI"
          />
          <StatCard
            label="Organisations visibles"
            value={formatNumber(organizationsVisible)}
            note="Sur cette page"
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <form
            action="/admin/activity"
            method="get"
            className="grid gap-4 lg:grid-cols-4"
          >
            <div className="lg:col-span-2">
              <label
                htmlFor="q"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Rechercher
              </label>
              <input
                id="q"
                name="q"
                defaultValue={search}
                placeholder="Organisation, responsable, table, identifiant..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="organization"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Organisation
              </label>
              <select
                id="organization"
                name="organization"
                defaultValue={organizationFilter ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500"
              >
                <option value="">Toutes</option>
                {organizations.map(organization => (
                  <option
                    key={organization.id}
                    value={organization.id}
                  >
                    {organization.short_name || organization.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="module"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Module
              </label>
              <select
                id="module"
                name="module"
                defaultValue={moduleFilter ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500"
              >
                <option value="">Tous</option>
                {MODULE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="action"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Action
              </label>
              <select
                id="action"
                name="action"
                defaultValue={actionFilter ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500"
              >
                <option value="">Toutes</option>
                {ACTION_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="from"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Du
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={fromDate ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="to"
                className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
              >
                Au
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={toDate ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500"
              />
            </div>

            <div className="flex items-end gap-2 lg:col-span-2">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
              >
                Filtrer
              </button>

              <Link
                href="/admin/activity"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Réinitialiser
              </Link>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Historique des modifications
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {formatNumber(total)} événement(s) correspondant aux filtres.
                </p>
              </div>
              <p className="text-xs font-bold text-slate-400">
                Page {page} / {totalPages}
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-base font-black text-slate-800">
                Aucun événement trouvé
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Les nouvelles opérations apparaîtront ici après activation de la migration d&apos;audit.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map(row => (
                <div key={row.audit_id}>
                  <AuditCard
                    row={row}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3">
            {page > 1 ? (
              <Link
                href={buildPageUrl(params, page - 1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm"
              >
                ← Précédent
              </Link>
            ) : (
              <span />
            )}

            {page < totalPages ? (
              <Link
                href={buildPageUrl(params, page + 1)}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-sm"
              >
                Suivant →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  )
}

function AuditCard({
  row,
}: {
  row: AuditRow
}) {
  const action = actionMeta(row.action)
  const moduleLabel = humanizeModule(row.module)
  const fields = Array.isArray(row.changed_fields)
    ? row.changed_fields.filter(Boolean)
    : []

  return (
    <article className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={action.className}>
              {action.label}
            </span>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
              {moduleLabel}
            </span>

            {row.actor_type === 'system' && (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">
                Système
              </span>
            )}
          </div>

          <h3 className="mt-3 text-base font-black text-slate-950">
            {entityLabel(row.entity_type)}
            {row.entity_id
              ? ` · ${shortId(row.entity_id)}`
              : ''}
          </h3>

          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Info
              label="Organisation"
              value={row.organization_name || 'Plateforme EWUKAI'}
            />
            <Info
              label="Auteur"
              value={row.actor_name || row.actor_email || 'Système EWUKAI'}
            />
            <Info
              label="Rôle"
              value={roleLabel(row.actor_role, row.actor_type)}
            />
            <Info
              label="Date et heure"
              value={formatDateTime(row.created_at)}
            />
          </div>

          {fields.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Champs modifiés
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {fields.map(field => (
                  <span
                    key={field}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600"
                  >
                    {fieldLabel(field)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 text-xs font-semibold text-slate-400">
          {row.source_table}
        </div>
      </div>

      {(row.before_data != null || row.after_data != null) && (
        <div className="mt-5 space-y-3">
          <ChangeSummary row={row} />

          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-700">
              Voir toutes les données avant / après
            </summary>

            <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-2">
              <JsonPanel
                title="Avant"
                value={row.before_data}
                empty="Aucune valeur antérieure"
              />
              <JsonPanel
                title="Après"
                value={row.after_data}
                empty="Aucune valeur nouvelle"
              />
            </div>
          </details>
        </div>
      )}
    </article>
  )
}

function ChangeSummary({
  row,
}: {
  row: AuditRow
}) {
  const before = asRecord(row.before_data)
  const after = asRecord(row.after_data)
  const changes = getMeaningfulChanges(row)

  if (row.action === 'insert') {
    const createdValues = getDisplayEntries(after, row.source_table)

    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
            Valeurs créées
          </p>
          <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-black uppercase text-white">
            Nouveau
          </span>
        </div>

        {createdValues.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-emerald-900/70">
            Aucune valeur métier à afficher.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {createdValues.slice(0, 9).map(([field, value]) => (
              <div
                key={field}
                className="rounded-xl border border-emerald-100 bg-white px-3 py-2"
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  {fieldLabel(field)}
                </p>
                <p className="mt-1 break-words text-sm font-black text-slate-800">
                  {formatAuditValue(field, value, row.source_table)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  if (row.action === 'delete') {
    const removedValues = getDisplayEntries(before, row.source_table)

    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-wide text-rose-800">
            Dernières valeurs connues
          </p>
          <span className="rounded-full bg-rose-700 px-2.5 py-1 text-[10px] font-black uppercase text-white">
            Supprimé
          </span>
        </div>

        {removedValues.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-rose-900/70">
            Aucune valeur métier à afficher.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {removedValues.slice(0, 9).map(([field, value]) => (
              <div
                key={field}
                className="rounded-xl border border-rose-100 bg-white px-3 py-2"
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  {fieldLabel(field)}
                </p>
                <p className="mt-1 break-words text-sm font-black text-slate-800">
                  {formatAuditValue(field, value, row.source_table)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  if (changes.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          Modification détectée
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Aucun changement métier lisible n&apos;a été isolé. Les données complètes restent disponibles ci-dessous.
        </p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-amber-800">
            Modifications détectées
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-700">
            {changes.length} champ(s) modifié(s)
          </p>
        </div>
        <span className="rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-black uppercase text-white">
          Modifié
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Champ</th>
              <th className="px-4 py-3">Avant</th>
              <th className="px-4 py-3">Après</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {changes.map(change => (
              <tr key={change.field}>
                <td className="px-4 py-3 font-black text-slate-800">
                  {fieldLabel(change.field)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-500">
                  {formatAuditValue(
                    change.field,
                    change.before,
                    row.source_table
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="inline-flex max-w-full items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 font-black text-amber-900">
                    <span className="break-words">
                      {formatAuditValue(
                        change.field,
                        change.after,
                        row.source_table
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-amber-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                      Modifié
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type AuditChange = {
  field: string
  before: unknown
  after: unknown
}

const TECHNICAL_FIELDS = new Set([
  'id',
  'organization_id',
  'user_id',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
])

function getMeaningfulChanges(row: AuditRow): AuditChange[] {
  const before = asRecord(row.before_data)
  const after = asRecord(row.after_data)

  const declaredFields = Array.isArray(row.changed_fields)
    ? row.changed_fields.filter(Boolean)
    : []

  const computedFields = Array.from(
    new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])
  ).filter(field => !sameAuditValue(before[field], after[field]))

  const baseFields = declaredFields.length > 0
    ? declaredFields
    : computedFields

  const meaningful = baseFields.filter(
    field => !TECHNICAL_FIELDS.has(field)
  )

  const fields = meaningful.length > 0
    ? meaningful
    : baseFields

  return fields
    .filter(field => !sameAuditValue(before[field], after[field]))
    .map(field => ({
      field,
      before: before[field],
      after: after[field],
    }))
}

function getDisplayEntries(
  value: Record<string, unknown>,
  sourceTable: string
) {
  const entries = Object.entries(value)
    .filter(([field]) => !TECHNICAL_FIELDS.has(field))
    .filter(([, fieldValue]) => fieldValue != null && fieldValue !== '')

  return entries
    .sort(([left], [right]) =>
      displayPriority(left, sourceTable) -
      displayPriority(right, sourceTable)
    )
}

function displayPriority(field: string, sourceTable: string) {
  const priorities: Record<string, number> = {
    member_number: 1,
    first_name: 2,
    last_name: 3,
    name: 4,
    status: 5,
    amount: 6,
    amount_due: 6,
    amount_paid: 7,
    total_xof: 8,
    payment_method: 9,
    receipt_number: 10,
    invoice_number: 10,
    description: 11,
  }

  if (sourceTable === 'ledger_entries' && field === 'direction') {
    return 5
  }

  return priorities[field] ?? 100
}

function asRecord(value: unknown): Record<string, unknown> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>
  }

  return {}
}

function sameAuditValue(left: unknown, right: unknown) {
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return String(left) === String(right)
  }
}

function formatAuditValue(
  field: string,
  value: unknown,
  sourceTable: string
) {
  if (value == null || value === '') {
    return '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non'
  }

  if (field === 'status' && typeof value === 'string') {
    return statusLabel(value, sourceTable)
  }

  if (field === 'direction' && typeof value === 'string') {
    return value === 'credit'
      ? 'Crédit'
      : value === 'debit'
        ? 'Débit'
        : value
  }

  if (field === 'payment_method' && typeof value === 'string') {
    return paymentMethodLabel(value)
  }

  if (looksLikeMoneyField(field)) {
    const amount = Number(value)

    if (Number.isFinite(amount)) {
      return `${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`
    }
  }

  if (looksLikeDateField(field) && typeof value === 'string') {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: field.endsWith('_at') ? 'short' : undefined,
      }).format(date)
    }
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

function looksLikeMoneyField(field: string) {
  return (
    field.includes('amount') ||
    field.includes('price') ||
    field.includes('total_xof') ||
    field.endsWith('_xof')
  )
}

function looksLikeDateField(field: string) {
  return (
    field.endsWith('_at') ||
    field.endsWith('_date') ||
    field === 'due_date' ||
    field === 'period_start' ||
    field === 'period_end'
  )
}

function statusLabel(value: string, sourceTable: string) {
  const normalized = value.trim().toLowerCase()

  if (normalized === 'open') {
    return sourceTable === 'subscription_invoices'
      ? 'Ouverte'
      : 'En attente'
  }

  const labels: Record<string, string> = {
    active: 'Actif',
    inactive: 'Inactif',
    pending: 'En attente',
    pending_payment: 'En attente de paiement',
    confirmed: 'Confirmé',
    paid: 'Payé',
    partial: 'Partiel',
    failed: 'Échec',
    cancelled: 'Annulé',
    canceled: 'Annulé',
    expired: 'Expiré',
    anomaly: 'Anomalie',
    draft: 'Brouillon',
    trialing: 'Essai',
    past_due: 'En retard',
    replaced: 'Remplacé',
    suspended: 'Suspendu',
  }

  return labels[normalized] || value
}

function paymentMethodLabel(value: string) {
  const normalized = value.trim().toLowerCase()
  const labels: Record<string, string> = {
    cash: 'Espèces',
    wave: 'Wave',
    orange_money: 'Orange Money',
    mtn_momo: 'MTN Mobile Money',
    moov_money: 'Moov Money',
    bank_transfer: 'Virement',
    transfer: 'Virement',
    other: 'Autre',
  }

  return labels[normalized] || value
}

function JsonPanel({
  title,
  value,
  empty,
}: {
  title: string
  value: unknown
  empty: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {title}
      </p>

      {value == null ? (
        <p className="mt-3 text-sm font-semibold text-slate-400">
          {empty}
        </p>
      ) : (
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
          {prettyJson(value)}
        </pre>
      )}
    </div>
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
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words font-bold text-slate-700">
        {value}
      </p>
    </div>
  )
}

function StatCard({
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
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
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

function actionMeta(action: string) {
  switch (action) {
    case 'insert':
      return {
        label: 'Création',
        className: 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700',
      }
    case 'delete':
      return {
        label: 'Suppression',
        className: 'rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700',
      }
    default:
      return {
        label: 'Modification',
        className: 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700',
      }
  }
}

function humanizeModule(module: string) {
  const found = MODULE_OPTIONS.find(
    ([value]) => value === module
  )

  if (found) {
    return found[1]
  }

  return module
    .replaceAll('_', ' ')
    .replace(/^./, value => value.toUpperCase())
}

function entityLabel(value: string) {
  const labels: Record<string, string> = {
    organizations: 'Organisation',
    organization_public_profiles: 'Profil public',
    organization_users: 'Responsable / accès',
    members: 'Membre',
    membership_applications: "Demande d'adhésion",
    member_access_invitations: "Invitation d'accès",
    contribution_types: 'Type de cotisation',
    contribution_calls: 'Appel de cotisation',
    contribution_obligations: 'Échéance de cotisation',
    payments: 'Paiement',
    payment_allocations: 'Affectation de paiement',
    member_payment_attempts: 'Tentative de paiement membre',
    treasury_accounts: 'Compte de trésorerie',
    ledger_entries: 'Écriture de trésorerie',
    expenses: 'Dépense',
    cash_expenses: 'Dépense',
    organization_subscriptions: 'Abonnement',
    subscription_invoices: 'Facture abonnement',
    subscription_payment_attempts: 'Tentative paiement abonnement',
  }

  return labels[value] || value.replaceAll('_', ' ')
}

function fieldLabel(value: string) {
  const labels: Record<string, string> = {
    status: 'Statut',
    role: 'Rôle',
    is_active: 'Actif',
    first_name: 'Prénom',
    last_name: 'Nom',
    phone: 'Téléphone',
    email: 'E-mail',
    amount: 'Montant',
    amount_due: 'Montant dû',
    amount_paid: 'Montant payé',
    total_xof: 'Montant total',
    amount_paid_xof: 'Montant payé',
    expected_amount_xof: 'Montant attendu',
    member_number: 'Matricule membre',
    receipt_number: 'N° reçu',
    invoice_number: 'N° facture',
    direction: 'Sens',
    category: 'Catégorie',
    payment_reference: 'Référence paiement',
    provider_transaction_ref: 'Référence transaction',
    due_date: 'Échéance',
    paid_at: 'Date de paiement',
    current_period_start: 'Début de période',
    current_period_end: 'Fin de période',
    payment_method: 'Mode de paiement',
    plan_id: 'Formule',
    public_page_enabled: 'Page publique',
    online_membership_enabled: 'Adhésion en ligne',
    primary_color: 'Couleur principale',
    secondary_color: 'Couleur secondaire',
    logo_path: 'Logo',
    name: 'Nom',
    description: 'Description',
  }

  return labels[value] || value.replaceAll('_', ' ')
}

function roleLabel(
  role: string | null,
  actorType: string | null
) {
  if (actorType === 'system') {
    return 'Système EWUKAI'
  }

  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    owner: 'Propriétaire',
    president: 'Président',
    treasurer: 'Trésorier',
    secretary: 'Secrétaire',
    auditor: 'Contrôleur',
    member: 'Membre',
    system: 'Système EWUKAI',
  }

  return role
    ? labels[role] || role
    : 'Utilisateur'
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }
  ).format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function numberValue(value: number | string | null | undefined) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function shortId(value: string) {
  return value.length > 18
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value
}

function cleanText(
  value: string | undefined,
  maxLength: number
) {
  return (value ?? '')
    .trim()
    .slice(0, maxLength)
}

function isUuid(value: string | undefined): value is string {
  if (!value) {
    return false
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeDate(value: string | undefined) {
  const normalized = (value ?? '').trim()

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : null
}

function normalizeModule(value: string | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()

  return MODULE_OPTIONS.some(([code]) => code === normalized)
    ? normalized
    : null
}

function normalizeAction(value: string | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()

  return ACTION_OPTIONS.some(([code]) => code === normalized)
    ? normalized
    : null
}

function positiveInteger(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return parsed
}

function normalizeOrganizations(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as OrganizationOption[]
  }

  return value
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const row = item as Record<string, unknown>
      const id = String(
        row.organization_id ?? row.id ?? ''
      )
      const name = String(
        row.organization_name ?? row.name ?? ''
      )
      const shortName = row.organization_short_name ?? row.short_name

      if (!isUuid(id) || !name) {
        return null
      }

      return {
        id,
        name,
        short_name:
          typeof shortName === 'string'
            ? shortName
            : null,
      } satisfies OrganizationOption
    })
    .filter(
      (item): item is OrganizationOption => item !== null
    )
}

function buildReportUrl(
  params: PageProps['searchParams'] extends Promise<infer P> ? P : never
) {
  const query = new URLSearchParams()

  const values = {
    q: params.q,
    organization: params.organization,
    module: params.module,
    action: params.action,
    from: params.from,
    to: params.to,
  }

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      query.set(key, value)
    }
  }

  const suffix = query.toString()

  return suffix
    ? `/admin/activity/report?${suffix}`
    : '/admin/activity/report'
}

function buildPageUrl(
  params: PageProps['searchParams'] extends Promise<infer P> ? P : never,
  page: number
) {
  const query = new URLSearchParams()

  const values = {
    q: params.q,
    organization: params.organization,
    module: params.module,
    action: params.action,
    from: params.from,
    to: params.to,
  }

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      query.set(key, value)
    }
  }

  if (page > 1) {
    query.set('page', String(page))
  }

  const suffix = query.toString()

  return suffix
    ? `/admin/activity?${suffix}`
    : '/admin/activity'
}
