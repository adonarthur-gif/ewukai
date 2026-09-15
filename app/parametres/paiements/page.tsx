import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  createPaymentMethod,
  deletePaymentMethod,
  togglePaymentMethod,
} from './actions'

// ============================================================
// EWUKAI
// PARAMETRES DES MOYENS DE PAIEMENT
//
// Cette page gère deux choses distinctes :
//
// 1. Les coordonnées de paiement de la mutuelle
//    - Wave
//    - Orange Money
//    - MTN MoMo
//    - Moov Money
//    - banque
//    - espèces
//
// 2. Le prestataire de paiement en ligne
//    - CinetPay
//
// Les identifiants sensibles CinetPay ne sont jamais lus
// directement dans cette page.
// ============================================================

// ============================================================
// TYPES
// ============================================================

type PageProps = {
  searchParams: Promise<{
    success?: string
    error?: string
  }>
}

type CinetPayStatus = {
  configured: boolean
  provider: string | null
  active: boolean
  site_id: string | null
  channels: string | null
  updated_at: string | null
}

type RpcError = {
  code?: string
  message?: string
}

type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>
  ) => Promise<{
    data: unknown
    error: RpcError | null
  }>
}

// ============================================================
// PAGE
// ============================================================

export default async function PaymentMethodsPage({
  searchParams,
}: PageProps) {
  const query =
    await searchParams

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

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
  } =
    await supabase
      .from('organizations')
      .select(`
        name,
        short_name
      `)
      .eq(
        'id',
        organizationId
      )
      .maybeSingle()

  const organizationLabel =
    organization?.short_name ||
    organization?.name ||
    'Mutuelle'

  // ==========================================================
  // MOYENS DE PAIEMENT
  // ==========================================================

  const {
    data: methods,
    error,
  } =
    await supabase
      .from(
        'organization_payment_methods'
      )
      .select(`
        id,
        provider,
        label,
        account_name,
        account_number,
        merchant_code,
        bank_name,
        instructions,
        is_active,
        is_visible_to_members,
        accepts_remote_payment,
        display_order
      `)
      .eq(
        'organization_id',
        organizationId
      )
      .order(
        'display_order',
        {
          ascending: true,
        }
      )
      .order(
        'created_at',
        {
          ascending: true,
        }
      )

  if (error) {
    console.error(
      'EWUKAI - payment methods:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )
  }

  // ==========================================================
  // STATUT CINETPAY
  //
  // La RPC ne renvoie aucune API KEY ni SECRET KEY.
  // ==========================================================

  const rpcClient =
    supabase as unknown as
      RpcClient

  const {
    data: cinetPayRaw,
    error: cinetPayError,
  } =
    await rpcClient.rpc(
      'get_organization_cinetpay_status',
      {
        target_organization_id:
          organizationId,
      }
    )

  if (cinetPayError) {
    console.error(
      'EWUKAI - CinetPay status:',
      {
        code:
          cinetPayError.code,

        message:
          cinetPayError.message,
      }
    )
  }

  const cinetPay =
    (
      cinetPayRaw ?? {
        configured: false,
        provider: 'cinetpay',
        active: false,
        site_id: null,
        channels: null,
        updated_at: null,
      }
    ) as CinetPayStatus

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <Link
              href="/parametres"
              className="text-sm font-bold text-slate-500 transition hover:text-slate-900"
            >
              ← Paramètres
            </Link>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              {organizationLabel}
            </p>

            <h1 className="mt-2 text-3xl font-black text-slate-900">
              Moyens de paiement
            </h1>

            <p className="mt-2 max-w-3xl leading-7 text-slate-600">
              Configurez les comptes utilisés
              par la mutuelle pour recevoir les
              cotisations et activez, si besoin,
              le paiement électronique depuis
              l&apos;espace membre.
            </p>

          </div>

        </div>

        {/* ================================================== */}
        {/* MESSAGES */}
        {/* ================================================== */}

        {query.success && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">
            ✓ Modification enregistrée.
          </div>
        )}

        {query.error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            {query.error}
          </div>
        )}

        {/* ================================================== */}
        {/* CINETPAY */}
        {/* ================================================== */}

        <section className="mt-7 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">

          <div className="bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-6 sm:p-8">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

              {/* ============================================ */}
              {/* PRESENTATION */}
              {/* ============================================ */}

              <div className="flex min-w-0 items-start gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-lg font-black text-white shadow-sm">
                  CP
                </div>

                <div className="min-w-0">

                  <div className="flex flex-wrap items-center gap-3">

                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                      Paiement en ligne
                    </p>

                    <CinetPayBadge
                      configured={
                        cinetPay.configured
                      }
                      active={
                        cinetPay.active
                      }
                    />

                  </div>

                  <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
                    Compte marchand CinetPay
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Connectez le compte marchand
                    CinetPay de votre mutuelle pour
                    permettre aux membres de payer
                    leurs cotisations en ligne.
                  </p>

                  {/* ======================================== */}
                  {/* OPERATEURS */}
                  {/* ======================================== */}

                  <div className="mt-4 flex flex-wrap gap-2">

                    <ProviderPill>
                      Wave
                    </ProviderPill>

                    <ProviderPill>
                      Orange Money
                    </ProviderPill>

                    <ProviderPill>
                      MTN MoMo
                    </ProviderPill>

                    <ProviderPill>
                      Moov Money
                    </ProviderPill>

                  </div>

                </div>

              </div>

              {/* ============================================ */}
              {/* ACTION */}
              {/* ============================================ */}

              <div className="shrink-0">

                <Link
                  href="/parametres/paiements/cinetpay"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 lg:w-auto"
                >
                  {cinetPay.configured
                    ? 'Gérer CinetPay →'
                    : 'Connecter CinetPay →'}
                </Link>

              </div>

            </div>

            {/* ============================================== */}
            {/* INFORMATIONS SI CONFIGURE */}
            {/* ============================================== */}

            {cinetPay.configured && (
              <div className="mt-6 grid gap-3 border-t border-emerald-100 pt-5 sm:grid-cols-3">

                <CinetPayInfo
                  label="SITE ID"
                  value={
                    cinetPay.site_id ||
                    '—'
                  }
                />

                <CinetPayInfo
                  label="Canaux"
                  value={
                    formatCinetPayChannels(
                      cinetPay.channels
                    )
                  }
                />

                <CinetPayInfo
                  label="Identifiants"
                  value="Protégés et chiffrés"
                />

              </div>
            )}

          </div>

          {/* ================================================ */}
          {/* INFORMATION IMPORTANTE */}
          {/* ================================================ */}

          <div className="border-t border-slate-100 bg-white px-6 py-4 sm:px-8">

            <p className="text-xs leading-5 text-slate-500">
              CinetPay est distinct des coordonnées
              Wave, Orange Money, MTN MoMo ou
              bancaires enregistrées ci-dessous.
              Il sert au paiement automatisé depuis
              l&apos;espace membre.
            </p>

          </div>

        </section>

        {/* ================================================== */}
        {/* MOYENS EXISTANTS */}
        {/* ================================================== */}

        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
            COMPTES CONFIGURÉS
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900">
            Moyens disponibles
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Ces coordonnées peuvent être affichées
            aux membres pour les paiements directs
            à la mutuelle.
          </p>

          {!methods ||
          methods.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Aucun moyen de paiement configuré
              pour le moment.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">

              {methods.map(
                (method) => (
                  <article
                    key={method.id}
                    className="rounded-2xl border border-slate-200 p-5"
                  >

                    {/* ====================================== */}
                    {/* EN-TETE MOYEN */}
                    {/* ====================================== */}

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                          {providerLabel(
                            method.provider
                          )}
                        </p>

                        <h3 className="mt-1 text-lg font-black text-slate-900">
                          {method.label}
                        </h3>

                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          method.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {method.is_active
                          ? 'Actif'
                          : 'Inactif'}
                      </span>

                    </div>

                    {/* ====================================== */}
                    {/* INFORMATIONS */}
                    {/* ====================================== */}

                    <div className="mt-5 space-y-2 text-sm">

                      {method.account_name && (
                        <Info
                          label="Bénéficiaire"
                          value={
                            method.account_name
                          }
                        />
                      )}

                      {method.account_number && (
                        <Info
                          label="Numéro / Compte"
                          value={
                            method.account_number
                          }
                        />
                      )}

                      {method.merchant_code && (
                        <Info
                          label="Code marchand"
                          value={
                            method.merchant_code
                          }
                        />
                      )}

                      {method.bank_name && (
                        <Info
                          label="Banque"
                          value={
                            method.bank_name
                          }
                        />
                      )}

                    </div>

                    {/* ====================================== */}
                    {/* BADGES */}
                    {/* ====================================== */}

                    <div className="mt-4 flex flex-wrap gap-2">

                      <SmallBadge
                        active={
                          Boolean(
                            method.is_visible_to_members
                          )
                        }
                        activeLabel="Visible aux membres"
                        inactiveLabel="Masqué aux membres"
                      />

                      <SmallBadge
                        active={
                          Boolean(
                            method.accepts_remote_payment
                          )
                        }
                        activeLabel="Paiement à distance"
                        inactiveLabel="Information seulement"
                      />

                    </div>

                    {/* ====================================== */}
                    {/* ACTIONS */}
                    {/* ====================================== */}

                    <div className="mt-5 flex flex-wrap gap-2">

                      <form
                        action={
                          togglePaymentMethod
                        }
                      >

                        <input
                          type="hidden"
                          name="id"
                          value={
                            method.id
                          }
                        />

                        <input
                          type="hidden"
                          name="nextActive"
                          value={
                            method.is_active
                              ? 'false'
                              : 'true'
                          }
                        />

                        <button
                          type="submit"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                        >
                          {method.is_active
                            ? 'Désactiver'
                            : 'Activer'}
                        </button>

                      </form>

                      <form
                        action={
                          deletePaymentMethod
                        }
                      >

                        <input
                          type="hidden"
                          name="id"
                          value={
                            method.id
                          }
                        />

                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-50"
                        >
                          Supprimer
                        </button>

                      </form>

                    </div>

                  </article>
                )
              )}

            </div>
          )}

        </section>

        {/* ================================================== */}
        {/* AJOUTER UN MOYEN */}
        {/* ================================================== */}

        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
            AJOUTER
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900">
            Nouveau moyen de paiement
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Ajoutez les coordonnées sur lesquelles
            votre mutuelle reçoit directement ses
            fonds.
          </p>

          <form
            action={
              createPaymentMethod
            }
            className="mt-6 space-y-5"
          >

            <div className="grid gap-5 md:grid-cols-2">

              <SelectField
                label="Opérateur / Type"
                name="provider"
              />

              <Field
                label="Nom d’affichage"
                name="label"
                required
                placeholder="Ex. Wave principal"
              />

              <Field
                label="Nom du bénéficiaire"
                name="accountName"
                placeholder="Ex. Nom de la mutuelle"
              />

              <Field
                label="Numéro / Compte"
                name="accountNumber"
                placeholder="Ex. 07 00 00 00 00"
              />

              <Field
                label="Code marchand"
                name="merchantCode"
                placeholder="Si applicable"
              />

              <Field
                label="Banque"
                name="bankName"
                placeholder="Pour les virements bancaires"
              />

              <Field
                label="Ordre d’affichage"
                name="displayOrder"
                type="number"
                defaultValue="0"
              />

            </div>

            {/* ============================================== */}
            {/* INSTRUCTIONS */}
            {/* ============================================== */}

            <div>

              <label
                htmlFor="instructions"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Instructions
              </label>

              <textarea
                id="instructions"
                name="instructions"
                rows={4}
                placeholder="Ex. Indiquer votre matricule dans le libellé du paiement."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[var(--brand-primary)]"
              />

            </div>

            {/* ============================================== */}
            {/* OPTIONS */}
            {/* ============================================== */}

            <div className="grid gap-4 md:grid-cols-2">

              <CheckBox
                name="isActive"
                label="Moyen actif"
                description="Ce moyen peut être utilisé actuellement."
                defaultChecked
              />

              <CheckBox
                name="isVisibleToMembers"
                label="Visible par les membres"
                description="Les membres pourront voir ces coordonnées dans leur espace."
                defaultChecked
              />

            </div>

            {/* ============================================== */}
            {/* ENREGISTRER */}
            {/* ============================================== */}

            <div className="flex justify-end">

              <button
                type="submit"
                className="rounded-xl bg-[var(--brand-primary)] px-6 py-3 font-black text-white transition hover:opacity-90"
              >
                Ajouter le moyen de paiement
              </button>

            </div>

          </form>

        </section>

        {/* ================================================== */}
        {/* SECURITE */}
        {/* ================================================== */}

        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">

          <p className="font-black text-amber-900">
            Sécurité
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            N&apos;enregistrez jamais ici un code
            PIN, un OTP ou un mot de passe Wave,
            Orange Money, MTN MoMo ou Moov Money.
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            Les identifiants API CinetPay doivent
            uniquement être renseignés depuis
            l&apos;espace sécurisé « Compte
            CinetPay » prévu à cet effet.
          </p>

        </div>

      </div>

    </main>
  )
}

