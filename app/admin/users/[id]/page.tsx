import Link from 'next/link'
import {
  notFound,
} from 'next/navigation'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// EWUKAI
// ADMINISTRATION PLATEFORME
// FICHE UTILISATEUR
// ============================================================

type PageProps = {
  params: Promise<{
    id: string
  }>
}

type UserData = {
  id: string

  email:
    | string
    | null

  full_name:
    | string
    | null

  phone:
    | string
    | null

  created_at:
    | string
    | null

  last_sign_in_at:
    | string
    | null

  is_platform_admin:
    boolean

  platform_admin_role:
    | string
    | null

  platform_admin_created_at:
    | string
    | null
}

type OrganizationRole = {
  organization_id: string

  organization_name: string

  organization_short_name:
    | string
    | null

  organization_status:
    | string
    | null

  role:
    string

  is_active:
    boolean

  created_at:
    | string
    | null
}

type MemberSpace = {
  member_id: string

  organization_id: string

  organization_name: string

  organization_short_name:
    | string
    | null

  member_number:
    | string
    | null

  first_name:
    | string
    | null

  last_name:
    | string
    | null

  phone:
    | string
    | null

  email:
    | string
    | null

  status:
    | string
    | null

  joined_at:
    | string
    | null

  created_at:
    | string
    | null
}

type UserDetail = {
  user:
    UserData | null

  organization_roles:
    OrganizationRole[]

  member_spaces:
    MemberSpace[]
}

// ============================================================
// PAGE
// ============================================================

