-- ============================================================
-- EWUKAI
-- APPROBATION DES DEMANDES D'ADHESION PAYANTES
-- ============================================================
--
-- Règle métier :
-- 1. Demande gratuite :
--    approbation du bureau -> membre créé immédiatement.
--
-- 2. Demande payante :
--    approbation du bureau -> awaiting_payment.
--    Aucun membre n'est créé tant que le droit d'adhésion
--    n'est pas payé ou exonéré.
--
-- 3. Si le droit est déjà marqué paid/waived :
--    l'approbation peut finaliser l'adhésion.
--
-- La fonction conserve exactement la même signature et
-- le même type de retour afin de rester compatible avec
-- l'application Next.js.
-- ============================================================

create or replace function public.approve_membership_application(
  target_application_id uuid,
  approval_note text default null::text
)
returns table(
  member_id uuid,
  member_number text,
  created_new_member boolean
)
language plpgsql
security definer
set search_path to ''
as $function$

declare
  application_record record;

  v_existing_member_id uuid;
  v_existing_member_number text;

  v_new_member_id uuid;
  v_new_member_number text;

  normalized_phone text;

  v_fee_is_settled boolean;

begin

  -- ==========================================================
  -- 1. CHARGER ET VERROUILLER LA DEMANDE
  -- ==========================================================

  select
    ma.id,
    ma.organization_id,
    ma.applicant_user_id,
    ma.last_name,
    ma.first_name,
    ma.phone,
    ma.email,
    ma.residence,
    ma.profession,
    ma.status,
    ma.approved_member_id,

    ma.reviewed_by,
    ma.reviewed_at,
    ma.review_note,

    ma.membership_fee_required,
    ma.membership_fee_amount_xof,
    ma.membership_fee_status

  into application_record

  from public.membership_applications as ma

  where
    ma.id = target_application_id

  for update;


  if not found then
    raise exception
      'Membership application not found';
  end if;


  -- ==========================================================
  -- 2. AUTORISATION
  -- ==========================================================

  if not private.has_organization_role(
    application_record.organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'secretary'::public.organization_role
    ]
  ) then
    raise exception
      'Not authorized';
  end if;


  -- ==========================================================
  -- 3. DEMANDE DEJA APPROUVEE
  -- ==========================================================

  if application_record.status =
     'approved'::public.membership_application_status then

    if application_record.approved_member_id
       is null then
      raise exception
        'Approved application has no member reference';
    end if;


    select
      m.id,
      m.member_number
    into
      v_existing_member_id,
      v_existing_member_number
    from public.members as m
    where
      m.id =
        application_record.approved_member_id
      and m.organization_id =
        application_record.organization_id
    limit 1;


    if v_existing_member_id
       is null then
      raise exception
        'Approved member not found';
    end if;


    return query
    select
      v_existing_member_id,
      v_existing_member_number,
      false;

    return;
  end if;


  -- ==========================================================
  -- 4. STATUT AUTORISE POUR L'APPROBATION
  -- ==========================================================

  if application_record.status not in (
    'pending'::public.membership_application_status,
    'awaiting_payment'::public.membership_application_status
  ) then
    raise exception
      'Application cannot be approved from its current status';
  end if;


  -- ==========================================================
  -- 5. VERIFIER SI LE DROIT D'ADHESION EST REGLE
  -- ==========================================================

  v_fee_is_settled :=
    application_record.membership_fee_status
      in ('paid', 'waived');


  -- ==========================================================
  -- 6. DEMANDE PAYANTE NON ENCORE REGLEE
  --
  -- Le bureau donne son accord, mais aucun membre n'est créé.
  -- ==========================================================

  if
    application_record.membership_fee_required = true
    and application_record.membership_fee_amount_xof > 0
    and not v_fee_is_settled
  then

    update public.membership_applications as ma
    set
      status =
        'awaiting_payment'::public.membership_application_status,

      reviewed_by =
        coalesce(
          ma.reviewed_by,
          auth.uid()
        ),

      reviewed_at =
        coalesce(
          ma.reviewed_at,
          now()
        ),

      review_note =
        case
          when ma.review_note is not null
            then ma.review_note
          else nullif(
            btrim(
              coalesce(
                approval_note,
                ''
              )
            ),
            ''
          )
        end,

      updated_at =
        now()

    where
      ma.id =
        application_record.id;


    return query
    select
      null::uuid,
      null::text,
      false;

    return;
  end if;


  -- ==========================================================
  -- 7. VERIFIER SI LE COMPTE EST DEJA LIE A UN MEMBRE
  -- ==========================================================

  if application_record.applicant_user_id
     is not null then

    select
      m.id,
      m.member_number
    into
      v_existing_member_id,
      v_existing_member_number
    from public.members as m
    where
      m.organization_id =
        application_record.organization_id
      and m.user_id =
        application_record.applicant_user_id
    limit 1;


    if v_existing_member_id
       is not null then

      update public.membership_applications as ma
      set
        status =
          'approved'::public.membership_application_status,

        approved_member_id =
          v_existing_member_id,

        reviewed_by =
          coalesce(
            ma.reviewed_by,
            auth.uid()
          ),

        reviewed_at =
          coalesce(
            ma.reviewed_at,
            now()
          ),

        review_note =
          coalesce(
            ma.review_note,
            nullif(
              btrim(
                coalesce(
                  approval_note,
                  ''
                )
              ),
              ''
            )
          ),

        updated_at =
          now()

      where
        ma.id =
          application_record.id;


      return query
      select
        v_existing_member_id,
        v_existing_member_number,
        false;

      return;
    end if;

  end if;


  -- ==========================================================
  -- 8. NORMALISER LE TELEPHONE
  -- ==========================================================

  normalized_phone :=
    regexp_replace(
      coalesce(
        application_record.phone,
        ''
      ),
      '[^0-9+]',
      '',
      'g'
    );


  -- ==========================================================
  -- 9. EVITER UN DOUBLON PAR TELEPHONE
  -- ==========================================================

  if normalized_phone <> '' then

    if exists (
      select 1
      from public.members as existing_member
      where
        existing_member.organization_id =
          application_record.organization_id
        and regexp_replace(
          coalesce(
            existing_member.phone,
            ''
          ),
          '[^0-9+]',
          '',
          'g'
        ) =
        normalized_phone
    ) then
      raise exception
        'A member with this phone already exists';
    end if;

  end if;


  -- ==========================================================
  -- 10. EVITER UN DOUBLON PAR EMAIL
  -- ==========================================================

  if nullif(
    btrim(
      coalesce(
        application_record.email,
        ''
      )
    ),
    ''
  ) is not null then

    if exists (
      select 1
      from public.members as existing_member
      where
        existing_member.organization_id =
          application_record.organization_id
        and existing_member.email is not null
        and lower(
          btrim(
            existing_member.email
          )
        ) =
        lower(
          btrim(
            application_record.email
          )
        )
    ) then
      raise exception
        'A member with this email already exists';
    end if;

  end if;


  -- ==========================================================
  -- 11. CREER LE MEMBRE
  --
  -- Le trigger existant génère le matricule.
  -- ==========================================================

  insert into public.members as new_member (
    organization_id,
    user_id,

    first_name,
    last_name,

    phone,
    email,

    profession,
    address,

    joined_at,
    status,
    created_by
  )

  values (
    application_record.organization_id,

    application_record.applicant_user_id,

    btrim(
      application_record.first_name
    ),

    upper(
      btrim(
        application_record.last_name
      )
    ),

    nullif(
      btrim(
        coalesce(
          application_record.phone,
          ''
        )
      ),
      ''
    ),

    nullif(
      lower(
        btrim(
          coalesce(
            application_record.email,
            ''
          )
        )
      ),
      ''
    ),

    nullif(
      btrim(
        coalesce(
          application_record.profession,
          ''
        )
      ),
      ''
    ),

    nullif(
      btrim(
        coalesce(
          application_record.residence,
          ''
        )
      ),
      ''
    ),

    current_date,

    'active'::public.member_status,

    auth.uid()
  )

  returning
    new_member.id,
    new_member.member_number

  into
    v_new_member_id,
    v_new_member_number;


  -- ==========================================================
  -- 12. APPROUVER DEFINITIVEMENT LA DEMANDE
  -- ==========================================================

  update public.membership_applications as ma
  set
    status =
      'approved'::public.membership_application_status,

    approved_member_id =
      v_new_member_id,

    reviewed_by =
      coalesce(
        ma.reviewed_by,
        auth.uid()
      ),

    reviewed_at =
      coalesce(
        ma.reviewed_at,
        now()
      ),

    review_note =
      coalesce(
        ma.review_note,
        nullif(
          btrim(
            coalesce(
              approval_note,
              ''
            )
          ),
          ''
        )
      ),

    updated_at =
      now()

  where
    ma.id =
      application_record.id;


  -- ==========================================================
  -- 13. RESULTAT
  -- ==========================================================

  return query
  select
    v_new_member_id,
    v_new_member_number,
    true;

end;
$function$;


grant execute
on function public.approve_membership_application(uuid, text)
to authenticated;