// ============================================================
// CINETPAY BADGE
// ============================================================

function CinetPayBadge({
  configured,
  active,
}: {
  configured: boolean
  active: boolean
}) {
  if (!configured) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
        Non configuré
      </span>
    )
  }

  if (!active) {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700">
        Désactivé
      </span>
    )
  }

  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
      Actif
    </span>
  )
}

// ============================================================
// CINETPAY INFO
// ============================================================

function CinetPayInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">

      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-slate-800">
        {value}
      </p>

    </div>
  )
}

// ============================================================
// CINETPAY CHANNELS
// ============================================================

function formatCinetPayChannels(
  value:
    | string
    | null
) {
  switch (value) {
    case 'MOBILE_MONEY':
      return 'Mobile Money'

    case 'CREDIT_CARD':
      return 'Carte bancaire'

    case 'WALLET':
      return 'Wallet'

    case 'ALL':
      return 'Tous les moyens'

    default:
      return value ||
        '—'
  }
}

// ============================================================
// PROVIDER PILL
// ============================================================

function ProviderPill({
  children,
}: {
  children: string
}) {
  return (
    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
      {children}
    </span>
  )
}

// ============================================================
// PETIT BADGE
// ============================================================

function SmallBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean
  activeLabel: string
  inactiveLabel: string
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-black ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      {active
        ? activeLabel
        : inactiveLabel}
    </span>
  )
}

