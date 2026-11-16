import Link from 'next/link'

import {
  notFound,
  redirect,
} from 'next/navigation'

import {
  getPlatformCinetPayCheckoutConfig,
} from '@/lib/payments/platform-cinetpay'

import {
  createClient,
} from '@/lib/supabase/server'

import {
  prepareMemberCardPayment,
  prepareMemberPayment,
} from './actions'

import MemberPaymentAttemptStatus
  from './payment-attempt-status'

// ============================================================
// EWUKAI
// PAIEMENT D'UNE COTISATION DEPUIS L'ESPACE MEMBRE
//
// PRINCIPES :
// - le membre ne décide jamais du montant
// - le montant restant vient de la base
// - les espèces ne sont jamais auto-confirmées
// - CinetPay utilise le compte marchand central EWUKAI
// - le retour navigateur ne confirme jamais le paiement
// - seule la notification CinetPay vérifiée confirme le paiement
// ============================================================

// ============================================================
// PROPS
// ============================================================

type PageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    error?: string
    prepared?: string
    returned?: string
    organization?: string
  }>
}

// ============================================================
// TYPES
// ============================================================

type MemberSpaceOption = {
  member_id: string
  organization_id: string

  organization_name?:
    | string
    | null

  organization_short_name?:
    | string
    | null

  member_number?:
    | string
    | null
}

type MemberData = {
  id: string

  member_number:
    | string
    | null

  first_name:
    | string
    | null

  last_name:
    | string
    | null

  full_name?:
    | string
    | null

  status:
    | string
    | null
}

type OrganizationData = {
  id: string

  name: string

  short_name:
    | string
    | null

  primary_color?:
    | string
    | null
}

type ObligationData = {
  id: string

  organization_id?:
    | string
    | null

  member_id?:
    | string
    | null

  contribution_type_id?:
    | string
    | null

  contribution_call_id?:
    | string
    | null

  contribution_name?:
    | string
    | null

  contribution_type_name?:
    | string
    | null

  call_title?:
    | string
    | null

  title?:
    | string
    | null

  label?:
    | string
    | null

  period_start?:
    | string
    | null

  period_end?:
    | string
    | null

  due_date?:
    | string
    | null

  amount_due:
    | number
    | string

  amount_paid?:
    | number
    | string
    | null

  allocated_amount?:
    | number
    | string
    | null

  remaining_amount?:
    | number
    | string
    | null

  status:
    | string
    | null
}

type FinancialSpace = {
  organization?:
    | OrganizationData
    | null

  member?:
    | MemberData
    | null

  obligations?:
    | ObligationData[]
    | null

  regular_obligations?:
    | ObligationData[]
    | null

  exceptional_obligations?:
    | ObligationData[]
    | null

  outstanding_obligations?:
    | ObligationData[]
    | null

  open_obligations?:
    | ObligationData[]
    | null
}

type PaymentMethod = {
  id: string

  provider: string

  label:
    | string
    | null

  account_name?:
    | string
    | null

  account_number?:
    | string
    | null

  merchant_code?:
    | string
    | null

  bank_name?:
    | string
    | null

  instructions?:
    | string
    | null

  accepts_remote_payment:
    | boolean
    | null

  display_order?:
    | number
    | null
}

// ============================================================
// MOYENS AUTORISES POUR LE PAIEMENT EN LIGNE V1
// ============================================================

const REMOTE_PAYMENT_METHODS =
  new Set([
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
  ])

// ============================================================
// PAGE
// ============================================================

