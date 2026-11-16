import {
  redirect,
} from 'next/navigation'

// ============================================================
// EWUKAI
//
// La configuration technique CinetPay est désormais globale
// et réservée à l'administration de la plateforme.
//
// Une mutuelle configure uniquement ses comptes de réception
// depuis /parametres/paiements.
// ============================================================

export default function CinetPayOrganizationSettingsPage() {
  redirect(
    '/parametres/paiements'
  )
}
