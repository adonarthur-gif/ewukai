'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import {
  requireCurrentOrganization,
} from '@/lib/auth/current-organization'

// ============================================================
// AFRI CLUB
// RECOUVREMENT DES COTISATIONS
// SERVER ACTIONS
// ============================================================


// ============================================================
// VALIDATION DE LA PERIODE
// ============================================================

const periodSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}$/,
    'Période invalide.'
  )


// ============================================================
// GENERER LES ECHEANCES D'UNE PERIODE
// ============================================================

export async function generateObligations(
  formData: FormData
) {
  // ----------------------------------------------------------
  // 1. VALIDATION
  // ----------------------------------------------------------

  const parsed =
    periodSchema.safeParse(
      formData.get('period')
    )

  if (!parsed.success) {
    redirect(
      '/contributions/collection?error=Période invalide.'
    )
  }

  // ----------------------------------------------------------
  // 2. MUTUELLE ACTIVE
  // ----------------------------------------------------------

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ----------------------------------------------------------
  // 3. AUTORISATION
  // ----------------------------------------------------------

  if (
    ![
      'owner',
      'president',
      'treasurer',
    ].includes(role)
  ) {
    redirect(
      '/contributions/collection?error=Vous ne disposez pas des droits nécessaires.'
    )
  }

  const period =
    parsed.data

  // ----------------------------------------------------------
  // 4. GENERATION
  // ----------------------------------------------------------

  const {
    data,
    error,
  } = await supabase.rpc(
    'generate_contribution_obligations',
    {
      target_organization_id:
        organizationId,

      target_period:
        `${period}-01`,
    }
  )

  // ----------------------------------------------------------
  // 5. ERREUR
  // ----------------------------------------------------------

  if (error) {
    console.error(
      'AFRI CLUB - generate obligations:',
      error
    )

    redirect(
      `/contributions/collection?period=${period}&error=${encodeURIComponent(
        'Impossible de générer les échéances.'
      )}`
    )
  }

  // ----------------------------------------------------------
  // 6. RAFRAICHISSEMENT
  // ----------------------------------------------------------

  revalidatePath(
    '/contributions/collection'
  )

  revalidatePath(
    '/dashboard'
  )

  revalidatePath(
    '/rapports'
  )

  // ----------------------------------------------------------
  // 7. RETOUR
  // ----------------------------------------------------------

  redirect(
    `/contributions/collection?period=${period}&generated=${data ?? 0}`
  )
}


// ============================================================
// OUVRIR L'ECRAN D'ENCAISSEMENT
// ============================================================

export async function openPayment(
  formData: FormData
) {
  // ----------------------------------------------------------
  // 1. DONNEES DU FORMULAIRE
  // ----------------------------------------------------------

  const obligationId =
    String(
      formData.get('obligationId') ??
        ''
    )

  const year =
    Number(
      formData.get('year')
    )

  // ----------------------------------------------------------
  // 2. VALIDATION
  // ----------------------------------------------------------

  if (
    !obligationId ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    redirect(
      '/contributions/collection?error=Échéance invalide.'
    )
  }

  // ----------------------------------------------------------
  // 3. MUTUELLE ACTIVE
  // ----------------------------------------------------------

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  // ----------------------------------------------------------
  // 4. AUTORISATION
  // ----------------------------------------------------------

  if (
    ![
      'owner',
      'president',
      'treasurer',
    ].includes(role)
  ) {
    redirect(
      '/contributions/collection?error=Accès refusé.'
    )
  }

  // ----------------------------------------------------------
  // 5. CHARGER L'ECHEANCE
  //
  // contribution_type_id :
  //   présent pour une cotisation régulière
  //
  // contribution_call_id :
  //   présent pour une cotisation exceptionnelle
  // ----------------------------------------------------------

  const {
    data: obligation,
    error: obligationError,
  } = await supabase
    .from(
      'contribution_obligations'
    )
    .select(`
      id,
      organization_id,
      member_id,
      contribution_type_id,
      contribution_call_id
    `)
    .eq(
      'id',
      obligationId
    )
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  // ----------------------------------------------------------
  // 6. ECHEANCE INTROUVABLE
  // ----------------------------------------------------------

  if (
    obligationError ||
    !obligation
  ) {
    console.error(
      'AFRI CLUB - open payment obligation:',
      obligationError
    )

    redirect(
      '/contributions/collection?error=Échéance introuvable.'
    )
  }

  // ==========================================================
  // 7. COTISATION EXCEPTIONNELLE
  //
  // Une cotisation exceptionnelle correspond à une obligation
  // précise.
  //
  // Il ne faut surtout pas préparer de plan annuel.
  // ==========================================================

  if (
    obligation.contribution_call_id
  ) {
    redirect(
      `/contributions/collection/${obligationId}?year=${year}`
    )
  }

  // ==========================================================
  // 8. COTISATION REGULIERE
  //
  // Pour une cotisation régulière, contribution_type_id
  // doit obligatoirement être présent.
  // ==========================================================

  if (
    !obligation.contribution_type_id
  ) {
    redirect(
      `/contributions/collection?error=${encodeURIComponent(
        'Type de cotisation introuvable.'
      )}`
    )
  }

  // ----------------------------------------------------------
  // 9. PREPARER LE PLAN DE COTISATION
  //
  // Permet notamment :
  // - paiement de plusieurs périodes ;
  // - règlement des anciennes échéances ;
  // - paiement anticipé jusqu'à la fin de l'année.
  // ----------------------------------------------------------

  const {
    error: prepareError,
  } = await supabase.rpc(
    'prepare_member_contribution_plan',
    {
      target_member_id:
        obligation.member_id,

      target_contribution_type_id:
        obligation.contribution_type_id,

      target_year:
        year,
    }
  )

  // ----------------------------------------------------------
  // 10. ERREUR DE PREPARATION
  // ----------------------------------------------------------

  if (prepareError) {
    console.error(
      'AFRI CLUB - prepare contribution plan:',
      prepareError
    )

    redirect(
      `/contributions/collection?error=${encodeURIComponent(
        'Impossible de préparer le plan de cotisation.'
      )}`
    )
  }

  // ----------------------------------------------------------
  // 11. RAFRAICHISSEMENT
  // ----------------------------------------------------------

  revalidatePath(
    '/contributions/collection'
  )

  // ----------------------------------------------------------
  // 12. OUVRIR L'ECRAN D'ENCAISSEMENT
  // ----------------------------------------------------------

  redirect(
    `/contributions/collection/${obligationId}?year=${year}`
  )
}