import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import {
  createClient,
} from '@/lib/supabase/server'

import PrintButton from './print-button'

// ============================================================
// AFRI CLUB
// RECU DE PAIEMENT
//
// Visible par :
// - Responsable
// - Président
// - Trésorier
// - Secrétaire
// - Auditeur
//
// Un membre peut uniquement consulter SES propres reçus.
// La sécurité est contrôlée côté PostgreSQL par :
// public.get_payment_receipt()
// ============================================================

type ReceiptPageProps = {
  params: Promise<{
    id: string
  }>

  searchParams: Promise<{
    obligation?: string
    year?: string
  }>
}

type ReceiptPayment = {
  id: string
  amount: number | string
  payment_method: string
  payment_reference:
    | string
    | null

  receipt_number: string

  status: string

  notes:
    | string
    | null

  paid_at:
    | string
    | null

  created_at: string
}

type ReceiptOrganization = {
  id: string
  name: string

  short_name:
    | string
    | null
}

type ReceiptMember = {
  id: string
  member_number: string
  first_name: string
  last_name: string

  phone:
    | string
    | null
}

type ReceiptLine = {
  obligation_id: string
  period_start: string
  due_date: string
  contribution_name: string
  frequency: string
  is_exceptional: boolean
  amount: number | string
}

type ReceiptData = {
  viewer_mode:
    | 'management'
    | 'member'

  payment: ReceiptPayment

  organization:
    ReceiptOrganization

  member:
    ReceiptMember

  lines:
    ReceiptLine[]
}

// ============================================================
// PAGE
// ============================================================

