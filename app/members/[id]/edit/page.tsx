import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

import { updateMember } from './actions'

type EditMemberPageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    error?: string
  }>
}

export default async function EditMemberPage({
  params,
  searchParams,
}: EditMemberPageProps) {
  const { id } =
    await params

  const query =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
      'secretary',
    ].includes(role)
  ) {
    redirect(
      `/members/${id}`
    )
  }

  const {
    data: member,
    error,
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
      'id',
      id
    )
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (
    error ||
    !member
  ) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        <Link
          href={`/members/${member.id}`}
          className="text-sm font-bold text-emerald-700"
        >
          ← Retour à la fiche
        </Link>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">

          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
            {
              member.member_number
            }
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Modifier le membre
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Corrigez le nom, le
            prénom ou le numéro de
            téléphone.
          </p>

          {query.error && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
              {query.error}
            </div>
          )}

          <form
            action={updateMember}
            className="mt-6 space-y-5"
          >

            <input
              type="hidden"
              name="memberId"
              value={
                member.id
              }
            />

            <div>
              <label
                htmlFor="lastName"
                className="mb-2 block text-sm font-semibold"
              >
                Nom
              </label>

              <input
                id="lastName"
                name="lastName"
                defaultValue={
                  member.last_name
                }
                required
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="firstName"
                className="mb-2 block text-sm font-semibold"
              >
                Prénom
              </label>

              <input
                id="firstName"
                name="firstName"
                defaultValue={
                  member.first_name
                }
                required
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-semibold"
              >
                Téléphone
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={
                  member.phone ?? ''
                }
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-xs uppercase tracking-wide text-slate-500">
                Matricule
              </p>

              <p className="mt-1 font-mono font-bold">
                {
                  member.member_number
                }
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Le matricule n&apos;est
                pas modifiable afin de
                préserver la traçabilité
                des opérations.
              </p>

            </div>

            <div className="flex gap-3">

              <Link
                href={`/members/${member.id}`}
                className="flex-1 rounded-xl border px-5 py-3 text-center font-semibold"
              >
                Annuler
              </Link>

              <button
                type="submit"
                className="flex-1 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800"
              >
                Enregistrer
              </button>

            </div>

          </form>

        </section>

      </div>

    </main>
  )
}