'use client'

import {
  useActionState,
  useState,
} from 'react'

import {
  generateMemberAccessLink,
  type MemberAccessState,
} from './member-access-actions'

const initialState: MemberAccessState = {
  status: 'idle',
}

type Props = {
  memberId: string
  memberNumber: string
  memberName: string
  alreadyActivated: boolean
  canManage: boolean
}

export default function MemberAccessCard({
  memberId,
  memberNumber,
  memberName,
  alreadyActivated,
  canManage,
}: Props) {
  const [
    state,
    formAction,
    pending,
  ] =
    useActionState(
      generateMemberAccessLink,
      initialState
    )

  const [
    copied,
    setCopied,
  ] =
    useState(false)

  async function copyLink() {
    if (
      !state.activationLink
    ) {
      return
    }

    await navigator.clipboard.writeText(
      state.activationLink
    )

    setCopied(true)

    window.setTimeout(
      () =>
        setCopied(false),
      2000
    )
  }

  async function shareLink() {
    if (
      !state.activationLink
    ) {
      return
    }

    const text =
      `Bonjour ${memberName}, ` +
      `voici votre lien personnel pour créer votre espace membre ` +
      `(${memberNumber}).`

    if (
      navigator.share
    ) {
      await navigator.share({
        title:
          'Inscription membre',
        text,
        url:
          state.activationLink,
      })

      return
    }

    await navigator.clipboard.writeText(
      `${text}\n${state.activationLink}`
    )

    setCopied(true)
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div>

          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            ESPACE MEMBRE
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900">
            Espace membre
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Le membre utilise cet accès
            pour consulter uniquement sa
            situation personnelle, ses
            cotisations, ses paiements
            et ses reçus.
          </p>

        </div>

        {alreadyActivated ? (
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-800">
            Accès activé
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-800">
            Non activé
          </span>
        )}

      </div>

      {alreadyActivated ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">

          <p className="font-bold text-emerald-900">
            Le compte du membre est déjà lié.
          </p>

          <p className="mt-1 text-sm text-emerald-800">
            Il peut se connecter à
            son espace membre.
          </p>

        </div>
      ) : canManage ? (
        <>
          <form
            action={formAction}
            className="mt-5"
          >

            <input
              type="hidden"
              name="memberId"
              value={memberId}
            />

            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? 'Génération...'
                : 'Générer son Espace membre'}
            </button>

          </form>

          {state.status ===
            'error' && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {state.message}
            </div>
          )}

          {state.status ===
            'success' &&
            state.activationLink && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

                <p className="font-black text-emerald-900">
                  Lien personnel créé
                </p>

                <p className="mt-1 text-sm text-emerald-800">
                  Ce lien est valable
                  pendant 7 jours et ne
                  doit être transmis
                  qu&apos;au membre
                  concerné.
                </p>

                <div className="mt-4 break-all rounded-xl border bg-white p-4 font-mono text-sm text-slate-700">
                  {
                    state.activationLink
                  }
                </div>

                <div className="mt-4 flex flex-wrap gap-3">

                  <button
                    type="button"
                    onClick={
                      copyLink
                    }
                    className="rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white"
                  >
                    {copied
                      ? 'Copié ✓'
                      : 'Copier le lien'}
                  </button>

                  <button
                    type="button"
                    onClick={
                      shareLink
                    }
                    className="rounded-xl border bg-white px-4 py-2.5 font-bold text-slate-700"
                  >
                    Partager
                  </button>

                </div>

              </div>
            )}
        </>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          Vous pouvez consulter le
          statut de l&apos;accès, mais
          vous n&apos;êtes pas autorisé
          à générer une invitation.
        </p>
      )}

    </section>
  )
}