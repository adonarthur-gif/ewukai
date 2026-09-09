import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{
    slug: string
  }>
}

type PublicMutual = {
  name: string
  short_name: string | null
  slug: string
}

export default async function MembershipSuccessPage({
  params,
}: PageProps) {
  const { slug } =
    await params

  const supabase =
    await createClient()

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_public_mutual_space',
      {
        target_slug: slug,
      }
    )

  if (error || !data) {
    notFound()
  }

  const mutual =
    data as PublicMutual

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">

      <div className="w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm sm:p-10">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-black text-emerald-700">
          ✓
        </div>

        <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
          Demande envoyée
        </p>

        <h1 className="mt-3 text-3xl font-black text-slate-900">
          Merci pour votre intérêt
        </h1>

        <p className="mt-5 leading-7 text-slate-600">
          Votre demande d&apos;adhésion à{' '}
          <strong>
            {mutual.short_name ||
              mutual.name}
          </strong>{' '}
          a bien été enregistrée.
        </p>

        <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left">

          <p className="font-black text-slate-900">
            Prochaine étape
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Le bureau examinera votre
            demande. Après validation,
            votre dossier pourra être
            transformé en véritable
            adhésion avec attribution
            d&apos;un matricule et accès
            à votre espace membre.
          </p>

        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">

          <Link
            href={`/m/${mutual.slug}`}
            className="rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white"
          >
            Retour à la mutuelle
          </Link>

          <Link
            href="/login"
            className="rounded-2xl border px-5 py-3 font-bold text-slate-700"
          >
            Se connecter
          </Link>

        </div>

      </div>

    </main>
  )
}