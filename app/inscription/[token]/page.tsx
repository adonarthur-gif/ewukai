import {
  createHash,
} from 'node:crypto'

import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'

import {
  registerMember,
} from './actions'

// ============================================================
// TYPES
// ============================================================

type PageProps = {
  params: Promise<{
    token: string
  }>

  searchParams: Promise<{
    error?: string
    existing?: string
  }>
}

type InvitationData = {
  valid: boolean

  organization_id:
    | string
    | null

  first_name:
    | string
    | null

  last_name:
    | string
    | null

  member_number:
    | string
    | null

  member_email:
    | string
    | null

  email_locked:
    | boolean

  organization_name:
    | string
    | null

  organization_short_name:
    | string
    | null

  expires_at:
    | string
    | null

  already_used:
    | boolean

  revoked:
    | boolean
}

// ============================================================
// PAGE
// ============================================================

export default async function MemberRegistrationPage({
  params,
  searchParams,
}: PageProps) {
  const { token } =
    await params

  const query =
    await searchParams

  const supabase =
    await createClient()

  const tokenHash =
    createHash('sha256')
      .update(token)
      .digest('hex')
      .toLowerCase()

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_member_access_invitation',
      {
        target_token_hash:
          tokenHash,
      }
    )

  const invitation =
    data
      ? (data as InvitationData)
      : null

  // ==========================================================
  // LIEN INTROUVABLE
  // ==========================================================

  if (
    error ||
    !invitation
  ) {
    return (
      <RegistrationShell>
        <StatusCard
          title="Lien invalide"
          description="Ce lien d’inscription n’existe pas ou n’est plus disponible."
        />
      </RegistrationShell>
    )
  }

  // ==========================================================
  // LIEN NON VALIDE
  // ==========================================================

  if (!invitation.valid) {
    let title =
      'Lien non disponible'

    let description =
      'Ce lien d’inscription n’est plus valide.'

    if (
      invitation.already_used
    ) {
      title =
        'Inscription déjà réalisée'

      description =
        'Ce lien a déjà été utilisé. Vous pouvez maintenant vous connecter avec votre adresse e-mail et votre mot de passe.'
    } else if (
      invitation.revoked
    ) {
      title =
        'Lien annulé'

      description =
        'Ce lien d’inscription a été annulé. Contactez votre mutuelle pour obtenir un nouveau lien.'
    } else if (
      invitation.expires_at &&
      new Date(
        invitation.expires_at
      ).getTime() <=
        // eslint-disable-next-line react-hooks/purity -- verification d'expiration cote serveur
        Date.now()
    ) {
      title =
        'Lien expiré'

      description =
        'Ce lien d’inscription a expiré. Contactez votre mutuelle pour obtenir un nouveau lien.'
    }

    return (
      <RegistrationShell>
        <StatusCard
          title={title}
          description={
            description
          }
        />
      </RegistrationShell>
    )
  }

  const organizationLabel =
    invitation.organization_short_name ||
    invitation.organization_name ||
    'Votre mutuelle'

  const fullName =
    [
      invitation.first_name,
      invitation.last_name,
    ]
      .filter(Boolean)
      .join(' ')

  // ==========================================================
  // FORMULAIRE
  // ==========================================================

  return (
    <RegistrationShell>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">

        {/* IDENTITE MUTUELLE */}

        <div className="bg-gradient-to-br from-slate-950 to-emerald-800 px-6 py-8 text-white sm:px-8">

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-black ring-1 ring-white/20">
              {getInitials(
                organizationLabel
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-emerald-100">
                Inscription membre
              </p>

              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                {organizationLabel}
              </h1>
            </div>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-6 text-slate-200">
            Créez votre espace personnel pour suivre vos cotisations,
            paiements et reçus.
          </p>
        </div>

        <div className="p-6 sm:p-8">

          {/* MEMBRE */}

          <div className="mb-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              Dossier membre
            </p>

            <p className="mt-2 text-lg font-black text-slate-950">
              {fullName ||
                'Membre'}
            </p>

            {invitation.member_number && (
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Matricule :{' '}
                {
                  invitation.member_number
                }
              </p>
            )}

            {invitation.organization_name && (
              <p className="mt-2 text-sm text-slate-500">
                {
                  invitation.organization_name
                }
              </p>
            )}
          </div>

          {/* ERREUR */}

          {query.error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800">
                {query.error}
              </p>
            </div>
          )}

          {/* COMPTE DEJA EXISTANT */}

          {query.existing ===
            '1' && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-black text-amber-900">
                Un compte existe déjà avec cette adresse e-mail.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Nous allons ensuite permettre de rattacher directement ce lien à un compte existant sans créer un deuxième compte.
              </p>
            </div>
          )}

          <form
            action={
              registerMember
            }
            className="space-y-5"
          >
            <input
              type="hidden"
              name="token"
              value={token}
            />

            {/* EMAIL */}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-black text-slate-800"
              >
                Adresse e-mail
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={
                  invitation.member_email ??
                  ''
                }
                readOnly={
                  Boolean(
                    invitation.email_locked
                  )
                }
                className={`w-full rounded-2xl border px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 ${
                  invitation.email_locked
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600'
                    : 'border-slate-300 bg-white text-slate-950'
                }`}
                placeholder="exemple@email.com"
              />

              {invitation.email_locked && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Cette adresse est celle enregistrée dans votre dossier membre.
                </p>
              )}
            </div>

            {/* PASSWORD */}

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-black text-slate-800"
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
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                placeholder="Minimum 8 caractères"
              />
            </div>

            {/* CONFIRMATION */}

            <div>
              <label
                htmlFor="passwordConfirmation"
                className="mb-2 block text-sm font-black text-slate-800"
              >
                Confirmer le mot de passe
              </label>

              <input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                placeholder="Retapez votre mot de passe"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-700 px-5 py-4 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Créer mon espace membre
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-5 text-center">
            <p className="text-sm text-slate-500">
              Vous avez déjà terminé votre inscription ?
            </p>

            <Link
              href="/login"
              className="mt-2 inline-flex font-black text-emerald-700 hover:text-emerald-800"
            >
              Se connecter
            </Link>
          </div>

        </div>
      </div>
    </RegistrationShell>
  )
}

// ============================================================
// LAYOUT
// ============================================================

function RegistrationShell({
  children,
}: {
  children:
    React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
        <div className="w-full">
          {children}
        </div>
      </div>
    </main>
  )
}

// ============================================================
// MESSAGE D'ETAT
// ============================================================

function StatusCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/40">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
        🔐
      </div>

      <h1 className="mt-5 text-2xl font-black text-slate-950">
        {title}
      </h1>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {description}
      </p>

      <Link
        href="/login"
        className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        Aller à la connexion
      </Link>
    </div>
  )
}

// ============================================================
// INITIALS
// ============================================================

function getInitials(
  value: string
) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (word) =>
        word[0]
          ?.toUpperCase() ??
        ''
    )
    .join('')
}