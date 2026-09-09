import Link from 'next/link'

import {
  loginManager,
} from '../actions'

type PageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function ManagerLoginPage({
  searchParams,
}: PageProps) {
  const query =
    await searchParams

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-md">

        <Link
          href="/login"
          className="text-sm font-bold text-slate-400 hover:text-white"
        >
          ← Retour
        </Link>

        <div className="mt-6 rounded-3xl bg-white p-7 shadow-xl">

          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl">
              🏛️
            </div>

            <h1 className="mt-5 text-2xl font-black text-slate-950">
              Espace dirigeants
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Administration et gestion
              de la mutuelle.
            </p>
          </div>

          {query.error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {query.error}
            </div>
          )}

          <form
            action={loginManager}
            className="mt-7 space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="text-sm font-bold text-slate-700"
              >
                Adresse e-mail
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-bold text-slate-700"
              >
                Mot de passe
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white hover:bg-slate-800"
            >
              Accéder à la gestion
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            Cet accès est réservé aux
            personnes disposant de
            droits de gestion sur une
            mutuelle.
          </p>
        </div>
      </div>
    </main>
  )
}