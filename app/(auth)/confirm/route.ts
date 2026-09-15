import {
  type EmailOtpType,
} from '@supabase/supabase-js'

import {
  type NextRequest,
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '@/lib/supabase/server'

// ============================================================
// EWUKAI
// CONFIRMATION EMAIL
// ============================================================

export async function GET(
  request: NextRequest
) {
  const requestUrl =
    new URL(
      request.url
    )

  const {
    searchParams,
    origin,
  } =
    requestUrl

  const tokenHash =
    searchParams.get(
      'token_hash'
    )

  const type =
    searchParams.get(
      'type'
    ) as EmailOtpType | null

  const rawNext =
    searchParams.get(
      'next'
    )

  // ==========================================================
  // DESTINATION SECURISEE
  //
  // Accepte :
  //
  // /onboarding?plan=standard
  //
  // ou :
  //
  // http://localhost:3000/onboarding?plan=standard
  //
  // mais refuse une redirection vers un domaine externe.
  // ==========================================================

  const destination =
    getSafeDestination(
      rawNext,
      origin
    )

  // ==========================================================
  // VERIFICATION OTP
  // ==========================================================

  if (
    tokenHash &&
    type
  ) {
    const supabase =
      await createClient()

    const {
      error,
    } =
      await supabase.auth
        .verifyOtp({
          type,
          token_hash:
            tokenHash,
        })

    // ========================================================
    // CONFIRMATION OK
    // ========================================================

    if (
      !error
    ) {
      return NextResponse.redirect(
        destination
      )
    }

    console.error(
      'EWUKAI - CONFIRM EMAIL:',
      {
        message:
          error.message,

        code:
          error.code,
      }
    )
  }

  // ==========================================================
  // LIEN INVALIDE
  // ==========================================================

  return NextResponse.redirect(
    new URL(
      `/login?error=${encodeURIComponent(
        'Le lien de confirmation est invalide ou expiré.'
      )}`,
      origin
    )
  )
}

// ============================================================
// REDIRECTION SECURISEE
// ============================================================

function getSafeDestination(
  rawNext:
    | string
    | null,
  requestOrigin: string
) {
  const fallback =
    new URL(
      '/onboarding',
      requestOrigin
    )

  if (
    !rawNext
  ) {
    return fallback
  }

  // ==========================================================
  // URL RELATIVE
  //
  // Exemple :
  // /onboarding?plan=pro
  // ==========================================================

  if (
    rawNext.startsWith(
      '/'
    ) &&
    !rawNext.startsWith(
      '//'
    )
  ) {
    return new URL(
      rawNext,
      requestOrigin
    )
  }

  // ==========================================================
  // URL ABSOLUE
  //
  // Exemple :
  // http://localhost:3000/onboarding?plan=standard
  // ==========================================================

  try {
    const candidate =
      new URL(
        rawNext
      )

    const allowedOrigins =
      new Set<string>()

    allowedOrigins.add(
      requestOrigin
    )

    const configuredSiteUrl =
      process.env
        .NEXT_PUBLIC_SITE_URL

    if (
      configuredSiteUrl
    ) {
      try {
        allowedOrigins.add(
          new URL(
            configuredSiteUrl
          ).origin
        )
      } catch {
        // Configuration invalide :
        // on ne l'ajoute simplement pas.
      }
    }

    if (
      allowedOrigins.has(
        candidate.origin
      )
    ) {
      return candidate
    }
  } catch {
    // URL invalide :
    // on utilise le fallback.
  }

  return fallback
}