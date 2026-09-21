import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

// ============================================================
// TYPES
// ============================================================

type PageProps = {
  searchParams: Promise<{
    registered?: string
    activated?: string
    organization?: string
  }>
}

type MoneyValue =
  | number
  | string
  | null

type MemberSpaceOption = {
  member_id: string
  organization_id: string
  organization_name: string
  organization_short_name:
    | string
    | null
  member_number: string
  first_name: string
  last_name: string
  member_status: string
}

type MemberData = {
  id: string
  organization_id: string
  member_number: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  profession: string | null
  address: string | null
  joined_at: string
  status: string
}

type OrganizationData = {
  id: string
  name: string
  short_name: string | null
  public_slug: string | null
}

type SummaryData = {
  total_expected: MoneyValue
  due_to_date: MoneyValue
  paid_total: MoneyValue
  remaining_due: MoneyValue
  overdue_amount: MoneyValue
  advance_amount: MoneyValue
  future_remaining: MoneyValue

  obligation_count:
    | number
    | string
}

type ObligationData = {
  id: string

  source_kind:
    | 'regular'
    | 'exceptional'
    | string

  name: string

  period_start: string
  due_date: string

  amount_due: MoneyValue
  amount_paid: MoneyValue
  remaining_amount: MoneyValue

  status:
    | 'open'
    | 'partial'
    | 'paid'
    | 'waived'
    | 'cancelled'
    | string
}

type PaymentData = {
  id: string

  amount: MoneyValue

  payment_method: string

  payment_reference:
    | string
    | null

  receipt_number:
    | string
    | null

  notes:
    | string
    | null

  paid_at: string

  allocation_count:
    | number
    | string

  allocated_amount:
    MoneyValue
}

type FinancialSpace = {
  member: MemberData
  organization: OrganizationData
  summary: SummaryData
  obligations: ObligationData[]
  payments: PaymentData[]
}

type BrandingProfile = {
  logo_path:
    | string
    | null

  primary_color:
    | string
    | null

  secondary_color:
    | string
    | null

  accent_color:
    | string
    | null

  slogan:
    | string
    | null
}

type PaymentMethod = {
  id: string

  provider: string

  label: string

  account_name:
    | string
    | null

  account_number:
    | string
    | null

  merchant_code:
    | string
    | null

  bank_name:
    | string
    | null

  instructions:
    | string
    | null

  accepts_remote_payment:
    | boolean
    | null

  display_order:
    | number
    | null
}

type MemberAutomationReminder = {
  reminder_id: string
  obligation_id: string
  reminder_type:
    | 'before_due'
    | 'due_today'
    | 'overdue'
    | string
  due_date: string
  scheduled_for: string
  amount_remaining:
    | number
    | string
  title: string
  message: string
  generated_at: string
}
// ============================================================
// ROLES DE GESTION
// ============================================================

const MANAGEMENT_ROLES =
  new Set([
    'owner',
    'president',
    'treasurer',
    'secretary',
    'auditor',
  ])

// ============================================================
// PAGE
// ============================================================

