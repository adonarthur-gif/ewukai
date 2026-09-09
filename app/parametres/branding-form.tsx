'use client'

import {
  ChangeEvent,
  useState,
} from 'react'

import {
  updateOrganizationBranding,
} from './branding-actions'

type BrandingFormProps = {
  organizationName: string
  organizationShortName?: string | null

  logoUrl?: string | null

  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
}

export default function BrandingForm({
  organizationName,
  organizationShortName,
  logoUrl,
  primaryColor,
  secondaryColor,
  accentColor,
}: BrandingFormProps) {
  const [primary, setPrimary] =
    useState(
      primaryColor || '#047857'
    )

  const [secondary, setSecondary] =
    useState(
      secondaryColor || '#0F172A'
    )

  const [accent, setAccent] =
    useState(
      accentColor || '#ECFDF5'
    )

  const [logoPreview, setLogoPreview] =
    useState<string | null>(
      logoUrl || null
    )

  function handleLogoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    const preview =
      URL.createObjectURL(file)

    setLogoPreview(preview)
  }

  const organizationLabel =
    organizationShortName ||
    organizationName

  return (
    <form
      action={updateOrganizationBranding}
      className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8"
    >

      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        IDENTITÉ VISUELLE
      </p>

      <h2 className="mt-1 text-xl font-black text-slate-900">
        Logo et couleurs
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        Personnalisez l&apos;espace de votre
        mutuelle avec son logo et ses
        couleurs officielles.
      </p>

      {/* =================================================== */}
      {/* LOGO */}
      {/* =================================================== */}

      <div className="mt-7 grid gap-6 lg:grid-cols-[220px_1fr]">

        <div>

          <p className="mb-3 text-sm font-bold text-slate-700">
            Logo actuel
          </p>

          <div
            className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl border"
            style={{
              backgroundColor: accent,
            }}
          >

            {logoPreview ? (
              <img
                src={logoPreview}
                alt={`Logo ${organizationLabel}`}
                className="h-full w-full object-contain p-5"
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-3xl text-3xl font-black text-white"
                style={{
                  backgroundColor:
                    primary,
                }}
              >
                {getInitials(
                  organizationLabel
                )}
              </div>
            )}

          </div>

        </div>

        <div>

          <label
            htmlFor="logo"
            className="mb-2 block text-sm font-bold text-slate-700"
          >
            Importer un nouveau logo
          </label>

          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoChange}
            className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
          />

          <p className="mt-2 text-xs text-slate-500">
            PNG, JPG ou WEBP — maximum 5 Mo.
          </p>

        </div>

      </div>

      {/* =================================================== */}
      {/* COULEURS */}
      {/* =================================================== */}

      <div className="mt-8 grid gap-5 md:grid-cols-3">

        <ColorField
          label="Couleur principale"
          name="primaryColor"
          value={primary}
          onChange={setPrimary}
        />

        <ColorField
          label="Couleur secondaire"
          name="secondaryColor"
          value={secondary}
          onChange={setSecondary}
        />

        <ColorField
          label="Couleur d’accent"
          name="accentColor"
          value={accent}
          onChange={setAccent}
        />

      </div>

      {/* =================================================== */}
      {/* APERCU */}
      {/* =================================================== */}

      <div className="mt-9">

        <p className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">
          Aperçu
        </p>

        <div className="overflow-hidden rounded-3xl border shadow-sm">

          <div
            className="flex items-center gap-4 px-6 py-5"
            style={{
              backgroundColor: accent,
            }}
          >

            {logoPreview ? (
              <img
                src={logoPreview}
                alt=""
                className="h-14 w-14 rounded-2xl bg-white object-contain p-1 shadow-sm"
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white"
                style={{
                  backgroundColor:
                    primary,
                }}
              >
                {getInitials(
                  organizationLabel
                )}
              </div>
            )}

            <div>

              <p
                className="text-xl font-black"
                style={{
                  color: secondary,
                }}
              >
                {organizationLabel}
              </p>

              <p className="text-sm text-slate-500">
                {organizationName}
              </p>

            </div>

          </div>

          <div className="bg-white p-6">

            <div className="flex flex-wrap gap-3">

              <PreviewNavigation
                label="Tableau de bord"
                primary={primary}
                accent={accent}
                active
              />

              <PreviewNavigation
                label="Membres"
                primary={primary}
                accent={accent}
              />

              <PreviewNavigation
                label="Trésorerie"
                primary={primary}
                accent={accent}
              />

              <button
                type="button"
                className="rounded-xl px-5 py-2.5 text-sm font-black text-white"
                style={{
                  backgroundColor:
                    primary,
                }}
              >
                + Nouveau membre
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* =================================================== */}
      {/* SAVE */}
      {/* =================================================== */}

      <div className="mt-8 flex justify-end">

        <button
          type="submit"
          className="rounded-xl px-7 py-3 font-black text-white transition hover:opacity-90"
          style={{
            backgroundColor:
              primary,
          }}
        >
          Enregistrer l&apos;identité visuelle
        </button>

      </div>

    </form>
  )
}

function ColorField({
  label,
  name,
  value,
  onChange,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-slate-700"
      >
        {label}
      </label>

      <div className="flex items-center gap-3">

        <input
          id={name}
          name={name}
          type="color"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="h-12 w-16 cursor-pointer rounded-lg border bg-white p-1"
        />

        <input
          type="text"
          value={value.toUpperCase()}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 font-mono text-sm uppercase"
        />

      </div>

    </div>
  )
}

function PreviewNavigation({
  label,
  primary,
  accent,
  active = false,
}: {
  label: string
  primary: string
  accent: string
  active?: boolean
}) {
  return (
    <div
      className="rounded-xl px-4 py-2.5 text-sm font-bold"
      style={{
        color:
          active
            ? primary
            : '#475569',

        backgroundColor:
          active
            ? accent
            : 'transparent',
      }}
    >
      {label}
    </div>
  )
}

function getInitials(
  value: string
) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) =>
      word.charAt(0)
    )
    .join('')
    .toUpperCase()
}