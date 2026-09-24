-- ============================================================================
-- EWUKAI
-- SNAPSHOT DU DROIT D'ADHESION SUR CHAQUE DEMANDE
-- Migration : 20260924143000_membership_application_fee_snapshot.sql
--
-- Objectifs :
-- 1) conserver le tarif applicable au moment du dépôt d'une demande ;
-- 2) ne jamais modifier rétroactivement une ancienne demande si le responsable
--    change ensuite le montant du droit d'adhésion ;
-- 3) préparer les états futur du paiement : non requis / en attente / payé /
--    exonéré ;
-- 4) conserver le parcours actuel : la demande reste "pending" jusqu'à son
--    examen par le bureau.
-- ============================================================================


-- ============================================================================
-- 1. COLONNES SUR membership_applications
-- ============================================================================

alter table public.membership_applications
  add column if not exists
    membership_fee_required boolean
    not null
    default false;

alter table public.membership_applications
  add column if not exists
    membership_fee_amount_xof bigint
    not null
    default 0;

alter table public.membership_applications
  add column if not exists
    membership_fee_status text
    not null
    default 'not_required';

alter table public.membership_applications
  add column if not exists
    membership_fee_paid_at timestamptz;

alter table public.membership_applications
  add column if not exists
    membership_fee_waived_at timestamptz;

alter table public.membership_applications
  add column if not exists
    membership_fee_waived_by uuid
    references auth.users(id)
    on delete set null;


-- ============================================================================
-- 2. CONTRAINTES
-- ============================================================================

alter table public.membership_applications
  drop constraint if exists
    membership_applications_fee_amount_check;

alter table public.membership_applications
  add constraint
    membership_applications_fee_amount_check
  check (
    membership_fee_amount_xof >= 0
    and (
      membership_fee_required = false
      or membership_fee_amount_xof > 0
    )
  );


alter table public.membership_applications
  drop constraint if exists
    membership_applications_fee_status_check;

alter table public.membership_applications
  add constraint
    membership_applications_fee_status_check
  check (
    membership_fee_status in (
      'not_required',
      'pending',
      'paid',
      'waived'
    )
  );


-- ============================================================================
-- 3. NORMALISATION DES DONNEES EXISTANTES
--
-- Les anciennes demandes restent gratuites, car elles ont été déposées avant
-- l'introduction de cette configuration.
-- ============================================================================

update public.membership_applications
set
  membership_fee_required =
    false,
  membership_fee_amount_xof =
    0,
  membership_fee_status =
    'not_required',
  membership_fee_paid_at =
    null,
  membership_fee_waived_at =
    null,
  membership_fee_waived_by =
    null
where
  membership_fee_required is distinct from false
  or membership_fee_amount_xof is distinct from 0
  or membership_fee_status is distinct from 'not_required';


-- ============================================================================
-- 4. INDEX POUR LE FUTUR SUIVI DES DROITS D'ADHESION
-- ============================================================================

create index if not exists
  membership_applications_fee_status_idx
on public.membership_applications (
  organization_id,
  membership_fee_status
);


-- ============================================================================
-- 5. REDEFINITION DE LA SOUMISSION PUBLIQUE
--
-- Même signature que la fonction actuelle.
-- La nouveauté est uniquement le snapshot du droit d'adhésion.
-- ============================================================================