export default async function MemberPaymentPage({
  params,
  searchParams,
}: PageProps) {
  const {
    id: obligationId,
  } =
    await params

  const query =
    await searchParams

  // ==========================================================
  // ID OBLIGATION
  // ==========================================================

  if (
    !obligationId ||
    typeof obligationId !==
      'string'
  ) {
    notFound()
  }

  const supabase =
    await createClient()

  // ==========================================================
  // AUTHENTIFICATION
  // ==========================================================

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
      '/login/membre'
    )
  }

  // ==========================================================
  // UTILISATEUR AUTHENTIFIE
  //
  // Utilisé uniquement pour préremplir les coordonnées du
  // formulaire carte. Ces valeurs restent modifiables et ne
  // sont jamais réécrites automatiquement dans le profil.
  // ==========================================================

  const {
    data:
      userData,

    error:
      userError,
  } =
    await supabase.auth
      .getUser()

  if (userError) {
    console.error(
      'EWUKAI - MEMBER PAYMENT USER:',
      {
        message:
          userError.message,
      }
    )
  }

  const authUser =
    userData?.user

  const cardEmail =
    authUser
      ?.email
      ?.trim() ||
    ''

  const cardPhone =
    authUser
      ?.phone
      ?.trim() ||
    ''

  // ==========================================================
  // ESPACES MEMBRE
  // ==========================================================

  const {
    data: spacesRaw,
    error: spacesError,
  } =
    await supabase.rpc(
      'list_my_member_spaces'
    )

  if (spacesError) {
    console.error(
      'EWUKAI - MEMBER PAYMENT SPACES:',
      {
        code:
          spacesError.code,

        message:
          spacesError.message,
      }
    )

    redirect(
      '/my-space'
    )
  }

  const spaces =
    Array.isArray(
      spacesRaw
    )
      ? (
          spacesRaw as
            MemberSpaceOption[]
        )
      : []

  if (
    spaces.length ===
    0
  ) {
    redirect(
      '/my-space'
    )
  }

  // ==========================================================
  // PRIORITE A L'ORGANISATION FOURNIE DANS L'URL
  //
  // Cela permet notamment de conserver le bon espace
  // lorsqu'un membre appartient à plusieurs mutuelles.
  // ==========================================================

  const requestedOrganizationId =
    query.organization
      ?.trim() ||
    null

  const orderedSpaces =
    requestedOrganizationId
      ? [
          ...spaces.filter(
            (space) =>
              space.organization_id ===
              requestedOrganizationId
          ),

          ...spaces.filter(
            (space) =>
              space.organization_id !==
              requestedOrganizationId
          ),
        ]
      : spaces

  // ==========================================================
  // RETROUVER L'OBLIGATION DANS LES ESPACES DU MEMBRE
  // ==========================================================

  let selectedSpace:
    MemberSpaceOption
    | null =
      null

  let financialSpace:
    FinancialSpace
    | null =
      null

  let obligation:
    ObligationData
    | null =
      null

  for (
    const space
    of orderedSpaces
  ) {
    const {
      data: financialRaw,
      error: financialError,
    } =
      await supabase.rpc(
        'get_my_member_financial_space',
        {
          target_organization_id:
            space.organization_id,
        }
      )

    if (financialError) {
      console.error(
        'EWUKAI - MEMBER PAYMENT FINANCIAL SPACE:',
        {
          code:
            financialError.code,

          message:
            financialError.message,
        }
      )

      continue
    }

    if (
      !financialRaw ||
      typeof financialRaw !==
        'object'
    ) {
      continue
    }

    const candidate =
      financialRaw as
        FinancialSpace

    const obligations =
      getAllObligations(
        candidate
      )

    const found =
      obligations.find(
        (item) =>
          item.id ===
          obligationId
      )

    if (found) {
      selectedSpace =
        space

      financialSpace =
        candidate

      obligation =
        found

      break
    }
  }

  // ==========================================================
  // OBLIGATION NON ACCESSIBLE
  // ==========================================================

  if (
    !selectedSpace ||
    !financialSpace ||
    !obligation
  ) {
    notFound()
  }

  // ==========================================================
  // ORGANISATION
  // ==========================================================

  const organization =
    financialSpace.organization

  if (
    !organization ||
    !organization.id
  ) {
    throw new Error(
      'Organisation introuvable.'
    )
  }

  // ==========================================================
  // MEMBRE
  // ==========================================================

  const member =
    financialSpace.member

  if (
    !member ||
    !member.id
  ) {
    throw new Error(
      'Membre introuvable.'
    )
  }

  // ==========================================================
  // VERIFICATION CROISEE
  // ==========================================================

  if (
    organization.id !==
      selectedSpace.organization_id ||
    member.id !==
      selectedSpace.member_id
  ) {
    notFound()
  }

  // ==========================================================
  // MONTANTS
  // ==========================================================

  const amountDue =
    money(
      obligation.amount_due
    )

  const amountPaid =
    getPaidAmount(
      obligation
    )

  const remainingAmount =
    getRemainingAmount(
      obligation
    )

  // ==========================================================
  // STATUT
  // ==========================================================

  const normalizedStatus =
    (
      obligation.status ??
      ''
    )
      .trim()
      .toLowerCase()

  const cannotPay =
    remainingAmount <=
      0 ||
    [
      'paid',
      'waived',
      'cancelled',
    ].includes(
      normalizedStatus
    )

  if (cannotPay) {
    redirect(
      `/my-space?organization=${encodeURIComponent(
        organization.id
      )}#cotisations`
    )
  }

  // ==========================================================
  // MOYENS DE PAIEMENT VISIBLES
  // ==========================================================

  const {
    data:
      paymentMethodsRaw,

    error:
      paymentMethodsError,
  } =
    await supabase.rpc(
      'get_visible_payment_methods',
      {
        target_organization_id:
          organization.id,
      }
    )

  if (
    paymentMethodsError
  ) {
    console.error(
      'EWUKAI - MEMBER PAYMENT METHODS:',
      {
        code:
          paymentMethodsError.code,

        message:
          paymentMethodsError.message,
      }
    )
  }

  const allPaymentMethods =
    Array.isArray(
      paymentMethodsRaw
    )
      ? (
          paymentMethodsRaw as
            PaymentMethod[]
        )
      : []

  // ==========================================================
  // UNIQUEMENT LES MOYENS POUVANT PASSER PAR CINETPAY
  // ==========================================================

  const onlinePaymentMethods =
    allPaymentMethods
      .filter(
        (method) =>
          method
            .accepts_remote_payment ===
            true &&
          REMOTE_PAYMENT_METHODS.has(
            method.provider
          )
      )
      .sort(
        (a, b) =>
          Number(
            a.display_order ??
            0
          ) -
          Number(
            b.display_order ??
            0
          )
      )

  // ==========================================================
  // CARTE BANCAIRE - DISPONIBILITE CENTRALE EWUKAI
  // ==========================================================

  let cardPaymentAvailable =
    false

  try {
    await getPlatformCinetPayCheckoutConfig()

    cardPaymentAvailable =
      true
  } catch {
    cardPaymentAvailable =
      false
  }

  const cardAmountSupported =
    Number.isSafeInteger(
      remainingAmount
    ) &&
    remainingAmount >
      0 &&
    remainingAmount %
      5 ===
      0

  // ==========================================================
  // COULEUR
  // ==========================================================

  const primaryColor =
    safeColor(
      organization.primary_color,
      '#047857'
    )

  // ==========================================================
  // LABELS
  // ==========================================================

  const organizationLabel =
    organization.short_name ||
    organization.name

  const memberLabel =
    getMemberName(
      member
    )

  const {
    firstName:
      cardFirstName,

    lastName:
      cardLastName,
  } =
    getMemberFirstLast(
      member
    )

  const contributionLabel =
    getObligationLabel(
      obligation
    )

  const returnHref =
    `/my-space?organization=${encodeURIComponent(
      organization.id
    )}#cotisations`

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        {/* ================================================== */}
        {/* RETOUR */}
        {/* ================================================== */}

        <Link
          href={
            returnHref
          }
          className="text-sm font-black text-slate-500 transition hover:text-slate-900"
        >
          ← Retour à mon espace
        </Link>

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <section className="mt-6 overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">

          <div className="p-6 sm:p-8">

            <p
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{
                color:
                  '#6ee7b7',
              }}
            >
              Paiement de cotisation
            </p>

            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              {contributionLabel}
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              {organizationLabel}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">

              <HeaderInfo
                label="Membre"
                value={
                  memberLabel
                }
              />

              <HeaderInfo
                label="Matricule"
                value={
                  member
                    .member_number ||
                  '—'
                }
              />

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* ERREUR */}
        {/* ================================================== */}

        {query.error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">

            <p className="font-black text-red-900">
              Paiement impossible
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {query.error}
            </p>

          </div>
        )}

        {/* ================================================== */}
        {/* ANCIEN ETAT PREPARE */}
        {/* Legacy prepared state kept for compatibility. The new flow redirects directly to CinetPay. */}
        {/* ================================================== */}

        {query.prepared ===
          '1' && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">

            <p className="font-black text-blue-950">
              Paiement préparé
            </p>

            <p className="mt-2 text-sm leading-6 text-blue-800">
              Aucun montant n&apos;a
              encore été débité.
            </p>

          </div>
        )}

        {/* ================================================== */}
        {/* ETAT APRES RETOUR CINETPAY */}
        {/* ================================================== */}

        <MemberPaymentAttemptStatus
          organizationId={
            organization.id
          }
          memberId={
            member.id
          }
          obligationId={
            obligation.id
          }
          returned={
            query.returned ===
            '1'
          }
        />

        {/* ================================================== */}
        {/* DETAIL DE L'ECHEANCE */}
        {/* ================================================== */}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Échéance sélectionnée
              </p>

              <h2 className="mt-2 text-xl font-black text-slate-900">
                {contributionLabel}
              </h2>

              {obligation
                .due_date && (
                <p className="mt-2 text-sm text-slate-500">
                  Date limite :{' '}
                  <strong className="text-slate-700">
                    {formatDate(
                      obligation
                        .due_date
                    )}
                  </strong>
                </p>
              )}

              {obligation
                .period_start && (
                <p className="mt-1 text-sm text-slate-500">
                  Période :{' '}
                  <strong className="text-slate-700">
                    {formatPeriod(
                      obligation
                        .period_start
                    )}
                  </strong>
                </p>
              )}

            </div>

            <ObligationStatusBadge
              status={
                normalizedStatus
              }
              dueDate={
                obligation
                  .due_date ??
                null
              }
            />

          </div>

          {/* ================================================ */}
          {/* MONTANTS */}
          {/* ================================================ */}

          <div className="mt-7 grid gap-4 sm:grid-cols-3">

            <AmountCard
              label="Montant dû"
              value={
                amountDue
              }
            />

            <AmountCard
              label="Déjà payé"
              value={
                amountPaid
              }
            />

            <div
              className="rounded-2xl p-5 text-white"
              style={{
                backgroundColor:
                  primaryColor,
              }}
            >

              <p className="text-xs font-black uppercase tracking-wide text-white/75">
                Reste à payer
              </p>

              <p className="mt-2 text-xl font-black">
                {formatMoney(
                  remainingAmount
                )}
              </p>

            </div>

          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">

            <p className="text-xs leading-5 text-slate-500">
              Le montant à payer est calculé
              automatiquement par EWUKAI.
              Il ne peut pas être modifié depuis
              cette page.
            </p>

          </div>

        </section>

        {/* ================================================== */}
        {/* MOYENS DE PAIEMENT */}
        {/* ================================================== */}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

          <p
            className="text-xs font-black uppercase tracking-[0.16em]"
            style={{
              color:
                primaryColor,
            }}
          >
            Paiement en ligne
          </p>

          <h2 className="mt-2 text-xl font-black text-slate-900">
            Choisissez votre moyen de paiement
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Les paiements en ligne sont traités
            par le compte CinetPay central sécurisé
            d&apos;EWUKAI. Votre mutuelle ne gère
            aucun identifiant CinetPay.
          </p>

          {/* ================================================ */}
          {/* ESPECES */}
          {/* ================================================ */}

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">

            <p className="font-black text-amber-900">
              Paiement en espèces
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              Le paiement en espèces
              n&apos;est pas disponible
              depuis l&apos;espace membre.
              Remettez directement les fonds
              au responsable ou au trésorier
              de votre mutuelle.
            </p>

            <p className="mt-2 text-xs font-bold text-amber-700">
              Le responsable enregistrera
              le paiement uniquement après
              réception effective des espèces.
            </p>

          </div>

          {/* ================================================ */}
          {/* MOBILE MONEY */}
          {/* ================================================ */}

          <div className="mt-8">

            <div className="flex items-center justify-between gap-4">

              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  Mobile Money
                </p>

                <h3 className="mt-1 text-lg font-black text-slate-900">
                  Wave, Orange Money, MTN MoMo ou Moov Money
                </h3>
              </div>

            </div>

            {onlinePaymentMethods
              .length ===
            0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">

                <p className="font-black text-slate-800">
                  Mobile Money indisponible
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Votre mutuelle n&apos;a actuellement
                  aucun moyen Mobile Money activé pour
                  le paiement en ligne.
                </p>

              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">

                {onlinePaymentMethods
                  .map(
                    (
                      method
                    ) => (
                      <form
                        key={
                          method.id
                        }
                        action={
                          prepareMemberPayment
                        }
                        className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-sm"
                      >

                        <input
                          type="hidden"
                          name="obligationId"
                          value={
                            obligation.id
                          }
                        />

                        <input
                          type="hidden"
                          name="organizationId"
                          value={
                            organization.id
                          }
                        />

                        <input
                          type="hidden"
                          name="paymentMethod"
                          value={
                            method.provider
                          }
                        />

                        <div className="flex items-start justify-between gap-4">

                          <div>

                            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                              Mobile Money
                            </p>

                            <h3 className="mt-1 text-lg font-black text-slate-900">
                              {method.label ||
                                providerLabel(
                                  method.provider
                                )}
                            </h3>

                          </div>

                          <ProviderBadge
                            provider={
                              method.provider
                            }
                          />

                        </div>

                        <p className="mt-4 text-sm leading-6 text-slate-500">
                          Montant à régler :
                        </p>

                        <p className="mt-1 text-xl font-black text-slate-950">
                          {formatMoney(
                            remainingAmount
                          )}
                        </p>

                        {method
                          .instructions && (
                          <p className="mt-3 text-xs leading-5 text-slate-500">
                            {
                              method
                                .instructions
                            }
                          </p>
                        )}

                        <button
                          type="submit"
                          className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-black text-white shadow-sm transition hover:opacity-90"
                          style={{
                            backgroundColor:
                              primaryColor,
                          }}
                        >
                          Continuer avec{' '}
                          {providerLabel(
                            method.provider
                          )}
                          {' →'}
                        </button>

                      </form>
                    )
                  )}

              </div>
            )}

          </div>

          {/* ================================================ */}
          {/* CARTE BANCAIRE VISA / MASTERCARD */}
          {/* ================================================ */}

          <div className="mt-8 border-t border-slate-100 pt-8">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">

              <div>

                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                  Carte bancaire
                </p>

                <h3 className="mt-1 text-lg font-black text-slate-900">
                  Visa / Mastercard
                </h3>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Le paiement par carte passe par
                  CinetPay Checkout. EWUKAI ne vous
                  demande jamais le numéro de carte,
                  le CVV ou la date d&apos;expiration.
                </p>

              </div>

              {cardPaymentAvailable ? (
                <span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
                  Disponible
                </span>
              ) : (
                <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                  Non activé
                </span>
              )}

            </div>

            {!cardPaymentAvailable ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">

                <p className="font-black text-slate-800">
                  Visa / Mastercard n&apos;est pas encore activé
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Les paiements Mobile Money restent disponibles
                  normalement lorsque votre mutuelle les autorise.
                </p>

              </div>
            ) : !cardAmountSupported ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">

                <p className="font-black text-amber-900">
                  Paiement carte temporairement indisponible pour ce montant
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Le montant Checkout doit respecter les contraintes
                  techniques CinetPay. Utilisez un moyen Mobile Money
                  pour cette échéance.
                </p>

              </div>
            ) : (
              <details className="mt-4 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50">

                <summary className="cursor-pointer list-none px-5 py-4 font-black text-blue-950">
                  Payer {formatMoney(
                    remainingAmount
                  )} par Visa / Mastercard
                </summary>

                <form
                  action={
                    prepareMemberCardPayment
                  }
                  className="border-t border-blue-200 bg-white p-5 sm:p-6"
                >

                  <input
                    type="hidden"
                    name="obligationId"
                    value={
                      obligation.id
                    }
                  />

                  <input
                    type="hidden"
                    name="organizationId"
                    value={
                      organization.id
                    }
                  />

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">

                    <p className="font-black text-blue-950">
                      Coordonnées de facturation
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-800">
                      Les informations connues par EWUKAI sont
                      préremplies. Vous pouvez les modifier pour
                      cette transaction. Ces modifications ne
                      changent pas votre profil membre.
                    </p>

                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">

                    <CardField
                      label="Prénom"
                      name="cardFirstName"
                      defaultValue={
                        cardFirstName
                      }
                      autoComplete="given-name"
                      required
                    />

                    <CardField
                      label="Nom"
                      name="cardLastName"
                      defaultValue={
                        cardLastName
                      }
                      autoComplete="family-name"
                      required
                    />

                    <CardField
                      label="E-mail"
                      name="cardEmail"
                      type="email"
                      defaultValue={
                        cardEmail
                      }
                      autoComplete="email"
                      required
                    />

                    <CardField
                      label="Téléphone"
                      name="cardPhone"
                      type="tel"
                      defaultValue={
                        cardPhone
                      }
                      placeholder="+225 ..."
                      autoComplete="tel"
                      required
                    />

                    <CardField
                      label="Adresse"
                      name="cardAddress"
                      defaultValue=""
                      placeholder="Quartier, rue, résidence..."
                      autoComplete="street-address"
                      required
                    />

                    <CardField
                      label="Ville"
                      name="cardCity"
                      defaultValue=""
                      placeholder="Abidjan"
                      autoComplete="address-level2"
                      required
                    />

                    <CardField
                      label="Pays"
                      name="cardCountry"
                      defaultValue="CI"
                      placeholder="CI"
                      maxLength={2}
                      autoComplete="country"
                      required
                    />

                    <CardField
                      label="Région / État"
                      name="cardState"
                      defaultValue=""
                      placeholder="Région ou district"
                      autoComplete="address-level1"
                      required
                    />

                    <CardField
                      label="Code postal / ZIP"
                      name="cardZipCode"
                      defaultValue=""
                      placeholder="Code postal"
                      autoComplete="postal-code"
                      required
                    />

                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">

                    <p className="text-xs leading-5 text-slate-600">
                      Après validation, vous serez redirigé vers
                      le guichet sécurisé CinetPay pour saisir
                      les informations de votre carte bancaire.
                      EWUKAI ne stocke pas ces données bancaires.
                    </p>

                  </div>

                  <button
                    type="submit"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
                  >
                    Continuer vers Visa / Mastercard →
                  </button>

                </form>

              </details>
            )}

          </div>

        </section>

        {/* ================================================== */}
        {/* SECURITE */}
        {/* ================================================== */}

        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">

          <p className="font-black text-blue-950">
            Paiement sécurisé
          </p>

          <p className="mt-2 text-sm leading-6 text-blue-800">
            EWUKAI ne considère jamais
            le simple retour du navigateur
            comme une preuve de paiement.
            La cotisation est enregistrée
            uniquement après confirmation
            et vérification du prestataire
            de paiement.
          </p>

        </section>

        {/* ================================================== */}
        {/* RETOUR */}
        {/* ================================================== */}

        <div className="mt-7 flex justify-center">

          <Link
            href={
              returnHref
            }
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            ← Revenir à mes cotisations
          </Link>

        </div>

      </div>

    </main>
  )
}