export default async function ReceiptPage({
  params,
  searchParams,
}: ReceiptPageProps) {
  const {
    id,
  } =
    await params

  const query =
    await searchParams

  const supabase =
    await createClient()

  // ==========================================================
  // 1. AUTHENTIFICATION
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
      '/login'
    )
  }

  // ==========================================================
  // 2. CHARGER LE RECU SECURISE
  //
  // La fonction PostgreSQL décide si l'utilisateur peut
  // consulter ce reçu.
  //
  // Même si quelqu'un modifie manuellement l'URL,
  // il ne peut pas voir le reçu d'un autre membre.
  // ==========================================================

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_payment_receipt',
      {
        target_payment_id:
          id,
      }
    )

  if (
    error ||
    !data
  ) {
    console.error(
      'AFRI CLUB - secure receipt:',
      error
        ? {
            code:
              error.code,

            message:
              error.message,
          }
        : null
    )

    // On ne révèle pas si le reçu existe ou non.
    notFound()
  }

  const receipt =
    data as ReceiptData

  const payment =
    receipt.payment

  const organization =
    receipt.organization

  const member =
    receipt.member

  const lines =
    receipt.lines ??
    []

  // ==========================================================
  // 3. MONTANT TOTAL AFFECTE
  // ==========================================================

  const allocatedTotal =
    lines.reduce(
      (
        total,
        line
      ) =>
        total +
        Number(
          line.amount
        ),
      0
    )

  const paymentAmount =
    Number(
      payment.amount
    )

  // ==========================================================
  // 4. NATURE DU RECU
  // ==========================================================

  const hasExceptional =
    lines.some(
      (
        line
      ) =>
        Boolean(
          line.is_exceptional
        )
    )

  // ==========================================================
  // 5. DATE DU RECU
  // ==========================================================

  const paymentDate =
    payment.paid_at ??
    payment.created_at

  // ==========================================================
  // 6. RETOUR
  // ==========================================================

  const year =
    Number(
      query.year
    )

  const hasValidReturn =
    Boolean(
      query.obligation
    ) &&
    Number.isInteger(
      year
    ) &&
    year >=
      2000 &&
    year <=
      2100

  let returnHref =
    '/contributions/collection'

  let returnLabel =
    '← Retour au recouvrement'

  if (
    receipt.viewer_mode ===
    'member'
  ) {
    returnHref =
      '/my-space#paiements'

    returnLabel =
      '← Retour à mon espace'
  } else if (
    hasValidReturn
  ) {
    returnHref =
      `/contributions/collection/${query.obligation}?year=${year}`

    returnLabel =
      '← Retour au membre'
  }

  // ==========================================================
  // 7. RENDU
  // ==========================================================

  return (
    <main className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">

      <div className="mx-auto max-w-4xl px-4 print:max-w-none print:px-0">

        {/* ================================================== */}
        {/* BARRE D'ACTIONS */}
        {/* ================================================== */}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">

          <Link
            href={
              returnHref
            }
            className="rounded-xl border bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            {
              returnLabel
            }
          </Link>

          <PrintButton />

        </div>

        {/* ================================================== */}
        {/* RECU */}
        {/* ================================================== */}

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">

          {/* ================================================= */}
          {/* ENTETE */}
          {/* ================================================= */}

          <header className="border-b border-slate-200 px-8 py-8">

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

              <div>

                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
                  Reçu de paiement
                </p>

                <h1 className="mt-2 text-2xl font-bold text-slate-900">
                  {
                    organization.name
                  }
                </h1>

                {organization.short_name && (
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {
                      organization.short_name
                    }
                  </p>
                )}

              </div>

              <div className="sm:text-right">

                <p className="text-sm font-medium text-slate-500">
                  {
                    hasExceptional
                      ? 'REÇU DE COTISATION EXCEPTIONNELLE'
                      : 'REÇU DE COTISATION'
                  }
                </p>

                <p className="mt-2 font-mono text-lg font-bold text-slate-900">
                  {
                    payment.receipt_number
                  }
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {
                    formatDateTime(
                      paymentDate
                    )
                  }
                </p>

              </div>

            </div>

          </header>

          {/* ================================================= */}
          {/* STATUT */}
          {/* ================================================= */}

          {payment.status !==
            'confirmed' && (
            <div className="border-b border-red-200 bg-red-50 px-8 py-4 text-center font-bold text-red-700">
              PAIEMENT ANNULÉ / INVERSÉ
            </div>
          )}

          {/* ================================================= */}
          {/* MEMBRE */}
          {/* ================================================= */}

          <section className="grid gap-6 border-b border-slate-200 px-8 py-6 sm:grid-cols-2">

            <div>

              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Membre
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {
                  member.last_name
                }{' '}
                {
                  member.first_name
                }
              </p>

              <p className="mt-1 font-mono text-sm font-semibold text-emerald-700">
                {
                  member.member_number
                }
              </p>

              {member.phone && (
                <p className="mt-2 text-sm text-slate-500">
                  {
                    member.phone
                  }
                </p>
              )}

            </div>

            <div className="sm:text-right">

              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Montant reçu
              </p>

              <p className="mt-2 text-3xl font-bold text-emerald-700">
                {
                  formatMoney(
                    paymentAmount
                  )
                }
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {
                  paymentMethodLabel(
                    payment.payment_method
                  )
                }
              </p>

            </div>

          </section>

          {/* ================================================= */}
          {/* INFORMATION EXCEPTIONNELLE */}
          {/* ================================================= */}

          {hasExceptional && (
            <section className="border-b border-amber-200 bg-amber-50 px-8 py-4">

              <p className="font-semibold text-amber-900">
                Cotisation exceptionnelle
              </p>

              <p className="mt-1 text-sm text-amber-800">
                Ce versement est affecté à un appel exceptionnel de la mutuelle
                et reste distinct des cotisations régulières.
              </p>

            </section>
          )}

          {/* ================================================= */}
          {/* REFERENCE / OBSERVATION */}
          {/* ================================================= */}

          {(payment.payment_reference ||
            payment.notes) && (
            <section className="grid gap-5 border-b border-slate-200 bg-slate-50 px-8 py-5 sm:grid-cols-2">

              {payment.payment_reference && (
                <div>

                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Référence
                  </p>

                  <p className="mt-1 font-medium text-slate-800">
                    {
                      payment.payment_reference
                    }
                  </p>

                </div>
              )}

              {payment.notes && (
                <div>

                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Observation
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {
                      payment.notes
                    }
                  </p>

                </div>
              )}

            </section>
          )}

          {/* ================================================= */}
          {/* AFFECTATIONS */}
          {/* ================================================= */}

          <section className="px-8 py-7">

            <div className="mb-5">

              <h2 className="text-lg font-bold text-slate-900">
                Détail de l&apos;affectation
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {
                  hasExceptional
                    ? 'Affectation du versement à l’appel exceptionnel concerné.'
                    : 'Répartition du versement sur les cotisations du membre.'
                }
              </p>

            </div>

            {lines.length ===
            0 ? (
              <div className="rounded-xl bg-amber-50 p-5 text-sm text-amber-800">
                Aucune affectation trouvée pour ce paiement.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">

                <table className="w-full text-left">

                  <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                    <tr>

                      <th className="px-4 py-3">
                        Période
                      </th>

                      <th className="px-4 py-3">
                        Nature
                      </th>

                      <th className="px-4 py-3">
                        Fréquence
                      </th>

                      <th className="px-4 py-3 text-right">
                        Montant affecté
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {lines.map(
                      (
                        line
                      ) => (
                        <tr
                          key={
                            line.obligation_id
                          }
                          className="border-b last:border-0"
                        >

                          <td className="px-4 py-4 font-semibold text-slate-900">
                            {
                              formatPeriod(
                                line.period_start
                              )
                            }
                          </td>

                          <td className="px-4 py-4 text-slate-700">
                            {
                              line.contribution_name
                            }
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-500">
                            {
                              frequencyLabel(
                                line.frequency
                              )
                            }
                          </td>

                          <td className="px-4 py-4 text-right font-bold text-slate-900">
                            {
                              formatMoney(
                                Number(
                                  line.amount
                                )
                              )
                            }
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                  <tfoot className="border-t-2 border-slate-300 bg-slate-50">

                    <tr>

                      <td
                        colSpan={
                          3
                        }
                        className="px-4 py-4 text-right font-bold text-slate-700"
                      >
                        TOTAL
                      </td>

                      <td className="px-4 py-4 text-right text-lg font-bold text-emerald-700">
                        {
                          formatMoney(
                            allocatedTotal
                          )
                        }
                      </td>

                    </tr>

                  </tfoot>

                </table>

              </div>
            )}

          </section>

          {/* ================================================= */}
          {/* CONTROLE DE COHERENCE */}
          {/* ================================================= */}

          {allocatedTotal !==
            paymentAmount && (
            <section className="border-t border-amber-200 bg-amber-50 px-8 py-4 text-sm text-amber-900">

              <strong>
                Attention :
              </strong>{' '}

              le montant du paiement et le montant affecté ne correspondent pas.

            </section>
          )}

          {/* ================================================= */}
          {/* SIGNATURES */}
          {/* ================================================= */}

          <section className="grid min-h-40 gap-12 border-t border-slate-200 px-8 py-8 sm:grid-cols-2">

            <div>

              <p className="text-sm font-semibold text-slate-700">
                Le membre
              </p>

              <div className="mt-16 border-t border-slate-300 pt-2 text-xs text-slate-400">
                Signature
              </div>

            </div>

            <div className="sm:text-right">

              <p className="text-sm font-semibold text-slate-700">
                Le Trésorier / Caissier
              </p>

              <div className="mt-16 border-t border-slate-300 pt-2 text-xs text-slate-400">
                Signature et cachet
              </div>

            </div>

          </section>

          {/* ================================================= */}
          {/* FOOTER */}
          {/* ================================================= */}

          <footer className="border-t bg-slate-50 px-8 py-4 text-center text-xs text-slate-500">

            Reçu généré électroniquement par la mutuelle.
            Conservez ce document comme justificatif de paiement.

          </footer>

        </article>

      </div>

    </main>
  )
}

// ============================================================
// FORMAT MONTANT
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
      Number(
        value
      )
    ) +
    ' FCFA'
  )
}

