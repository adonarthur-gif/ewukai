import Link from 'next/link'
import { redirect } from 'next/navigation'

import DashboardAnalytics, {
  type DashboardAnalyticsRow,
} from '@/components/dashboard/dashboard-analytics'

import {
  requireCurrentOrganization,
  type OrganizationRole,
} from '@/lib/auth/current-organization'

// ============================================================
// TYPES
// ============================================================

type MoneyValue =
  | number
  | string
  | null

type Organization = {
  id: string
  name: string
  short_name: string | null
  public_slug: string | null
  public_page_enabled: boolean
  online_membership_enabled: boolean
}

type ObligationRow = {
  obligation_id: string
  member_id: string
  member_number: string
  first_name: string
  last_name: string

  contribution_type_id:
    | string
    | null

  contribution_name: string

  amount_due: MoneyValue
  amount_paid: MoneyValue
  remaining_amount: MoneyValue

  obligation_status: string
  due_date: string
}

type PaymentRow = {
  id: string
  amount: MoneyValue
  status: string
  paid_at: string
}

type RecentMember = {
  id: string
  member_number: string
  first_name: string
  last_name: string
  joined_at: string
  status: string
  created_at: string
}

type LedgerEntry = {
  id: string

  direction:
    | 'credit'
    | 'debit'

  category: string
  amount: MoneyValue
  description: string
  entry_date: string
  created_at: string
}

type CashSummary = {
  total_credits: MoneyValue
  total_debits: MoneyValue
  current_balance: MoneyValue

  month_credits: MoneyValue
  month_debits: MoneyValue
  month_balance: MoneyValue
  month_movements: MoneyValue
}

type MemberCollectionSituation = {
  due: number
  paid: number
  remaining: number
}

// ============================================================
// PAGE
// ============================================================