// ============================================================
// EXTRAIRE TOUTES LES OBLIGATIONS
// ============================================================

function getAllObligations(
  space: FinancialSpace
) {
  const groups = [
    space.obligations,
    space.regular_obligations,
    space.exceptional_obligations,
    space.outstanding_obligations,
    space.open_obligations,
  ]

  const map =
    new Map<
      string,
      ObligationData
    >()

  for (
    const group
    of groups
  ) {
    if (
      !Array.isArray(
        group
      )
    ) {
      continue
    }

    for (
      const item
      of group
    ) {
      if (
        item &&
        typeof item.id ===
          'string'
      ) {
        map.set(
          item.id,
          item
        )
      }
    }
  }

  return Array.from(
    map.values()
  )
}

// ============================================================
// MONTANT
// ============================================================

function money(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(
      value ??
      0
    )

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0
}

// ============================================================
// DEJA PAYE
// ============================================================

function getPaidAmount(
  obligation:
    ObligationData
) {
  if (
    obligation
      .allocated_amount !==
      undefined &&
    obligation
      .allocated_amount !==
      null
  ) {
    return money(
      obligation
        .allocated_amount
    )
  }

  if (
    obligation
      .amount_paid !==
      undefined &&
    obligation
      .amount_paid !==
      null
  ) {
    return money(
      obligation
        .amount_paid
    )
  }

  const remaining =
    obligation
      .remaining_amount

  if (
    remaining !==
      undefined &&
    remaining !==
      null
  ) {
    return Math.max(
      money(
        obligation
          .amount_due
      ) -
        money(
          remaining
        ),
      0
    )
  }

  return 0
}

