'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

// ============================================================
// EWUKAI
// ONBOARDING - CREATION D'UNE ORGANISATION
// ============================================================


// ============================================================
// TYPES D'ORGANISATION
// ============================================================

const organizationTypes = [
  'mutual',
  'association',
  'ngo',
  'cooperative',
  'tontine',
  'club',
  'foundation',
  'community',
  'other',
] as const

const allowedLogoMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

const MAX_LOGO_SIZE =
  5 * 1024 * 1024


// ============================================================
// VALIDATION
// ============================================================

const organizationSchema =
  z.object({

    // --------------------------------------------------------
    // ORGANISATION
    // --------------------------------------------------------

    organizationType:
      z.enum(
        organizationTypes,
        {
          message:
            "Choisissez le type d'organisation.",
        }
      ),

    name:
      z.string()
        .trim()
        .min(
          3,
          "Le nom de l'organisation est obligatoire."
        )
        .max(
          150,
          "Le nom de l'organisation est trop long."
        ),

    // Le sigle devient obligatoire.
    // Il sert notamment à produire ATA-000001.

    shortName:
      z.string()
        .trim()
        .min(
          2,
          'Le sigle de l’organisation est obligatoire.'
        )
        .max(
          30,
          'Le sigle est trop long.'
        ),

    legalName:
      optionalText(200),

    registrationNumber:
      optionalText(100),

    countryCode:
      z.string()
        .trim()
        .min(
          2,
          'Choisissez un pays.'
        )
        .max(10),

    city:
      optionalText(150),

    phone:
      optionalText(50),

    email:
      z.string()
        .trim()
        .max(200)
        .optional()
        .transform(
          (value) =>
            value || undefined
        )
        .refine(
          (value) =>
            !value ||
            z.string()
              .email()
              .safeParse(value)
              .success,
          'Adresse e-mail invalide.'
        ),

    website:
      optionalText(250),

    slogan:
      optionalText(200),

    objectives:
      optionalText(4000),

    mission:
      optionalText(2500),

    vision:
      optionalText(2500),

    // --------------------------------------------------------
    // IDENTITE VISUELLE
    // --------------------------------------------------------

    primaryColor:
      z.string()
        .regex(
          /^#[0-9A-Fa-f]{6}$/,
          'Couleur principale invalide.'
        ),

    secondaryColor:
      z.string()
        .regex(
          /^#[0-9A-Fa-f]{6}$/,
          'Couleur secondaire invalide.'
        ),

    accentColor:
      z.string()
        .regex(
          /^#[0-9A-Fa-f]{6}$/,
          "Couleur d'accent invalide."
        ),

    // --------------------------------------------------------
    // VITRINE PUBLIQUE
    // --------------------------------------------------------

    publicSlug:
      optionalText(80),

    shortDescription:
      optionalText(600),

    about:
      optionalText(10000),

    history:
      optionalText(10000),

    valuesText:
      optionalText(5000),

    presidentMessage:
      optionalText(10000),

    publicPhone:
      optionalText(50),

    publicEmail:
      z.string()
        .trim()
        .max(200)
        .optional()
        .transform(
          (value) =>
            value || undefined
        )
        .refine(
          (value) =>
            !value ||
            z.string()
              .email()
              .safeParse(value)
              .success,
          'Adresse e-mail publique invalide.'
        ),

    publicLocation:
      optionalText(250),

    publicPageEnabled:
      z.boolean(),

    onlineMembershipEnabled:
      z.boolean(),

    showMemberCount:
      z.boolean(),

    showLeadership:
      z.boolean(),

    showProjects:
      z.boolean(),

    showNews:
      z.boolean(),

    // --------------------------------------------------------
    // RESPONSABLE / CREATEUR
    // --------------------------------------------------------

    ownerFirstName:
      optionalText(100),

    ownerLastName:
      optionalText(100),

    ownerAsMember:
      z.boolean(),

  })
  .superRefine(
    (
      values,
      ctx
    ) => {

      // ------------------------------------------------------
      // Si le responsable souhaite être enregistré comme
      // membre, son identité est obligatoire.
      // ------------------------------------------------------

      if (
        values.ownerAsMember &&
        !values.ownerFirstName
      ) {
        ctx.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: [
            'ownerFirstName',
          ],

          message:
            'Les prénoms du responsable sont obligatoires.',
        })
      }

      if (
        values.ownerAsMember &&
        !values.ownerLastName
      ) {
        ctx.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: [
            'ownerLastName',
          ],

          message:
            'Le nom du responsable est obligatoire.',
        })
      }

    }
  )


