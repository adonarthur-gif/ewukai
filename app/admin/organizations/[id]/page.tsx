import Link from 'next/link'
import {
  notFound,
} from 'next/navigation'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

import {
  deleteOrganization,
  setOrganizationStatus,
} from '../actions'

// ============================================================
// EWUKAI
// ADMINISTRATION PLATEFORME
// FICHE DETAILLEE D'UNE ORGANISATION
//
// Les opérations financières restent en lecture seule.
// Le Super-admin peut toutefois activer, désactiver ou,
// lorsqu'elle est totalement vide, supprimer une organisation.
// ============================================================

// ============================================================
// TYPES
// ============================================================

type NumberValue =
  | number
  | string
  | null
  | undefined

type OrganizationData = {
  id: string
  name: string

  short_name:
    | string
    | null

  description:
    | string
    | null

  logo_url:
    | string
    | null

  phone:
    | string
    | null

  email:
    | string
    | null

  address:
    | string
    | null

  city:
    | string
    | null

  country:
    | string
    | null

  country_code:
    | string
    | null

  currency:
    | string
    | null

  status:
    | string
    | null

  organization_type:
    | string
    | null

  legal_name:
    | string
    | null

  registration_number:
    | string
    | null

  website:
    | string
    | null

  public_slug:
    | string
    | null

  public_page_enabled:
    | boolean
    | null

  online_membership_enabled:
    | boolean
    | null

  created_by:
    | string
    | null

  created_at:
    | string
    | null

  updated_at:
    | string
    | null
}

type PublicProfileData = {
  organization_id?:
    | string
    | null

  slogan?:
    | string
    | null

  mission?:
    | string
    | null

  vision?:
    | string
    | null

  objectives?:
    | string
    | null

  public_phone?:
    | string
    | null

  public_email?:
    | string
    | null

  location_label?:
    | string
    | null

  logo_path?:
    | string
    | null

  primary_color?:
    | string
    | null

  secondary_color?:
    | string
    | null

  accent_color?:
    | string
    | null

  show_member_count?:
    | boolean
    | null

  show_leadership?:
    | boolean
    | null

  show_projects?:
    | boolean
    | null

  show_news?:
    | boolean
    | null
}

type ManagerData = {
  user_id:
    | string
    | null

  role:
    | string
    | null

  is_active:
    | boolean
    | null

  full_name:
    | string
    | null

  phone:
    | string
    | null

  created_at:
    | string
    | null
}

type OrganizationStats = {
  total_members:
    NumberValue

  active_members:
    NumberValue

  pending_memberships:
    NumberValue

  active_contribution_types:
    NumberValue

  active_treasury_accounts:
    NumberValue

  confirmed_payments_count:
    NumberValue

  confirmed_payments_total:
    NumberValue

  treasury_credit_total:
    NumberValue

  treasury_debit_total:
    NumberValue

  treasury_balance:
    NumberValue
}

type OrganizationDetail = {
  organization:
    OrganizationData | null

  public_profile:
    PublicProfileData

  managers:
    ManagerData[]

  stats:
    OrganizationStats
}

type SubscriptionPlanSummary = {
  code?: string | null
  name?: string | null
}

type SubscriptionSummary = {
  status?: string | null
  plan?: SubscriptionPlanSummary | null
}

type SubscriptionHistorySummary = {
  status?: string | null
  plan_code?: string | null
  plan_name?: string | null
}

type PlatformSubscriptionDetail = {
  current_subscription?: SubscriptionSummary | null
  history?: SubscriptionHistorySummary[] | null
}

type SubscriptionCollectionRow = {
  organization_id: string
  invoice_id: string
  invoice_number: string
  plan_code?: string | null
  plan_name?: string | null
  effective_status: string
  currency: string
  total_xof: NumberValue
  amount_remaining_xof: NumberValue
  due_at?: string | null
}

type PageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    statusUpdated?: string
    error?: string
  }>
}

// ============================================================
// BRANDING
// ============================================================

const DEFAULT_PRIMARY =
  '#047857'

const DEFAULT_SECONDARY =
  '#0F172A'

const DEFAULT_ACCENT =
  '#ECFDF5'

