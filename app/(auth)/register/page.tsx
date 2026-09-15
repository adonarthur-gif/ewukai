import Link from 'next/link'

import {
  CheckCircle2,
  Crown,
} from 'lucide-react'

import EwukaiBrand from '@/components/branding/ewukai-brand'

import {
  register,
} from './actions'

// ============================================================
// EWUKAI
// PAGE INSCRIPTION RESPONSABLE
// ============================================================

type PlanCode =
  | 'free'
  | 'standard'
  | 'pro'
  | 'enterprise'

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string
    plan?: string
  }>
}

const plans:
  Record<
    PlanCode,
    {
      name: string
      price: string
      description: string
      memberLimit: string
    }
  > = {
  free: {
    name:
      'Gratuit',

    price:
      '0 FCFA',

    description:
      'Pour commencer simplement avec EWUKAI.',

    memberLimit:
      "Jusqu'à 20 membres",
  },

  standard: {
    name:
      'Standard',

    price:
      '5 000 FCFA / 30 jours',

    description:
      'Pour les petites et moyennes organisations.',

    memberLimit:
      "Jusqu'à 50 membres",
  },

  pro: {
    name:
      'Pro',

    price:
      '10 000 FCFA / 30 jours',

    description:
      'Pour les organisations en croissance.',

    memberLimit:
      "Jusqu'à 500 membres",
  },

  enterprise: {
    name:
      'Entreprise',

    price:
      'Sur devis',

    description:
      'Pour les structures de grande taille ou ayant des besoins spécifiques.',

    memberLimit:
      'Plus de 500 membres',
  },
}

// ============================================================
// PAGE
// ============================================================

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const params =
    await searchParams

  const selectedPlan =
    normalizePlanCode(
      params.plan
    )

  const plan =
    plans[
      selectedPlan
    ]

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#ECFDF5_100%)] px-4 py-10">

      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">

        {/* ================================================== */}
        {/* FORMULE CHOISIE */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">

          <div className="p-7 sm:p-8">

            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
              Votre formule
            </p>

            <div className="mt-5 flex items-center gap-3">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">

                {selectedPlan ===
                'pro' ? (
                  <Crown className="h-6 w-6" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}

              </div>

              <div>

                <h1 className="text-2xl font-black">
                  {plan.name}
                </h1>

                <p className="mt-1 text-sm font-black text-emerald-300">
                  {plan.price}
                </p>

              </div>

            </div>

            <p className="mt-6 text-sm leading-6 text-slate-300">
              {plan.description}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">

              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Capacité
              </p>

              <p className="mt-1 font-black text-white">
                {plan.memberLimit}
              </p>

            </div>

            {selectedPlan ===
              'standard' && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">

                <p className="text-sm font-black text-emerald-300">
                  Paiement après création
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Après la création de votre
                  organisation, une facture de
                  5 000 FCFA sera préparée.
                  Votre formule sera activée
                  automatiquement après
                  confirmation du paiement.
                </p>

              </div>
            )}

            {selectedPlan ===
              'pro' && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">

                <p className="text-sm font-black text-emerald-300">
                  Paiement après création
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Après la création de votre
                  organisation, une facture de
                  10 000 FCFA sera préparée.
                  Votre formule sera activée
                  automatiquement après
                  confirmation du paiement.
                </p>

              </div>
            )}

            {selectedPlan ===
              'free' && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">

                <p className="text-sm font-black text-emerald-300">
                  Aucun paiement nécessaire
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Votre formule gratuite sera
                  disponible immédiatement après
                  la création de l&apos;organisation.
                </p>

              </div>
            )}

            {selectedPlan ===
              'enterprise' && (
              <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">

                <p className="text-sm font-black text-blue-300">
                  Offre personnalisée
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Après la création de votre
                  organisation, EWUKAI pourra
                  préparer une offre adaptée à
                  vos besoins.
                </p>

              </div>
            )}

            <Link
              href="/#tarifs"
              className="mt-6 inline-flex text-sm font-black text-emerald-300 transition hover:text-emerald-200"
            >
              ← Changer de formule
            </Link>

          </div>

        </section>

        {/* ================================================== */}
        {/* INSCRIPTION */}
        {/* ================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-950/5 sm:p-8">

          <div className="mb-8">

            <EwukaiBrand variant="compact" href="/" showTagline />

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Créer mon compte
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Ce compte deviendra le compte
              Responsable de votre organisation.
            </p>

          </div>

          {/* ================================================== */}
          {/* ERREUR */}
          {/* ================================================== */}

          {params.error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">

              <p className="text-sm font-bold text-red-700">
                {params.error}
              </p>

            </div>
          )}

          {/* ================================================== */}
          {/* FORMULAIRE */}
          {/* ================================================== */}

          <form
            action={register}
            className="space-y-5"
          >

            {/* PLAN CACHE */}

            <input
              type="hidden"
              name="planCode"
              value={selectedPlan}
            />

            {/* NOM */}

            <div>

              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-black text-slate-700"
              >
                Nom et prénoms
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                placeholder="Ex. ADON Krist Arthur"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />

            </div>

            {/* EMAIL */}

            <div>

              <label
                htmlFor="email"
                className="mb-2 block text-sm font-black text-slate-700"
              >
                Adresse e-mail
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="exemple@email.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />

            </div>

            {/* PASSWORD */}

            <div>

              <label
                htmlFor="password"
                className="mb-2 block text-sm font-black text-slate-700"
              >
                Mot de passe
              </label>

              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Minimum 8 caractères"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />

              <p className="mt-2 text-xs text-slate-500">
                Minimum 8 caractères.
              </p>

            </div>

            {/* CTA */}

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-700 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
            >
              Créer mon compte
            </button>

          </form>

          {/* ================================================== */}
          {/* LOGIN */}
          {/* ================================================== */}

          <div className="mt-7 border-t border-slate-200 pt-6 text-center">

            <p className="text-sm text-slate-500">
              Vous avez déjà un compte ?
            </p>

            <Link
              href={`/login?plan=${encodeURIComponent(
                selectedPlan
              )}`}
              className="mt-2 inline-flex font-black text-emerald-700 transition hover:text-emerald-800"
            >
              Se connecter
            </Link>

          </div>

        </section>

      </div>

    </main>
  )
}

// ============================================================
// PLAN
// ============================================================

function normalizePlanCode(
  value:
    | string
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