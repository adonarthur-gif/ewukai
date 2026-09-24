import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  buildFinancialReport,
  formatReportDate,
  money,
  resolveReportPeriod,
} from '@/lib/reports/financial-report'

// ============================================================
// EWUKAI
// EXPORT EXCEL - RAPPORT FINANCIER
//
// Format : SpreadsheetML 2003 (.xls XML)
// Avantage : aucune dependance externe necessaire et plusieurs feuilles.
// ============================================================

export const runtime =
  'nodejs'

export const dynamic =
  'force-dynamic'

export async function GET(
  request: Request
) {
  const url =
    new URL(
      request.url
    )

  const {
    startDate,
    endDate,
  } =
    resolveReportPeriod({
      start:
        url.searchParams
          .get(
            'start'
          ),

      end:
        url.searchParams
          .get(
            'end'
          ),
    })

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
      'auditor',
    ].includes(
      role
    )
  ) {
    return new Response(
      'Non autorisé',
      {
        status:
          403,
      }
    )
  }

  const report =
    await buildFinancialReport({
      supabase,
      organizationId,
      startDate,
      endDate,
    })

  const workbook =
    buildWorkbook(
      report
    )

  const organizationCode =
    sanitizeFilename(
      report.organization
        .shortName ||
      report.organization
        .name
    )

  const filename =
    `rapport-financier-${organizationCode}-${startDate}-${endDate}.xls`

  return new Response(
    '\ufeff' +
    workbook,
    {
      status:
        200,

      headers: {
        'Content-Type':
          'application/vnd.ms-excel; charset=utf-8',

        'Content-Disposition':
          `attachment; filename="${filename}"`,

        'Cache-Control':
          'private, no-store',
      },
    }
  )
}

// ============================================================
// WORKBOOK
// ============================================================

