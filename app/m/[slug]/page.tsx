import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{
    slug: string
  }>
}

type PublicMutual = {
  organization_id: string
  name: string
  short_name: string | null
  slug: string
  online_membership_enabled: boolean

  logo_path: string | null
  cover_image_path: string | null

  slogan: string | null
  short_description: string | null

  about: string | null
  history: string | null
  mission: string | null
  vision: string | null
  values: string | null
  objectives: string | null
  president_message: string | null

  public_phone: string | null
  public_email: string | null
  location: string | null

  show_member_count: boolean
  member_count: number

  show_leadership: boolean
  show_projects: boolean
  show_news: boolean
}

export default async function PublicMutualPage({
  params,
}: PageProps) {
  const { slug } = await params

  const supabase =
    await createClient()

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_public_mutual_space',
      {
        target_slug: slug,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - public mutual:',
      error
    )

    notFound()
  }

  const mutual =
    data as PublicMutual | null

  if (!mutual) {
    notFound()
  }

  const shortName =
    mutual.short_name ||
    mutual.name

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ==================================================== */}
      {/* HERO */}
      {/* ==================================================== */}

      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 text-white">

        <div className="absolute inset-0 opacity-10">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-emerald-300 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">

          {/* NAV PUBLIQUE */}

          <header className="flex items-center justify-between gap-4">

            <Link
              href={`/m/${mutual.slug}`}
              className="flex items-center gap-3"
            >

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-black text-emerald-900 shadow-lg">
                {initials(
                  shortName
                )}
              </div>

              <div>
                <p className="font-black">
                  {shortName}
                </p>

                <p className="text-xs text-emerald-100">
                  Espace officiel de la mutuelle
                </p>
              </div>

            </Link>

            <div className="flex items-center gap-2">

              <Link
                href="/login"
                className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Se connecter
              </Link>

              {mutual.online_membership_enabled && (
                <Link
                  href={`/m/${mutual.slug}/join`}
                  className="hidden rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50 sm:inline-flex"
                >
                  Devenir membre
                </Link>
              )}

            </div>

          </header>

          {/* HERO CONTENT */}

          <div className="grid gap-12 py-16 lg:grid-cols-[1.3fr_0.7fr] lg:items-center lg:py-24">

            <div>

              <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                Bienvenue dans notre communauté
              </p>

              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                {mutual.name}
              </h1>

              {mutual.slogan && (
                <p className="mt-5 max-w-3xl text-xl font-semibold leading-8 text-emerald-100">
                  {mutual.slogan}
                </p>
              )}

              <p className="mt-6 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">
                {mutual.short_description ||
                  'Une communauté organisée autour de la solidarité, de l’entraide et du développement de ses membres.'}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">

                {mutual.online_membership_enabled && (
                  <Link
                    href={`/m/${mutual.slug}/join`}
                    className="rounded-2xl bg-emerald-400 px-6 py-3.5 font-black text-emerald-950 shadow-lg transition hover:bg-emerald-300"
                  >
                    Devenir membre
                  </Link>
                )}

                <Link
                  href="/login"
                  className="rounded-2xl border border-white/30 px-6 py-3.5 font-bold text-white transition hover:bg-white/10"
                >
                  Je suis déjà membre
                </Link>

              </div>

            </div>

            {/* CARTE */}

            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                Notre communauté
              </p>

              {mutual.show_member_count && (
                <div className="mt-5">

                  <p className="text-5xl font-black">
                    {new Intl.NumberFormat(
                      'fr-FR'
                    ).format(
                      Number(
                        mutual.member_count ||
                        0
                      )
                    )}
                  </p>

                  <p className="mt-1 text-sm text-emerald-100">
                    membre
                    {Number(
                      mutual.member_count
                    ) > 1
                      ? 's'
                      : ''}{' '}
                    actif
                    {Number(
                      mutual.member_count
                    ) > 1
                      ? 's'
                      : ''}
                  </p>

                </div>
              )}

              <div className="mt-6 space-y-4 border-t border-white/15 pt-5">

                {mutual.location && (
                  <PublicInfo
                    label="Localisation"
                    value={
                      mutual.location
                    }
                  />
                )}

                {mutual.public_phone && (
                  <PublicInfo
                    label="Contact"
                    value={
                      mutual.public_phone
                    }
                  />
                )}

                {mutual.public_email && (
                  <PublicInfo
                    label="Email"
                    value={
                      mutual.public_email
                    }
                  />
                )}

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ==================================================== */}
      {/* PRESENTATION */}
      {/* ==================================================== */}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">

        <div className="mx-auto max-w-3xl text-center">

          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
            Qui sommes-nous ?
          </p>

          <h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">
            Une mutuelle au service de ses membres
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            {mutual.about ||
              mutual.short_description ||
              'Notre mutuelle rassemble ses membres autour de valeurs de solidarité, d’entraide, de responsabilité et de développement collectif.'}
          </p>

        </div>

      </section>

      {/* ==================================================== */}
      {/* MISSION / VISION / VALEURS */}
      {/* ==================================================== */}

      <section className="border-y bg-white">

        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 lg:grid-cols-3">

          <InfoCard
            number="01"
            title="Notre mission"
            text={
              mutual.mission ||
              'Renforcer la solidarité entre les membres et contribuer à leur épanouissement.'
            }
          />

          <InfoCard
            number="02"
            title="Notre vision"
            text={
              mutual.vision ||
              'Construire une communauté forte, organisée et tournée vers un développement durable.'
            }
          />

          <InfoCard
            number="03"
            title="Nos valeurs"
            text={
              mutual.values ||
              'Solidarité, responsabilité, transparence, engagement et fraternité.'
            }
          />

        </div>

      </section>

      {/* ==================================================== */}
      {/* OBJECTIFS */}
      {/* ==================================================== */}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">

        <div className="grid gap-8 lg:grid-cols-2">

          <div className="rounded-3xl bg-emerald-950 p-8 text-white sm:p-10">

            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
              Nos objectifs
            </p>

            <h2 className="mt-3 text-3xl font-black">
              Construire ensemble
            </h2>

            <p className="mt-6 whitespace-pre-line text-base leading-8 text-emerald-50">
              {mutual.objectives ||
                `• Renforcer l’entraide entre les membres.
• Accompagner les actions sociales.
• Favoriser le développement de la communauté.
• Améliorer la transparence et la participation de chacun.`}
            </p>

          </div>

          <div className="rounded-3xl border bg-white p-8 sm:p-10">

            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Pourquoi adhérer ?
            </p>

            <h2 className="mt-3 text-3xl font-black text-slate-900">
              Rejoindre une communauté organisée
            </h2>

            <div className="mt-7 space-y-5">

              <Benefit
                title="Solidarité"
                text="Participer à une communauté qui s’entraide et accompagne ses membres."
              />

              <Benefit
                title="Transparence"
                text="Suivez personnellement vos cotisations, paiements et reçus depuis votre espace membre."
              />

              <Benefit
                title="Participation"
                text="Prendre part aux actions, projets et initiatives de votre mutuelle."
              />

              <Benefit
                title="Simplicité"
                text="Accéder à votre espace personnel et, prochainement, payer vos cotisations à distance."
              />

            </div>

          </div>

        </div>

      </section>

      {/* ==================================================== */}
      {/* HISTOIRE */}
      {/* ==================================================== */}

      {mutual.history && (
        <section className="bg-slate-100">

          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">

            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Notre histoire
            </p>

            <h2 className="mt-3 text-3xl font-black text-slate-900">
              D’où venons-nous ?
            </h2>

            <p className="mt-6 whitespace-pre-line text-lg leading-8 text-slate-600">
              {mutual.history}
            </p>

          </div>

        </section>
      )}

      {/* ==================================================== */}
      {/* MOT DU PRESIDENT */}
      {/* ==================================================== */}

      {mutual.president_message && (
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">

          <div className="rounded-3xl border bg-white p-8 shadow-sm sm:p-10">

            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Mot du Président
            </p>

            <blockquote className="mt-6 whitespace-pre-line text-xl font-medium leading-9 text-slate-700">
              “{mutual.president_message}”
            </blockquote>

          </div>

        </section>
      )}

      {/* ==================================================== */}
      {/* COMMENT ADHERER */}
      {/* ==================================================== */}

      <section className="bg-white">

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">

          <div className="text-center">

            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Adhésion
            </p>

            <h2 className="mt-3 text-3xl font-black text-slate-900">
              Devenir membre en quelques étapes
            </h2>

          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">

            <Step
              number="1"
              title="Remplissez votre demande"
              text="Renseignez simplement vos informations essentielles."
            />

            <Step
              number="2"
              title="Le bureau examine"
              text="Votre demande est vérifiée par les responsables de la mutuelle."
            />

            <Step
              number="3"
              title="Accédez à votre espace"
              text="Après validation, vous obtenez votre matricule et votre espace personnel."
            />

          </div>

          {mutual.online_membership_enabled && (
            <div className="mt-10 text-center">

              <Link
                href={`/m/${mutual.slug}/join`}
                className="inline-flex rounded-2xl bg-emerald-700 px-7 py-4 font-black text-white transition hover:bg-emerald-800"
              >
                Faire ma demande d&apos;adhésion
              </Link>

            </div>
          )}

        </div>

      </section>

      {/* ==================================================== */}
      {/* FOOTER */}
      {/* ==================================================== */}

      <footer className="bg-slate-950 text-white">

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-xl font-black">
                {shortName}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              <Link
                href="/login"
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold"
              >
                Connexion membre
              </Link>

              {mutual.online_membership_enabled && (
                <Link
                  href={`/m/${mutual.slug}/join`}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950"
                >
                  Adhérer
                </Link>
              )}

            </div>

          </div>

        </div>

      </footer>

    </main>
  )
}