export default async function DashboardPage() {
  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ==========================================================
  // SECURITE
  // ==========================================================

  if (
    role === 'member'
  ) {
    redirect('/my-space')
  }

  // ==========================================================
  // PERMISSIONS
  // ==========================================================

  const canViewFinances =
    [
      'owner',
      'president',
      'treasurer',
      'auditor',
    ].includes(role)

  const canViewMemberships =
    [
      'owner',
      'president',
      'secretary',
      'auditor',
    ].includes(role)

  const canReviewMemberships =
    [
      'owner',
      'president',
      'secretary',
    ].includes(role)

  const canManageTreasury =
    [
      'owner',
      'president',
      'treasurer',
    ].includes(role)

  const canManageCalls =
    [
      'owner',
      'president',
      'treasurer',
      'secretary',
    ].includes(role)

  // ==========================================================
  // DATE / PERIODE COURANTE
  // ==========================================================

  const now =
    new Date()

  const currentYear =
    now.getUTCFullYear()

  const currentMonth =
    now.getUTCMonth() + 1

  const currentPeriodStart =
    `${currentYear}-${String(
      currentMonth
    ).padStart(
      2,
      '0'
    )}-01`

  const nextPeriodStart =
    currentMonth === 12
      ? `${currentYear + 1}-01-01`
      : `${currentYear}-${String(
          currentMonth + 1
        ).padStart(
          2,
          '0'
        )}-01`

  const currentMonthStartIso =
    `${currentPeriodStart}T00:00:00.000Z`

  const nextMonthStartIso =
    `${nextPeriodStart}T00:00:00.000Z`

  // ==========================================================
  // ORGANISATION ACTIVE
  // ==========================================================

  const {
    data: organizationData,
    error: organizationError,
  } =
    await supabase
      .from('organizations')
      .select(`
        id,
        name,
        short_name,
        public_slug,
        public_page_enabled,
        online_membership_enabled
      `)
      .eq(
        'id',
        organizationId
      )
      .maybeSingle()

  if (
    organizationError ||
    !organizationData
  ) {
    console.error(
      'DASHBOARD - organization:',
      organizationError
    )

    throw new Error(
      'Impossible de charger les informations de l’organisation.'
    )
  }

  const organization =
    organizationData as Organization

  // ==========================================================
  // MEMBRES / COTISATIONS
  // ==========================================================

  const [
    totalMembersResult,
    activeMembersResult,
    recentMembersResult,
    activeContributionTypesResult,
  ] =
    await Promise.all([
      // ------------------------------------------------------
      // TOTAL MEMBRES
      // ------------------------------------------------------

      supabase
        .from('members')
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'organization_id',
          organizationId
        ),

      // ------------------------------------------------------
      // MEMBRES ACTIFS
      // ------------------------------------------------------

      supabase
        .from('members')
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'organization_id',
          organizationId
        )
        .eq(
          'status',
          'active'
        ),

      // ------------------------------------------------------
      // MEMBRES RECENTS
      // ------------------------------------------------------

      supabase
        .from('members')
        .select(`
          id,
          member_number,
          first_name,
          last_name,
          joined_at,
          status,
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
        .limit(5),

      // ------------------------------------------------------
      // TYPES DE COTISATIONS ACTIFS
      // ------------------------------------------------------

      supabase
        .from(
          'contribution_types'
        )
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'organization_id',
          organizationId
        )
        .eq(
          'is_active',
          true
        ),
    ])

  const totalMembers =
    totalMembersResult.count ??
    0

  const activeMembers =
    activeMembersResult.count ??
    0

  const inactiveMembers =
    Math.max(
      totalMembers -
        activeMembers,
      0
    )

  const recentMembers =
    (
      recentMembersResult.data ??
      []
    ) as RecentMember[]

  const activeContributionTypes =
    activeContributionTypesResult.count ??
    0

  // ==========================================================
  // DEMANDES D'ADHESION
  // ==========================================================

  let pendingApplications =
    0

  if (
    canViewMemberships
  ) {
    const {
      count,
      error,
    } =
      await supabase
        .from(
          'membership_applications'
        )
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'organization_id',
          organizationId
        )
        .eq(
          'status',
          'pending'
        )

    if (error) {
      console.error(
        'DASHBOARD - membership applications:',
        error
      )
    } else {
      pendingApplications =
        count ?? 0
    }
  }

  // ==========================================================
  // APPELS EXCEPTIONNELS
  // ==========================================================

  let draftCalls =
    0

  if (
    canManageCalls
  ) {
    const {
      count,
      error,
    } =
      await supabase
        .from(
          'contribution_calls'
        )
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'organization_id',
          organizationId
        )
        .eq(
          'status',
          'draft'
        )

    if (error) {
      console.error(
        'DASHBOARD - contribution calls:',
        error
      )
    } else {
      draftCalls =
        count ?? 0
    }
  }

  // ==========================================================
  // DONNEES FINANCIERES
  // ==========================================================

  let obligations:
    ObligationRow[] =
    []

  let payments:
    PaymentRow[] =
    []

  let cashSummary:
    CashSummary | null =
    null

  let treasuryAccountsCount =
    0

  let recentLedgerEntries:
    LedgerEntry[] =
    []

  let dashboardAnalytics:
    DashboardAnalyticsRow[] =
    []

  // ==========================================================
  // CHARGEMENT DES DONNEES FINANCIERES
  // ==========================================================

  if (
    canViewFinances
  ) {
    const [
      obligationsResult,
      paymentsResult,
      cashResult,
      treasuryAccountsResult,
      ledgerResult,
      analyticsResult,
    ] =
      await Promise.all([
        // ----------------------------------------------------
        // RECOUVREMENT DU MOIS
        // ----------------------------------------------------

        supabase.rpc(
          'list_contribution_obligations',
          {
            target_organization_id:
              organizationId,

            target_period:
              currentPeriodStart,
          }
        ),

        // ----------------------------------------------------
        // PAIEMENTS DU MOIS
        // ----------------------------------------------------

        supabase
          .from('payments')
          .select(`
            id,
            amount,
            status,
            paid_at
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
            currentMonthStartIso
          )
          .lt(
            'paid_at',
            nextMonthStartIso
          )
          .order(
            'paid_at',
            {
              ascending: false,
            }
          ),

        // ----------------------------------------------------
        // RESUME TRESORERIE
        // ----------------------------------------------------

        supabase.rpc(
          'get_cash_summary',
          {
            target_organization_id:
              organizationId,

            target_month:
              currentPeriodStart,
          }
        ),

        // ----------------------------------------------------
        // COMPTES DE TRESORERIE
        // ----------------------------------------------------

        supabase
          .from(
            'treasury_accounts'
          )
          .select(
            'id',
            {
              count: 'exact',
              head: true,
            }
          )
          .eq(
            'organization_id',
            organizationId
          )
          .eq(
            'is_active',
            true
          ),

        // ----------------------------------------------------
        // JOURNAL RECENT
        // ----------------------------------------------------

        supabase
          .from(
            'ledger_entries'
          )
          .select(`
            id,
            direction,
            category,
            amount,
            description,
            entry_date,
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
          .limit(6),

        // ----------------------------------------------------
        // ANALYTIQUE 6 MOIS
        // ----------------------------------------------------

        supabase.rpc(
          'get_dashboard_analytics',
          {
            target_organization_id:
              organizationId,

            target_month:
              currentPeriodStart,
          }
        ),
      ])

    // ========================================================
    // OBLIGATIONS
    // ========================================================

    if (
      obligationsResult.error
    ) {
      console.error(
        'DASHBOARD - obligations:',
        obligationsResult.error
      )
    } else {
      obligations =
        (
          obligationsResult.data ??
          []
        ) as ObligationRow[]
    }

    // ========================================================
    // PAIEMENTS
    // ========================================================

    if (
      paymentsResult.error
    ) {
      console.error(
        'DASHBOARD - payments:',
        paymentsResult.error
      )
    } else {
      payments =
        (
          paymentsResult.data ??
          []
        ) as PaymentRow[]
    }

    // ========================================================
    // TRESORERIE
    // ========================================================

    if (
      cashResult.error
    ) {
      console.error(
        'DASHBOARD - cash:',
        cashResult.error
      )
    } else {
      cashSummary =
        (
          cashResult.data?.[0] ??
          null
        ) as CashSummary | null
    }

    // ========================================================
    // COMPTES DE TRESORERIE
    // ========================================================

    if (
      treasuryAccountsResult.error
    ) {
      console.error(
        'DASHBOARD - treasury accounts:',
        treasuryAccountsResult.error
      )
    } else {
      treasuryAccountsCount =
        treasuryAccountsResult.count ??
        0
    }

    // ========================================================
    // JOURNAL
    // ========================================================

    if (
      ledgerResult.error
    ) {
      console.error(
        'DASHBOARD - ledger:',
        ledgerResult.error
      )
    } else {
      recentLedgerEntries =
        (
          ledgerResult.data ??
          []
        ) as LedgerEntry[]
    }

    // ========================================================
    // ANALYTIQUE
    // ========================================================

    if (
      analyticsResult.error
    ) {
      console.error(
        'DASHBOARD - analytics:',
        analyticsResult.error
      )
    } else {
      dashboardAnalytics =
        (
          analyticsResult.data ??
          []
        ) as DashboardAnalyticsRow[]
    }
  }

  // ==========================================================
  // OBLIGATIONS UTILES
  // ==========================================================

  const usefulObligations =
    obligations.filter(
      (
        obligation
      ) =>
        ![
          'waived',
          'cancelled',
        ].includes(
          obligation.obligation_status
        )
    )

  // ==========================================================
  // RECOUVREMENT
  // ==========================================================

  const expectedAmount =
    usefulObligations.reduce(
      (
        total,
        obligation
      ) =>
        total +
        money(
          obligation.amount_due
        ),
      0
    )

  const allocatedAmount =
    usefulObligations.reduce(
      (
        total,
        obligation
      ) =>
        total +
        money(
          obligation.amount_paid
        ),
      0
    )

  const remainingAmount =
    usefulObligations.reduce(
      (
        total,
        obligation
      ) =>
        total +
        money(
          obligation.remaining_amount
        ),
      0
    )

  // ==========================================================
  // IMPORTANT :
  //
  // Aucune échéance n'est PAS équivalente à 0 %.
  // ==========================================================

  const hasCurrentPeriodObligations =
    expectedAmount > 0

  const collectionRate:
    | number
    | null =
    hasCurrentPeriodObligations
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (
                allocatedAmount /
                expectedAmount
              ) *
                100
            )
          )
        )
      : null

  // ==========================================================
  // SITUATION PAR MEMBRE
  // ==========================================================

  const memberSituations =
    new Map<
      string,
      MemberCollectionSituation
    >()

  for (
    const obligation of
    usefulObligations
  ) {
    const current =
      memberSituations.get(
        obligation.member_id
      ) ?? {
        due: 0,
        paid: 0,
        remaining: 0,
      }

    current.due +=
      money(
        obligation.amount_due
      )

    current.paid +=
      money(
        obligation.amount_paid
      )

    current.remaining +=
      money(
        obligation.remaining_amount
      )

    memberSituations.set(
      obligation.member_id,
      current
    )
  }

  let paidMembers =
    0

  let partialMembers =
    0

  let unpaidMembers =
    0

  memberSituations.forEach(
    (
      situation
    ) => {
      if (
        situation.due >
          0 &&
        situation.remaining <=
          0
      ) {
        paidMembers +=
          1

        return
      }

      if (
        situation.paid >
          0 &&
        situation.remaining >
          0
      ) {
        partialMembers +=
          1

        return
      }

      if (
        situation.remaining >
        0
      ) {
        unpaidMembers +=
          1
      }
    }
  )

  // ==========================================================
  // PAIEMENTS DU MOIS
  // ==========================================================

  const paymentsThisMonth =
    payments.length

  const paymentsAmountThisMonth =
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

  // ==========================================================
  // TRESORERIE
  // ==========================================================

  const treasuryBalance =
    money(
      cashSummary
        ?.current_balance ??
        0
    )

  const monthCredits =
    money(
      cashSummary
        ?.month_credits ??
        0
    )

  const monthDebits =
    money(
      cashSummary
        ?.month_debits ??
        0
    )

  const monthBalance =
    money(
      cashSummary
        ?.month_balance ??
        0
    )

  // ==========================================================
  // INFORMATIONS GENERALES
  // ==========================================================

  const shortName =
    organization.short_name ||
    organization.name

  const publicSpaceAvailable =
    Boolean(
      organization.public_page_enabled &&
      organization.public_slug
    )

  // ==========================================================
  // QUALITE DU RECOUVREMENT
  // ==========================================================

  const collectionTone =
    collectionRate === null
      ? {
          label:
            'Aucune cotisation exigible ce mois',

          tone:
            'default' as const,
        }
      : getCollectionTone(
          collectionRate
        )

  // ==========================================================
  // ALERTES
  // ==========================================================

  const attentionCount =
    [
      pendingApplications >
        0,

      hasCurrentPeriodObligations &&
        remainingAmount >
          0,

      hasCurrentPeriodObligations &&
        partialMembers >
          0,

      canManageCalls &&
        draftCalls >
          0,

      canViewFinances &&
        treasuryAccountsCount ===
          0,
    ].filter(
      Boolean
    ).length

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">

        {/* ================================================== */}
        {/* HERO */}
        {/* ================================================== */}

        <section
          className="overflow-hidden rounded-3xl text-white shadow-sm"
          style={{
            background:
              'linear-gradient(120deg, var(--brand-secondary, #0F172A), var(--brand-primary, #047857))',
          }}
        >

          <div className="p-7 sm:p-9">

            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">

              {/* ============================================= */}
              {/* ORGANISATION */}
              {/* ============================================= */}

              <div className="max-w-3xl">

                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
                  Tableau de bord
                </p>

                <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                  {shortName}
                </h1>

                <p className="mt-2 text-lg font-bold text-white/90">
                  {organization.name}
                </p>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                  Suivez en un coup
                  d&apos;œil les membres,
                  les cotisations, le
                  recouvrement et la
                  trésorerie de votre
                  organisation.
                </p>

              </div>

              {/* ============================================= */}
              {/* ROLE / DATE */}
              {/* ============================================= */}

              <div className="grid min-w-56 gap-3 sm:grid-cols-2 lg:grid-cols-1">

                <HeroInfo
                  label="Votre rôle"
                  value={
                    roleLabel(
                      role
                    )
                  }
                />

                <HeroInfo
                  label="Aujourd’hui"
                  value={
                    formatLongDate(
                      now
                    )
                  }
                  compact
                />

              </div>

            </div>

            {/* =============================================== */}
            {/* ACTIONS */}
            {/* =============================================== */}

            <div className="mt-7 flex flex-wrap gap-3">

              {canReviewMemberships && (
                <Link
                  href="/memberships"
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Adhésions
                  {pendingApplications >
                    0 &&
                    ` (${pendingApplications})`}
                </Link>
              )}

              {canViewFinances && (
                <Link
                  href="/contributions/collection"
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Recouvrement
                </Link>
              )}

              {canViewFinances && (
                <Link
                  href="/cash"
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Trésorerie
                </Link>
              )}

              {publicSpaceAvailable && (
                <Link
                  href={`/m/${organization.public_slug}`}
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Vitrine publique
                </Link>
              )}

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* VUE D'ENSEMBLE */}
        {/* ================================================== */}

        <section className="mt-8">

          <SectionTitle
            eyebrow="Pilotage"
            title="Vue d’ensemble"
            description="Les indicateurs essentiels de l’organisation active."
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {/* =============================================== */}
            {/* MEMBRES */}
            {/* =============================================== */}

            <KpiCard
              label="Membres actifs"
              value={
                String(
                  activeMembers
                )
              }
              description={
                inactiveMembers >
                0
                  ? `${totalMembers} enregistrés · ${inactiveMembers} non actif${inactiveMembers > 1 ? 's' : ''}`

                  : `${totalMembers} membre${totalMembers > 1 ? 's' : ''} enregistré${totalMembers > 1 ? 's' : ''}`
              }
              href="/members"
            />

            {/* =============================================== */}
            {/* RECOUVREMENT */}
            {/* =============================================== */}

            {canViewFinances ? (
              <KpiCard
                label="Recouvrement du mois"
                value={
                  collectionRate ===
                  null
                    ? '—'
                    : `${collectionRate} %`
                }
                description={
                  collectionRate ===
                  null
                    ? `Aucune cotisation exigible pour ${formatPeriod(
                        currentPeriodStart
                      )}`

                    : collectionTone.label
                }
                href="/contributions/collection"
                tone={
                  collectionTone.tone
                }
              />
            ) : (
              <KpiCard
                label="Cotisations actives"
                value={
                  String(
                    activeContributionTypes
                  )
                }
                description="Types de cotisations actuellement configurés"
                href="/contributions"
              />
            )}

            {/* =============================================== */}
            {/* ADHESIONS */}
            {/* =============================================== */}

            {canViewMemberships ? (
              <KpiCard
                label="Adhésions en attente"
                value={
                  String(
                    pendingApplications
                  )
                }
                description={
                  pendingApplications >
                  0
                    ? 'Des demandes attendent une décision'

                    : 'Aucune demande en attente'
                }
                href="/memberships"
                tone={
                  pendingApplications >
                  0
                    ? 'warning'

                    : 'success'
                }
              />
            ) : (
              <KpiCard
                label="Espace public"
                value={
                  publicSpaceAvailable
                    ? 'Actif'
                    : 'Inactif'
                }
                description="Vitrine numérique de l’organisation"
                href={
                  publicSpaceAvailable
                    ? `/m/${organization.public_slug}`
                    : undefined
                }
              />
            )}

            {/* =============================================== */}
            {/* TRESORERIE */}
            {/* =============================================== */}

            {canViewFinances ? (
              <KpiCard
                label="Solde comptabilisé"
                value={
                  formatMoney(
                    treasuryBalance
                  )
                }
                description={
                  treasuryAccountsCount ===
                  0
                    ? 'Aucun compte de trésorerie actif'

                    : `${treasuryAccountsCount} compte${treasuryAccountsCount > 1 ? 's' : ''} de trésorerie actif${treasuryAccountsCount > 1 ? 's' : ''}`
                }
                href="/cash"
                tone={
                  treasuryBalance <
                  0
                    ? 'danger'
                    : 'default'
                }
              />
            ) : (
              <KpiCard
                label="Cotisations actives"
                value={
                  String(
                    activeContributionTypes
                  )
                }
                description="Configuration des cotisations"
                href="/contributions"
              />
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* RECOUVREMENT DU MOIS */}
        {/* ================================================== */}

        {canViewFinances && (
          <section className="mt-8">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

              <SectionTitle
                eyebrow="Recouvrement"
                title={
                  capitalize(
                    formatPeriod(
                      currentPeriodStart
                    )
                  )
                }
                description={
                  hasCurrentPeriodObligations
                    ? 'Situation des cotisations exigibles pour la période.'

                    : 'Aucune cotisation n’est actuellement exigible pour cette période.'
                }
              />

              <Link
                href="/contributions/collection"
                className="text-sm font-black text-emerald-700 hover:underline"
              >
                Voir le détail →
              </Link>

            </div>

            {/* =============================================== */}
            {/* INDICATEURS */}
            {/* =============================================== */}

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <MoneyMetric
                label="Montant attendu"
                value={
                  expectedAmount
                }
              />

              <MoneyMetric
                label="Déjà affecté"
                value={
                  allocatedAmount
                }
                tone="success"
              />

              <MoneyMetric
                label="Reste à recouvrer"
                value={
                  remainingAmount
                }
                tone={
                  remainingAmount >
                  0
                    ? 'warning'

                    : 'success'
                }
              />

              <CollectionRateCard
                rate={
                  collectionRate
                }
                hasObligations={
                  hasCurrentPeriodObligations
                }
              />

            </div>

            {/* =============================================== */}
            {/* SITUATION MEMBRES */}
            {/* =============================================== */}

            {hasCurrentPeriodObligations ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">

                <StatusMetric
                  label="À jour"
                  value={
                    paidMembers
                  }
                  tone="success"
                />

                <StatusMetric
                  label="Paiement partiel"
                  value={
                    partialMembers
                  }
                  tone="warning"
                />

                <StatusMetric
                  label="Non réglé"
                  value={
                    unpaidMembers
                  }
                  tone="danger"
                />

              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="font-black text-blue-950">
                    Aucune cotisation exigible pour cette période
                  </p>

                  <p className="mt-1 text-sm leading-6 text-blue-800">
                    Aucun montant
                    n&apos;est actuellement
                    attendu pour{' '}
                    {formatPeriod(
                      currentPeriodStart
                    )}.
                  </p>

                </div>

                <Link
                  href="/contributions"
                  className="shrink-0 rounded-xl bg-blue-900 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-blue-800"
                >
                  Voir les cotisations
                </Link>

              </div>
            )}

          </section>
        )}

        {/* ================================================== */}
        {/* ANALYSE SUR 6 MOIS */}
        {/* ================================================== */}

        {canViewFinances && (
          <DashboardAnalytics
            rows={
              dashboardAnalytics
            }
          />
        )}

        {/* ================================================== */}
        {/* TRESORERIE */}
        {/* ================================================== */}

        {canViewFinances && (
          <section className="mt-8 overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">

            <div className="grid gap-8 p-7 lg:grid-cols-[1.05fr_0.95fr] lg:p-9">

              {/* ============================================= */}
              {/* SOLDE */}
              {/* ============================================= */}

              <div>

                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                  Trésorerie comptabilisée
                </p>

                <p className="mt-3 text-4xl font-black">
                  {formatMoney(
                    treasuryBalance
                  )}
                </p>

                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                  Ce solde correspond
                  uniquement aux
                  opérations enregistrées
                  dans Afri Club. Les
                  fonds restent détenus
                  sur les comptes
                  externes de
                  l&apos;organisation.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">

                  <Link
                    href="/cash"
                    className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-300"
                  >
                    Ouvrir la trésorerie
                  </Link>

                  <Link
                    href="/cash/accounts"
                    className="rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                  >
                    Comptes
                  </Link>

                  {canManageTreasury && (
                    <Link
                      href="/cash/expenses/new"
                      className="rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                    >
                      + Dépense
                    </Link>
                  )}

                </div>

              </div>

              {/* ============================================= */}
              {/* DETAILS DU MOIS */}
              {/* ============================================= */}

              <div className="grid gap-4 sm:grid-cols-2">

                <DarkMetric
                  label="Entrées du mois"
                  value={
                    formatMoney(
                      monthCredits
                    )
                  }
                />

                <DarkMetric
                  label="Sorties du mois"
                  value={
                    formatMoney(
                      monthDebits
                    )
                  }
                />

                <DarkMetric
                  label="Solde du mois"
                  value={
                    formatMoney(
                      monthBalance
                    )
                  }
                />

                <DarkMetric
                  label="Paiements reçus"
                  value={`${paymentsThisMonth} · ${formatMoney(
                    paymentsAmountThisMonth
                  )}`}
                />

              </div>

            </div>

          </section>
        )}

        {/* ================================================== */}
        {/* POINTS D'ATTENTION */}
        {/* ================================================== */}

        <section className="mt-8">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <SectionTitle
              eyebrow="À surveiller"
              title="Points d’attention"
              description={
                attentionCount >
                0
                  ? `${attentionCount} point${attentionCount > 1 ? 's' : ''} mérite${attentionCount > 1 ? 'nt' : ''} votre attention.`

                  : 'Aucune alerte importante actuellement.'
              }
            />

            {attentionCount >
              0 && (
              <span className="self-start rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800 sm:self-auto">

                {attentionCount}{' '}
                alerte
                {attentionCount >
                1
                  ? 's'
                  : ''}

              </span>
            )}

          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            {/* =============================================== */}
            {/* ADHESIONS */}
            {/* =============================================== */}

            {canViewMemberships && (
              <AttentionRow
                label={
                  pendingApplications >
                  0
                    ? `${pendingApplications} demande${pendingApplications > 1 ? 's' : ''} d’adhésion en attente`

                    : 'Aucune demande d’adhésion en attente'
                }
                href="/memberships"
                important={
                  pendingApplications >
                  0
                }
              />
            )}

            {/* =============================================== */}
            {/* RECOUVREMENT */}
            {/* =============================================== */}

            {canViewFinances && (
              <AttentionRow
                label={
                  !hasCurrentPeriodObligations
                    ? `Aucune cotisation exigible pour ${formatPeriod(
                        currentPeriodStart
                      )}`

                    : remainingAmount >
                        0
                      ? `${formatMoney(
                          remainingAmount
                        )} restent à recouvrer pour ${formatPeriod(
                          currentPeriodStart
                        )}`

                      : `Le recouvrement de ${formatPeriod(
                          currentPeriodStart
                        )} est entièrement soldé`
                }
                href={
                  hasCurrentPeriodObligations
                    ? '/contributions/collection'

                    : '/contributions'
                }
                important={
                  hasCurrentPeriodObligations &&
                  remainingAmount >
                    0
                }
              />
            )}

            {/* =============================================== */}
            {/* PAIEMENTS PARTIELS */}
            {/* =============================================== */}

            {canViewFinances &&
              hasCurrentPeriodObligations &&
              partialMembers >
                0 && (
                <AttentionRow
                  label={`${partialMembers} membre${partialMembers > 1 ? 's ont' : ' a'} un règlement partiel`}
                  href="/contributions/collection?status=partial"
                  important
                />
              )}

            {/* =============================================== */}
            {/* APPELS EN BROUILLON */}
            {/* =============================================== */}

            {canManageCalls && (
              <AttentionRow
                label={
                  draftCalls >
                  0
                    ? `${draftCalls} appel${draftCalls > 1 ? 's exceptionnels sont' : ' exceptionnel est'} encore en brouillon`

                    : 'Aucun appel exceptionnel en brouillon'
                }
                href="/contributions/calls"
                important={
                  draftCalls >
                  0
                }
              />
            )}

            {/* =============================================== */}
            {/* COMPTES DE TRESORERIE */}
            {/* =============================================== */}

            {canViewFinances &&
              treasuryAccountsCount ===
                0 && (
                <AttentionRow
                  label="Aucun compte de trésorerie actif n’est encore configuré"
                  href="/cash/accounts/new"
                  important
                />
              )}

            {/* =============================================== */}
            {/* VITRINE PUBLIQUE */}
            {/* =============================================== */}

            <AttentionRow
              label={
                publicSpaceAvailable
                  ? 'La vitrine publique de l’organisation est active'

                  : 'La vitrine publique de l’organisation n’est pas encore activée'
              }
              href={
                publicSpaceAvailable
                  ? `/m/${organization.public_slug}`

                  : undefined
              }
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* ACTIVITE RECENTE */}
        {/* ================================================== */}

        <div className="mt-8 grid gap-6 xl:grid-cols-2">

          {/* ================================================= */}
          {/* MEMBRES RECENTS */}
          {/* ================================================= */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <PanelHeader
              title="Membres récents"
              description="Derniers dossiers enregistrés"
              href="/members"
            />

            {recentMembers.length ===
            0 ? (
              <EmptyState
                text="Aucun membre n’est encore enregistré."
              />
            ) : (
              <div>

                {recentMembers.map(
                  (
                    member
                  ) => (
                    <Link
                      key={
                        member.id
                      }
                      href={`/members/${member.id}`}
                      className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4 last:border-0 transition hover:bg-slate-50"
                    >

                      <div className="flex min-w-0 items-center gap-3">

                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                          style={{
                            backgroundColor:
                              'var(--brand-primary, #047857)',
                          }}
                        >
                          {initials(
                            member.first_name,
                            member.last_name
                          )}
                        </div>

                        <div className="min-w-0">

                          <p className="truncate font-black text-slate-900">
                            {
                              member.last_name
                            }{' '}
                            {
                              member.first_name
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {
                              member.member_number
                            }

                            {' · '}

                            {formatShortDate(
                              member.joined_at
                            )}
                          </p>

                        </div>

                      </div>

                      <span className="shrink-0 text-sm font-black text-emerald-700">
                        Voir →
                      </span>

                    </Link>
                  )
                )}

              </div>
            )}

          </section>

          {/* ================================================= */}
          {/* ACTIVITE FINANCIERE */}
          {/* ================================================= */}

          {canViewFinances ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              <PanelHeader
                title="Activité financière"
                description="Dernières écritures comptabilisées"
                href="/cash"
              />

              {recentLedgerEntries.length ===
              0 ? (
                <EmptyState
                  text="Aucun mouvement financier récent."
                />
              ) : (
                <div>

                  {recentLedgerEntries.map(
                    (
                      entry
                    ) => (
                      <div
                        key={
                          entry.id
                        }
                        className="flex items-center justify-between gap-5 border-b border-slate-100 px-6 py-4 last:border-0"
                      >

                        <div className="min-w-0">

                          <p className="truncate font-bold text-slate-900">
                            {
                              entry.description
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">

                            {formatShortDate(
                              entry.entry_date
                            )}

                            {' · '}

                            {categoryLabel(
                              entry.category
                            )}

                          </p>

                        </div>

                        <p
                          className={`whitespace-nowrap font-black ${
                            entry.direction ===
                            'credit'
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >

                          {entry.direction ===
                          'credit'
                            ? '+'
                            : '-'}

                          {formatMoney(
                            money(
                              entry.amount
                            )
                          )}

                        </p>

                      </div>
                    )
                  )}

                </div>
              )}

            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Votre espace
              </p>

              <h2 className="mt-2 text-xl font-black text-slate-900">
                Gestion administrative
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                Votre rôle permet de
                suivre les membres,
                les adhésions et les
                informations
                administratives de
                l&apos;organisation.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">

                <Link
                  href="/members"
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white"
                >
                  Membres
                </Link>

                {canViewMemberships && (
                  <Link
                    href="/memberships"
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700"
                  >
                    Adhésions
                  </Link>
                )}

              </div>

            </section>
          )}

        </div>

        {/* ================================================== */}
        {/* MODULES */}
        {/* ================================================== */}

        <section className="mt-8">

          <SectionTitle
            eyebrow="Modules"
            title="Accès rapide"
            description="Ouvrez directement les principales fonctions de l’organisation."
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

            <ModuleCard
              href="/members"
              title="Membres"
              description="Dossiers, matricules, coordonnées et accès personnels."
            />

            {canViewMemberships && (
              <ModuleCard
                href="/memberships"
                title="Adhésions"
                description="Demandes reçues et décisions du bureau."
              />
            )}

            <ModuleCard
              href="/contributions"
              title="Cotisations"
              description={`${activeContributionTypes} type${activeContributionTypes > 1 ? 's' : ''} de cotisation actif${activeContributionTypes > 1 ? 's' : ''}.`}
            />

            {canManageCalls && (
              <ModuleCard
                href="/contributions/calls"
                title="Appels exceptionnels"
                description="Cotisations ponctuelles et besoins exceptionnels."
              />
            )}

            {canViewFinances && (
              <ModuleCard
                href="/contributions/collection"
                title="Recouvrement"
                description="Paiements, restes, avances et situations par membre."
              />
            )}

            {canViewFinances && (
              <ModuleCard
                href="/cash"
                title="Trésorerie"
                description="Entrées, sorties, soldes et journal financier."
              />
            )}

            {canManageTreasury && (
              <ModuleCard
                href="/cash/expenses"
                title="Dépenses"
                description="Enregistrement et suivi des décaissements."
              />
            )}

            {canViewFinances && (
              <ModuleCard
                href="/cash/accounts"
                title="Comptes de trésorerie"
                description="Wave, Mobile Money, banque et caisse."
              />
            )}

            {publicSpaceAvailable && (
              <ModuleCard
                href={`/m/${organization.public_slug}`}
                title="Vitrine publique"
                description="Page publique destinée aux visiteurs et futurs membres."
              />
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* ESPACE PUBLIC */}
        {/* ================================================== */}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Espace public
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-900">
                Présence numérique de{' '}
                {shortName}
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                La vitrine publique
                présente
                l&apos;organisation et
                peut permettre aux
                futurs membres de
                déposer directement
                leur demande
                d&apos;adhésion.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">

                <StatusPill
                  active={
                    organization.public_page_enabled
                  }
                  activeText="Vitrine active"
                  inactiveText="Vitrine inactive"
                />

                <StatusPill
                  active={
                    organization.online_membership_enabled
                  }
                  activeText="Adhésion en ligne active"
                  inactiveText="Adhésion en ligne désactivée"
                />

              </div>

            </div>

            {publicSpaceAvailable ? (
              <Link
                href={`/m/${organization.public_slug}`}
                className="rounded-xl bg-slate-900 px-6 py-3 text-center text-sm font-black text-white transition hover:bg-slate-800"
              >
                Ouvrir la vitrine
              </Link>
            ) : (
              <Link
                href="/parametres"
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Configurer
              </Link>
            )}

          </div>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// TITRE DE SECTION
// ============================================================

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <div>

      <p
        className="text-xs font-black uppercase tracking-[0.16em]"
        style={{
          color:
            'var(--brand-primary, #047857)',
        }}
      >
        {eyebrow}
      </p>

      <h2 className="mt-1 text-2xl font-black text-slate-950">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      )}

    </div>
  )
}

