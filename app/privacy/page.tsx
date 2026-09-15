import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de confidentialité | EWUKAI',
  description:
    'Politique de confidentialité et de protection des données personnelles de la plateforme EWUKAI.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
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
                Protection des données personnelles
              </p>
            </div>
          </Link>

          <Link
            href="/contact"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Contact
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            EWUKAI
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Politique de confidentialité
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Dernière mise à jour : 15 septembre 2026
          </p>

          <div className="mt-10 space-y-9 text-[15px] leading-7 text-slate-700">

            <section>
              <h2 className="text-xl font-black text-slate-950">
                1. Objet
              </h2>

              <p className="mt-3">
                La présente politique explique comment les données
                personnelles peuvent être collectées, utilisées,
                conservées et protégées dans le cadre de
                l’utilisation d’EWUKAI.
              </p>

              <p className="mt-3">
                EWUKAI est une plateforme de gestion destinée aux
                organisations. Selon le traitement concerné,
                l’organisation utilisatrice peut déterminer les
                finalités de traitement de certaines données de ses
                membres, tandis qu’EWUKAI intervient comme
                prestataire technique. Pour les données nécessaires
                au fonctionnement de la plateforme, à la sécurité, à
                l’administration des comptes et à la relation avec
                les utilisateurs, l’éditeur d’EWUKAI peut également
                agir en qualité de responsable du traitement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                2. Données susceptibles d’être traitées
              </h2>

              <p className="mt-3">
                Selon les fonctionnalités utilisées, les catégories
                suivantes peuvent être concernées :
              </p>

              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  données de compte et d’identification : nom, prénom,
                  adresse e-mail, téléphone et identifiant utilisateur ;
                </li>

                <li>
                  données relatives à l’organisation : nom, type, logo,
                  coordonnées, paramètres, responsables et rôles ;
                </li>

                <li>
                  données de membres : matricule, identité, coordonnées,
                  statut d’adhésion et informations administratives
                  nécessaires à la gestion ;
                </li>

                <li>
                  données de cotisation et de gestion financière :
                  montants dus, montants payés, échéances, références,
                  reçus, mouvements et historiques ;
                </li>

                <li>
                  données techniques et de sécurité : journaux
                  techniques, informations de session, adresse IP
                  lorsque celle-ci est enregistrée par
                  l’infrastructure, événements de sécurité et données
                  nécessaires au fonctionnement du service.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                3. Finalités
              </h2>

              <p className="mt-3">
                Les données sont utilisées notamment pour :
              </p>

              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  créer et sécuriser les comptes utilisateurs ;
                </li>

                <li>
                  permettre la gestion des organisations et de leurs
                  membres ;
                </li>

                <li>
                  suivre les cotisations, paiements, reçus et
                  opérations de trésorerie ;
                </li>

                <li>
                  générer des rapports et historiques de gestion ;
                </li>

                <li>
                  assurer la traçabilité, la prévention des abus et la
                  sécurité de la plateforme ;
                </li>

                <li>
                  fournir une assistance technique et traiter les
                  demandes des utilisateurs ;
                </li>

                <li>
                  respecter les obligations légales et réglementaires
                  applicables.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                4. Paiements
              </h2>

              <p className="mt-3">
                Lorsqu’un paiement en ligne est disponible, il est
                traité par le prestataire de paiement configuré pour
                l’organisation concernée. EWUKAI n’a pas vocation à
                conserver les codes secrets Mobile Money, les codes
                PIN ni les données complètes de carte bancaire saisies
                sur l’interface sécurisée du prestataire.
              </p>

              <p className="mt-3">
                EWUKAI peut en revanche conserver les informations
                nécessaires à la gestion et à la traçabilité de
                l’opération, par exemple le montant, la date, le
                statut, la référence de transaction, le moyen de
                paiement et le reçu associé.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                5. Destinataires et prestataires
              </h2>

              <p className="mt-3">
                L’accès aux données est limité aux personnes et
                services qui en ont besoin pour accomplir leurs
                missions. Selon les fonctionnalités utilisées, les
                données peuvent être accessibles :
              </p>

              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  aux responsables autorisés de l’organisation
                  concernée ;
                </li>

                <li>
                  aux utilisateurs concernés dans leur espace
                  personnel ;
                </li>

                <li>
                  aux prestataires techniques d’hébergement, de base
                  de données, d’authentification et de sécurité ;
                </li>

                <li>
                  aux prestataires de paiement utilisés pour traiter
                  les transactions ;
                </li>

                <li>
                  aux autorités compétentes lorsque la loi l’exige.
                </li>
              </ul>

              <p className="mt-3">
                Les prestataires sont choisis en tenant compte des
                garanties de sécurité et de confidentialité adaptées
                aux services fournis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                6. Durée de conservation
              </h2>

              <p className="mt-3">
                Les données sont conservées pendant la durée
                nécessaire à la fourniture du service, au
                fonctionnement de l’organisation, à la sécurité, à la
                résolution des litiges et au respect des obligations
                légales. Lorsque les données ne sont plus nécessaires,
                elles ont vocation à être supprimées, archivées lorsque
                la loi l’impose ou anonymisées lorsque cela est
                approprié.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                7. Sécurité
              </h2>

              <p className="mt-3">
                Des mesures techniques et organisationnelles sont mises
                en œuvre afin de limiter les accès non autorisés, la
                perte, l’altération ou la divulgation illicite des
                données. Cela inclut notamment des mécanismes
                d’authentification, de contrôle d’accès, de
                journalisation et l’utilisation de connexions
                sécurisées lorsque les services sont déployés en
                production.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                8. Cookies et stockage local
              </h2>

              <p className="mt-3">
                EWUKAI peut utiliser des cookies ou mécanismes
                équivalents strictement nécessaires à
                l’authentification, à la session et au fonctionnement
                de la plateforme. Si des outils d’analyse,
                publicitaires ou autres traceurs non essentiels sont
                ajoutés, les informations et mécanismes de
                consentement requis seront mis en place avant leur
                activation lorsqu’ils sont légalement nécessaires.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                9. Vos droits
              </h2>

              <p className="mt-3">
                Sous réserve des conditions prévues par la
                réglementation applicable, vous pouvez notamment
                demander l’accès à vos données, leur rectification,
                leur suppression lorsque celle-ci est possible, ou
                vous opposer à certains traitements.
              </p>

              <p className="mt-3">
                Lorsqu’une demande concerne des données gérées
                directement par votre organisation, celle-ci peut être
                votre premier point de contact. Pour les traitements
                relevant de la plateforme, vous pouvez utiliser les
                coordonnées publiées sur la page Contact.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                10. Transferts et services internationaux
              </h2>

              <p className="mt-3">
                Certains prestataires techniques peuvent exploiter des
                infrastructures situées dans plusieurs pays. Lorsque
                des transferts internationaux de données existent, ils
                doivent être encadrés conformément aux exigences
                applicables en matière de protection des données.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                11. Mise à jour de la politique
              </h2>

              <p className="mt-3">
                Cette politique peut être mise à jour pour tenir compte
                de l’évolution d’EWUKAI, des fonctionnalités, des
                prestataires ou des obligations réglementaires. La
                date de dernière mise à jour est indiquée en haut de
                cette page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">
                12. Contact
              </h2>

              <p className="mt-3">
                Pour toute question relative à la confidentialité ou à
                l’exercice de vos droits, consultez la page Contact
                afin d’utiliser les coordonnées officielles de
                l’éditeur d’EWUKAI.
              </p>

              <Link
                href="/contact"
                className="mt-4 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-black text-white hover:bg-emerald-800"
              >
                Contacter EWUKAI
              </Link>
            </section>

          </div>
        </div>
      </section>
    </main>
  )
}
