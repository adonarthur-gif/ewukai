import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Crown,
  Sparkles,
} from 'lucide-react'

// ============================================================
// AFRI CLUB
// TARIFS PAGE D'ACCUEIL
// ============================================================

const plans = [
  {
    code: 'free',
    name: 'Gratuit',
    price: '0',
    suffix: 'FCFA',
    description:
      'Pour découvrir Afri Club et commencer simplement.',
    memberLimit:
      'Jusqu’à 20 membres',
    featured: false,
    badge: null,
    features: [
      'Gestion des membres',
      'Cotisations',
      'Trésorerie',
      'Reçus',
      'Espace de gestion',
    ],
    cta:
      'Commencer gratuitement',
  },

  {
    code: 'standard',
    name: 'Standard',
    price: '5 000',
    suffix: 'FCFA / 30 jours',
    description:
      'Pour les organisations qui souhaitent aller plus loin.',
    memberLimit:
      'Jusqu’à 50 membres',
    featured: false,
    badge: null,
    features: [
      'Toutes les fonctions essentielles',
      'Gestion jusqu’à 50 membres',
      'Suivi des cotisations',
      'Trésorerie et reçus',
      'Traçabilité des opérations',
    ],
    cta:
      'Choisir Standard',
  },

  {
    code: 'pro',
    name: 'Pro',
    price: '10 000',
    suffix: 'FCFA / 30 jours',
    description:
      'Pour les organisations en croissance et les grandes communautés.',
    memberLimit:
      'Jusqu’à 500 membres',
    featured: true,
    badge:
      'Recommandé',
    features: [
      'Toutes les fonctions Standard',
      'Gestion jusqu’à 500 membres',
      'Suivi financier avancé',
      'Historique complet',
      'Pilotage centralisé',
    ],
    cta:
      'Choisir Pro',
  },

  {
    code: 'enterprise',
    name: 'Entreprise',
    price: 'Sur devis',
    suffix: '',
    description:
      'Pour les structures ayant des besoins importants ou spécifiques.',
    memberLimit:
      'Plus de 500 membres',
    featured: false,
    badge: null,
    features: [
      'Volume important de membres',
      'Accompagnement personnalisé',
      'Configuration adaptée',
      'Support dédié',
      'Solutions spécifiques',
    ],
    cta:
      'Nous contacter',
  },
]

export default function PricingSection() {
  return (
    <section
      id="tarifs"
      className="border-y border-slate-200 bg-slate-50"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Des formules simples et transparentes
            </span>
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Une formule adaptée à votre organisation
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Commencez gratuitement puis évoluez selon la taille et les besoins de votre organisation. Les formules payantes sont activées automatiquement après confirmation du paiement intégral.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.code}
              className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg ${
                plan.featured
                  ? 'border-emerald-500 bg-slate-950 text-white'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {plan.badge && (
                <div className="absolute right-4 top-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">
                    <Crown className="h-3 w-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div>
                <p
                  className={`text-xs font-black uppercase tracking-[0.16em] ${
                    plan.featured
                      ? 'text-emerald-400'
                      : 'text-emerald-700'
                  }`}
                >
                  {plan.name}
                </p>

                <div className="mt-5">
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span
                      className={`text-4xl font-black tracking-tight ${
                        plan.featured
                          ? 'text-white'
                          : 'text-slate-950'
                      }`}
                    >
                      {plan.price}
                    </span>

                    {plan.suffix && (
                      <span
                        className={`pb-1 text-xs font-black ${
                          plan.featured
                            ? 'text-slate-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {plan.suffix}
                      </span>
                    )}
                  </div>
                </div>

                <p
                  className={`mt-4 min-h-[72px] text-sm leading-6 ${
                    plan.featured
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  {plan.description}
                </p>
              </div>

              <div
                className={`mt-5 rounded-2xl px-4 py-3 ${
                  plan.featured
                    ? 'bg-white/10'
                    : 'bg-slate-50'
                }`}
              >
                <p
                  className={`text-xs font-black uppercase tracking-wide ${
                    plan.featured
                      ? 'text-emerald-300'
                      : 'text-slate-400'
                  }`}
                >
                  Capacité
                </p>

                <p
                  className={`mt-1 text-sm font-black ${
                    plan.featured
                      ? 'text-white'
                      : 'text-slate-900'
                  }`}
                >
                  {plan.memberLimit}
                </p>
              </div>

              <div className="mt-6 flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          plan.featured
                            ? 'bg-emerald-400/20'
                            : 'bg-emerald-50'
                        }`}
                      >
                        <Check
                          className={`h-3 w-3 ${
                            plan.featured
                              ? 'text-emerald-300'
                              : 'text-emerald-700'
                          }`}
                        />
                      </span>

                      <span
                        className={`text-sm font-semibold leading-5 ${
                          plan.featured
                            ? 'text-slate-300'
                            : 'text-slate-600'
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={`/register?plan=${plan.code}`}
                className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                  plan.featured
                    ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                    : plan.code === 'enterprise'
                      ? 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      : 'bg-slate-950 text-white hover:bg-slate-800'
                }`}
              >
                {plan.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-emerald-100 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-black text-slate-900">
            Vous pouvez commencer gratuitement et changer de formule plus tard.
          </p>

          <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
            Pour Standard et Pro, les 30 jours commencent à partir de la confirmation effective du paiement. Aucun paiement partiel n’active une formule.
          </p>
        </div>
      </div>
    </section>
  )
}
