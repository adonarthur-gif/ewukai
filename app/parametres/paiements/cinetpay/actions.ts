'use server'

import {
  redirect,
} from 'next/navigation'

// ============================================================
// EWUKAI
//
// La configuration CinetPay n'est plus gérée au niveau
// des mutuelles.
//
// Les identifiants CinetPay sont exclusivement configurés
// dans l'administration globale EWUKAI.
//
// Ces anciennes actions sont conservées temporairement
// uniquement pour éviter toute dépendance cassée.
// Aucune écriture en base n'est désormais possible ici.
// ============================================================

export async function saveCinetPayConfiguration(
  _formData: FormData
) {
  redirect(
    '/parametres/paiements'
  )
}

export async function disableCinetPayConfiguration() {
  redirect(
    '/parametres/paiements'
  )
}

export async function enableCinetPayConfiguration() {
  redirect(
    '/parametres/paiements'
  )
}
