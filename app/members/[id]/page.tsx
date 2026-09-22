import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'
import MemberAccessCard from './member-access-card'
import {
  deleteMember,
  setMemberStatus,
} from './actions'

// ============================================================
// EWUKAI
// FICHE D'UN MEMBRE
// ============================================================

type MemberPageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    statusUpdated?: string
    error?: string
  }>
}

type Member = {
  id: string
  organization_id: string
  user_id: string | null

  member_number: string

  first_name: string
  last_name: string

  phone: string | null
  email: string | null

  gender: string | null
  birth_date: string | null

  profession: string | null
  address: string | null

  emergency_contact_name: string | null
  emergency_contact_phone: string | null

  photo_url: string | null

  joined_at: string

  status:
    | 'active'
    | 'inactive'
    | 'suspended'
    | string

  created_at: string
  updated_at: string
}

// ============================================================
// PAGE
// ============================================================

export default async function MemberDetailPage({
  params,
  searchParams,
}: MemberPageProps) {
  const { id } = await params
  const query = await searchParams

  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  // ==========================================================
  // CHARGEMENT DU MEMBRE
  // ==========================================================

  const {
    data,
    error,
  } = await supabase
    .from('members')
    .select(`
      id,
      organization_id,
      user_id,
      member_number,
      first_name,
      last_name,
      phone,
      email,
      gender,
      birth_date,
      profession,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      photo_url,
      joined_at,
      status,
      created_at,
      updated_at
    `)
    .eq('id', id)
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (
    error ||
    !data
  ) {
    if (error) {
      console.error(
        'EWUKAI - member detail:',
        error
      )
    }

    notFound()
  }

  const member =
    data as Member

  // ==========================================================
  // AUTORISATIONS
  // ==========================================================

  const canEditMember =
    [
      'owner',
      'president',
      'secretary',
    ].includes(role)

  const canManageMemberAccess =
    [
      'owner',
      'president',
      'secretary',
    ].includes(role)

  const canManageMemberStatus =
    [
      'owner',
      'president',
      'secretary',
    ].includes(role)

  const isActive =
    member.status ===
    'active'

  const isInactive =
    member.status ===
    'inactive'

  // ==========================================================
  // NOM COMPLET
  // ==========================================================

  const fullName =
    `${member.first_name} ${member.last_name}`

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* RETOUR */}
        {/* ================================================== */}

        <Link
          href="/members"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-900"
        >
          ← Retour aux membres
        </Link>

        {query.statusUpdated && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
            {query.statusUpdated ===
            'active'
              ? 'Le membre a été réactivé.'
              : 'Le membre a été désactivé. Son historique est conservé.'}
          </div>
        )}

        {query.error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {query.error}
          </div>
        )}

        {/* ================================================== */}
        {/* HEADER MEMBRE */}
        {/* ================================================== */}

        <section className="mt-5 overflow-hidden rounded-3xl border bg-white shadow-sm">

          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 py-8 text-white sm:px-8">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-5">

                {/* PHOTO / INITIALES */}

                {member.photo_url ? (
                  <img
                    src={member.photo_url}
                    alt={fullName}
                    className="h-20 w-20 rounded-2xl border border-white/20 object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white ring-1 ring-white/20">
                    {initials(
                      member.first_name,
                      member.last_name
                    )}
                  </div>
                )}

                <div>

                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                    MEMBRE
                  </p>

                  <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                    {member.last_name}{' '}
                    {member.first_name}
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-3">

                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
                      {
                        member.member_number
                      }
                    </span>

                    <StatusBadge
                      status={
                        member.status
                      }
                    />

                  </div>

                </div>

              </div>

              {/* ACTIONS */}

              <div className="flex flex-wrap gap-3">

                <Link
                  href={`/contributions/collection?search=${encodeURIComponent(
                    member.member_number
                  )}`}
                  className="rounded-xl bg-emerald-500 px-5 py-3 font-black text-emerald-950 transition hover:bg-emerald-400"
                >
                  Voir les cotisations
                </Link>

                {canEditMember && (
                  <Link
                    href={`/members/${member.id}/edit`}
                    className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/20"
                  >
                    Modifier
                  </Link>
                )}

                {canManageMemberStatus && (
                  <form
                    action={
                      setMemberStatus
                    }
                  >
                    <input
                      type="hidden"
                      name="memberId"
                      value={
                        member.id
                      }
                    />

                    <input
                      type="hidden"
                      name="nextStatus"
                      value={
                        isActive
                          ? 'inactive'
                          : 'active'
                      }
                    />

                    <button
                      type="submit"
                      className={`rounded-xl px-5 py-3 font-black transition ${
                        isActive
                          ? 'border border-red-300/40 bg-red-500/15 text-red-100 hover:bg-red-500/25'
                          : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                      }`}
                    >
                      {isActive
                        ? 'Désactiver'
                        : 'Réactiver'}
                    </button>
                  </form>
                )}

              </div>

            </div>

          </div>

          {/* ================================================= */}
          {/* RESUME */}
          {/* ================================================= */}

          <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">

            <SummaryItem
              label="Matricule"
              value={
                member.member_number
              }
            />

            <SummaryItem
              label="Statut"
              value={
                statusLabel(
                  member.status
                )
              }
            />

            <SummaryItem
              label="Membre depuis"
              value={
                formatDate(
                  member.joined_at
                )
              }
            />

            <SummaryItem
              label="Espace membre"
              value={
                member.user_id
                  ? 'Activé'
                  : 'Non activé'
              }
              highlight={
                Boolean(
                  member.user_id
                )
              }
            />

          </div>

        </section>

        {/* ================================================== */}
        {/* CONTENU PRINCIPAL */}
        {/* ================================================== */}

        <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_0.8fr]">

          {/* ================================================= */}
          {/* INFORMATIONS DU MEMBRE */}
          {/* ================================================= */}

          <div className="space-y-7">

            <section className="rounded-2xl border bg-white p-6 shadow-sm">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                    INFORMATIONS
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Informations personnelles
                  </h2>

                </div>

                {canEditMember && (
                  <Link
                    href={`/members/${member.id}/edit`}
                    className="text-sm font-black text-emerald-700 hover:underline"
                  >
                    Modifier
                  </Link>
                )}

              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">

                <Info
                  label="Nom"
                  value={
                    member.last_name
                  }
                />

                <Info
                  label="Prénoms"
                  value={
                    member.first_name
                  }
                />

                <Info
                  label="Téléphone"
                  value={
                    member.phone ||
                    'Non renseigné'
                  }
                />

                <Info
                  label="Email"
                  value={
                    member.email ||
                    'Non renseigné'
                  }
                />

                <Info
                  label="Sexe"
                  value={
                    genderLabel(
                      member.gender
                    )
                  }
                />

                <Info
                  label="Date de naissance"
                  value={
                    member.birth_date
                      ? formatDate(
                          member.birth_date
                        )
                      : 'Non renseignée'
                  }
                />

                <Info
                  label="Profession"
                  value={
                    member.profession ||
                    'Non renseignée'
                  }
                />

                <Info
                  label="Adresse / Résidence"
                  value={
                    member.address ||
                    'Non renseignée'
                  }
                />

              </div>

            </section>

            {/* =============================================== */}
            {/* CONTACT D'URGENCE */}
            {/* =============================================== */}

            <section className="rounded-2xl border bg-white p-6 shadow-sm">

              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                CONTACT
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900">
                Contact d&apos;urgence
              </h2>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">

                <Info
                  label="Personne à contacter"
                  value={
                    member.emergency_contact_name ||
                    'Non renseignée'
                  }
                />

                <Info
                  label="Téléphone"
                  value={
                    member.emergency_contact_phone ||
                    'Non renseigné'
                  }
                />

              </div>

            </section>

            {/* =============================================== */}
            {/* INFORMATIONS ADMINISTRATIVES */}
            {/* =============================================== */}

            <section className="rounded-2xl border bg-white p-6 shadow-sm">

              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                ADMINISTRATION
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900">
                Informations d&apos;adhésion
              </h2>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">

                <Info
                  label="Matricule"
                  value={
                    member.member_number
                  }
                />

                <Info
                  label="Date d'adhésion"
                  value={
                    formatDate(
                      member.joined_at
                    )
                  }
                />

                <Info
                  label="Statut"
                  value={
                    statusLabel(
                      member.status
                    )
                  }
                />

                <Info
                  label="Compte membre"
                  value={
                    member.user_id
                      ? 'Compte activé'
                      : 'Pas encore activé'
                  }
                />

              </div>

            </section>

          </div>

          {/* ================================================= */}
          {/* COLONNE DROITE */}
          {/* ================================================= */}

          <div className="space-y-7">

            {/* =============================================== */}
            {/* ACCES EWUKAI */}
            {/* =============================================== */}

            <MemberAccessCard
              memberId={
                member.id
              }
              memberNumber={
                member.member_number
              }
              memberName={
                fullName
              }
              alreadyActivated={
                Boolean(
                  member.user_id
                )
              }
              canManage={
                canManageMemberAccess
              }
            />

            {/* =============================================== */}
            {/* GESTION DU MEMBRE */}
            {/* =============================================== */}

            {canManageMemberStatus && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  GESTION DU MEMBRE
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Activation et suppression
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  La désactivation conserve le matricule, les cotisations, les paiements et l&apos;historique du membre.
                </p>

                <form
                  action={
                    setMemberStatus
                  }
                  className="mt-5"
                >
                  <input
                    type="hidden"
                    name="memberId"
                    value={
                      member.id
                    }
                  />

                  <input
                    type="hidden"
                    name="nextStatus"
                    value={
                      isActive
                        ? 'inactive'
                        : 'active'
                    }
                  />

                  <button
                    type="submit"
                    className={`w-full rounded-xl px-5 py-3 text-sm font-black transition ${
                      isActive
                        ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                    }`}
                  >
                    {isActive
                      ? 'Désactiver ce membre'
                      : 'Réactiver ce membre'}
                  </button>
                </form>

                {isInactive && (
                  <div className="mt-6 border-t border-slate-100 pt-6">

                    <p className="font-black text-red-800">
                      Suppression définitive
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      EWUKAI refusera automatiquement la suppression si ce membre possède un compte lié, des cotisations, des paiements ou tout autre historique.
                    </p>

                    <form
                      action={
                        deleteMember
                      }
                      className="mt-4 space-y-3"
                    >
                      <input
                        type="hidden"
                        name="memberId"
                        value={
                          member.id
                        }
                      />

                      <label className="block">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Confirmer avec SUPPRIMER
                        </span>

                        <input
                          name="confirmation"
                          type="text"
                          autoComplete="off"
                          placeholder="SUPPRIMER"
                          className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10"
                        />
                      </label>

                      <button
                        type="submit"
                        className="w-full rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
                      >
                        Supprimer définitivement
                      </button>
                    </form>

                  </div>
                )}

              </section>
            )}

            {/* =============================================== */}
            {/* COTISATIONS */}
            {/* =============================================== */}

            <section className="rounded-2xl border bg-white p-6 shadow-sm">

              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                COTISATIONS
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900">
                Situation financière
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Consultez les cotisations
                dues, les paiements déjà
                comptabilisés, les avances
                et les éventuels arriérés
                de ce membre.
              </p>

              <Link
                href={`/contributions/collection?search=${encodeURIComponent(
                  member.member_number
                )}`}
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 font-black text-white transition hover:bg-emerald-800"
              >
                Voir son état de cotisations
              </Link>

            </section>

            {/* =============================================== */}
            {/* RAPPEL SUR L'ESPACE MEMBRE */}
            {/* =============================================== */}

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">

              <p className="font-black text-blue-900">
                Espace personnel du membre
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                Une fois son accès activé,
                le membre ne voit pas les
                informations internes du
                bureau. Son espace est
                limité à sa propre
                situation : cotisations,
                paiements, reçus et,
                prochainement, paiement
                à distance.
              </p>

            </section>

          </div>

        </div>

      </div>

    </main>
  )
}