export default async function AdminUserDetailPage({
  params,
}: PageProps) {
  const {
    id,
  } =
    await params

  if (
    !id ||
    !isUuid(
      id
    )
  ) {
    notFound()
  }

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_platform_user_detail',
      {
        target_user_id:
          id,
      }
    )

  if (
    error
  ) {
    console.error(
      'EWUKAI - admin user detail:',
      error
    )

    if (
      error.message
        ?.toLowerCase()
        .includes(
          'user not found'
        )
    ) {
      notFound()
    }

    throw new Error(
      'Impossible de charger cet utilisateur.'
    )
  }

  if (
    !data
  ) {
    notFound()
  }

  const detail =
    data as UserDetail

  const user =
    detail.user

  if (
    !user
  ) {
    notFound()
  }

  const organizationRoles =
    Array.isArray(
      detail.organization_roles
    )
      ? detail.organization_roles
      : []

  const memberSpaces =
    Array.isArray(
      detail.member_spaces
    )
      ? detail.member_spaces
      : []

  const activeManagementRoles =
    organizationRoles.filter(
      (
        item
      ) =>
        item.is_active &&
        isManagementRole(
          item.role
        )
    )

  const activeOrganizationRoles =
    organizationRoles.filter(
      (
        item
      ) =>
        item.is_active
    )

  const activeMemberSpaces =
    memberSpaces.filter(
      (
        item
      ) =>
        item.status ===
        'active'
    )

  const displayName =
    user.full_name
      ?.trim() ||
    getMemberFallbackName(
      memberSpaces
    ) ||
    'Nom non renseigné'

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ==================================================== */}
      {/* HERO */}
      {/* ==================================================== */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">

          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-slate-900"
          >
            ← Utilisateurs
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div className="flex min-w-0 items-center gap-4">

              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white">
                {getInitials(
                  displayName !==
                    'Nom non renseigné'
                    ? displayName
                    : user.email ||
                        'Utilisateur'
                )}
              </div>

              <div className="min-w-0">

                <div className="flex flex-wrap gap-2">

                  {user.is_platform_admin && (
                    <Badge variant="admin">
                      Super-admin
                    </Badge>
                  )}

                  {activeManagementRoles.length >
                    0 && (
                    <Badge variant="management">
                      Gestion
                    </Badge>
                  )}

                  {activeMemberSpaces.length >
                    0 && (
                    <Badge variant="member">
                      Membre
                    </Badge>
                  )}

                </div>

                <h1 className="mt-3 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  {
                    displayName
                  }
                </h1>

                <p className="mt-1 break-all text-sm font-semibold text-slate-500">
                  {user.email ||
                    'Adresse e-mail non disponible'}
                </p>

              </div>

            </div>

            <Link
              href="/admin/users"
              className="w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
            >
              Tous les utilisateurs
            </Link>

          </div>

        </div>

      </section>

      {/* ==================================================== */}
      {/* CONTENT */}
      {/* ==================================================== */}

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">

        {/* LECTURE SEULE */}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Consultation Super-administrateur
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            Cette page présente les différents
            rattachements du compte. Aucun rôle,
            dossier membre ou accès n&apos;est
            modifié depuis cette vue.
          </p>

        </section>

        {/* KPI */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            label="Organisations"
            value={
              activeOrganizationRoles.length
            }
            note="Rattachements actifs"
          />

          <StatCard
            label="Rôles de gestion"
            value={
              activeManagementRoles.length
            }
            note="Responsabilités actives"
          />

          <StatCard
            label="Espaces membres"
            value={
              activeMemberSpaces.length
            }
            note="Dossiers membres actifs"
          />

          <StatCard
            label="Administration"
            value={
              user.is_platform_admin
                ? 'Oui'
                : 'Non'
            }
            note={
              user.is_platform_admin
                ? 'Super-administrateur'
                : 'Compte standard'
            }
          />

        </section>

        {/* COMPTE */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Compte utilisateur"
            description="Informations liées au compte EWUKAI."
          />

          <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">

            <Info
              label="Nom"
              value={
                displayName
              }
            />

            <Info
              label="E-mail"
              value={
                user.email
              }
            />

            <Info
              label="Téléphone"
              value={
                user.phone
              }
            />

            <Info
              label="Inscription"
              value={
                formatDateTime(
                  user.created_at
                )
              }
            />

            <Info
              label="Dernière connexion"
              value={
                formatDateTime(
                  user.last_sign_in_at
                )
              }
            />

            <Info
              label="Administration plateforme"
              value={
                user.is_platform_admin
                  ? formatPlatformRole(
                      user.platform_admin_role
                    )
                  : 'Aucun accès administrateur'
              }
            />

          </div>

        </section>

        {/* ROLES ORGANISATIONS */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Rôles dans les organisations"
            description={`${organizationRoles.length} rattachement(s) enregistré(s).`}
          />

          {organizationRoles.length ===
          0 ? (
            <EmptyState
              title="Aucune organisation"
              description="Ce compte n’est rattaché à aucune organisation."
            />
          ) : (
            <div className="divide-y divide-slate-100">

              {organizationRoles.map(
                (
                  item
                ) => (
                  <div
                    key={`${item.organization_id}-${item.role}`}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >

                    <div>

                      <Link
                        href={`/admin/organizations/${item.organization_id}`}
                        className="font-black text-slate-900 transition hover:text-emerald-700"
                      >
                        {item.organization_short_name ||
                          item.organization_name}
                      </Link>

                      {item.organization_short_name && (
                        <p className="mt-1 text-xs text-slate-500">
                          {
                            item.organization_name
                          }
                        </p>
                      )}

                    </div>

                    <div className="flex flex-wrap items-center gap-2">

                      <Badge
                        variant={
                          isManagementRole(
                            item.role
                          )
                            ? 'management'
                            : 'member'
                        }
                      >
                        {formatRole(
                          item.role
                        )}
                      </Badge>

                      <StatusBadge
                        active={
                          item.is_active
                        }
                      />

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* MEMBER SPACES */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <CardHeader
            title="Dossiers membres"
            description={`${memberSpaces.length} dossier(s) lié(s) au compte utilisateur.`}
          />

          {memberSpaces.length ===
          0 ? (
            <EmptyState
              title="Aucun dossier membre"
              description="Ce compte n’est actuellement lié à aucun dossier membre."
            />
          ) : (
            <div className="divide-y divide-slate-100">

              {memberSpaces.map(
                (
                  member
                ) => (
                  <div
                    key={
                      member.member_id
                    }
                    className="px-6 py-5"
                  >

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <Link
                            href={`/admin/organizations/${member.organization_id}`}
                            className="font-black text-slate-900 transition hover:text-emerald-700"
                          >
                            {member.organization_short_name ||
                              member.organization_name}
                          </Link>

                          <MemberStatus
                            status={
                              member.status
                            }
                          />

                        </div>

                        <p className="mt-2 text-sm font-bold text-slate-700">
                          {getMemberName(
                            member
                          )}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Matricule :{' '}
                          {member.member_number ||
                            'Non attribué'}
                        </p>

                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:min-w-[390px]">

                        <SmallInfo
                          label="Téléphone"
                          value={
                            member.phone
                          }
                        />

                        <SmallInfo
                          label="Adhésion"
                          value={
                            formatDate(
                              member.joined_at
                            )
                          }
                        />

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </section>

      </div>

    </main>
  )
}

// ============================================================
// COMPONENTS
// ============================================================

function CardHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-b border-slate-100 px-6 py-5">

      <h2 className="text-lg font-black text-slate-950">
        {
          title
        }
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {
          description
        }
      </p>

    </div>
  )
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string
  value: number | string
  note: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-3 text-3xl font-black text-slate-950">
        {
          value
        }
      </p>

      <p className="mt-2 text-xs font-medium text-slate-500">
        {
          note
        }
      </p>

    </div>
  )
}

function Info({
  label,
  value,
}: {
  label: string

  value:
    | string
    | null
    | undefined
}) {
  return (
    <div>

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-2 break-words text-sm font-semibold text-slate-800">
        {value?.trim()
          ? value
          : 'Non renseigné'}
      </p>

    </div>
  )
}

function SmallInfo({
  label,
  value,
}: {
  label: string

  value:
    | string
    | null
    | undefined
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">

      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p className="mt-1 font-bold text-slate-700">
        {value?.trim()
          ? value
          : '—'}
      </p>

    </div>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="px-6 py-12 text-center">

      <p className="font-black text-slate-800">
        {
          title
        }
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {
          description
        }
      </p>

    </div>
  )
}

function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode

  variant?:
    | 'default'
    | 'admin'
    | 'management'
    | 'member'
}) {
  const classes = {
    default:
      'bg-slate-100 text-slate-600',

    admin:
      'bg-violet-50 text-violet-700',

    management:
      'bg-amber-50 text-amber-700',

    member:
      'bg-emerald-50 text-emerald-700',
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${classes[variant]}`}
    >
      {
        children
      }
    </span>
  )
}

function StatusBadge({
  active,
}: {
  active: boolean
}) {
  return (
    <span
      className={
        active
          ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700'
          : 'rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-red-700'
      }
    >
      {active
        ? 'Actif'
        : 'Inactif'}
    </span>
  )
}

function MemberStatus({
  status,
}: {
  status:
    | string
    | null
}) {
  if (
    status ===
    'active'
  ) {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
        Membre actif
      </span>
    )
  }

  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
      {status ||
        'Statut inconnu'}
    </span>
  )
}

// ============================================================
// HELPERS
// ============================================================

function isManagementRole(
  role: string
) {
  return [
    'owner',
    'president',
    'treasurer',
    'secretary',
    'auditor',
  ].includes(
    role
  )
}

function formatRole(
  role: string
) {
  switch (
    role
  ) {
    case 'owner':
      return 'Responsable'

    case 'president':
      return 'Président'

    case 'treasurer':
      return 'Trésorier'

    case 'secretary':
      return 'Secrétaire'

    case 'auditor':
      return 'Auditeur'

    case 'member':
      return 'Membre'

    default:
      return role
  }
}

function formatPlatformRole(
  role:
    | string
    | null
) {
  if (
    role ===
    'super_admin'
  ) {
    return 'Super-administrateur'
  }

  return role ||
    'Administrateur'
}

function getMemberName(
  member: MemberSpace
) {
  const name =
    [
      member.first_name,
      member.last_name,
    ]
      .filter(
        Boolean
      )
      .join(
        ' '
      )
      .trim()

  return name ||
    'Nom membre non renseigné'
}

function getMemberFallbackName(
  members: MemberSpace[]
) {
  for (
    const member of
    members
  ) {
    const name =
      getMemberName(
        member
      )

    if (
      name !==
      'Nom membre non renseigné'
    ) {
      return name
    }
  }

  return null
}

function getInitials(
  value: string
) {
  const words =
    value
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      )

  if (
    words.length ===
    0
  ) {
    return 'AC'
  }

  if (
    words.length ===
    1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase()
  }

  return words
    .slice(
      0,
      2
    )
    .map(
      word =>
        word.charAt(
          0
        )
    )
    .join(
      ''
    )
    .toUpperCase()
}

function formatDate(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return '—'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl
    .DateTimeFormat(
      'fr-FR',
      {
        day:
          '2-digit',

        month:
          'long',

        year:
          'numeric',
      }
    )
    .format(
      date
    )
}

function formatDateTime(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return 'Jamais'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }

  return new Intl
    .DateTimeFormat(
      'fr-FR',
      {
        day:
          '2-digit',

        month:
          'short',

        year:
          'numeric',

        hour:
          '2-digit',

        minute:
          '2-digit',
      }
    )
    .format(
      date
    )
}

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}