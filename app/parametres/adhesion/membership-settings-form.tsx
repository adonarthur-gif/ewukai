'use client'

import {
  useMemo,
  useState,
} from 'react'

import Link from 'next/link'

import {
  Check,
  Copy,
  ExternalLink,
  Share2,
} from 'lucide-react'

import {
  updateMembershipSettings,
} from './actions'

type MembershipSettingsFormProps = {
  canEdit: boolean

  initialOnlineMembershipEnabled:
    boolean

  initialFeeEnabled:
    boolean

  initialFeeAmountXof:
    number

  initialAllowFeeWaiver:
    boolean

  publicSlug:
    string | null

  publicBaseUrl:
    string
}

export default function MembershipSettingsForm({
  canEdit,
  initialOnlineMembershipEnabled,
  initialFeeEnabled,
  initialFeeAmountXof,
  initialAllowFeeWaiver,
  publicSlug,
  publicBaseUrl,
}: MembershipSettingsFormProps) {
  const [
    onlineMembershipEnabled,
    setOnlineMembershipEnabled,
  ] =
    useState(
      initialOnlineMembershipEnabled
    )

  const [
    feeEnabled,
    setFeeEnabled,
  ] =
    useState(
      initialFeeEnabled
    )

  const [
    copied,
    setCopied,
  ] =
    useState(
      false
    )

  const joinPath =
    publicSlug
      ? `/m/${publicSlug}/join`
      : ''

  const publicPagePath =
    publicSlug
      ? `/m/${publicSlug}`
      : ''

  const joinUrl =
    useMemo(
      () => {
        if (
          !joinPath
        ) {
          return ''
        }

        const base =
          publicBaseUrl
            .replace(
              /\/$/,
              ''
            )

        return base
          ? `${base}${joinPath}`
          : joinPath
      },
      [
        joinPath,
        publicBaseUrl,
      ]
    )

  async function copyJoinLink() {
    if (
      !joinUrl
    ) {
      return
    }

    try {
      await navigator
        .clipboard
        .writeText(
          joinUrl
        )

      setCopied(
        true
      )

      window.setTimeout(
        () => {
          setCopied(
            false
          )
        },
        1800
      )
    } catch {
      setCopied(
        false
      )
    }
  }

  async function shareJoinLink() {
    if (
      !joinUrl
    ) {
      return
    }

    if (
      navigator.share
    ) {
      try {
        await navigator.share({
          title:
            'Lien d’adhésion',
          text:
            'Faire une demande d’adhésion',
          url:
            joinUrl,
        })

        return
      } catch {
        return
      }
    }

    await copyJoinLink()
  }

  return (
    <div className="space-y-6">

      <form
        action={
          updateMembershipSettings
        }
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      >

        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Configuration
          </p>

          <h2 className="mt-2 text-xl font-black text-slate-950">
            Adhésion en ligne
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Définissez si les candidats peuvent envoyer eux-mêmes
            une demande et si un droit d&apos;adhésion est exigé.
          </p>
        </div>

        <div className="space-y-7 p-6">

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              name="onlineMembershipEnabled"
              checked={
                onlineMembershipEnabled
              }
              onChange={
                event =>
                  setOnlineMembershipEnabled(
                    event
                      .target
                      .checked
                  )
              }
              disabled={
                !canEdit
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
            />

            <span>
              <span className="block font-black text-slate-900">
                Autoriser les demandes d&apos;adhésion en ligne
              </span>

              <span className="mt-1 block text-sm leading-6 text-slate-500">
                Le lien public /m/[slug]/join devient utilisable
                par les futurs adhérents.
              </span>
            </span>
          </label>

          <fieldset
            disabled={
              !canEdit
            }
            className="space-y-3"
          >
            <legend className="text-sm font-black text-slate-900">
              Type d&apos;adhésion
            </legend>

            <div className="grid gap-3 sm:grid-cols-2">

              <label className={`rounded-2xl border p-4 transition ${
                !feeEnabled
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="membershipType"
                    value="free"
                    checked={
                      !feeEnabled
                    }
                    onChange={
                      () =>
                        setFeeEnabled(
                          false
                        )
                    }
                    className="mt-1 h-4 w-4 border-slate-300 text-emerald-600"
                  />

                  <span>
                    <span className="block font-black text-slate-900">
                      Gratuite
                    </span>

                    <span className="mt-1 block text-sm leading-6 text-slate-500">
                      Aucun droit d&apos;adhésion n&apos;est demandé.
                    </span>
                  </span>
                </div>
              </label>

              <label className={`rounded-2xl border p-4 transition ${
                feeEnabled
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="membershipType"
                    value="paid"
                    checked={
                      feeEnabled
                    }
                    onChange={
                      () =>
                        setFeeEnabled(
                          true
                        )
                    }
                    className="mt-1 h-4 w-4 border-slate-300 text-emerald-600"
                  />

                  <span>
                    <span className="block font-black text-slate-900">
                      Payante
                    </span>

                    <span className="mt-1 block text-sm leading-6 text-slate-500">
                      Le bureau fixe le montant du droit d&apos;adhésion.
                    </span>
                  </span>
                </div>
              </label>
            </div>
          </fieldset>

          {feeEnabled && (
            <div>
              <label
                htmlFor="membershipFeeAmountXof"
                className="block text-sm font-black text-slate-900"
              >
                Montant du droit d&apos;adhésion
              </label>

              <div className="mt-2 flex max-w-md overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                <input
                  id="membershipFeeAmountXof"
                  name="membershipFeeAmountXof"
                  type="number"
                  min="1"
                  step="1"
                  required
                  defaultValue={
                    initialFeeAmountXof >
                    0
                      ? initialFeeAmountXof
                      : 5000
                  }
                  disabled={
                    !canEdit
                  }
                  className="min-w-0 flex-1 border-0 px-4 py-3 font-black text-slate-950 outline-none"
                />

                <span className="flex items-center border-l border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-600">
                  FCFA
                </span>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Le candidat ne paiera qu&apos;après l&apos;approbation
                de sa demande par le bureau.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <input
              type="checkbox"
              name="allowFeeWaiver"
              defaultChecked={
                initialAllowFeeWaiver
              }
              disabled={
                !canEdit
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
            />

            <span>
              <span className="block font-black text-slate-900">
                Autoriser une exonération exceptionnelle
              </span>

              <span className="mt-1 block text-sm leading-6 text-slate-500">
                Le responsable ou le président pourra exceptionnellement
                dispenser un candidat du droit d&apos;adhésion.
              </span>
            </span>
          </label>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-black text-blue-950">
              Paiement après validation
            </p>

            <p className="mt-1 text-sm leading-6 text-blue-800">
              Pour une adhésion payante, aucun paiement ne sera demandé
              lors du dépôt du formulaire. Le paiement sera déclenché
              seulement après acceptation par le bureau.
            </p>
          </div>

          {canEdit ? (
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
            >
              Enregistrer la configuration
            </button>
          ) : (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">
              Seuls le responsable et le président peuvent modifier
              cette configuration.
            </p>
          )}
        </div>
      </form>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Partage
          </p>

          <h2 className="mt-2 text-xl font-black text-slate-950">
            Lien d&apos;adhésion
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Envoyez ce lien par WhatsApp, SMS, e-mail ou réseaux sociaux.
          </p>
        </div>

        <div className="p-6">

          {!publicSlug ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-black text-amber-950">
                Aucun lien public disponible
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Configurez d&apos;abord le slug public de l&apos;organisation.
              </p>
            </div>
          ) : (
            <>
              <div className="break-all rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-700">
                {joinUrl}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={
                    copyJoinLink
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}

                  {copied
                    ? 'Lien copié'
                    : 'Copier le lien'}
                </button>

                <button
                  type="button"
                  onClick={
                    shareJoinLink
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <Share2 className="h-4 w-4" />
                  Partager
                </button>

                <Link
                  href={
                    joinPath
                  }
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir le formulaire
                </Link>

                <Link
                  href={
                    publicPagePath
                  }
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir la vitrine
                </Link>
              </div>

              {!onlineMembershipEnabled && (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                  Le lien existe, mais les demandes d&apos;adhésion en ligne
                  sont actuellement désactivées.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
