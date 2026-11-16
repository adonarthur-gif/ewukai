import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

import {
  createPaymentMethod,
  deletePaymentMethod,
  setPrimaryPayoutMethod,
  togglePaymentMethod,
  updatePaymentMethodAccount,
} from './actions'

// ============================================================
// EWUKAI
// PARAMETRES DES MOYENS DE PAIEMENT
//
// Cette page gère uniquement les moyens de paiement
// et comptes de réception propres à la mutuelle :
//
// - Wave
// - Orange Money
// - MTN MoMo
// - Moov Money
// - banque
// - espèces
//
// Les identifiants techniques CinetPay sont gérés
// exclusivement par l'administration EWUKAI.
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
        is_payout_destination,
        is_primary_payout,
        payout_verified_at,
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

                    {[
                      'wave',
                      'orange_money',
                      'mtn_momo',
                      'moov_money',
                    ].includes(method.provider) && (
                      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-sm font-black text-slate-700">
                          Modifier les coordonnées
                        </summary>

                        <form
                          action={updatePaymentMethodAccount}
                          className="mt-4 grid gap-3"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={method.id}
                          />

                          <input
                            type="text"
                            name="accountName"
                            defaultValue={method.account_name ?? ''}
                            placeholder="Nom du bénéficiaire"
                            required
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                          />

                          <input
                            type="text"
                            name="accountNumber"
                            defaultValue={method.account_number ?? ''}
                            placeholder="Numéro Mobile Money"
                            required
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                          />

                          <div>
                            <button
                              type="submit"
                              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:opacity-90"
                            >
                              Enregistrer les coordonnées
                            </button>
                          </div>
                        </form>
                      </details>
                    )}

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

                      {[
                        'wave',
                        'orange_money',
                        'mtn_momo',
                        'moov_money',
                      ].includes(
                        method.provider
                      ) && (
                        <SmallBadge
                          active={
                            Boolean(
                              method.is_payout_destination
                            )
                          }
                          activeLabel="Compte de reversement"
                          inactiveLabel="Reversement non activé"
                        />
                      )}

                      {Boolean(
                        method.is_primary_payout
                      ) && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
                          ★ Compte principal
                        </span>
                      )}

                    </div>

                    {/* ====================================== */}
                    {/* ACTIONS */}
                    {/* ====================================== */}

                    <div className="mt-5 flex flex-wrap gap-2">

                      {[
                        'wave',
                        'orange_money',
                        'mtn_momo',
                        'moov_money',
                      ].includes(
                        method.provider
                      ) &&
                      method.is_active &&
                      !method.is_primary_payout &&
                      method.account_name &&
                      method.account_number && (
                        <form
                          action={
                            setPrimaryPayoutMethod
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
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-100"
                          >
                            Définir comme compte principal
                          </button>
                        </form>
                      )}

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

              <CheckBox
                name="isPayoutDestination"
                label="Compte de reversement"
                description="Autoriser EWUKAI à reverser les fonds sur ce compte Mobile Money."
              />

              <CheckBox
                name="isPrimaryPayout"
                label="Compte principal de reversement"
                description="Utiliser ce compte Mobile Money en priorité pour les reversements de la mutuelle."
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


        </div>

      </div>

    </main>
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
