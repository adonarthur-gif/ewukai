'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireCurrentOrganization } from '@/lib/auth/current-organization'

// ============================================================
// EWUKAI
// CREATION D'UN APPEL DE COTISATION
// ============================================================

const callSchema = z.object({
  title: z
    .string()
    .trim()
    .min(
      3,
      'L’objet de l’appel est obligatoire.'
    )
    .max(
      200,
      'L’objet est trop long.'
    ),

  description: z
    .string()
    .trim()
    .max(
      2000,
      'La description est trop longue.'
    )
    .optional(),

  amount: z.coerce
    .number()
    .int(
      'Le montant doit être un nombre entier.'
    )
    .positive(
      'Le montant doit être supérieur à zéro.'
    ),

  launchDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date de lancement invalide.'
    ),

  dueDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date limite invalide.'
    ),

  scope: z.enum([
    'all_active',
    'selected',
  ]),

  beneficiaryMemberId: z
    .string()
    .optional(),

  beneficiaryName: z
    .string()
    .trim()
    .max(
      200,
      'Le nom du bénéficiaire est trop long.'
    )
    .optional(),

  requestKey: z
    .string()
    .uuid(
      'Clé de requête invalide.'
    ),
})

// ============================================================
// CREER UN APPEL
// ============================================================

export async function createContributionCall(
  formData: FormData
) {
  // ==========================================================
  // 1. VALIDATION DU FORMULAIRE
  // ==========================================================

  const parsed =
    callSchema.safeParse({
      title:
        formData.get(
          'title'
        ),

      description:
        formData.get(
          'description'
        ),

      amount:
        formData.get(
          'amount'
        ),

      launchDate:
        formData.get(
          'launchDate'
        ),

      dueDate:
        formData.get(
          'dueDate'
        ),

      scope:
        formData.get(
          'scope'
        ),

      beneficiaryMemberId:
        formData.get(
          'beneficiaryMemberId'
        ),

      beneficiaryName:
        formData.get(
          'beneficiaryName'
        ),

      requestKey:
        formData.get(
          'requestKey'
        ),
    })

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]
        ?.message ??
      'Informations invalides.'

    redirect(
      `/contributions/calls/new?error=${encodeURIComponent(
        message
      )}`
    )
  }

  const data =
    parsed.data

  // ==========================================================
  // 2. VALIDATION DES DATES
  // ==========================================================

  if (
    data.dueDate <
    data.launchDate
  ) {
    redirect(
      `/contributions/calls/new?error=${encodeURIComponent(
        'La date limite ne peut pas être antérieure à la date de lancement.'
      )}`
    )
  }

  // ==========================================================
  // 3. MUTUELLE ACTIVE + ROLE
  // ==========================================================

  const {
    supabase,
    organizationId,
    role,
  } =
    await requireCurrentOrganization()

  if (
    ![
      'owner',
      'president',
      'treasurer',
      'secretary',
    ].includes(role)
  ) {
    redirect(
      `/contributions/calls?error=${encodeURIComponent(
        'Vous ne disposez pas des droits nécessaires.'
      )}`
    )
  }

  // ==========================================================
  // 4. MEMBRES SELECTIONNES
  // ==========================================================

  const selectedMemberIds =
    formData
      .getAll(
        'selectedMemberIds'
      )
      .map(
        (value) =>
          String(value)
      )
      .filter(Boolean)

  if (
    data.scope ===
      'selected' &&
    selectedMemberIds.length ===
      0
  ) {
    redirect(
      `/contributions/calls/new?error=${encodeURIComponent(
        'Sélectionnez au moins un membre.'
      )}`
    )
  }

  // ==========================================================
  // 5. BENEFICIAIRE
  // ==========================================================

  const beneficiaryMemberId =
    data.beneficiaryMemberId &&
    data.beneficiaryMemberId !==
      'none'
      ? data.beneficiaryMemberId
      : null

  const beneficiaryName =
    data.beneficiaryName &&
    data.beneficiaryName.trim()
      ? data.beneficiaryName.trim()
      : null

  // ==========================================================
  // 6. CREATION ATOMIQUE VIA RPC
  //
  // request_key protège contre les doubles clics.
  // Si le même formulaire est envoyé deux fois,
  // PostgreSQL renvoie le même appel au lieu d'en créer deux.
  // ==========================================================

  const {
    data: newCallId,
    error,
  } = await supabase.rpc(
    'create_contribution_call',
    {
      target_organization_id:
        organizationId,

      call_title:
        data.title,

      call_description:
        data.description?.trim() ||
        null,

      call_amount:
        data.amount,

      call_launch_date:
        data.launchDate,

      call_due_date:
        data.dueDate,

      call_scope:
        data.scope,

      beneficiary_member:
        beneficiaryMemberId,

      beneficiary_external_name:
        beneficiaryName,

      selected_member_ids:
        data.scope ===
        'selected'
          ? selectedMemberIds
          : [],

      request_key:
        data.requestKey,
    }
  )

  // ==========================================================
  // 7. GESTION DES ERREURS
  // ==========================================================

  if (
    error ||
    !newCallId
  ) {
    console.error(
      'EWUKAI - create contribution call:',
      error
    )

    const databaseMessage =
      error?.message ??
      ''

    let message =
      'Impossible de créer l’appel de cotisation.'

    if (
      databaseMessage.includes(
        'At least one member'
      )
    ) {
      message =
        'Sélectionnez au moins un membre.'
    }

    if (
      databaseMessage.includes(
        'selected members are invalid'
      )
    ) {
      message =
        'Un ou plusieurs membres sélectionnés sont invalides.'
    }

    if (
      databaseMessage.includes(
        'Beneficiary member not found'
      )
    ) {
      message =
        'Le bénéficiaire sélectionné est invalide.'
    }

    if (
      databaseMessage.includes(
        'Due date cannot be before launch date'
      )
    ) {
      message =
        'La date limite ne peut pas être antérieure à la date de lancement.'
    }

    if (
      databaseMessage.includes(
        'Not authorized'
      )
    ) {
      message =
        'Vous ne disposez pas des droits nécessaires.'
    }

    redirect(
      `/contributions/calls/new?error=${encodeURIComponent(
        message
      )}`
    )
  }

  // ==========================================================
  // 8. RAFRAICHISSEMENT
  // ==========================================================

  revalidatePath(
    '/contributions/calls'
  )

  revalidatePath(
    '/contributions'
  )

  revalidatePath(
    '/dashboard'
  )

  // ==========================================================
  // 9. REDIRECTION
  // ==========================================================

  redirect(
    `/contributions/calls?created=1&call=${encodeURIComponent(
      String(newCallId)
    )}`
  )
}