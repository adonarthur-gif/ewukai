import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  ArrowLeft,
  UsersRound,
} from 'lucide-react'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import MembershipSettingsForm from './membership-settings-form'

type MembershipSettings = {
  organization_id?: string
  organization_name?: string
  short_name?: string | null
  public_slug?: string | null
  online_membership_enabled?: boolean
  membership_fee_enabled?: boolean
  membership_fee_amount_xof?: number | string
  payment_timing?: string
  allow_fee_waiver?: boolean
  updated_at?: string | null
}

type MembershipSettingsPageProps = {
  searchParams: Promise<{
    saved?: string
    error?: string
  }>
}

export default async function MembershipSettingsPage({
  searchParams,
}: MembershipSettingsPageProps) {
  const params =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    role ===
    'member'
  ) {
    redirect(
      '/my-space'
    )
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_organization_membership_settings',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (
    error
  ) {
    console.error(
      'EWUKAI - membership settings page:',
      error
    )

    throw new Error(
      'Impossible de charger la configuration des adhésions.'
    )
  }

  const settings =
    (
      data &&
      typeof data ===
        'object' &&
      !Array.isArray(
        data
      )
        ? data
        : {}
    ) as MembershipSettings

  const feeAmount =
    Number(
      settings
        .membership_fee_amount_xof ??
      0
    )

  const normalizedFeeAmount =
    Number.isFinite(
      feeAmount
    )
      ? Math.max(
          0,
          Math.trunc(
            feeAmount
          )
        )
      : 0

  const publicBaseUrl =
    (
      process.env
        .NEXT_PUBLIC_SITE_URL ??
      ''
    )
      .trim()
      .replace(
        /\/$/,
        ''
      )

  const canEdit =
    [
      'owner',
      'president',
    ].includes(
      role
    )

  return (
    <main className="min-h-screen bg-slate-50">

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8">

          <Link
            href="/parametres"
            className="inline-flex items-center gap-2 text-sm font-black text-slate-600 transition hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux paramètres
          </Link>

          <div className="mt-5 flex items-start gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <UsersRound className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Adhésions
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                Configuration des adhésions
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Gérez le formulaire public, le droit d&apos;adhésion
                et le lien à partager avec les futurs membres.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {params.saved ===
          '1' && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
            Configuration des adhésions enregistrée.
          </div>
        )}

        {params.error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">
            {errorMessage(
              params.error
            )}
          </div>
        )}

        <MembershipSettingsForm
          canEdit={
            canEdit
          }
          initialOnlineMembershipEnabled={
            settings
              .online_membership_enabled ===
            true
          }
          initialFeeEnabled={
            settings
              .membership_fee_enabled ===
            true
          }
          initialFeeAmountXof={
            normalizedFeeAmount
          }
          initialAllowFeeWaiver={
            settings
              .allow_fee_waiver !==
            false
          }
          publicSlug={
            typeof settings
              .public_slug ===
              'string'
              ? settings
                  .public_slug
                  .trim() ||
                null
              : null
          }
          publicBaseUrl={
            publicBaseUrl
          }
        />
      </div>
    </main>
  )
}

function errorMessage(
  value: string
) {
  switch (
    value
  ) {
    case 'forbidden':
      return 'Vous ne disposez pas des droits nécessaires pour modifier cette configuration.'

    case 'invalid-amount':
      return 'Le montant du droit d’adhésion doit être un nombre entier supérieur à zéro.'

    case 'server':
      return 'La configuration n’a pas pu être enregistrée. Réessayez.'

    default:
      return 'Une erreur est survenue.'
  }
}
