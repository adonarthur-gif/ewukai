import type { ReactNode } from 'react'

import Image from 'next/image'
import Link from 'next/link'

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Globe2,
  HandCoins,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

const PAYMENT_LOGOS = {
  orangeMoney: '/payment-logos/orange-money.png',
  wave: '/payment-logos/wave.png',
  mtnMomo: '/payment-logos/mtn-mobile-money.png',
  moovMoney: '/payment-logos/moov-money.png',
  mastercard: '/payment-logos/mastercard.png',
} as const

// ============================================================
// PAGE D'ACCUEIL EWUKAI - PREMIUM BILINGUE
// ============================================================

type HomePageProps = {
  searchParams: Promise<{
    lang?: string
  }>
}

export default async function HomePage({
  searchParams,
}: HomePageProps) {
  const params = await searchParams
  const locale = params.lang === 'en' ? 'en' : 'fr'
  const isEn = locale === 'en'
  const t = (fr: string, en: string) => (isEn ? en : fr)

  const capabilities = isEn
    ? ['Members', 'Contributions', 'Payments', 'Treasury', 'Reports']
    : ['Membres', 'Cotisations', 'Paiements', 'Trésorerie', 'Rapports']

  const organizationFamilies = isEn
    ? ['NGO', 'Mutual', 'Association', 'Savings group', 'Cooperative', 'Foundation', 'Community group', 'Social club']
    : ['ONG', 'Mutuelle', 'Association', 'Tontine', 'Coopérative', 'Fondation', 'Groupement', 'Amicale']

  const monthLabels = isEn
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    : ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin']

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">

      {/* ==================================================== */}
      {/* NAVIGATION */}
      {/* ==================================================== */}

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">

          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
          >
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-lg shadow-slate-950/10 ring-1 ring-slate-200/80">
              <Image
                src="/branding/ewukai-mark.png"
                alt="Symbole EWUKAI"
                width={48}
                height={48}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <p className="text-lg font-black tracking-tight text-slate-950">
                EWUKAI
              </p>

              <p className="hidden text-[10px] font-semibold text-slate-500 xl:block">
                {t(
                  'La plateforme de gestion des organisations',
                  'The organization management platform'
                )}
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-4 whitespace-nowrap text-[13px] font-bold text-slate-600 lg:flex xl:gap-5">
            <a
              href="#organisations"
              className="transition hover:text-emerald-700"
            >
              {t('Organisations', 'Organizations')}
            </a>

            <a
              href="#solutions"
              className="transition hover:text-emerald-700"
            >
              {t('Fonctionnalités', 'Features')}
            </a>

            <a
              href="#paiements"
              className="transition hover:text-emerald-700"
            >
              {t('Paiements', 'Payments')}
            </a>

            <a
              href="#transparence"
              className="transition hover:text-emerald-700"
            >
              {t('Transparence', 'Transparency')}
            </a>

            <a
              href="#demarrer"
              className="transition hover:text-emerald-700"
            >
              {t('Démarrer', 'Get started')}
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <Globe2 className="ml-2 h-4 w-4 text-slate-500" />
              <Link
                href="/?lang=fr"
                className={`ml-1 rounded-lg px-2.5 py-1.5 text-xs font-black transition ${
                  !isEn
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                FR
              </Link>
              <Link
                href="/?lang=en"
                className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition ${
                  isEn
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                EN
              </Link>
            </div>

            <Link
              href="/login"
              className="hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-[13px] font-black text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
            >
              {t('Se connecter', 'Sign in')}
            </Link>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-3.5 py-2.5 text-[13px] font-black text-white shadow-lg shadow-emerald-950/10 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              {t('Créer mon organisation', 'Create my organization')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ==================================================== */}
      {/* HERO PREMIUM - VERSION ANIMEE */}
      {/* ==================================================== */}

      <section className="relative isolate overflow-hidden bg-[linear-gradient(120deg,#030711_0%,#071827_45%,#064E4B_100%)] text-white">

        <div className="afri-aurora afri-aurora-one absolute -left-48 top-10 h-[520px] w-[520px] rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="afri-aurora afri-aurora-two absolute -right-52 top-[-120px] h-[680px] w-[680px] rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="afri-aurora afri-aurora-three absolute bottom-[-260px] left-[35%] h-[520px] w-[520px] rounded-full bg-amber-300/10 blur-3xl" />

        <div className="afri-grid-drift absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:56px_56px]" />

        <div className="afri-light-sweep pointer-events-none absolute inset-y-0 left-[-30%] w-[28%] rotate-12 bg-gradient-to-r from-transparent via-white/[0.055] to-transparent blur-xl" />

        <div className="absolute inset-0 overflow-hidden">
          <span className="afri-particle left-[8%] top-[18%]" />
          <span className="afri-particle left-[17%] top-[68%] [animation-delay:1.2s]" />
          <span className="afri-particle left-[46%] top-[12%] [animation-delay:2.1s]" />
          <span className="afri-particle left-[68%] top-[78%] [animation-delay:.6s]" />
          <span className="afri-particle left-[86%] top-[24%] [animation-delay:1.7s]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-20">

          <div className="relative z-10">
            <div className="afri-enter-up inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.17em] text-emerald-300 backdrop-blur">
              <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white/95 ring-1 ring-white/20">
                <Image
                  src="/branding/ewukai-mark.png"
                  alt=""
                  width={20}
                  height={20}
                  className="h-full w-full object-contain"
                />
              </span>
              {t('EWUKAI · La plateforme des organisations', 'EWUKAI · The platform for organizations')}
            </div>

            <h1 className="afri-enter-up mt-7 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.04em] [animation-delay:120ms] sm:text-5xl lg:text-[3.65rem]">
              {t('Pilotez votre organisation.', 'Run your organization.')}
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-200 bg-[length:200%_auto] bg-clip-text text-transparent afri-gradient-text">
                {t('Gardez le contrôle', 'Stay in control')}
              </span>{' '}
              {t('de vos fonds.', 'of your funds.')}
            </h1>

            <p className="afri-enter-up mt-5 max-w-2xl text-lg leading-8 text-slate-300 [animation-delay:220ms] sm:text-xl">
              {t(
                'Membres, cotisations, paiements, trésorerie, reçus et rapports réunis dans une seule plateforme moderne.',
                'Members, contributions, payments, treasury, receipts and reports brought together in one modern platform.'
              )}
            </p>

            <div className="afri-enter-up mt-5 [animation-delay:260ms]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                {t('Pensé pour', 'Built for')}
              </p>

              <div className="mt-3 flex max-w-2xl flex-wrap gap-2">
                {organizationFamilies.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-black text-white/90 backdrop-blur"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="afri-enter-up mt-5 [animation-delay:320ms]">
              <p className="text-sm font-black text-slate-200 sm:text-base">
                {t('Un seul espace pour tout piloter.', 'One space to manage everything.')}
              </p>

              <div className="mt-3 flex max-w-2xl flex-wrap gap-2">
                {capabilities.map((item, index) => (
                  <span
                    key={item}
                    className="afri-capability-chip rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-black text-emerald-200 backdrop-blur"
                    style={{ animationDelay: `${index * 160}ms` }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="afri-enter-up mt-6 flex flex-col gap-3 [animation-delay:380ms] sm:flex-row">
              <Link
                href="/register"
                className="afri-primary-cta group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-6 py-4 font-black text-slate-950 shadow-xl shadow-emerald-950/20 transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
              >
                {t('Créer mon organisation', 'Create my organization')}
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/10"
              >
                {t('J’ai déjà un compte', 'I already have an account')}
              </Link>
            </div>

            <div className="afri-enter-up mt-6 grid max-w-2xl gap-2.5 [animation-delay:460ms] sm:grid-cols-3">
              <HeroCheck text={t('Aucun fonds détenu par la plateforme', 'The platform does not hold your funds')} />
              <HeroCheck text={t('Paiement vers votre organisation', 'Payments go to your organization')} />
              <HeroCheck text={t('Reçus et suivi automatiques', 'Automatic receipts and tracking')} />
            </div>

            <div className="afri-enter-up mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.07] p-3.5 [animation-delay:540ms] backdrop-blur">
              <p className="text-sm font-black text-white">
                {t('Votre argent reste à votre organisation.', 'Your money stays with your organization.')}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {t(
                  'La plateforme fournit le canal technologique, la traçabilité et les outils de gestion.',
                  'The platform provides the technology channel, traceability and management tools.'
                )}
              </p>
            </div>
          </div>

          {/* DASHBOARD DEMO VIVANT */}

          <div className="relative">

            <div className="absolute inset-[8%] rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative z-30 mx-auto mb-3 grid w-full max-w-[650px] gap-2 sm:grid-cols-3">
              <ActivityCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                title={t('Paiement confirmé', 'Payment confirmed')}
                subtitle={t('Transaction vérifiée automatiquement', 'Transaction verified automatically')}
                tone="emerald"
                delay="0s"
              />

              <ActivityCard
                icon={<Users className="h-4 w-4" />}
                title={t('Nouveau membre', 'New member')}
                subtitle={t('Dossier ajouté à l’organisation', 'Profile added to the organization')}
                tone="blue"
                delay=".5s"
              />

              <ActivityCard
                icon={<ReceiptText className="h-4 w-4" />}
                title={t('Reçu disponible', 'Receipt available')}
                subtitle={t('Justificatif généré automatiquement', 'Receipt generated automatically')}
                tone="amber"
                delay="1s"
              />
            </div>

            <div className="afri-dashboard-float relative z-20 mx-auto w-full max-w-[485px]">
              <div className="absolute -inset-10 rounded-full bg-emerald-400/10 blur-3xl" />

              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/95 p-3 shadow-[0_35px_90px_rgba(0,0,0,.30)] backdrop-blur">
                <div className="rounded-[1.6rem] bg-[#F6F8FB] p-4 text-slate-950 sm:p-5">

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                        {t('Tableau de bord', 'Dashboard')}
                      </p>
                      <h2 className="mt-1 text-xl font-black">
                        {t('Votre organisation', 'Your organization')}
                      </h2>
                    </div>

                    <div className="afri-logo-pulse flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-500 font-black text-white shadow-lg">
                      VO
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <PreviewStat
                      label={t('Membres', 'Members')}
                      value="248"
                      caption={t('+18 ce mois', '+18 this month')}
                      icon={<Users className="h-5 w-5" />}
                      tone="blue"
                    />
                    <PreviewStat
                      label={t('Cotisations', 'Contributions')}
                      value="92%"
                      caption="+6,4%"
                      icon={<TrendingUp className="h-5 w-5" />}
                      tone="green"
                    />
                    <PreviewStat
                      label={t('Entrées', 'Inflows')}
                      value="1,84 M"
                      caption=""
                      icon={<Wallet className="h-5 w-5" />}
                      tone="teal"
                    />
                    <PreviewStat
                      label={t('Solde', 'Balance')}
                      value="1,26 M"
                      caption=""
                      icon={<CircleDollarSign className="h-5 w-5" />}
                      tone="gold"
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                          {t('Évolution', 'Trend')}
                        </p>
                        <p className="mt-1 font-black">
                          {t('Recouvrement sur 6 mois', 'Collection over 6 months')}
                        </p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-6 flex h-32 items-end gap-3">
                      <AnimatedBar label={monthLabels[0]} height="42%" delay="0ms" tone="blue" />
                      <AnimatedBar label={monthLabels[1]} height="55%" delay="90ms" tone="teal" />
                      <AnimatedBar label={monthLabels[2]} height="63%" delay="180ms" tone="emerald" />
                      <AnimatedBar label={monthLabels[3]} height="74%" delay="270ms" tone="emerald" />
                      <AnimatedBar label={monthLabels[4]} height="84%" delay="360ms" tone="cyan" />
                      <AnimatedBar label={monthLabels[5]} height="94%" delay="450ms" tone="gold" />
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                          {t('Recouvrement', 'Collection')}
                        </p>
                        <p className="mt-1 font-black">
                          {t('Situation mensuelle', 'Monthly status')}
                        </p>
                      </div>
                      <BadgeCheck className="h-6 w-6 text-emerald-600" />
                    </div>

                    <div className="mt-5 space-y-4">
                      <ProgressRow label={t('Cotisations payées', 'Paid contributions')} value="92%" width="92%" tone="green" delay="100ms" />
                      <ProgressRow label={t('Partiellement réglées', 'Partially paid')} value="5%" width="55%" tone="gold" delay="250ms" />
                      <ProgressRow label={t('À régulariser', 'Outstanding')} value="3%" width="32%" tone="blue" delay="400ms" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <MiniAction icon={<Users className="h-5 w-5" />} label={t('Membres', 'Members')} tone="blue" />
                    <MiniAction icon={<Wallet className="h-5 w-5" />} label={t('Trésorerie', 'Treasury')} tone="green" />
                    <MiniAction icon={<ReceiptText className="h-5 w-5" />} label={t('Reçus', 'Receipts')} tone="gold" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* ORGANISATIONS - MISE EN AVANT */}
      {/* ==================================================== */}

      <section
        id="organisations"
        className="relative overflow-hidden bg-[#F8FAFC] py-16 sm:py-20"
      >
        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-cyan-100/60 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow={t('Un espace pour chaque organisation', 'A space for every organization')}
            title={t('Une plateforme pour toutes les formes d’organisation', 'One platform for every kind of organization')}
            description={t(
              'Chaque structure dispose de son propre espace, de ses membres, de ses règles et de sa gestion. Elles partagent la même technologie tout en restant indépendantes.',
              'Each structure has its own space, members, rules and management. They share the same technology while remaining independent.'
            )}
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <OrganizationCard
              icon={<Globe2 className="h-7 w-7" />}
              title={t('ONG', 'NGO')}
              description={t('Membres, bénéficiaires, projets, ressources, activités et suivi.', 'Members, beneficiaries, projects, resources, activities and tracking.')}
              tone="cyan"
            />

            <OrganizationCard
              icon={<HeartHandshake className="h-7 w-7" />}
              title={t('Mutuelle', 'Mutual organization')}
              description={t('Cotisations, fonds sociaux, entraide, recouvrement et trésorerie.', 'Contributions, social funds, mutual aid, collection and treasury.')}
              tone="emerald"
            />

            <OrganizationCard
              icon={<Users className="h-7 w-7" />}
              title={t('Association', 'Association')}
              description={t('Adhésions, membres, cotisations, activités, événements et finances.', 'Memberships, members, contributions, activities, events and finances.')}
              tone="blue"
            />

            <OrganizationCard
              icon={<HandCoins className="h-7 w-7" />}
              title={t('Tontine', 'Savings group')}
              description={t('Participants, versements, échéances, tours, bénéficiaires et historique.', 'Participants, payments, due dates, rounds, beneficiaries and history.')}
              tone="violet"
            />

            <OrganizationCard
              icon={<Landmark className="h-7 w-7" />}
              title={t('Coopérative', 'Cooperative')}
              description={t('Sociétaires, apports, activités collectives, opérations et suivi financier.', 'Members, contributions, collective activities, operations and financial tracking.')}
              tone="amber"
            />

            <OrganizationCard
              icon={<Building2 className="h-7 w-7" />}
              title={t('Fondation', 'Foundation')}
              description={t('Donateurs, projets, bénéficiaires, financements, activités et rapports.', 'Donors, projects, beneficiaries, funding, activities and reports.')}
              tone="rose"
            />

            <OrganizationCard
              icon={<Users className="h-7 w-7" />}
              title={t('Groupement', 'Community group')}
              description={t('Membres, contributions, projets communs, activités et organisation collective.', 'Members, contributions, shared projects, activities and collective organization.')}
              tone="cyan"
            />

            <OrganizationCard
              icon={<HeartHandshake className="h-7 w-7" />}
              title={t('Amicale', 'Social club')}
              description={t('Membres, entraide, événements, cotisations et caisse commune.', 'Members, mutual support, events, contributions and shared funds.')}
              tone="rose"
            />
          </div>

          <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-lg font-black text-slate-950">
                  {t('Et bien plus encore…', 'And much more…')}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {t(
                    'EWUKAI peut également accompagner d’autres formes de communautés et de structures organisées.',
                    'EWUKAI can also support many other kinds of communities and organized groups.'
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  t('Club', 'Club'),
                  'GIE',
                  t('Communauté', 'Community'),
                  t('Caisse de solidarité', 'Solidarity fund'),
                  t('Comité', 'Committee'),
                  t('Réseau', 'Network'),
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#06101D,#071E2B_55%,#064E4B)] p-6 text-white shadow-xl sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-emerald-300">
                  {t('Le principe EWUKAI', 'The EWUKAI principle')}
                </p>
                <h3 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                  {t('Des organisations indépendantes. Un même écosystème.', 'Independent organizations. One shared ecosystem.')}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                  {t(
                    'Chaque organisation conserve son identité, ses membres, ses données et sa gestion. EWUKAI fournit l’infrastructure commune qui simplifie le fonctionnement au quotidien.',
                    'Each organization keeps its identity, members, data and management. EWUKAI provides the shared infrastructure that simplifies day-to-day operations.'
                  )}
                </p>
              </div>

              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-black text-emerald-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50"
              >
                {t('Créer mon espace', 'Create my space')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* BANDE VIVANTE */}
      {/* ==================================================== */}

      <section className="overflow-hidden border-b border-slate-200 bg-white">
        <div className="afri-marquee-track flex w-max items-center py-5 text-sm font-black text-slate-500">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className="flex shrink-0 items-center gap-8 px-4 sm:gap-12 sm:px-6"
            >
              <TrustItem icon={<Users className="h-4 w-4" />} text={t('Membres', 'Members')} />
              <TrustItem icon={<HandCoins className="h-4 w-4" />} text={t('Cotisations', 'Contributions')} />
              <TrustItem icon={<Wallet className="h-4 w-4" />} text={t('Trésorerie', 'Treasury')} />
              <TrustItem icon={<Smartphone className="h-4 w-4" />} text={t('Paiements', 'Payments')} />
              <TrustItem icon={<ReceiptText className="h-4 w-4" />} text={t('Reçus', 'Receipts')} />
              <TrustItem icon={<ShieldCheck className="h-4 w-4" />} text={t('Traçabilité', 'Traceability')} />
              <TrustItem icon={<BarChart3 className="h-4 w-4" />} text={t('Rapports', 'Reports')} />
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================== */}
      {/* PAIEMENT SANS DETENTION DES FONDS */}
      {/* ==================================================== */}

      <section
        id="paiements"
        className="relative overflow-hidden bg-[#F7FFFC] py-20 sm:py-24"
      >
        <div className="absolute left-[-180px] top-10 h-96 w-96 rounded-full bg-emerald-100/80 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-140px] h-96 w-96 rounded-full bg-cyan-100/70 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.17em] text-emerald-700 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              {t('Paiement & confiance', 'Payments & trust')}
            </div>

            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              {t('Votre argent ne passe pas par nous.', 'Your money does not pass through us.')}
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {t(
                'EWUKAI fournit le canal technologique et les outils de suivi. Les cotisations sont traitées par le prestataire de paiement configuré par votre organisation, au bénéfice de votre organisation.',
                'EWUKAI provides the technology channel and tracking tools. Contributions are processed by the payment provider configured by your organization, for the benefit of your organization.'
              )}
            </p>
          </div>

          <div className="mt-14 overflow-hidden rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_30px_80px_rgba(15,118,110,.10)] sm:p-8 lg:p-10">

            <div className="grid items-center gap-5 lg:grid-cols-[1fr_100px_1fr_100px_1fr]">
              <PaymentNode
                icon={<Users className="h-6 w-6" />}
                eyebrow={t('Étape 1', 'Step 1')}
                title={t('Le membre paie', 'The member pays')}
                description={t('Il choisit un moyen de paiement disponible pour son organisation.', 'They choose an available payment method for their organization.')}
                tone="blue"
              />

              <FlowConnector delay="0s" />

              <PaymentNode
                icon={<Smartphone className="h-6 w-6" />}
                visual={
                  <PaymentProviderCloud
                    secureLabel={t('Paiement sécurisé', 'Secure payment')}
                    ariaLabel={t('Mobile Money et cartes bancaires', 'Mobile Money and bank cards')}
                  />
                }
                eyebrow={t('Étape 2', 'Step 2')}
                title={t('Le prestataire traite', 'The provider processes')}
                description={t('La transaction est sécurisée et vérifiée par le prestataire de paiement.', 'The transaction is secured and verified by the payment provider.')}
                tone="emerald"
              />

              <FlowConnector delay="1s" />

              <PaymentNode
                icon={<Building2 className="h-6 w-6" />}
                eyebrow={t('Étape 3', 'Step 3')}
                title={t('Votre organisation reçoit', 'Your organization receives')}
                description={t('Les fonds suivent la configuration de paiement propre à votre organisation.', 'Funds follow the payment configuration set by your organization.')}
                tone="amber"
              />
            </div>

            <div className="mt-8 grid gap-4 rounded-3xl bg-[linear-gradient(120deg,#06101D,#071E2B_55%,#064E4B)] p-6 text-white lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:p-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                  {t('En parallèle', 'At the same time')}
                </p>
                <h3 className="mt-3 text-2xl font-black tracking-tight">
                  {t('La plateforme automatise la gestion.', 'The platform automates the management workflow.')}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                  {t(
                    'Après confirmation du prestataire, EWUKAI met à jour la situation du membre et la traçabilité de l’organisation.',
                    'After provider confirmation, EWUKAI updates the member status and the organization’s transaction trail.'
                  )}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PaymentAction icon={<CheckCircle2 className="h-5 w-5" />} text={t('Confirmation de la transaction', 'Transaction confirmation')} delay="0s" />
                <PaymentAction icon={<HandCoins className="h-5 w-5" />} text={t('Cotisation mise à jour', 'Contribution updated')} delay=".4s" />
                <PaymentAction icon={<ReceiptText className="h-5 w-5" />} text={t('Reçu généré automatiquement', 'Receipt generated automatically')} delay=".8s" />
                <PaymentAction icon={<BarChart3 className="h-5 w-5" />} text={t('Rapports et trésorerie actualisés', 'Reports and treasury updated')} delay="1.2s" />
              </div>
            </div>

            <div className="mt-7 flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-black text-emerald-950">
                    {t('Aucun fonds de cotisation n’est conservé par EWUKAI.', 'EWUKAI does not hold contribution funds.')}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    {t(
                    'Nous connectons le paiement à la gestion ; votre organisation garde le contrôle de ses fonds.',
                    'We connect payments to management while your organization remains in control of its funds.'
                  )}
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-auto">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
                  {t('Canaux selon votre prestataire', 'Channels available through your provider')}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-black text-slate-700 sm:grid-cols-3">
                  <PaymentMethodBadge
                    imageSrc={PAYMENT_LOGOS.wave}
                    imageAlt="Wave"
                    label="Wave"
                  />
                  <PaymentMethodBadge
                    imageSrc={PAYMENT_LOGOS.orangeMoney}
                    imageAlt="Orange Money"
                    label="Orange Money"
                  />
                  <PaymentMethodBadge
                    imageSrc={PAYMENT_LOGOS.mtnMomo}
                    imageAlt="MTN Mobile Money"
                    label="MTN MoMo"
                  />
                  <PaymentMethodBadge
                    imageSrc={PAYMENT_LOGOS.moovMoney}
                    imageAlt="Moov Money"
                    label="Moov Money"
                  />
                  <PaymentMethodBadge
                    imageSrc={PAYMENT_LOGOS.mastercard}
                    imageAlt="Mastercard"
                    label="Mastercard"
                  />
                  <PaymentMethodBadge
                    icon={<Landmark className="h-4 w-4" />}
                    label={t('Virement bancaire', 'Bank transfer')}
                  />
                </div>
                <p className="mt-2 max-w-sm text-[10px] font-semibold leading-4 text-emerald-700">
                  {t(
                  'La disponibilité dépend du pays, du prestataire et des moyens activés par votre organisation.',
                  'Availability depends on the country, provider and payment methods enabled by your organization.'
                )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* SOLUTIONS */}
      {/* ==================================================== */}

      <section
        id="solutions"
        className="relative overflow-hidden py-20 sm:py-24"
      >
        <div className="absolute right-[-180px] top-10 h-96 w-96 rounded-full bg-cyan-100/60 blur-3xl" />

        <div className="absolute bottom-0 left-[-160px] h-96 w-96 rounded-full bg-emerald-100/60 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <SectionIntro
            eyebrow={t("Tout au même endroit", "Everything in one place")}
            title={t("Les outils essentiels pour mieux gérer", "Essential tools to manage better")}
            description={t("Réduisez les tableaux dispersés, les calculs manuels et les informations perdues. Votre organisation dispose enfin d'une base unique.", "Reduce scattered spreadsheets, manual calculations and lost information. Your organization finally gets one reliable source of truth.")}
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

            <FeatureCard
              number="01"
              icon={<Users className="h-6 w-6" />}
              title={t("Gestion des membres", "Member management")}
              description={t("Centralisez les dossiers, matricules, coordonnées, statuts et historiques de vos membres.", "Centralize member profiles, IDs, contact details, statuses and history.")}
            />

            <FeatureCard
              number="02"
              icon={<HandCoins className="h-6 w-6" />}
              title={t("Cotisations & recouvrement", "Contributions & collection")}
              description={t("Suivez les montants dus, payés, partiels, impayés, les avances et les échéances.", "Track amounts due, paid, partially paid, unpaid, advances and due dates.")}
            />

            <FeatureCard
              number="03"
              icon={<Wallet className="h-6 w-6" />}
              title={t('Trésorerie', 'Treasury')}
              description={t("Enregistrez les entrées, les dépenses et les comptes avec une vision claire du solde.", "Record inflows, expenses and accounts with a clear view of balances.")}
            />

            <FeatureCard
              number="04"
              icon={<ReceiptText className="h-6 w-6" />}
              title={t("Reçus électroniques", "Digital receipts")}
              description={t("Conservez la trace de chaque paiement et générez des justificatifs consultables.", "Keep a record of every payment and generate accessible proof of payment.")}
            />

            <FeatureCard
              number="05"
              icon={<Smartphone className="h-6 w-6" />}
              title={t("Espace personnel membre", "Member portal")}
              description={t("Chaque membre consulte sa situation, ses paiements, ses reçus et les moyens de règlement.", "Each member can view their status, payments, receipts and available payment methods.")}
            />

            <FeatureCard
              number="06"
              icon={<ShieldCheck className="h-6 w-6" />}
              title={t("Droits & sécurité", "Roles & security")}
              description={t("Les responsables et les membres accèdent uniquement aux fonctions correspondant à leurs droits.", "Managers and members only access the features allowed by their roles.")}
            />
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* TRANSPARENCE */}
      {/* ==================================================== */}

      <section
        id="transparence"
        className="relative overflow-hidden bg-[linear-gradient(135deg,#06101D,#071E2B_55%,#064E4B)] py-20 text-white sm:py-24"
      >
        <div className="absolute right-[-120px] top-[-120px] h-[420px] w-[420px] rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">

          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
              {t('Confiance & transparence', 'Trust & transparency')}
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              {t('Donnez à vos membres une vision claire de leur situation.', 'Give your members a clear view of their status.')}
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              {t(
                'Des informations accessibles, des opérations traçables et des responsabilités clairement définies renforcent la confiance dans votre organisation.',
                'Accessible information, traceable transactions and clearly defined responsibilities strengthen trust in your organization.'
              )}
            </p>

            <div className="mt-8 space-y-4">
              <DarkCheck text={t("Historique des paiements", "Payment history")} />
              <DarkCheck text={t("Situation des cotisations", "Contribution status")} />
              <DarkCheck text={t("Reçus et références des opérations", "Receipts and transaction references")} />
              <DarkCheck text={t("Suivi des entrées et sorties", "Inflow and outflow tracking")} />
              <DarkCheck text={t("Accès personnel de chaque membre", "Personal access for every member")} />
            </div>
          </div>

          {/* CARTE MEMBRE */}

          <div className="afri-soft-float rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-8">

            <div className="overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl">

              <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 p-6">

                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-500 text-white">
                    <BadgeCheck className="h-7 w-7" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-500">
                      {t('Espace membre', 'Member portal')}
                    </p>

                    <p className="text-xl font-black">
                      {t('Situation personnelle', 'Personal status')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">

                <div className="grid gap-3 sm:grid-cols-2">
                  <SituationCard
                    label={t("Déjà payé", "Already paid")}
                    value="45 000"
                    tone="green"
                  />

                  <SituationCard
                    label={t("Reste exigible", "Amount due")}
                    value="5 000"
                    tone="amber"
                  />

                  <SituationCard
                    label={t("Avance", "Advance")}
                    value="10 000"
                    tone="blue"
                  />

                  <SituationCard
                    label={t("Dernier paiement", "Last payment")}
                    value={t('15 août', 'August 15')}
                    tone="violet"
                  />
                </div>

                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {t(
                    'Les montants s’affichent dans la devise définie par l’organisation.',
                    'Amounts are displayed in the currency configured by the organization.'
                  )}
                </p>

                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="font-black text-emerald-900">
                    {t('✓ Situation à jour', '✓ Status up to date')}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-emerald-700">
                    {t(
                      'Les opérations enregistrées par votre organisation sont disponibles depuis votre espace personnel.',
                      'Transactions recorded by your organization are available from your personal space.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* COMMENT CA MARCHE */}
      {/* ==================================================== */}

      <section className="bg-[#FFFDF8] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <SectionIntro
            eyebrow={t("Simple à mettre en place", "Easy to set up")}
            title={t("Votre organisation en ligne en quelques étapes", "Bring your organization online in a few steps")}
            description={t("EWUKAI est conçu pour permettre aux responsables de démarrer sans procédure compliquée.", "EWUKAI is designed so managers can get started without complicated procedures.")}
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">

            <StepCard
              number="1"
              title={t("Créez votre compte", "Create your account")}
              description={t("Le responsable crée son compte sécurisé et démarre l'inscription de son organisation.", "The manager creates a secure account and starts setting up the organization.")}
              icon={<Users className="h-6 w-6" />}
            />

            <StepCard
              number="2"
              title={t("Configurez votre organisation", "Configure your organization")}
              description={t("Ajoutez son nom, son type, son logo, ses couleurs et ses premiers paramètres.", "Add its name, type, logo, colors and initial settings.")}
              icon={<Building2 className="h-6 w-6" />}
            />

            <StepCard
              number="3"
              title={t("Commencez à gérer", "Start managing")}
              description={t("Ajoutez vos membres, vos cotisations, vos comptes et suivez votre activité.", "Add members, contributions and accounts, then track your activity.")}
              icon={<LayoutDashboard className="h-6 w-6" />}
            />
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* IDENTITE DE L'ORGANISATION */}
      {/* ==================================================== */}

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 shadow-sm">

            <div className="grid lg:grid-cols-2">

              <div className="p-8 sm:p-10 lg:p-12">

                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  {t('Votre identité', 'Your identity')}
                </p>

                <h2 className="mt-4 text-3xl font-black tracking-tight">
                  {t('Votre organisation reste au premier plan.', 'Your organization stays front and center.')}
                </h2>

                <p className="mt-5 max-w-xl leading-7 text-slate-600">
                  {t(
                    'Personnalisez votre espace avec votre nom, votre logo et vos couleurs. Vos membres retrouvent l’identité de leur organisation dans leur espace personnel.',
                    'Customize your space with your name, logo and colors. Members see their organization’s identity throughout their personal space.'
                  )}
                </p>

                <div className="mt-7 space-y-3">
                  <LightCheck text={t("Logo de votre organisation", "Your organization logo")} />
                  <LightCheck text={t("Couleurs personnalisées", "Custom colors")} />
                  <LightCheck text={t("Page publique de présentation", "Public presentation page")} />
                  <LightCheck text={t("Espace membre personnalisé", "Customized member space")} />
                </div>
              </div>

              <div className="relative flex items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#047857,#0891B2)] p-8 sm:p-12">

                <div className="absolute -right-24 top-0 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

                <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-amber-300/10 blur-2xl" />

                <div className="afri-soft-float relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">

                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-500 font-black text-white">
                      MO
                    </div>

                    <div>
                      <p className="font-black">
                        {t('Mon Organisation', 'My Organization')}
                      </p>

                      <p className="text-sm text-slate-500">
                        {t('Espace officiel', 'Official space')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-[linear-gradient(135deg,#071525,#064E4B)] p-6 text-white">

                    <p className="text-sm text-slate-300">
                      {t('Bienvenue dans votre espace', 'Welcome to your space')}
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {t('Bonjour Jean', 'Hello Jean')}
                    </p>

                    <div className="mt-6 flex gap-3">

                      <div className="rounded-xl bg-white/10 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase text-emerald-300">
                          {t('Matricule', 'Member ID')}
                        </p>

                        <p className="mt-1 font-black">
                          MO-000248
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/10 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase text-cyan-300">
                          {t('Statut', 'Status')}
                        </p>

                        <p className="mt-1 font-black">
                          {t('Actif', 'Active')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* CTA FINAL */}
      {/* ==================================================== */}

      <section
        id="demarrer"
        className="px-4 pb-20 sm:px-6 sm:pb-24"
      >
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.2rem] bg-[linear-gradient(120deg,#065F46,#078A67_45%,#0891B2)] px-6 py-14 text-center text-white shadow-2xl shadow-emerald-950/15 sm:px-10 sm:py-16">

          <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="absolute -right-24 bottom-[-80px] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative">

            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
              {t('Passez à une gestion moderne', 'Move to modern management')}
            </p>

            <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              {t(
                'Donnez à votre organisation les outils pour mieux gérer, communiquer et grandir.',
                'Give your organization the tools to manage better, communicate and grow.'
              )}
            </h2>

            <p className="mx-auto mt-5 max-w-2xl leading-7 text-emerald-50">
              {t(
                'Créez votre espace, ajoutez vos membres et commencez à structurer votre organisation.',
                'Create your space, add your members and start structuring your organization.'
              )}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">

              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-black text-emerald-800 shadow-lg transition hover:-translate-y-1 hover:bg-emerald-50"
              >
                {t('Créer mon organisation', 'Create my organization')}
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                href="/login/dirigeant"
                className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-6 py-4 font-black text-white backdrop-blur transition hover:bg-white/15"
              >
                {t('Connexion dirigeant', 'Manager sign in')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* FOOTER */}
      {/* ==================================================== */}

      <footer className="border-t border-slate-200 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="max-w-xl">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
                  <Image
                    src="/branding/ewukai-mark.png"
                    alt="Symbole EWUKAI"
                    width={44}
                    height={44}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <p className="font-black text-slate-950">
                    EWUKAI
                  </p>

                  <p className="text-sm text-slate-500">
                    {t(
                      'La plateforme de gestion des organisations',
                      'The organization management platform'
                    )}
                  </p>
                </div>
              </div>

              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">
                {t(
                  'Un espace pour chaque organisation. Une plateforme pour mieux gérer les membres, les cotisations, les paiements, la trésorerie et les rapports.',
                  'A space for every organization. One platform to manage members, contributions, payments, treasury and reports.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-3">
              <div>
                <p className="font-black text-slate-950">
                  EWUKAI
                </p>

                <div className="mt-3 flex flex-col gap-2.5 font-semibold text-slate-500">
                  <Link
                    href="/about"
                    className="transition hover:text-emerald-700"
                  >
                    {t('À propos', 'About')}
                  </Link>

                  <Link
                    href="/contact"
                    className="transition hover:text-emerald-700"
                  >
                    Contact
                  </Link>

                  <Link
                    href="/privacy"
                    className="transition hover:text-emerald-700"
                  >
                    {t(
                      'Confidentialité',
                      'Privacy'
                    )}
                  </Link>
                </div>
              </div>

              <div>
                <p className="font-black text-slate-950">
                  {t('Accès', 'Access')}
                </p>

                <div className="mt-3 flex flex-col gap-2.5 font-semibold text-slate-500">
                  <Link
                    href="/login"
                    className="transition hover:text-emerald-700"
                  >
                    {t('Connexion', 'Sign in')}
                  </Link>

                  <Link
                    href="/login/dirigeant"
                    className="transition hover:text-emerald-700"
                  >
                    {t(
                      'Espace dirigeant',
                      'Manager portal'
                    )}
                  </Link>

                  <Link
                    href="/register"
                    className="transition hover:text-emerald-700"
                  >
                    {t(
                      'Créer une organisation',
                      'Create an organization'
                    )}
                  </Link>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="font-black text-slate-950">
                  {t('Plateforme', 'Platform')}
                </p>

                <div className="mt-3 flex flex-col gap-2.5 font-semibold text-slate-500">
                  <a
                    href="#organisations"
                    className="transition hover:text-emerald-700"
                  >
                    {t(
                      'Organisations',
                      'Organizations'
                    )}
                  </a>

                  <a
                    href="#solutions"
                    className="transition hover:text-emerald-700"
                  >
                    {t(
                      'Fonctionnalités',
                      'Features'
                    )}
                  </a>

                  <a
                    href="#paiements"
                    className="transition hover:text-emerald-700"
                  >
                    {t('Paiements', 'Payments')}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs font-semibold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © 2026 EWUKAI. {t(
                'Tous droits réservés.',
                'All rights reserved.'
              )}
            </p>

            <p>
              {t(
                'Plateforme internationale de gestion des organisations',
                'International organization management platform'
              )}
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes afriAuroraOne {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(110px,55px,0) scale(1.16); }
        }

        @keyframes afriAuroraTwo {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(-120px,90px,0) scale(1.12); }
        }

        @keyframes afriAuroraThree {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(65px,-75px,0) scale(1.2); }
        }

        @keyframes afriGridDrift {
          from { background-position: 0 0; }
          to { background-position: 112px 56px; }
        }

        @keyframes afriSweep {
          0% { transform: translateX(-160%) rotate(12deg); opacity: 0; }
          15% { opacity: 1; }
          65%, 100% { transform: translateX(560%) rotate(12deg); opacity: 0; }
        }

        @keyframes afriParticle {
          0%, 100% { transform: translateY(0) scale(.8); opacity: .2; }
          50% { transform: translateY(-28px) scale(1.15); opacity: .9; }
        }

        @keyframes afriEnterUp {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes afriGradientText {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 100% center; }
        }

        @keyframes afriCapabilityChip {
          0%, 100% { transform: translateY(0); border-color: rgba(255,255,255,.10); }
          50% { transform: translateY(-3px); border-color: rgba(110,231,183,.28); }
        }

        @keyframes afriActivityCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes afriWordCycle {
          0%, 15% { opacity: 1; transform: translateY(0); }
          20%, 95% { opacity: 0; transform: translateY(-14px); }
          96%, 100% { opacity: 0; transform: translateY(14px); }
        }

        @keyframes afriFloatCard {
          0%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(0,-12px,0) rotate(.8deg); }
        }

        @keyframes afriLogoPulse {
          0%, 100% { box-shadow: 0 8px 22px rgba(5,150,105,.18); }
          50% { box-shadow: 0 8px 34px rgba(45,212,191,.48), 0 0 0 8px rgba(16,185,129,.08); }
        }

        @keyframes afriMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes afriFlowDot {
          0% { left: 0%; opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { left: calc(100% - 12px); opacity: 0; }
        }

        @keyframes afriPaymentAction {
          0%, 100% { transform: translateY(0); border-color: rgba(255,255,255,.10); }
          50% { transform: translateY(-4px); border-color: rgba(110,231,183,.32); }
        }

        @keyframes afriNodeGlow {
          0%, 100% { box-shadow: 0 1px 2px rgba(15,23,42,.04); }
          50% { box-shadow: 0 16px 38px rgba(16,185,129,.10); }
        }

        .afri-aurora-one { animation: afriAuroraOne 11s ease-in-out infinite; }
        .afri-aurora-two { animation: afriAuroraTwo 14s ease-in-out infinite; }
        .afri-aurora-three { animation: afriAuroraThree 13s ease-in-out infinite; }
        .afri-grid-drift { animation: afriGridDrift 16s linear infinite; }
        .afri-light-sweep { animation: afriSweep 8s ease-in-out infinite; }

        .afri-particle {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: rgba(110,231,183,.78);
          box-shadow: 0 0 18px rgba(45,212,191,.82);
          animation: afriParticle 5s ease-in-out infinite;
        }

        .afri-enter-up {
          opacity: 0;
          animation: afriEnterUp .8s cubic-bezier(.16,1,.3,1) forwards;
        }

        .afri-gradient-text { animation: afriGradientText 5s ease-in-out infinite; }

        .afri-capability-chip { animation: afriCapabilityChip 4.2s ease-in-out infinite; }
        .afri-activity-card { animation: afriActivityCard 5s ease-in-out infinite; }

        .afri-word-cycle {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
        }

        .afri-word {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          opacity: 0;
          animation: afriWordCycle 10s ease-in-out infinite;
        }

        .afri-float-card { animation: afriFloatCard 5.5s ease-in-out infinite; }
        .afri-float-card-two { animation-delay: -1.6s; }
        .afri-float-card-three { animation-delay: -3.1s; }
        .afri-logo-pulse { animation: afriLogoPulse 3.4s ease-in-out infinite; }
        .afri-marquee-track { animation: afriMarquee 25s linear infinite; }
        .afri-flow-dot { animation: afriFlowDot 2.2s ease-in-out infinite; }
        .afri-payment-action { animation: afriPaymentAction 4s ease-in-out infinite; }
        .afri-payment-node { animation: afriNodeGlow 5s ease-in-out infinite; }

        .afri-primary-cta {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .afri-primary-cta::after {
          content: '';
          position: absolute;
          inset: -50% auto -50% -35%;
          width: 28%;
          transform: rotate(15deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.72), transparent);
          animation: afriSweep 4.8s ease-in-out infinite;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .afri-aurora-one,
          .afri-aurora-two,
          .afri-aurora-three,
          .afri-grid-drift,
          .afri-light-sweep,
          .afri-particle,
          .afri-enter-up,
          .afri-gradient-text,
          .afri-capability-chip,
          .afri-activity-card,
          .afri-word,
          .afri-float-card,
          .afri-logo-pulse,
          .afri-marquee-track,
          .afri-flow-dot,
          .afri-payment-action,
          .afri-payment-node,
          .afri-primary-cta::after {
            animation: none !important;
          }

          .afri-enter-up { opacity: 1; }
          .afri-word { opacity: 0; }
          .afri-word:first-child { opacity: 1; transform: none; }
        }
      `}</style>
    </main>
  )
}