// ============================================================
// LIBELLE PRESTATAIRE
// ============================================================

function providerLabel(
  provider: string
) {
  switch (provider) {
    case 'wave':
      return 'Wave'

    case 'orange_money':
      return 'Orange Money'

    case 'mtn_momo':
      return 'MTN MoMo'

    case 'moov_money':
      return 'Moov Money'

    case 'bank_transfer':
      return 'Virement bancaire'

    case 'cash':
      return 'Espèces'

    default:
      return 'Autre'
  }
}

// ============================================================
// SELECT
// ============================================================

function SelectField({
  label,
  name,
}: {
  label: string
  name: string
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-slate-700"
      >
        {label}
      </label>

      <select
        id={name}
        name={name}
        required
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[var(--brand-primary)]"
      >

        <option value="wave">
          Wave
        </option>

        <option value="orange_money">
          Orange Money
        </option>

        <option value="mtn_momo">
          MTN MoMo
        </option>

        <option value="moov_money">
          Moov Money
        </option>

        <option value="bank_transfer">
          Virement bancaire
        </option>

        <option value="cash">
          Espèces
        </option>

        <option value="other">
          Autre
        </option>

      </select>

    </div>
  )
}

// ============================================================
// FIELD
// ============================================================

function Field({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  defaultValue,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="mb-2 block text-sm font-bold text-slate-700"
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[var(--brand-primary)]"
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
  defaultChecked = false,
}: {
  name: string
  label: string
  description: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex gap-4 rounded-2xl border border-slate-200 p-5 transition hover:bg-slate-50">

      <input
        type="checkbox"
        name={name}
        defaultChecked={
          defaultChecked
        }
        className="mt-1 h-5 w-5 accent-emerald-700"
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
// INFO
// ============================================================

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex justify-between gap-4">

      <span className="text-slate-500">
        {label}
      </span>

      <span className="max-w-[65%] break-words text-right font-bold text-slate-900">
        {value}
      </span>

    </div>
  )
}