export default async function MySpacePage({
  searchParams,
}: PageProps) {
  const query =
    await searchParams

  const supabase =
    await createClient()

  // ==========================================================
  // AUTHENTIFICATION
  // ==========================================================

  const {
    data: authData,
    error: authError,
  } =
    await supabase.auth
      .getClaims()

  const userId =
    authData?.claims?.sub

  if (
    authError ||
    !userId
  ) {
    redirect('/login')
  }

  // ==========================================================
  // LISTE DES ESPACES MEMBRE
  // ==========================================================

  const {
    data: memberSpacesRaw,
    error: memberSpacesError,
  } =
    await supabase.rpc(
      'list_my_member_spaces'
    )

  if (memberSpacesError) {
    console.error(
      'MEMBER SPACE - list spaces:',
      memberSpacesError
    )

    throw new Error(
      'Impossible de charger vos espaces membre.'
    )
  }

  const memberSpaces =
    Array.isArray(
      memberSpacesRaw
    )
      ? (
          memberSpacesRaw as
            MemberSpaceOption[]
        )
      : []

  // ==========================================================
  // AUCUN DOSSIER MEMBRE
  // ==========================================================

  if (
    memberSpaces.length ===
    0
  ) {
    redirect('/dashboard')
  }

  // ==========================================================
  // ORGANISATION DEMANDEE
  // ==========================================================

  const requestedOrganizationId =
    typeof query.organization ===
    'string'
      ? query.organization.trim()
      : ''

  let selectedSpace:
    | MemberSpaceOption
    | undefined

  if (
    requestedOrganizationId
  ) {
    selectedSpace =
      memberSpaces.find(
        (space) =>
          space.organization_id ===
          requestedOrganizationId
      )

    if (!selectedSpace) {
      redirect('/my-space')
    }
  }

  // ==========================================================
  // UN SEUL ESPACE
  // ==========================================================

  if (
    !selectedSpace &&
    memberSpaces.length ===
      1
  ) {
    selectedSpace =
      memberSpaces[0]
  }

  // ==========================================================
  // PLUSIEURS ESPACES
  // ==========================================================

  if (
    !selectedSpace &&
    memberSpaces.length >
      1
  ) {
    return (
      <MemberSpaceSelector
        spaces={
          memberSpaces
        }
      />
    )
  }

  if (!selectedSpace) {
    redirect('/dashboard')
  }

  // ==========================================================
  // ESPACE FINANCIER PERSONNEL
  // ==========================================================

  const {
    data: financialData,
    error: financialError,
  } =
    await supabase.rpc(
      'get_my_member_financial_space',
      {
        target_organization_id:
          selectedSpace.organization_id,
      }
    )

  if (financialError) {
    console.error(
      'MEMBER SPACE - financial data:',
      financialError
    )

    throw new Error(
      'Impossible de charger votre espace membre.'
    )
  }

  if (!financialData) {
    redirect('/my-space')
  }

  const space =
    financialData as FinancialSpace

  const member =
    space.member

  const organization =
    space.organization

  const summary =
    space.summary

  const obligations =
    space.obligations ??
    []

  const payments =
    space.payments ??
    []

  // ==========================================================
  // VERIFICATION ORGANISATION
  // ==========================================================

  if (
    organization.id !==
    selectedSpace.organization_id
  ) {
    console.error(
      'MEMBER SPACE - organization mismatch'
    )

    redirect('/my-space')
  }

  // ==========================================================
  // DROITS DE GESTION
  // ==========================================================

  // ==========================================================
  // RAPPELS AUTOMATIQUES
  // ==========================================================

  const {
    data: automationRemindersRaw,
    error: automationRemindersError,
  } =
    await supabase.rpc(
      'list_my_automation_reminders',
      {
        target_organization_id:
          organization.id,

        target_limit:
          20,
      }
    )

  if (
    automationRemindersError
  ) {
    console.error(
      'MEMBER SPACE - automation reminders:',
      automationRemindersError
    )
  }

  const automationReminders =
    !automationRemindersError &&
    Array.isArray(
      automationRemindersRaw
    )
      ? (
          automationRemindersRaw as
            MemberAutomationReminder[]
        )
      : []
  const {
    data:
      managementMembership,
  } =
    await supabase
      .from(
        'organization_users'
      )
      .select(`
        organization_id,
        role,
        is_active
      `)
      .eq(
        'user_id',
        userId
      )
      .eq(
        'organization_id',
        organization.id
      )
      .eq(
        'is_active',
        true
      )
      .maybeSingle()

  const canManageOrganization =
    Boolean(
      managementMembership &&
      MANAGEMENT_ROLES.has(
        String(
          managementMembership.role
        )
      )
    )

  // ==========================================================
  // IDENTITE VISUELLE
  // ==========================================================

  const {
    data: profileRaw,
    error: profileError,
  } =
    await supabase
      .from(
        'organization_public_profiles'
      )
      .select(`
        logo_path,
        primary_color,
        secondary_color,
        accent_color,
        slogan
      `)
      .eq(
        'organization_id',
        organization.id
      )
      .maybeSingle()

  if (profileError) {
    console.error(
      'MEMBER SPACE - branding:',
      profileError
    )
  }

  const profile =
    profileRaw as
      | BrandingProfile
      | null

  const primaryColor =
    safeColor(
      profile?.primary_color,
      '#047857'
    )

  const secondaryColor =
    safeColor(
      profile?.secondary_color,
      '#0F172A'
    )

  const accentColor =
    safeColor(
      profile?.accent_color,
      '#ECFDF5'
    )

  const logoUrl =
    profile?.logo_path
      ? supabase.storage
          .from(
            'organization-branding'
          )
          .getPublicUrl(
            profile.logo_path
          )
          .data.publicUrl
      : null

  // ==========================================================
  // MOYENS DE PAIEMENT
  // ==========================================================

  const {
    data: paymentMethodsRaw,
    error:
      paymentMethodsError,
  } =
    await supabase.rpc(
      'get_visible_payment_methods',
      {
        target_organization_id:
          organization.id,
      }
    )

  if (
    paymentMethodsError
  ) {
    console.error(
      'MEMBER SPACE - payment methods:',
      paymentMethodsError
    )
  }

  const paymentMethods =
    Array.isArray(
      paymentMethodsRaw
    )
      ? (
          paymentMethodsRaw as
            PaymentMethod[]
        ).sort(
          (
            a,
            b
          ) =>
            Number(
              a.display_order ??
                0
            ) -
            Number(
              b.display_order ??
                0
            )
        )
      : []

  // ==========================================================
  // COTISATIONS
  // ==========================================================

  const regularObligations =
    obligations.filter(
      (item) =>
        item.source_kind ===
        'regular'
    )

  const exceptionalObligations =
    obligations.filter(
      (item) =>
        item.source_kind ===
        'exceptional'
    )

  const openObligations =
    obligations.filter(
      (item) =>
        (
          item.status ===
            'open' ||
          item.status ===
            'partial'
        ) &&
        money(
          item.remaining_amount
        ) > 0
    )

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main
      id="accueil"
      className="min-h-screen bg-slate-50"
    >

      {/* ==================================================== */}
      {/* HEADER */}
      {/* ==================================================== */}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">

          <div className="flex min-w-0 items-center gap-3">

            {logoUrl ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">

                <img
                  src={logoUrl}
                  alt={
                    organization.name
                  }
                  className="h-full w-full object-contain p-1"
                />

              </div>
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                {organizationInitials(
                  organization.short_name ||
                    organization.name
                )}
              </div>
            )}

            <div className="min-w-0">

              <p
                className="truncate text-lg font-black"
                style={{
                  color:
                    secondaryColor,
                }}
              >
                {organization.short_name ||
                  organization.name}
              </p>

              {organization.short_name && (
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {
                    organization.name
                  }
                </p>
              )}

            </div>

          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">

            {memberSpaces.length >
              1 && (
              <Link
                href="/my-space"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Changer d&apos;espace
              </Link>
            )}

            {canManageOrganization && (
              <Link
                href="/dashboard"
                className="hidden rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 sm:inline-flex"
              >
                Espace de gestion
              </Link>
            )}

            {organization.public_slug && (
              <Link
                href={`/m/${organization.public_slug}`}
                className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 lg:inline-flex"
              >
                Voir l&apos;organisation
              </Link>
            )}

            <form
              action="/signout"
              method="post"
            >
              <button
                type="submit"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Déconnexion
              </button>
            </form>

          </div>

        </div>

        {/* NAVIGATION MEMBRE */}

        <div className="border-t border-slate-100">

          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">

            <MemberNavLink
              href="#accueil"
              label="Accueil"
              active
              primaryColor={
                primaryColor
              }
              accentColor={
                accentColor
              }
            />

            <MemberNavLink
              href="#cotisations"
              label="Mes cotisations"
              primaryColor={
                primaryColor
              }
              accentColor={
                accentColor
              }
            />

            {automationReminders.length > 0 && (
              <MemberNavLink
                href="#rappels"
                label="Mes rappels"
                primaryColor={
                  primaryColor
                }
                accentColor={
                  accentColor
                }
              />
            )}

            <MemberNavLink
              href="#reglement"
              label="Payer"
              primaryColor={
                primaryColor
              }
              accentColor={
                accentColor
              }
            />

            <MemberNavLink
              href="#paiements"
              label="Mes paiements"
              primaryColor={
                primaryColor
              }
              accentColor={
                accentColor
              }
            />

            <MemberNavLink
              href="#profil"
              label="Mon profil"
              primaryColor={
                primaryColor
              }
              accentColor={
                accentColor
              }
            />

          </nav>

        </div>

      </header>

      {/* ==================================================== */}
      {/* CONTENU */}
      {/* ==================================================== */}

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">

        {/* ================================================== */}
        {/* NOTIFICATIONS */}
        {/* ================================================== */}

        {query.registered ===
          '1' && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <p className="font-black text-emerald-900">
              ✓ Votre espace membre est prêt.
            </p>

            <p className="mt-1 text-sm leading-6 text-emerald-800">
              Votre compte est
              maintenant rattaché à
              votre dossier membre.
            </p>

          </div>
        )}

        {query.activated ===
          '1' && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <p className="font-black text-emerald-900">
              ✓ Votre espace membre est activé.
            </p>

          </div>
        )}

        {/* ================================================== */}
        {/* HERO */}
        {/* ================================================== */}

        <section
          className="overflow-hidden rounded-3xl text-white shadow-sm"
          style={{
            background:
              `linear-gradient(120deg, ${secondaryColor}, ${primaryColor})`,
          }}
        >

          <div className="p-7 sm:p-9">

            <p className="text-sm font-bold text-white/75">
              Bienvenue dans votre
              espace personnel
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Bonjour{' '}
              {member.first_name}
            </h1>

            <p className="mt-3 text-base font-bold text-white/85 sm:text-lg">
              {organization.name}
            </p>

            {profile?.slogan && (
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                {profile.slogan}
              </p>
            )}

            <div className="mt-7 flex flex-wrap gap-4">

              <HeroInfo
                label="Matricule"
                value={
                  member.member_number
                }
              />

              <HeroInfo
                label="Statut"
                value={
                  member.status ===
                  'active'
                    ? 'Membre actif'
                    : member.status
                }
              />

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* SITUATION */}
        {/* ================================================== */}

        <section className="mt-8">

          <div>

            <p
              className="text-xs font-black uppercase tracking-[0.16em]"
              style={{
                color:
                  primaryColor,
              }}
            >
              Ma situation
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Situation de mes cotisations
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Consultez votre
              situation financière
              auprès de votre
              organisation.
            </p>

          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <FinancialCard
              label="Exigible à ce jour"
              value={
                money(
                  summary.due_to_date
                )
              }
            />

            <FinancialCard
              label="Déjà payé"
              value={
                money(
                  summary.paid_total
                )
              }
              tone="success"
            />

            <FinancialCard
              label="Reste à payer"
              value={
                money(
                  summary.remaining_due
                )
              }
              tone={
                money(
                  summary.remaining_due
                ) > 0
                  ? 'warning'
                  : 'success'
              }
            />

            <FinancialCard
              label="Avance"
              value={
                money(
                  summary.advance_amount
                )
              }
              tone="info"
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* ARRIERES */}
        {/* ================================================== */}

        {money(
          summary.overdue_amount
        ) > 0 && (
          <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">

            <p className="font-black text-amber-900">
              Vous avez un montant
              antérieur à régulariser.
            </p>

            <p className="mt-2 text-sm text-amber-800">
              Arriérés :{' '}
              <strong>
                {formatMoney(
                  money(
                    summary.overdue_amount
                  )
                )}
              </strong>
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* RAPPELS AUTOMATIQUES */}
        {/* ================================================== */}

        {automationReminders.length > 0 && (
          <section
            id="rappels"
            className="mt-8 scroll-mt-40 overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm"
          >

            <div className="border-b border-amber-100 bg-amber-50 px-6 py-5">

              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                Mes rappels
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Cotisations à régulariser
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Ces rappels sont générés automatiquement par votre organisation
                à partir des échéances qui présentent encore un solde à payer.
              </p>

            </div>

            <div className="divide-y divide-slate-100">

              {automationReminders.map(
                (reminder) => (
                  <div
                    key={
                      reminder.reminder_id
                    }
                    className="p-6"
                  >

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
                            {formatAutomationReminderType(
                              reminder.reminder_type
                            )}
                          </span>

                          <span className="text-xs font-bold text-slate-400">
                            Échéance{' '}
                            {formatDate(
                              reminder.due_date
                            )}
                          </span>

                        </div>

                        <p className="mt-3 font-black text-slate-950">
                          {reminder.title}
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {reminder.message}
                        </p>

                      </div>

                      <div className="shrink-0 sm:text-right">

                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Reste à payer
                        </p>

                        <p className="mt-1 text-xl font-black text-amber-700">
                          {formatMoney(
                            money(
                              reminder.amount_remaining
                            )
                          )}
                        </p>

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">

              <Link
                href="#reglement"
                className="inline-flex rounded-xl px-4 py-2.5 text-sm font-black text-white transition hover:opacity-90"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                Régler mes cotisations
              </Link>

            </div>

          </section>
        )}
        {/* ================================================== */}
        {/* REGLEMENT */}
        {/* ================================================== */}

        <section
          id="reglement"
          className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >

          <div
            className="flex flex-col justify-between gap-5 px-6 py-6 sm:flex-row sm:items-center"
            style={{
              backgroundColor:
                accentColor,
            }}
          >

            <div>

              <p
                className="text-xs font-black uppercase tracking-[0.16em]"
                style={{
                  color:
                    primaryColor,
                }}
              >
                Règlement
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Payer mes cotisations
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Choisissez directement
                la cotisation à régler
                dans les tableaux
                ci-dessous.
              </p>

            </div>

            <div className="shrink-0">

              <p className="text-xs font-bold uppercase text-slate-500">
                Reste exigible
              </p>

              <p
                className="mt-1 text-2xl font-black"
                style={{
                  color:
                    primaryColor,
                }}
              >
                {formatMoney(
                  money(
                    summary.remaining_due
                  )
                )}
              </p>

            </div>

          </div>

          <div className="p-6">

            {paymentMethods.length ===
            0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">

                <p className="font-black text-slate-800">
                  Aucun moyen de
                  paiement n’est
                  actuellement affiché.
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Contactez votre
                  organisation pour
                  connaître les
                  modalités de règlement.
                </p>

              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">

                {paymentMethods.map(
                  (method) => (
                    <PaymentMethodCard
                      key={
                        method.id
                      }
                      method={
                        method
                      }
                      primaryColor={
                        primaryColor
                      }
                      accentColor={
                        accentColor
                      }
                    />
                  )
                )}

              </div>
            )}

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">

              <p className="font-black text-amber-900">
                Avant tout paiement
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Vérifiez toujours le
                bénéficiaire et les
                informations affichées.
                Ne communiquez jamais
                votre code PIN, votre
                mot de passe ou votre
                code OTP.
              </p>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* COTISATIONS REGULIERES */}
        {/* ================================================== */}

        <section
          id="cotisations"
          className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >

          <SectionHeader
            eyebrow="Mes cotisations"
            title="Cotisations régulières"
            primaryColor={
              primaryColor
            }
          />

          {regularObligations.length ===
          0 ? (
            <EmptyState
              text="Aucune cotisation régulière n’est encore enregistrée pour votre dossier."
            />
          ) : (
            <ObligationsTable
              obligations={
                regularObligations
              }
              primaryColor={
                primaryColor
              }
            />
          )}

        </section>

        {/* ================================================== */}
        {/* EXCEPTIONNELLES */}
        {/* ================================================== */}

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <SectionHeader
            eyebrow="Appels exceptionnels"
            title="Cotisations exceptionnelles"
            primaryColor={
              primaryColor
            }
          />

          {exceptionalObligations.length ===
          0 ? (
            <EmptyState
              text="Aucune cotisation exceptionnelle n’est actuellement enregistrée pour votre dossier."
            />
          ) : (
            <ObligationsTable
              obligations={
                exceptionalObligations
              }
              primaryColor={
                primaryColor
              }
            />
          )}

        </section>

        {/* ================================================== */}
        {/* MONTANTS EN ATTENTE */}
        {/* ================================================== */}

        {openObligations.length >
          0 && (
          <section className="mt-8 overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">

            <SectionHeader
              eyebrow="À régulariser"
              title="Mes montants en attente"
              primaryColor="#B45309"
            />

            <ObligationsTable
              obligations={
                openObligations
              }
              primaryColor={
                primaryColor
              }
            />

          </section>
        )}

        {/* ================================================== */}
        {/* PAIEMENTS */}
        {/* ================================================== */}

        <section
          id="paiements"
          className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >

          <SectionHeader
            eyebrow="Historique"
            title="Mes paiements"
            primaryColor={
              primaryColor
            }
          />

          {payments.length ===
          0 ? (
            <EmptyState
              text="Aucun paiement n’est encore enregistré pour votre dossier."
            />
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                  <tr>

                    <th className="px-5 py-4">
                      Date
                    </th>

                    <th className="px-5 py-4">
                      Montant
                    </th>

                    <th className="px-5 py-4">
                      Moyen
                    </th>

                    <th className="px-5 py-4">
                      Référence
                    </th>

                    <th className="px-5 py-4">
                      Reçu
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {payments.map(
                    (payment) => (
                      <tr
                        key={
                          payment.id
                        }
                        className="text-sm"
                      >

                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {formatDate(
                            payment.paid_at
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 font-black text-slate-950">
                          {formatMoney(
                            money(
                              payment.amount
                            )
                          )}
                        </td>

                        <td className="px-5 py-4 font-semibold text-slate-700">
                          {formatPaymentMethod(
                            payment.payment_method
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {payment.payment_reference ||
                            '—'}
                        </td>

                        <td className="px-5 py-4">

                          {payment.receipt_number ? (
                            <Link
                              href={`/contributions/receipts/${payment.id}`}
                              className="font-black hover:underline"
                              style={{
                                color:
                                  primaryColor,
                              }}
                            >
                              {
                                payment.receipt_number
                              }
                            </Link>
                          ) : (
                            <span className="text-slate-400">
                              —
                            </span>
                          )}

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* ================================================== */}
        {/* PROFIL */}
        {/* ================================================== */}

        <section
          id="profil"
          className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >

          <SectionHeader
            eyebrow="Mon profil"
            title="Mes informations"
            primaryColor={
              primaryColor
            }
          />

          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">

            <ProfileItem
              label="Nom"
              value={
                [
                  member.first_name,
                  member.last_name,
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            />

            <ProfileItem
              label="Matricule"
              value={
                member.member_number
              }
            />

            <ProfileItem
              label="Téléphone"
              value={
                member.phone ||
                'Non renseigné'
              }
            />

            <ProfileItem
              label="Adresse e-mail"
              value={
                member.email ||
                'Non renseignée'
              }
            />

            <ProfileItem
              label="Profession"
              value={
                member.profession ||
                'Non renseignée'
              }
            />

            <ProfileItem
              label="Adresse"
              value={
                member.address ||
                'Non renseignée'
              }
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* FOOTER */}
        {/* ================================================== */}

        <footer className="py-10 text-center">

          <p className="text-sm font-bold text-slate-500">
            {organization.name}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Espace personnel sécurisé
          </p>

        </footer>

      </div>

    </main>
  )
}

// ============================================================
// SELECTEUR D'ESPACE
// ============================================================

function MemberSpaceSelector({
  spaces,
}: {
  spaces: MemberSpaceOption[]
}) {
  return (
    <main className="min-h-screen bg-slate-50">

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">

          <div>

            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              EWUKAI
            </p>

            <p className="mt-1 text-lg font-black text-slate-950">
              Mon espace membre
            </p>

          </div>

          <form
            action="/signout"
            method="post"
          >
            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"
            >
              Déconnexion
            </button>
          </form>

        </div>

      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-7 text-white sm:p-10">

          <p className="text-sm font-bold text-emerald-300">
            Plusieurs adhésions détectées
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Choisissez votre organisation
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Votre compte EWUKAI
            est rattaché à plusieurs
            organisations.
            Sélectionnez celle dont
            vous souhaitez consulter
            votre espace membre.
          </p>

        </section>

        <div className="mt-7 grid gap-4 md:grid-cols-2">

          {spaces.map(
            (space) => (
              <Link
                key={
                  space.member_id
                }
                href={`/my-space?organization=${encodeURIComponent(
                  space.organization_id
                )}`}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
              >

                <div className="flex items-start gap-4">

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white">

                    {organizationInitials(
                      space.organization_short_name ||
                        space.organization_name
                    )}

                  </div>

                  <div className="min-w-0 flex-1">

                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      {
                        space.organization_short_name ||
                        'Organisation'
                      }
                    </p>

                    <h2 className="mt-1 text-lg font-black text-slate-950">
                      {
                        space.organization_name
                      }
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-2">

                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                        {
                          space.member_number
                        }
                      </span>

                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                        Membre actif
                      </span>

                    </div>

                    <p className="mt-5 text-sm font-black text-emerald-700 group-hover:underline">
                      Ouvrir mon espace →
                    </p>

                  </div>

                </div>

              </Link>
            )
          )}

        </div>

        <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Un seul compte EWUKAI
          </p>

          <p className="mt-2 text-sm leading-6 text-blue-800">
            Vous pouvez appartenir à
            plusieurs mutuelles,
            associations ou
            organisations sans créer
            plusieurs comptes.
            Chaque organisation
            conserve son propre
            matricule, ses cotisations
            et ses paiements.
          </p>

        </div>

      </div>

    </main>
  )
}

// ============================================================
// CARTE MOYEN DE PAIEMENT
// ============================================================

function PaymentMethodCard({
  method,
  primaryColor,
  accentColor,
}: {
  method: PaymentMethod
  primaryColor: string
  accentColor: string
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

      <div
        className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4"
        style={{
          backgroundColor:
            accentColor,
        }}
      >

        <div className="min-w-0">

          <p
            className="text-xs font-black uppercase tracking-wide"
            style={{
              color:
                primaryColor,
            }}
          >
            {providerLabel(
              method.provider
            )}
          </p>

          <p className="mt-1 truncate text-lg font-black text-slate-950">
            {method.label}
          </p>

        </div>

        <PaymentProviderLogo
          provider={
            method.provider
          }
          label={
            method.label
          }
        />

      </div>

      <div className="space-y-4 p-5">

        {method.account_name && (
          <PaymentInfo
            label="Bénéficiaire"
            value={
              method.account_name
            }
          />
        )}

        {method.bank_name && (
          <PaymentInfo
            label="Banque"
            value={
              method.bank_name
            }
          />
        )}

        {method.account_number && (
          <PaymentInfo
            label={
              method.provider ===
              'bank_transfer'
                ? 'Compte / IBAN'
                : 'Numéro'
            }
            value={
              method.account_number
            }
            emphasize
          />
        )}

        {method.merchant_code && (
          <PaymentInfo
            label="Code marchand"
            value={
              method.merchant_code
            }
            emphasize
          />
        )}

        {method.instructions && (
          <div className="rounded-xl bg-slate-50 p-4">

            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Instructions
            </p>

            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
              {method.instructions}
            </p>

          </div>
        )}

      </div>

    </article>
  )
}

// ============================================================
// LOGOS PAIEMENT
// ============================================================

function PaymentProviderLogo({
  provider,
  label,
}: {
  provider: string
  label: string
}) {
  if (
    provider ===
    'wave'
  ) {
    return (
      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">

        <Image
          src="/payment-logos/wave.png"
          alt="Wave"
          width={110}
          height={60}
          className="h-full w-full object-contain"
        />

      </div>
    )
  }

  if (
    provider ===
    'orange_money'
  ) {
    return (
      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">

        <Image
          src="/payment-logos/orange-money.png"
          alt="Orange Money"
          width={110}
          height={60}
          className="h-full w-full object-contain"
        />

      </div>
    )
  }

  if (
    provider ===
    'mtn_momo'
  ) {
    return (
      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">

        <Image
          src="/payment-logos/mtn-momo.png"
          alt="MTN MoMo"
          width={110}
          height={60}
          className="h-full w-full object-contain"
        />

      </div>
    )
  }

  if (
    provider ===
    'moov_money'
  ) {
    return (
      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">

        <Image
          src="/payment-logos/moov-money.png"
          alt="Moov Money"
          width={110}
          height={60}
          className="h-full w-full object-contain"
        />

      </div>
    )
  }

  if (
    provider ===
    'bank_transfer'
  ) {
    return (
      <ProviderFallback
        text="BANQUE"
      />
    )
  }

  if (
    provider ===
    'cash'
  ) {
    return (
      <ProviderFallback
        text="CAISSE"
      />
    )
  }

  return (
    <ProviderFallback
      text={
        getPaymentInitials(
          label
        )
      }
    />
  )
}

function ProviderFallback({
  text,
}: {
  text: string
}) {
  return (
    <div className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-3 text-[10px] font-black text-white">
      {text}
    </div>
  )
}

// ============================================================
// TABLE COTISATIONS
// ============================================================

function ObligationsTable({
  obligations,
  primaryColor,
}: {
  obligations:
    ObligationData[]

  primaryColor:
    string
}) {
  return (
    <div className="overflow-x-auto">

      <table className="w-full text-left">

        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

          <tr>

            <th className="px-5 py-4">
              Cotisation
            </th>

            <th className="px-5 py-4">
              Échéance
            </th>

            <th className="px-5 py-4">
              Dû
            </th>

            <th className="px-5 py-4">
              Payé
            </th>

            <th className="px-5 py-4">
              Reste
            </th>

            <th className="px-5 py-4">
              Statut
            </th>

            <th className="px-5 py-4 text-right">
              Action
            </th>

          </tr>

        </thead>

        <tbody className="divide-y divide-slate-100">

          {obligations.map(
            (item) => {
              const remaining =
                money(
                  item.remaining_amount
                )

              const normalizedStatus =
                item.status
                  .toLowerCase()

              const canPay =
                remaining >
                  0 &&
                ![
                  'waived',
                  'cancelled',
                  'paid',
                ].includes(
                  normalizedStatus
                )

              return (
                <tr
                  key={
                    item.id
                  }
                  className="text-sm transition hover:bg-slate-50"
                >

                  <td className="min-w-52 px-5 py-4">

                    <p className="font-bold text-slate-900">
                      {item.name}
                    </p>

                    {item.source_kind ===
                      'exceptional' && (
                      <p className="mt-1 text-xs font-bold text-amber-700">
                        Exceptionnelle
                      </p>
                    )}

                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDate(
                      item.due_date
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800">
                    {formatMoney(
                      money(
                        item.amount_due
                      )
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-emerald-700">
                    {formatMoney(
                      money(
                        item.amount_paid
                      )
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 font-black text-slate-950">
                    {formatMoney(
                      remaining
                    )}
                  </td>

                  <td className="px-5 py-4">

                    <StatusBadge
                      status={
                        item.status
                      }
                      dueDate={
                        item.due_date
                      }
                    />

                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-right">

                    {canPay ? (
                      <Link
                        href={`/my-space/pay/${item.id}`}
                        className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:opacity-90"
                        style={{
                          backgroundColor:
                            primaryColor,
                        }}
                      >
                        Payer
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">
                        —
                      </span>
                    )}

                  </td>

                </tr>
              )
            }
          )}

        </tbody>

      </table>

    </div>
  )
}

// ============================================================
// NAVIGATION MEMBRE
// ============================================================

function MemberNavLink({
  href,
  label,
  active = false,
  primaryColor,
  accentColor,
}: {
  href: string
  label: string
  active?: boolean
  primaryColor: string
  accentColor: string
}) {
  return (
    <a
      href={href}
      className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition hover:bg-slate-50"
      style={
        active
          ? {
              color:
                primaryColor,

              backgroundColor:
                accentColor,
            }
          : {
              color:
                '#475569',
            }
      }
    >
      {label}
    </a>
  )
}

// ============================================================
// HERO
// ============================================================

function HeroInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-sm">

      <p className="text-xs font-bold uppercase tracking-wide text-white/60">
        {label}
      </p>

      <p className="mt-1 text-xl font-black">
        {value}
      </p>

    </div>
  )
}

// ============================================================
// CARTE FINANCIERE
// ============================================================

function FinancialCard({
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
    | 'info'
}) {
  const classes =
    tone ===
    'success'
      ? 'border-emerald-200 bg-emerald-50'
      : tone ===
          'warning'
        ? 'border-amber-200 bg-amber-50'
        : tone ===
            'info'
          ? 'border-blue-200 bg-blue-50'
          : 'border-slate-200 bg-white'

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${classes}`}
    >

      <p className="text-sm font-bold text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-slate-950">
        {formatMoney(
          value
        )}
      </p>

    </div>
  )
}

// ============================================================
// EN-TETE SECTION
// ============================================================

function SectionHeader({
  eyebrow,
  title,
  primaryColor,
}: {
  eyebrow: string
  title: string
  primaryColor: string
}) {
  return (
    <div className="border-b border-slate-200 px-6 py-5">

      <p
        className="text-xs font-black uppercase tracking-[0.16em]"
        style={{
          color:
            primaryColor,
        }}
      >
        {eyebrow}
      </p>

      <h2 className="mt-1 text-xl font-black text-slate-950">
        {title}
      </h2>

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
    <div className="p-8 text-center">

      <p className="text-sm leading-6 text-slate-500">
        {text}
      </p>

    </div>
  )
}

// ============================================================
// PROFIL
// ============================================================

function ProfileItem({
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

      <p className="mt-2 break-words font-bold text-slate-900">
        {value}
      </p>

    </div>
  )
}

// ============================================================
// INFO PAIEMENT
// ============================================================

function PaymentInfo({
  label,
  value,
  emphasize = false,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div>

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={
          emphasize
            ? 'mt-1 break-words text-xl font-black text-slate-950'
            : 'mt-1 break-words font-black text-slate-900'
        }
      >
        {value}
      </p>

    </div>
  )
}

// ============================================================
// STATUT COTISATION
// ============================================================

function StatusBadge({
  status,
  dueDate,
}: {
  status: string
  dueDate: string
}) {
  const normalized =
    status
      .toLowerCase()

  // ----------------------------------------------------------
  // PAYEE
  // ----------------------------------------------------------

  if (
    normalized ===
    'paid'
  ) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
        Payé
      </span>
    )
  }

  // ----------------------------------------------------------
  // PARTIEL
  // ----------------------------------------------------------

  if (
    normalized ===
    'partial'
  ) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
        Partiel
      </span>
    )
  }

  // ----------------------------------------------------------
  // EXONEREE
  // ----------------------------------------------------------

  if (
    normalized ===
    'waived'
  ) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
        Exonéré
      </span>
    )
  }

  // ----------------------------------------------------------
  // ANNULEE
  // ----------------------------------------------------------

  if (
    normalized ===
    'cancelled'
  ) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
        Annulé
      </span>
    )
  }

  // ----------------------------------------------------------
  // OUVERTE
  //
  // On distingue :
  // - future       -> À venir
  // - aujourd'hui  -> À payer
  // - passée       -> Impayé
  // ----------------------------------------------------------

  if (
    normalized ===
    'open'
  ) {
    const today =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        )

    if (
      dueDate >
      today
    ) {
      return (
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
          À venir
        </span>
      )
    }

    if (
      dueDate ===
      today
    ) {
      return (
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
          À payer
        </span>
      )
    }

    return (
      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
        Impayé
      </span>
    )
  }

  // ----------------------------------------------------------
  // AUTRE
  // ----------------------------------------------------------

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
      {status}
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
    typeof value ===
    'number'
      ? value
      : Number(
          value ??
          0
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
// FORMAT MONTANT
// ============================================================

function formatAutomationReminderType(
  value: string
) {
  switch (value) {
    case 'before_due':
      return 'Avant échéance'

    case 'due_today':
      return 'Échéance du jour'

    case 'overdue':
      return 'En retard'

    default:
      return 'Rappel'
  }
}

// ============================================================
// FORMAT MONTANT
// ============================================================
function formatMoney(
  value: number
) {
  return `${new Intl.NumberFormat(
    'fr-FR'
  ).format(
    value
  )} FCFA`
}

// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return '—'
  }

  const normalizedValue =
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
      ? `${value}T00:00:00Z`
      : value

  const date =
    new Date(
      normalizedValue
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
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }
  ).format(
    date
  )
}

// ============================================================
// FORMAT MOYEN DE PAIEMENT
// ============================================================

function formatPaymentMethod(
  value: string
) {
  switch (
    value.toLowerCase()
  ) {
    case 'wave':
      return 'Wave'

    case 'orange_money':
      return 'Orange Money'

    case 'mtn_momo':
      return 'MTN MoMo'

    case 'moov_money':
      return 'Moov Money'

    case 'bank_transfer':
      return 'Virement bancaire'

    case 'cash':
      return 'Espèces'

    default:
      return value
  }
}

// ============================================================
// LABEL PRESTATAIRE
// ============================================================

function providerLabel(
  provider: string
) {
  switch (
    provider
  ) {
    case 'wave':
      return 'Wave'

    case 'orange_money':
      return 'Orange Money'

    case 'mtn_momo':
      return 'MTN MoMo'

    case 'moov_money':
      return 'Moov Money'

    case 'bank_transfer':
      return 'Virement bancaire'

    case 'cash':
      return 'Paiement en espèces'

    default:
      return 'Moyen de paiement'
  }
}

// ============================================================
// COULEUR SECURISEE
// ============================================================

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

// ============================================================
// INITIALES ORGANISATION
// ============================================================

function organizationInitials(
  value: string
) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(
      0,
      2
    )
    .map(
      (word) =>
        word[0]
          ?.toUpperCase() ??
        ''
    )
    .join('')
}

// ============================================================
// INITIALES MOYEN DE PAIEMENT
// ============================================================

function getPaymentInitials(
  value: string
) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(
      0,
      2
    )
    .map(
      (word) =>
        word[0]
          ?.toUpperCase() ??
        ''
    )
    .join('')
}