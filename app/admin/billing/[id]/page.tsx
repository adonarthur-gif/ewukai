import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  requirePlatformSuperAdmin,
} from '@/lib/auth/platform-admin'

// ============================================================
// AFRI CLUB
// SUPER ADMIN
// FICHE D'UNE FACTURE
//
// IMPORTANT :
//
// Cette page est une page de SUPERVISION.
//
// Le Super-admin :
// - consulte la facture ;
// - consulte le paiement ;
// - consulte la référence opérateur ;
// - consulte les dates ;
// - peut accéder à l'organisation et à l'abonnement.
//
// Le Super-admin NE VALIDE PAS le paiement.
//
// Le paiement normal suit :
//
// Prestataire
//      ↓
// Webhook serveur
//      ↓
// Confirmation automatique
//      ↓
// Facture payée
//      ↓
// Abonnement activé 30 jours
//
// ============================================================


// ============================================================
// TYPES
// ============================================================

type NumberValue =
  | number
  | string
  | null


type PageProps = {
  params: Promise<{
    id: string
  }>
}


type Invoice = {
  id: string

  invoice_number: string

  organization_id: string

  organization_name: string

  organization_short_name:
    | string
    | null

  subscription_id: string

  plan_id:
    | string
    | null

  plan_code: string

  plan_name: string

  billing_cycle: string

  period_start:
    | string
    | null

  period_end:
    | string
    | null

  currency: string

  subtotal_xof:
    NumberValue

  discount_xof:
    NumberValue

  tax_xof:
    NumberValue

  total_xof:
    NumberValue

  amount_paid_xof:
    NumberValue

  amount_remaining_xof:
    NumberValue

  stored_status: string

  effective_status: string

  issued_at:
    | string
    | null

  due_at:
    | string
    | null

  paid_at:
    | string
    | null

  cancelled_at:
    | string
    | null

  description:
    | string
    | null

  notes:
    | string
    | null

  created_at:
    | string
    | null

  updated_at:
    | string
    | null
}


type Payment = {
  id: string

  amount_xof:
    NumberValue

  currency: string

  payment_method: string

  provider:
    | string
    | null

  provider_transaction_ref:
    | string
    | null

  status: string

  paid_at:
    | string
    | null

  confirmed_at:
    | string
    | null

  failed_at:
    | string
    | null

  notes:
    | string
    | null

  created_by:
    | string
    | null

  created_at:
    | string
    | null
}


type InvoiceDetail = {
  invoice: Invoice

  payments: Payment[]
}


// ============================================================
// PAGE
// ============================================================

