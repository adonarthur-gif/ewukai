'use client'

import {
  ChangeEvent,
  useState,
} from 'react'

type OnboardingBrandingConfiguratorProps = {
  defaultPrimaryColor?: string
  defaultSecondaryColor?: string
  defaultAccentColor?: string
}

export default function OnboardingBrandingConfigurator({
  defaultPrimaryColor = '#047857',
  defaultSecondaryColor = '#0F172A',
  defaultAccentColor = '#ECFDF5',
}: OnboardingBrandingConfiguratorProps) {
  const [
    primary,
    setPrimary,
  ] = useState(
    defaultPrimaryColor
  )

  const [
    secondary,
    setSecondary,
  ] = useState(
    defaultSecondaryColor
  )

  const [
    accent,
    setAccent,
  ] = useState(
    defaultAccentColor
  )

  const [
    logoPreview,
    setLogoPreview,
  ] = useState<string | null>(
    null
  )

  function handleLogoChange(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0]

    if (!file) {
      setLogoPreview(
        null
      )

      return
    }

    const preview =
      URL.createObjectURL(
        file
      )

    setLogoPreview(
      preview
    )
  }

  return (
    <div className="mt-7 space-y-7">

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">

        <div>

          <p className="mb-3 text-sm font-bold text-slate-700">
            Aperçu du logo
          </p>

          <div
            className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-slate-200"
            style={{
              backgroundColor:
                accent,
            }}
          >

            {logoPreview ? (
              <img
                src={
                  logoPreview
                }
                alt="Aperçu du logo"
                className="h-full w-full object-contain p-5"
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-3xl text-2xl font-black text-white"
                style={{
                  backgroundColor:
                    primary,
                }}
              >
                LOGO
              </div>
            )}

          </div>

        </div>

        <div>

          <label
            htmlFor="logo"
            className="mb-2 block text-sm font-bold text-slate-700"
          >
            Logo de l&apos;organisation
          </label>

          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={
              handleLogoChange
            }
            className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
          />

          <p className="mt-2 text-xs leading-5 text-slate-500">
            PNG, JPG ou WEBP,
            maximum 5 Mo. Vous
            pourrez aussi ajouter ou
            remplacer le logo plus tard
            dans Paramètres.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">

            <ColorField
              label="Couleur principale"
              name="primaryColor"
              value={primary}
              onChange={
                setPrimary
              }
            />

            <ColorField
              label="Couleur secondaire"
              name="secondaryColor"
              value={secondary}
              onChange={
                setSecondary
              }
            />

            <ColorField
              label="Couleur d’accent"
              name="accentColor"
              value={accent}
              onChange={
                setAccent
              }
            />

          </div>

        </div>

      </div>

      <div>

        <p className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">
          Aperçu mobile et ordinateur
        </p>

        <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">

          <div className="mx-auto w-full max-w-[330px] rounded-[2.2rem] border-[8px] border-slate-900 bg-white p-2 shadow-xl">

            <div className="overflow-hidden rounded-[1.55rem]">

              <div
                className="px-4 py-4"
                style={{
                  backgroundColor:
                    accent,
                }}
              >

                <div className="flex items-center gap-3">

                  {logoPreview ? (
                    <img
                      src={
                        logoPreview
                      }
                      alt=""
                      className="h-11 w-11 rounded-xl bg-white object-contain p-1 shadow-sm"
                    />
                  ) : (
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-[10px] font-black text-white"
                      style={{
                        backgroundColor:
                          primary,
                      }}
                    >
                      LOGO
                    </div>
                  )}

                  <div className="min-w-0">

                    <p
                      className="truncate text-sm font-black"
                      style={{
                        color:
                          secondary,
                      }}
                    >
                      Votre organisation
                    </p>

                    <p className="text-[10px] text-slate-500">
                      Espace dirigeant
                    </p>

                  </div>

                </div>

              </div>

              <div className="space-y-3 bg-white p-4">

                <div
                  className="rounded-xl px-3 py-2.5 text-xs font-black"
                  style={{
                    backgroundColor:
                      accent,

                    color:
                      primary,
                  }}
                >
                  Tableau de bord
                </div>

                <div className="grid grid-cols-2 gap-2">

                  {[
                    'Membres',
                    'Cotisations',
                    'Trésorerie',
                    'Paramètres',
                  ].map(
                    (
                      label
                    ) => (
                      <div
                        key={
                          label
                        }
                        className="rounded-xl border border-slate-200 px-2 py-3 text-center text-[11px] font-bold text-slate-600"
                      >
                        {
                          label
                        }
                      </div>
                    )
                  )}

                </div>

                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-3 text-xs font-black text-white"
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

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <div
              className="flex items-center gap-4 px-6 py-5"
              style={{
                backgroundColor:
                  accent,
              }}
            >

              {logoPreview ? (
                <img
                  src={
                    logoPreview
                  }
                  alt=""
                  className="h-14 w-14 rounded-2xl bg-white object-contain p-1 shadow-sm"
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-xs font-black text-white"
                  style={{
                    backgroundColor:
                      primary,
                  }}
                >
                  LOGO
                </div>
              )}

              <div>

                <p
                  className="text-xl font-black"
                  style={{
                    color:
                      secondary,
                  }}
                >
                  Votre organisation
                </p>

                <p className="text-sm text-slate-500">
                  Aperçu ordinateur
                </p>

              </div>

            </div>

            <div className="bg-white p-6">

              <div className="flex flex-wrap gap-3">

                <PreviewItem
                  label="Tableau de bord"
                  primary={
                    primary
                  }
                  accent={
                    accent
                  }
                  active
                />

                <PreviewItem
                  label="Membres"
                  primary={
                    primary
                  }
                  accent={
                    accent
                  }
                />

                <PreviewItem
                  label="Trésorerie"
                  primary={
                    primary
                  }
                  accent={
                    accent
                  }
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

      </div>

    </div>
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
  onChange:
    (value: string) =>
      void
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
          value={
            value
          }
          onChange={
            (
              event
            ) =>
              onChange(
                event
                  .target
                  .value
              )
          }
          className="h-12 w-16 cursor-pointer rounded-lg border bg-white p-1"
        />

        <input
          type="text"
          value={
            value
              .toUpperCase()
          }
          onChange={
            (
              event
            ) =>
              onChange(
                event
                  .target
                  .value
              )
          }
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 font-mono text-sm uppercase"
        />

      </div>

    </div>
  )
}

function PreviewItem({
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
