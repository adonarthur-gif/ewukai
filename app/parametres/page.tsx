import type { ReactNode } from 'react'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

import { updateOrganization } from './actions'
import BrandingForm from './branding-form'

// ============================================================
// PARAMETRES DE LA MUTUELLE
// ============================================================

type ParametresPageProps = {
  searchParams: Promise<{
    success?: string
    error?: string
    brandingSuccess?: string
    brandingError?: string
  }>
}

// ============================================================
// PAGE
// ============================================================

export default async function ParametresPage({
  searchParams,
}: ParametresPageProps) {
  const query = await searchParams

  const {
    supabase,
    organizationId,
    role,
  } = await requireCurrentOrganization()

  // ==========================================================
  // AUTORISATION
  // ==========================================================

  if (
    ![
      'owner',
      'president',
    ].includes(role)
  ) {
    redirect('/dashboard')
  }

  // ==========================================================
  // ORGANISATION
  // ==========================================================

  const {
    data: organization,
    error: organizationError,
  } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      short_name,
      public_slug,
      public_page_enabled,
      online_membership_enabled
    `)
    .eq(
      'id',
      organizationId
    )
    .maybeSingle()

  if (
    organizationError ||
    !organization
  ) {
    console.error(
      'PARAMETRES - organization:',
      organizationError
    )

    throw new Error(
      'Impossible de charger la mutuelle.'
    )
  }

  // ==========================================================
  // PROFIL
  // ==========================================================

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from(
      'organization_public_profiles'
    )
    .select(`
      organization_id,

      logo_path,
      cover_image_path,

      primary_color,
      secondary_color,
      accent_color,

      slogan,
      short_description,

      about,
      history,

      mission,
      vision,

      values_text,
      objectives,

      president_message,

      public_phone,
      public_email,
      location_label,

      show_member_count,
      show_leadership,
      show_projects,
      show_news
    `)
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (profileError) {
    console.error(
      'PARAMETRES - profile:',
      profileError
    )
  }
  // ==========================================================
  // COULEURS
  // ==========================================================

  const primaryColor =
    safeColor(
      profile?.primary_color,
      '#047857'
    )

  const secondaryColor =
    safeColor(
      profile?.secondary_color,
      '#0F172A'
    )

  const accentColor =
    safeColor(
      profile?.accent_color,
      '#ECFDF5'
    )

  // ==========================================================
  // LOGO
  // ==========================================================

  const logoUrl =
    profile?.logo_path
      ? supabase.storage
          .from(
            'organization-branding'
          )
          .getPublicUrl(
            profile.logo_path
          )
          .data.publicUrl
      : null

  const organizationLabel =
    organization.short_name ||
    organization.name

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{
                color:
                  primaryColor,
              }}
            >
              Paramètres de la mutuelle
            </p>

            <h1 className="mt-2 text-3xl font-black text-slate-900">
              Paramètres
            </h1>

            <p className="mt-2 max-w-3xl leading-7 text-slate-600">
              Personnalisez
              l&apos;identité de votre
              mutuelle, ses informations,
              ses moyens de paiement,
              sa communication et sa
              présence en ligne.
            </p>

          </div>

          {organization.public_page_enabled &&
            organization.public_slug && (
              <Link
                href={`/m/${organization.public_slug}`}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Voir la page publique
              </Link>
            )}

        </div>

        {/* ================================================== */}
        {/* MESSAGES */}
        {/* ================================================== */}

        {query.success ===
          '1' && (
          <SuccessMessage
            title="Modifications enregistrées"
            description="Les informations de la mutuelle ont été mises à jour."
          />
        )}

        {query.error && (
          <ErrorMessage
            title="Impossible d’enregistrer les modifications"
            description={
              query.error
            }
          />
        )}

        {query.brandingSuccess ===
          '1' && (
          <SuccessMessage
            title="Identité visuelle enregistrée"
            description="Le logo et les couleurs de la mutuelle ont été mis à jour."
          />
        )}

        {query.brandingError && (
          <ErrorMessage
            title="Impossible d’enregistrer l’identité visuelle"
            description={
              query.brandingError
            }
          />
        )}

        {/* ================================================== */}
        {/* IDENTITE MUTUELLE */}
        {/* ================================================== */}

        <section
          className="mt-7 overflow-hidden rounded-3xl p-6 text-white shadow-sm sm:p-8"
          style={{
            backgroundColor:
              secondaryColor,
          }}
        >

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

            {/* ============================================== */}
            {/* LOGO */}
            {/* ============================================== */}

            {logoUrl ? (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white p-2 shadow-lg">

                <img
                  src={logoUrl}
                  alt={`Logo ${organizationLabel}`}
                  className="h-full w-full object-contain"
                />

              </div>
            ) : (
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl text-2xl font-black text-white shadow-lg"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                {getInitials(
                  organizationLabel
                )}
              </div>
            )}

            {/* ============================================== */}
            {/* MUTUELLE */}
            {/* ============================================== */}

            <div className="min-w-0">

              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">
                Mutuelle
              </p>

              <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                {organizationLabel}
              </h2>

              {organization.short_name && (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70 sm:text-base">
                  {organization.name}
                </p>
              )}

              {profile?.slogan && (
                <p className="mt-4 font-semibold italic text-white/90">
                  « {profile.slogan} »
                </p>
              )}

            </div>

          </div>

        </section>


        {/* ================================================== */}
        {/* ABONNEMENT EWUKAI */}
        {/* ================================================== */}

        <section className="mt-7 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm sm:p-8">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p
                className="text-xs font-black uppercase tracking-[0.16em]"
                style={{
                  color:
                    primaryColor,
                }}
              >
                ABONNEMENT
              </p>

              <h2 className="mt-2 text-xl font-black text-slate-950">
                Votre formule EWUKAI
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Consultez votre formule actuelle, le nombre de membres actifs,
                la formule recommandée et gérez votre abonnement EWUKAI.
              </p>

              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                Cet abonnement concerne l’utilisation de la plateforme EWUKAI.
                Il est distinct des moyens de paiement utilisés par la mutuelle
                pour recevoir les cotisations de ses membres.
              </p>

            </div>

            <Link
              href="/parametres/abonnement"
              className="inline-flex shrink-0 items-center justify-center rounded-xl px-5 py-3 text-sm font-black text-white shadow-sm transition hover:opacity-90"
              style={{
                backgroundColor:
                  primaryColor,
              }}
            >
              Gérer mon abonnement →
            </Link>

          </div>

        </section>

        {/* ================================================== */}
        {/* IDENTITE VISUELLE */}
        {/* ================================================== */}

        <div className="mt-7">

          <BrandingForm
            organizationName={
              organization.name
            }
            organizationShortName={
              organization.short_name
            }
            logoUrl={
              logoUrl
            }
            primaryColor={
              primaryColor
            }
            secondaryColor={
              secondaryColor
            }
            accentColor={
              accentColor
            }
          />

        </div>

        {/* ================================================== */}
        {/* MOYENS DE PAIEMENT */}
        {/* ================================================== */}

        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

          <p
            className="text-xs font-black uppercase tracking-[0.16em]"
            style={{
              color:
                primaryColor,
            }}
          >
            PAIEMENTS
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900">
            Moyens de paiement
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Configurez les comptes que la
            mutuelle utilise pour recevoir
            les cotisations et autres
            paiements de ses membres.
          </p>

          <Link
            href="/parametres/paiements"
            className="mt-6 block rounded-2xl border border-slate-200 bg-slate-50 p-6 transition hover:bg-white"
            style={{
              borderColor:
                `${primaryColor}33`,
            }}
          >

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-lg font-black text-slate-900">
                  Configurer les moyens de paiement
                </p>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Wave, Orange Money,
                  MTN MoMo, Moov Money,
                  comptes bancaires,
                  espèces ou autres
                  moyens de réception.
                </p>

              </div>

              <div
                className="shrink-0 rounded-xl px-5 py-3 text-sm font-black text-white"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                Configurer →
              </div>

            </div>

          </Link>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">

            <p className="font-black text-amber-900">
              Sécurité des comptes
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              Ne renseignez jamais de code PIN, mot de passe ou code OTP dans cet espace.</p>

          </div>

        </section>

        {/* ================================================== */}
        {/* FORMULAIRE PRINCIPAL */}
        {/* ================================================== */}

        <form
          action={updateOrganization}
          className="mt-7 space-y-7"
        >

          {/* ================================================ */}
          {/* IDENTITE */}
          {/* ================================================ */}

          <Section
            eyebrow="IDENTITÉ"
            title="Informations générales"
            description="Ces informations constituent l’identité officielle de la mutuelle."
            primaryColor={
              primaryColor
            }
          >

            <div className="grid gap-5 sm:grid-cols-2">

              <div className="sm:col-span-2">

                <Field
                  label="Nom de la mutuelle"
                  name="name"
                  defaultValue={
                    organization.name
                  }
                  required
                />

              </div>

              <Field
                label="Sigle"
                name="shortName"
                defaultValue={
                  organization.short_name ??
                  ''
                }
                placeholder="Ex. MUDEDA"
              />

              <Field
                label="Localisation"
                name="locationLabel"
                defaultValue={
                  profile?.location_label ??
                  ''
                }
                placeholder="Ex. Dabou, Côte d'Ivoire"
              />

              <Field
                label="Téléphone public"
                name="publicPhone"
                type="tel"
                defaultValue={
                  profile?.public_phone ??
                  ''
                }
                placeholder="+225 ..."
              />

              <Field
                label="Email public"
                name="publicEmail"
                type="email"
                defaultValue={
                  profile?.public_email ??
                  ''
                }
                placeholder="contact@mutuelle.ci"
              />

            </div>

          </Section>

          {/* ================================================ */}
          {/* PRESENTATION */}
          {/* ================================================ */}

          <Section
            eyebrow="PRÉSENTATION"
            title="Présentation de la mutuelle"
            description="Ces informations pourront être présentées sur la page publique de la mutuelle."
            primaryColor={
              primaryColor
            }
          >

            <Field
              label="Slogan"
              name="slogan"
              defaultValue={
                profile?.slogan ??
                ''
              }
              placeholder="Ex. Ensemble pour le développement et la solidarité."
            />

            <TextArea
              label="Description courte"
              name="shortDescription"
              defaultValue={
                profile?.short_description ??
                ''
              }
              rows={3}
              placeholder="Présentez la mutuelle en quelques phrases."
            />

            <TextArea
              label="Présentation générale"
              name="about"
              defaultValue={
                profile?.about ??
                ''
              }
              rows={6}
              placeholder="Présentez la mutuelle, son rôle et ses principales activités."
            />

            <TextArea
              label="Historique"
              name="history"
              defaultValue={
                profile?.history ??
                ''
              }
              rows={6}
              placeholder="Présentez la création de la mutuelle et ses principales étapes."
            />

          </Section>

          {/* ================================================ */}
          {/* ORIENTATION */}
          {/* ================================================ */}

          <Section
            eyebrow="ORIENTATION"
            title="Objectifs, mission et vision"
            description="Définissez les grandes orientations et ambitions de votre mutuelle."
            primaryColor={
              primaryColor
            }
          >

            <TextArea
              label="Objectifs"
              name="objectives"
              defaultValue={
                profile?.objectives ??
                ''
              }
              rows={8}
              placeholder={`Exemple :

• Renforcer la solidarité entre les membres.
• Organiser l'entraide.
• Soutenir les membres en difficulté.
• Financer des projets communautaires.
• Promouvoir le développement local.`}
            />

            <div className="grid gap-5 lg:grid-cols-2">

              <TextArea
                label="Mission"
                name="mission"
                defaultValue={
                  profile?.mission ??
                  ''
                }
                rows={6}
                placeholder="Quelle est la mission principale de la mutuelle ?"
              />

              <TextArea
                label="Vision"
                name="vision"
                defaultValue={
                  profile?.vision ??
                  ''
                }
                rows={6}
                placeholder="Quelle est l’ambition à long terme de la mutuelle ?"
              />

            </div>

            <TextArea
              label="Valeurs"
              name="valuesText"
              defaultValue={
                profile?.values_text ??
                ''
              }
              rows={6}
              placeholder={`Solidarité
Entraide
Transparence
Responsabilité
Engagement`}
            />

          </Section>

          {/* ================================================ */}
          {/* COMMUNICATION */}
          {/* ================================================ */}

          <Section
            eyebrow="COMMUNICATION"
            title="Communication institutionnelle"
            description="Préparez les communications qui pourront être présentées aux membres et aux visiteurs."
            primaryColor={
              primaryColor
            }
          >

            <div
              className="rounded-2xl border p-5"
              style={{
                borderColor:
                  `${primaryColor}33`,

                backgroundColor:
                  accentColor,
              }}
            >

              <p
                className="font-black"
                style={{
                  color:
                    primaryColor,
                }}
              >
                Mot du Président
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Les vœux de nouvel an,
                fêtes, anniversaires de la
                mutuelle, assemblées
                générales et autres
                solennités pourront être
                publiés dans cet espace.
              </p>

              <p className="mt-3 text-xs font-semibold text-slate-500">
                Les messages datés et
                archivés seront gérés
                prochainement dans un
                module de communication
                dédié.
              </p>

            </div>

            <TextArea
              label="Message permanent du Président"
              name="presidentMessage"
              defaultValue={
                profile?.president_message ??
                ''
              }
              rows={6}
              placeholder="Saisissez ici un éventuel message institutionnel permanent."
            />

          </Section>

          {/* ================================================ */}
          {/* VITRINE PUBLIQUE */}
          {/* ================================================ */}

          <Section
            eyebrow="VITRINE PUBLIQUE"
            title="Présence en ligne"
            description="Définissez comment la mutuelle est présentée aux visiteurs et aux futurs adhérents."
            primaryColor={
              primaryColor
            }
          >

            <Field
              label="Adresse publique"
              name="publicSlug"
              defaultValue={
                organization.public_slug ??
                ''
              }
              placeholder="mudeda"
            />

            {organization.public_slug && (
              <div className="rounded-2xl bg-slate-50 p-5">

                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Adresse de la mutuelle
                </p>

                <p className="mt-1 font-black text-slate-900">
                  /m/{organization.public_slug}
                </p>

              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">

              <CheckBox
                name="publicPageEnabled"
                label="Activer la page publique"
                description="Les visiteurs pourront découvrir la mutuelle."
                defaultChecked={
                  organization.public_page_enabled
                }
              />

              <CheckBox
                name="onlineMembershipEnabled"
                label="Activer l’adhésion en ligne"
                description="Les visiteurs pourront déposer une demande d’adhésion."
                defaultChecked={
                  organization.online_membership_enabled
                }
              />

              <CheckBox
                name="showMemberCount"
                label="Afficher le nombre de membres"
                description="Afficher publiquement le nombre de membres actifs."
                defaultChecked={
                  profile?.show_member_count ??
                  false
                }
              />

              <CheckBox
                name="showLeadership"
                label="Informations institutionnelles"
                description="Réserve la possibilité d’afficher ultérieurement certaines informations institutionnelles."
                defaultChecked={
                  profile?.show_leadership ??
                  false
                }
              />

              <CheckBox
                name="showProjects"
                label="Afficher les projets"
                description="Activer la future rubrique consacrée aux projets de la mutuelle."
                defaultChecked={
                  profile?.show_projects ??
                  false
                }
              />

              <CheckBox
                name="showNews"
                label="Afficher les actualités"
                description="Activer la future rubrique actualités et communications."
                defaultChecked={
                  profile?.show_news ??
                  false
                }
              />

            </div>

          </Section>

          {/* ================================================ */}
          {/* ENREGISTRER */}
          {/* ================================================ */}

          <div className="sticky bottom-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="font-black text-slate-900">
                  Paramètres de la mutuelle
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Enregistrez les
                  modifications avant de
                  quitter la page.
                </p>

              </div>

              <button
                type="submit"
                className="rounded-xl px-7 py-3 font-black text-white shadow-sm transition hover:opacity-90"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                Enregistrer les modifications
              </button>

            </div>

          </div>

        </form>

      </div>

    </main>
  )
}

// ============================================================
// SECTION
// ============================================================

function Section({
  eyebrow,
  title,
  description,
  primaryColor,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  primaryColor: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

      <p
        className="text-xs font-black uppercase tracking-[0.16em]"
        style={{
          color:
            primaryColor,
        }}
      >
        {eyebrow}
      </p>

      <h2 className="mt-1 text-xl font-black text-slate-900">
        {title}
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        {description}
      </p>

      <div className="mt-6 space-y-5">
        {children}
      </div>

    </section>
  )
}

// ============================================================
// FIELD
// ============================================================

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  placeholder,
  required = false,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-slate-700"
      >

        {label}

        {required && (
          <span className="text-red-600">
            {' '}*
          </span>
        )}

      </label>

      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={
          defaultValue
        }
        placeholder={
          placeholder
        }
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />

    </div>
  )
}

// ============================================================
// TEXTAREA
// ============================================================

function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
  rows = 5,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  rows?: number
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-slate-700"
      >
        {label}
      </label>

      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={
          defaultValue
        }
        placeholder={
          placeholder
        }
        className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 leading-7 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />

    </div>
  )
}

// ============================================================
// CHECKBOX
// ============================================================

function CheckBox({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string
  label: string
  description: string
  defaultChecked: boolean
}) {
  return (
    <label className="flex cursor-pointer gap-4 rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:bg-slate-50">

      <input
        type="checkbox"
        name={name}
        defaultChecked={
          defaultChecked
        }
        className="mt-1 h-5 w-5 shrink-0"
      />

      <span>

        <span className="block font-black text-slate-900">
          {label}
        </span>

        <span className="mt-1 block text-sm leading-6 text-slate-500">
          {description}
        </span>

      </span>

    </label>
  )
}

// ============================================================
// MESSAGE SUCCES
// ============================================================

function SuccessMessage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

      <p className="font-black text-emerald-900">
        ✓ {title}
      </p>

      <p className="mt-1 text-sm text-emerald-800">
        {description}
      </p>

    </div>
  )
}

// ============================================================
// MESSAGE ERREUR
// ============================================================

function ErrorMessage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">

      <p className="font-black text-red-800">
        {title}
      </p>

      <p className="mt-1 text-sm text-red-700">
        {description}
      </p>

    </div>
  )
}

// ============================================================
// INITIALES
// ============================================================

function getInitials(
  value: string
) {
  const words =
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)

  if (words.length === 0) {
    return 'MU'
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return words
    .slice(0, 2)
    .map((word) =>
      word.charAt(0)
    )
    .join('')
    .toUpperCase()
}

// ============================================================
// COULEUR SECURISEE
// ============================================================

function safeColor(
  value: string | null | undefined,
  fallback: string
) {
  if (
    value &&
    /^#[0-9A-Fa-f]{6}$/.test(
      value
    )
  ) {
    return value
  }

  return fallback
}