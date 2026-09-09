import type {
  ReactNode,
} from 'react'

import {
  Building2,
  CheckCircle2,
  Globe2,
  HandCoins,
  HeartHandshake,
  Landmark,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import {
  createOrganization,
} from './actions'

// ============================================================
// AFRI CLUB
// ONBOARDING
// CREATION D'UNE ORGANISATION
// ============================================================

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

// ============================================================
// PAGE
// ============================================================

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params =
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

  const connectedEmail =
    typeof authData
      ?.claims
      ?.email ===
    'string'
      ? authData.claims.email
      : null

  if (
    authError ||
    !userId
  ) {
    redirect('/login')
  }

  // ==========================================================
  // EVITER UN SECOND ONBOARDING DE GESTION
  //
  // IMPORTANT :
  // Un utilisateur peut déjà être simple membre d'une ou
  // plusieurs mutuelles et créer ensuite sa propre organisation.
  // Seul un rôle de GESTION actif bloque un nouvel onboarding.
  // ==========================================================

  const {
    data:
      existingOrganization,

    error:
      existingOrganizationError,
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
        'is_active',
        true
      )
      .in(
        'role',
        [
          'owner',
          'president',
          'treasurer',
          'secretary',
          'auditor',
        ]
      )
      .limit(1)
      .maybeSingle()

  if (
    existingOrganizationError
  ) {
    console.error(
      'AFRI CLUB - ONBOARDING PAGE:',
      existingOrganizationError
    )

    throw new Error(
      'Impossible de vérifier votre compte.'
    )
  }

  if (
    existingOrganization
  ) {
    redirect('/dashboard')
  }

  // ==========================================================
  // PROFIL EXISTANT
  // ==========================================================

  const {
    data: profile,
  } =
    await supabase
      .from('profiles')
      .select(`
        full_name,
        phone
      `)
      .eq(
        'id',
        userId
      )
      .maybeSingle()

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#EFFCF7_48%,#F8FAFC_100%)]">

      {/* ==================================================== */}
      {/* HERO */}
      {/* ==================================================== */}

      <section className="relative overflow-hidden bg-[linear-gradient(120deg,#050B18,#071B28_52%,#065F46)] text-white">

        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-16">

          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">

            <Sparkles className="h-4 w-4" />

            Première configuration

          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-emerald-400">
            AFRI CLUB
          </p>

          <h1 className="mx-auto mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Créons votre organisation
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Configurez votre association,
            mutuelle ou organisation.
            Votre espace de gestion sera
            créé immédiatement et vous
            pourrez aussi devenir son
            premier membre.
          </p>

        </div>

      </section>

      {/* ==================================================== */}
      {/* CONTENU */}
      {/* ==================================================== */}

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* ================================================== */}
        {/* ERREUR */}
        {/* ================================================== */}

        {params.error && (
          <div className="mx-auto mb-7 max-w-5xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            {params.error}
          </div>
        )}

        <form
          action={
            createOrganization
          }
          className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-950/5"
        >

          {/* ================================================= */}
          {/* ETAPE 1 - TYPE */}
          {/* ================================================= */}

          <section className="border-b border-slate-200 p-6 sm:p-8">

            <SectionTitle
              eyebrow="Étape 1"
              title="Quel type d'organisation souhaitez-vous gérer ?"
              description="Choisissez la catégorie qui correspond le mieux à votre structure."
            />

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              <OrganizationType
                value="mutual"
                title="Mutuelle"
                description="Solidarité et cotisations"
                icon={
                  <HeartHandshake className="h-6 w-6" />
                }
                tone="emerald"
                defaultChecked
              />

              <OrganizationType
                value="association"
                title="Association"
                description="Membres et activités"
                icon={
                  <Users className="h-6 w-6" />
                }
                tone="blue"
              />

              <OrganizationType
                value="ngo"
                title="ONG"
                description="Programmes et impact"
                icon={
                  <Globe2 className="h-6 w-6" />
                }
                tone="cyan"
              />

              <OrganizationType
                value="cooperative"
                title="Coopérative"
                description="Sociétaires et activités"
                icon={
                  <Landmark className="h-6 w-6" />
                }
                tone="amber"
              />

              <OrganizationType
                value="tontine"
                title="Tontine"
                description="Versements et tours"
                icon={
                  <HandCoins className="h-6 w-6" />
                }
                tone="violet"
              />

              <OrganizationType
                value="club"
                title="Club"
                description="Adhésions et communauté"
                icon={
                  <Trophy className="h-6 w-6" />
                }
                tone="rose"
              />

              <OrganizationType
                value="foundation"
                title="Fondation"
                description="Mission et programmes"
                icon={
                  <ShieldCheck className="h-6 w-6" />
                }
                tone="orange"
              />

              <OrganizationType
                value="community"
                title="Communauté"
                description="Groupe et entraide"
                icon={
                  <Users className="h-6 w-6" />
                }
                tone="teal"
              />

              <OrganizationType
                value="other"
                title="Autre"
                description="Autre organisation"
                icon={
                  <Building2 className="h-6 w-6" />
                }
                tone="slate"
              />

            </div>

          </section>

          {/* ================================================= */}
          {/* ETAPE 2 - IDENTITE */}
          {/* ================================================= */}

          <section className="border-b border-slate-200 p-6 sm:p-8">

            <SectionTitle
              eyebrow="Étape 2"
              title="Identité de votre organisation"
              description="Ces informations permettront d'identifier clairement votre structure."
            />

            <div className="mt-7 grid gap-5 sm:grid-cols-2">

              <div className="sm:col-span-2">

                <Label
                  htmlFor="name"
                  required
                >
                  Nom de l&apos;organisation
                </Label>

                <input
                  id="name"
                  name="name"
                  required
                  autoFocus
                  placeholder="Ex. Association Test ATA"
                  className="onboarding-input"
                />

              </div>

              <div>

                <Label
                  htmlFor="shortName"
                  required
                >
                  Sigle
                </Label>

                <input
                  id="shortName"
                  name="shortName"
                  required
                  minLength={2}
                  maxLength={30}
                  placeholder="Ex. ATA"
                  className="onboarding-input uppercase"
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Le sigle sera notamment
                  utilisé pour générer les
                  matricules :
                  {' '}
                  <strong>
                    ATA-000001
                  </strong>
                </p>

              </div>

              <div>

                <Label
                  htmlFor="legalName"
                >
                  Dénomination officielle
                </Label>

                <input
                  id="legalName"
                  name="legalName"
                  maxLength={200}
                  placeholder="Si différente du nom courant"
                  className="onboarding-input"
                />

              </div>

              <div>

                <Label
                  htmlFor="registrationNumber"
                >
                  Numéro d&apos;enregistrement
                </Label>

                <input
                  id="registrationNumber"
                  name="registrationNumber"
                  maxLength={100}
                  placeholder="Récépissé, agrément, registre..."
                  className="onboarding-input"
                />

              </div>

              <div>

                <Label
                  htmlFor="slogan"
                >
                  Slogan
                </Label>

                <input
                  id="slogan"
                  name="slogan"
                  maxLength={200}
                  placeholder="Ex. Ensemble pour aller plus loin."
                  className="onboarding-input"
                />

              </div>

            </div>

          </section>

          {/* ================================================= */}
          {/* ETAPE 3 - COORDONNEES */}
          {/* ================================================= */}

          <section className="border-b border-slate-200 bg-slate-50/60 p-6 sm:p-8">

            <SectionTitle
              eyebrow="Étape 3"
              title="Coordonnées de l'organisation"
              description="Indiquez où se trouve votre organisation et comment elle peut être contactée."
            />

            <div className="mt-7 grid gap-5 sm:grid-cols-2">

              <div>

                <Label
                  htmlFor="countryCode"
                  required
                >
                  Pays
                </Label>

                <select
                  id="countryCode"
                  name="countryCode"
                  required
                  defaultValue="CI"
                  className="onboarding-input"
                >

                  <option value="CI">
                    Côte d&apos;Ivoire
                  </option>

                  <option value="BJ">
                    Bénin
                  </option>

                  <option value="BF">
                    Burkina Faso
                  </option>

                  <option value="CM">
                    Cameroun
                  </option>

                  <option value="GH">
                    Ghana
                  </option>

                  <option value="GN">
                    Guinée
                  </option>

                  <option value="ML">
                    Mali
                  </option>

                  <option value="NE">
                    Niger
                  </option>

                  <option value="SN">
                    Sénégal
                  </option>

                  <option value="TG">
                    Togo
                  </option>

                  <option value="OTHER">
                    Autre pays
                  </option>

                </select>

              </div>

              <div>

                <Label
                  htmlFor="city"
                >
                  Ville / localité
                </Label>

                <input
                  id="city"
                  name="city"
                  maxLength={150}
                  placeholder="Ex. Abidjan"
                  className="onboarding-input"
                />

              </div>

              <div>

                <Label
                  htmlFor="phone"
                >
                  Téléphone de l&apos;organisation
                </Label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  maxLength={50}
                  placeholder="Ex. +225 07 00 00 00 00"
                  className="onboarding-input"
                />

              </div>

              <div>

                <Label
                  htmlFor="email"
                >
                  E-mail de l&apos;organisation
                </Label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  maxLength={200}
                  placeholder="contact@organisation.org"
                  className="onboarding-input"
                />

              </div>

              <div className="sm:col-span-2">

                <Label
                  htmlFor="website"
                >
                  Site internet
                </Label>

                <input
                  id="website"
                  name="website"
                  type="text"
                  maxLength={250}
                  placeholder="https://..."
                  className="onboarding-input"
                />

              </div>

            </div>

          </section>

          {/* ================================================= */}
          {/* ETAPE 4 - RESPONSABLE */}
          {/* ================================================= */}

          <section className="border-b border-slate-200 p-6 sm:p-8">

            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">

              <div>

                <SectionTitle
                  eyebrow="Étape 4"
                  title="Votre profil de responsable"
                  description="Votre compte Afri Club deviendra automatiquement le compte Responsable de cette organisation."
                />

                <div className="mt-7 grid gap-5 sm:grid-cols-2">

                  <div>

                    <Label
                      htmlFor="ownerLastName"
                      required
                    >
                      Nom
                    </Label>

                    <input
                      id="ownerLastName"
                      name="ownerLastName"
                      maxLength={100}
                      placeholder="Ex. ADON"
                      className="onboarding-input uppercase"
                    />

                  </div>

                  <div>

                    <Label
                      htmlFor="ownerFirstName"
                      required
                    >
                      Prénoms
                    </Label>

                    <input
                      id="ownerFirstName"
                      name="ownerFirstName"
                      maxLength={100}
                      placeholder="Ex. Krist"
                      className="onboarding-input"
                    />

                  </div>

                </div>

                {connectedEmail && (
                  <div className="mt-5 rounded-xl bg-slate-50 p-4">

                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Compte Afri Club connecté
                    </p>

                    <p className="mt-1 font-bold text-slate-900">
                      {connectedEmail}
                    </p>

                  </div>
                )}

                {profile?.full_name && (
                  <p className="mt-3 text-xs text-slate-500">
                    Profil actuel :
                    {' '}
                    {profile.full_name}
                  </p>
                )}

              </div>

              {/* ============================================= */}
              {/* PREMIER MEMBRE */}
              {/* ============================================= */}

              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white">

                  <UserRound className="h-6 w-6" />

                </div>

                <h3 className="mt-5 text-xl font-black text-emerald-950">
                  Être aussi membre
                </h3>

                <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                  Par défaut, le créateur
                  de l&apos;organisation
                  sera également enregistré
                  comme son premier membre.
                </p>

                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-300 bg-white p-4">

                  <input
                    type="checkbox"
                    name="ownerAsMember"
                    defaultChecked
                    className="mt-1 h-5 w-5 rounded border-slate-300 accent-emerald-700"
                  />

                  <span>

                    <span className="block font-black text-slate-900">
                      M&apos;enregistrer comme membre
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Votre accès membre
                      sera activé immédiatement.
                      Aucun lien d&apos;invitation
                      ne sera nécessaire.
                    </span>

                  </span>

                </label>

                <div className="mt-5 space-y-3 text-sm">

                  <CheckItem>
                    Rôle de gestion :
                    {' '}
                    <strong>
                      Responsable
                    </strong>
                  </CheckItem>

                  <CheckItem>
                    Premier matricule :
                    {' '}
                    <strong>
                      SIGLE-000001
                    </strong>
                  </CheckItem>

                  <CheckItem>
                    Accès membre :
                    {' '}
                    <strong>
                      activé
                    </strong>
                  </CheckItem>

                </div>

              </div>

            </div>

          </section>

          {/* ================================================= */}
          {/* ETAPE 5 - OBJECTIFS */}
          {/* ================================================= */}

          <section className="border-b border-slate-200 bg-slate-50/60 p-6 sm:p-8">

            <SectionTitle
              eyebrow="Étape 5"
              title="Que souhaite accomplir votre organisation ?"
              description="Décrivez brièvement ses principaux objectifs. Vous pourrez les modifier ultérieurement."
            />

            <textarea
              id="objectives"
              name="objectives"
              rows={6}
              maxLength={4000}
              placeholder={`Exemple :

• Renforcer la solidarité entre les membres.
• Soutenir les membres en difficulté.
• Développer des projets communautaires.
• Promouvoir l'autonomisation et le développement local.`}
              className="onboarding-textarea mt-6"
            />

          </section>

          {/* ================================================= */}
          {/* ETAPE 6 - MISSION / VISION */}
          {/* ================================================= */}

          <section className="border-b border-slate-200 p-6 sm:p-8">

            <SectionTitle
              eyebrow="Étape 6"
              title="Mission et vision"
              description="Cette partie est facultative et pourra être complétée plus tard."
            />

            <div className="mt-7 grid gap-5 lg:grid-cols-2">

              <div>

                <Label
                  htmlFor="mission"
                >
                  Mission
                </Label>

                <textarea
                  id="mission"
                  name="mission"
                  rows={5}
                  maxLength={2500}
                  placeholder="Pourquoi votre organisation existe-t-elle ?"
                  className="onboarding-textarea"
                />

              </div>

              <div>

                <Label
                  htmlFor="vision"
                >
                  Vision
                </Label>

                <textarea
                  id="vision"
                  name="vision"
                  rows={5}
                  maxLength={2500}
                  placeholder="Que souhaitez-vous devenir ou accomplir à long terme ?"
                  className="onboarding-textarea"
                />

              </div>

            </div>

          </section>

          {/* ================================================= */}
          {/* RECAPITULATIF */}
          {/* ================================================= */}

          <section className="p-6 sm:p-8">

            <SectionTitle
              eyebrow="Prêt à commencer"
              title="Afri Club prépare votre espace"
              description="La création de l'organisation et de votre accès initial se fera automatiquement."
            />

            <div className="mt-7 grid gap-4 lg:grid-cols-3">

              <InfoCard
                title="Votre organisation"
                description="Un tableau de bord de gestion sera créé immédiatement."
              />

              <InfoCard
                title="Votre rôle"
                description="Vous disposerez automatiquement des droits Responsable."
              />

              <InfoCard
                title="Votre espace membre"
                description="Si l'option est cochée, votre dossier membre sera activé dès la création."
              />

            </div>

            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

              <div className="flex gap-3">

                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                <div>

                  <p className="font-black text-emerald-900">
                    Votre organisation sera prête immédiatement
                  </p>

                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    Après la création, vous pourrez
                    ajouter d&apos;autres membres,
                    configurer les cotisations,
                    préparer la trésorerie,
                    compléter la vitrine publique
                    et définir les moyens de paiement.
                  </p>

                </div>

              </div>

            </div>

          </section>

          {/* ================================================= */}
          {/* ACTION */}
          {/* ================================================= */}

          <div className="border-t border-slate-200 bg-slate-950 p-6 sm:p-8">

            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-6 py-4 text-base font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Créer mon organisation
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">
              La création de l&apos;organisation,
              du compte Responsable et du
              premier membre est sécurisée
              dans une seule opération.
            </p>

          </div>

        </form>

      </div>

      {/* ==================================================== */}
      {/* STYLES */}
      {/* ==================================================== */}

      <style>
        {`
          .onboarding-input {
            width: 100%;
            border-radius: 0.9rem;
            border: 1px solid #cbd5e1;
            background: white;
            padding: 0.8rem 1rem;
            outline: none;
            transition:
              border-color 180ms ease,
              box-shadow 180ms ease;
          }

          .onboarding-input:focus {
            border-color: #059669;
            box-shadow:
              0 0 0 3px
              rgba(16,185,129,.10);
          }

          .onboarding-textarea {
            width: 100%;
            resize: vertical;
            border-radius: 0.9rem;
            border: 1px solid #cbd5e1;
            background: white;
            padding: 0.9rem 1rem;
            line-height: 1.7;
            outline: none;
            transition:
              border-color 180ms ease,
              box-shadow 180ms ease;
          }

          .onboarding-textarea:focus {
            border-color: #059669;
            box-shadow:
              0 0 0 3px
              rgba(16,185,129,.10);
          }
        `}
      </style>

    </main>
  )
}