function buildWorkbook(
  report:
    Awaited<
      ReturnType<
        typeof buildFinancialReport
      >
    >
) {
  const sheets = [
    worksheet(
      'Synthèse',
      [
        row([
          textCell(
            report.organization.name
          ),
        ]),

        row([
          textCell(
            'RAPPORT FINANCIER'
          ),
        ]),

        row([
          textCell(
            `Période : ${formatReportDate(report.period.start)} au ${formatReportDate(report.period.end)}`
          ),
        ]),

        row([]),

        headerRow([
          'Indicateur',
          'Valeur',
        ]),

        row([
          textCell(
            'Membres actifs'
          ),
          numberCell(
            report.members.active
          ),
        ]),

        row([
          textCell(
            'Cotisations exigibles'
          ),
          numberCell(
            report.contributions.due
          ),
        ]),

        row([
          textCell(
            'Cotisations affectées'
          ),
          numberCell(
            report.contributions.allocated
          ),
        ]),

        row([
          textCell(
            'Reste à recouvrer'
          ),
          numberCell(
            report.contributions.remaining
          ),
        ]),

        row([
          textCell(
            'Taux de recouvrement (%)'
          ),
          numberCell(
            report.contributions.collectionRate ??
            0
          ),
        ]),

        row([
          textCell(
            'Encaissements confirmés'
          ),
          numberCell(
            report.payments.amount
          ),
        ]),

        row([
          textCell(
            "Droits d'adhésion acceptés"
          ),
          numberCell(
            report.membershipFees.accepted
          ),
        ]),

        row([
          textCell(
            "Droits d'adhésion encaissés"
          ),
          numberCell(
            report.membershipFees.collected
          ),
        ]),

        row([
          textCell(
            "Droits d'adhésion en attente"
          ),
          numberCell(
            report.membershipFees.outstanding
          ),
        ]),

        row([
          textCell(
            "Droits d'adhésion exonérés"
          ),
          numberCell(
            report.membershipFees.waived
          ),
        ]),

        row([
          textCell(
            "Solde d'ouverture"
          ),
          numberCell(
            report.treasury.openingBalance
          ),
        ]),

        row([
          textCell(
            'Entrées de trésorerie'
          ),
          numberCell(
            report.treasury.credits
          ),
        ]),

        row([
          textCell(
            'Sorties de trésorerie'
          ),
          numberCell(
            report.treasury.debits
          ),
        ]),

        row([
          textCell(
            'Solde de clôture'
          ),
          numberCell(
            report.treasury.closingBalance
          ),
        ]),
      ]
    ),

    worksheet(
      'Cotisations',
      [
        headerRow([
          'Date échéance',
          'Matricule',
          'Nom',
          'Cotisation',
          'Dû',
          'Affecté',
          'Reste',
          'Statut',
        ]),

        ...report
          .contributions
          .obligations
          .map(
            (
              item
            ) =>
              row([
                textCell(
                  item.due_date
                ),

                textCell(
                  item.member_number
                ),

                textCell(
                  `${item.last_name} ${item.first_name}`
                    .trim()
                ),

                textCell(
                  item.contribution_name
                ),

                numberCell(
                  money(
                    item.amount_due
                  )
                ),

                numberCell(
                  money(
                    item.amount_paid
                  )
                ),

                numberCell(
                  money(
                    item.remaining_amount
                  )
                ),

                textCell(
                  item.obligation_status
                ),
              ])
          ),
      ]
    ),

    worksheet(
      'Paiements',
      [
        headerRow([
          'Date',
          'Reçu',
          'Moyen',
          'Référence',
          'Montant',
          'Notes',
        ]),

        ...report
          .payments
          .rows
          .map(
            (
              payment
            ) =>
              row([
                textCell(
                  payment.paid_at
                ),

                textCell(
                  payment.receipt_number
                ),

                textCell(
                  payment.payment_method
                ),

                textCell(
                  payment.payment_reference ??
                  ''
                ),

                numberCell(
                  money(
                    payment.amount
                  )
                ),

                textCell(
                  payment.notes ??
                  ''
                ),
              ])
          ),
      ]
    ),

    worksheet(
      'Droits adhésion',
      [
        headerRow([
          'Indicateur',
          'Nombre',
          'Montant',
        ]),

        row([
          textCell(
            'Acceptés par le bureau'
          ),
          numberCell(
            report.membershipFees.acceptedCount
          ),
          numberCell(
            report.membershipFees.accepted
          ),
        ]),

        row([
          textCell(
            'Encaissés'
          ),
          numberCell(
            report.membershipFees.paidCount
          ),
          numberCell(
            report.membershipFees.collected
          ),
        ]),

        row([
          textCell(
            'En attente de paiement'
          ),
          numberCell(
            report.membershipFees.outstandingCount
          ),
          numberCell(
            report.membershipFees.outstanding
          ),
        ]),

        row([
          textCell(
            'Exonérés'
          ),
          numberCell(
            report.membershipFees.waivedCount
          ),
          numberCell(
            report.membershipFees.waived
          ),
        ]),

        row([]),

        headerRow([
          'Candidat',
          'Statut demande',
          "Statut droit d'adhésion",
          'Montant',
          'Demande déposée le',
          'Décision du bureau le',
          'Payé le',
          'Exonéré le',
        ]),

        ...report
          .membershipFees
          .rows
          .map(
            (
              item
            ) =>
              row([
                textCell(
                  item.applicantName
                ),

                textCell(
                  membershipApplicationStatusLabel(
                    item.applicationStatus
                  )
                ),

                textCell(
                  membershipFeeStatusLabel(
                    item.feeStatus
                  )
                ),

                numberCell(
                  item.amount
                ),

                textCell(
                  formatExcelDateTime(
                    item.submittedAt
                  )
                ),

                textCell(
                  formatExcelDateTime(
                    item.reviewedAt
                  )
                ),

                textCell(
                  formatExcelDateTime(
                    item.paidAt
                  )
                ),

                textCell(
                  formatExcelDateTime(
                    item.waivedAt
                  )
                ),
              ])
          ),
      ]
    ),

    worksheet(
      'Trésorerie',
      [
        headerRow([
          'Indicateur',
          'Montant',
        ]),

        row([
          textCell(
            "Solde d'ouverture"
          ),
          numberCell(
            report.treasury.openingBalance
          ),
        ]),

        row([
          textCell(
            'Entrées'
          ),
          numberCell(
            report.treasury.credits
          ),
        ]),

        row([
          textCell(
            'Sorties'
          ),
          numberCell(
            report.treasury.debits
          ),
        ]),

        row([
          textCell(
            'Variation'
          ),
          numberCell(
            report.treasury.net
          ),
        ]),

        row([
          textCell(
            'Solde de clôture'
          ),
          numberCell(
            report.treasury.closingBalance
          ),
        ]),

        row([]),

        headerRow([
          'Catégorie entrée',
          'Nombre',
          'Montant',
        ]),

        ...report
          .treasury
          .creditsByCategory
          .map(
            (
              category
            ) =>
              row([
                textCell(
                  category.category
                ),

                numberCell(
                  money(
                    category.movement_count
                  )
                ),

                numberCell(
                  money(
                    category.amount
                  )
                ),
              ])
          ),

        row([]),

        headerRow([
          'Catégorie sortie',
          'Nombre',
          'Montant',
        ]),

        ...report
          .treasury
          .debitsByCategory
          .map(
            (
              category
            ) =>
              row([
                textCell(
                  category.category
                ),

                numberCell(
                  money(
                    category.movement_count
                  )
                ),

                numberCell(
                  money(
                    category.amount
                  )
                ),
              ])
          ),
      ]
    ),

    worksheet(
      'Mouvements',
      [
        headerRow([
          'Date',
          'Sens',
          'Catégorie',
          'Description',
          'Montant',
        ]),

        ...report
          .treasury
          .movements
          .map(
            (
              movement
            ) =>
              row([
                textCell(
                  movement.entry_date
                ),

                textCell(
                  movement.direction
                ),

                textCell(
                  movement.category
                ),

                textCell(
                  movement.description ??
                  ''
                ),

                numberCell(
                  money(
                    movement.amount
                  )
                ),
              ])
          ),
      ]
    ),
  ]

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Money">
      <NumberFormat ss:Format="#,##0"/>
    </Style>
  </Styles>
  ${sheets.join('\n')}
</Workbook>`
}

// ============================================================
// SPREADSHEETML
// ============================================================

function worksheet(
  name: string,
  rows: string[]
) {
  return `
  <Worksheet ss:Name="${xmlEscape(
    sanitizeSheetName(
      name
    )
  )}">
    <Table>
      ${rows.join('\n')}
    </Table>
  </Worksheet>`
}

function row(
  cells: string[]
) {
  return `
      <Row>
        ${cells.join('\n')}
      </Row>`
}

function headerRow(
  values: string[]
) {
  return row(
    values.map(
      (
        value
      ) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(
          value
        )}</Data></Cell>`
    )
  )
}

