import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import {
  ArrowRight,
  Building2,
  HandCoins,
  ShieldCheck,
  Users,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'À propos | EWUKAI',
  description:
    'Découvrez EWUKAI, la plateforme de gestion des organisations.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
              <Image
                src="/branding/ewukai-mark.png"
                alt="EWUKAI"
                width={44}
                height={44}
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <p className="font-black">
                EWUKAI
              </p>

              <p className="text-xs text-slate-500">
                La plateforme de gestion des organisations
              </p>
            </div>
          </Link>

          <Link
            href="/register"
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-800"
          >
            Créer mon organisation
          </Link>
        </div>
      </header>

      <section className="bg-[linear-gradient(135deg,#06101D,#071E2B_55%,#064E4B)] text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
            À propos
          </p>

          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Aider les organisations à mieux gérer,
            mieux suivre et mieux grandir.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            EWUKAI est une plateforme numérique conçue pour
            centraliser la gestion des membres, cotisations,
            paiements, trésorerie, reçus et rapports dans un
            espace clair, structuré et sécurisé.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <Building2 className="h-7 w-7 text-emerald-700" />

            <h2 className="mt-4 text-xl font-black">
              Une plateforme, plusieurs organisations
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Mutuelles, associations, ONG, tontines,
              coopératives, fondations, groupements, amicales
              et autres structures peuvent disposer de leur
              propre espace, de leurs membres et de leur identité.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <Users className="h-7 w-7 text-emerald-700" />

            <h2 className="mt-4 text-xl font-black">
              Chaque organisation reste indépendante
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Chaque organisation conserve la maîtrise de ses
              données, de ses paramètres, de ses responsables
              et de ses opérations. EWUKAI fournit
              l’infrastructure et les outils de gestion.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <HandCoins className="h-7 w-7 text-emerald-700" />

            <h2 className="mt-4 text-xl font-black">
              Les fonds restent sous le contrôle de l’organisation
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Lorsqu’un paiement en ligne est activé, la
              transaction est traitée par le prestataire de
              paiement configuré pour l’organisation. EWUKAI
              assure le lien technologique, le suivi et la
              traçabilité.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <ShieldCheck className="h-7 w-7 text-emerald-700" />

            <h2 className="mt-4 text-xl font-black">
              Transparence et sécurité
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Les accès sont organisés selon les rôles, les
              opérations importantes sont traçables et les
              membres peuvent consulter les informations qui
              leur sont destinées depuis leur espace personnel.
            </p>
          </article>
        </div>

        <div className="mt-10 rounded-3xl bg-emerald-50 p-7 sm:p-9">
          <h2 className="text-2xl font-black text-emerald-950">
            Notre ambition
          </h2>

          <p className="mt-3 max-w-3xl leading-7 text-emerald-900">
            Rendre la gestion associative et communautaire plus
            simple, plus lisible et plus professionnelle, sans
            effacer l’identité ni l’autonomie de chaque
            organisation.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white hover:bg-emerald-800"
            >
              Nous contacter
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/privacy"
              className="rounded-xl border border-emerald-200 bg-white px-5 py-3 font-black text-emerald-800"
            >
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
