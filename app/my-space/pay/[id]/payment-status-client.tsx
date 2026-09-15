'use client'

import Link from 'next/link'
import {
  useEffect,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

// ============================================================
// EWUKAI
// ETAT D'UN PAIEMENT MEMBRE APRES RETOUR CINETPAY
// ============================================================

type Props = {
  attemptId: string | null

  status:
    | string
    | null

  selectedPaymentMethod:
    | string
    | null

  paymentId:
    | string
    | null

  returned: boolean
}

const WAITING_STATUSES =
  new Set([
    'created',
    'checkout_ready',
    'pending',
  ])

// ============================================================
// COMPONENT
// ============================================================

export default function PaymentStatusClient({
  attemptId,
  status,
  selectedPaymentMethod,
  paymentId,
  returned,
}: Props) {
  const router =
    useRouter()

  const [
    checks,
    setChecks,
  ] =
    useState(0)

  const normalizedStatus =
    status
      ?.trim()
      .toLowerCase() ??
    null

  // ==========================================================
  // ACTUALISATION AUTOMATIQUE
  //
  // Le retour navigateur peut arriver quelques secondes avant
  // la notification serveur CinetPay.
  // ==========================================================

  useEffect(() => {
    if (
      !returned ||
      !attemptId ||
      !normalizedStatus ||
      !WAITING_STATUSES.has(
        normalizedStatus
      ) ||
      checks >= 12
    ) {
      return
    }

    const timer =
      window.setTimeout(
        () => {
          setChecks(
            (value) =>
              value + 1
          )

          router.refresh()
        },
        2500
      )

    return () => {
      window.clearTimeout(
        timer
      )
    }
  }, [
    attemptId,
    checks,
    normalizedStatus,
    returned,
    router,
  ])

  // ==========================================================
  // PAS DE RETOUR CINETPAY
  // ==========================================================

  if (!returned) {
    return null
  }

  // ==========================================================
  // TENTATIVE INTROUVABLE
  // ==========================================================

  if (
    !attemptId ||
    !normalizedStatus
  ) {
    return (
      <StatusBox
        tone="neutral"
        title="Retour du paiement reçu"
      >
        <p>
          Nous n&apos;avons pas encore
          retrouvé l&apos;état de cette
          transaction.
        </p>

        <p className="mt-2">
          Consultez votre espace membre
          avant de recommencer un paiement.
        </p>
      </StatusBox>
    )
  }

  // ==========================================================
  // CONFIRME
  // ==========================================================

  if (
    normalizedStatus ===
    'confirmed'
  ) {
    return (
      <StatusBox
        tone="success"
        title="✓ Paiement confirmé"
      >
        <p>
          Votre paiement a été vérifié
          et enregistré par EWUKAI.
        </p>

        {selectedPaymentMethod && (
          <p className="mt-2">
            Moyen choisi :{' '}
            <strong>
              {paymentMethodLabel(
                selectedPaymentMethod
              )}
            </strong>
          </p>
        )}

        {paymentId && (
          <Link
            href={`/contributions/receipts/${encodeURIComponent(
              paymentId
            )}`}
            className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
          >
            Voir mon reçu
          </Link>
        )}
      </StatusBox>
    )
  }

  // ==========================================================
  // ECHEC
  // ==========================================================

  if (
    [
      'failed',
      'cancelled',
      'expired',
    ].includes(
      normalizedStatus
    )
  ) {
    return (
      <StatusBox
        tone="error"
        title="Paiement non effectué"
      >
        <p>
          La transaction n&apos;a pas
          été confirmée.
        </p>

        <p className="mt-2">
          Aucun paiement n&apos;a été
          ajouté à votre cotisation par
          cette tentative.
        </p>
      </StatusBox>
    )
  }

  // ==========================================================
  // ANOMALIE
  // ==========================================================

  if (
    normalizedStatus ===
    'anomaly'
  ) {
    return (
      <StatusBox
        tone="warning"
        title="Paiement à vérifier"
      >
        <p>
          EWUKAI a détecté une
          incohérence lors de la
          vérification de cette
          transaction.
        </p>

        <p className="mt-2">
          Ne recommencez pas immédiatement
          le paiement. Vérifiez d&apos;abord
          votre espace membre ou contactez
          un responsable de la mutuelle.
        </p>
      </StatusBox>
    )
  }

  // ==========================================================
  // EN ATTENTE
  // ==========================================================

  return (
    <StatusBox
      tone="pending"
      title="Vérification du paiement en cours"
    >
      <div className="flex items-start gap-3">

        <span className="mt-1 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />

        <div>

          <p>
            Vous êtes revenu du guichet
            de paiement.
          </p>

          <p className="mt-2">
            EWUKAI attend ou vérifie
            actuellement la confirmation
            du prestataire.
          </p>

          {checks < 12 ? (
            <p className="mt-2 text-xs font-bold">
              Cette page s&apos;actualise
              automatiquement.
            </p>
          ) : (
            <p className="mt-2 text-xs font-bold">
              La confirmation prend plus
              de temps que prévu. Vous
              pouvez revenir à votre espace
              membre et vérifier plus tard.
            </p>
          )}

        </div>

      </div>
    </StatusBox>
  )
}

// ============================================================
// BOX
// ============================================================

function StatusBox({
  tone,
  title,
  children,
}: {
  tone:
    | 'success'
    | 'error'
    | 'warning'
    | 'pending'
    | 'neutral'

  title: string

  children:
    React.ReactNode
}) {
  const styles = {
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-900',

    error:
      'border-red-200 bg-red-50 text-red-900',

    warning:
      'border-amber-200 bg-amber-50 text-amber-900',

    pending:
      'border-blue-200 bg-blue-50 text-blue-900',

    neutral:
      'border-slate-200 bg-slate-50 text-slate-800',
  }

  return (
    <section
      className={`mt-6 rounded-2xl border p-5 ${styles[tone]}`}
    >
      <p className="font-black">
        {title}
      </p>

      <div className="mt-2 text-sm leading-6">
        {children}
      </div>
    </section>
  )
}

// ============================================================
// MODE DE PAIEMENT
// ============================================================

function paymentMethodLabel(
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

    case 'bank_transfer':
      return 'Virement bancaire'

    default:
      return value
  }
}