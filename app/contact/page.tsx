import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import {
  Building2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact | EWUKAI',
  description:
    'Contactez EWUKAI pour le support, les partenariats et les questions relatives aux données personnelles.',
}

const CONTACT = {
  email: 'adonarthur@gmail.com',
  privacyEmail: 'adonarthur@gmail.com',
  phone: '+225 07 08 18 25 90',
  address: "Côte d'Ivoire, Abidjan-Cocody",
  legalName: 'EWUKAI',
}

export default function ContactPage() {
  const hasEmail =
    CONTACT.email.trim().length > 0

  const hasPrivacyEmail =
    CONTACT.privacyEmail.trim().length > 0

  const hasPhone =
    CONTACT.phone.trim().length > 0

  const hasAddress =
    CONTACT.address.trim().length > 0

  const hasLegalName =
    CONTACT.legalName.trim().length > 0

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
              <Image
                src="/branding/ewukai-mark.png"
                alt="EWUKAI"
                width={44}
                height={44}
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <p className="font-black">
                EWUKAI
              </p>

              <p className="text-xs text-slate-500">
                La plateforme de gestion des organisations
              </p>
            </div>
          </Link>

          <Link
            href="/about"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            À propos
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Contact
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight">
            Comment pouvons-nous vous aider ?
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            Support technique, question sur votre organisation,
            partenariat ou protection des données : utilisez les
            coordonnées officielles ci-dessous.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <ContactCard
            icon={<Mail className="h-6 w-6" />}
            title="Support général"
            value={
              hasEmail
                ? CONTACT.email
                : 'Adresse e-mail officielle à renseigner avant la mise en production.'
            }
            href={
              hasEmail
                ? `mailto:${CONTACT.email}`
                : undefined
            }
          />

          <ContactCard
            icon={
              <ShieldCheck className="h-6 w-6" />
            }
            title="Données personnelles"
            value={
              hasPrivacyEmail
                ? CONTACT.privacyEmail
                : hasEmail
                  ? CONTACT.email
                  : 'Adresse de contact confidentialité à renseigner.'
            }
            href={
              hasPrivacyEmail
                ? `mailto:${CONTACT.privacyEmail}`
                : hasEmail
                  ? `mailto:${CONTACT.email}`
                  : undefined
            }
          />

          <ContactCard
            icon={<Phone className="h-6 w-6" />}
            title="Téléphone"
            value={
              hasPhone
                ? CONTACT.phone
                : 'Numéro professionnel à renseigner si vous souhaitez le publier.'
            }
            href={
              hasPhone
                ? `tel:${CONTACT.phone.replace(/\s+/g, '')}`
                : undefined
            }
          />

          <ContactCard
            icon={<MapPin className="h-6 w-6" />}
            title="Adresse"
            value={
              hasAddress
                ? CONTACT.address
                : 'Adresse professionnelle ou siège à renseigner avant publication des mentions légales.'
            }
          />
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Building2 className="h-6 w-6" />
            </span>

            <div>
              <h2 className="text-lg font-black">
                Éditeur de la plateforme
              </h2>

              <p className="mt-2 leading-7 text-slate-600">
                {hasLegalName
                  ? CONTACT.legalName
                  : 'La raison sociale ou l’identité juridique de l’éditeur doit être renseignée avant la mise en production publique.'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-emerald-50 p-7">
          <p className="font-black text-emerald-950">
            Vous êtes membre d’une organisation ?
          </p>

          <p className="mt-2 max-w-3xl leading-7 text-emerald-900">
            Pour une question concernant votre dossier, vos cotisations
            ou une information saisie par votre organisation, contactez
            d’abord le responsable de votre organisation. EWUKAI
            intervient comme plateforme technique pour les
            fonctionnalités mises à disposition.
          </p>
        </div>
      </section>
    </main>
  )
}

function ContactCard({
  icon,
  title,
  value,
  href,
}: {
  icon: React.ReactNode
  title: string
  value: string
  href?: string
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        {icon}
      </span>

      <h2 className="mt-4 font-black">
        {title}
      </h2>

      {href ? (
        <a
          href={href}
          className="mt-2 block break-words text-sm leading-6 text-emerald-700 hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {value}
        </p>
      )}
    </article>
  )
}