function textCell(
  value:
    string
) {
  return `<Cell><Data ss:Type="String">${xmlEscape(
    value
  )}</Data></Cell>`
}

function numberCell(
  value:
    number
) {
  return `<Cell ss:StyleID="Money"><Data ss:Type="Number">${Number.isFinite(
    value
  ) ? value : 0}</Data></Cell>`
}

function xmlEscape(
  value: string
) {
  return value
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&apos;'
    )
}

function membershipApplicationStatusLabel(
  value: string
) {
  switch (
    value
      .trim()
      .toLowerCase()
  ) {
    case 'approved':
      return 'Adhésion finalisée'

    case 'awaiting_payment':
      return 'Acceptée par le bureau'

    case 'rejected':
      return 'Refusée'

    case 'cancelled':
      return 'Annulée'

    case 'pending':
      return 'En attente de décision'

    default:
      return value || 'Non renseigné'
  }
}

function membershipFeeStatusLabel(
  value: string
) {
  switch (
    value
      .trim()
      .toLowerCase()
  ) {
    case 'paid':
      return 'Payé'

    case 'waived':
      return 'Exonéré'

    case 'not_required':
      return 'Non requis'

    case 'pending':
      return 'En attente de paiement'

    default:
      return value || 'Non renseigné'
  }
}

function formatExcelDateTime(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return ''
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
    return value
  }

  return new Intl
    .DateTimeFormat(
      'fr-FR',
      {
        day:
          '2-digit',
        month:
          '2-digit',
        year:
          'numeric',
        hour:
          '2-digit',
        minute:
          '2-digit',
        timeZone:
          'UTC',
      }
    )
    .format(
      date
    )
}

function sanitizeSheetName(
  value: string
) {
  return value
    .replace(
      /[\\/*?:[\]]/g,
      '-'
    )
    .slice(
      0,
      31
    ) ||
    'Rapport'
}

function sanitizeFilename(
  value: string
) {
  return value
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
    .toLowerCase() ||
    'mutuelle'
}
