import Link from 'next/link'

import {
  loginMember,
} from '../actions'

type PageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function MemberLoginPage({
  searchParams,
}: PageProps) {
  const query =
    await searchParams

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-md">

        <Link
          href="/login"
          className="text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          ← Retour
        </Link>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
              👤
            </div>

            <h1 className="mt-5 text-2xl font-black text-slate-950">
              Espace membre
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Accédez à votre espace
              personnel.
            </p>
          </div>

          {query.error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {query.error}
            </div>
          )}

          <form
            action={loginMember}
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
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600"
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
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-700 px-5 py-3.5 font-black text-white hover:bg-emerald-800"
            >
              Me connecter
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-center text-xs leading-5 text-slate-500">
              Votre dossier membre doit
              d’abord avoir été créé par
              votre mutuelle. Lors de
              votre première inscription,
              utilisez le lien personnel
              transmis par votre
              mutuelle.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}