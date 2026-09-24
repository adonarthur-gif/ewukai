import Link from 'next/link'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// EWUKAI
// ADMINISTRATION PLATEFORME
// PLANS & ABONNEMENTS
// ============================================================
//
// Cette page affiche le catalogue commercial EWUKAI.
//
// Grille actuelle :
//
// Gratuit
//   0 FCFA / mois
//   Jusqu'à 20 membres
//
// Standard
//   5 250 FCFA / mois
//   52 500 FCFA / an
//   21 à 50 membres
//
// Pro
//   10 500 FCFA / mois
//   105 000 FCFA / an
//   51 à 500 membres
//
// Entreprise
//   Sur devis
//   Plus de 500 membres
//
// ============================================================

// ============================================================
// TYPES
// ============================================================

type MoneyValue =
  | number
  | string
  | null

type PlanFeatures =
  Record<string, unknown>

type PlanRow = {
  plan_id: string

  code: string

  name: string

  description:
    | string
    | null

  monthly_price_xof:
    MoneyValue

  yearly_price_xof:
    MoneyValue

  member_limit:
    number
    | null

  is_custom_pricing:
    boolean

  is_active:
    boolean

  is_public:
    boolean

  sort_order:
    number

  features:
    PlanFeatures
    | null

  active_organizations:
    number
    | string
    | null

  created_at:
    string
    | null

  updated_at:
    string
    | null
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminPlansPage() {
  // ==========================================================
  // SUPER ADMIN
  // ==========================================================

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  // ==========================================================
  // RECUPERATION DES PLANS
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'list_platform_plans'
    )

  if (
    error
  ) {
    console.error(
      'EWUKAI - platform plans:',
      error
    )
  }

  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const plans =
    (
      Array.isArray(
        data
      )
        ? data
        : []
    )
      .map(
        normalizePlan
      )
      .filter(
        (
          plan
        ): plan is PlanRow =>
          plan !==
          null
      )

  // ==========================================================
  // STATISTIQUES
  // ==========================================================

  const activePlans =
    plans.filter(
      plan =>
        plan.is_active
    ).length

  const organizationsWithSubscription =
    plans.reduce(
      (
        total,
        plan
      ) =>
        total +
        numberValue(
          plan.active_organizations
        ),
      0
    )

  const freeOrganizations =
    plans
      .filter(
        plan =>
          plan.code ===
          'free'
      )
      .reduce(
        (
          total,
          plan
        ) =>
          total +
          numberValue(
            plan.active_organizations
          ),
        0
      )

  const paidOrganizations =
    plans
      .filter(
        plan =>
          [
            'standard',
            'pro',
            'enterprise',
          ].includes(
            plan.code
          )
      )
      .reduce(
        (
          total,
          plan
        ) =>
          total +
          numberValue(
            plan.active_organizations
          ),
        0
      )

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ==================================================== */}
      {/* HERO */}
      {/* ==================================================== */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Monétisation EWUKAI
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Plans & abonnements
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                Consultez les formules commerciales
                d&apos;EWUKAI, leurs limites de
                membres, leurs fonctionnalités et
                le nombre d&apos;organisations
                actuellement rattachées à chaque
                formule.
              </p>

            </div>

            <Link
              href="/admin/dashboard"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ← Tableau de bord
            </Link>

          </div>

        </div>

      </section>

      {/* ==================================================== */}
      {/* CONTENU */}
      {/* ==================================================== */}

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">

        {/* ================================================== */}
        {/* KPI */}
        {/* ================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            label="Formules"
            value={
              plans.length
            }
            note="Plans configurés"
          />

          <StatCard
            label="Plans actifs"
            value={
              activePlans
            }
            note="Disponibles actuellement"
          />

          <StatCard
            label="Organisations"
            value={
              organizationsWithSubscription
            }
            note="Avec abonnement courant"
          />

          <StatCard
            label="Abonnements payants"
            value={
              paidOrganizations
            }
            note={`${freeOrganizations.toLocaleString(
              'fr-FR'
            )} sur le plan Gratuit`}
          />

        </section>

        {/* ================================================== */}
        {/* ERREUR RPC */}
        {/* ================================================== */}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Impossible de charger les plans.
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              Vérifiez que la migration des
              abonnements a bien été exécutée et
              que la fonction
              list_platform_plans est disponible
              dans Supabase.
            </p>

          </section>
        )}

        {/* ================================================== */}
        {/* GRILLE DES PLANS */}
        {/* ================================================== */}

        {!error &&
          plans.length >
            0 && (
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

              {plans.map(
                plan => (
                  <PlanCard
                    key={
                      plan.plan_id
                    }
                    plan={
                      plan
                    }
                  />
                )
              )}

            </section>
          )}

        {/* ================================================== */}
        {/* AUCUN PLAN */}
        {/* ================================================== */}

        {!error &&
          plans.length ===
            0 && (
            <section className="rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                ◫
              </div>

              <p className="mt-4 font-black text-slate-900">
                Aucun plan disponible
              </p>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Exécutez la migration des plans
                et abonnements dans Supabase.
              </p>

            </section>
          )}

        {/* ================================================== */}
        {/* GRILLE TARIFAIRE */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-6 py-5">

            <h2 className="text-lg font-black text-slate-950">
              Grille tarifaire EWUKAI
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Répartition recommandée selon le nombre de membres de
              l&apos;organisation. Standard et Pro sont disponibles en
              paiement mensuel ou annuel.
            </p>

          </div>

          <div className="hidden overflow-x-auto sm:block">

            <table className="w-full border-collapse">

              <thead className="bg-slate-50">

                <tr>

                  <TableHeading>
                    Formule
                  </TableHeading>

                  <TableHeading>
                    Taille
                  </TableHeading>

                  <TableHeading align="right">
                    Mensuel
                  </TableHeading>

                  <TableHeading align="right">
                    Annuel
                  </TableHeading>

                  <TableHeading>
                    Positionnement
                  </TableHeading>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                <PricingRow
                  plan="Gratuit"
                  members="0 à 20 membres"
                  monthlyPrice="0 FCFA"
                  yearlyPrice="0 FCFA"
                  description="Découverte et petites organisations"
                />

                <PricingRow
                  plan="Standard"
                  members="21 à 50 membres"
                  monthlyPrice="5 250 FCFA"
                  yearlyPrice="52 500 FCFA"
                  description="Associations et mutuelles de petite taille"
                />

                <PricingRow
                  plan="Pro"
                  members="51 à 500 membres"
                  monthlyPrice="10 500 FCFA"
                  yearlyPrice="105 000 FCFA"
                  description="Organisations en croissance et grandes mutuelles"
                />

                <PricingRow
                  plan="Entreprise"
                  members="501 membres et plus"
                  monthlyPrice="Sur devis"
                  yearlyPrice="Sur devis"
                  description="Fédérations, réseaux et grandes structures"
                />

              </tbody>

            </table>

          </div>

          {/* MOBILE */}

          <div className="divide-y divide-slate-100 sm:hidden">

            <MobilePricing
              plan="Gratuit"
              members="0 à 20 membres"
              monthlyPrice="0 FCFA"
              yearlyPrice="0 FCFA"
            />

            <MobilePricing
              plan="Standard"
              members="21 à 50 membres"
              monthlyPrice="5 250 FCFA"
              yearlyPrice="52 500 FCFA"
            />

            <MobilePricing
              plan="Pro"
              members="51 à 500 membres"
              monthlyPrice="10 500 FCFA"
              yearlyPrice="105 000 FCFA"
            />

            <MobilePricing
              plan="Entreprise"
              members="501 membres et plus"
              monthlyPrice="Sur devis"
              yearlyPrice="Sur devis"
            />

          </div>

          <div className="border-t border-emerald-100 bg-emerald-50 px-6 py-4">

            <p className="text-center text-xs font-black leading-5 text-emerald-800 sm:text-sm">
              Standard et Pro en annuel : 12 mois d&apos;utilisation pour
              le prix de 10 mois, soit 2 mois offerts.
            </p>

          </div>

        </section>

        {/* ================================================== */}
        {/* LOGIQUE D'ABONNEMENT */}
        {/* ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div>

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Fonctionnement
            </p>

            <h2 className="mt-2 text-xl font-black text-slate-950">
              Cycle d&apos;abonnement
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Toute nouvelle organisation
              démarre sur Gratuit. EWUKAI peut
              ensuite recommander une formule
              adaptée au nombre de membres, sans
              déclencher automatiquement une
              facturation.
            </p>

          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            <InfoCard
              number="1"
              title="Création"
              description="Toute nouvelle organisation reçoit automatiquement le plan Gratuit."
            />

            <InfoCard
              number="2"
              title="Évolution"
              description="Le plan recommandé évolue en fonction du nombre de membres de l’organisation."
            />

            <InfoCard
              number="3"
              title="Souscription"
              description="Le passage vers une formule payante sera confirmé par une procédure d’abonnement et de paiement."
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* REGLE IMPORTANTE */}
        {/* ================================================== */}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Séparation entre recommandation et facturation
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            Le dépassement d&apos;une limite de
            membres pourra déclencher une alerte
            ou une recommandation de changement
            de formule. EWUKAI ne doit pas
            facturer automatiquement une
            organisation sans processus
            d&apos;abonnement explicite.
          </p>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// CARTE PLAN
// ============================================================

function PlanCard({
  plan,
}: {
  plan: PlanRow
}) {
  const monthlyPrice =
    numberValue(
      plan.monthly_price_xof
    )

  const yearlyPrice =
    numberValue(
      plan.yearly_price_xof
    )

  const organizations =
    numberValue(
      plan.active_organizations
    )

  const range =
    getPlanRange(
      plan.code,
      plan.member_limit
    )

  const featured =
    plan.code ===
    'pro'

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ${
        featured
          ? 'border-2 border-emerald-500'
          : 'border border-slate-200'
      }`}
    >

      {featured && (
        <div className="bg-emerald-600 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.15em] text-white">
          Offre recommandée pour les organisations en croissance
        </div>
      )}

      {/* HEADER */}

      <div className="border-b border-slate-100 p-6">

        <div className="flex items-start justify-between gap-3">

          <div className="min-w-0">

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              {
                plan.code
              }
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {
                plan.name
              }
            </h2>

          </div>

          <StatusBadge
            active={
              plan.is_active
            }
          />

        </div>

        {/* PRIX */}

        <div className="mt-6">

          {plan.is_custom_pricing ? (

            <div>

              <p className="text-3xl font-black text-slate-950">
                Sur devis
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Offre personnalisée
              </p>

            </div>

          ) : monthlyPrice === 0 ? (

            <div>

              <div className="flex flex-wrap items-end gap-1">

                <span className="text-3xl font-black text-slate-950">
                  0
                </span>

                <span className="pb-1 text-sm font-bold text-slate-400">
                  FCFA
                </span>

              </div>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Gratuit
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              <div>

                <div className="flex flex-wrap items-end gap-1">

                  <span className="text-3xl font-black text-slate-950">
                    {formatMoney(
                      monthlyPrice
                    )}
                  </span>

                  <span className="pb-1 text-sm font-bold text-slate-400">
                    FCFA
                  </span>

                </div>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  par mois
                </p>

              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">

                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  Formule annuelle
                </p>

                <p className="mt-1 text-sm font-black text-slate-950">
                  {formatMoney(
                    yearlyPrice
                  )}{' '}
                  FCFA / an
                </p>

                <p className="mt-1 text-[11px] font-bold text-emerald-700">
                  2 mois offerts
                </p>

              </div>

            </div>

          )}

        </div>

        {/* DESCRIPTION */}

        <p className="mt-5 min-h-[72px] text-sm leading-6 text-slate-500">
          {plan.description ||
            'Aucune description disponible.'}
        </p>

      </div>

      {/* CORPS */}

      <div className="flex flex-1 flex-col p-6">

        <div className="space-y-4">

          <PlanInfo
            label="Taille"
            value={
              range
            }
          />

          <PlanInfo
            label="Limite"
            value={
              plan.member_limit ===
              null
                ? 'Personnalisée'
                : `${plan.member_limit.toLocaleString(
                    'fr-FR'
                  )} membres`
            }
          />

          <PlanInfo
            label="Organisations"
            value={
              organizations.toLocaleString(
                'fr-FR'
              )
            }
          />

          <PlanInfo
            label="Visibilité"
            value={
              plan.is_public
                ? 'Public'
                : 'Interne'
            }
          />

        </div>

        {/* FEATURES */}

        <div className="mt-6 flex-1 border-t border-slate-100 pt-5">

          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Fonctionnalités incluses
          </p>

          <div className="mt-4 space-y-2.5">

            {featureLabels(
              plan.features
            ).map(
              feature => (
                <div
                  key={
                    feature
                  }
                  className="flex items-start gap-2 text-sm font-semibold text-slate-600"
                >

                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-black text-emerald-700">
                    ✓
                  </span>

                  <span>
                    {
                      feature
                    }
                  </span>

                </div>
              )
            )}

          </div>

        </div>

        {/* FOOTER */}

        <div className="mt-6 border-t border-slate-100 pt-4">

          <p className="text-xs font-semibold text-slate-400">
            Mis à jour :{' '}
            {formatDate(
              plan.updated_at
            )}
          </p>

        </div>

      </div>

    </article>
  )
}

// ============================================================
// COMPONENTS
// ============================================================

function StatCard({
  label,
  value,
  note,
}: {
  label: string
  value: number
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
        {value.toLocaleString(
          'fr-FR'
        )}
      </p>

      <p className="mt-2 text-xs font-medium text-slate-500">
        {
          note
        }
      </p>

    </div>
  )
}

function PlanInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">

      <span className="text-sm font-semibold text-slate-500">
        {
          label
        }
      </span>

      <span className="text-right text-sm font-black text-slate-900">
        {
          value
        }
      </span>

    </div>
  )
}

function StatusBadge({
  active,
}: {
  active: boolean
}) {
  return (
    <span
      className={
        active
          ? 'shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700'
          : 'shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500'
      }
    >
      {active
        ? 'Actif'
        : 'Inactif'}
    </span>
  )
}

function InfoCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">

      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
        {
          number
        }
      </div>

      <p className="mt-4 font-black text-slate-900">
        {
          title
        }
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {
          description
        }
      </p>

    </div>
  )
}

function TableHeading({
  children,
  align = 'left',
}: {
  children:
    React.ReactNode

  align?:
    | 'left'
    | 'right'
}) {
  return (
    <th
      className={`whitespace-nowrap px-6 py-3 text-xs font-black uppercase tracking-wide text-slate-400 ${
        align ===
        'right'
          ? 'text-right'
          : 'text-left'
      }`}
    >
      {
        children
      }
    </th>
  )
}

function PricingRow({
  plan,
  members,
  monthlyPrice,
  yearlyPrice,
  description,
}: {
  plan: string
  members: string
  monthlyPrice: string
  yearlyPrice: string
  description: string
}) {
  return (
    <tr>

      <td className="px-6 py-5 font-black text-slate-900">
        {
          plan
        }
      </td>

      <td className="px-6 py-5 text-sm font-semibold text-slate-600">
        {
          members
        }
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-right font-black text-slate-900">
        {
          monthlyPrice
        }
      </td>

      <td className="whitespace-nowrap px-6 py-5 text-right font-black text-emerald-700">
        {
          yearlyPrice
        }
      </td>

      <td className="px-6 py-5 text-sm text-slate-500">
        {
          description
        }
      </td>

    </tr>
  )
}

function MobilePricing({
  plan,
  members,
  monthlyPrice,
  yearlyPrice,
}: {
  plan: string
  members: string
  monthlyPrice: string
  yearlyPrice: string
}) {
  return (
    <div className="p-5">

      <div className="flex items-start justify-between gap-3">

        <div>

          <p className="font-black text-slate-900">
            {
              plan
            }
          </p>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            {
              members
            }
          </p>

        </div>

        <div className="text-right">

          <p className="text-sm font-black text-slate-900">
            {
              monthlyPrice
            }
          </p>

          <p className="mt-1 text-xs font-bold text-slate-500">
            par mois
          </p>

          <p className="mt-3 text-sm font-black text-emerald-700">
            {
              yearlyPrice
            }
          </p>

          <p className="mt-1 text-xs font-bold text-emerald-700">
            par an
          </p>

        </div>

      </div>

    </div>
  )
}

// ============================================================
// NORMALISATION
// ============================================================

function normalizePlan(
  value: unknown
): PlanRow | null {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return null
  }

  const raw =
    value as Record<
      string,
      unknown
    >

  const planId =
    stringValue(
      raw.plan_id
    )

  const code =
    stringValue(
      raw.code
    )

  const name =
    stringValue(
      raw.name
    )

  if (
    !planId ||
    !code ||
    !name
  ) {
    return null
  }

  return {
    plan_id:
      planId,

    code,

    name,

    description:
      nullableString(
        raw.description
      ),

    monthly_price_xof:
      moneyValue(
        raw.monthly_price_xof
      ),

    yearly_price_xof:
      moneyValue(
        raw.yearly_price_xof
      ),

    member_limit:
      nullableInteger(
        raw.member_limit
      ),

    is_custom_pricing:
      Boolean(
        raw.is_custom_pricing
      ),

    is_active:
      Boolean(
        raw.is_active
      ),

    is_public:
      Boolean(
        raw.is_public
      ),

    sort_order:
      numberValue(
        raw.sort_order
      ),

    features:
      normalizeFeatures(
        raw.features
      ),

    active_organizations:
      moneyValue(
        raw.active_organizations
      ),

    created_at:
      nullableString(
        raw.created_at
      ),

    updated_at:
      nullableString(
        raw.updated_at
      ),
  }
}

function normalizeFeatures(
  value: unknown
): PlanFeatures {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return {}
  }

  return value as PlanFeatures
}

// ============================================================
// HELPERS
// ============================================================

function stringValue(
  value: unknown
) {
  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value.trim()
}

function nullableString(
  value: unknown
) {
  const text =
    stringValue(
      value
    )

  return text ||
    null
}

function moneyValue(
  value: unknown
): MoneyValue {
  if (
    typeof value ===
      'number' ||
    typeof value ===
      'string'
  ) {
    return value
  }

  return null
}

function numberValue(
  value: unknown
) {
  const parsed =
    Number(
      value ??
        0
    )

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0
}

function nullableInteger(
  value: unknown
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  const parsed =
    Number(
      value
    )

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null
  }

  return Math.trunc(
    parsed
  )
}

function formatMoney(
  value: number
) {
  return Math.round(
    value
  ).toLocaleString(
    'fr-FR'
  )
}

function getPlanRange(
  code: string,
  memberLimit:
    | number
    | null
) {
  switch (
    code
      .trim()
      .toLowerCase()
  ) {
    case 'free':
      return '0 à 20 membres'

    case 'standard':
      return '21 à 50 membres'

    case 'pro':
      return '51 à 500 membres'

    case 'enterprise':
      return '501 membres et plus'

    default:
      return memberLimit ===
        null
        ? 'Personnalisé'
        : `Jusqu'à ${memberLimit.toLocaleString(
            'fr-FR'
          )} membres`
  }
}

function featureLabels(
  features:
    | PlanFeatures
    | null
) {
  if (
    !features
  ) {
    return []
  }

  const labels:
    Record<
      string,
      string
    > = {
      members:
        'Gestion des membres',

      contributions:
        'Gestion des cotisations',

      basic_dashboard:
        'Tableau de bord',

      receipts:
        'Reçus',

      treasury:
        'Gestion de trésorerie',

      advanced_reports:
        'Rapports avancés',

      automation:
        'Automatisations',

      priority_support:
        'Support prioritaire',

      custom_integrations:
        'Intégrations personnalisées',
    }

  return Object
    .entries(
      features
    )
    .filter(
      (
        [
          ,
          enabled,
        ]
      ) =>
        enabled ===
        true
    )
    .map(
      (
        [
          key,
        ]
      ) =>
        labels[key] ??
        key
    )
}

function formatDate(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return '—'
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
    return '—'
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    }
  ).format(
    date
  )
}