// ============================================================
// RESTE
// ============================================================

function getRemainingAmount(
  obligation:
    ObligationData
) {
  if (
    obligation
      .remaining_amount !==
      undefined &&
    obligation
      .remaining_amount !==
      null
  ) {
    return Math.max(
      money(
        obligation
          .remaining_amount
      ),
      0
    )
  }

  return Math.max(
    money(
      obligation
        .amount_due
    ) -
      getPaidAmount(
        obligation
      ),
    0
  )
}

// ============================================================
// PRENOM / NOM MEMBRE POUR LE FORMULAIRE CARTE
// ============================================================

function getMemberFirstLast(
  member: MemberData
) {
  let firstName =
    member.first_name
      ?.trim() ||
    ''

  let lastName =
    member.last_name
      ?.trim() ||
    ''

  const fullName =
    member.full_name
      ?.trim() ||
    ''

  if (
    (!firstName ||
      !lastName) &&
    fullName
  ) {
    const parts =
      fullName
        .split(/\s+/)
        .filter(Boolean)

    if (
      !firstName &&
      parts.length >
        0
    ) {
      firstName =
        parts[0]
    }

    if (
      !lastName &&
      parts.length >
        1
    ) {
      lastName =
        parts
          .slice(1)
          .join(' ')
    }
  }

  return {
    firstName,
    lastName,
  }
}

