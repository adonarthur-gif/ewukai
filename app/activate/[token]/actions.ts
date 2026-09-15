'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { hashMemberAccessToken } from '@/lib/security/member-access-token'

// ============================================================
// EWUKAI
// ACTIVATION DE L'ESPACE MEMBRE
// ============================================================

const tokenSchema =
  z.string()
    .trim()
    .min(20)
    .max(500)

const accountSchema =
  z.object({
    token:
      tokenSchema,

    email:
      z.string()
        .trim()
        .email(),

    password:
      z.string()
        .min(8)
        .max(100),
  })

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createClient
    >
  >

// ============================================================
// RATTACHER LE COMPTE AUTHENTIFIE AU MEMBRE
//
// IMPORTANT :
// on réutilise le MÊME client Supabase que celui
// qui vient d'effectuer le signIn ou le signUp.
// ============================================================

async function claimAccess(
  supabase: SupabaseServerClient,
  token: string
) {
  const tokenHash =
    hashMemberAccessToken(
      token
    )

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'claim_member_access',
      {
        target_token_hash:
          tokenHash,
      }
    )

  if (error) {
    console.error(
      'EWUKAI - claim member access:',
      error
    )

    return {
      success: false as const,
      error,
      data: null,
    }
  }

  return {
    success: true as const,
    error: null,
    data:
      data?.[0] ??
      null,
  }
}

// ============================================================
// 1. UTILISATEUR AYANT DEJA UN COMPTE
// ============================================================

export async function signInAndActivate(
  formData: FormData
) {
  const parsed =
    accountSchema.safeParse({
      token:
        formData.get(
          'token'
        ),

      email:
        formData.get(
          'email'
        ),

      password:
        formData.get(
          'password'
        ),
    })

  if (!parsed.success) {
    const token =
      String(
        formData.get(
          'token'
        ) ?? ''
      )

    redirect(
      `/activate/${encodeURIComponent(
        token
      )}?error=invalid`
    )
  }

  const {
    token,
    email,
    password,
  } =
    parsed.data

  const supabase =
    await createClient()

  // ----------------------------------------------------------
  // CONNEXION
  // ----------------------------------------------------------

  const {
    error:
      signInError,
  } =
    await supabase.auth
      .signInWithPassword({
        email,
        password,
      })

  if (signInError) {
    console.error(
      'EWUKAI - member sign in:',
      signInError
    )

    redirect(
      `/activate/${token}?error=login`
    )
  }

  // ----------------------------------------------------------
  // RATTACHEMENT
  // ----------------------------------------------------------

  const result =
    await claimAccess(
      supabase,
      token
    )

  if (!result.success) {
    redirect(
      `/activate/${token}?error=claim`
    )
  }

  // ----------------------------------------------------------
  // SUCCES
  // ----------------------------------------------------------

  redirect(
    '/my-space?activated=1'
  )
}

// ============================================================
// 2. CREER UN NOUVEAU COMPTE
// ============================================================

export async function registerAndActivate(
  formData: FormData
) {
  const parsed =
    accountSchema.safeParse({
      token:
        formData.get(
          'token'
        ),

      email:
        formData.get(
          'email'
        ),

      password:
        formData.get(
          'password'
        ),
    })

  if (!parsed.success) {
    const token =
      String(
        formData.get(
          'token'
        ) ?? ''
      )

    redirect(
      `/activate/${encodeURIComponent(
        token
      )}?error=invalid`
    )
  }

  const {
    token,
    email,
    password,
  } =
    parsed.data

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

  const nextPath =
    `/activate/${token}`

  // ----------------------------------------------------------
  // CREER LE COMPTE
  // ----------------------------------------------------------

  const {
    data,
    error:
      signUpError,
  } =
    await supabase.auth
      .signUp({
        email,
        password,

        options: {
          emailRedirectTo:
            `${siteUrl}/confirm?next=${encodeURIComponent(
              nextPath
            )}`,
        },
      })

  if (signUpError) {
    console.error(
      'EWUKAI - register member:',
      signUpError
    )

    redirect(
      `/activate/${token}?error=register`
    )
  }

  // ==========================================================
  // CAS 1
  // SUPABASE NOUS DONNE DEJA UNE SESSION
  //
  // On utilise le MEME client Supabase.
  // ==========================================================

  if (data.session) {
    const result =
      await claimAccess(
        supabase,
        token
      )

    if (!result.success) {
      redirect(
        `/activate/${token}?error=claim`
      )
    }

    redirect(
      '/my-space?activated=1'
    )
  }

  // ==========================================================
  // CAS 2
  // CONFIRMATION EMAIL NECESSAIRE
  // ==========================================================

  redirect(
    `/activate/${token}?sent=1`
  )
}

// ============================================================
// 3. UTILISATEUR DEJA CONNECTE
//
// C'est précisément le cas que nous voyons actuellement
// avec Kamron.
// ============================================================

export async function activateCurrentAccount(
  formData: FormData
) {
  const parsed =
    tokenSchema.safeParse(
      formData.get(
        'token'
      )
    )

  if (!parsed.success) {
    redirect('/login')
  }

  const token =
    parsed.data

  const supabase =
    await createClient()

  // ----------------------------------------------------------
  // VERIFIER LA SESSION
  // ----------------------------------------------------------

  const {
    data: authData,
    error: authError,
  } =
    await supabase.auth
      .getClaims()

  const userId =
    authData?.claims?.sub

  if (
    authError ||
    !userId
  ) {
    redirect(
      `/activate/${token}?error=session`
    )
  }

  // ----------------------------------------------------------
  // RATTACHER
  // ----------------------------------------------------------

  const result =
    await claimAccess(
      supabase,
      token
    )

  if (!result.success) {
    redirect(
      `/activate/${token}?error=claim`
    )
  }

  // ----------------------------------------------------------
  // SUCCES
  // ----------------------------------------------------------

  redirect(
    '/my-space?activated=1'
  )
}