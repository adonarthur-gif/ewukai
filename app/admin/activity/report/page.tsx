import Image from 'next/image'
import Link from 'next/link'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

import {
  PrintAuditReportButton,
} from './print-button'

type PageProps = {
  searchParams: Promise<{
    q?: string
    organization?: string
    module?: string
    action?: string
    from?: string
    to?: string
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

type AuditChange = {
  field: string
  before: unknown
  after: unknown
}

const BATCH_SIZE = 200
const MAX_REPORT_ROWS = 5000

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

const TECHNICAL_FIELDS = new Set([
  'id',
  'organization_id',
  'user_id',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
])

export default async function AuditReportPage({
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

  const {
    supabase,
  } = await requirePlatformSuperAdmin()

  const organizationsResult = await supabase.rpc(
    'list_platform_organizations',
    {
      search_text: null,
      limit_count: 200,
      offset_count: 0,
    }
  )

  const organizations = normalizeOrganizations(
    organizationsResult.data
  )

  const rows: AuditRow[] = []
  let offset = 0
  let total = 0
  let loadError: string | null = null

  while (offset < MAX_REPORT_ROWS) {
    const result = await supabase.rpc(
      'list_platform_audit_logs',
      {
        search_text: search || null,
        organization_id_filter: organizationFilter,
        module_filter: moduleFilter,
        action_filter: actionFilter,
        actor_user_id_filter: null,
        from_date: fromDate,
        to_date: toDate,
        limit_count: BATCH_SIZE,
        offset_count: offset,
      }
    )

    if (result.error) {
      console.error(
        'EWUKAI - audit report:',
        result.error
      )
      loadError = result.error.message || 'Erreur de chargement'
      break
    }

    const batch = (
      Array.isArray(result.data)
        ? result.data
        : []
    ) as AuditRow[]

    if (batch.length === 0) {
      break
    }

    rows.push(...batch)

    if (total === 0) {
      total = numberValue(batch[0]?.total_count)
    }

    offset += batch.length

    if (
      batch.length < BATCH_SIZE ||
      rows.length >= total
    ) {
      break
    }
  }

  const truncated = total > rows.length
  const generatedAt = new Date()
  const reportReference = buildReportReference(generatedAt)

  const selectedOrganization = organizationFilter
    ? organizations.find(item => item.id === organizationFilter)
    : null

  const organizationLabel = selectedOrganization
    ? selectedOrganization.short_name || selectedOrganization.name
    : organizationFilter
      ? rows[0]?.organization_name || 'Organisation sélectionnée'
      : 'Toutes les organisations'

  const creationCount = rows.filter(row => row.action === 'insert').length
  const updateCount = rows.filter(row => row.action === 'update').length
  const deleteCount = rows.filter(row => row.action === 'delete').length
  const systemCount = rows.filter(row => row.actor_type === 'system').length
  const humanCount = rows.length - systemCount

  const moduleCounts = Array.from(
    rows.reduce((map, row) => {
      map.set(
        row.module,
        (map.get(row.module) ?? 0) + 1
      )
      return map
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1])

  return (
    <main className="audit-report-root min-h-screen bg-slate-100 print:bg-white">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          /*
           * La navigation Super Admin vit dans le layout parent /admin.
           * Le rapport utilise volontairement un <div> pour son propre
           * en-tête afin que tous les <header> applicatifs disparaissent
           * à l'impression sans toucher au rendu écran.
           */
          body header {
            display: none !important;
          }

          .no-print {
            display: none !important;
          }

          .audit-report-root {
            min-height: 0 !important;
            background: #fff !important;
          }

          .audit-report-shell {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .audit-report-card {
            overflow: visible !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .audit-report-document-header {
            padding: 0 0 4mm !important;
            border-bottom: 1px solid #cbd5e1 !important;
          }

          .audit-report-info-grid {
            gap: 2mm !important;
            padding: 3mm 0 !important;
          }

          .audit-report-search,
          .audit-report-warning {
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .audit-report-summary {
            padding: 3mm 0 !important;
          }

          .audit-report-summary-grid {
            gap: 2mm !important;
          }

          .audit-report-detail {
            break-before: auto !important;
            page-break-before: auto !important;
          }

          .audit-report-detail-heading {
            padding: 3mm 0 2mm !important;
          }

          .audit-report-detail-heading p {
            margin-top: 1mm !important;
          }

          .audit-report-table-wrap {
            display: block !important;
            overflow: visible !important;
            width: 100% !important;
          }

          .audit-report-table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 8.8pt !important;
            line-height: 1.28 !important;
          }

          .audit-report-table thead {
            display: table-header-group !important;
          }

          .audit-report-table tbody {
            display: table-row-group !important;
          }

          .audit-report-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .audit-report-table th,
          .audit-report-table td {
            padding: 1.8mm 2mm !important;
            vertical-align: top !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }

          .audit-report-table th {
            font-size: 8.4pt !important;
            line-height: 1.15 !important;
          }

          .audit-report-table td {
            border-bottom: 1px solid #e2e8f0 !important;
          }

          .audit-report-technical-id {
            font-size: 7pt !important;
          }

          .audit-report-change {
            margin-bottom: 1mm !important;
            padding: 1.2mm 1.5mm !important;
            border: 1px solid #d6d3d1 !important;
            background: #fff !important;
          }

          .audit-report-footer {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            padding: 3mm 0 0 !important;
            font-size: 7.5pt !important;
            line-height: 1.35 !important;
          }

          .print-card {
            box-shadow: none !important;
          }

          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={buildJournalUrl(params)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            ← Retour au journal
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="max-w-xl text-right text-xs font-semibold leading-5 text-slate-500">
              Pour un PDF totalement épuré dans Chrome, ouvre « Plus de paramètres » puis désactive « En-têtes et pieds de page » si cette option est cochée.
            </p>
            <PrintAuditReportButton />
          </div>
        </div>
      </div>

      <div className="audit-report-shell mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
        <section className="audit-report-card print-card overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:rounded-none">
          <div className="audit-report-document-header border-b border-slate-200 px-6 py-6 print:px-0 print:pb-4 print:pt-0">
            <div className="flex items-start justify-between gap-8">
              <div className="flex items-center gap-4">
                <Image
                  src="/branding/ewukai-logo-officiel.png"
                  alt="EWUKAI"
                  width={96}
                  height={84}
                  priority
                  className="h-auto w-20 object-contain"
                />

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                    EWUKAI
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    Rapport d&apos;audit
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Synthèse claire des opérations enregistrées dans le journal de contrôle.
                  </p>
                </div>
              </div>

              <div className="text-right text-xs text-slate-500">
                <p className="font-black text-slate-700">
                  Réf. {reportReference}
                </p>
                <p className="mt-1">
                  Généré le {formatDateTime(generatedAt.toISOString())}
                </p>
              </div>
            </div>
          </div>

          <section className="audit-report-info-grid grid gap-4 border-b border-slate-200 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4 print:px-0">
            <ReportInfo
              label="Organisation"
              value={organizationLabel}
            />
            <ReportInfo
              label="Période"
              value={formatPeriod(fromDate, toDate)}
            />
            <ReportInfo
              label="Module"
              value={moduleFilter ? humanizeModule(moduleFilter) : 'Tous les modules'}
            />
            <ReportInfo
              label="Action"
              value={actionFilter ? actionLabel(actionFilter) : 'Toutes les actions'}
            />
          </section>

          {search && (
            <section className="audit-report-search border-b border-slate-200 px-6 py-3 text-sm print:px-0">
              <span className="font-black text-slate-700">Recherche appliquée :</span>{' '}
              <span className="font-semibold text-slate-500">{search}</span>
            </section>
          )}

          {loadError && (
            <section className="audit-report-warning mx-6 mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 print:mx-0">
              Le rapport n&apos;a pas pu charger tous les événements : {loadError}
            </section>
          )}

          {truncated && (
            <section className="audit-report-warning mx-6 mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 print:mx-0">
              Le rapport contient les {formatNumber(rows.length)} premiers événements sur {formatNumber(total)}. Réduis la période pour obtenir un rapport complet.
            </section>
          )}

          <section className="audit-report-summary px-6 py-5 print:px-0">
            <h2 className="text-base font-black text-slate-950">
              Résumé exécutif
            </h2>

            <div className="audit-report-summary-grid mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 print:grid-cols-6">
              <SummaryCard label="Événements" value={rows.length} />
              <SummaryCard label="Créations" value={creationCount} />
              <SummaryCard label="Modifications" value={updateCount} />
              <SummaryCard label="Suppressions" value={deleteCount} />
              <SummaryCard label="Actions humaines" value={humanCount} />
              <SummaryCard label="Actions système" value={systemCount} />
            </div>

            {moduleCounts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {moduleCounts.map(([module, count]) => (
                  <span
                    key={module}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600"
                  >
                    {humanizeModule(module)} : {formatNumber(count)}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="audit-report-detail border-t border-slate-200">
            <div className="audit-report-detail-heading px-6 py-4 print:px-0">
              <h2 className="text-base font-black text-slate-950">
                Détail des opérations
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Une ligne correspond à un événement du journal EWUKAI. Les changements sont présentés en français lisible.
              </p>
            </div>

            {rows.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm font-semibold text-slate-500 print:px-0">
                Aucun événement ne correspond aux critères sélectionnés.
              </div>
            ) : (
              <div className="audit-report-table-wrap overflow-x-auto">
                <table className="audit-report-table w-full min-w-[1100px] border-collapse text-left text-xs">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '29%' }} />
                  </colgroup>
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="w-[13%] px-3 py-3">Date / heure</th>
                      <th className="w-[15%] px-3 py-3">Auteur / rôle</th>
                      <th className="w-[12%] px-3 py-3">Module</th>
                      <th className="w-[17%] px-3 py-3">Action / objet</th>
                      <th className="w-[18%] px-3 py-3">Organisation</th>
                      <th className="px-3 py-3">Modification / résultat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rows.map((row, index) => (
                      <AuditReportRow
                        key={row.audit_id}
                        row={row}
                        index={index + 1}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="audit-report-footer border-t border-slate-200 px-6 py-5 text-[11px] leading-5 text-slate-500 print:px-0">
            <p>
              Ce rapport est un extrait du Journal d&apos;audit EWUKAI. Le journal enregistré dans la base de données demeure la source de référence. Les données sensibles et secrets techniques ne sont pas exposés dans ce document.
            </p>
          </footer>
        </section>
      </div>
    </main>
  )
}

function AuditReportRow({
  row,
  index,
}: {
  row: AuditRow
  index: number
}) {
  const changes = getMeaningfulChanges(row)
  const before = asRecord(row.before_data)
  const after = asRecord(row.after_data)

  return (
    <tr className="avoid-break odd:bg-white even:bg-slate-50/70">
      <td className="border-r border-slate-100 px-3 py-3 align-top font-semibold text-slate-700">
        <p className="font-black text-slate-900">#{index}</p>
        <p className="mt-1">{formatDateTime(row.created_at)}</p>
      </td>

      <td className="border-r border-slate-100 px-3 py-3 align-top">
        <p className="font-black text-slate-900">
          {row.actor_name || row.actor_email || 'Système EWUKAI'}
        </p>
        <p className="mt-1 font-semibold text-slate-500">
          {roleLabel(row.actor_role, row.actor_type)}
        </p>
      </td>

      <td className="border-r border-slate-100 px-3 py-3 align-top font-black text-slate-700">
        {humanizeModule(row.module)}
      </td>

      <td className="border-r border-slate-100 px-3 py-3 align-top">
        <p className="font-black text-slate-900">
          {actionLabel(row.action)}
        </p>
        <p className="mt-1 font-semibold text-slate-600">
          {entityLabel(row.entity_type)}
        </p>
        {row.entity_id && (
          <p className="audit-report-technical-id mt-1 font-mono text-[9px] text-slate-400">
            {shortId(row.entity_id)}
          </p>
        )}
      </td>

      <td className="border-r border-slate-100 px-3 py-3 align-top font-semibold text-slate-700">
        {row.organization_name || 'Plateforme EWUKAI'}
      </td>

      <td className="px-3 py-3 align-top">
        {row.action === 'update' ? (
          changes.length > 0 ? (
            <div className="space-y-2">
              {changes.map(change => (
                <div
                  key={change.field}
                  className="audit-report-change rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2"
                >
                  <p className="font-black text-slate-800">
                    {fieldLabel(change.field)}
                  </p>
                  <p className="mt-1 text-slate-600">
                    <span className="font-semibold">Avant :</span>{' '}
                    {formatAuditValue(change.field, change.before, row.source_table)}
                  </p>
                  <p className="mt-0.5 text-slate-900">
                    <span className="font-black">Après :</span>{' '}
                    <span className="font-black text-amber-900">
                      {formatAuditValue(change.field, change.after, row.source_table)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <span className="font-semibold text-slate-400">
              Modification technique — consulter le journal source.
            </span>
          )
        ) : row.action === 'insert' ? (
          <DisplayValues
            label="Créé"
            values={getDisplayEntries(after, row.source_table)}
            sourceTable={row.source_table}
          />
        ) : (
          <DisplayValues
            label="Supprimé"
            values={getDisplayEntries(before, row.source_table)}
            sourceTable={row.source_table}
          />
        )}
      </td>
    </tr>
  )
}

function DisplayValues({
  label,
  values,
  sourceTable,
}: {
  label: string
  values: [string, unknown][]
  sourceTable: string
}) {
  if (values.length === 0) {
    return (
      <span className="font-semibold text-slate-400">
        {label} — aucune valeur métier à afficher.
      </span>
    )
  }

  return (
    <div>
      <p className="mb-1.5 font-black text-slate-800">{label}</p>
      <div className="space-y-1">
        {values.slice(0, 8).map(([field, value]) => (
          <p key={field} className="text-slate-700">
            <span className="font-black">{fieldLabel(field)} :</span>{' '}
            {formatAuditValue(field, value, sourceTable)}
          </p>
        ))}
      </div>
    </div>
  )
}

function ReportInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 print:bg-white">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-800">
        {value}
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 print:bg-white">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-900">
        {formatNumber(value)}
      </p>
    </div>
  )
}

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
): [string, unknown][] {
  return Object.entries(value)
    .filter(([field]) => !TECHNICAL_FIELDS.has(field))
    .filter(([, fieldValue]) => fieldValue != null && fieldValue !== '')
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
    direction: 5,
    amount: 6,
    amount_due: 6,
    amount_paid: 7,
    total_xof: 8,
    payment_method: 9,
    receipt_number: 10,
    invoice_number: 10,
    category: 11,
    description: 12,
  }

  if (sourceTable === 'ledger_entries' && field === 'direction') {
    return 4
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
      const includeTime = field.endsWith('_at')

      return new Intl.DateTimeFormat(
        'fr-FR',
        includeTime
          ? {
              dateStyle: 'medium',
              timeStyle: 'short',
            }
          : {
              dateStyle: 'medium',
            }
      ).format(date)
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

function actionLabel(action: string) {
  switch (action) {
    case 'insert':
      return 'Création'
    case 'delete':
      return 'Suppression'
    default:
      return 'Modification'
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

function formatPeriod(
  fromDate: string | null,
  toDate: string | null
) {
  if (!fromDate && !toDate) {
    return 'Toute la période disponible'
  }

  if (fromDate && toDate) {
    return `${formatDate(fromDate)} au ${formatDate(toDate)}`
  }

  if (fromDate) {
    return `Depuis le ${formatDate(fromDate)}`
  }

  return `Jusqu'au ${formatDate(toDate!)}`
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`)

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }
  ).format(date)
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

function buildReportReference(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')

  return [
    'AUD',
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('')
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

function buildJournalUrl(
  params: PageProps['searchParams'] extends Promise<infer P> ? P : never
) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value)
    }
  }

  const suffix = query.toString()

  return suffix
    ? `/admin/activity?${suffix}`
    : '/admin/activity'
}