// ============================================================
// CREATION
// ============================================================

export async function createOrganization(
  formData: FormData
) {

  // ==========================================================
  // LECTURE + VALIDATION DU FORMULAIRE
  // ==========================================================

  const parsed =
    organizationSchema.safeParse({

      // ------------------------------------------------------
      // ORGANISATION
      // ------------------------------------------------------

      organizationType:
        formData.get(
          'organizationType'
        ),

      name:
        formData.get(
          'name'
        ),

      shortName:
        formData.get(
          'shortName'
        ),

      legalName:
        valueOrUndefined(
          formData.get(
            'legalName'
          )
        ),

      registrationNumber:
        valueOrUndefined(
          formData.get(
            'registrationNumber'
          )
        ),

      countryCode:
        formData.get(
          'countryCode'
        ),

      city:
        valueOrUndefined(
          formData.get(
            'city'
          )
        ),

      phone:
        valueOrUndefined(
          formData.get(
            'phone'
          )
        ),

      email:
        valueOrUndefined(
          formData.get(
            'email'
          )
        ),

      website:
        valueOrUndefined(
          formData.get(
            'website'
          )
        ),

      slogan:
        valueOrUndefined(
          formData.get(
            'slogan'
          )
        ),

      objectives:
        valueOrUndefined(
          formData.get(
            'objectives'
          )
        ),

      mission:
        valueOrUndefined(
          formData.get(
            'mission'
          )
        ),

      vision:
        valueOrUndefined(
          formData.get(
            'vision'
          )
        ),

      // ------------------------------------------------------
      // IDENTITE VISUELLE
      // ------------------------------------------------------

      primaryColor:
        formData.get(
          'primaryColor'
        ),

      secondaryColor:
        formData.get(
          'secondaryColor'
        ),

      accentColor:
        formData.get(
          'accentColor'
        ),

      // ------------------------------------------------------
      // VITRINE PUBLIQUE
      // ------------------------------------------------------

      publicSlug:
        valueOrUndefined(
          formData.get(
            'publicSlug'
          )
        ),

      shortDescription:
        valueOrUndefined(
          formData.get(
            'shortDescription'
          )
        ),

      about:
        valueOrUndefined(
          formData.get(
            'about'
          )
        ),

      history:
        valueOrUndefined(
          formData.get(
            'history'
          )
        ),

      valuesText:
        valueOrUndefined(
          formData.get(
            'valuesText'
          )
        ),

      presidentMessage:
        valueOrUndefined(
          formData.get(
            'presidentMessage'
          )
        ),

      publicPhone:
        valueOrUndefined(
          formData.get(
            'publicPhone'
          )
        ),

      publicEmail:
        valueOrUndefined(
          formData.get(
            'publicEmail'
          )
        ),

      publicLocation:
        valueOrUndefined(
          formData.get(
            'locationLabel'
          )
        ),

      publicPageEnabled:
        checkboxValue(
          formData.get(
            'publicPageEnabled'
          )
        ),

      onlineMembershipEnabled:
        checkboxValue(
          formData.get(
            'onlineMembershipEnabled'
          )
        ),

      showMemberCount:
        checkboxValue(
          formData.get(
            'showMemberCount'
          )
        ),

      showLeadership:
        checkboxValue(
          formData.get(
            'showLeadership'
          )
        ),

      showProjects:
        checkboxValue(
          formData.get(
            'showProjects'
          )
        ),

      showNews:
        checkboxValue(
          formData.get(
            'showNews'
          )
        ),

      // ------------------------------------------------------
      // RESPONSABLE
      // ------------------------------------------------------

      ownerFirstName:
        valueOrUndefined(
          formData.get(
            'ownerFirstName'
          )
        ),

      ownerLastName:
        valueOrUndefined(
          formData.get(
            'ownerLastName'
          )
        ),

      // Une checkbox HTML cochée renvoie généralement "on".

      ownerAsMember:
        checkboxValue(
          formData.get(
            'ownerAsMember'
          )
        ),

    })


  // ==========================================================
  // ERREUR DE VALIDATION
  // ==========================================================

  if (!parsed.success) {

    const firstIssue =
      parsed.error
        .issues[0]

    redirect(
      `/onboarding?error=${encodeURIComponent(
        firstIssue
          ?.message ??
          'Informations invalides.'
      )}`
    )

  }


  const values =
    parsed.data


  // ==========================================================
  // CLIENT SUPABASE
  // ==========================================================

  const supabase =
    await createClient()


  // ==========================================================
  // AUTHENTIFICATION
  // ==========================================================

  const {
    data: authData,
    error: authError,
  } =
    await supabase.auth
      .getClaims()


  const userId =
    authData
      ?.claims
      ?.sub


  if (
    authError ||
    !userId
  ) {

    redirect('/login')

  }


  // ==========================================================
  // EVITER UN SECOND ONBOARDING DE GESTION
  //
  // IMPORTANT :
  // Une personne peut être membre de plusieurs mutuelles sans
  // être dirigeant. Cela ne doit jamais l'empêcher de créer sa
  // propre organisation dans EWUKAI.
  //
  // Seuls les rôles de gestion actifs ci-dessous bloquent la
  // création d'une nouvelle organisation depuis cet onboarding.
  // ==========================================================

  const {
    data:
      existingOrganization,

    error:
      existingOrganizationError,
  } =
    await supabase
      .from(
        'organization_users'
      )
      .select(`
        organization_id,
        role,
        is_active
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
          'owner',
          'president',
          'treasurer',
          'secretary',
          'auditor',
        ]
      )
      .limit(1)
      .maybeSingle()


  if (
    existingOrganizationError
  ) {

    console.error(
      'EWUKAI - ONBOARDING - existing organization:',
      existingOrganizationError
    )

    redirect(
      `/onboarding?error=${encodeURIComponent(
        'Impossible de vérifier votre compte.'
      )}`
    )

  }


  if (
    existingOrganization
  ) {

    redirect(
      '/dashboard'
    )

  }


  // ==========================================================
  // LOCALISATION DU PROFIL PUBLIC
  // ==========================================================

  const countryName =
    getCountryName(
      values.countryCode
    )


  const locationLabel =
    [
      values.city,
      countryName,
    ]
      .filter(Boolean)
      .join(', ') ||
    countryName


  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const shortName =
    values.shortName
      .trim()
      .toUpperCase()


  const requestedPublicSlug =
    normalizeSlug(
      values.publicSlug ??
      shortName
    )


  const publicPhone =
    values.publicPhone ??
    values.phone ??
    null


  const publicEmail =
    values.publicEmail ??
    values.email ??
    null


  const publicLocation =
    values.publicLocation ??
    locationLabel


  const ownerFirstName =
    values.ownerFirstName
      ?.trim() ??
    null


  const ownerLastName =
    values.ownerLastName
      ?.trim()
      .toUpperCase() ??
    null


  // ==========================================================
  // CREATION ATOMIQUE
  //
  // La fonction PostgreSQL doit créer :
  //
  // 1. organizations
  // 2. organization_users => owner
  // 3. organization_public_profiles
  // 4. profiles
  // 5. members => ATA-000001 si ownerAsMember = true
  //
  // Tout cela dans UNE transaction.
  // ==========================================================

  const {
    data:
      organizationId,

    error,
  } =
    await supabase.rpc(
      'create_organization_with_profile',
      {

        // ----------------------------------------------------
        // ORGANISATION
        // ----------------------------------------------------

        target_name:
          values.name,

        target_short_name:
          shortName,

        target_slogan:
          values.slogan ??
          null,

        target_objectives:
          values.objectives ??
          null,

        target_mission:
          values.mission ??
          null,

        target_vision:
          values.vision ??
          null,

        target_location_label:
          locationLabel,

        target_organization_type:
          values.organizationType,

        target_legal_name:
          values.legalName ??
          null,

        target_registration_number:
          values.registrationNumber ??
          null,

        target_country_code:
          values.countryCode,

        target_city:
          values.city ??
          null,

        target_phone:
          values.phone ??
          null,

        target_email:
          values.email ??
          null,

        target_website:
          values.website ??
          null,

        // ----------------------------------------------------
        // RESPONSABLE
        // ----------------------------------------------------

        target_owner_first_name:
          ownerFirstName,

        target_owner_last_name:
          ownerLastName,

        target_owner_as_member:
          values.ownerAsMember,

      }
    )


  // ==========================================================
  // ERREUR POSTGRESQL
  // ==========================================================

  if (error) {

    console.error(
      'EWUKAI - ONBOARDING - create organization:',
      {
        code:
          error.code,

        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,
      }
    )


    // --------------------------------------------------------
    // Messages plus compréhensibles
    // --------------------------------------------------------

    let message =
      "Impossible de créer l'organisation."


    const errorMessage =
      (
        error.message ??
        ''
      )
        .toLowerCase()


    if (
      errorMessage.includes(
        'owner first name'
      )
    ) {

      message =
        'Les prénoms du responsable sont obligatoires.'

    } else if (
      errorMessage.includes(
        'owner last name'
      )
    ) {

      message =
        'Le nom du responsable est obligatoire.'

    } else if (
      errorMessage.includes(
        'short name'
      )
    ) {

      message =
        'Le sigle de l’organisation est obligatoire.'

    } else if (
      errorMessage.includes(
        'organization name'
      )
    ) {

      message =
        "Le nom de l'organisation est invalide."

    }


    redirect(
      `/onboarding?error=${encodeURIComponent(
        message
      )}`
    )

  }


  // ==========================================================
  // VERIFICATION DU RESULTAT
  // ==========================================================

  if (!organizationId) {

    redirect(
      `/onboarding?error=${encodeURIComponent(
        "L'organisation n'a pas pu être créée."
      )}`
    )

  }


  // ==========================================================
  // CONFIGURATION COMPLEMENTAIRE
  //
  // La création principale est déjà réussie à ce stade.
  // Les éléments ci-dessous sont volontairement non bloquants :
  // s'ils ne peuvent pas être enregistrés maintenant, le dirigeant
  // retrouvera les mêmes réglages dans Paramètres.
  // ==========================================================

  const setupWarnings:
    string[] = []


  // ----------------------------------------------------------
  // ORGANISATION : page publique et adhésion en ligne
  // ----------------------------------------------------------

  let finalPublicSlug =
    requestedPublicSlug

  const {
    error:
      organizationSettingsError,
  } =
    await supabase
      .from('organizations')
      .update({
        public_slug:
          finalPublicSlug ||
          null,

        public_page_enabled:
          values.publicPageEnabled,

        online_membership_enabled:
          values.onlineMembershipEnabled,
      })
      .eq(
        'id',
        organizationId
      )


  if (
    organizationSettingsError
  ) {

    if (
      organizationSettingsError
        .code ===
      '23505'
    ) {

      finalPublicSlug =
        `${requestedPublicSlug || 'organisation'}-${String(
          organizationId
        ).slice(
          0,
          6
        )}`

      const {
        error:
          fallbackSlugError,
      } =
        await supabase
          .from(
            'organizations'
          )
          .update({
            public_slug:
              finalPublicSlug,

            public_page_enabled:
              values.publicPageEnabled,

            online_membership_enabled:
              values.onlineMembershipEnabled,
          })
          .eq(
            'id',
            organizationId
          )

      if (
        fallbackSlugError
      ) {
        console.error(
          'EWUKAI - ONBOARDING - public settings fallback:',
          fallbackSlugError
        )

        setupWarnings.push(
          'adresse publique'
        )
      }

    } else {

      console.error(
        'EWUKAI - ONBOARDING - public settings:',
        organizationSettingsError
      )

      setupWarnings.push(
        'page publique'
      )

    }

  }


  // ----------------------------------------------------------
  // PROFIL PUBLIC
  // ----------------------------------------------------------

  const {
    error:
      publicProfileError,
  } =
    await supabase
      .from(
        'organization_public_profiles'
      )
      .upsert(
        {
          organization_id:
            organizationId,

          slogan:
            values.slogan ??
            null,

          short_description:
            values.shortDescription ??
            null,

          about:
            values.about ??
            null,

          history:
            values.history ??
            null,

          mission:
            values.mission ??
            null,

          vision:
            values.vision ??
            null,

          values_text:
            values.valuesText ??
            null,

          objectives:
            values.objectives ??
            null,

          president_message:
            values.presidentMessage ??
            null,

          public_phone:
            publicPhone,

          public_email:
            publicEmail,

          location_label:
            publicLocation,

          show_member_count:
            values.showMemberCount,

          show_leadership:
            values.showLeadership,

          show_projects:
            values.showProjects,

          show_news:
            values.showNews,

          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            'organization_id',
        }
      )


  if (
    publicProfileError
  ) {
    console.error(
      'EWUKAI - ONBOARDING - public profile:',
      publicProfileError
    )

    setupWarnings.push(
      'profil public'
    )
  }


  // ----------------------------------------------------------
  // LOGO
  // ----------------------------------------------------------

  const logo =
    formData.get(
      'logo'
    )

  let uploadedLogoPath:
    | string
    | null =
      null

  let logoPath:
    | string
    | null =
      null


  if (
    logo instanceof File &&
    logo.size > 0
  ) {

    if (
      !allowedLogoMimeTypes
        .includes(
          logo.type
        )
    ) {

      setupWarnings.push(
        'logo (format non pris en charge)'
      )

    } else if (
      logo.size >
      MAX_LOGO_SIZE
    ) {

      setupWarnings.push(
        'logo (plus de 5 Mo)'
      )

    } else {

      const extension =
        getExtensionFromMimeType(
          logo.type
        )

      logoPath =
        `${organizationId}/logo-${Date.now()}.${extension}`

      const arrayBuffer =
        await logo
          .arrayBuffer()

      const {
        error:
          logoUploadError,
      } =
        await supabase
          .storage
          .from(
            'organization-branding'
          )
          .upload(
            logoPath,
            arrayBuffer,
            {
              contentType:
                logo.type,

              upsert:
                false,
            }
          )

      if (
        logoUploadError
      ) {
        console.error(
          'EWUKAI - ONBOARDING - logo upload:',
          logoUploadError
        )

        logoPath =
          null

        setupWarnings.push(
          'logo'
        )

      } else {

        uploadedLogoPath =
          logoPath

      }

    }

  }


  // ----------------------------------------------------------
  // COULEURS + LOGO
  // ----------------------------------------------------------

  const {
    error:
      brandingError,
  } =
    await supabase.rpc(
      'update_organization_branding',
      {
        target_organization_id:
          organizationId,

        target_primary_color:
          values.primaryColor,

        target_secondary_color:
          values.secondaryColor,

        target_accent_color:
          values.accentColor,

        target_logo_path:
          logoPath,
      }
    )


  if (
    brandingError
  ) {
    console.error(
      'EWUKAI - ONBOARDING - branding:',
      brandingError
    )

    if (
      uploadedLogoPath
    ) {
      await supabase
        .storage
        .from(
          'organization-branding'
        )
        .remove([
          uploadedLogoPath,
        ])
    }

    setupWarnings.push(
      'identité visuelle'
    )
  }


  // ==========================================================
  // SUCCES
  //
  // On ouvre volontairement Paramètres : le dirigeant peut
  // vérifier ce qui a été enregistré et poursuivre plus tard.
  // ==========================================================

  const warningQuery =
    setupWarnings.length >
      0
      ? `&setupWarning=${encodeURIComponent(
          `À compléter : ${setupWarnings.join(
            ', '
          )}.`
        )}`
      : ''


  redirect(
    `/parametres?created=1&setup=continue${warningQuery}`
  )
}


// ============================================================
// HELPERS
// ============================================================

function optionalText(
  maxLength: number
) {

  return z
    .string()
    .trim()
    .max(
      maxLength
    )
    .optional()

}


// ============================================================
// FORM DATA -> STRING | UNDEFINED
// ============================================================

function valueOrUndefined(
  value:
    FormDataEntryValue |
    null
) {

  if (
    typeof value !==
    'string'
  ) {

    return undefined

  }


  const normalized =
    value.trim()


  return normalized ||
    undefined
}


// ============================================================
// CHECKBOX
// ============================================================

function checkboxValue(
  value:
    FormDataEntryValue |
    null
) {

  if (
    typeof value !==
    'string'
  ) {

    return false

  }


  return [
    'on',
    'true',
    '1',
    'yes',
  ].includes(
    value
      .trim()
      .toLowerCase()
  )
}


// ============================================================
// SLUG PUBLIC
// ============================================================

function normalizeSlug(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
}


// ============================================================
// EXTENSION LOGO
// ============================================================

function getExtensionFromMimeType(
  mimeType: string
) {
  switch (
    mimeType
  ) {
    case 'image/png':
      return 'png'

    case 'image/webp':
      return 'webp'

    default:
      return 'jpg'
  }
}


// ============================================================
// PAYS
// ============================================================

function getCountryName(
  code: string
) {

  const countries:
    Record<
      string,
      string
    > = {

      CI:
        "Côte d'Ivoire",

      BJ:
        'Bénin',

      BF:
        'Burkina Faso',

      CM:
        'Cameroun',

      GH:
        'Ghana',

      GN:
        'Guinée',

      ML:
        'Mali',

      NE:
        'Niger',

      SN:
        'Sénégal',

      TG:
        'Togo',

      OTHER:
        'Autre pays',

    }


  return (
    countries[
      code
        .toUpperCase()
    ] ??
    code
      .toUpperCase()
  )
}
