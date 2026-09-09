import 'server-only'

import type {
  SupabaseClient,
} from '@supabase/supabase-js'

// ============================================================
// AFRI CLUB
// SOURCE UNIQUE DU RAPPORT FINANCIER
//
// Cette fonction alimente :
// - l'ecran /rapports
// - l'impression / PDF via le navigateur
// - l'export Excel
//
// Elle ne lit jamais les tables d'abonnement SaaS.
// ============================================================

export type MoneyValue =
  | number
  | string
  | null

export type FinancialReportObligation = {
  obligation_id: string
  member_id: string
  member_number: string
  first_name: string
  last_name: string
  contribution_type_id: string | null
  contribution_name: string
  amount_due: MoneyValue
  amount_paid: MoneyValue
  remaining_amount: MoneyValue
  obligation_status: string
  due_date: string
}

export type FinancialReportPayment = {
  id: string
  amount: MoneyValue
  payment_method: string
  payment_reference: string | null
  receipt_number: string
  notes: string | null
  paid_at: string
  status: string
}

export type TreasuryCategory = {
  category: string
  amount: MoneyValue
  movement_count: MoneyValue
}

export type TreasuryMovement = {
  id: string
  direction:
    | 'credit'
    | 'debit'
    | string
  category: string
  amount: MoneyValue
  description: string | null
  entry_date: string
  created_at: string
}

export type TreasuryReport = {
  organization_id: string
  start_date: string
  end_date: string
  opening_balance: MoneyValue
  period_credits: MoneyValue
  period_debits: MoneyValue
  period_net: MoneyValue
  closing_balance: MoneyValue
  credits_by_category:
    TreasuryCategory[]
  debits_by_category:
    TreasuryCategory[]
  movements:
    TreasuryMovement[]
}

export type ContributionBreakdown = {
  name: string
  due: number
  paid: number
  remaining: number
  obligationCount: number
}

export type PaymentMethodBreakdown = {
  method: string
  amount: number
  paymentCount: number
}

export type FinancialReport = {
  period: {
    start: string
    end: string
  }

  organization: {
    id: string
    name: string
    shortName: string | null
    location: string | null
    phone: string | null
    email: string | null
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string
  }

  members: {
    active: number
    concerned: number
    paid: number
    partial: number
    unpaid: number
  }

  contributions: {
    due: number
    allocated: number
    remaining: number
    collectionRate: number | null
    breakdown:
      ContributionBreakdown[]
    obligations:
      FinancialReportObligation[]
  }

  payments: {
    amount: number
    count: number
    byMethod:
      PaymentMethodBreakdown[]
    rows:
      FinancialReportPayment[]
  }

  treasury: {
    openingBalance: number
    credits: number
    debits: number
    net: number
    closingBalance: number
    creditsByCategory:
      TreasuryCategory[]
    debitsByCategory:
      TreasuryCategory[]
    movements:
      TreasuryMovement[]
  }

  generatedAt: string
}

type BuildFinancialReportInput = {
  supabase: SupabaseClient
  organizationId: string
  startDate: string
  endDate: string
}