// ============================================================
// HERO INFO
// ============================================================

function HeroInfo({
  label,
  value,
  compact = false,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm">

      <p className="text-xs font-bold uppercase tracking-wide text-white/60">
        {label}
      </p>

      <p
        className={
          compact
            ? 'mt-1 text-sm font-black text-white'
            : 'mt-1 text-xl font-black text-white'
        }
      >
        {value}
      </p>

    </div>
  )
}

// ============================================================
// CARTE KPI
// ============================================================

function KpiCard({
  label,
  value,
  description,
  href,
  tone = 'default',
}: {
  label: string
  value: string
  description: string
  href?: string

  tone?:
    | 'default'
    | 'success'
    | 'warning'
    | 'danger'
}) {
  const backgroundClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50'

      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'

        : tone === 'danger'
          ? 'border-red-200 bg-red-50'

          : 'border-slate-200 bg-white'

  const valueClass =
    tone === 'success'
      ? 'text-emerald-800'

      : tone === 'warning'
        ? 'text-amber-800'

        : tone === 'danger'
          ? 'text-red-800'

          : 'text-slate-950'

  const content = (
    <>
      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-black ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-2 text-sm leading-5 text-slate-500">
        {description}
      </p>

      {href && (
        <p
          className="mt-4 text-sm font-black"
          style={{
            color:
              'var(--brand-primary, #047857)',
          }}
        >
          Consulter →
        </p>
      )}
    </>
  )

  const className =
    `rounded-2xl border p-5 shadow-sm ${backgroundClass} ${
      href
        ? 'transition hover:-translate-y-0.5 hover:shadow-md'
        : ''
    }`

  if (href) {
    return (
      <Link
        href={href}
        className={
          className
        }
      >
        {content}
      </Link>
    )
  }

  return (
    <div
      className={
        className
      }
    >
      {content}
    </div>
  )
}

