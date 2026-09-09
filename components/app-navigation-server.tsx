import AppNavigation from '@/components/app-navigation'

import {
  getCurrentOrganization,
  MANAGEMENT_ROLES,
  type OrganizationRole,
} from '@/lib/auth/current-organization'

import {
  getPlatformAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// AFRI CLUB
// NAVIGATION SERVEUR
//
// Responsabilités :
// - organisation active
// - multi-organisation
// - branding
// - logo
// - espace membre
// - accès administration plateforme
// ============================================================

// ============================================================
// TYPES
// ============================================================

type ManagementMembershipRow = {
  organization_id: string
  role: OrganizationRole
  created_at: string
}

type OrganizationRow = {
  id: string

  name: string

  short_name:
    | string
    | null

  logo_url:
    | string
    | null
}

type OrganizationBrandingRow = {
  organization_id: string

  logo_path:
    | string
    | null

  primary_color:
    | string
    | null

  secondary_color:
    | string
    | null

  accent_color:
    | string
    | null
}

type MemberRow = {
  organization_id: string
}

// ============================================================
// COULEURS PAR DEFAUT
// ============================================================

const DEFAULT_PRIMARY =
  '#047857'

const DEFAULT_SECONDARY =
  '#0F172A'

const DEFAULT_ACCENT =
  '#ECFDF5'

// ============================================================
// BUCKET DES LOGOS
//
// Si une variable d'environnement existe,
// elle est prioritaire.
//
// Sinon Afri Club utilisera organization-logos.
// ============================================================

const ORGANIZATION_LOGO_BUCKET =
  process.env
    .NEXT_PUBLIC_ORGANIZATION_LOGO_BUCKET
    ?.trim() ||
  'organization-logos'

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default async function AppNavigationServer() {
  // ==========================================================
  // 1. CONTEXTES
  // ==========================================================

  const [
    currentOrganizationContext,
    platformAdmin,
  ] =
    await Promise.all([
      getCurrentOrganization(),
      getPlatformAdmin(),
    ])

  const isPlatformAdmin =
    platformAdmin?.role ===
    'super_admin'

  // ==========================================================
  // 2. AUCUNE ORGANISATION DE GESTION
  //
  // Cela peut notamment arriver :
  // - sur les routes publiques
  // - pendant l'authentification
  // - pour un Super-admin plateforme
  //   n'ayant pas d'organisation à gérer
  // ==========================================================

  if (
    !currentOrganizationContext
  ) {
    return (
      <>
        <BrandStyle
          primaryColor={
            DEFAULT_PRIMARY
          }
          secondaryColor={
            DEFAULT_SECONDARY
          }
          accentColor={
            DEFAULT_ACCENT
          }
        />

        <AppNavigation
          organizationId={
            null
          }
          organizationName={
            null
          }
          organizationShortName={
            null
          }
          role={
            null
          }
          logoUrl={
            null
          }
          primaryColor={
            DEFAULT_PRIMARY
          }
          secondaryColor={
            DEFAULT_SECONDARY
          }
          accentColor={
            DEFAULT_ACCENT
          }
          memberSpaceOrganizationId={
            null
          }
          managementOrganizations={
            []
          }
          isPlatformAdmin={
            isPlatformAdmin
          }
        />
      </>
    )
  }

  // ==========================================================
  // 3. CONTEXTE ORGANISATION ACTIVE
  // ==========================================================

  const {
    supabase,
    userId,
    organizationId,
    role,
  } =
    currentOrganizationContext

  // ==========================================================
  // 4. ORGANISATIONS GEREES PAR L'UTILISATEUR
  // ==========================================================

  const {
    data:
      membershipsData,

    error:
      membershipsError,
  } =
    await supabase
      .from(
        'organization_users'
      )
      .select(`
        organization_id,
        role,
        created_at
      `)
      .eq(
        'user_id',
        userId
      )
      .eq(
        'is_active',
        true
      )
      .in(
        'role',
        [
          ...MANAGEMENT_ROLES,
        ]
      )
      .order(
        'created_at',
        {
          ascending:
            true,
        }
      )

  if (
    membershipsError
  ) {
    console.error(
      'AFRI CLUB - navigation - management memberships:',
      membershipsError
    )
  }

  const memberships =
    (
      membershipsData ??
      []
    ) as ManagementMembershipRow[]

  // ==========================================================
  // 5. IDENTIFIANTS DES ORGANISATIONS
  // ==========================================================

  const organizationIds =
    Array.from(
      new Set(
        memberships.map(
          (
            membership
          ) =>
            membership
              .organization_id
        )
      )
    )

  // ==========================================================
  // 6. INFORMATIONS DE BASE DES ORGANISATIONS
  //
  // IMPORTANT :
  // logo_url appartient bien à organizations.
  //
  // Les couleurs et logo_path ne sont PAS ici.
  // ==========================================================

  let organizations:
    OrganizationRow[] =
    []

  if (
    organizationIds.length >
    0
  ) {
    const {
      data:
        organizationsData,

      error:
        organizationsError,
    } =
      await supabase
        .from(
          'organizations'
        )
        .select(`
          id,
          name,
          short_name,
          logo_url
        `)
        .in(
          'id',
          organizationIds
        )

    if (
      organizationsError
    ) {
      console.error(
        'AFRI CLUB - navigation - organizations:',
        organizationsError
      )
    } else {
      organizations =
        (
          organizationsData ??
          []
        ) as OrganizationRow[]
    }
  }

  // ==========================================================
  // 7. MAP DES ORGANISATIONS
  // ==========================================================

  const organizationById =
    new Map<
      string,
      OrganizationRow
    >()

  for (
    const organization of
    organizations
  ) {
    organizationById.set(
      organization.id,
      organization
    )
  }

  // ==========================================================
  // 8. ORGANISATION ACTIVE
  // ==========================================================

  let activeOrganization:
    OrganizationRow | null =
    organizationById.get(
      organizationId
    ) ??
    null

  // ==========================================================
  // SECURITE :
  //
  // Si l'organisation active n'était pas dans la requête
  // précédente, on la récupère directement.
  // ==========================================================

  if (
    !activeOrganization
  ) {
    const {
      data:
        activeOrganizationData,

      error:
        activeOrganizationError,
    } =
      await supabase
        .from(
          'organizations'
        )
        .select(`
          id,
          name,
          short_name,
          logo_url
        `)
        .eq(
          'id',
          organizationId
        )
        .maybeSingle()

    if (
      activeOrganizationError
    ) {
      console.error(
        'AFRI CLUB - navigation - active organization:',
        activeOrganizationError
      )
    }

    if (
      activeOrganizationData
    ) {
      const recoveredOrganization =
        activeOrganizationData as OrganizationRow

      activeOrganization =
        recoveredOrganization

      organizationById.set(
        recoveredOrganization.id,
        recoveredOrganization
      )
    }
  }

  // ==========================================================
  // 9. BRANDING DE L'ORGANISATION ACTIVE
  //
  // logo_path + couleurs sont dans :
  //
  // organization_public_profiles
  // ==========================================================

  let branding:
    OrganizationBrandingRow | null =
    null

  const {
    data:
      brandingData,

    error:
      brandingError,
  } =
    await supabase
      .from(
        'organization_public_profiles'
      )
      .select(`
        organization_id,
        logo_path,
        primary_color,
        secondary_color,
        accent_color
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .maybeSingle()

  if (
    brandingError
  ) {
    console.error(
      'AFRI CLUB - navigation - branding:',
      brandingError
    )
  } else if (
    brandingData
  ) {
    branding =
      brandingData as OrganizationBrandingRow
  }

  // ==========================================================
  // 10. SELECTEUR MULTI-ORGANISATION
  // ==========================================================

  const managementOrganizations =
    memberships.flatMap(
      (
        membership
      ) => {
        const organization =
          organizationById.get(
            membership
              .organization_id
          )

        if (
          !organization
        ) {
          return []
        }

        return [
          {
            id:
              organization.id,

            name:
              organization.name,

            shortName:
              organization
                .short_name,

            role:
              membership.role,
          },
        ]
      }
    )

  // ==========================================================
  // 11. ESPACE MEMBRE DANS L'ORGANISATION ACTIVE
  //
  // Un dirigeant peut également être membre de
  // l'organisation qu'il administre.
  // ==========================================================

  const {
    data:
      memberData,

    error:
      memberError,
  } =
    await supabase
      .from(
        'members'
      )
      .select(`
        organization_id
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'user_id',
        userId
      )
      .eq(
        'status',
        'active'
      )
      .limit(
        1
      )
      .maybeSingle()

  if (
    memberError
  ) {
    console.error(
      'AFRI CLUB - navigation - member space:',
      memberError
    )
  }

  const member =
    memberData
      ? (
          memberData as MemberRow
        )
      : null

  const memberSpaceOrganizationId =
    member
      ?.organization_id ??
    null

  // ==========================================================
  // 12. COULEURS
  // ==========================================================

  const primaryColor =
    safeColor(
      branding
        ?.primary_color,
      DEFAULT_PRIMARY
    )

  const secondaryColor =
    safeColor(
      branding
        ?.secondary_color,
      DEFAULT_SECONDARY
    )

  const accentColor =
    safeColor(
      branding
        ?.accent_color,
      DEFAULT_ACCENT
    )

  // ==========================================================
  // 13. LOGO
  //
  // Priorité :
  //
  // 1. logo_path du profil public
  // 2. logo_url historique de organizations
  // ==========================================================

  let logoUrl:
    string | null =
    null

  const brandingLogoPath =
    branding
      ?.logo_path
      ?.trim() ??
    ''

  // ==========================================================
  // LOGO DU PROFIL PUBLIC
  // ==========================================================

  if (
    brandingLogoPath
  ) {
    // --------------------------------------------------------
    // URL COMPLETE
    // --------------------------------------------------------

    if (
      brandingLogoPath.startsWith(
        'https://'
      ) ||
      brandingLogoPath.startsWith(
        'http://'
      )
    ) {
      logoUrl =
        brandingLogoPath
    } else {
      // ------------------------------------------------------
      // CHEMIN SUPABASE STORAGE
      // ------------------------------------------------------

      const {
        data:
          publicUrlData,
      } =
        supabase.storage
          .from(
            ORGANIZATION_LOGO_BUCKET
          )
          .getPublicUrl(
            brandingLogoPath
          )

      logoUrl =
        publicUrlData
          ?.publicUrl ??
        null
    }
  }

  // ==========================================================
  // FALLBACK :
  // ancien champ organizations.logo_url
  // ==========================================================

  if (
    !logoUrl
  ) {
    const legacyLogoUrl =
      activeOrganization
        ?.logo_url
        ?.trim() ??
      ''

    if (
      legacyLogoUrl
    ) {
      logoUrl =
        legacyLogoUrl
    }
  }

  // ==========================================================
  // 14. RENDU
  // ==========================================================

  return (
    <>
      {/* ==================================================== */}
      {/* VARIABLES CSS DU BRANDING */}
      {/* ==================================================== */}

      <BrandStyle
        primaryColor={
          primaryColor
        }
        secondaryColor={
          secondaryColor
        }
        accentColor={
          accentColor
        }
      />

      {/* ==================================================== */}
      {/* NAVIGATION */}
      {/* ==================================================== */}

      <AppNavigation
        organizationId={
          organizationId
        }
        organizationName={
          activeOrganization
            ?.name ??
          null
        }
        organizationShortName={
          activeOrganization
            ?.short_name ??
          null
        }
        role={
          role
        }
        logoUrl={
          logoUrl
        }
        primaryColor={
          primaryColor
        }
        secondaryColor={
          secondaryColor
        }
        accentColor={
          accentColor
        }
        memberSpaceOrganizationId={
          memberSpaceOrganizationId
        }
        managementOrganizations={
          managementOrganizations
        }
        isPlatformAdmin={
          isPlatformAdmin
        }
      />
    </>
  )
}

// ============================================================
// VARIABLES CSS DU BRANDING
// ============================================================

function BrandStyle({
  primaryColor,
  secondaryColor,
  accentColor,
}: {
  primaryColor: string
  secondaryColor: string
  accentColor: string
}) {
  return (
    <style>
      {`
        :root {
          --brand-primary: ${primaryColor};
          --brand-secondary: ${secondaryColor};
          --brand-accent: ${accentColor};
        }
      `}
    </style>
  )
}

// ============================================================
// VALIDATION DES COULEURS
// ============================================================

function safeColor(
  value:
    | string
    | null
    | undefined,

  fallback:
    string
) {
  if (
    value &&
    /^#[0-9A-Fa-f]{6}$/.test(
      value
    )
  ) {
    return value
  }

  return fallback
}