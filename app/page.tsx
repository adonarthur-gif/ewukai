import type { ReactNode } from 'react'

import Link from 'next/link'

import PricingSection from '@/components/marketing/pricing-section'

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
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

// ============================================================
// PAGE D'ACCUEIL AFRI CLUB - PREMIUM V2
// ============================================================

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">

      {/* ==================================================== */}
      {/* NAVIGATION */}
      {/* ==================================================== */}

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">

          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 font-black text-white shadow-lg shadow-emerald-950/10">
              AC
            </div>

            <div>
              <p className="text-lg font-black tracking-tight text-slate-950">
                AFRI CLUB
              </p>

              <p className="hidden text-[11px] font-semibold text-slate-500 sm:block">
                La gestion moderne des organisations
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            <a
              href="#organisations"
              className="transition hover:text-emerald-700"
            >
              Organisations
            </a>

            <a
              href="#solutions"
              className="transition hover:text-emerald-700"
            >
              Fonctionnalités
            </a>

            <a
              href="#tarifs"
              className="transition hover:text-emerald-700"
            >
              Tarifs
            </a>

            <a
              href="#transparence"
              className="transition hover:text-emerald-700"
            >
              Transparence
            </a>

            <a
              href="#demarrer"
              className="transition hover:text-emerald-700"
            >
              Démarrer
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
            >
              Se connecter
            </Link>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-950/10 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Créer mon organisation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ==================================================== */}
      {/* HERO PREMIUM */}
      {/* ==================================================== */}

      <section className="relative overflow-hidden bg-[linear-gradient(120deg,#050B18_0%,#071827_48%,#064E4B_100%)] text-white">

        {/* HALOS ANIMES */}

        <div className="afri-glow-one absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="afri-glow-two absolute right-[-160px] top-[-80px] h-[560px] w-[560px] rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="absolute bottom-[-220px] left-[40%] h-[420px] w-[420px] rounded-full bg-amber-300/10 blur-3xl" />

        {/* GRILLE DECORATIVE */}

        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:56px_56px]" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-28">

          {/* TEXTE */}

          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.17em] text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Digitalisez votre organisation
            </div>

            <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
              Gérez votre
              <br />
              organisation
              <br />

              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                simplement.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Mutuelles, associations, ONG,
              coopératives, tontines et communautés :
              centralisez vos membres, vos cotisations,
              votre trésorerie et vos activités dans
              un seul espace.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-6 py-4 font-black text-slate-950 shadow-xl shadow-emerald-950/20 transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
              >
                Créer mon organisation
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black text-white backdrop-blur transition hover:bg-white/10"
              >
                J’ai déjà un compte
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-300">
              <HeroCheck text="Mise en place simple" />
              <HeroCheck text="Espace membre sécurisé" />
              <HeroCheck text="Formule gratuite disponible" />
            </div>
          </div>

          {/* ================================================= */}
          {/* DASHBOARD DEMO */}
          {/* ================================================= */}

          <div className="afri-dashboard-float relative">

            <div className="absolute -inset-10 rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/95 p-3 shadow-[0_35px_90px_rgba(0,0,0,.30)] backdrop-blur">

              <div className="rounded-[1.6rem] bg-[#F6F8FB] p-5 text-slate-950 sm:p-6">

                {/* DASHBOARD HEADER */}

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                      Tableau de bord
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Votre organisation
                    </h2>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-500 font-black text-white shadow-lg">
                    VO
                  </div>
                </div>

                {/* KPI */}

                <div className="mt-6 grid grid-cols-2 gap-3">

                  <PreviewStat
                    label="Membres"
                    value="248"
                    caption="+18 ce mois"
                    icon={<Users className="h-5 w-5" />}
                    tone="blue"
                  />

                  <PreviewStat
                    label="Cotisations"
                    value="92%"
                    caption="+6,4%"
                    icon={<TrendingUp className="h-5 w-5" />}
                    tone="green"
                  />

                  <PreviewStat
                    label="Entrées"
                    value="1,84 M"
                    caption="FCFA"
                    icon={<Wallet className="h-5 w-5" />}
                    tone="teal"
                  />

                  <PreviewStat
                    label="Solde"
                    value="1,26 M"
                    caption="FCFA"
                    icon={<CircleDollarSign className="h-5 w-5" />}
                    tone="gold"
                  />
                </div>

                {/* HISTOGRAMME */}

                <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        Evolution
                      </p>

                      <p className="mt-1 font-black">
                        Recouvrement sur 6 mois
                      </p>
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-7 flex h-40 items-end gap-3">

                    <AnimatedBar
                      label="Jan"
                      height="42%"
                      delay="0ms"
                      tone="blue"
                    />

                    <AnimatedBar
                      label="Fév"
                      height="55%"
                      delay="90ms"
                      tone="teal"
                    />

                    <AnimatedBar
                      label="Mar"
                      height="63%"
                      delay="180ms"
                      tone="emerald"
                    />

                    <AnimatedBar
                      label="Avr"
                      height="74%"
                      delay="270ms"
                      tone="emerald"
                    />

                    <AnimatedBar
                      label="Mai"
                      height="84%"
                      delay="360ms"
                      tone="cyan"
                    />

                    <AnimatedBar
                      label="Juin"
                      height="94%"
                      delay="450ms"
                      tone="gold"
                    />
                  </div>
                </div>

                {/* RECOUVREMENT */}

                <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        Recouvrement
                      </p>

                      <p className="mt-1 font-black">
                        Situation mensuelle
                      </p>
                    </div>

                    <BadgeCheck className="h-6 w-6 text-emerald-600" />
                  </div>

                  <div className="mt-5 space-y-4">
                    <ProgressRow
                      label="Cotisations payées"
                      value="92%"
                      width="92%"
                      tone="green"
                      delay="100ms"
                    />

                    <ProgressRow
                      label="Partiellement réglées"
                      value="5%"
                      width="55%"
                      tone="gold"
                      delay="250ms"
                    />

                    <ProgressRow
                      label="À régulariser"
                      value="3%"
                      width="32%"
                      tone="blue"
                      delay="400ms"
                    />
                  </div>
                </div>

                {/* RACCOURCIS */}

                <div className="mt-4 grid grid-cols-3 gap-3">

                  <MiniAction
                    icon={<Users className="h-5 w-5" />}
                    label="Membres"
                    tone="blue"
                  />

                  <MiniAction
                    icon={<Wallet className="h-5 w-5" />}
                    label="Trésorerie"
                    tone="green"
                  />

                  <MiniAction
                    icon={<ReceiptText className="h-5 w-5" />}
                    label="Reçus"
                    tone="gold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* BANDE DE CONFIANCE */}
      {/* ==================================================== */}

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-9 gap-y-4 px-4 py-6 text-sm font-black text-slate-500 sm:px-6">

          <TrustItem
            icon={<Users className="h-4 w-4" />}
            text="Membres"
          />

          <TrustItem
            icon={<HandCoins className="h-4 w-4" />}
            text="Cotisations"
          />

          <TrustItem
            icon={<Wallet className="h-4 w-4" />}
            text="Trésorerie"
          />

          <TrustItem
            icon={<Smartphone className="h-4 w-4" />}
            text="Paiements"
          />

          <TrustItem
            icon={<ReceiptText className="h-4 w-4" />}
            text="Reçus"
          />

          <TrustItem
            icon={<ShieldCheck className="h-4 w-4" />}
            text="Traçabilité"
          />
        </div>
      </section>

      {/* ==================================================== */}
      {/* ORGANISATIONS */}
      {/* ==================================================== */}

      <section
        id="organisations"
        className="bg-[#F8FAFC] py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <SectionIntro
            eyebrow="Pour toutes les organisations"
            title="Un espace qui s’adapte à votre réalité"
            description="Chaque organisation fonctionne différemment. Afri Club fournit une base commune de gestion, tout en laissant chaque structure conserver son identité."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

            <OrganizationCard
              icon={<HeartHandshake className="h-7 w-7" />}
              title="Mutuelles"
              description="Membres, fonds sociaux, cotisations, appels exceptionnels et recouvrement."
              tone="emerald"
            />

            <OrganizationCard
              icon={<Users className="h-7 w-7" />}
              title="Associations"
              description="Adhérents, contributions, activités, événements et gestion financière."
              tone="blue"
            />

            <OrganizationCard
              icon={<Globe2 className="h-7 w-7" />}
              title="ONG"
              description="Adhérents, bénéficiaires, programmes, ressources et suivi des activités."
              tone="cyan"
            />

            <OrganizationCard
              icon={<Landmark className="h-7 w-7" />}
              title="Coopératives"
              description="Sociétaires, apports, activités collectives et suivi financier."
              tone="amber"
            />

            <OrganizationCard
              icon={<HandCoins className="h-7 w-7" />}
              title="Tontines"
              description="Participants, versements, échéances, tours et historique des opérations."
              tone="violet"
            />

            <OrganizationCard
              icon={<Building2 className="h-7 w-7" />}
              title="Clubs & communautés"
              description="Adhésions, membres, activités, cotisations et fonctionnement communautaire."
              tone="rose"
            />
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
            eyebrow="Tout au même endroit"
            title="Les outils essentiels pour mieux gérer"
            description="Réduisez les tableaux dispersés, les calculs manuels et les informations perdues. Votre organisation dispose enfin d'une base unique."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

            <FeatureCard
              number="01"
              icon={<Users className="h-6 w-6" />}
              title="Gestion des membres"
              description="Centralisez les dossiers, matricules, coordonnées, statuts et historiques de vos membres."
            />

            <FeatureCard
              number="02"
              icon={<HandCoins className="h-6 w-6" />}
              title="Cotisations & recouvrement"
              description="Suivez les montants dus, payés, partiels, impayés, les avances et les échéances."
            />

            <FeatureCard
              number="03"
              icon={<Wallet className="h-6 w-6" />}
              title="Trésorerie"
              description="Enregistrez les entrées, les dépenses et les comptes avec une vision claire du solde."
            />

            <FeatureCard
              number="04"
              icon={<ReceiptText className="h-6 w-6" />}
              title="Reçus électroniques"
              description="Conservez la trace de chaque paiement et générez des justificatifs consultables."
            />

            <FeatureCard
              number="05"
              icon={<Smartphone className="h-6 w-6" />}
              title="Espace personnel membre"
              description="Chaque membre consulte sa situation, ses paiements, ses reçus et les moyens de règlement."
            />

            <FeatureCard
              number="06"
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Droits & sécurité"
              description="Les responsables et les membres accèdent uniquement aux fonctions correspondant à leurs droits."
            />
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* TARIFS */}
      {/* ==================================================== */}

      <PricingSection />

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
              Confiance & transparence
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Donnez à vos membres une
              vision claire de leur situation.
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Des informations accessibles,
              des opérations traçables et des
              responsabilités clairement définies
              renforcent la confiance dans votre
              organisation.
            </p>

            <div className="mt-8 space-y-4">
              <DarkCheck text="Historique des paiements" />
              <DarkCheck text="Situation des cotisations" />
              <DarkCheck text="Reçus et références des opérations" />
              <DarkCheck text="Suivi des entrées et sorties" />
              <DarkCheck text="Accès personnel de chaque membre" />
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
                      Espace membre
                    </p>

                    <p className="text-xl font-black">
                      Situation personnelle
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">

                <div className="grid gap-3 sm:grid-cols-2">
                  <SituationCard
                    label="Déjà payé"
                    value="45 000 FCFA"
                    tone="green"
                  />

                  <SituationCard
                    label="Reste exigible"
                    value="5 000 FCFA"
                    tone="amber"
                  />

                  <SituationCard
                    label="Avance"
                    value="10 000 FCFA"
                    tone="blue"
                  />

                  <SituationCard
                    label="Dernier paiement"
                    value="15 août"
                    tone="violet"
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="font-black text-emerald-900">
                    ✓ Situation à jour
                  </p>

                  <p className="mt-1 text-sm leading-6 text-emerald-700">
                    Les opérations enregistrées
                    par votre organisation sont
                    disponibles depuis votre
                    espace personnel.
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
            eyebrow="Simple à mettre en place"
            title="Votre organisation en ligne en quelques étapes"
            description="Créez votre espace, choisissez la formule adaptée à votre taille et commencez à gérer sans procédure compliquée."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">

            <StepCard
              number="1"
              title="Créez votre compte"
              description="Le responsable crée son compte sécurisé et démarre l'inscription de son organisation."
              icon={<Users className="h-6 w-6" />}
            />

            <StepCard
              number="2"
              title="Configurez votre organisation"
              description="Ajoutez son nom, son type, son logo, ses couleurs et ses premiers paramètres."
              icon={<Building2 className="h-6 w-6" />}
            />

            <StepCard
              number="3"
              title="Choisissez votre formule"
              description="Gratuit, Standard ou Pro : sélectionnez la formule adaptée au nombre de membres de votre organisation."
              icon={<CircleDollarSign className="h-6 w-6" />}
            />

            <StepCard
              number="4"
              title="Activez et commencez"
              description="Le Gratuit est activé immédiatement. Les offres payantes sont activées automatiquement après confirmation du paiement intégral."
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
                  Votre identité
                </p>

                <h2 className="mt-4 text-3xl font-black tracking-tight">
                  Votre organisation reste
                  au premier plan.
                </h2>

                <p className="mt-5 max-w-xl leading-7 text-slate-600">
                  Personnalisez votre espace avec
                  votre nom, votre logo et vos
                  couleurs. Vos membres retrouvent
                  l’identité de leur organisation
                  dans leur espace personnel.
                </p>

                <div className="mt-7 space-y-3">
                  <LightCheck text="Logo de votre organisation" />
                  <LightCheck text="Couleurs personnalisées" />
                  <LightCheck text="Page publique de présentation" />
                  <LightCheck text="Espace membre personnalisé" />
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
                        Mon Organisation
                      </p>

                      <p className="text-sm text-slate-500">
                        Espace officiel
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-[linear-gradient(135deg,#071525,#064E4B)] p-6 text-white">

                    <p className="text-sm text-slate-300">
                      Bienvenue dans votre espace
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      Bonjour Jean
                    </p>

                    <div className="mt-6 flex gap-3">

                      <div className="rounded-xl bg-white/10 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase text-emerald-300">
                          Matricule
                        </p>

                        <p className="mt-1 font-black">
                          MO-000248
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/10 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase text-cyan-300">
                          Statut
                        </p>

                        <p className="mt-1 font-black">
                          Actif
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
              Passez à une gestion moderne
            </p>

            <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              Donnez à votre organisation
              les outils pour mieux gérer,
              communiquer et grandir.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl leading-7 text-emerald-50">
              Créez votre espace, ajoutez vos
              membres et commencez à structurer
              votre organisation.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">

              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-black text-emerald-800 shadow-lg transition hover:-translate-y-1 hover:bg-emerald-50"
              >
                Créer mon organisation
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                href="/login/dirigeant"
                className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-6 py-4 font-black text-white backdrop-blur transition hover:bg-white/15"
              >
                Connexion dirigeant
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* FOOTER */}
      {/* ==================================================== */}

      <footer className="border-t border-slate-200 bg-[#F8FAFC]">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center lg:px-8">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-teal-500 font-black text-white">
              AC
            </div>

            <div>
              <p className="font-black text-slate-950">
                AFRI CLUB
              </p>

              <p className="text-sm text-slate-500">
                La plateforme de gestion des
                organisations et communautés.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-500">

            <Link
              href="/login"
              className="hover:text-emerald-700"
            >
              Connexion
            </Link>

            <Link
              href="/register"
              className="hover:text-emerald-700"
            >
              Créer une organisation
            </Link>

            <span>
              Côte d’Ivoire
            </span>
          </div>
        </div>
      </footer>
    </main>
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
  caption: string
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

          <p className="mt-1 text-[10px] font-bold text-slate-400">
            {caption}
          </p>
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