// ============================================================
// COMPONENTS
// ============================================================

function PublicInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wide text-emerald-200">
        {label}
      </p>

      <p className="mt-1 font-bold">
        {value}
      </p>

    </div>
  )
}

function InfoCard({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <article className="rounded-3xl border bg-slate-50 p-7">

      <p className="text-sm font-black text-emerald-700">
        {number}
      </p>

      <h3 className="mt-4 text-2xl font-black text-slate-900">
        {title}
      </h3>

      <p className="mt-4 whitespace-pre-line leading-7 text-slate-600">
        {text}
      </p>

    </article>
  )
}

function Benefit({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div className="flex gap-4">

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">
        ✓
      </div>

      <div>

        <h3 className="font-black text-slate-900">
          {title}
        </h3>

        <p className="mt-1 leading-6 text-slate-600">
          {text}
        </p>

      </div>

    </div>
  )
}

function Step({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <article className="rounded-3xl border bg-slate-50 p-7 text-center">

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 font-black text-white">
        {number}
      </div>

      <h3 className="mt-5 text-lg font-black text-slate-900">
        {title}
      </h3>

      <p className="mt-2 leading-6 text-slate-600">
        {text}
      </p>

    </article>
  )
}

function initials(
  value: string
) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0)
    )
    .join('')
    .toUpperCase()
}