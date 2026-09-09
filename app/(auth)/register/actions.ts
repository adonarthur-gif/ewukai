'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

// ============================================================
// AFRI CLUB
// INSCRIPTION RESPONSABLE
// ============================================================

const planCodes = [
  'free',
  'standard',
  'pro',
  'enterprise',
] as const

type PlanCode =
  (typeof planCodes)[number]

// ============================================================
// VALIDATION
// ============================================================

const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(
      3,
      'Le nom doit contenir au moins 3 caractères.'
    ),

  email: z
    .string()
    .trim()
    .email(
      'Adresse e-mail invalide.'
    ),

  password: z
    .string()
    .min(
      8,
      'Le mot de passe doit contenir au moins 8 caractères.'
    ),

  planCode: z.enum(
    planCodes
  ),
})

// ============================================================
// INSCRIPTION
// ============================================================

export async function register(
  formData: FormData
) {
  const planCode =
    normalizePlanCode(
      formData.get(
        'planCode'
      )
    )

  const parsed =
    registerSchema.safeParse({
      fullName:
        formData.get(
          'fullName'
        ),

      email:
        formData.get(
          'email'
        ),

      password:
        formData.get(
          'password'
        ),

      planCode,
    })

  // ==========================================================
  // ERREUR DE VALIDATION
  // ==========================================================

  if (
    !parsed.success
  ) {
    const message =
      parsed.error
        .issues[0]
        ?.message ??
      'Informations invalides.'

    redirect(
      registerErrorUrl(
        message,
        planCode
      )
    )
  }

  const {
    fullName,
    email,
    password,
  } =
    parsed.data

  const selectedPlan =
    parsed.data.planCode

  // ==========================================================
  // SUPABASE
  // ==========================================================

  const supabase =
    await createClient()

  const siteUrl =
    (
      process.env
        .NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000'
    ).replace(
      /\/$/,
      ''
    )

  // ==========================================================
  // DESTINATION APRES CONFIRMATION EMAIL
  //
  // Le plan reste présent :
  //
  // /onboarding?plan=standard
  // /onboarding?plan=pro
  // etc.
  // ==========================================================

  const onboardingUrl =
    `${siteUrl}/onboarding?plan=${encodeURIComponent(
      selectedPlan
    )}`

  // ==========================================================
  // CREATION DU COMPTE
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.auth
      .signUp({
        email,
        password,

        options: {
          data: {
            full_name:
              fullName,

            // Information utile également
            // dans les métadonnées du compte.
            selected_plan:
              selectedPlan,
          },

          emailRedirectTo:
            onboardingUrl,
        },
      })

  // ==========================================================
  // ERREUR SUPABASE
  // ==========================================================

  if (
    error
  ) {
    let message =
      error.message

    const normalizedMessage =
      error.message
        .toLowerCase()

    if (
      normalizedMessage.includes(
        'already registered'
      ) ||
      normalizedMessage.includes(
        'already been registered'
      ) ||
      normalizedMessage.includes(
        'user already registered'
      )
    ) {
      message =
        'Un compte existe déjà avec cette adresse e-mail.'
    }

    redirect(
      registerErrorUrl(
        message,
        selectedPlan
      )
    )
  }

  // ==========================================================
  // SESSION IMMEDIATE
  //
  // Si la confirmation e-mail est désactivée,
  // on poursuit directement vers l'onboarding.
  // ==========================================================

  if (
    data.session
  ) {
    redirect(
      `/onboarding?plan=${encodeURIComponent(
        selectedPlan
      )}`
    )
  }

  // ==========================================================
  // CONFIRMATION EMAIL NECESSAIRE
  // ==========================================================

  redirect(
    `/login?message=${encodeURIComponent(
      'Vérifiez votre boîte e-mail pour confirmer votre compte.'
    )}&plan=${encodeURIComponent(
      selectedPlan
    )}`
  )
}

// ============================================================
// URL ERREUR
// ============================================================

function registerErrorUrl(
  message: string,
  planCode: PlanCode
) {
  return (
    `/register?plan=${encodeURIComponent(
      planCode
    )}` +
    `&error=${encodeURIComponent(
      message
    )}`
  )
}

// ============================================================
// PLAN
// ============================================================

function normalizePlanCode(
  value:
    | FormDataEntryValue
    | string
    | null
    | undefined
): PlanCode {
  if (
    typeof value !==
    'string'
  ) {
    return 'free'
  }

  const normalized =
    value
      .trim()
      .toLowerCase()

  if (
    planCodes.includes(
      normalized as PlanCode
    )
  ) {
    return normalized as PlanCode
  }

  return 'free'
}