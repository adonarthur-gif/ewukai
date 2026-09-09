-- ============================================================
-- AFRI CLUB
-- MIGRATION 040
-- FICHE FACTURE + PAIEMENTS D'ABONNEMENT
--
-- Objectifs :
--
-- - consulter une facture individuellement ;
-- - consulter l'historique de ses paiements ;
-- - enregistrer un paiement manuel confirmé ;
-- - autoriser les paiements partiels ;
-- - empêcher les dépassements du montant restant ;
-- - mettre automatiquement à jour la facture ;
-- - passer automatiquement open -> paid lorsque tout est payé.
-- ============================================================


-- ============================================================
-- 1. DETAIL D'UNE FACTURE
-- ============================================================

drop function if exists
  public.get_platform_subscription_invoice_detail(uuid);


create or replace function
  public.get_platform_subscription_invoice_detail(
    target_invoice_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  invoice_result jsonb;

  payments_result jsonb;

begin

  -- ==========================================================
  -- AUTHENTIFICATION
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  if not private.is_platform_super_admin(
    current_user_id
  ) then

    raise exception
      'Platform super administrator required';

  end if;


  if target_invoice_id is null then

    raise exception
      'Invoice id is required';

  end if;


  -- ==========================================================
  -- FACTURE
  -- ==========================================================

  select

    jsonb_build_object(

      'id',
        si.id,

      'invoice_number',
        si.invoice_number,

      'organization_id',
        si.organization_id,

      'organization_name',
        o.name,

      'organization_short_name',
        o.short_name,

      'subscription_id',
        si.subscription_id,

      'plan_id',
        si.plan_id,

      'plan_code',
        si.plan_code,

      'plan_name',
        si.plan_name,

      'billing_cycle',
        si.billing_cycle,

      'period_start',
        si.period_start,

      'period_end',
        si.period_end,

      'currency',
        si.currency,

      'subtotal_xof',
        si.subtotal_xof,

      'discount_xof',
        si.discount_xof,

      'tax_xof',
        si.tax_xof,

      'total_xof',
        si.total_xof,

      'amount_paid_xof',
        si.amount_paid_xof,

      'amount_remaining_xof',
        greatest(
          si.total_xof -
          si.amount_paid_xof,
          0
        ),

      'stored_status',
        si.status,

      'effective_status',

        case

          when si.status =
            'paid'
            then 'paid'

          when si.status =
            'cancelled'
            then 'cancelled'

          when si.status =
            'open'
            and si.due_at <
              now()
            then 'overdue'

          when si.status =
            'open'
            and si.amount_paid_xof > 0
            and si.amount_paid_xof <
              si.total_xof
            then 'partial'

          else
            si.status

        end,

      'issued_at',
        si.issued_at,

      'due_at',
        si.due_at,

      'paid_at',
        si.paid_at,

      'cancelled_at',
        si.cancelled_at,

      'description',
        si.description,

      'notes',
        si.notes,

      'created_at',
        si.created_at,

      'updated_at',
        si.updated_at

    )

  into
    invoice_result

  from public.subscription_invoices as si

  join public.organizations as o

    on o.id =
      si.organization_id

  where

    si.id =
      target_invoice_id;


  if invoice_result is null then

    raise exception
      'Invoice not found';

  end if;


  -- ==========================================================
  -- PAIEMENTS
  -- ==========================================================

  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'id',
            sip.id,

          'amount_xof',
            sip.amount_xof,

          'currency',
            sip.currency,

          'payment_method',
            sip.payment_method,

          'provider',
            sip.provider,

          'provider_transaction_ref',
            sip.provider_transaction_ref,

          'status',
            sip.status,

          'paid_at',
            sip.paid_at,

          'confirmed_at',
            sip.confirmed_at,

          'failed_at',
            sip.failed_at,

          'notes',
            sip.notes,

          'created_by',
            sip.created_by,

          'created_at',
            sip.created_at

        )

        order by
          sip.created_at desc

      ),

      '[]'::jsonb

    )

  into
    payments_result

  from public.subscription_invoice_payments as sip

  where

    sip.invoice_id =
      target_invoice_id;


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return
    jsonb_build_object(

      'invoice',
        invoice_result,

      'payments',
        payments_result

    );

end;

$function$;


-- ============================================================
-- 2. ENREGISTRER UN PAIEMENT CONFIRME
-- ============================================================

drop function if exists
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  );


create or replace function
  public.register_platform_invoice_payment(

    target_invoice_id uuid,

    payment_amount_xof bigint,

    target_payment_method text,

    transaction_reference text default null,

    payment_note text default null

  )
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  invoice_row record;

  clean_payment_method text;

  clean_transaction_reference text;

  clean_note text;

  new_payment_id uuid;

  confirmed_total bigint;

begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  if not private.is_platform_super_admin(
    current_user_id
  ) then

    raise exception
      'Platform super administrator required';

  end if;


  -- ==========================================================
  -- VALIDATIONS
  -- ==========================================================

  if target_invoice_id is null then

    raise exception
      'Invoice id is required';

  end if;


  if payment_amount_xof is null
     or payment_amount_xof <= 0 then

    raise exception
      'Payment amount must be greater than zero';

  end if;


  clean_payment_method :=

    lower(

      btrim(

        coalesce(
          target_payment_method,
          ''
        )

      )

    );


  if clean_payment_method not in (

    'manual',
    'wave',
    'orange_money',
    'mtn_momo',
    'moov_money',
    'bank_transfer',
    'cash',
    'other'

  ) then

    raise exception
      'Invalid payment method';

  end if;


  clean_transaction_reference :=

    nullif(

      btrim(

        coalesce(
          transaction_reference,
          ''
        )

      ),

      ''

    );


  clean_note :=

    nullif(

      btrim(

        coalesce(
          payment_note,
          ''
        )

      ),

      ''

    );


  -- ==========================================================
  -- VERROUILLAGE FACTURE
  -- ==========================================================

  select

    si.id,

    si.organization_id,

    si.total_xof,

    si.amount_paid_xof,

    si.status,

    si.currency

  into
    invoice_row

  from public.subscription_invoices as si

  where

    si.id =
      target_invoice_id

  for update;


  if invoice_row.id is null then

    raise exception
      'Invoice not found';

  end if;


  -- ==========================================================
  -- FACTURE NON PAYABLE
  -- ==========================================================

  if invoice_row.status =
    'cancelled' then

    raise exception
      'Cancelled invoice cannot receive payment';

  end if;


  if invoice_row.status =
    'paid' then

    raise exception
      'Invoice is already paid';

  end if;


  if invoice_row.status =
    'draft' then

    raise exception
      'Draft invoice cannot receive payment';

  end if;


  -- ==========================================================
  -- INTERDIRE LE SURPAIEMENT
  -- ==========================================================

  if payment_amount_xof >
    greatest(
      invoice_row.total_xof -
      invoice_row.amount_paid_xof,
      0
    ) then

    raise exception
      'Payment amount exceeds invoice balance';

  end if;


  -- ==========================================================
  -- PAIEMENT
  --
  -- Dans cette V1, le Super-admin confirme directement
  -- un paiement déjà reçu.
  -- ==========================================================

  insert into public.subscription_invoice_payments
  (

    invoice_id,

    organization_id,

    amount_xof,

    currency,

    payment_method,

    provider,

    provider_transaction_ref,

    status,

    paid_at,

    confirmed_at,

    notes,

    created_by

  )
  values
  (

    target_invoice_id,

    invoice_row.organization_id,

    payment_amount_xof,

    coalesce(
      invoice_row.currency,
      'XOF'
    ),

    clean_payment_method,


    case

      when clean_payment_method in (
        'wave',
        'orange_money',
        'mtn_momo',
        'moov_money'
      )

      then
        clean_payment_method

      else
        null

    end,


    clean_transaction_reference,

    'confirmed',

    now(),

    now(),

    clean_note,

    current_user_id

  )

  returning
    id

  into
    new_payment_id;


  -- ==========================================================
  -- TOTAL DES PAIEMENTS CONFIRMES
  -- ==========================================================

  select

    coalesce(
      sum(
        sip.amount_xof
      ),
      0
    )::bigint

  into
    confirmed_total

  from public.subscription_invoice_payments as sip

  where

    sip.invoice_id =
      target_invoice_id

    and sip.status =
      'confirmed';


  -- ==========================================================
  -- MISE A JOUR FACTURE
  -- ==========================================================

  update public.subscription_invoices as si

  set

    amount_paid_xof =
      confirmed_total,


    status =

      case

        when confirmed_total >=
          si.total_xof

        then
          'paid'

        else
          'open'

      end,


    paid_at =

      case

        when confirmed_total >=
          si.total_xof

        then
          coalesce(
            si.paid_at,
            now()
          )

        else
          null

      end,


    updated_at =
      now()

  where

    si.id =
      target_invoice_id;


  -- ==========================================================
  -- RESULTAT
  -- ==========================================================

  return
    public.get_platform_subscription_invoice_detail(
      target_invoice_id
    );

end;

$function$;


-- ============================================================
-- 3. DROITS
-- ============================================================

revoke all
on function
  public.get_platform_subscription_invoice_detail(uuid)
from public;


revoke all
on function
  public.get_platform_subscription_invoice_detail(uuid)
from anon;


revoke all
on function
  public.get_platform_subscription_invoice_detail(uuid)
from authenticated;


grant execute
on function
  public.get_platform_subscription_invoice_detail(uuid)
to authenticated;


-- ------------------------------------------------------------

revoke all
on function
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  )
from public;


revoke all
on function
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  )
from anon;


revoke all
on function
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  )
from authenticated;


grant execute
on function
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  )
to authenticated;


-- ============================================================
-- 4. COMMENTAIRES
-- ============================================================

comment on function
  public.get_platform_subscription_invoice_detail(uuid)
is
  'Fiche complète Super-admin d une facture d abonnement Afri Club avec historique des paiements.';


comment on function
  public.register_platform_invoice_payment(
    uuid,
    bigint,
    text,
    text,
    text
  )
is
  'Enregistre un paiement d abonnement confirmé et recalcule automatiquement le montant payé et le statut de la facture.';


-- ============================================================
-- 5. RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';