// ============================================================
// METRIQUE FINANCIERE
// ============================================================

function MoneyMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number

  tone?:
    | 'default'
    | 'success'
    | 'warning'
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-700'

      : tone === 'warning'
        ? 'text-amber-700'

        : 'text-slate-950'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-black ${valueClass}`}
      >
        {formatMoney(
          value
        )}
      </p>

    </div>
  )
}

// ============================================================
// TAUX DE RECOUVREMENT
// ============================================================

function CollectionRateCard({
  rate,
  hasObligations,
}: {
  rate:
    | number
    | null

  hasObligations:
    boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <p className="text-sm font-bold text-slate-500">
        Taux de recouvrement
      </p>

      <p className="mt-2 text-3xl font-black text-slate-950">

        {hasObligations &&
        rate !== null
          ? `${rate} %`
          : '—'}

      </p>

      {hasObligations &&
      rate !== null ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">

          <div
            className="h-full rounded-full transition-all"
            style={{
              width:
                `${Math.min(
                  100,
                  Math.max(
                    0,
                    rate
                  )
                )}%`,

              backgroundColor:
                'var(--brand-primary, #047857)',
            }}
          />

        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-slate-400">
          Aucune échéance
        </p>
      )}

    </div>
  )
}

// ============================================================
// STATUT MEMBRES
// ============================================================

function StatusMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: number

  tone:
    | 'success'
    | 'warning'
    | 'danger'
}) {
  const classes =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'

      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800'

        : 'border-red-200 bg-red-50 text-red-800'

  return (
    <div
      className={`rounded-2xl border p-5 ${classes}`}
    >

      <p className="text-sm font-black">
        {label}
      </p>

      <p className="mt-1 text-3xl font-black">
        {value}
      </p>

    </div>
  )
}

// ============================================================
// KPI SOMBRE
// ============================================================

function DarkMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">

      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-white">
        {value}
      </p>

    </div>
  )
}

// ============================================================
// LIGNE D'ATTENTION
// ============================================================

function AttentionRow({
  label,
  href,
  important = false,
}: {
  label: string
  href?: string
  important?: boolean
}) {
  const content = (
    <div className="flex items-center justify-between gap-4">

      <div className="flex min-w-0 items-center gap-3">

        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            important
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
        />

        <p
          className={`font-semibold ${
            important
              ? 'text-slate-900'
              : 'text-slate-700'
          }`}
        >
          {label}
        </p>

      </div>

      {href && (
        <span className="shrink-0 text-sm font-black text-emerald-700">
          Voir →
        </span>
      )}

    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block border-b border-slate-100 px-5 py-4 last:border-0 transition hover:bg-slate-50"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="border-b border-slate-100 px-5 py-4 last:border-0">
      {content}
    </div>
  )
}

// ============================================================
// HEADER DE PANNEAU
// ============================================================

function PanelHeader({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">

      <div>

        <h2 className="text-lg font-black text-slate-950">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>

      </div>

      <Link
        href={href}
        className="shrink-0 text-sm font-black text-emerald-700"
      >
        Tous →
      </Link>

    </div>
  )
}

// ============================================================
// ETAT VIDE
// ============================================================

function EmptyState({
  text,
}: {
  text: string
}) {
  return (
    <div className="p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  )
}

// ============================================================
// MODULE
// ============================================================

function ModuleCard({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >

      <h3 className="text-xl font-black text-slate-950 transition group-hover:text-emerald-700">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <p className="mt-5 text-sm font-black text-emerald-700">
        Ouvrir →
      </p>

    </Link>
  )
}

// ============================================================
// BADGE ETAT PUBLIC
// ============================================================

function StatusPill({
  active,
  activeText,
  inactiveText,
}: {
  active: boolean
  activeText: string
  inactiveText: string
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-black ${
        active
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      {active
        ? activeText
        : inactiveText}
    </span>
  )
}

// ============================================================
// HELPERS
// ============================================================

function money(
  value: MoneyValue
) {
  const parsed =
    Number(
      value ?? 0
    )

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0
  }

  return Math.round(
    parsed
  )
}

// ============================================================
// MONTANT
// ============================================================

function formatMoney(
  value: number
) {
  return `${new Intl.NumberFormat(
    'fr-FR',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    value
  )} FCFA`
}

// ============================================================
// PERIODE
// ============================================================

function formatPeriod(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}

// ============================================================
// DATE LONGUE
// ============================================================

function formatLongDate(
  date: Date
) {
  return capitalize(
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',

        timeZone:
          'Africa/Abidjan',
      }
    ).format(
      date
    )
  )
}

// ============================================================
// DATE COURTE
// ============================================================

function formatShortDate(
  date: string
) {
  if (
    !date
  ) {
    return '—'
  }

  const parsedDate =
    date.includes('T')
      ? new Date(
          date
        )
      : new Date(
          `${date}T00:00:00Z`
        )

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }
  ).format(
    parsedDate
  )
}

// ============================================================
// ROLE
// ============================================================

function roleLabel(
  role: OrganizationRole
) {
  const labels:
    Record<
      OrganizationRole,
      string
    > = {
      owner:
        'Responsable',

      president:
        'Président',

      treasurer:
        'Trésorier',

      secretary:
        'Secrétaire',

      auditor:
        'Auditeur',

      member:
        'Membre',
    }

  return labels[
    role
  ]
}

// ============================================================
// CATEGORIE DU JOURNAL
// ============================================================

function categoryLabel(
  category: string
) {
  const labels:
    Record<
      string,
      string
    > = {
      contribution:
        'Cotisation',

      exceptional_contribution:
        'Cotisation exceptionnelle',

      social_aid:
        'Aide sociale',

      operating:
        'Fonctionnement',

      event:
        'Événement',

      purchase:
        'Achat',

      reimbursement:
        'Remboursement',

      transport:
        'Transport',

      communication:
        'Communication',

      expense:
        'Dépense',

      expense_reversal:
        'Annulation de dépense',
    }

  return (
    labels[
      category
    ] ??
    category
  )
}

// ============================================================
// INITIALES MEMBRE
// ============================================================

function initials(
  firstName: string,
  lastName: string
) {
  return `${firstName.charAt(
    0
  )}${lastName.charAt(
    0
  )}`.toUpperCase()
}

// ============================================================
// CAPITALISER
// ============================================================

function capitalize(
  value: string
) {
  if (
    !value
  ) {
    return value
  }

  return (
    value
      .charAt(0)
      .toUpperCase() +
    value.slice(1)
  )
}

// ============================================================
// QUALITE DU RECOUVREMENT
// ============================================================

function getCollectionTone(
  rate: number
): {
  label: string

  tone:
    | 'default'
    | 'success'
    | 'warning'
    | 'danger'
} {
  if (
    rate >= 90
  ) {
    return {
      label:
        'Très bon niveau de recouvrement',

      tone:
        'success',
    }
  }

  if (
    rate >= 70
  ) {
    return {
      label:
        'Recouvrement satisfaisant',

      tone:
        'success',
    }
  }

  if (
    rate >= 50
  ) {
    return {
      label:
        'Recouvrement à surveiller',

      tone:
        'warning',
    }
  }

  return {
    label:
      'Recouvrement prioritaire',

    tone:
      'danger',
  }
}