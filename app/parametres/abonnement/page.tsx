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
  startCinetPayPayment,
} from './actions'

type PlanCode =
  | 'free'
  | 'standard'
  | 'pro'
  | 'enterprise'

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
  created_at?: string | null
  plan?: SubscriptionPlan | null
}

type InvoiceData = {
  id?: string | null
  invoice_number?: string | null
  status?: string | null
  currency?: string | null
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

type SubscriptionPageProps = {
  searchParams: Promise<{
    checkout?: string
    plan?: string
    invoice?: string
    error?: string
    payment?: string
  }>
}

const PLAN_META: Record<
  PlanCode,
  {
    name: string
    price: string
    members: string
    description: string
  }
> = {
  free: {
    name: 'Gratuit',
    price: '0 FCFA',
    members: "Jusqu'à 20 membres",
    description: 'Pour démarrer et gérer une petite organisation.',
  },
  standard: {
    name: 'Standard',
    price: '5 000 FCFA / 30 jours',
    members: "Jusqu'à 50 membres",
    description: 'Pour une organisation qui structure sa gestion et son suivi.',
  },
  pro: {
    name: 'Pro',
    price: '10 000 FCFA / 30 jours',
    members: "Jusqu'à 500 membres",
    description: 'Pour les organisations en croissance avec un volume important de membres.',
  },
  enterprise: {
    name: 'Entreprise',
    price: 'Sur devis',
    members: 'Plus de 500 membres',
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
                Votre demande de changement de formule est prête.
              </p>
              <p className="mt-1 leading-6 text-emerald-800">
                La facture a été préparée. Aucun abonnement payant
                n&apos;est activé tant que le prestataire de paiement
                n&apos;a pas confirmé le règlement intégral.
              </p>
            </div>
          </div>
        )}

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
                  {currentMeta.price}
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
              {activeMembers > 1 ? 's' : ''} actif
              {activeMembers > 1 ? 's' : ''}, cette formule correspond
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

        {params.payment === 'returned' && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">
                Retour du guichet de paiement reçu.
              </p>
              <p className="mt-1 leading-6 text-blue-800">
                EWUKAI n&apos;active jamais une formule à partir du retour navigateur.
                L&apos;activation intervient uniquement après la notification CinetPay
                et la vérification serveur du paiement. Si le statut n&apos;a pas encore
                changé, actualisez cette page dans quelques instants.
              </p>
            </div>
          </div>
        )}

        {pendingSubscription && pendingPlanCode && pendingInvoice && (
          <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-white">
                  <ReceiptText className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                    Paiement en attente
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {PLAN_META[pendingPlanCode].name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Facture <strong>{pendingInvoice.invoice_number || 'préparée'}</strong>
                    {' '}— montant exact à régler :{' '}
                    <strong>{formatMoney(pendingInvoice.total_xof)}</strong>.
                  </p>

                  {pendingInvoice.due_at && (
                    <p className="mt-1 text-xs text-slate-600">
                      Échéance : {formatDateTime(pendingInvoice.due_at)}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white px-5 py-4 text-sm">
                <p className="font-black text-slate-900">
                  Paiement sécurisé
                </p>

                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                  Vous serez redirigé vers le guichet CinetPay. Le montant
                  provient directement de la facture EWUKAI et ne peut pas
                  être modifié depuis le navigateur.
                </p>

                {canManage ? (
                  <form
                    action={startCinetPayPayment}
                    className="mt-3"
                  >
                    <input
                      type="hidden"
                      name="invoiceId"
                      value={pendingInvoice.id ?? ''}
                    />

                    <button
                      type="submit"
                      disabled={!pendingInvoice.id}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <CreditCard className="h-4 w-4" />
                      Payer {formatMoney(pendingInvoice.total_xof)}
                    </button>
                  </form>
                ) : (
                  <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-500">
                    Réservé au responsable, président ou trésorier
                  </div>
                )}

                <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-500">
                  Seul le règlement intégral confirmé par CinetPay active la formule.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Nos formules
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
              Choisissez la capacité adaptée à votre organisation
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Standard et Pro sont facturés pour 30 jours complets.
              Seul le paiement intégral confirmé active une formule.
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
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        {plan.description}
                      </p>
                    </div>

                    <div className="mt-5 flex items-start gap-2 text-sm font-bold text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {plan.members}
                    </div>

                    <div className="mt-auto pt-6">
                      {isCurrent ? (
                        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-700">
                          Formule actuelle
                        </div>
                      ) : isPending ? (
                        <div className="rounded-xl bg-amber-100 px-4 py-3 text-center text-sm font-black text-amber-800">
                          Paiement en attente
                        </div>
                      ) : planCode === 'standard' || planCode === 'pro' ? (
                        canManage ? (
                          <form action={requestSubscriptionCheckout}>
                            <input
                              type="hidden"
                              name="planCode"
                              value={planCode}
                            />
                            <button
                              type="submit"
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
                            >
                              <CreditCard className="h-4 w-4" />
                              Choisir {plan.name}
                            </button>
                          </form>
                        ) : (
                          <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-500">
                            Réservé au responsable, président ou trésorier
                          </div>
                        )
                      ) : planCode === 'enterprise' ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-black text-slate-700">
                          Offre commerciale sur devis
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-bold leading-5 text-slate-500">
                          Le retour au Gratuit sera ajouté avec la gestion des changements de formule.
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
                Paiement et activation sécurisés
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                Le navigateur ne décide jamais du montant payé ni de
                l&apos;activation. Pour Standard et Pro, EWUKAI attendra
                la confirmation authentique du prestataire de paiement.
                Une confirmation valide donnera droit à 30 jours d&apos;accès
                selon les règles de l&apos;abonnement.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
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
