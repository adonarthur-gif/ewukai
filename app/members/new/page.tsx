import Link from 'next/link'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

import { createMember } from './actions'

// ============================================================
// AFRI CLUB
// CREATION D'UN NOUVEAU MEMBRE
// ============================================================

type NewMemberPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function NewMemberPage({
  searchParams,
}: NewMemberPageProps) {
  const params = await searchParams

  const {
    role,
    organizationId,
  } = await requireCurrentOrganization()

  // ==========================================================
  // NORMALISATION DU ROLE
  // ==========================================================

  const currentRole =
    String(role)
      .trim()
      .toLowerCase()

  const canCreate =
    [
      'owner',
      'president',
      'secretary',
    ].includes(currentRole)

  // Diagnostic visible dans le terminal
  console.log(
    'AFRI CLUB - /members/new',
    {
      organizationId,
      role,
      currentRole,
      canCreate,
    }
  )

  // ==========================================================
  // ACCES REFUSE
  //
  // On ne redirige volontairement plus vers /members.
  // Ainsi, si le rôle pose problème, nous le voyons.
  // ==========================================================

  if (!canCreate) {
    return (
      <main className="min-h-screen bg-slate-50">

        <div className="mx-auto max-w-3xl px-4 py-10">

          <Link
            href="/members"
            className="text-sm font-bold text-emerald-700"
          >
            ← Retour aux membres
          </Link>

          <section className="mt-6 rounded-2xl border border-red-200 bg-white p-7 shadow-sm">

            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">
              ACCÈS REFUSÉ
            </p>

            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Création d&apos;un membre impossible
            </h1>

            <p className="mt-4 leading-7 text-slate-600">
              Votre rôle actuel ne permet
              pas de créer directement
              un membre.
            </p>

            <div className="mt-5 rounded-xl bg-slate-100 p-4">

              <p className="text-xs font-bold uppercase text-slate-500">
                Droits d'accès détectés
              </p>

              <p className="mt-1 font-mono text-lg font-black text-red-700">
                {currentRole}
              </p>

            </div>

            <p className="mt-4 text-sm text-slate-500">
              Les rôles autorisés sont :
              Responsable, Président et
              Secrétaire.
            </p>

          </section>

        </div>

      </main>
    )
  }

  // ==========================================================
  // DATE DU JOUR
  // ==========================================================

  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  // ==========================================================
  // FORMULAIRE
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="mb-8">

          <Link
            href="/members"
            className="inline-flex text-sm font-bold text-emerald-700 hover:underline"
          >
            ← Retour aux membres
          </Link>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            ESPACE MUTUELLE
          </p>

          <h1 className="mt-1 text-3xl font-black text-slate-900">
            Nouveau membre
          </h1>

          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Enregistrez directement un
            nouvel adhérent de la mutuelle.
            Comme cette création est faite
            par le bureau, le membre sera
            immédiatement considéré comme
            validé.
          </p>

        </div>

        {/* ================================================== */}
        {/* ERREUR */}
        {/* ================================================== */}

        {params.error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {params.error}
          </div>
        )}

        {/* ================================================== */}
        {/* FORMULAIRE */}
        {/* ================================================== */}

        <form
          action={createMember}
          className="overflow-hidden rounded-3xl border bg-white shadow-sm"
        >

          {/* ================================================ */}
          {/* IDENTITE */}
          {/* ================================================ */}

          <section className="border-b p-6 sm:p-8">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                IDENTITÉ
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900">
                Informations du membre
              </h2>

            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              <Field
                label="Nom"
                name="lastName"
                placeholder="Ex. KOUASSI"
                required
              />

              <Field
                label="Prénoms"
                name="firstName"
                placeholder="Ex. Marc"
                required
              />

              <Field
                label="Téléphone"
                name="phone"
                type="tel"
                placeholder="Ex. 0700000001"
              />

              <Field
                label="E-mail"
                name="email"
                type="email"
                placeholder="exemple@email.com"
              />

              <div>

                <label
                  htmlFor="gender"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Sexe
                </label>

                <select
                  id="gender"
                  name="gender"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">
                    Non renseigné
                  </option>

                  <option value="M">
                    Masculin
                  </option>

                  <option value="F">
                    Féminin
                  </option>

                </select>

              </div>

              <Field
                label="Date de naissance"
                name="birthDate"
                type="date"
              />

            </div>

          </section>

          {/* ================================================ */}
          {/* COORDONNEES */}
          {/* ================================================ */}

          <section className="border-b p-6 sm:p-8">

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              COORDONNÉES
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900">
              Situation et contact
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              <Field
                label="Profession"
                name="profession"
                placeholder="Ex. Comptable"
              />

              <Field
                label="Adresse / Résidence"
                name="address"
                placeholder="Ex. Dabou"
              />

            </div>

          </section>

          {/* ================================================ */}
          {/* URGENCE */}
          {/* ================================================ */}

          <section className="border-b p-6 sm:p-8">

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              CONTACT D&apos;URGENCE
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900">
              Personne à contacter
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              <Field
                label="Nom de la personne"
                name="emergencyContactName"
                placeholder="Nom et prénoms"
              />

              <Field
                label="Téléphone du contact"
                name="emergencyContactPhone"
                type="tel"
                placeholder="Ex. 0700000000"
              />

            </div>

          </section>

          {/* ================================================ */}
          {/* ADHESION */}
          {/* ================================================ */}

          <section className="p-6 sm:p-8">

            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              ADHÉSION
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900">
              Informations administratives
            </h2>

            <div className="mt-6">

              <Field
                label="Date d’adhésion"
                name="joinedAt"
                type="date"
                defaultValue={today}
                required
              />

            </div>

            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

              <p className="font-black text-emerald-900">
                Matricule automatique
              </p>

              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Un matricule sera attribué automatiquement
                automatiquement le prochain
                matricule disponible de
                cette mutuelle.
              </p>

            </div>

          </section>

          {/* ================================================ */}
          {/* ACTIONS */}
          {/* ================================================ */}

          <div className="flex flex-col-reverse gap-3 border-t bg-slate-50 p-6 sm:flex-row sm:justify-end">

            <Link
              href="/members"
              className="rounded-xl border bg-white px-6 py-3 text-center font-bold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </Link>

            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-6 py-3 font-black text-white transition hover:bg-emerald-800"
            >
              Enregistrer le membre
            </button>

          </div>

        </form>

      </div>

    </main>
  )
}

// ============================================================
// CHAMP
// ============================================================

function Field({
  label,
  name,
  type = 'text',
  required = false,
  defaultValue,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-slate-700"
      >
        {label}

        {required && (
          <span className="text-red-600">
            {' '}*
          </span>
        )}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />

    </div>
  )
}