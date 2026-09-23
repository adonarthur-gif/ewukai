import type {
  ReactNode,
} from 'react'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleAlert,
  CreditCard,
  Crown,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  requestSubscriptionCheckout,
} from './actions'

type PlanCode =
  | 'free'
  | 'standard'
  | 'pro'
  | 'enterprise'

type BillingCycle =
  | 'monthly'
  | 'yearly'

type SubscriptionPlan = {
  id?: string | null
  code?: string | null
  name?: string | null
}

type SubscriptionData = {
  id?: string | null
  status?: string | null
  starts_at?: string | null
  ends_at?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  billing_cycle?: string | null
  created_at?: string | null
  plan?: SubscriptionPlan | null
}

type InvoiceData = {
  id?: string | null
  invoice_number?: string | null
  status?: string | null
  currency?: string | null
  billing_cycle?: string | null
  total_xof?: number | string | null
  amount_paid_xof?: number | string | null
  issued_at?: string | null
  due_at?: string | null
  created_at?: string | null
}

type PortalData = {
  organization?: {
    id?: string | null
    name?: string | null
    short_name?: string | null
    created_at?: string | null
  } | null

  viewer?: {
    role?: string | null
    can_manage_subscription?: boolean | null
  } | null

  members?: {
    active_count?: number | null
  } | null

  recommendation?: {
    plan_code?: string | null
  } | null

  current_subscription?: SubscriptionData | null
  pending_subscription?: SubscriptionData | null
  pending_invoice?: InvoiceData | null
  plans?: SubscriptionPlan[] | null
}

type CapacityData = {
  organization_id?: string | null
  plan_id?: string | null
  plan_code?: string | null
  plan_name?: string | null
  member_limit?: number | null
  active_member_count?: number | string | null
  remaining_slots?: number | string | null
  is_unlimited?: boolean | null
  is_at_limit?: boolean | null
}

type FeatureKey =
  | 'basic_dashboard'
  | 'members'
  | 'contributions'
  | 'receipts'
  | 'treasury'
  | 'automation'
  | 'advanced_reports'
  | 'priority_support'
  | 'custom_integrations'

type EntitlementsData = {
  organization_id?: string | null
  subscription_id?: string | null
  subscription_status?: string | null
  source?: string | null
  plan_id?: string | null
  plan_code?: string | null
  plan_name?: string | null
  member_limit?: number | null
  features?: Record<string, boolean> | null
}

const FEATURE_META: Array<{
  key: FeatureKey
  label: string
  description: string
}> = [
  {
    key: 'basic_dashboard',
    label: 'Tableau de bord',
    description: 'Synthèse et indicateurs essentiels de votre organisation.',
  },
  {
    key: 'members',
    label: 'Gestion des membres',
    description: 'Création, suivi, activation et gestion des membres.',
  },
  {
    key: 'contributions',
    label: 'Cotisations',
    description: 'Appels, obligations, collecte et suivi des cotisations.',
  },
  {
    key: 'receipts',
    label: 'Reçus',
    description: 'Consultation et édition des reçus liés aux encaissements.',
  },
  {
    key: 'treasury',
    label: 'Trésorerie',
    description: 'Comptes, dépenses et mouvements de trésorerie.',
  },
  {
    key: 'automation',
    label: 'Automatisation',
    description: 'Fonctions automatisées réservées aux formules supérieures.',
  },
  {
    key: 'advanced_reports',
    label: 'Rapports avancés',
    description: 'Analyses et rapports enrichis pour le pilotage.',
  },
  {
    key: 'priority_support',
    label: 'Support prioritaire',
    description: 'Traitement prioritaire des demandes d’assistance.',
  },
  {
    key: 'custom_integrations',
    label: 'Intégrations personnalisées',
    description: 'Connexions et intégrations spécifiques à l’organisation.',
  },
]
type SubscriptionPageProps = {
  searchParams: Promise<{
    checkout?: string
    plan?: string
    cycle?: string
    invoice?: string
    error?: string
    feature?: string
  }>
}

