-- ============================================================
-- EWUKAI
-- COMPTES MOBILE MONEY DE REVERSEMENT DES MUTUELLES
-- ============================================================

-- ============================================================
-- 1. COLONNES
-- ============================================================

alter table public.organization_payment_methods
  add column if not exists
    is_payout_destination boolean
    not null
    default false;

alter table public.organization_payment_methods
  add column if not exists
    is_primary_payout boolean
    not null
    default false;

alter table public.organization_payment_methods
  add column if not exists
    payout_verified_at timestamptz
    null;


-- ============================================================
-- 2. UN COMPTE DE REVERSEMENT DOIT ETRE MOBILE MONEY
--    ET POSSEDER UN TITULAIRE + UN NUMERO
-- ============================================================

alter table public.organization_payment_methods
  drop constraint if exists
    organization_payment_methods_payout_destination_check;

alter table public.organization_payment_methods
  add constraint
    organization_payment_methods_payout_destination_check
  check (
    is_payout_destination = false
    or (
      provider in (
        'wave',
        'orange_money',
        'mtn_momo',
        'moov_money'
      )
      and nullif(
        btrim(
          coalesce(
            account_name,
            ''
          )
        ),
        ''
      ) is not null
      and nullif(
        btrim(
          coalesce(
            account_number,
            ''
          )
        ),
        ''
      ) is not null
    )
  );


-- ============================================================
-- 3. LE COMPTE PRINCIPAL DOIT ETRE UN COMPTE DE REVERSEMENT
--    ACTIF
-- ============================================================

alter table public.organization_payment_methods
  drop constraint if exists
    organization_payment_methods_primary_payout_check;

alter table public.organization_payment_methods
  add constraint
    organization_payment_methods_primary_payout_check
  check (
    is_primary_payout = false
    or (
      is_payout_destination = true
      and is_active = true
    )
  );


-- ============================================================
-- 4. UN SEUL COMPTE PRINCIPAL PAR MUTUELLE
-- ============================================================

create unique index if not exists
  organization_payment_methods_one_primary_payout_idx
on public.organization_payment_methods (
  organization_id
)
where is_primary_payout = true;


-- ============================================================
-- 5. DEFINIR LE COMPTE PRINCIPAL DE REVERSEMENT
-- ============================================================

create or replace function
  public.set_organization_primary_payout_method(
    target_payment_method_id uuid
  )
returns void
language plpgsql
security definer
set search_path = ''
as $function$

declare

  current_user_id uuid;

  payment_method_record record;

begin

  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required';
  end if;


  if target_payment_method_id is null then
    raise exception
      'Payment method id is required';
  end if;


  select
    pm.id,
    pm.organization_id,
    pm.provider,
    pm.account_name,
    pm.account_number,
    pm.is_active

  into
    payment_method_record

  from
    public.organization_payment_methods
      as pm

  where
    pm.id =
      target_payment_method_id

  for update;


  if not found then
    raise exception
      'Payment method not found';
  end if;


  if not private.has_organization_role(
    payment_method_record.organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role
    ]
  ) then
    raise exception
      'Not authorized';
  end if;


  if not payment_method_record.is_active then
    raise exception
      'Payment method must be active';
  end if;


  if payment_method_record.provider
     not in (
       'wave',
       'orange_money',
       'mtn_momo',
       'moov_money'
     ) then

    raise exception
      'Only Mobile Money can receive payouts';

  end if;


  if nullif(
       btrim(
         coalesce(
           payment_method_record.account_name,
           ''
         )
       ),
       ''
     ) is null then

    raise exception
      'Account holder is required';

  end if;


  if nullif(
       btrim(
         coalesce(
           payment_method_record.account_number,
           ''
         )
       ),
       ''
     ) is null then

    raise exception
      'Account number is required';

  end if;


  -- Retirer l'ancien compte principal
  update
    public.organization_payment_methods

  set
    is_primary_payout = false

  where
    organization_id =
      payment_method_record.organization_id
    and is_primary_payout = true;


  -- Définir le nouveau compte principal
  update
    public.organization_payment_methods

  set
    is_payout_destination = true,
    is_primary_payout = true

  where
    id =
      payment_method_record.id;

end;

$function$;


revoke all
on function
  public.set_organization_primary_payout_method(uuid)
from public;

revoke all
on function
  public.set_organization_primary_payout_method(uuid)
from anon;

grant execute
on function
  public.set_organization_primary_payout_method(uuid)
to authenticated;
