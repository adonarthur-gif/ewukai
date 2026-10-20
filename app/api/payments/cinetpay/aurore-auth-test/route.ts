import {
  NextResponse,
} from 'next/server'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  CinetPayAuroreApiError,
  getCinetPayAuroreAccessToken,
} from '@/lib/payments/cinetpay-aurore'

import {
  getOrganizationCinetPayAuroreConfig,
} from '@/lib/payments/organization-cinetpay'

// ============================================================
// EWUKAI
// TEST AUTHENTIFICATION CINETPAY AURORE
//
// Aucun identifiant sensible ni access_token n'est renvoyé.
// ============================================================

export const runtime =
  'nodejs'

export const dynamic =
  'force-dynamic'

const ALLOWED_ROLES =
  new Set([
    'owner',
    'president',
    'treasurer',
    'auditor',
  ])

// ============================================================
// GET
// ============================================================

export async function GET() {
  const {
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    !ALLOWED_ROLES.has(
      role
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'forbidden',
      },
      {
        status: 403,
      }
    )
  }

  try {
    // ========================================================
    // CHARGER ET DECHIFFRER LES IDENTIFIANTS COTE SERVEUR
    // ========================================================

    const credentials =
      await getOrganizationCinetPayAuroreConfig(
        organizationId
      )

    // ========================================================
    // SECURITE :
    // CE TEST EST RESERVE AU SANDBOX
    // ========================================================

    if (
      credentials.environment !==
      'sandbox'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'production_test_disabled',
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // APPEL REEL A CINETPAY
    // POST /v1/oauth/login
    // ========================================================

    const authentication =
      await getCinetPayAuroreAccessToken(
        credentials
      )

    // ========================================================
    // NE JAMAIS RENVOYER accessToken AU NAVIGATEUR
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        provider:
          'cinetpay',

        api:
          'aurore',

        environment:
          credentials.environment,

        authenticated:
          true,

        token_type:
          authentication.tokenType,

        expires_in:
          authentication.expiresIn,
      },
      {
        status: 200,

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  } catch (error) {
    if (
      error instanceof
      CinetPayAuroreApiError
    ) {
      console.error(
        'EWUKAI - CINETPAY AURORE AUTH TEST:',
        {
          code:
            error.code,

          message:
            error.message,
        }
      )

      return NextResponse.json(
        {
          ok: false,

          authenticated:
            false,

          provider:
            'cinetpay',

          error:
            'cinetpay_authentication_failed',

          code:
            error.code,
        },
        {
          status: 502,
        }
      )
    }

    console.error(
      'EWUKAI - CINETPAY AURORE AUTH TEST:',
      error instanceof Error
        ? error.message
        : 'Unknown error'
    )

    return NextResponse.json(
      {
        ok: false,

        authenticated:
          false,

        error:
          'authentication_test_failed',
      },
      {
        status: 500,
      }
    )
  }
}