const PLAN_META: Record<
  PlanCode,
  {
    name: string
    price: string
    yearlyPrice?: string
    members: string
    description: string
  }
> = {
  free: {
    name: 'Gratuit',
    price: '0 FCFA',
    members: '0 à 20 membres',
    description: 'Pour démarrer et gérer une petite organisation.',
  },
  standard: {
    name: 'Standard',
    price: '5 250 FCFA / 8 € par mois',
    yearlyPrice: '52 500 FCFA / 80 € par an',
    members: '21 à 50 membres',
    description: 'Pour une organisation qui structure sa gestion et son suivi.',
  },
  pro: {
    name: 'Pro',
    price: '10 500 FCFA / 16 € par mois',
    yearlyPrice: '105 000 FCFA / 160 € par an',
    members: '51 à 500 membres',
    description: 'Pour les organisations en croissance avec un volume important de membres.',
  },
  enterprise: {
    name: 'Entreprise',
    price: 'Sur devis',
    members: '501 membres et plus',
    description: 'Pour les grandes structures et les besoins spécifiques.',
  },
}

export default async function SubscriptionPage({
  searchParams,
}: SubscriptionPageProps) {
  const params =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    role ===
    'member'
  ) {
    redirect('/my-space')
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_organization_subscription_portal',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (
    error ||
    !data
  ) {
    console.error(
      'EWUKAI - SUBSCRIPTION PORTAL:',
      error
    )

    throw new Error(
      "Impossible de charger l'abonnement de l'organisation."
    )
  }

  const portal =
    data as unknown as PortalData

  const {
    data: capacityRaw,
    error: capacityError,
  } =
    await supabase.rpc(
      'get_organization_member_capacity_snapshot',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (capacityError) {
    console.error(
      'EWUKAI - MEMBER CAPACITY:',
      capacityError
    )
  }

  const capacity =
    !capacityError &&
    capacityRaw &&
    typeof capacityRaw === 'object'
      ? capacityRaw as CapacityData
      : null

  const {
    data: entitlementsRaw,
    error: entitlementsError,
  } =
    await supabase.rpc(
      'get_organization_entitlements',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (entitlementsError) {
    console.error(
      'EWUKAI - ENTITLEMENTS:',
      entitlementsError
    )
  }

  const entitlements =
    !entitlementsError &&
    entitlementsRaw &&
    typeof entitlementsRaw === 'object'
      ? entitlementsRaw as EntitlementsData
      : null

  const organizationName =
    portal.organization?.short_name ||
    portal.organization?.name ||
    'Votre organisation'

  const activeMembers =
    Math.max(
      0,
      Number(
        portal.members?.active_count ??
        0
      ) || 0
    )

  const currentSubscription =
    portal.current_subscription ??
    null

  const pendingSubscription =
    portal.pending_subscription ??
    null

  const pendingInvoice =
    portal.pending_invoice ??
    null

  const currentPlanCode =
    subscriptionPlanCode(
      currentSubscription
    ) ??
    'free'

  const pendingPlanCode =
    subscriptionPlanCode(
      pendingSubscription
    )

  const currentBillingCycle =
    normalizeBillingCycle(
      currentSubscription?.billing_cycle
    )

  const pendingBillingCycle =
    normalizeBillingCycle(
      pendingSubscription?.billing_cycle ??
      pendingInvoice?.billing_cycle
    )

  const requestedBillingCycle =
    normalizeBillingCycle(
      params.cycle
    )

  const recommendedPlanCode =
    normalizePlanCode(
      portal.recommendation?.plan_code
    )

  const canManage =
    Boolean(
      portal.viewer?.can_manage_subscription
    ) ||
    [
      'owner',
      'president',
      'treasurer',
    ].includes(role)

  const currentPeriodEnd =
    currentSubscription?.current_period_end ??
    currentSubscription?.ends_at ??
    null

  const currentStatus =
    currentSubscription?.status ??
    'active'

  const currentMeta =
    PLAN_META[
      currentPlanCode
    ]

  const capacityLimit =
    capacity?.member_limit ??
    null

  const capacityActive =
    Math.max(
      0,
      Number(
        capacity?.active_member_count ??
        activeMembers
      ) || 0
    )

  const capacityRemaining =
    capacityLimit === null
      ? null
      : Math.max(
          0,
          Number(
            capacity?.remaining_slots ??
            capacityLimit - capacityActive
          ) || 0
        )

  const capacityPercent =
    capacityLimit !== null &&
    capacityLimit > 0
      ? Math.min(
          100,
          Math.round(
            capacityActive /
              capacityLimit *
              100
          )
        )
      : 0

  const capacityAtLimit =
    Boolean(
      capacity?.is_at_limit
    )

  const capacityNearLimit =
    capacityLimit !== null &&
    !capacityAtLimit &&
    capacityPercent >= 80

  const entitlementFeatures =
    entitlements?.features ??
    {}

  const entitlementPlanName =
    entitlements?.plan_name ||
    currentMeta.name

  const enabledFeatureCount =
    FEATURE_META.filter(
      (feature) =>
        entitlementFeatures[feature.key] === true
    ).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link
          href="/parametres"
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 transition hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Paramètres
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-sm">
          <div className="px-6 py-8 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                  {organizationName}
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Abonnement EWUKAI
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Consultez votre formule, sa validité et les possibilités
                  d&apos;évolution de votre organisation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex">
                <HeroStat
                  label="Membres actifs"
                  value={String(activeMembers)}
                  icon={<Users className="h-5 w-5" />}
                />

                <HeroStat
                  label="Formule actuelle"
                  value={currentMeta.name}
                  icon={<Crown className="h-5 w-5" />}
                />
              </div>
            </div>
          </div>
        </section>

        {capacity && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  Capacité des membres
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Utilisation de votre capacité
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Seuls les membres actifs consomment une place. Un membre
                  inactif reste dans l&apos;historique sans réduire la capacité
                  disponible de votre organisation.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Formule {capacity.plan_name || currentMeta.name}
                </p>
                <p className="mt-1 text-2xl font-black">
                  {capacityLimit === null
                    ? `${capacityActive} actifs`
                    : `${capacityActive} / ${capacityLimit}`}
                </p>
              </div>
            </div>

            {capacityLimit !== null && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                  <span>{capacityPercent}% utilisé</span>
                  <span>
                    {capacityRemaining} place
                    {capacityRemaining !== 1 ? 's' : ''} restante
                    {capacityRemaining !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      capacityAtLimit
                        ? 'bg-red-500'
                        : capacityNearLimit
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                    }`}
                    style={{
                      width: `${capacityPercent}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <CapacityMetric
                label="Membres actifs"
                value={String(capacityActive)}
              />
              <CapacityMetric
                label="Places restantes"
                value={
                  capacityLimit === null
                    ? 'Illimité'
                    : String(capacityRemaining ?? 0)
                }
              />
              <CapacityMetric
                label="Plafond"
                value={
                  capacityLimit === null
                    ? 'Sur mesure'
                    : String(capacityLimit)
                }
              />
            </div>

            {capacityAtLimit ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-black">Plafond atteint</p>
                <p className="mt-1 leading-6 text-red-800">
                  Aucun nouveau membre actif ne peut être ajouté ou réactivé
                  avec cette formule. Choisissez une formule supérieure pour
                  augmenter la capacité.
                </p>
                <a
                  href="#formules"
                  className="mt-3 inline-flex font-black text-red-900 underline underline-offset-4"
                >
                  Voir les formules disponibles
                </a>
              </div>
            ) : capacityNearLimit ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-black">Vous approchez du plafond</p>
                <p className="mt-1 leading-6 text-amber-800">
                  Il reste {capacityRemaining} place
                  {capacityRemaining !== 1 ? 's' : ''}. Vous pouvez préparer
                  une formule supérieure avant d&apos;atteindre la limite.
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-black">Capacité disponible</p>
                <p className="mt-1 leading-6 text-emerald-800">
                  Votre organisation peut encore ajouter ou réactiver des
                  membres actifs dans la limite de sa formule actuelle.
                </p>
              </div>
            )}
          </section>
        )}

        {entitlements && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  Droits de votre formule
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Fonctionnalités incluses
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Ces droits proviennent de votre formule actuellement effective.
                  Une formule en attente de paiement ne débloque aucune
                  fonctionnalité supplémentaire.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Formule {entitlementPlanName}
                </p>
                <p className="mt-1 text-2xl font-black">
                  {enabledFeatureCount} / {FEATURE_META.length}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  fonctionnalités incluses
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FEATURE_META.map((feature) => {
                const enabled =
                  entitlementFeatures[feature.key] === true

                return (
                  <div
                    key={feature.key}
                    className={`rounded-2xl border p-4 ${
                      enabled
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          enabled
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {enabled ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <LockKeyhole className="h-4 w-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-slate-950">
                            {feature.label}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                              enabled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {enabled ? 'Inclus' : 'Non inclus'}
                          </span>
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-5 text-xs font-semibold leading-5 text-slate-500">
              Les droits ci-dessus proviennent de la formule effectivement active.
              Le contrôle serveur sera activé progressivement après validation.
            </p>
          </section>
        )}

        {params.feature === 'treasury' && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">
                La trésorerie n&apos;est pas incluse dans votre formule actuelle.
              </p>
              <p className="mt-1 leading-6 text-amber-800">
                Cette fonctionnalité est disponible à partir de la formule
                Standard. Vos données existantes restent conservées.
              </p>
              <a
                href="#formules"
                className="mt-2 inline-flex font-black text-amber-900 underline underline-offset-4"
              >
                Voir les formules disponibles
              </a>
            </div>
          </div>
        )}

        {params.feature === 'automation' && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">
                Les automatisations ne sont pas incluses dans votre formule actuelle.
              </p>
              <p className="mt-1 leading-6 text-amber-800">
                Les relances automatiques de cotisations sont disponibles avec
                les formules Pro et Entreprise.
              </p>
              <a
                href="#formules"
                className="mt-2 inline-flex font-black text-amber-900 underline underline-offset-4"
              >
                Voir les formules disponibles
              </a>
            </div>
          </div>
        )}

        {params.error && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="font-bold">{params.error}</p>
          </div>
        )}

        {params.checkout === 'prepared' && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">
                Demande d&apos;abonnement enregistrée.
              </p>
              <p className="mt-1 leading-6 text-emerald-800">
                La formule choisie
                {requestedBillingCycle
                  ? ` (${billingCycleShortLabel(requestedBillingCycle)})`
                  : ''}{' '}
                et sa facture sont maintenant préparées dans EWUKAI. Le paiement
                en ligne sera activé lorsque le prestataire de paiement de la
                plateforme sera configuré.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">
              Paiement en ligne en cours de configuration
            </p>
            <p className="mt-1 leading-6 text-blue-800">
              Vous pouvez déjà choisir Standard ou Pro et préparer la facture.
              Aucun paiement n&apos;est lancé depuis cette page pour le moment.
              Le bouton de règlement sera activé après la mise en service du
              prestataire de paiement EWUKAI.
            </p>
          </div>
        </div>

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Votre formule
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">
                  {currentMeta.name}
                </h2>
                <p className="mt-2 text-lg font-black text-emerald-700">
                  {subscriptionPriceLabel(
                    currentPlanCode,
                    currentBillingCycle
                  )}
                </p>
              </div>

              <StatusBadge status={currentStatus} />
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <InfoCard
                icon={<Users className="h-5 w-5" />}
                label="Capacité"
                value={currentMeta.members}
              />

              <InfoCard
                icon={<CalendarDays className="h-5 w-5" />}
                label="Validité"
                value={
                  currentPlanCode === 'free'
                    ? 'Sans échéance payante'
                    : currentPeriodEnd
                      ? `Jusqu'au ${formatDate(currentPeriodEnd)}`
                      : 'À confirmer'
                }
              />

              <InfoCard
                icon={<ShieldCheck className="h-5 w-5" />}
                label="Gestion"
                value={
                  canManage
                    ? 'Modification autorisée'
                    : 'Consultation uniquement'
                }
              />
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-white">
              <Sparkles className="h-5 w-5" />
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Formule recommandée
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {PLAN_META[recommendedPlanCode].name}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Avec <strong>{activeMembers}</strong> membre
              {activeMembers !== 1 ? 's' : ''} actif
              {activeMembers !== 1 ? 's' : ''}, cette formule correspond
              à la capacité actuelle de votre organisation.
            </p>

            {recommendedPlanCode !== currentPlanCode && (
              <p className="mt-4 rounded-xl bg-white/80 p-3 text-xs font-bold leading-5 text-emerald-900">
                Votre formule actuelle est différente de la recommandation
                calculée à partir du nombre de membres actifs.
              </p>
            )}
          </div>
        </section>

        {pendingSubscription && pendingPlanCode && pendingInvoice && (
          <section className="mt-7 overflow-hidden rounded-3xl border border-amber-200 bg-amber-50 shadow-sm">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
              <div className="p-6 sm:p-7">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-white">
                    <ReceiptText className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                      Demande en attente de règlement
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">
                      {PLAN_META[pendingPlanCode].name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      Votre demande est enregistrée. La formule actuelle reste
                      inchangée tant qu&apos;aucun règlement n&apos;a été confirmé.
                    </p>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-white">
                  <SummaryRow
                    label="Organisation"
                    value={organizationName}
                  />
                  <SummaryRow
                    label="Formule demandée"
                    value={PLAN_META[pendingPlanCode].name}
                  />
                  <SummaryRow
                    label="Période"
                    value={billingCycleLongLabel(pendingBillingCycle)}
                  />
                  <SummaryRow
                    label="Facture"
                    value={pendingInvoice.invoice_number || 'Préparée'}
                  />
                  <SummaryRow
                    label="Montant"
                    value={formatMoney(pendingInvoice.total_xof)}
                    strong
                  />
                  <SummaryRow
                    label="Statut"
                    value="En attente de paiement"
                    strong
                    last
                  />
                </div>

                {pendingInvoice.due_at && (
                  <p className="mt-3 text-xs font-semibold text-slate-600">
                    Échéance indicative : {formatDateTime(pendingInvoice.due_at)}
                  </p>
                )}
              </div>

              <div className="border-t border-amber-200 bg-white p-6 sm:p-7 lg:border-l lg:border-t-0">
                <div className="flex h-full flex-col justify-center">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Paiement en ligne
                  </p>

                  <h3 className="mt-2 text-xl font-black text-slate-950">
                    Bientôt disponible
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    La facture est prête, mais aucun prestataire de paiement
                    n&apos;est encore relié à EWUKAI. Aucun débit ne peut donc
                    être lancé depuis cet écran.
                  </p>

                  <button
                    type="button"
                    disabled
                    className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-black text-slate-500"
                  >
                    <CreditCard className="h-4 w-4" />
                    Payer {formatMoney(pendingInvoice.total_xof)}
                  </button>

                  <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-500">
                    Ce bouton sera activé lorsque le compte marchand de la
                    plateforme sera configuré.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="formules" className="mt-10 scroll-mt-24">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Nos formules
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
              Choisissez la capacité adaptée à votre organisation
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Standard et Pro sont disponibles en paiement mensuel ou annuel.
              En annuel, vous payez l&apos;équivalent de 10 mois pour 12 mois
              d&apos;utilisation, soit 2 mois offerts.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {(['free', 'standard', 'pro', 'enterprise'] as PlanCode[]).map(
              (planCode) => {
                const plan = PLAN_META[planCode]
                const isCurrent = currentPlanCode === planCode
                const isPending = pendingPlanCode === planCode
                const isRecommended = recommendedPlanCode === planCode

                return (
                  <article
                    key={planCode}
                    className={`relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-sm ${
                      isRecommended
                        ? 'border-emerald-400 ring-2 ring-emerald-100'
                        : 'border-slate-200'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute -top-3 left-5 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                        Recommandé
                      </div>
                    )}

                    <div>
                      <h3 className="text-xl font-black text-slate-950">
                        {plan.name}
                      </h3>
                      <p className="mt-2 font-black text-emerald-700">
                        {plan.price}
                      </p>
                      {plan.yearlyPrice && (
                        <p className="mt-1 text-xs font-bold leading-5 text-emerald-800">
                          {plan.yearlyPrice} · 2 mois offerts
                        </p>
                      )}
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        {plan.description}
                      </p>
                    </div>

                    <div className="mt-5 flex items-start gap-2 text-sm font-bold text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {plan.members}
                    </div>

                    <div className="mt-auto pt-6">
                      {planCode === 'standard' || planCode === 'pro' ? (
                        canManage ? (
                          <div className="space-y-3">
                            <SubscriptionCycleChoice
                              planCode={planCode}
                              cycle="monthly"
                              current={
                                isCurrent &&
                                currentBillingCycle === 'monthly'
                              }
                              pending={
                                isPending &&
                                pendingBillingCycle === 'monthly'
                              }
                            />

                            <SubscriptionCycleChoice
                              planCode={planCode}
                              cycle="yearly"
                              current={
                                isCurrent &&
                                currentBillingCycle === 'yearly'
                              }
                              pending={
                                isPending &&
                                pendingBillingCycle === 'yearly'
                              }
                            />

                            <p className="text-center text-[11px] font-bold leading-5 text-emerald-700">
                              Annuel : 2 mois offerts
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-500">
                            Réservé au responsable, président ou trésorier
                          </div>
                        )
                      ) : isCurrent ? (
                        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-700">
                          Formule actuelle
                        </div>
                      ) : isPending ? (
                        <div className="rounded-xl bg-amber-100 px-4 py-3 text-center text-sm font-black text-amber-800">
                          Paiement en attente
                        </div>
                      ) : planCode === 'enterprise' ? (
                        <Link
                          href="/contact?subject=Formule%20Entreprise"
                          className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm font-black text-slate-800 transition hover:bg-slate-100"
                        >
                          Demander une offre
                        </Link>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-bold leading-5 text-slate-500">
                          Le retour au Gratuit sera géré séparément à l&apos;échéance de la formule payante.
                        </div>
                      )}
                    </div>
                  </article>
                )
              }
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-7">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-950">
                Abonnement prêt, paiement séparé
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                EWUKAI prépare dès maintenant la demande d&apos;abonnement et
                la facture correspondante. Le règlement en ligne reste séparé
                et sera branché ensuite sur un prestataire sécurisé. Cette
                séparation évite qu&apos;une formule payante soit activée sans
                confirmation réelle du paiement.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function SubscriptionCycleChoice({
  planCode,
  cycle,
  current,
  pending,
}: {
  planCode: 'standard' | 'pro'
  cycle: BillingCycle
  current: boolean
  pending: boolean
}) {
  const price =
    subscriptionPriceLabel(
      planCode,
      cycle
    )

  const label =
    cycle === 'yearly'
      ? 'Annuel'
      : 'Mensuel'

  if (current) {
    return (
      <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-700">
        {label} actuel · {price}
      </div>
    )
  }

  if (pending) {
    return (
      <div className="rounded-xl bg-amber-100 px-4 py-3 text-center text-sm font-black text-amber-800">
        {label} en attente · {price}
      </div>
    )
  }

  return (
    <form action={requestSubscriptionCheckout}>
      <input
        type="hidden"
        name="planCode"
        value={planCode}
      />
      <input
        type="hidden"
        name="billingCycle"
        value={cycle}
      />

      <button
        type="submit"
        className={
          cycle === 'yearly'
            ? 'flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100'
            : 'flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800'
        }
      >
        <CreditCard className="h-4 w-4" />
        {label} · {price}
      </button>
    </form>
  )
}

function CapacityMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-slate-950">
        {value}
      </p>
    </div>
  )
}
function SummaryRow({
  label,
  value,
  strong = false,
  last = false,
}: {
  label: string
  value: string
  strong?: boolean
  last?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${
        last
          ? ''
          : 'border-b border-slate-100'
      }`}
    >
      <span className="font-semibold text-slate-500">
        {label}
      </span>

      <span
        className={
          strong
            ? 'text-right font-black text-slate-950'
            : 'text-right font-bold text-slate-800'
        }
      >
        {value}
      </span>
    </div>
  )
}

function HeroStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="min-w-[150px] rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-emerald-300">{icon}</div>
      <p className="mt-3 text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-emerald-700">{icon}</div>
      <p className="mt-3 text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: string
}) {
  const normalized =
    status.trim().toLowerCase()

  const active =
    normalized === 'active' ||
    normalized === 'trialing'

  const label =
    normalized === 'past_due'
      ? 'À régulariser'
      : normalized === 'trialing'
        ? 'Essai actif'
        : active
          ? 'Actif'
          : normalized || 'Actif'

  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-black ${
        active
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-amber-100 text-amber-800'
      }`}
    >
      {label}
    </span>
  )
}

function normalizeBillingCycle(
  value:
    | string
    | null
    | undefined
): BillingCycle | null {
  switch (
    value
      ?.trim()
      .toLowerCase()
  ) {
    case 'monthly':
      return 'monthly'
    case 'yearly':
      return 'yearly'
    default:
      return null
  }
}

function billingCycleShortLabel(
  cycle: BillingCycle
) {
  return cycle === 'yearly'
    ? 'annuel'
    : 'mensuel'
}

function billingCycleLongLabel(
  cycle:
    | BillingCycle
    | null
) {
  if (cycle === 'yearly') {
    return 'Annuel — 12 mois'
  }

  if (cycle === 'monthly') {
    return 'Mensuel — 30 jours'
  }

  return 'À confirmer'
}

function subscriptionPriceLabel(
  planCode: PlanCode,
  cycle:
    | BillingCycle
    | null
) {
  if (planCode === 'standard') {
    return cycle === 'yearly'
      ? '52 500 FCFA / 80 € par an'
      : '5 250 FCFA / 8 € par mois'
  }

  if (planCode === 'pro') {
    return cycle === 'yearly'
      ? '105 000 FCFA / 160 € par an'
      : '10 500 FCFA / 16 € par mois'
  }

  return PLAN_META[planCode].price
}

function normalizePlanCode(
  value:
    | string
    | null
    | undefined
): PlanCode {
  switch (
    value
      ?.trim()
      .toLowerCase()
  ) {
    case 'standard':
      return 'standard'
    case 'pro':
      return 'pro'
    case 'enterprise':
      return 'enterprise'
    case 'free':
    default:
      return 'free'
  }
}

function subscriptionPlanCode(
  subscription:
    | SubscriptionData
    | null
    | undefined
): PlanCode | null {
  const code =
    subscription?.plan?.code

  if (!code) {
    return null
  }

  return normalizePlanCode(code)
}

function formatMoney(
  value:
    | number
    | string
    | null
    | undefined
) {
  const amount = Number(value ?? 0)

  if (!Number.isFinite(amount)) {
    return '—'
  }

  return `${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`
}

function formatDate(
  value: string
) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle: 'medium',
    }
  ).format(date)
}

function formatDateTime(
  value: string
) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  ).format(date)
}