export async function buildFinancialReport({
  supabase,
  organizationId,
  startDate,
  endDate,
}: BuildFinancialReportInput): Promise<FinancialReport> {

  validateDateRange(
    startDate,
    endDate
  )

  // ==========================================================
  // ORGANISATION
  // ==========================================================

  const {
    data:
      organization,

    error:
      organizationError,
  } =
    await supabase
      .from(
        'organizations'
      )
      .select(`
        id,
        name,
        short_name
      `)
      .eq(
        'id',
        organizationId
      )
      .maybeSingle()

  if (
    organizationError ||
    !organization
  ) {
    throw new Error(
      'Impossible de charger les informations de la mutuelle.'
    )
  }

  const {
    data:
      profile,

    error:
      profileError,
  } =
    await supabase
      .from(
        'organization_public_profiles'
      )
      .select(`
        organization_id,
        logo_path,
        primary_color,
        secondary_color,
        location_label,
        public_phone,
        public_email
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .maybeSingle()

  if (
    profileError
  ) {
    console.error(
      'AFRI CLUB - FINANCIAL REPORT PROFILE:',
      profileError
    )
  }

  const logoUrl =
    profile
      ?.logo_path
      ? supabase
          .storage
          .from(
            'organization-branding'
          )
          .getPublicUrl(
            profile.logo_path
          )
          .data
          .publicUrl
      : null

  // ==========================================================
  // MEMBRES ACTIFS
  // ==========================================================

  const {
    count:
      activeMemberCount,

    error:
      activeMemberError,
  } =
    await supabase
      .from(
        'members'
      )
      .select(
        'id',
        {
          count:
            'exact',

          head:
            true,
        }
      )
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'status',
        'active'
      )

  if (
    activeMemberError
  ) {
    throw new Error(
      'Impossible de compter les membres actifs.'
    )
  }

  // ==========================================================
  // COTISATIONS / OBLIGATIONS
  //
  // On reutilise la RPC metier existante deja utilisee
  // par le recouvrement et le tableau de bord.
  // ==========================================================

  const monthStarts =
    listMonthStarts(
      startDate,
      endDate
    )

  const obligationResults =
    await Promise.all(
      monthStarts.map(
        async (
          monthStart
        ) => {
          const {
            data,
            error,
          } =
            await supabase
              .rpc(
                'list_contribution_obligations',
                {
                  target_organization_id:
                    organizationId,

                  target_period:
                    monthStart,
                }
              )

          if (error) {
            throw new Error(
              `Impossible de charger les cotisations pour ${monthStart}.`
            )
          }

          return (
            data ??
            []
          ) as FinancialReportObligation[]
        }
      )
    )

  const obligationMap =
    new Map<
      string,
      FinancialReportObligation
    >()

  for (
    const row of
    obligationResults.flat()
  ) {
    if (
      row.due_date <
        startDate ||
      row.due_date >
        endDate
    ) {
      continue
    }

    if (
      [
        'waived',
        'cancelled',
      ].includes(
        row.obligation_status
      )
    ) {
      continue
    }

    obligationMap.set(
      row.obligation_id,
      row
    )
  }

  const obligations =
    Array.from(
      obligationMap.values()
    )
      .sort(
        (a, b) =>
          a.due_date.localeCompare(
            b.due_date
          ) ||
          a.member_number.localeCompare(
            b.member_number
          )
      )

  const contributionDue =
    obligations.reduce(
      (
        total,
        row
      ) =>
        total +
        money(
          row.amount_due
        ),
      0
    )

  const contributionAllocated =
    obligations.reduce(
      (
        total,
        row
      ) =>
        total +
        money(
          row.amount_paid
        ),
      0
    )

  const contributionRemaining =
    obligations.reduce(
      (
        total,
        row
      ) =>
        total +
        money(
          row.remaining_amount
        ),
      0
    )

  const collectionRate =
    contributionDue > 0
      ? Math.round(
          (
            contributionAllocated /
            contributionDue
          ) *
            10000
        ) /
        100
      : null

  const contributionBreakdownMap =
    new Map<
      string,
      ContributionBreakdown
    >()

  const memberSituationMap =
    new Map<
      string,
      {
        due: number
        paid: number
        remaining: number
      }
    >()

  for (
    const obligation of
    obligations
  ) {
    const name =
      obligation
        .contribution_name ||
      'Cotisation'

    const breakdown =
      contributionBreakdownMap
        .get(
          name
        ) ?? {
          name,
          due:
            0,
          paid:
            0,
          remaining:
            0,
          obligationCount:
            0,
        }

    breakdown.due +=
      money(
        obligation.amount_due
      )

    breakdown.paid +=
      money(
        obligation.amount_paid
      )

    breakdown.remaining +=
      money(
        obligation.remaining_amount
      )

    breakdown.obligationCount +=
      1

    contributionBreakdownMap.set(
      name,
      breakdown
    )

    const member =
      memberSituationMap
        .get(
          obligation.member_id
        ) ?? {
          due:
            0,
          paid:
            0,
          remaining:
            0,
        }

    member.due +=
      money(
        obligation.amount_due
      )

    member.paid +=
      money(
        obligation.amount_paid
      )

    member.remaining +=
      money(
        obligation.remaining_amount
      )

    memberSituationMap.set(
      obligation.member_id,
      member
    )
  }

  let paidMembers =
    0

  let partialMembers =
    0

  let unpaidMembers =
    0

  memberSituationMap.forEach(
    (
      situation
    ) => {
      if (
        situation.due > 0 &&
        situation.remaining <= 0
      ) {
        paidMembers +=
          1
      } else if (
        situation.paid > 0 &&
        situation.remaining > 0
      ) {
        partialMembers +=
          1
      } else if (
        situation.remaining > 0
      ) {
        unpaidMembers +=
          1
      }
    }
  )

  const contributionBreakdown =
    Array.from(
      contributionBreakdownMap
        .values()
    )
      .sort(
        (a, b) =>
          b.due -
          a.due
      )

  // ==========================================================
  // PAIEMENTS ENCAISSES PENDANT LA PERIODE
  //
  // A distinguer du montant affecte aux echeances :
  // un paiement peut etre anticipe ou affecte a plusieurs periodes.
  // ==========================================================

  const endExclusive =
    addDays(
      endDate,
      1
    )

  const {
    data:
      paymentRows,

    error:
      paymentError,
  } =
    await supabase
      .from(
        'payments'
      )
      .select(`
        id,
        amount,
        payment_method,
        payment_reference,
        receipt_number,
        notes,
        paid_at,
        status
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'status',
        'confirmed'
      )
      .gte(
        'paid_at',
        `${startDate}T00:00:00.000Z`
      )
      .lt(
        'paid_at',
        `${endExclusive}T00:00:00.000Z`
      )
      .order(
        'paid_at',
        {
          ascending:
            true,
        }
      )

  if (
    paymentError
  ) {
    throw new Error(
      'Impossible de charger les encaissements de la periode.'
    )
  }

  const payments =
    (
      paymentRows ??
      []
    ) as FinancialReportPayment[]

  const paymentAmount =
    payments.reduce(
      (
        total,
        payment
      ) =>
        total +
        money(
          payment.amount
        ),
      0
    )

  const paymentMethodMap =
    new Map<
      string,
      PaymentMethodBreakdown
    >()

  for (
    const payment of
    payments
  ) {
    const method =
      normalizePaymentMethod(
        payment
          .payment_method
      )

    const current =
      paymentMethodMap
        .get(
          method
        ) ?? {
          method,
          amount:
            0,
          paymentCount:
            0,
        }

    current.amount +=
      money(
        payment.amount
      )

    current.paymentCount +=
      1

    paymentMethodMap.set(
      method,
      current
    )
  }

  const paymentByMethod =
    Array.from(
      paymentMethodMap.values()
    )
      .sort(
        (a, b) =>
          b.amount -
          a.amount
      )

  // ==========================================================
  // TRESORERIE
  // ==========================================================

  const {
    data:
      treasuryRaw,

    error:
      treasuryError,
  } =
    await supabase
      .rpc(
        'get_organization_financial_report_treasury',
        {
          target_organization_id:
            organizationId,

          target_start_date:
            startDate,

          target_end_date:
            endDate,
        }
      )

  if (
    treasuryError ||
    !treasuryRaw
  ) {
    throw new Error(
      'Impossible de charger la synthese de tresorerie.'
    )
  }

  const treasury =
    treasuryRaw as TreasuryReport

  // ==========================================================
  // RESULTAT UNIQUE
  // ==========================================================

  return {
    period: {
      start:
        startDate,
      end:
        endDate,
    },

    organization: {
      id:
        organization.id,

      name:
        organization.name,

      shortName:
        organization.short_name,

      location:
        profile
          ?.location_label ??
        null,

      phone:
        profile
          ?.public_phone ??
        null,

      email:
        profile
          ?.public_email ??
        null,

      logoUrl,

      primaryColor:
        safeColor(
          profile
            ?.primary_color,
          '#047857'
        ),

      secondaryColor:
        safeColor(
          profile
            ?.secondary_color,
          '#0F172A'
        ),
    },

    members: {
      active:
        activeMemberCount ??
        0,

      concerned:
        memberSituationMap
          .size,

      paid:
        paidMembers,

      partial:
        partialMembers,

      unpaid:
        unpaidMembers,
    },

    contributions: {
      due:
        contributionDue,

      allocated:
        contributionAllocated,

      remaining:
        contributionRemaining,

      collectionRate,

      breakdown:
        contributionBreakdown,

      obligations,
    },

    payments: {
      amount:
        paymentAmount,

      count:
        payments.length,

      byMethod:
        paymentByMethod,

      rows:
        payments,
    },

    treasury: {
      openingBalance:
        money(
          treasury
            .opening_balance
        ),

      credits:
        money(
          treasury
            .period_credits
        ),

      debits:
        money(
          treasury
            .period_debits
        ),

      net:
        money(
          treasury
            .period_net
        ),

      closingBalance:
        money(
          treasury
            .closing_balance
        ),

      creditsByCategory:
        treasury
          .credits_by_category ??
        [],

      debitsByCategory:
        treasury
          .debits_by_category ??
        [],

      movements:
        treasury
          .movements ??
        [],
    },

    generatedAt:
      new Date()
        .toISOString(),
  }
}

