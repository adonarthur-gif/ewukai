import { randomUUID } from 'crypto'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

import { createContributionCall } from './actions'
import SubmitButton from './submit-button'

// ============================================================
// AFRI CLUB
// NOUVEL APPEL DE COTISATION
// ============================================================

type NewCallPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

// ============================================================
// PAGE
// ============================================================

export default async function NewContributionCallPage({
  searchParams,
}: NewCallPageProps) {
  const query =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ==========================================================
  // AUTORISATIONS
  // ==========================================================

  if (
    ![
      'owner',
      'president',
      'treasurer',
      'secretary',
    ].includes(role)
  ) {
    redirect(
      '/contributions/calls'
    )
  }

  // ==========================================================
  // CHARGER LES MEMBRES ACTIFS
  // ==========================================================

  const {
    data: members,
    error: membersError,
  } = await supabase
    .from('members')
    .select(`
      id,
      member_number,
      first_name,
      last_name,
      phone
    `)
    .eq(
      'organization_id',
      organizationId
    )
    .eq(
      'status',
      'active'
    )
    .order(
      'last_name',
      {
        ascending: true,
      }
    )
    .order(
      'first_name',
      {
        ascending: true,
      }
    )

  if (membersError) {
    console.error(
      'AFRI CLUB - contribution call members:',
      membersError
    )

    throw new Error(
      'Impossible de charger les membres actifs.'
    )
  }

  const activeMembers =
    members ?? []

  // ==========================================================
  // DATE DU JOUR
  // Côte d'Ivoire = UTC
  // ==========================================================

  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  // ==========================================================
  // CLE D'IDEMPOTENCE
  //
  // Une seule clé est générée pour ce formulaire.
  // Deux clics sur le même formulaire enverront la même clé.
  // ==========================================================

  const requestKey =
    randomUUID()

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* RETOUR */}
        {/* ================================================== */}

        <Link
          href="/contributions/calls"
          className="inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          ← Retour aux appels
        </Link>

        {/* ================================================== */}
        {/* CARTE PRINCIPALE */}
        {/* ================================================== */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* ================================================= */}
          {/* ENTETE */}
          {/* ================================================= */}

          <header className="bg-slate-900 px-6 py-7 text-white">

            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              ESPACE MUTUELLE
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Nouvel appel de cotisation
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Créez une cotisation exceptionnelle liée à un besoin précis.
              L&apos;appel sera d&apos;abord enregistré en brouillon avant
              son activation.
            </p>

          </header>

          {/* ================================================= */}
          {/* ERREUR */}
          {/* ================================================= */}

          {query.error && (
            <div className="mx-6 mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {query.error}
            </div>
          )}

          {/* ================================================= */}
          {/* FORMULAIRE */}
          {/* ================================================= */}

          <form
            action={
              createContributionCall
            }
            className="space-y-8 p-6"
          >

            {/* =============================================== */}
            {/* CLE ANTI-DOUBLE-CREATION */}
            {/* =============================================== */}

            <input
              type="hidden"
              name="requestKey"
              value={
                requestKey
              }
            />

            {/* =============================================== */}
            {/* INFORMATIONS GENERALES */}
            {/* =============================================== */}

            <section>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Informations de l&apos;appel
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Donnez un intitulé suffisamment précis pour distinguer
                  cet appel des autres collectes.
                </p>
              </div>

              <div className="mt-5 space-y-5">

                {/* OBJET */}

                <div>
                  <label
                    htmlFor="title"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Objet de l&apos;appel *
                  </label>

                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    maxLength={200}
                    placeholder="Ex. Soutien au frère KOUASSI Jean accidenté"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {/* DESCRIPTION */}

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Motif / description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    maxLength={2000}
                    placeholder="Ex. Participation aux frais médicaux à la suite d'un accident..."
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {/* MONTANT */}

                <div>
                  <label
                    htmlFor="amount"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Montant demandé par membre *
                  </label>

                  <div className="flex">

                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      required
                      placeholder="10000"
                      className="min-w-0 flex-1 rounded-l-xl border border-slate-300 px-4 py-3 text-lg font-bold outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />

                    <span className="flex items-center rounded-r-xl border border-l-0 border-slate-300 bg-slate-50 px-5 font-bold text-slate-700">
                      FCFA
                    </span>

                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Ce montant sera dû par chaque membre concerné par
                    l&apos;appel.
                  </p>
                </div>

              </div>

            </section>

            {/* =============================================== */}
            {/* BENEFICIAIRE */}
            {/* =============================================== */}

            <section className="border-t border-slate-200 pt-7">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Bénéficiaire
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Facultatif. Le bénéficiaire peut être un membre de la
                  mutuelle ou une personne extérieure.
                </p>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">

                {/* MEMBRE BENEFICIAIRE */}

                <div>
                  <label
                    htmlFor="beneficiaryMemberId"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Membre bénéficiaire
                  </label>

                  <select
                    id="beneficiaryMemberId"
                    name="beneficiaryMemberId"
                    defaultValue="none"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >

                    <option value="none">
                      Aucun membre sélectionné
                    </option>

                    {activeMembers.map(
                      (member) => (
                        <option
                          key={
                            member.id
                          }
                          value={
                            member.id
                          }
                        >
                          {
                            member.member_number
                          }
                          {' — '}
                          {
                            member.last_name
                          }{' '}
                          {
                            member.first_name
                          }
                        </option>
                      )
                    )}

                  </select>
                </div>

                {/* BENEFICIAIRE EXTERIEUR */}

                <div>
                  <label
                    htmlFor="beneficiaryName"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Bénéficiaire extérieur
                  </label>

                  <input
                    id="beneficiaryName"
                    name="beneficiaryName"
                    type="text"
                    maxLength={200}
                    placeholder="Ex. Famille de M. YAO"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

              </div>

              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Si vous choisissez un membre bénéficiaire, évitez de
                renseigner également un bénéficiaire extérieur sauf cas
                particulier.
              </div>

            </section>

            {/* =============================================== */}
            {/* PERIODE */}
            {/* =============================================== */}

            <section className="border-t border-slate-200 pt-7">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Période de l&apos;appel
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Définissez la date de lancement et la date limite de
                  règlement.
                </p>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">

                {/* DATE LANCEMENT */}

                <div>
                  <label
                    htmlFor="launchDate"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Date de lancement *
                  </label>

                  <input
                    id="launchDate"
                    name="launchDate"
                    type="date"
                    required
                    defaultValue={
                      today
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {/* DATE LIMITE */}

                <div>
                  <label
                    htmlFor="dueDate"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Date limite *
                  </label>

                  <input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    required
                    min={
                      today
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

              </div>

            </section>

            {/* =============================================== */}
            {/* MEMBRES CONCERNES */}
            {/* =============================================== */}

            <section className="border-t border-slate-200 pt-7">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Membres concernés
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  L&apos;appel peut concerner tous les membres actifs ou
                  seulement certains adhérents.
                </p>
              </div>

              {/* CHOIX PORTEE */}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">

                {/* TOUS */}

                <label className="cursor-pointer rounded-xl border border-slate-300 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30">

                  <div className="flex items-start gap-3">

                    <input
                      type="radio"
                      name="scope"
                      value="all_active"
                      defaultChecked
                      className="mt-1 h-4 w-4"
                    />

                    <div>

                      <p className="font-bold text-slate-900">
                        Tous les membres actifs
                      </p>

                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        Tous les adhérents actifs et déjà membres à la date
                        limite seront concernés lors de l&apos;activation.
                      </p>

                    </div>

                  </div>

                </label>

                {/* SELECTION */}

                <label className="cursor-pointer rounded-xl border border-slate-300 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30">

                  <div className="flex items-start gap-3">

                    <input
                      type="radio"
                      name="scope"
                      value="selected"
                      className="mt-1 h-4 w-4"
                    />

                    <div>

                      <p className="font-bold text-slate-900">
                        Membres sélectionnés
                      </p>

                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        Seuls les adhérents cochés dans la liste ci-dessous
                        seront concernés.
                      </p>

                    </div>

                  </div>

                </label>

              </div>

              {/* ============================================= */}
              {/* LISTE MEMBRES */}
              {/* ============================================= */}

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">

                <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">

                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                      <p className="font-bold text-slate-900">
                        Sélection manuelle
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Cochez les membres uniquement si vous choisissez
                        « Membres sélectionnés ».
                      </p>
                    </div>

                    <span className="mt-2 text-sm font-semibold text-slate-500 sm:mt-0">
                      {
                        activeMembers.length
                      }{' '}
                      membre
                      {activeMembers.length !==
                      1
                        ? 's'
                        : ''}{' '}
                      actif
                      {activeMembers.length !==
                      1
                        ? 's'
                        : ''}
                    </span>

                  </div>

                </div>

                {activeMembers.length ===
                0 ? (
                  <div className="p-8 text-center">

                    <p className="font-semibold text-slate-700">
                      Aucun membre actif
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Ajoutez ou réactivez des membres avant de créer cet
                      appel.
                    </p>

                  </div>
                ) : (
                  <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">

                    {activeMembers.map(
                      (member) => (
                        <label
                          key={
                            member.id
                          }
                          className="flex cursor-pointer items-center gap-4 px-4 py-3 transition hover:bg-slate-50"
                        >

                          <input
                            type="checkbox"
                            name="selectedMemberIds"
                            value={
                              member.id
                            }
                            className="h-4 w-4 shrink-0"
                          />

                          <div className="min-w-0 flex-1">

                            <p className="font-semibold text-slate-900">
                              {
                                member.last_name
                              }{' '}
                              {
                                member.first_name
                              }
                            </p>

                            <p className="mt-0.5 font-mono text-xs font-semibold text-emerald-700">
                              {
                                member.member_number
                              }
                            </p>

                          </div>

                          {member.phone && (
                            <p className="hidden shrink-0 text-sm text-slate-500 sm:block">
                              {
                                member.phone
                              }
                            </p>
                          )}

                        </label>
                      )
                    )}

                  </div>
                )}

              </div>

            </section>

            {/* =============================================== */}
            {/* RAPPEL */}
            {/* =============================================== */}

            <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">

              <p className="font-bold text-blue-900">
                L&apos;appel sera créé en brouillon
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                Aucune dette ne sera créée immédiatement. Vous pourrez
                vérifier les informations avant de cliquer sur
                « Activer » dans la liste des appels.
              </p>

            </section>

            {/* =============================================== */}
            {/* ACTIONS */}
            {/* =============================================== */}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-7 sm:flex-row sm:justify-end">

              <Link
                href="/contributions/calls"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </Link>

              <SubmitButton />

            </div>

          </form>

        </section>

      </div>

    </main>
  )
}