// ============================================================
// ACTIVITE HERO
// ============================================================

function ActivityCard({
  icon,
  title,
  subtitle,
  tone,
  delay,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  tone: 'emerald' | 'blue' | 'amber'
  delay: string
}) {
  const styles = {
    emerald: 'border-emerald-300/15 bg-emerald-300/[0.09] text-emerald-200',
    blue: 'border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-200',
    amber: 'border-amber-300/15 bg-amber-300/[0.08] text-amber-200',
  }

  return (
    <div
      className={`afri-activity-card min-h-[64px] rounded-2xl border px-3 py-2.5 shadow-xl backdrop-blur-xl ${styles[tone]}`}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black leading-4 text-white">
            {title}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold leading-4 text-slate-300">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MOYENS DE PAIEMENT - LANDING PAGE
// ============================================================

function PaymentMethodBadge({
  icon,
  imageSrc,
  imageAlt = '',
  label,
}: {
  icon?: ReactNode
  imageSrc?: string
  imageAlt?: string
  label: string
}) {
  return (
    <span className="flex min-h-11 items-center gap-2 rounded-xl border border-white bg-white px-3 py-2 shadow-sm">
      {imageSrc ? (
        <span className="flex h-7 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={48}
            height={32}
            className="max-h-7 w-auto max-w-9 object-contain"
          />
        </span>
      ) : (
        <span className="text-emerald-700">
          {icon}
        </span>
      )}
      <span>{label}</span>
    </span>
  )
}

// ============================================================
// HERO CHECK
// ============================================================

function HeroCheck({
  text,
}: {
  text: string
}) {
  return (
    <span className="flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      {text}
    </span>
  )
}

// ============================================================
// KPI
// ============================================================

function PreviewStat({
  label,
  value,
  caption,
  icon,
  tone,
}: {
  label: string
  value: string
  caption?: string
  icon: ReactNode
  tone:
    | 'blue'
    | 'green'
    | 'teal'
    | 'gold'
}) {
  const styles = {
    blue: {
      card: 'bg-blue-50',
      icon: 'bg-blue-100 text-blue-700',
    },

    green: {
      card: 'bg-emerald-50',
      icon: 'bg-emerald-100 text-emerald-700',
    },

    teal: {
      card: 'bg-cyan-50',
      icon: 'bg-cyan-100 text-cyan-700',
    },

    gold: {
      card: 'bg-amber-50',
      icon: 'bg-amber-100 text-amber-700',
    },
  }

  const style =
    styles[tone]

  return (
    <div
      className={`afri-card-rise rounded-2xl border border-white p-4 shadow-sm ${style.card}`}
    >
      <div className="flex items-start justify-between gap-3">

        <div>
          <p className="text-xs font-bold text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-xl font-black">
            {value}
          </p>

          {caption ? (
            <p className="mt-1 text-[10px] font-bold text-slate-400">
              {caption}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// HISTOGRAMME
// ============================================================

function AnimatedBar({
  label,
  height,
  delay,
  tone,
}: {
  label: string
  height: string
  delay: string
  tone:
    | 'blue'
    | 'teal'
    | 'emerald'
    | 'cyan'
    | 'gold'
}) {
  const toneClasses = {
    blue:
      'from-blue-700 via-blue-500 to-sky-300',

    teal:
      'from-teal-700 via-teal-500 to-cyan-300',

    emerald:
      'from-emerald-700 via-emerald-500 to-green-300',

    cyan:
      'from-cyan-700 via-cyan-500 to-sky-300',

    gold:
      'from-amber-600 via-amber-400 to-yellow-300',
  }

  return (
    <div className="flex h-full flex-1 flex-col justify-end">

      <div className="flex h-full items-end">
        <div
          className={`afri-histogram-bar w-full min-w-3 rounded-t-xl bg-gradient-to-t ${toneClasses[tone]}`}
          style={{
            height,
            animationDelay:
              delay,
          }}
        />
      </div>

      <p className="mt-2 text-center text-[10px] font-bold text-slate-400">
        {label}
      </p>
    </div>
  )
}

// ============================================================
// PROGRESSION
// ============================================================

function ProgressRow({
  label,
  value,
  width,
  tone,
  delay,
}: {
  label: string
  value: string
  width: string
  tone:
    | 'green'
    | 'gold'
    | 'blue'
  delay: string
}) {
  const colors = {
    green:
      'bg-gradient-to-r from-emerald-700 to-emerald-400',

    gold:
      'bg-gradient-to-r from-amber-500 to-yellow-300',

    blue:
      'bg-gradient-to-r from-blue-600 to-cyan-400',
  }

  return (
    <div>

      <div className="flex justify-between gap-3 text-xs font-bold">
        <span>
          {label}
        </span>

        <span>
          {value}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">

        <div
          className={`afri-progress-bar h-full rounded-full ${colors[tone]}`}
          style={{
            width,
            animationDelay:
              delay,
          }}
        />
      </div>
    </div>
  )
}

// ============================================================
// MINI ACTION
// ============================================================

function MiniAction({
  icon,
  label,
  tone,
}: {
  icon: ReactNode
  label: string
  tone:
    | 'blue'
    | 'green'
    | 'gold'
}) {
  const styles = {
    blue:
      'bg-blue-50 text-blue-700',

    green:
      'bg-emerald-50 text-emerald-700',

    gold:
      'bg-amber-50 text-amber-700',
  }

  return (
    <div className="afri-card-rise rounded-2xl bg-white p-3 text-center shadow-sm">

      <div
        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl ${styles[tone]}`}
      >
        {icon}
      </div>

      <p className="mt-2 text-[11px] font-black">
        {label}
      </p>
    </div>
  )
}

// ============================================================
// TRUST ITEM
// ============================================================

function TrustItem({
  icon,
  text,
}: {
  icon: ReactNode
  text: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-emerald-700">
        {icon}
      </span>

      {text}
    </div>
  )
}

// ============================================================
// FLUX DE PAIEMENT
// ============================================================

function PaymentNode({
  icon,
  visual,
  eyebrow,
  title,
  description,
  tone,
}: {
  icon: ReactNode
  visual?: ReactNode
  eyebrow: string
  title: string
  description: string
  tone: 'blue' | 'emerald' | 'amber'
}) {
  const styles = {
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="afri-payment-node h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="min-h-[94px]">
        {visual ? (
          visual
        ) : (
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles[tone]}`}>
            {icon}
          </div>
        )}
      </div>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-black text-slate-950">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  )
}

function PaymentProviderCloud({
  secureLabel,
  ariaLabel,
}: {
  secureLabel: string
  ariaLabel: string
}) {
  const providers = [
    {
      title: 'Orange Money',
      src: PAYMENT_LOGOS.orangeMoney,
      tone: 'orange' as const,
      imageClass: 'max-h-7 max-w-[92px]',
    },
    {
      title: 'Wave',
      src: PAYMENT_LOGOS.wave,
      tone: 'cyan' as const,
      imageClass: 'max-h-8 max-w-[76px]',
    },
    {
      title: 'MTN Mobile Money',
      src: PAYMENT_LOGOS.mtnMomo,
      tone: 'yellow' as const,
      imageClass: 'max-h-8 max-w-[96px]',
    },
    {
      title: 'Moov Money',
      src: PAYMENT_LOGOS.moovMoney,
      tone: 'emerald' as const,
      imageClass: 'max-h-8 max-w-[92px]',
    },
    {
      title: 'Mastercard',
      src: PAYMENT_LOGOS.mastercard,
      tone: 'violet' as const,
      imageClass: 'max-h-7 max-w-[100px]',
    },
  ]

  return (
    <div
      className="w-full max-w-[270px]"
      aria-label={ariaLabel}
    >
      <div className="rounded-[1.65rem] border border-emerald-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FFFC_100%)] p-3 shadow-sm shadow-emerald-100/60">
        <div className="grid grid-cols-2 gap-2">
          {providers.map((provider) => (
            <ProviderMiniBadge
              key={provider.title}
              title={provider.title}
              tone={provider.tone}
              className="justify-center"
            >
              <Image
                src={provider.src}
                alt={provider.title}
                width={110}
                height={44}
                className={`h-auto w-auto object-contain ${provider.imageClass}`}
              />
            </ProviderMiniBadge>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            {secureLabel}
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-500 shadow-sm">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            PSP
          </span>
        </div>
      </div>
    </div>
  )
}

function ProviderMiniBadge({
  title,
  tone,
  className = '',
  children,
}: {
  title: string
  tone: 'orange' | 'cyan' | 'yellow' | 'emerald' | 'blue' | 'violet'
  className?: string
  children: ReactNode
}) {
  const tones = {
    orange: 'border-orange-100 bg-orange-50/90',
    cyan: 'border-cyan-100 bg-cyan-50/90',
    yellow: 'border-yellow-200 bg-yellow-50/90',
    emerald: 'border-emerald-100 bg-emerald-50/90',
    blue: 'border-blue-100 bg-blue-50/90',
    violet: 'border-violet-100 bg-violet-50/90',
  }

  return (
    <span
      title={title}
      className={`inline-flex h-12 min-w-0 items-center gap-1.5 overflow-hidden rounded-2xl border px-2.5 shadow-sm ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

function FlowConnector({
  delay,
}: {
  delay: string
}) {
  return (
    <div className="relative hidden h-12 lg:block">
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-emerald-200 via-emerald-500 to-cyan-300" />
      <span
        className="afri-flow-dot absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,.95)]"
        style={{ animationDelay: delay }}
      />
      <ArrowRight className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" />
    </div>
  )
}

function PaymentAction({
  icon,
  text,
  delay,
}: {
  icon: ReactNode
  text: string
  delay: string
}) {
  return (
    <div
      className="afri-payment-action flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur"
      style={{ animationDelay: delay }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
        {icon}
      </span>
      <p className="text-sm font-bold text-slate-100">
        {text}
      </p>
    </div>
  )
}

// ============================================================
// INTRO DE SECTION
// ============================================================

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">

      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>

      <p className="mt-5 text-base leading-7 text-slate-600">
        {description}
      </p>
    </div>
  )
}

// ============================================================
// CARTE ORGANISATION
// ============================================================

function OrganizationCard({
  icon,
  title,
  description,
  tone,
}: {
  icon: ReactNode
  title: string
  description: string
  tone:
    | 'emerald'
    | 'blue'
    | 'cyan'
    | 'amber'
    | 'violet'
    | 'rose'
}) {
  const styles = {
    emerald: {
      card:
        'border-emerald-100 bg-gradient-to-br from-white to-emerald-50',
      icon:
        'bg-emerald-100 text-emerald-700',
    },

    blue: {
      card:
        'border-blue-100 bg-gradient-to-br from-white to-blue-50',
      icon:
        'bg-blue-100 text-blue-700',
    },

    cyan: {
      card:
        'border-cyan-100 bg-gradient-to-br from-white to-cyan-50',
      icon:
        'bg-cyan-100 text-cyan-700',
    },

    amber: {
      card:
        'border-amber-100 bg-gradient-to-br from-white to-amber-50',
      icon:
        'bg-amber-100 text-amber-700',
    },

    violet: {
      card:
        'border-violet-100 bg-gradient-to-br from-white to-violet-50',
      icon:
        'bg-violet-100 text-violet-700',
    },

    rose: {
      card:
        'border-rose-100 bg-gradient-to-br from-white to-rose-50',
      icon:
        'bg-rose-100 text-rose-700',
    },
  }

  const style =
    styles[tone]

  return (
    <div
      className={`afri-card-rise rounded-3xl border p-6 shadow-sm ${style.card}`}
    >
      <div
        className={`flex h-13 w-13 items-center justify-center rounded-2xl p-3 ${style.icon}`}
      >
        {icon}
      </div>

      <h3 className="mt-5 text-xl font-black">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  )
}

// ============================================================
// FEATURE
// ============================================================

function FeatureCard({
  number,
  icon,
  title,
  description,
}: {
  number: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <article className="afri-card-rise group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

      <div className="flex items-center justify-between">

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-950 to-emerald-950 text-white">
          {icon}
        </div>

        <span className="text-3xl font-black text-slate-100 transition group-hover:text-emerald-100">
          {number}
        </span>
      </div>

      <h3 className="mt-5 text-xl font-black">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {description}
      </p>
    </article>
  )
}

// ============================================================
// TRANSPARENCE
// ============================================================

function DarkCheck({
  text,
}: {
  text: string
}) {
  return (
    <div className="flex items-center gap-3">

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/10">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      </div>

      <p className="font-semibold text-slate-200">
        {text}
      </p>
    </div>
  )
}

// ============================================================
// LIGHT CHECK
// ============================================================

function LightCheck({
  text,
}: {
  text: string
}) {
  return (
    <div className="flex items-center gap-3">

      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />

      <p className="font-semibold text-slate-700">
        {text}
      </p>
    </div>
  )
}

// ============================================================
// SITUATION
// ============================================================

function SituationCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone:
    | 'green'
    | 'amber'
    | 'blue'
    | 'violet'
}) {
  const colors = {
    green:
      'border-emerald-100 bg-emerald-50',

    amber:
      'border-amber-100 bg-amber-50',

    blue:
      'border-blue-100 bg-blue-50',

    violet:
      'border-violet-100 bg-violet-50',
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${colors[tone]}`}
    >
      <p className="text-xs font-bold text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-black text-slate-950">
        {value}
      </p>
    </div>
  )
}

// ============================================================
// ETAPES
// ============================================================

function StepCard({
  number,
  title,
  description,
  icon,
}: {
  number: string
  title: string
  description: string
  icon: ReactNode
}) {
  return (
    <div className="afri-card-rise relative rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

      <div className="absolute right-6 top-5 text-5xl font-black text-amber-100">
        {number}
      </div>

      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        {icon}
      </div>

      <h3 className="mt-6 text-xl font-black">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  )
}