// ============================================================
// NOM MEMBRE
// ============================================================

function getMemberName(
  member: MemberData
) {
  const fullName =
    member.full_name
      ?.trim()

  if (fullName) {
    return fullName
  }

  const name =
    [
      member.first_name,
      member.last_name,
    ]
      .filter(
        Boolean
      )
      .join(' ')
      .trim()

  return name ||
    'Membre'
}

// ============================================================
// LIBELLE COTISATION
// ============================================================

function getObligationLabel(
  obligation:
    ObligationData
) {
  return (
    obligation.call_title ||
    obligation.contribution_name ||
    obligation.contribution_type_name ||
    obligation.title ||
    obligation.label ||
    (
      obligation
        .contribution_call_id
        ? 'Cotisation exceptionnelle'
        : 'Cotisation'
    )
  )
}

// ============================================================
// BADGE STATUT
// ============================================================

function ObligationStatusBadge({
  status,
  dueDate,
}: {
  status: string

  dueDate:
    | string
    | null
}) {
  if (
    status ===
    'partial'
  ) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700">
        Partiel
      </span>
    )
  }

  if (
    status ===
    'paid'
  ) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">
        Payé
      </span>
    )
  }

  if (
    dueDate
  ) {
    const today =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        )

    if (
      dueDate <
      today
    ) {
      return (
        <span className="inline-flex rounded-full bg-red-100 px-3 py-1.5 text-xs font-black text-red-700">
          Impayé
        </span>
      )
    }

    if (
      dueDate >
      today
    ) {
      return (
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-700">
          À venir
        </span>
      )
    }
  }

  return (
    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700">
      À payer
    </span>
  )
}