// ============================================================
// PERIODE
// ============================================================

export function resolveReportPeriod({
  start,
  end,
  now =
    new Date(),
}: {
  start?:
    | string
    | null
  end?:
    | string
    | null
  now?:
    Date
}) {
  const defaultStart =
    `${now.getUTCFullYear()}-01-01`

  const defaultEnd =
    `${now.getUTCFullYear()}-12-31`

  const startDate =
    isIsoDate(
      start
    )
      ? start!
      : defaultStart

  const endDate =
    isIsoDate(
      end
    )
      ? end!
      : defaultEnd

  validateDateRange(
    startDate,
    endDate
  )

  return {
    startDate,
    endDate,
  }
}

function validateDateRange(
  startDate: string,
  endDate: string
) {
  if (
    !isIsoDate(
      startDate
    ) ||
    !isIsoDate(
      endDate
    )
  ) {
    throw new Error(
      'Periode de rapport invalide.'
    )
  }

  if (
    startDate >
    endDate
  ) {
    throw new Error(
      'La date de debut doit preceder la date de fin.'
    )
  }

  const start =
    new Date(
      `${startDate}T00:00:00.000Z`
    )

  const end =
    new Date(
      `${endDate}T00:00:00.000Z`
    )

  const maximumEnd =
    new Date(
      start
    )

  maximumEnd
    .setUTCFullYear(
      maximumEnd
        .getUTCFullYear() +
        5
    )

  if (
    end >
    maximumEnd
  ) {
    throw new Error(
      'La periode du rapport ne peut pas depasser 5 ans.'
    )
  }
}

