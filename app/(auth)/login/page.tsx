import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">

        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">
            AFRI CLUB
          </p>

          <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
            Connexion
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Choisissez l’espace auquel
            vous souhaitez accéder.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">

          {/* MEMBRE */}

          <Link
            href="/login/membre"
            className="group rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
              👤
            </div>

            <h2 className="mt-6 text-2xl font-black text-slate-950">
              Espace membre
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Consultez vos
              cotisations, vos
              paiements, vos reçus et
              votre situation
              personnelle.
            </p>

            <div className="mt-7 font-black text-emerald-700">
              Se connecter comme membre
              →
            </div>
          </Link>

          {/* DIRIGEANT */}

          <Link
            href="/login/dirigeant"
            className="group rounded-3xl border border-slate-200 bg-slate-950 p-8 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
              🏛️
            </div>

            <h2 className="mt-6 text-2xl font-black">
              Espace dirigeants
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Gérez les membres, les
              adhésions, les
              cotisations, la
              trésorerie et les
              paramètres de votre
              mutuelle.
            </p>

            <div className="mt-7 font-black text-emerald-300">
              Accéder à la gestion →
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}