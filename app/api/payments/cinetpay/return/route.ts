import {
  NextResponse,
} from 'next/server'

export const dynamic =
  'force-dynamic'

export async function GET(
  request: Request
) {
  return redirectToSubscription(
    request
  )
}

export async function POST(
  request: Request
) {
  return redirectToSubscription(
    request
  )
}

function redirectToSubscription(
  request: Request
) {
  const origin =
    new URL(
      request.url
    ).origin

  const destination =
    new URL(
      '/parametres/abonnement',
      origin
    )

  destination.searchParams.set(
    'payment',
    'returned'
  )

  return NextResponse.redirect(
    destination,
    303
  )
}