// ============================================================
// CHAMP FORMULAIRE CARTE
// ============================================================

function CardField({
  label,
  name,
  defaultValue,
  type = 'text',
  placeholder,
  required = false,
  maxLength,
  autoComplete,
}: {
  label: string
  name: string
  defaultValue: string
  type?: string
  placeholder?: string
  required?: boolean
  maxLength?: number
  autoComplete?: string
}) {
  return (
    <div>

      <label
        htmlFor={
          name
        }
        className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>

      <input
        id={
          name
        }
        name={
          name
        }
        type={
          type
        }
        defaultValue={
          defaultValue
        }
        placeholder={
          placeholder
        }
        required={
          required
        }
        maxLength={
          maxLength
        }
        autoComplete={
          autoComplete
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      />

    </div>
  )
}

// ============================================================
// HEADER INFO
// ============================================================

function HeaderInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">

      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-black text-white">
        {value}
      </p>

    </div>
  )
}

// ============================================================
// MONTANT CARD
// ============================================================

function AmountCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-slate-900">
        {formatMoney(
          value
        )}
      </p>

    </div>
  )
}

// ============================================================
// BADGE PRESTATAIRE
// ============================================================

function ProviderBadge({
  provider,
}: {
  provider: string
}) {
  const short =
    provider ===
      'orange_money'
      ? 'OM'
      : provider ===
          'mtn_momo'
        ? 'MTN'
        : provider ===
            'moov_money'
          ? 'MOOV'
          : provider ===
              'wave'
            ? 'W'
            : 'PAY'

  return (
    <span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-700">
      {short}
    </span>
  )
}