function listMonthStarts(
  startDate: string,
  endDate: string
) {
  const start =
    new Date(
      `${startDate}T00:00:00.000Z`
    )

  const end =
    new Date(
      `${endDate}T00:00:00.000Z`
    )

  const cursor =
    new Date(
      Date.UTC(
        start
          .getUTCFullYear(),
        start
          .getUTCMonth(),
        1
      )
    )

  const endMonth =
    new Date(
      Date.UTC(
        end
          .getUTCFullYear(),
        end
          .getUTCMonth(),
        1
      )
    )

  const result:
    string[] = []

  while (
    cursor <=
    endMonth
  ) {
    result.push(
      cursor
        .toISOString()
        .slice(
          0,
          10
        )
    )

    cursor
      .setUTCMonth(
        cursor
          .getUTCMonth() +
        1
      )
  }

  return result
}

function addDays(
  isoDate: string,
  days: number
) {
  const date =
    new Date(
      `${isoDate}T00:00:00.000Z`
    )

  date.setUTCDate(
    date.getUTCDate() +
      days
  )

  return date
    .toISOString()
    .slice(
      0,
      10
    )
}

// ============================================================
// FORMAT / NORMALISATION
// ============================================================

export function money(
  value:
    MoneyValue
) {
  const parsed =
    Number(
      value ??
      0
    )

  return Number
    .isFinite(
      parsed
    )
      ? parsed
      : 0
}

export function formatMoney(
  value:
    MoneyValue
) {
  return (
    new Intl
      .NumberFormat(
        'fr-FR',
        {
          maximumFractionDigits:
            0,
        }
      )
      .format(
        money(
          value
        )
      )
    +
    ' FCFA'
  )
}

export function formatReportDate(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00.000Z`
    )

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
        timeZone:
          'UTC',
      }
    )
    .format(
      date
    )
}

export function normalizePaymentMethod(
  value:
    | string
    | null
    | undefined
) {
  const normalized =
    (
      value ??
      ''
    )
      .trim()
      .toLowerCase()

  const labels:
    Record<
      string,
      string
    > = {
      cash:
        'Espèces',
      wave:
        'Wave',
      orange_money:
        'Orange Money',
      mtn_momo:
        'MTN MoMo',
      moov_money:
        'Moov Money',
      bank_transfer:
        'Virement bancaire',
      other:
        'Autre',
    }

  return (
    labels[
      normalized
    ] ??
    (
      normalized
        ? normalized
        : 'Non renseigné'
    )
  )
}

function isIsoDate(
  value:
    | string
    | null
    | undefined
) {
  return (
    typeof value ===
      'string' &&
    /^\d{4}-\d{2}-\d{2}$/
      .test(
        value
      )
  )
}

function safeColor(
  value:
    | string
    | null
    | undefined,
  fallback:
    string
) {
  return (
    value &&
    /^#[0-9A-Fa-f]{6}$/
      .test(
        value
      )
  )
    ? value
    : fallback
}