// ============================================================
// FORMAT PERIODE
// ============================================================

function formatPeriod(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      month:
        'long',

      year:
        'numeric',

      timeZone:
        'Africa/Abidjan',
    }
  ).format(
    new Date(
      `${date}T00:00:00Z`
    )
  )
}

// ============================================================
// FORMAT DATE + HEURE
// ============================================================

function formatDateTime(
  date: string
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle:
        'long',

      timeStyle:
        'short',

      timeZone:
        'Africa/Abidjan',
    }
  ).format(
    new Date(
      date
    )
  )
}

// ============================================================
// MODE DE PAIEMENT
// ============================================================

function paymentMethodLabel(
  method: string
) {
  switch (
    method
  ) {
    case 'cash':
      return 'Espèces'

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

    case 'other':
      return 'Autre'

    default:
      return method
  }
}

// ============================================================
// FREQUENCE
// ============================================================

function frequencyLabel(
  frequency: string
) {
  switch (
    frequency
  ) {
    case 'monthly':
      return 'Mensuelle'

    case 'quarterly':
      return 'Trimestrielle'

    case 'annual':
      return 'Annuelle'

    case 'one_time':
      return 'Ponctuelle'

    case 'exceptional':
      return 'Exceptionnelle'

    default:
      return frequency ||
        '—'
  }
}