// ============================================================
// LIBELLE PRESTATAIRE
// ============================================================

function providerLabel(
  value: string
) {
  switch (
    value
      .trim()
      .toLowerCase()
  ) {
    case 'wave':
      return 'Wave'

    case 'orange_money':
      return 'Orange Money'

    case 'mtn_momo':
      return 'MTN MoMo'

    case 'moov_money':
      return 'Moov Money'

    default:
      return value
  }
}

// ============================================================
// FORMAT FCFA
// ============================================================

function formatMoney(
  value: number
) {
  return (
    new Intl.NumberFormat(
      'fr-FR',
      {
        maximumFractionDigits:
          0,
      }
    ).format(
      value
    ) +
    ' FCFA'
  )
}

// ============================================================
// DATE
// ============================================================

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        'long',

      year:
        'numeric',

      timeZone:
        'UTC',
    }
  ).format(
    new Date(
      `${value}T00:00:00Z`
    )
  )
}

// ============================================================
// PERIODE
// ============================================================

function formatPeriod(
  value: string
) {
  const formatted =
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        month:
          'long',

        year:
          'numeric',

        timeZone:
          'UTC',
      }
    ).format(
      new Date(
        `${value}T00:00:00Z`
      )
    )

  return (
    formatted
      .charAt(0)
      .toUpperCase() +
    formatted.slice(1)
  )
}

// ============================================================
// COULEUR SURE
// ============================================================

function safeColor(
  value:
    | string
    | null
    | undefined,

  fallback: string
) {
  return (
    value &&
    /^#[0-9A-Fa-f]{6}$/
      .test(
        value
      )
  )
    ? value
    : fallback
}