const ORGANIZATION_LOGO_BUCKET =
  process.env
    .NEXT_PUBLIC_ORGANIZATION_LOGO_BUCKET
    ?.trim() ||
  'organization-logos'

// ============================================================
// PAGE
// ============================================================

export default async function PlatformOrganizationDetailPage({
  params,
  searchParams,
}: PageProps) {
  const {
    id,
  } =
    await params

  const query =
    await searchParams

  // ==========================================================
  // 1. SUPER ADMIN
  // ==========================================================

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  // ==========================================================
  // 2. VALIDATION ID
  // ==========================================================

  if (
    !id ||
    !isUuid(id)
  ) {
    notFound()
  }

  // ==========================================================
  // 3. DONNEES
  // ==========================================================

  const [
    organizationResult,
    subscriptionResult,
    collectionResult,
  ] =
    await Promise.all([
      supabase.rpc(
        'get_platform_organization_detail',
        {
          target_organization_id:
            id,
        }
      ),

      supabase.rpc(
        'get_platform_subscription_detail',
        {
          target_organization_id:
            id,
        }
      ),

      supabase.rpc(
        'list_platform_subscription_collection'
      ),
    ])

  if (
    organizationResult.error
  ) {
    console.error(
      'EWUKAI - admin organization detail:',
      organizationResult.error
    )

    if (
      organizationResult.error.message
        ?.toLowerCase()
        .includes(
          'organization not found'
        )
    ) {
      notFound()
    }

    throw new Error(
      'Impossible de charger la fiche de cette organisation.'
    )
  }

  if (
    subscriptionResult.error
  ) {
    console.error(
      'EWUKAI - organization subscription summary:',
      subscriptionResult.error
    )
  }

  if (
    collectionResult.error
  ) {
    console.error(
      'EWUKAI - organization billing summary:',
      collectionResult.error
    )
  }

  if (
    !organizationResult.data
  ) {
    notFound()
  }

  const detail =
    organizationResult.data as OrganizationDetail

  const organization =
    detail.organization

  if (
    !organization
  ) {
    notFound()
  }

  const publicProfile =
    detail.public_profile ??
    {}

  const managers =
    detail.managers ??
    []

  const stats =
    detail.stats ?? {
      total_members: 0,
      active_members: 0,
      pending_memberships: 0,
      active_contribution_types: 0,
      active_treasury_accounts: 0,
      confirmed_payments_count: 0,
      confirmed_payments_total: 0,
      treasury_credit_total: 0,
      treasury_debit_total: 0,
      treasury_balance: 0,
    }

  const subscriptionDetail =
    subscriptionResult.data
      ? subscriptionResult.data as PlatformSubscriptionDetail
      : null

  const currentSubscription =
    subscriptionDetail
      ?.current_subscription ??
    null

  const rawSubscriptionHistory =
    subscriptionDetail
      ?.history

  const subscriptionHistory =
    Array.isArray(
      rawSubscriptionHistory
    )
      ? rawSubscriptionHistory
      : []

  const pendingSubscription =
    subscriptionHistory.find(
      item =>
        item.status ===
        'pending_payment'
    ) ??
    null

  const collectionRows =
    (
      Array.isArray(
        collectionResult.data
      )
        ? collectionResult.data
        : []
    ) as SubscriptionCollectionRow[]

  const pendingInvoice =
    collectionRows.find(
      item =>
        item.organization_id ===
        id
    ) ??
    null

  // ==========================================================
  // 4. BRANDING
  // ==========================================================

  const primaryColor =
    safeColor(
      publicProfile
        .primary_color,
      DEFAULT_PRIMARY
    )

  const secondaryColor =
    safeColor(
      publicProfile
        .secondary_color,
      DEFAULT_SECONDARY
    )

  const accentColor =
    safeColor(
      publicProfile
        .accent_color,
      DEFAULT_ACCENT
    )

  // ==========================================================
  // 5. LOGO
  // ==========================================================

  let logoUrl =
    organization.logo_url
      ?.trim() ||
    null

  const logoPath =
    publicProfile
      .logo_path
      ?.trim() ??
    ''

  if (
    logoPath
  ) {
    if (
      logoPath.startsWith(
        'https://'
      ) ||
      logoPath.startsWith(
        'http://'
      )
    ) {
      logoUrl =
        logoPath
    } else {
      const {
        data:
          logoData,
      } =
        supabase.storage
          .from(
            ORGANIZATION_LOGO_BUCKET
          )
          .getPublicUrl(
            logoPath
          )

      if (
        logoData
          ?.publicUrl
      ) {
        logoUrl =
          logoData.publicUrl
      }
    }
  }

  // ==========================================================
  // 6. STATS
  // ==========================================================

  const totalMembers =
    numberValue(
      stats.total_members
    )

  const activeMembers =
    numberValue(
      stats.active_members
    )

  const pendingMemberships =
    numberValue(
      stats.pending_memberships
    )

  const activeContributionTypes =
    numberValue(
      stats.active_contribution_types
    )

  const activeTreasuryAccounts =
    numberValue(
      stats.active_treasury_accounts
    )

  const confirmedPaymentsCount =
    numberValue(
      stats.confirmed_payments_count
    )

  const confirmedPaymentsTotal =
    numberValue(
      stats.confirmed_payments_total
    )

  const treasuryCredits =
    numberValue(
      stats.treasury_credit_total
    )

  const treasuryDebits =
    numberValue(
      stats.treasury_debit_total
    )

  const treasuryBalance =
    numberValue(
      stats.treasury_balance
    )

  const activeMemberRate =
    totalMembers > 0
      ? Math.round(
          (
            activeMembers /
            totalMembers
          ) *
            100
        )
      : null

  const publicPageHref =
    organization.public_slug
      ? `/m/${encodeURIComponent(
          organization.public_slug
        )}`
      : null

  const isActive =
    organization.status ===
    'active'

  const isInactive =
    organization.status ===
    'inactive'

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ==================================================== */}
      {/* HERO */}
      {/* ==================================================== */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">

          {/* RETOUR */}

          <Link
            href="/admin/organizations"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900"
          >
            <span aria-hidden="true">
              ←
            </span>

            Organisations
          </Link>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

            {/* IDENTITE */}

            <div className="flex min-w-0 items-start gap-4">

              {logoUrl ? (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">

                  <img
                    src={
                      logoUrl
                    }
                    alt={`Logo ${organization.name}`}
                    className="h-full w-full object-contain"
                  />

                </div>
              ) : (
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-sm"
                  style={{
                    backgroundColor:
                      primaryColor,
                  }}
                >
                  {getInitials(
                    organization.short_name ||
                      organization.name
                  )}
                </div>
              )}

              <div className="min-w-0">

                <div className="flex flex-wrap items-center gap-2">

                  <StatusBadge
                    status={
                      organization.status
                    }
                  />

                  {organization.organization_type && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
                      {formatOrganizationType(
                        organization.organization_type
                      )}
                    </span>
                  )}

                </div>

                <h1 className="mt-3 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">

                  {
                    organization.name
                  }

                </h1>

                {organization.short_name && (
                  <p className="mt-1 text-sm font-black text-slate-500">
                    {
                      organization.short_name
                    }
                  </p>
                )}

                {publicProfile.slogan && (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    “
                    {
                      publicProfile.slogan
                    }
                    ”
                  </p>
                )}

              </div>

            </div>

            {/* ACTIONS */}

            <div className="flex shrink-0 flex-wrap gap-2">

              {publicPageHref &&
                organization.public_page_enabled && (
                  <Link
                    href={
                      publicPageHref
                    }
                    target="_blank"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Voir la page publique
                  </Link>
                )}

              <form
                action={
                  setOrganizationStatus
                }
              >
                <input
                  type="hidden"
                  name="organizationId"
                  value={
                    organization.id
                  }
                />

                <input
                  type="hidden"
                  name="nextStatus"
                  value={
                    isActive
                      ? 'inactive'
                      : 'active'
                  }
                />

                <input
                  type="hidden"
                  name="returnTo"
                  value={`/admin/organizations/${organization.id}`}
                />

                <button
                  type="submit"
                  className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${
                    isActive
                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {isActive
                    ? 'Désactiver'
                    : 'Réactiver'}
                </button>
              </form>

              <Link
                href="/admin/organizations"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Toutes les organisations
              </Link>

            </div>

          </div>

        </div>

      </section>

      {/* ==================================================== */}
      {/* CONTENU */}
      {/* ==================================================== */}

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

        {query.statusUpdated && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
            {query.statusUpdated ===
            'active'
              ? 'L’organisation a été réactivée. Les accès précédemment actifs ont été restaurés.'
              : 'L’organisation a été désactivée. Ses accès utilisateurs ont été suspendus et son historique est conservé.'}
          </section>
        )}

        {query.error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {query.error}
          </section>
        )}

        {/* ================================================== */}
        {/* SUPERVISION PLATEFORME */}
        {/* ================================================== */}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">

          <div className="flex gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-black text-blue-700">
              i
            </div>

            <div>
              <p className="font-black text-blue-950">
                Consultation Super-administrateur
              </p>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                Les informations financières restent en lecture seule. Le Super-administrateur peut en revanche activer ou désactiver l&apos;organisation. La désactivation suspend les accès sans effacer les données.
              </p>
            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* ABONNEMENT EWUKAI */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Abonnement EWUKAI
              </p>
              <h2 className="mt-2 text-lg font-black text-slate-950">
                Situation commerciale de l&apos;organisation
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Suivez la formule active, les demandes de changement et les factures ouvertes sans modifier les fonds de l&apos;organisation.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/subscriptions/${organization.id}`}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Gérer l&apos;abonnement
              </Link>

              {pendingInvoice && (
                <Link
                  href={`/admin/billing/${pendingInvoice.invoice_id}`}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
                >
                  Voir la facture
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Formule actuelle"
              value={
                currentSubscription
                  ?.plan
                  ?.name ||
                'Aucune'
              }
              note={
                formatAdminSubscriptionStatus(
                  currentSubscription?.status ??
                  null
                )
              }
            />

            <KpiCard
              label="Formule demandée"
              value={
                pendingSubscription?.plan_name ||
                pendingInvoice?.plan_name ||
                'Aucune'
              }
              note={
                pendingSubscription ||
                pendingInvoice
                  ? 'En attente de paiement'
                  : 'Aucune demande ouverte'
              }
            />

            <KpiCard
              label="Montant à régler"
              value={
                pendingInvoice
                  ? formatMoney(
                      numberValue(
                        pendingInvoice.amount_remaining_xof
                      ),
                      pendingInvoice.currency
                    )
                  : '0 FCFA'
              }
              note={
                pendingInvoice
                  ? pendingInvoice.invoice_number
                  : 'Aucune facture ouverte'
              }
            />

            <KpiCard
              label="État du règlement"
              value={
                pendingInvoice?.effective_status ===
                'overdue'
                  ? 'En retard'
                  : pendingInvoice
                    ? 'À payer'
                    : 'À jour'
              }
              note={
                pendingInvoice?.due_at
                  ? `Échéance ${formatDate(
                      pendingInvoice.due_at
                    )}`
                  : 'Aucune échéance ouverte'
              }
            />
          </div>
        </section>

        {/* ================================================== */}
        {/* KPI */}
        {/* ================================================== */}

        <section>

          <SectionHeader
            eyebrow="Vue d’ensemble"
            title="Indicateurs de l’organisation"
            description="Situation générale enregistrée dans EWUKAI."
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <KpiCard
              label="Membres"
              value={formatNumber(
                totalMembers
              )}
              note={
                activeMemberRate ===
                null
                  ? 'Aucun membre enregistré'
                  : `${activeMembers.toLocaleString(
                      'fr-FR'
                    )} actifs · ${activeMemberRate}%`
              }
            />

            <KpiCard
              label="Demandes en attente"
              value={formatNumber(
                pendingMemberships
              )}
              note="Adhésions à traiter"
            />

            <KpiCard
              label="Types de cotisation"
              value={formatNumber(
                activeContributionTypes
              )}
              note="Cotisations actives"
            />

            <KpiCard
              label="Comptes de trésorerie"
              value={formatNumber(
                activeTreasuryAccounts
              )}
              note="Comptes actifs"
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* FINANCE */}
        {/* ================================================== */}

        <section>

          <SectionHeader
            eyebrow="Supervision financière"
            title="Synthèse en lecture seule"
            description="Les montants sont issus des paiements confirmés et des mouvements de trésorerie enregistrés."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <FinanceCard
              label="Paiements confirmés"
              value={formatMoney(
                confirmedPaymentsTotal,
                organization.currency
              )}
              note={`${formatNumber(
                confirmedPaymentsCount
              )} paiement(s)`}
            />

            <FinanceCard
              label="Crédits enregistrés"
              value={formatMoney(
                treasuryCredits,
                organization.currency
              )}
              note="Entrées de trésorerie"
            />

            <FinanceCard
              label="Débits enregistrés"
              value={formatMoney(
                treasuryDebits,
                organization.currency
              )}
              note="Sorties de trésorerie"
            />

            <FinanceCard
              label="Solde comptable"
              value={formatMoney(
                treasuryBalance,
                organization.currency
              )}
              note="Crédits moins débits"
              emphasized
            />

          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            EWUKAI assure le suivi et la
            traçabilité des opérations enregistrées.
            La plateforme ne constitue pas le
            détenteur des fonds de l&apos;organisation.
          </p>

        </section>

        {/* ================================================== */}
        {/* DEUX COLONNES */}
        {/* ================================================== */}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">

          {/* ================================================ */}
          {/* INFORMATIONS ORGANISATION */}
          {/* ================================================ */}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <CardHeader
              title="Informations générales"
              description="Identité administrative et coordonnées de l’organisation."
            />

            <div className="grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2">

              <InfoItem
                label="Dénomination"
                value={
                  organization.name
                }
              />

              <InfoItem
                label="Sigle"
                value={
                  organization.short_name
                }
              />

              <InfoItem
                label="Dénomination légale"
                value={
                  organization.legal_name
                }
              />

              <InfoItem
                label="N° d’enregistrement"
                value={
                  organization.registration_number
                }
              />

              <InfoItem
                label="Téléphone"
                value={
                  organization.phone
                }
              />

              <InfoItem
                label="E-mail"
                value={
                  organization.email
                }
              />

              <InfoItem
                label="Ville"
                value={
                  organization.city
                }
              />

              <InfoItem
                label="Pays"
                value={
                  organization.country ||
                  organization.country_code
                }
              />

              <InfoItem
                label="Adresse"
                value={
                  organization.address
                }
                wide
              />

              <InfoItem
                label="Site internet"
                value={
                  organization.website
                }
                wide
              />

              <InfoItem
                label="Devise"
                value={
                  organization.currency ||
                  'XOF'
                }
              />

              <InfoItem
                label="Créée le"
                value={
                  formatDate(
                    organization.created_at
                  )
                }
              />

              <InfoItem
                label="Dernière mise à jour"
                value={
                  formatDate(
                    organization.updated_at
                  )
                }
              />

            </div>

          </section>

          {/* ================================================ */}
          {/* PAGE PUBLIQUE */}
          {/* ================================================ */}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <CardHeader
              title="Vitrine publique"
              description="Configuration actuellement visible ou prévue pour le public."
            />

            <div className="space-y-5 p-6">

              <BooleanRow
                label="Page publique"
                enabled={
                  Boolean(
                    organization.public_page_enabled
                  )
                }
              />

              <BooleanRow
                label="Adhésion en ligne"
                enabled={
                  Boolean(
                    organization.online_membership_enabled
                  )
                }
              />

              <BooleanRow
                label="Afficher le nombre de membres"
                enabled={
                  Boolean(
                    publicProfile.show_member_count
                  )
                }
              />

              <BooleanRow
                label="Afficher les dirigeants"
                enabled={
                  Boolean(
                    publicProfile.show_leadership
                  )
                }
              />

              <BooleanRow
                label="Afficher les projets"
                enabled={
                  Boolean(
                    publicProfile.show_projects
                  )
                }
              />

              <BooleanRow
                label="Afficher les actualités"
                enabled={
                  Boolean(
                    publicProfile.show_news
                  )
                }
              />

              <div className="border-t border-slate-100 pt-5">

                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Adresse publique
                </p>

                {organization.public_slug ? (
                  <p className="mt-2 break-all text-sm font-bold text-slate-700">
                    /m/
                    {
                      organization.public_slug
                    }
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    Aucun slug public configuré.
                  </p>
                )}

              </div>

            </div>

          </section>

        </div>

        {/* ================================================== */}
        {/* RESPONSABLES */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Équipe de gestion"
            description={`${managers.length} responsable(s) actif(s) identifié(s).`}
          />

          {managers.length ===
          0 ? (
            <div className="p-8 text-center">

              <p className="font-black text-slate-700">
                Aucun responsable actif
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Aucun rôle de gestion actif
                n&apos;a été trouvé pour cette
                organisation.
              </p>

            </div>
          ) : (
            <div className="divide-y divide-slate-100">

              {managers.map(
                (
                  manager,
                  index
                ) => {
                  const managerName =
                    manager.full_name
                      ?.trim() ||
                    'Responsable sans nom renseigné'

                  return (
                    <div
                      key={`${manager.user_id ?? 'manager'}-${index}`}
                      className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div className="flex items-center gap-4">

                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                          style={{
                            backgroundColor:
                              primaryColor,
                          }}
                        >
                          {getInitials(
                            managerName
                          )}
                        </div>

                        <div>

                          <p className="font-black text-slate-900">
                            {
                              managerName
                            }
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">

                            <span
                              className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase"
                              style={{
                                backgroundColor:
                                  accentColor,

                                color:
                                  primaryColor,
                              }}
                            >
                              {formatRole(
                                manager.role
                              )}
                            </span>

                            {manager.phone && (
                              <span className="text-xs font-medium text-slate-500">
                                {
                                  manager.phone
                                }
                              </span>
                            )}

                          </div>

                        </div>

                      </div>

                      <div className="text-left sm:text-right">

                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                          Accès depuis
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          {formatDate(
                            manager.created_at
                          )}
                        </p>

                      </div>

                    </div>
                  )
                }
              )}

            </div>
          )}

        </section>

        {/* ================================================== */}
        {/* PROFIL INSTITUTIONNEL */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Présentation institutionnelle"
            description="Contenus configurés pour présenter l’organisation."
          />

          <div className="grid gap-6 p-6 lg:grid-cols-2">

            <TextBlock
              title="Mission"
              value={
                publicProfile.mission
              }
            />

            <TextBlock
              title="Vision"
              value={
                publicProfile.vision
              }
            />

            <TextBlock
              title="Objectifs"
              value={
                publicProfile.objectives
              }
            />

            <TextBlock
              title="Description"
              value={
                organization.description
              }
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* GESTION DE L'ORGANISATION */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Gestion de l’organisation"
            description="Activation, suspension des accès et suppression définitive sécurisée."
          />

          <div className="p-6">

            <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <p className="font-black text-slate-900">
                  {isActive
                    ? 'Organisation active'
                    : 'Organisation désactivée'}
                </p>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  {isActive
                    ? 'La désactivation conserve toutes les données mais suspend temporairement les accès de cette organisation.'
                    : 'La réactivation restaure les accès qui étaient actifs avant la désactivation.'}
                </p>
              </div>

              <form
                action={
                  setOrganizationStatus
                }
              >
                <input
                  type="hidden"
                  name="organizationId"
                  value={
                    organization.id
                  }
                />

                <input
                  type="hidden"
                  name="nextStatus"
                  value={
                    isActive
                      ? 'inactive'
                      : 'active'
                  }
                />

                <input
                  type="hidden"
                  name="returnTo"
                  value={`/admin/organizations/${organization.id}`}
                />

                <button
                  type="submit"
                  className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                    isActive
                      ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  {isActive
                    ? 'Désactiver l’organisation'
                    : 'Réactiver l’organisation'}
                </button>
              </form>

            </div>

            {isInactive && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">

                <p className="font-black text-red-900">
                  Suppression définitive
                </p>

                <p className="mt-2 text-sm leading-6 text-red-800">
                  EWUKAI n&apos;autorise cette suppression que si l&apos;organisation est réellement vide : aucun membre, aucune cotisation, aucun paiement, aucune opération de trésorerie, aucune demande et aucun historique de facturation.
                </p>

                <form
                  action={
                    deleteOrganization
                  }
                  className="mt-4 grid gap-3 sm:max-w-md"
                >
                  <input
                    type="hidden"
                    name="organizationId"
                    value={
                      organization.id
                    }
                  />

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-red-800">
                      Confirmer avec SUPPRIMER
                    </span>

                    <input
                      name="confirmation"
                      type="text"
                      autoComplete="off"
                      placeholder="SUPPRIMER"
                      className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10"
                    />
                  </label>

                  <button
                    type="submit"
                    className="rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white transition hover:bg-red-800"
                  >
                    Supprimer définitivement
                  </button>
                </form>

              </div>
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* BRANDING */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Identité visuelle"
            description="Couleurs définies par l’organisation."
          />

          <div className="flex flex-wrap gap-5 p-6">

            <ColorSample
              label="Couleur principale"
              value={
                primaryColor
              }
            />

            <ColorSample
              label="Couleur secondaire"
              value={
                secondaryColor
              }
            />

            <ColorSample
              label="Couleur d’accent"
              value={
                accentColor
              }
            />

          </div>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// COMPOSANTS
// ============================================================

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>

      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
        {
          eyebrow
        }
      </p>

      <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
        {
          title
        }
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        {
          description
        }
      </p>

    </div>
  )
}

function CardHeader({
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

function KpiCard({
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
        {
          label
        }
      </p>

      <p className="mt-3 text-3xl font-black text-slate-950">
        {
          value
        }
      </p>

      <p className="mt-2 text-xs font-medium text-slate-500">
        {
          note
        }
      </p>

    </div>
  )
}

function FinanceCard({
  label,
  value,
  note,
  emphasized = false,
}: {
  label: string
  value: string
  note: string
  emphasized?: boolean
}) {
  return (
    <div
      className={
        emphasized
          ? 'rounded-2xl bg-slate-950 p-5 text-white shadow-sm'
          : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
      }
    >

      <p
        className={
          emphasized
            ? 'text-xs font-black uppercase tracking-wide text-slate-400'
            : 'text-xs font-black uppercase tracking-wide text-slate-400'
        }
      >
        {
          label
        }
      </p>

      <p
        className={
          emphasized
            ? 'mt-3 text-2xl font-black text-white'
            : 'mt-3 text-2xl font-black text-slate-950'
        }
      >
        {
          value
        }
      </p>

      <p
        className={
          emphasized
            ? 'mt-2 text-xs font-medium text-slate-400'
            : 'mt-2 text-xs font-medium text-slate-500'
        }
      >
        {
          note
        }
      </p>

    </div>
  )
}

function InfoItem({
  label,
  value,
  wide = false,
}: {
  label: string
  value:
    | string
    | null
    | undefined
  wide?: boolean
}) {
  return (
    <div
      className={
        wide
          ? 'sm:col-span-2'
          : ''
      }
    >

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-1.5 break-words text-sm font-semibold leading-6 text-slate-800">
        {value?.trim()
          ? value
          : 'Non renseigné'}
      </p>

    </div>
  )
}

function BooleanRow({
  label,
  enabled,
}: {
  label: string
  enabled: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">

      <p className="text-sm font-bold text-slate-700">
        {
          label
        }
      </p>

      <span
        className={
          enabled
            ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700'
            : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500'
        }
      >
        {enabled
          ? 'Activé'
          : 'Désactivé'}
      </span>

    </div>
  )
}

function TextBlock({
  title,
  value,
}: {
  title: string
  value:
    | string
    | null
    | undefined
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          title
        }
      </p>

      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
        {value?.trim()
          ? value
          : 'Aucune information renseignée.'}
      </p>

    </div>
  )
}

function ColorSample({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-[190px] rounded-2xl border border-slate-200 p-4">

      <div className="flex items-center gap-3">

        <span
          className="h-10 w-10 shrink-0 rounded-xl border border-black/5 shadow-sm"
          style={{
            backgroundColor:
              value,
          }}
        />

        <div>

          <p className="text-xs font-black text-slate-700">
            {
              label
            }
          </p>

          <p className="mt-1 font-mono text-xs font-semibold uppercase text-slate-400">
            {
              value
            }
          </p>

        </div>

      </div>

    </div>
  )
}

function StatusBadge({
  status,
}: {
  status:
    | string
    | null
}) {
  const normalized =
    status
      ?.toLowerCase()
      .trim() ??
    ''

  if (
    normalized ===
    'active'
  ) {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
        Active
      </span>
    )
  }

  if (
    normalized ===
      'suspended' ||
    normalized ===
      'inactive'
  ) {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
        {capitalize(
          normalized
        )}
      </span>
    )
  }

  return (
    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
      {normalized
        ? capitalize(
            normalized
          )
        : 'Statut inconnu'}
    </span>
  )
}

// ============================================================
// HELPERS
// ============================================================

function numberValue(
  value: NumberValue
) {
  const result =
    Number(value ?? 0)

  return Number.isFinite(
    result
  )
    ? result
    : 0
}

function formatNumber(
  value: number
) {
  return value.toLocaleString(
    'fr-FR'
  )
}

function formatMoney(
  value: number,
  currency:
    | string
    | null
    | undefined
) {
  const normalizedCurrency =
    currency
      ?.trim()
      .toUpperCase() ||
    'XOF'

  if (
    normalizedCurrency ===
    'XOF'
  ) {
    return `${value.toLocaleString(
      'fr-FR'
    )} FCFA`
  }

  try {
    return new Intl
      .NumberFormat(
        'fr-FR',
        {
          style:
            'currency',

          currency:
            normalizedCurrency,

          maximumFractionDigits:
            0,
        }
      )
      .format(
        value
      )
  } catch {
    return `${value.toLocaleString(
      'fr-FR'
    )} ${normalizedCurrency}`
  }
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (
    !value
  ) {
    return 'Non renseigné'
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
          'long',

        year:
          'numeric',
      }
    )
    .format(
      date
    )
}

function formatAdminSubscriptionStatus(
  status:
    | string
    | null
    | undefined
) {
  switch (status) {
    case 'active':
      return 'Actif'

    case 'trialing':
      return 'Essai'

    case 'pending_payment':
      return 'En attente de paiement'

    case 'past_due':
      return 'En retard'

    case 'cancelled':
      return 'Annulé'

    case 'expired':
      return 'Expiré'

    case 'replaced':
      return 'Remplacé'

    default:
      return 'Sans abonnement actif'
  }
}

function formatRole(
  role:
    | string
    | null
    | undefined
) {
  switch (
    role
  ) {
    case 'owner':
      return 'Responsable'

    case 'president':
      return 'Président'

    case 'treasurer':
      return 'Trésorier'

    case 'secretary':
      return 'Secrétaire'

    case 'auditor':
      return 'Auditeur'

    default:
      return role
        ? capitalize(
            role.replace(
              /_/g,
              ' '
            )
          )
        : 'Responsable'
  }
}

function formatOrganizationType(
  value: string
) {
  switch (
    value
      .toLowerCase()
      .trim()
  ) {
    case 'mutual':
    case 'mutuelle':
      return 'Mutuelle'

    case 'association':
      return 'Association'

    case 'tontine':
      return 'Tontine'

    case 'cooperative':
    case 'coopérative':
      return 'Coopérative'

    default:
      return value
        .replace(
          /_/g,
          ' '
        )
  }
}

function getInitials(
  value: string
) {
  const words =
    value
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      )

  if (
    words.length ===
    0
  ) {
    return 'AC'
  }

  if (
    words.length ===
    1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase()
  }

  return words
    .slice(
      0,
      2
    )
    .map(
      (
        word
      ) =>
        word.charAt(
          0
        )
    )
    .join(
      ''
    )
    .toUpperCase()
}

function safeColor(
  value:
    | string
    | null
    | undefined,
  fallback: string
) {
  if (
    value &&
    /^#[0-9A-Fa-f]{6}$/.test(
      value
    )
  ) {
    return value
  }

  return fallback
}

function capitalize(
  value: string
) {
  if (
    !value
  ) {
    return value
  }

  return (
    value.charAt(
      0
    ).toUpperCase() +
    value.slice(
      1
    )
  )
}

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}