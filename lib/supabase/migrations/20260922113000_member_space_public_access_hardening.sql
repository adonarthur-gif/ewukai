begin;

-- ============================================================
-- EWUKAI
-- DURCISSEMENT DES ACCES MEMBRE ET PUBLICS
--
-- Objectifs :
-- 1. /my-space ne retourne plus de donnees si l'acces
--    organization_users est suspendu ;
-- 2. /my-space ne retourne plus de donnees d'une organisation
--    inactive ;
-- 3. les pages publiques et l'adhesion en ligne verifient aussi
--    explicitement organizations.status = active.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_member_financial_space(target_organization_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

  current_user_id uuid;

  member_record record;

  summary_json jsonb;

  obligations_json jsonb;

  payments_json jsonb;

begin

  -- ==========================================================
  -- 1. UTILISATEUR AUTHENTIFIE
  -- ==========================================================

  current_user_id :=
    auth.uid();


  if current_user_id is null then

    raise exception
      'Authentication required';

  end if;


  -- ==========================================================
  -- 2. RETROUVER LE DOSSIER MEMBRE
  -- ==========================================================

  select

    m.id
      as member_id,

    m.organization_id,

    m.member_number,

    m.first_name,

    m.last_name,

    m.phone,

    m.email,

    m.profession,

    m.address,

    m.joined_at,

    m.status,

    o.name
      as organization_name,

    o.short_name
      as organization_short_name,

    o.public_slug

  into member_record

  from public.members as m

  join public.organizations as o
    on o.id =
      m.organization_id

  join public.organization_users as ou
    on ou.organization_id =
      m.organization_id
    and ou.user_id =
      current_user_id
    and ou.is_active =
      true

  where
    m.user_id =
      current_user_id

    and m.status =
      'active'::public.member_status

    and o.status::text =
      'active'

    and (
      target_organization_id is null
      or
      m.organization_id =
        target_organization_id
    )

  order by
    m.created_at asc

  limit 1;


  if not found then

    return null;

  end if;


  -- ==========================================================
  -- 3. RESUME FINANCIER
  -- ==========================================================

  with obligation_finance as (

    select

      co.id,

      co.amount_due,

      co.due_date,

      co.status,

      coalesce(
        (
          select
            sum(pa.amount)

          from public.payment_allocations as pa

          join public.payments as p
            on p.id =
              pa.payment_id

          where
            pa.obligation_id =
              co.id

            and p.member_id =
              member_record.member_id

            and p.organization_id =
              member_record.organization_id

            and p.status =
              'confirmed'::public.payment_status
        ),
        0
      )::bigint
        as amount_paid

    from public.contribution_obligations as co

    where
      co.member_id =
        member_record.member_id

      and co.organization_id =
        member_record.organization_id

      and co.status not in (
        'waived'::public.obligation_status,
        'cancelled'::public.obligation_status
      )

  )

  select jsonb_build_object(

    -- Ensemble des obligations générées,
    -- y compris les périodes futures.

    'total_expected',

      coalesce(
        sum(amount_due),
        0
      ),

    -- Ce qui aurait déjà dû être payé à aujourd'hui.

    'due_to_date',

      coalesce(
        sum(
          case
            when due_date <= current_date
              then amount_due
            else 0
          end
        ),
        0
      ),

    -- Montant effectivement affecté aux obligations.

    'paid_total',

      coalesce(
        sum(amount_paid),
        0
      ),

    -- Reste exigible maintenant.

    'remaining_due',

      coalesce(
        sum(
          case
            when due_date <= current_date
              then greatest(
                amount_due -
                amount_paid,
                0
              )
            else 0
          end
        ),
        0
      ),

    -- Arriérés strictement antérieurs à aujourd'hui.

    'overdue_amount',

      coalesce(
        sum(
          case
            when due_date < current_date
              then greatest(
                amount_due -
                amount_paid,
                0
              )
            else 0
          end
        ),
        0
      ),

    -- Paiements déjà affectés à des échéances futures.

    'advance_amount',

      coalesce(
        sum(
          case
            when due_date > current_date
              then amount_paid
            else 0
          end
        ),
        0
      ),

    -- Reste des échéances futures.

    'future_remaining',

      coalesce(
        sum(
          case
            when due_date > current_date
              then greatest(
                amount_due -
                amount_paid,
                0
              )
            else 0
          end
        ),
        0
      ),

    'obligation_count',

      count(*)

  )

  into summary_json

  from obligation_finance;


  -- ==========================================================
  -- 4. LISTE DES COTISATIONS DU MEMBRE
  -- ==========================================================

  select

    coalesce(
      jsonb_agg(
        jsonb_build_object(

          'id',
            source.id,

          'source_kind',
            source.source_kind,

          'name',
            source.contribution_name,

          'period_start',
            source.period_start,

          'due_date',
            source.due_date,

          'amount_due',
            source.amount_due,

          'amount_paid',
            source.amount_paid,

          'remaining_amount',
            source.remaining_amount,

          'status',
            source.calculated_status

        )
        order by
          source.due_date asc,
          source.period_start asc
      ),
      '[]'::jsonb
    )

  into obligations_json

  from (

    select

      co.id,

      co.period_start,

      co.due_date,

      co.amount_due,

      -- ------------------------------------------------------
      -- TYPE DE SOURCE
      -- ------------------------------------------------------

      case

        when co.contribution_call_id
          is not null
          then 'exceptional'

        else 'regular'

      end
        as source_kind,

      -- ------------------------------------------------------
      -- NOM
      --
      -- to_jsonb permet de rester compatible avec
      -- les colonnes actuelles des tables existantes.
      -- ------------------------------------------------------

      case

        when co.contribution_call_id
          is not null
          then coalesce(
            to_jsonb(cc) ->> 'title',
            to_jsonb(cc) ->> 'name',
            to_jsonb(cc) ->> 'purpose',
            'Cotisation exceptionnelle'
          )

        else coalesce(
          to_jsonb(ct) ->> 'name',
          to_jsonb(ct) ->> 'label',
          'Cotisation'
        )

      end
        as contribution_name,

      -- ------------------------------------------------------
      -- TOTAL AFFECTE
      -- ------------------------------------------------------

      coalesce(
        allocations.amount_paid,
        0
      )::bigint
        as amount_paid,

      greatest(
        co.amount_due -
        coalesce(
          allocations.amount_paid,
          0
        ),
        0
      )::bigint
        as remaining_amount,

      -- ------------------------------------------------------
      -- STATUT RECALCULE
      -- ------------------------------------------------------

      case

        when co.status =
          'waived'::public.obligation_status
          then 'waived'

        when co.status =
          'cancelled'::public.obligation_status
          then 'cancelled'

        when coalesce(
          allocations.amount_paid,
          0
        ) >= co.amount_due
          then 'paid'

        when coalesce(
          allocations.amount_paid,
          0
        ) > 0
          then 'partial'

        else 'open'

      end
        as calculated_status

    from public.contribution_obligations as co

    left join public.contribution_types as ct
      on ct.id =
        co.contribution_type_id

    left join public.contribution_calls as cc
      on cc.id =
        co.contribution_call_id

    left join lateral (

      select

        coalesce(
          sum(pa.amount),
          0
        )::bigint
          as amount_paid

      from public.payment_allocations as pa

      join public.payments as p
        on p.id =
          pa.payment_id

      where
        pa.obligation_id =
          co.id

        and p.member_id =
          member_record.member_id

        and p.organization_id =
          member_record.organization_id

        and p.status =
          'confirmed'::public.payment_status

    ) as allocations
      on true

    where
      co.member_id =
        member_record.member_id

      and co.organization_id =
        member_record.organization_id

  ) as source;


  -- ==========================================================
  -- 5. PAIEMENTS DU MEMBRE
  -- ==========================================================

  select

    coalesce(
      jsonb_agg(
        jsonb_build_object(

          'id',
            source.id,

          'amount',
            source.amount,

          'payment_method',
            source.payment_method,

          'payment_reference',
            source.payment_reference,

          'receipt_number',
            source.receipt_number,

          'notes',
            source.notes,

          'paid_at',
            source.paid_at,

          'allocation_count',
            source.allocation_count,

          'allocated_amount',
            source.allocated_amount

        )
        order by
          source.paid_at desc
      ),
      '[]'::jsonb
    )

  into payments_json

  from (

    select

      p.id,

      p.amount,

      p.payment_method::text
        as payment_method,

      p.payment_reference,

      p.receipt_number,

      p.notes,

      p.paid_at,

      (
        select count(*)

        from public.payment_allocations as pa

        where
          pa.payment_id =
            p.id
      )
        as allocation_count,

      coalesce(
        (
          select sum(pa.amount)

          from public.payment_allocations as pa

          where
            pa.payment_id =
              p.id
        ),
        0
      )::bigint
        as allocated_amount

    from public.payments as p

    where
      p.organization_id =
        member_record.organization_id

      and p.member_id =
        member_record.member_id

      and p.status =
        'confirmed'::public.payment_status

    order by
      p.paid_at desc

    limit 100

  ) as source;


  -- ==========================================================
  -- 6. RESULTAT FINAL
  -- ==========================================================

  return jsonb_build_object(

    'member',

      jsonb_build_object(

        'id',
          member_record.member_id,

        'organization_id',
          member_record.organization_id,

        'member_number',
          member_record.member_number,

        'first_name',
          member_record.first_name,

        'last_name',
          member_record.last_name,

        'phone',
          member_record.phone,

        'email',
          member_record.email,

        'profession',
          member_record.profession,

        'address',
          member_record.address,

        'joined_at',
          member_record.joined_at,

        'status',
          member_record.status::text

      ),

    'organization',

      jsonb_build_object(

        'id',
          member_record.organization_id,

        'name',
          member_record.organization_name,

        'short_name',
          member_record.organization_short_name,

        'public_slug',
          member_record.public_slug

      ),

    'summary',
      coalesce(
        summary_json,
        '{}'::jsonb
      ),

    'obligations',
      coalesce(
        obligations_json,
        '[]'::jsonb
      ),

    'payments',
      coalesce(
        payments_json,
        '[]'::jsonb
      )

  );

end;
$function$
;


CREATE OR REPLACE FUNCTION public.list_my_member_spaces()
 RETURNS TABLE(member_id uuid, organization_id uuid, organization_name text, organization_short_name text, member_number text, first_name text, last_name text, member_status member_status)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

  select

    m.id
      as member_id,

    m.organization_id,

    o.name
      as organization_name,

    o.short_name
      as organization_short_name,

    m.member_number,

    m.first_name,

    m.last_name,

    m.status
      as member_status

  from public.members m

  join public.organizations o
    on o.id = m.organization_id

  join public.organization_users ou
    on ou.organization_id =
      m.organization_id
    and ou.user_id =
      auth.uid()
    and ou.is_active =
      true

  where
    m.user_id = auth.uid()

    and m.status =
      'active'::public.member_status

    and o.status::text =
      'active'

  order by
    o.name asc,
    m.created_at asc;

$function$
;


CREATE OR REPLACE FUNCTION public.get_public_mutual_space(target_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

  organization_record record;

  profile_record record;

  public_member_count bigint := 0;

begin

  -- ==========================================================
  -- MUTUELLE PUBLIQUE
  -- ==========================================================

  select

    o.id,
    o.name,
    o.short_name,
    o.public_slug,
    o.public_page_enabled,
    o.online_membership_enabled

  into organization_record

  from public.organizations o

  where

    lower(o.public_slug) =
      lower(
        btrim(target_slug)
      )

    and o.status::text =
      'active'

    and o.public_page_enabled = true

  limit 1;


  if organization_record.id is null then

    return null;

  end if;


  -- ==========================================================
  -- PROFIL
  -- ==========================================================

  select
    p.*

  into profile_record

  from public.organization_public_profiles p

  where
    p.organization_id =
      organization_record.id;


  -- ==========================================================
  -- NOMBRE PUBLIC DE MEMBRES
  -- ==========================================================

  if coalesce(
    profile_record.show_member_count,
    true
  ) then

    select
      count(*)::bigint

    into public_member_count

    from public.members m

    where
      m.organization_id =
        organization_record.id

      and m.status =
        'active';

  end if;


  -- ==========================================================
  -- REPONSE PUBLIQUE
  -- ==========================================================

  return jsonb_build_object(

    'organization_id',
      organization_record.id,

    'name',
      organization_record.name,

    'short_name',
      organization_record.short_name,

    'slug',
      organization_record.public_slug,

    'online_membership_enabled',
      organization_record.online_membership_enabled,


    'logo_path',
      profile_record.logo_path,

    'cover_image_path',
      profile_record.cover_image_path,

    'slogan',
      profile_record.slogan,

    'short_description',
      profile_record.short_description,

    'about',
      profile_record.about,

    'history',
      profile_record.history,

    'mission',
      profile_record.mission,

    'vision',
      profile_record.vision,

    'values',
      profile_record.values_text,

    'objectives',
      profile_record.objectives,

    'president_message',
      profile_record.president_message,

    'public_phone',
      profile_record.public_phone,

    'public_email',
      profile_record.public_email,

    'location',
      profile_record.location_label,

    'show_member_count',
      coalesce(
        profile_record.show_member_count,
        true
      ),

    'member_count',
      public_member_count,

    'show_leadership',
      coalesce(
        profile_record.show_leadership,
        true
      ),

    'show_projects',
      coalesce(
        profile_record.show_projects,
        true
      ),

    'show_news',
      coalesce(
        profile_record.show_news,
        true
      )

  );

end;
$function$
;


CREATE OR REPLACE FUNCTION public.submit_membership_application(target_slug text, applicant_last_name text, applicant_first_name text, applicant_phone text, applicant_email text DEFAULT NULL::text, applicant_residence text DEFAULT NULL::text, applicant_profession text DEFAULT NULL::text, applicant_motivation text DEFAULT NULL::text, request_key uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

  organization_record record;

  existing_application_id uuid;

  new_application_id uuid;

  request_key_value uuid :=
    request_key;

begin

  -- ==========================================================
  -- MUTUELLE
  -- ==========================================================

  select

    o.id,
    o.online_membership_enabled

  into organization_record

  from public.organizations o

  where

    lower(o.public_slug) =
      lower(
        btrim(target_slug)
      )

    and o.status::text =
      'active'

    and o.public_page_enabled =
      true

  limit 1;


  if organization_record.id is null then

    raise exception
      'Organization not found';

  end if;


  if not organization_record.online_membership_enabled then

    raise exception
      'Online membership is disabled';

  end if;


  -- ==========================================================
  -- VALIDATIONS
  -- ==========================================================

  if nullif(
    btrim(applicant_last_name),
    ''
  ) is null then

    raise exception
      'Last name is required';

  end if;


  if nullif(
    btrim(applicant_first_name),
    ''
  ) is null then

    raise exception
      'First name is required';

  end if;


  if nullif(
    btrim(applicant_phone),
    ''
  ) is null then

    raise exception
      'Phone is required';

  end if;


  -- ==========================================================
  -- IDEMPOTENCE
  -- ==========================================================

  if request_key_value is not null then

    select
      ma.id

    into existing_application_id

    from public.membership_applications ma

    where

      ma.organization_id =
        organization_record.id

      and ma.request_key =
        request_key_value

    limit 1;


    if existing_application_id
       is not null then

      return existing_application_id;

    end if;

  end if;


  -- ==========================================================
  -- EVITER UNE DEUXIEME DEMANDE EN ATTENTE IDENTIQUE
  -- ==========================================================

  select
    ma.id

  into existing_application_id

  from public.membership_applications ma

  where

    ma.organization_id =
      organization_record.id

    and ma.status =
      'pending'

    and (

      lower(
        btrim(ma.phone)
      ) =
      lower(
        btrim(applicant_phone)
      )

      or

      (
        applicant_email is not null
        and
        ma.email is not null
        and
        lower(
          btrim(ma.email)
        ) =
        lower(
          btrim(applicant_email)
        )
      )

    )

  order by
    ma.created_at desc

  limit 1;


  if existing_application_id
     is not null then

    return existing_application_id;

  end if;


  -- ==========================================================
  -- CREATION
  -- ==========================================================

  insert into public.membership_applications (

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

    terms_accepted_at

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

    now()

  )

  returning id
  into new_application_id;


  return new_application_id;

end;
$function$
;


comment on function public.get_my_member_financial_space(uuid)
is
'EWUKAI - espace financier membre limite aux membres actifs disposant d un acces organisation actif dans une organisation active.';

comment on function public.list_my_member_spaces()
is
'EWUKAI - liste uniquement les espaces membres actifs dont l acces organisation et l organisation sont actifs.';

comment on function public.get_public_mutual_space(text)
is
'EWUKAI - expose uniquement une organisation active dont la page publique est activee.';

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
'EWUKAI - accepte une adhesion en ligne uniquement pour une organisation active, publique et ouverte aux adhesions.';

notify pgrst,
  'reload schema';

commit;
