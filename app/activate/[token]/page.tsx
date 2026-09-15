import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { hashMemberAccessToken } from '@/lib/security/member-access-token'

import {
  activateCurrentAccount,
  registerAndActivate,
  signInAndActivate,
} from './actions'

type PageProps = {
  params: Promise<{
    token: string
  }>

  searchParams: Promise<{
    error?: string
    sent?: string
  }>
}

type Invitation = {
  valid: boolean
  first_name: string
  last_name: string
  member_number: string
  organization_name: string
  organization_short_name:
    | string
    | null
  expires_at: string
  already_used: boolean
}

export default async function ActivateMemberPage({
  params,
  searchParams,
}: PageProps) {
  const { token } =
    await params

  const query =
    await searchParams

  if (
    !token ||
    token.length < 20
  ) {
    notFound()
  }

  const supabase =
    await createClient()

  const tokenHash =
    hashMemberAccessToken(
      token
    )

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

  if (error || !data) {
    notFound()
  }

  const invitation =
    data as Invitation

  const {
    data: authData,
  } =
    await supabase.auth
      .getClaims()

  const userId =
    authData?.claims?.sub

  return (
    <main className="min-h-screen bg-slate-50">

      <section className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 text-white">

        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">

          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
            EWUKAI
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Bienvenue{' '}
            {invitation.first_name}
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-emerald-50">
            {
              invitation.organization_name
            }{' '}
            vous invite à activer
            votre espace personnel.
          </p>

        </div>

      </section>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

        <section className="rounded-3xl border bg-white p-7 shadow-sm">

          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            VOTRE ADHÉSION
          </p>

          <h2 className="mt-3 text-2xl font-black text-slate-900">
            {invitation.last_name}{' '}
            {invitation.first_name}
          </h2>

          <div className="mt-5 rounded-2xl bg-slate-50 p-5">

            <p className="text-xs uppercase text-slate-500">
              Matricule
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {
                invitation.member_number
              }
            </p>

          </div>

          {!invitation.valid ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">

              <p className="font-black text-red-800">
                Ce lien n&apos;est plus utilisable.
              </p>

              <p className="mt-2 text-sm leading-6 text-red-700">
                Il a peut-être expiré,
                été utilisé ou remplacé.
                Demandez au bureau de
                générer un nouveau lien.
              </p>

            </div>
          ) : (
            <>

              {query.error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
                  {errorMessage(
                    query.error
                  )}
                </div>
              )}

              {query.sent ===
                '1' && (
                <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">

                  <p className="font-black text-blue-900">
                    Vérifiez votre email
                  </p>

                  <p className="mt-2 text-sm leading-6 text-blue-800">
                    Un message de
                    confirmation vous a
                    été envoyé. Après
                    confirmation, revenez
                    sur ce lien pour
                    terminer l&apos;activation.
                  </p>

                </div>
              )}

              {userId ? (
                <form
                  action={
                    activateCurrentAccount
                  }
                  className="mt-7"
                >

                  <input
                    type="hidden"
                    name="token"
                    value={token}
                  />

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

                    <p className="font-black text-emerald-900">
                      Vous êtes connecté.
                    </p>

                    <p className="mt-2 text-sm text-emerald-800">
                      Vous pouvez maintenant
                      rattacher ce compte à
                      votre adhésion.
                    </p>

                  </div>

                  <button
                    type="submit"
                    className="mt-5 w-full rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white"
                  >
                    Activer mon espace EWUKAI
                  </button>

                </form>
              ) : (
                <div className="mt-7 space-y-7">

                  {/* CREATION */}

                  <form
                    action={
                      registerAndActivate
                    }
                    className="rounded-2xl border p-5"
                  >

                    <h3 className="text-lg font-black">
                      Je n&apos;ai pas encore de compte
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Créez votre accès personnel.
                    </p>

                    <input
                      type="hidden"
                      name="token"
                      value={token}
                    />

                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="Votre email"
                      className="mt-5 w-full rounded-xl border px-4 py-3"
                    />

                    <input
                      type="password"
                      name="password"
                      required
                      minLength={8}
                      placeholder="Mot de passe"
                      className="mt-3 w-full rounded-xl border px-4 py-3"
                    />

                    <button
                      type="submit"
                      className="mt-4 w-full rounded-xl bg-emerald-700 px-5 py-3 font-black text-white"
                    >
                      Créer mon compte
                    </button>

                  </form>

                  {/* CONNEXION */}

                  <form
                    action={
                      signInAndActivate
                    }
                    className="rounded-2xl border p-5"
                  >

                    <h3 className="text-lg font-black">
                      J&apos;ai déjà un compte EWUKAI
                    </h3>

                    <input
                      type="hidden"
                      name="token"
                      value={token}
                    />

                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="Votre email"
                      className="mt-5 w-full rounded-xl border px-4 py-3"
                    />

                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="Mot de passe"
                      className="mt-3 w-full rounded-xl border px-4 py-3"
                    />

                    <button
                      type="submit"
                      className="mt-4 w-full rounded-xl bg-slate-900 px-5 py-3 font-black text-white"
                    >
                      Me connecter et activer
                    </button>

                  </form>

                </div>
              )}

            </>
          )}

        </section>

      </div>

    </main>
  )
}

function errorMessage(
  error: string
) {
  switch (error) {
    case 'login':
      return 'Email ou mot de passe incorrect.'

    case 'register':
      return 'Impossible de créer ce compte. Cette adresse email est peut-être déjà utilisée.'

    case 'claim':
      return 'Impossible de rattacher cet accès au membre. Le lien est peut-être expiré ou déjà utilisé.'

    case 'invalid':
      return 'Les informations saisies sont incorrectes.'

    default:
      return 'Une erreur est survenue.'
  }
}