// ============================================================
// COMPOSANTS
// ============================================================

function SummaryItem({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="bg-white p-5">

      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 font-black ${
          highlight
            ? 'text-emerald-700'
            : 'text-slate-900'
        }`}
      >
        {value}
      </p>

    </div>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>

      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-semibold text-slate-900">
        {value}
      </p>

    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: string
}) {
  const isActive =
    status === 'active'

  const isSuspended =
    status === 'suspended'

  const className =
    isActive
      ? 'bg-emerald-400/20 text-emerald-200'
      : isSuspended
        ? 'bg-amber-400/20 text-amber-200'
        : 'bg-slate-400/20 text-slate-200'

  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-black ${className}`}
    >
      {statusLabel(
        status
      )}
    </span>
  )
}

// ============================================================
// FORMATAGE
// ============================================================

function statusLabel(
  status: string
) {
  switch (status) {
    case 'active':
      return 'Actif'

    case 'inactive':
      return 'Inactif'

    case 'suspended':
      return 'Suspendu'

    default:
      return status
  }
}

function genderLabel(
  gender: string | null
) {
  if (!gender) {
    return 'Non renseigné'
  }

  switch (
    gender.toLowerCase()
  ) {
    case 'male':
    case 'm':
    case 'homme':
      return 'Homme'

    case 'female':
    case 'f':
    case 'femme':
      return 'Femme'

    default:
      return gender
  }
}

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}

function initials(
  firstName: string,
  lastName: string
) {
  return (
    `${firstName.charAt(0)}${lastName.charAt(0)}`
      .toUpperCase()
  )
}