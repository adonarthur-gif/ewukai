-- ============================================================
-- AFRI CLUB
-- ACCES SECURISE AUX RECUS DE PAIEMENT
--
-- Autorise :
-- - Responsable / owner
-- - Président
-- - Trésorier
-- - Secrétaire
-- - Auditeur
--
-- Un membre peut uniquement consulter SES propres reçus.
-- ============================================================

create or replace function public.get_payment_receipt(
  target_payment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  payment_record record;

  is_manager boolean := false;
  is_owner_member boolean := false;

  viewer_mode text;

  receipt_lines jsonb;

begin

  -- ==========================================================
  -- 1. AUTHENTIFICATION
  -- ==========================================================

  current_user_id :=
    auth.uid();

  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  -- ==========================================================
  -- 2. CHARGER LE PAIEMENT
  -- ==========================================================

  select

    p.id,
    p.organization_id,
    p.member_id,
    p.amount,
    p.payment_method,
    p.payment_reference,
    p.receipt_number,
    p.status,
    p.notes,
    p.paid_at,
    p.created_at,

    o.name
      as organization_name,

    o.short_name
      as organization_short_name,

    m.member_number,
    m.first_name,
    m.last_name,
    m.phone,

    m.user_id
      as member_user_id

  into
    payment_record

  from public.payments p

  join public.organizations o
    on o.id =
      p.organization_id

  join public.members m
    on m.id =
      p.member_id

    and m.organization_id =
      p.organization_id

  where
    p.id =
      target_payment_id;


  if not found then

    raise exception
      'Payment not found';

  end if;


  -- ==========================================================
  -- 3. VERIFIER LES DROITS DU BUREAU
  -- ==========================================================

  is_manager :=
    coalesce(
      private.has_organization_role(
        payment_record.organization_id,

        array[
          'owner'::public.organization_role,
          'president'::public.organization_role,
          'treasurer'::public.organization_role,
          'secretary'::public.organization_role,
          'auditor'::public.organization_role
        ]
      ),
      false
    );


  -- ==========================================================
  -- 4. VERIFIER SI LE PAIEMENT APPARTIENT AU MEMBRE CONNECTE
  -- ==========================================================

  is_owner_member :=
    coalesce(
      payment_record.member_user_id =
        current_user_id,
      false
    )

    and exists (

      select
        1

      from public.organization_users ou

      where
        ou.organization_id =
          payment_record.organization_id

        and ou.user_id =
          current_user_id

        and ou.is_active =
          true

        and ou.role =
          'member'::public.organization_role
    );


  -- ==========================================================
  -- 5. AUTORISATION
  -- ==========================================================

  if
    not coalesce(
      is_manager,
      false
    )

    and not coalesce(
      is_owner_member,
      false
    )
  then

    raise exception
      'Not authorized';

  end if;


  if is_manager then

    viewer_mode :=
      'management';

  else

    viewer_mode :=
      'member';

  end if;


  -- ==========================================================
  -- 6. CONSTRUIRE LES LIGNES DU RECU
  -- ==========================================================

  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'obligation_id',
            receipt_data.obligation_id,

          'period_start',
            receipt_data.period_start,

          'due_date',
            receipt_data.due_date,

          'contribution_name',
            receipt_data.contribution_name,

          'frequency',
            receipt_data.frequency,

          'is_exceptional',
            receipt_data.is_exceptional,

          'amount',
            receipt_data.allocated_amount

        )

        order by

          receipt_data.period_start asc,

          receipt_data.due_date asc

      ),

      '[]'::jsonb

    )

  into
    receipt_lines

  from (

    select

      co.id
        as obligation_id,

      co.period_start,

      co.due_date,


      -- --------------------------------------------------------
      -- NOM DE LA COTISATION
      -- --------------------------------------------------------

      case

        when co.contribution_call_id
             is not null

        then
          'Exceptionnelle — '
          ||
          coalesce(
            cc.title,
            'Appel exceptionnel'
          )

        else
          coalesce(
            ct.name,
            'Cotisation'
          )

      end
        as contribution_name,


      -- --------------------------------------------------------
      -- FREQUENCE / NATURE
      -- --------------------------------------------------------

      case

        when co.contribution_call_id
             is not null

        then
          'exceptional'

        else
          coalesce(
            ct.frequency::text,
            ''
          )

      end
        as frequency,


      -- --------------------------------------------------------
      -- TYPE EXCEPTIONNEL
      -- --------------------------------------------------------

      (
        co.contribution_call_id
        is not null
      )
        as is_exceptional,


      -- --------------------------------------------------------
      -- MONTANT AFFECTE
      -- --------------------------------------------------------

      pa.amount
        as allocated_amount


    from public.payment_allocations pa


    join public.contribution_obligations co

      on co.id =
        pa.obligation_id


    left join public.contribution_types ct

      on ct.id =
        co.contribution_type_id


    left join public.contribution_calls cc

      on cc.id =
        co.contribution_call_id


    where

      pa.payment_id =
        payment_record.id

      and co.organization_id =
        payment_record.organization_id

  ) receipt_data;


  -- ==========================================================
  -- 7. RETOURNER LE RECU
  -- ==========================================================

  return jsonb_build_object(

    -- ----------------------------------------------------------
    -- MODE DE CONSULTATION
    -- ----------------------------------------------------------

    'viewer_mode',
      viewer_mode,


    -- ----------------------------------------------------------
    -- PAIEMENT
    -- ----------------------------------------------------------

    'payment',

      jsonb_build_object(

        'id',
          payment_record.id,

        'amount',
          payment_record.amount,

        'payment_method',
          payment_record.payment_method,

        'payment_reference',
          payment_record.payment_reference,

        'receipt_number',
          payment_record.receipt_number,

        'status',
          payment_record.status,

        'notes',
          payment_record.notes,

        'paid_at',
          payment_record.paid_at,

        'created_at',
          payment_record.created_at

      ),


    -- ----------------------------------------------------------
    -- MUTUELLE
    -- ----------------------------------------------------------

    'organization',

      jsonb_build_object(

        'id',
          payment_record.organization_id,

        'name',
          payment_record.organization_name,

        'short_name',
          payment_record.organization_short_name

      ),


    -- ----------------------------------------------------------
    -- MEMBRE
    -- ----------------------------------------------------------

    'member',

      jsonb_build_object(

        'id',
          payment_record.member_id,

        'member_number',
          payment_record.member_number,

        'first_name',
          payment_record.first_name,

        'last_name',
          payment_record.last_name,

        'phone',
          payment_record.phone

      ),


    -- ----------------------------------------------------------
    -- AFFECTATIONS
    -- ----------------------------------------------------------

    'lines',
      receipt_lines

  );

end;

$function$;


-- ============================================================
-- 8. SECURITE D'EXECUTION
-- ============================================================

revoke all
on function public.get_payment_receipt(uuid)
from public;


revoke all
on function public.get_payment_receipt(uuid)
from anon;


grant execute
on function public.get_payment_receipt(uuid)
to authenticated;