export default async function AdminInvoiceDetailPage({
  params,
}: PageProps) {
  const {
    id,
  } =
    await params


  // ==========================================================
  // UUID
  // ==========================================================

  if (
    !isUuid(
      id
    )
  ) {
    notFound()
  }


  // ==========================================================
  // SUPER ADMIN
  // ==========================================================

  const {
    supabase,
  } =
    await requirePlatformSuperAdmin()


  // ==========================================================
  // CHARGEMENT DE LA FACTURE
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_platform_subscription_invoice_detail',
      {
        target_invoice_id:
          id,
      }
    )


  // ==========================================================
  // ERREUR
  // ==========================================================

  if (
    error
  ) {
    console.error(
      'AFRI CLUB - invoice detail:',
      error
    )


    if (
      error.message
        ?.toLowerCase()
        .includes(
          'invoice not found'
        )
    ) {
      notFound()
    }


    throw new Error(
      'Impossible de charger cette facture.'
    )
  }


  if (
    !data
  ) {
    notFound()
  }


  // ==========================================================
  // NORMALISATION
  // ==========================================================

  const detail =
    data as unknown as InvoiceDetail


  const invoice =
    detail.invoice


  if (
    !invoice
  ) {
    notFound()
  }


  const payments =
    Array.isArray(
      detail.payments
    )
      ? detail.payments
      : []


  const total =
    numberValue(
      invoice.total_xof
    )


  const paid =
    numberValue(
      invoice.amount_paid_xof
    )


  const remaining =
    numberValue(
      invoice.amount_remaining_xof
    )


  const payment =
    payments.find(
      item =>
        item.status ===
        'confirmed'
    ) ??
    payments[0] ??
    null


  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ==================================================== */}
      {/* HERO */}
      {/* ==================================================== */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <Link
            href="/admin/billing"
            className="text-sm font-black text-slate-500 transition hover:text-slate-900"
          >
            ← Facturation
          </Link>


          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Facture Afri Club
              </p>


              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {
                  invoice.invoice_number
                }
              </h1>


              <Link
                href={`/admin/organizations/${invoice.organization_id}`}
                className="mt-3 inline-block text-sm font-black text-slate-600 transition hover:text-emerald-700"
              >
                {invoice.organization_short_name ||
                  invoice.organization_name}
              </Link>


              {invoice.organization_short_name && (
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {
                    invoice.organization_name
                  }
                </p>
              )}

            </div>


            <InvoiceStatus
              status={
                invoice.effective_status
              }
              large
            />

          </div>

        </div>

      </section>


      {/* ==================================================== */}
      {/* CONTENU */}
      {/* ==================================================== */}

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">

        {/* ================================================== */}
        {/* KPI */}
        {/* ================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            label="Montant facturé"
            value={
              formatMoney(
                total
              )
            }
            note={
              invoice.plan_name
            }
          />


          <StatCard
            label="Encaissé"
            value={
              formatMoney(
                paid
              )
            }
            note={
              invoice.stored_status ===
              'paid'
                ? 'Paiement confirmé'
                : 'En attente de confirmation'
            }
            success={
              paid >
              0
            }
          />


          <StatCard
            label="Reste"
            value={
              formatMoney(
                remaining
              )
            }
            note={
              remaining ===
              0
                ? 'Facture soldée'
                : 'Montant attendu'
            }
            warning={
              remaining >
              0
            }
          />


          <StatCard
            label="Échéance"
            value={
              formatDate(
                invoice.due_at
              )
            }
            note={
              formatInvoiceStatus(
                invoice.effective_status
              )
            }
            danger={
              invoice.effective_status ===
              'overdue'
            }
          />

        </section>


        {/* ================================================== */}
        {/* FACTURE + PAIEMENT */}
        {/* ================================================== */}

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">

          {/* ================================================== */}
          {/* DETAILS FACTURE */}
          {/* ================================================== */}

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <SectionHeader
              title="Détails de la facture"
              description="Informations commerciales liées à cet abonnement Afri Club."
            />


            <div className="grid gap-5 p-6 sm:grid-cols-2">

              <Info
                label="Numéro"
                value={
                  invoice.invoice_number
                }
              />


              <Info
                label="Plan"
                value={
                  invoice.plan_name
                }
              />


              <Info
                label="Cycle"
                value={
                  formatBillingCycle(
                    invoice.billing_cycle
                  )
                }
              />


              <Info
                label="Date d'émission"
                value={
                  formatDateTime(
                    invoice.issued_at
                  )
                }
              />


              <Info
                label="Début de période"
                value={
                  formatDateTime(
                    invoice.period_start
                  )
                }
              />


              <Info
                label="Fin de période"
                value={
                  formatDateTime(
                    invoice.period_end
                  )
                }
              />


              <Info
                label="Échéance"
                value={
                  formatDateTime(
                    invoice.due_at
                  )
                }
              />


              <Info
                label="Statut"
                value={
                  formatInvoiceStatus(
                    invoice.effective_status
                  )
                }
              />

            </div>


            {/* ================================================== */}
            {/* MONTANTS */}
            {/* ================================================== */}

            <div className="border-t border-slate-100 p-6">

              <MoneyLine
                label="Sous-total"
                value={
                  numberValue(
                    invoice.subtotal_xof
                  )
                }
              />


              <MoneyLine
                label="Réduction"
                value={
                  numberValue(
                    invoice.discount_xof
                  )
                }
              />


              <MoneyLine
                label="Taxes"
                value={
                  numberValue(
                    invoice.tax_xof
                  )
                }
              />


              <div className="my-4 border-t border-slate-100" />


              <MoneyLine
                label="Total"
                value={
                  total
                }
                strong
              />


              <MoneyLine
                label="Encaissé"
                value={
                  paid
                }
                success
              />


              <MoneyLine
                label="Reste"
                value={
                  remaining
                }
                strong
              />

            </div>


            {/* ================================================== */}
            {/* DESCRIPTION */}
            {/* ================================================== */}

            {(invoice.description ||
              invoice.notes) && (

              <div className="border-t border-slate-100 p-6">

                {invoice.description && (

                  <div>

                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Description
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {
                        invoice.description
                      }
                    </p>

                  </div>

                )}


                {invoice.notes && (

                  <div className="mt-5">

                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Note
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {
                        invoice.notes
                      }
                    </p>

                  </div>

                )}

              </div>

            )}

          </div>


          {/* ================================================== */}
          {/* PAIEMENT AUTOMATIQUE */}
          {/* ================================================== */}

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <SectionHeader
              title="Paiement"
              description="Supervision du règlement de cette facture."
            />


            <div className="space-y-4 p-6">

              {/* ================================================== */}
              {/* PAYE */}
              {/* ================================================== */}

              {invoice.stored_status ===
              'paid' ? (

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

                  <div className="flex items-start gap-3">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-700">
                      ✓
                    </div>


                    <div>

                      <p className="font-black text-emerald-950">
                        Paiement confirmé
                      </p>


                      <p className="mt-2 text-sm leading-6 text-emerald-800">
                        Cette facture a été réglée
                        intégralement. L&apos;abonnement
                        correspondant est traité
                        automatiquement par Afri Club.
                      </p>

                    </div>

                  </div>


                  <div className="mt-5 rounded-xl bg-white/70 p-4">

                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      Montant encaissé
                    </p>

                    <p className="mt-1 text-2xl font-black text-emerald-950">
                      {formatMoney(
                        paid
                      )}
                    </p>

                  </div>


                  <div className="mt-4">

                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      Confirmation
                    </p>

                    <p className="mt-1 text-sm font-black text-emerald-950">
                      {formatDateTime(
                        invoice.paid_at
                      )}
                    </p>

                  </div>

                </div>

              ) : invoice.stored_status ===
                'cancelled' ? (

                /* ================================================== */
                /* ANNULE */
                /* ================================================== */

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

                  <p className="font-black text-slate-900">
                    Facture annulée
                  </p>


                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Cette facture n&apos;est plus
                    payable et ne doit déclencher
                    aucune activation.
                  </p>


                  {invoice.cancelled_at && (

                    <p className="mt-4 text-xs font-bold text-slate-400">
                      Annulée le{' '}
                      {formatDateTime(
                        invoice.cancelled_at
                      )}
                    </p>

                  )}

                </div>

              ) : (

                /* ================================================== */
                /* ATTENTE */
                /* ================================================== */

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

                  <div className="flex items-start gap-3">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-black text-blue-700">
                      …
                    </div>


                    <div>

                      <p className="font-black text-blue-950">
                        En attente du paiement
                      </p>


                      <p className="mt-2 text-sm leading-6 text-blue-800">
                        Afri Club attend la confirmation
                        serveur du prestataire de
                        paiement.
                      </p>

                    </div>

                  </div>


                  <div className="mt-5 rounded-xl bg-white/70 p-4">

                    <p className="text-xs font-black uppercase tracking-wide text-blue-600">
                      Montant exact attendu
                    </p>

                    <p className="mt-1 text-2xl font-black text-blue-950">
                      {formatMoney(
                        remaining
                      )}
                    </p>

                  </div>


                  <p className="mt-4 text-xs leading-5 text-blue-700">
                    Aucun paiement partiel n&apos;est
                    prévu. Le paiement doit correspondre
                    exactement au montant de la facture.
                  </p>

                </div>

              )}


              {/* ================================================== */}
              {/* AUCUNE VALIDATION ADMIN */}
              {/* ================================================== */}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">

                <p className="text-sm font-black text-amber-950">
                  Aucune validation manuelle
                </p>


                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Le Super-administrateur ne valide pas
                  les paiements du parcours normal. Il
                  intervient uniquement pour la
                  supervision, le support, les anomalies
                  ou une investigation justifiée.
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* ================================================== */}
        {/* TRANSACTION CONFIRMEE */}
        {/* ================================================== */}

        {payment && (

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <SectionHeader
              title="Transaction"
              description="Informations techniques du paiement associé à cette facture."
            />


            <div className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">

              <Info
                label="Montant"
                value={
                  formatMoney(
                    numberValue(
                      payment.amount_xof
                    )
                  )
                }
              />


              <Info
                label="Mode"
                value={
                  formatPaymentMethod(
                    payment.payment_method
                  )
                }
              />


              <Info
                label="Prestataire"
                value={
                  formatProvider(
                    payment.provider
                  )
                }
              />


              <Info
                label="Statut"
                value={
                  formatPaymentStatus(
                    payment.status
                  )
                }
              />


              <Info
                label="Paiement effectué"
                value={
                  formatDateTime(
                    payment.paid_at
                  )
                }
              />


              <Info
                label="Confirmation"
                value={
                  formatDateTime(
                    payment.confirmed_at
                  )
                }
              />


              <Info
                label="Référence opérateur"
                value={
                  payment.provider_transaction_ref ||
                  '—'
                }
              />


              <Info
                label="Enregistrement"
                value={
                  formatDateTime(
                    payment.created_at
                  )
                }
              />

            </div>


            {payment.notes && (

              <div className="border-t border-slate-100 px-6 py-5">

                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Note technique
                </p>


                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {
                    payment.notes
                  }
                </p>

              </div>

            )}

          </section>

        )}


        {/* ================================================== */}
        {/* HISTORIQUE DES PAIEMENTS */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <SectionHeader
            title="Historique des paiements"
            description={`${payments.length} transaction(s) associée(s) à cette facture.`}
          />


          {payments.length ===
          0 ? (

            <div className="px-6 py-14 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg">
                ◫
              </div>


              <p className="mt-4 font-black text-slate-900">
                Aucun paiement confirmé
              </p>


              <p className="mt-2 text-sm leading-6 text-slate-500">
                La transaction apparaîtra ici dès
                qu&apos;Afri Club recevra et validera
                techniquement la confirmation du
                prestataire.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-slate-100">

              {payments.map(
                item => (

                  <article
                    key={
                      item.id
                    }
                    className="p-6"
                  >

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <p className="text-xl font-black text-slate-950">
                            {formatMoney(
                              numberValue(
                                item.amount_xof
                              )
                            )}
                          </p>


                          <PaymentStatus
                            status={
                              item.status
                            }
                          />

                        </div>


                        <p className="mt-2 text-sm font-bold text-slate-600">
                          {formatPaymentMethod(
                            item.payment_method
                          )}
                        </p>


                        {item.provider && (

                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            Prestataire :{' '}
                            {formatProvider(
                              item.provider
                            )}
                          </p>

                        )}


                        {item.provider_transaction_ref && (

                          <p className="mt-1 break-all text-xs font-semibold text-slate-400">
                            Référence :{' '}
                            {
                              item.provider_transaction_ref
                            }
                          </p>

                        )}


                        {item.notes && (

                          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                            {
                              item.notes
                            }
                          </p>

                        )}

                      </div>


                      <div className="sm:text-right">

                        <p className="text-sm font-black text-slate-700">
                          {formatDateTime(
                            item.confirmed_at ||
                            item.paid_at ||
                            item.created_at
                          )}
                        </p>


                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {item.status ===
                          'confirmed'
                            ? 'Confirmation enregistrée'
                            : 'Transaction enregistrée'}
                        </p>

                      </div>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>


        {/* ================================================== */}
        {/* SUPERVISION / AUDIT */}
        {/* ================================================== */}

        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6">

          <p className="font-black text-blue-950">
            Traçabilité Afri Club
          </p>


          <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-800">
            Les informations de facturation et de
            transaction sont conservées afin de
            faciliter la supervision, le traitement
            des anomalies, le support et, lorsqu&apos;une
            demande légalement fondée l&apos;exige,
            la production d&apos;éléments de traçabilité.
          </p>


          <p className="mt-3 max-w-4xl text-xs leading-5 text-blue-700">
            L&apos;accès administratif aux informations
            sensibles devra lui-même rester contrôlé
            et journalisé dans le système d&apos;audit
            de la plateforme.
          </p>

        </section>


        {/* ================================================== */}
        {/* NAVIGATION */}
        {/* ================================================== */}

        <section className="flex flex-col gap-3 sm:flex-row">

          <Link
            href={`/admin/subscriptions/${invoice.organization_id}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Voir l&apos;abonnement
          </Link>


          <Link
            href={`/admin/organizations/${invoice.organization_id}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Voir l&apos;organisation
          </Link>


          <Link
            href="/admin/billing"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Toutes les factures
          </Link>

        </section>

      </div>

    </main>
  )
}


// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  label,
  value,
  note,
  warning = false,
  danger = false,
  success = false,
}: {
  label: string
  value: string
  note: string

  warning?: boolean
  danger?: boolean
  success?: boolean
}) {
  let containerClasses =
    'border-slate-200 bg-white'

  let valueClasses =
    'text-slate-950'


  if (
    warning
  ) {
    containerClasses =
      'border-amber-200 bg-amber-50'

    valueClasses =
      'text-amber-900'
  }


  if (
    danger
  ) {
    containerClasses =
      'border-red-200 bg-red-50'

    valueClasses =
      'text-red-900'
  }


  if (
    success
  ) {
    containerClasses =
      'border-emerald-200 bg-emerald-50'

    valueClasses =
      'text-emerald-900'
  }


  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${containerClasses}`}
    >

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>


      <p
        className={`mt-3 text-2xl font-black ${valueClasses}`}
      >
        {
          value
        }
      </p>


      <p className="mt-2 text-xs font-semibold text-slate-500">
        {
          note
        }
      </p>

    </div>
  )
}


// ============================================================
// SECTION HEADER
// ============================================================

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-b border-slate-100 px-6 py-5">

      <h2 className="text-lg font-black text-slate-950">
        {
          title
        }
      </h2>


      <p className="mt-1 text-sm leading-6 text-slate-500">
        {
          description
        }
      </p>

    </div>
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
    <div className="min-w-0">

      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>


      <p className="mt-2 break-words text-sm font-black text-slate-800">
        {
          value
        }
      </p>

    </div>
  )
}


// ============================================================
// MONEY LINE
// ============================================================

function MoneyLine({
  label,
  value,
  strong = false,
  success = false,
}: {
  label: string
  value: number

  strong?: boolean
  success?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-2">

      <span
        className={
          strong
            ? 'font-black text-slate-900'
            : 'text-sm font-semibold text-slate-500'
        }
      >
        {
          label
        }
      </span>


      <span
        className={`${
          strong
            ? 'text-lg font-black'
            : 'text-sm font-black'
        } ${
          success
            ? 'text-emerald-700'
            : 'text-slate-900'
        }`}
      >
        {formatMoney(
          value
        )}
      </span>

    </div>
  )
}


// ============================================================
// STATUT FACTURE
// ============================================================

function InvoiceStatus({
  status,
  large = false,
}: {
  status: string
  large?: boolean
}) {
  const styles:
    Record<
      string,
      string
    > = {
      open:
        'bg-blue-50 text-blue-700',

      overdue:
        'bg-red-50 text-red-700',

      paid:
        'bg-emerald-50 text-emerald-700',

      cancelled:
        'bg-slate-100 text-slate-500',

      draft:
        'bg-amber-50 text-amber-700',

      partial:
        'bg-amber-50 text-amber-700',
    }


  return (
    <span
      className={`inline-flex w-fit whitespace-nowrap rounded-full font-black uppercase ${
        large
          ? 'px-4 py-2 text-xs'
          : 'px-2.5 py-1 text-[10px]'
      } ${
        styles[status] ??
        'bg-slate-100 text-slate-600'
      }`}
    >
      {formatInvoiceStatus(
        status
      )}
    </span>
  )
}


// ============================================================
// STATUT PAIEMENT
// ============================================================

function PaymentStatus({
  status,
}: {
  status: string
}) {
  const styles:
    Record<
      string,
      string
    > = {
      confirmed:
        'bg-emerald-50 text-emerald-700',

      pending:
        'bg-blue-50 text-blue-700',

      failed:
        'bg-red-50 text-red-700',

      cancelled:
        'bg-slate-100 text-slate-500',

      refunded:
        'bg-violet-50 text-violet-700',
    }


  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
        styles[status] ??
        'bg-slate-100 text-slate-600'
      }`}
    >
      {formatPaymentStatus(
        status
      )}
    </span>
  )
}


// ============================================================
// HELPERS
// ============================================================

function numberValue(
  value: unknown
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
// MONEY
// ============================================================

function formatMoney(
  value: number
) {
  return `${Math.round(
    value
  ).toLocaleString(
    'fr-FR'
  )} FCFA`
}


// ============================================================
// DATE
// ============================================================

function formatDate(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return '—'
  }


  const date =
    new Date(
      value
    )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }


  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    }
  ).format(
    date
  )
}


