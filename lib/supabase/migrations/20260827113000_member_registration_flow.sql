-- ============================================================
-- AFRI CLUB
-- NOUVEAU PARCOURS D'INSCRIPTION MEMBRE
--
-- 1. Préserve le rôle existant des responsables
-- 2. Enrichit les informations de l'invitation
-- 3. Prépare /inscription/[token]
-- ============================================================


-- ============================================================
-- 1. CLAIM MEMBER ACCESS
--
-- IMPORTANT :
-- Si l'utilisateur est déjà owner / president / treasurer /
-- secretary / auditor, son rôle est conservé.
--
-- Seul un utilisateur sans ligne organization_users reçoit
-- le rôle "member".
-- ============================================================

create or replace function public.claim_member_access(
  target_token_hash text
)
returns table(
  member_id uuid,
  member_number text,
  organization_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$

declare
  current_user_id uuid;
  invitation_record record;

begin

  -- ==========================================================
  -- 1. UTILISATEUR CONNECTE
  -- ==========================================================

  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;


  -- ==========================================================
  -- 2. INVITATION + MEMBRE
  -- ==========================================================

  select
    i.id
      as invitation_id,

    i.organization_id
      as invitation_organization_id,

    i.member_id
      as invitation_member_id,

    i.expires_at
      as invitation_expires_at,

    i.used_at
      as invitation_used_at,

    i.used_by
      as invitation_used_by,

    i.revoked_at
      as invitation_revoked_at,

    m.member_number
      as linked_member_number,

    m.user_id
      as linked_user_id,

    m.status
      as linked_member_status

  into invitation_record

  from public.member_access_invitations as i

  join public.members as m
    on m.id = i.member_id

  where
    i.token_hash =
      lower(
        btrim(
          target_token_hash
        )
      )

  for update of i, m;


  if not found then
    raise exception 'Invitation not found';
  end if;


  -- ==========================================================
  -- 3. MEMBRE ACTIF
  -- ==========================================================

  if invitation_record.linked_member_status <>
     'active'::public.member_status then

    raise exception 'Member is not active';

  end if;


  -- ==========================================================
  -- 4. INVITATION REVOQUEE
  -- ==========================================================

  if invitation_record.invitation_revoked_at
     is not null then

    raise exception 'Invitation revoked';

  end if;


  -- ==========================================================
  -- 5. INVITATION EXPIREE
  -- ==========================================================

  if invitation_record.invitation_expires_at
     <= now() then

    raise exception 'Invitation expired';

  end if;


  -- ==========================================================
  -- 6. INVITATION DEJA UTILISEE
  -- ==========================================================

  if invitation_record.invitation_used_at
     is not null then

    if
      invitation_record.invitation_used_by =
        current_user_id

      and

      invitation_record.linked_user_id =
        current_user_id

    then

      return query

      select
        invitation_record.invitation_member_id,
        invitation_record.linked_member_number,
        invitation_record.invitation_organization_id;

      return;

    end if;


    raise exception 'Invitation already used';

  end if;


  -- ==========================================================
  -- 7. MEMBRE DEJA LIE
  -- ==========================================================

  if invitation_record.linked_user_id
     is not null then

    if invitation_record.linked_user_id =
       current_user_id then

      update public.member_access_invitations as mai

      set
        used_at =
          coalesce(
            mai.used_at,
            now()
          ),

        used_by =
          coalesce(
            mai.used_by,
            current_user_id
          )

      where
        mai.id =
          invitation_record.invitation_id;


      return query

      select
        invitation_record.invitation_member_id,
        invitation_record.linked_member_number,
        invitation_record.invitation_organization_id;

      return;

    end if;


    raise exception
      'Member already linked to another account';

  end if;


  -- ==========================================================
  -- 8. UN SEUL DOSSIER MEMBRE PAR COMPTE ET PAR MUTUELLE
  -- ==========================================================

  if exists (

    select 1

    from public.members as existing_member

    where
      existing_member.organization_id =
        invitation_record.invitation_organization_id

      and existing_member.user_id =
        current_user_id

      and existing_member.id <>
        invitation_record.invitation_member_id

  ) then

    raise exception
      'User already linked to another member';

  end if;


  -- ==========================================================
  -- 9. LIER LE COMPTE AU MEMBRE
  -- ==========================================================

  update public.members as target_member

  set
    user_id =
      current_user_id,

    updated_at =
      now()

  where
    target_member.id =
      invitation_record.invitation_member_id

    and target_member.organization_id =
      invitation_record.invitation_organization_id

    and (
      target_member.user_id is null
      or
      target_member.user_id = current_user_id
    );


  if not found then

    raise exception
      'Unable to link member account';

  end if;


  -- ==========================================================
  -- 10. ORGANIZATION_USERS
  --
  -- CORRECTION CRITIQUE :
  --
  -- Avant :
  -- role = 'member'
  --
  -- Maintenant :
  -- on conserve complètement le rôle existant.
  -- ==========================================================

  update public.organization_users as ou

  set
    is_active = true

  where
    ou.organization_id =
      invitation_record.invitation_organization_id

    and ou.user_id =
      current_user_id;


  -- ==========================================================
  -- 11. CREER LA LIGNE SI ELLE N'EXISTE PAS
  -- ==========================================================

  if not found then

    insert into public.organization_users (
      organization_id,
      user_id,
      role,
      is_active
    )

    values (
      invitation_record.invitation_organization_id,
      current_user_id,
      'member'::public.organization_role,
      true
    );

  end if;


  -- ==========================================================
  -- 12. CONSOMMER L'INVITATION
  -- ==========================================================

  update public.member_access_invitations as mai

  set
    used_at = now(),
    used_by = current_user_id

  where
    mai.id =
      invitation_record.invitation_id

    and mai.used_at is null;


  -- ==========================================================
  -- 13. RESULTAT
  -- ==========================================================

  return query

  select
    invitation_record.invitation_member_id,
    invitation_record.linked_member_number,
    invitation_record.invitation_organization_id;

end;

$function$;


-- ============================================================
-- 2. INFORMATIONS PUBLIQUES DE L'INVITATION
--
-- On ajoute :
-- - organization_id
-- - member_email
-- - email_locked
--
-- Le token reste obligatoire pour obtenir ces informations.
-- ============================================================

create or replace function public.get_member_access_invitation(
  target_token_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare
  invitation_record record;

begin

  select

    i.id,

    i.organization_id,

    i.expires_at,

    i.used_at,

    i.revoked_at,

    m.id
      as member_id,

    m.first_name,

    m.last_name,

    m.member_number,

    m.email
      as member_email,

    m.user_id,

    m.status
      as member_status,

    o.name
      as organization_name,

    o.short_name
      as organization_short_name

  into invitation_record

  from public.member_access_invitations as i

  join public.members as m
    on m.id = i.member_id

  join public.organizations as o
    on o.id = i.organization_id

  where
    i.token_hash =
      lower(
        btrim(
          target_token_hash
        )
      )

  limit 1;


  if not found then
    return null;
  end if;


  return jsonb_build_object(

    'valid',

      (
        invitation_record.used_at
          is null

        and

        invitation_record.revoked_at
          is null

        and

        invitation_record.expires_at
          > now()

        and

        invitation_record.user_id
          is null

        and

        invitation_record.member_status =
          'active'::public.member_status
      ),


    'organization_id',
      invitation_record.organization_id,


    'first_name',
      invitation_record.first_name,


    'last_name',
      invitation_record.last_name,


    'member_number',
      invitation_record.member_number,


    'member_email',
      invitation_record.member_email,


    'email_locked',
      (
        nullif(
          btrim(
            coalesce(
              invitation_record.member_email,
              ''
            )
          ),
          ''
        ) is not null
      ),


    'organization_name',
      invitation_record.organization_name,


    'organization_short_name',
      invitation_record.organization_short_name,


    'expires_at',
      invitation_record.expires_at,


    'already_used',
      invitation_record.used_at
        is not null,


    'revoked',
      invitation_record.revoked_at
        is not null

  );

end;

$function$;


-- ============================================================
-- 3. PETITE CORRECTION DU MESSAGE INTERNE
-- ============================================================

create or replace function public.create_member_access_invitation(
  target_member_id uuid,
  target_token_hash text,
  target_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$

declare
  member_record record;
  invitation_id uuid;

begin

  -- ==========================================================
  -- MEMBRE
  -- ==========================================================

  select
    m.id,
    m.organization_id,
    m.user_id,
    m.status

  into member_record

  from public.members as m

  where
    m.id =
      target_member_id

  for update;


  if not found then
    raise exception 'Member not found';
  end if;


  -- ==========================================================
  -- DROITS
  -- ==========================================================

  if not private.has_organization_role(

    member_record.organization_id,

    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'secretary'::public.organization_role
    ]

  ) then

    raise exception 'Not authorized';

  end if;


  -- ==========================================================
  -- CONTROLES
  -- ==========================================================

  if member_record.status <>
     'active'::public.member_status then

    raise exception 'Member is not active';

  end if;


  if member_record.user_id
     is not null then

    raise exception
      'Member already has member access';

  end if;


  if nullif(
    btrim(target_token_hash),
    ''
  ) is null then

    raise exception 'Token hash is required';

  end if;


  if target_expires_at <= now() then

    raise exception
      'Expiration date must be in the future';

  end if;


  -- ==========================================================
  -- REVOQUER LES ANCIENS LIENS NON UTILISES
  -- ==========================================================

  update public.member_access_invitations

  set
    revoked_at = now(),
    revoked_by = auth.uid()

  where
    organization_id =
      member_record.organization_id

    and member_id =
      member_record.id

    and used_at is null

    and revoked_at is null;


  -- ==========================================================
  -- NOUVEAU LIEN
  -- ==========================================================

  insert into public.member_access_invitations (
    organization_id,
    member_id,
    token_hash,
    expires_at,
    created_by
  )

  values (
    member_record.organization_id,
    member_record.id,

    lower(
      btrim(
        target_token_hash
      )
    ),

    target_expires_at,
    auth.uid()
  )

  returning id
  into invitation_id;


  return invitation_id;

end;

$function$;