// ============================================================
// TYPE D'ORGANISATION
// ============================================================

function OrganizationType({
  value,
  title,
  description,
  icon,
  tone,
  defaultChecked = false,
}: {
  value: string
  title: string
  description: string
  icon: ReactNode

  tone:
    | 'emerald'
    | 'blue'
    | 'cyan'
    | 'amber'
    | 'violet'
    | 'rose'
    | 'orange'
    | 'teal'
    | 'slate'

  defaultChecked?: boolean
}) {
  const colors = {

    emerald:
      'bg-emerald-100 text-emerald-700',

    blue:
      'bg-blue-100 text-blue-700',

    cyan:
      'bg-cyan-100 text-cyan-700',

    amber:
      'bg-amber-100 text-amber-700',

    violet:
      'bg-violet-100 text-violet-700',

    rose:
      'bg-rose-100 text-rose-700',

    orange:
      'bg-orange-100 text-orange-700',

    teal:
      'bg-teal-100 text-teal-700',

    slate:
      'bg-slate-100 text-slate-700',

  }

  return (
    <label className="group relative cursor-pointer">

      <input
        type="radio"
        name="organizationType"
        value={value}
        required
        defaultChecked={
          defaultChecked
        }
        className="peer sr-only"
      />

      <div className="h-full rounded-2xl border-2 border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md peer-checked:border-emerald-600 peer-checked:bg-emerald-50/50 peer-checked:shadow-md">

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[tone]}`}
        >
          {icon}
        </div>

        <p className="mt-4 font-black text-slate-950">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>

        <div className="absolute right-3 top-3 hidden h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white peer-checked:flex">
          ✓
        </div>

      </div>

    </label>
  )
}

// ============================================================
// TITRE DE SECTION
// ============================================================

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>

      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
        {eyebrow}
      </p>

      <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
        {title}
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        {description}
      </p>

    </div>
  )
}

// ============================================================
// LABEL
// ============================================================

function Label({
  htmlFor,
  required = false,
  children,
}: {
  htmlFor: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-bold text-slate-700"
    >

      {children}

      {required && (
        <span className="text-red-600">
          {' '}*
        </span>
      )}

    </label>
  )
}

// ============================================================
// CARTE INFO
// ============================================================

function InfoCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

      <p className="font-black text-slate-900">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>

    </div>
  )
}

// ============================================================
// CHECK ITEM
// ============================================================

function CheckItem({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2">

      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />

      <span className="text-emerald-950">
        {children}
      </span>

    </div>
  )
}