// ============================================================
// DATE + HEURE
// ============================================================

function formatDateTime(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return '—'
  }


  const date =
    new Date(
      value
    )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }


  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',

      hour:
        '2-digit',

      minute:
        '2-digit',
    }
  ).format(
    date
  )
}


// ============================================================
// CYCLE
// ============================================================

function formatBillingCycle(
  value: string
) {
  switch (
    value
  ) {
    case 'monthly':
      return '30 jours'

    case 'yearly':
      return 'Annuel'

    case 'free':
      return 'Gratuit'

    case 'custom':
      return 'Personnalisé'

    default:
      return value
  }
}


// ============================================================
// STATUT FACTURE
// ============================================================

function formatInvoiceStatus(
  status: string
) {
  switch (
    status
  ) {
    case 'open':
      return 'À payer'

    case 'overdue':
      return 'En retard'

    case 'paid':
      return 'Payée'

    case 'cancelled':
      return 'Annulée'

    case 'draft':
      return 'Brouillon'

    case 'partial':
      return 'Partiel'

    default:
      return status
  }
}


// ============================================================
// MODE DE PAIEMENT
// ============================================================

function formatPaymentMethod(
  value: string
) {
  switch (
    value
  ) {
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

    case 'manual':
      return 'Manuel'

    case 'other':
      return 'Autre'

    default:
      return value
  }
}


// ============================================================
// PRESTATAIRE
// ============================================================

function formatProvider(
  value:
    | string
    | null
) {
  if (
    !value
  ) {
    return '—'
  }


  switch (
    value.toLowerCase()
  ) {
    case 'wave':
      return 'Wave'

    case 'orange':
    case 'orange_money':
      return 'Orange Money'

    case 'mtn':
    case 'mtn_momo':
      return 'MTN MoMo'

    case 'moov':
    case 'moov_money':
      return 'Moov Money'

    default:
      return value
  }
}


// ============================================================
// STATUT PAIEMENT
// ============================================================

function formatPaymentStatus(
  value: string
) {
  switch (
    value
  ) {
    case 'confirmed':
      return 'Confirmé'

    case 'pending':
      return 'En attente'

    case 'failed':
      return 'Échoué'

    case 'cancelled':
      return 'Annulé'

    case 'refunded':
      return 'Remboursé'

    default:
      return value
  }
}


// ============================================================
// UUID
// ============================================================

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}