create or replace function public.submit_membership_application(
  target_slug text,
  applicant_last_name text,
  applicant_first_name text,
  applicant_phone text,
  applicant_email text default null::text,
  applicant_residence text default null::text,
  applicant_profession text default null::text,
  applicant_motivation text default null::text,
  request_key uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare

  organization_record record;

  existing_application_id uuid;

  new_application_id uuid;

  request_key_value uuid :=
    request_key;

  fee_required boolean :=
    false;

  fee_amount_xof bigint :=
    0;

  fee_status text :=
    'not_required';

begin

  -- ==========================================================
  -- ORGANISATION + CONFIGURATION DU DROIT D'ADHESION
  -- ==========================================================

  select

    o.id,

    o.online_membership_enabled,

    coalesce(
      oms.membership_fee_enabled,
      false
    )
      as membership_fee_enabled,

    coalesce(
      oms.membership_fee_amount_xof,
      0
    )
      as membership_fee_amount_xof

  into organization_record

  from public.organizations as o

  left join
    public.organization_membership_settings
      as oms
    on oms.organization_id =
      o.id

  where

    lower(
      o.public_slug
    ) =
      lower(
        btrim(
          target_slug
        )
      )

    and o.status::text =
      'active'

    and o.public_page_enabled =
      true

  limit 1;


  if organization_record.id
     is null then

    raise exception
      'Organization not found';

  end if;


  if not
    organization_record
      .online_membership_enabled then

    raise exception
      'Online membership is disabled';

  end if;


  -- ==========================================================
  -- SNAPSHOT DU TARIF APPLICABLE
  -- ==========================================================

  fee_required :=
    coalesce(
      organization_record
        .membership_fee_enabled,
      false
    );

  if fee_required then

    fee_amount_xof :=
      coalesce(
        organization_record
          .membership_fee_amount_xof,
        0
      );

    if fee_amount_xof <= 0 then

      raise exception
        'Invalid membership fee configuration';

    end if;

    fee_status :=
      'pending';

  else

    fee_amount_xof :=
      0;

    fee_status :=
      'not_required';

  end if;


  -- ==========================================================
  -- VALIDATIONS
  -- ==========================================================

  if nullif(
    btrim(
      applicant_last_name
    ),
    ''
  ) is null then

    raise exception
      'Last name is required';

  end if;


  if nullif(
    btrim(
      applicant_first_name
    ),
    ''
  ) is null then

    raise exception
      'First name is required';

  end if;


  if nullif(
    btrim(
      applicant_phone
    ),
    ''
  ) is null then

    raise exception
      'Phone is required';

  end if;


  -- ==========================================================
  -- IDEMPOTENCE
  -- ==========================================================

  if request_key_value
     is not null then

    select
      ma.id

    into existing_application_id

    from
      public.membership_applications
        as ma

    where

      ma.organization_id =
        organization_record.id

      and ma.request_key =
        request_key_value

    limit 1;


    if existing_application_id
       is not null then

      return
        existing_application_id;

    end if;

  end if;


  -- ==========================================================
  -- EVITER UNE DEUXIEME DEMANDE EN ATTENTE IDENTIQUE
  -- ==========================================================

  select
    ma.id

  into existing_application_id

  from
    public.membership_applications
      as ma

  where

    ma.organization_id =
      organization_record.id

    and ma.status =
      'pending'

    and (

      lower(
        btrim(
          ma.phone
        )
      ) =
      lower(
        btrim(
          applicant_phone
        )
      )

      or

      (
        applicant_email
          is not null
        and
        ma.email
          is not null
        and
        lower(
          btrim(
            ma.email
          )
        ) =
        lower(
          btrim(
            applicant_email
          )
        )
      )

    )

  order by
    ma.created_at desc

  limit 1;


  if existing_application_id
     is not null then

    return
      existing_application_id;

  end if;


  -- ==========================================================
  -- CREATION
  -- ==========================================================

  insert into
    public.membership_applications (

      organization_id,

      applicant_user_id,

      last_name,

      first_name,

      phone,

      email,

      residence,

      profession,

      motivation,

      request_key,

      status,

      terms_accepted_at,

      membership_fee_required,

      membership_fee_amount_xof,

      membership_fee_status

    )

  values (

    organization_record.id,

    auth.uid(),

    upper(
      btrim(
        applicant_last_name
      )
    ),

    btrim(
      applicant_first_name
    ),

    btrim(
      applicant_phone
    ),

    nullif(
      lower(
        btrim(
          applicant_email
        )
      ),
      ''
    ),

    nullif(
      btrim(
        applicant_residence
      ),
      ''
    ),

    nullif(
      btrim(
        applicant_profession
      ),
      ''
    ),

    nullif(
      btrim(
        applicant_motivation
      ),
      ''
    ),

    request_key_value,

    'pending',

    now(),

    fee_required,

    fee_amount_xof,

    fee_status

  )

  returning id
  into new_application_id;


  return
    new_application_id;

end;
$function$;


-- ============================================================================
-- 6. PRIVILEGES DE LA FONCTION PUBLIQUE
-- ============================================================================

revoke all
on function public.submit_membership_application(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
)
from public;

revoke all
on function public.submit_membership_application(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
)
from anon;

revoke all
on function public.submit_membership_application(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
)
from authenticated;

grant execute
on function public.submit_membership_application(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
)
to anon;

grant execute
on function public.submit_membership_application(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
)
to authenticated;


-- ============================================================================
-- 7. COMMENTAIRES
-- ============================================================================

comment on column
  public.membership_applications.membership_fee_required
is
  'Snapshot indiquant si un droit d adhésion était requis au dépôt de la demande.';

comment on column
  public.membership_applications.membership_fee_amount_xof
is
  'Snapshot du montant du droit d adhésion applicable au dépôt de la demande.';

comment on column
  public.membership_applications.membership_fee_status
is
  'Etat du droit d adhésion : not_required, pending, paid ou waived.';

comment on function public.submit_membership_application(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
)
is
  'EWUKAI - dépose une demande publique et fige le droit d adhésion applicable au moment du dépôt.';
