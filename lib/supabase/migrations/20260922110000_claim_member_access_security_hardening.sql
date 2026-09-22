begin;

-- ============================================================
-- EWUKAI
-- DURCISSEMENT DE L'ACTIVATION D'UN ACCES MEMBRE
--
-- Corrige deux risques :
-- 1. ne jamais remplacer un role de gestion existant par "member" ;
-- 2. interdire la reclamation d'une invitation lorsque
--    l'organisation est inactive.
--
-- La fonction de consultation est egalement alignee afin qu'un
-- lien soit annonce valide uniquement si le membre ET
-- l'organisation sont actifs.
-- ============================================================


-- ============================================================
-- 1. RECLAMER UN ACCES MEMBRE
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
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required';
  end if;

  if nullif(
    btrim(target_token_hash),
    ''
  ) is null then
    raise exception
      'Token hash is required';
  end if;


  -- ----------------------------------------------------------
  -- Charger et verrouiller ensemble :
  -- - l'invitation ;
  -- - le dossier membre ;
  -- - l'organisation.
  --
  -- Le verrou sur l'organisation serialise cette operation avec
  -- une desactivation concurrente de l'organisation.
  -- ----------------------------------------------------------

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

    m.status::text
      as linked_member_status,

    o.status::text
      as organization_status

  into
    invitation_record

  from
    public.member_access_invitations as i

  join
    public.members as m
      on m.id =
        i.member_id

  join
    public.organizations as o
      on o.id =
        i.organization_id

  where
    i.token_hash =
      lower(
        btrim(
          target_token_hash
        )
      )

  for update of i, m, o;


  if not found then
    raise exception
      'Invitation not found';
  end if;


  -- ----------------------------------------------------------
  -- Une organisation suspendue ne doit jamais pouvoir recreer
  -- un acces actif via une ancienne invitation.
  -- ----------------------------------------------------------

  if invitation_record.organization_status <>
     'active' then
    raise exception
      'Organization is not active';
  end if;


  if invitation_record.linked_member_status <>
     'active' then
    raise exception
      'Member is not active';
  end if;


  if invitation_record.invitation_revoked_at
     is not null then
    raise exception
      'Invitation revoked';
  end if;


  if invitation_record.invitation_expires_at
     <= now() then
    raise exception
      'Invitation expired';
  end if;


  -- ----------------------------------------------------------
  -- Idempotence : meme invitation + meme utilisateur.
  -- ----------------------------------------------------------

  if invitation_record.invitation_used_at
     is not null then

    if invitation_record.invitation_used_by =
       current_user_id
       and
       invitation_record.linked_user_id =
       current_user_id then

      return query
      select
        invitation_record.invitation_member_id,
        invitation_record.linked_member_number,
        invitation_record.invitation_organization_id;

      return;
    end if;

    raise exception
      'Invitation already used';
  end if;


  -- ----------------------------------------------------------
  -- Dossier deja lie.
  -- ----------------------------------------------------------

  if invitation_record.linked_user_id
     is not null then

    if invitation_record.linked_user_id =
       current_user_id then

      update
        public.member_access_invitations as mai
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


  -- ----------------------------------------------------------
  -- Un meme compte ne peut pas representer deux dossiers
  -- membres differents dans la meme organisation.
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- Lier le compte auth au dossier membre.
  -- ----------------------------------------------------------

  update
    public.members as target_member
  set
    user_id =
      current_user_id,

    updated_at =
      now()
  where
    target_member.id =
      invitation_record.invitation_member_id
    and target_member.organization_id =
      invitation_record.invitation_organization_id;


  if not found then
    raise exception
      'Unable to link member account';
  end if;


  -- ----------------------------------------------------------
  -- Donner l'acces organisation SANS ECRASER UN ROLE EXISTANT.
  --
  -- - aucune ligne : creation en "member", active ;
  -- - role "member" existant : reactivation ;
  -- - owner/president/secretary/autre role existant :
  --   role et etat d'acces conserves tels quels.
  -- ----------------------------------------------------------

  insert into public.organization_users as ou (
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
  )
  on conflict (
    organization_id,
    user_id
  )
  do update
  set
    is_active =
      case
        when ou.role =
             'member'::public.organization_role
          then true
        else ou.is_active
      end;


  -- ----------------------------------------------------------
  -- Consommer l'invitation.
  -- ----------------------------------------------------------

  update
    public.member_access_invitations as mai
  set
    used_at =
      now(),

    used_by =
      current_user_id
  where
    mai.id =
      invitation_record.invitation_id
    and mai.used_at
      is null;


  return query
  select
    invitation_record.invitation_member_id,
    invitation_record.linked_member_number,
    invitation_record.invitation_organization_id;
end;
$function$;


-- ============================================================
-- 2. INFORMATIONS PUBLIQUES DE L'INVITATION
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
  if nullif(
    btrim(target_token_hash),
    ''
  ) is null then
    return null;
  end if;

  select
    i.id,
    i.expires_at,
    i.used_at,
    i.revoked_at,

    m.id
      as member_id,

    m.first_name,
    m.last_name,
    m.member_number,
    m.user_id,

    m.status::text
      as member_status,

    o.name
      as organization_name,

    o.short_name
      as organization_short_name,

    o.status::text
      as organization_status

  into
    invitation_record

  from
    public.member_access_invitations as i

  join
    public.members as m
      on m.id =
        i.member_id

  join
    public.organizations as o
      on o.id =
        i.organization_id

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

        and invitation_record.revoked_at
          is null

        and invitation_record.expires_at
          > now()

        and invitation_record.user_id
          is null

        and invitation_record.member_status =
          'active'

        and invitation_record.organization_status =
          'active'
      ),

    'first_name',
      invitation_record.first_name,

    'last_name',
      invitation_record.last_name,

    'member_number',
      invitation_record.member_number,

    'organization_name',
      invitation_record.organization_name,

    'organization_short_name',
      invitation_record.organization_short_name,

    'expires_at',
      invitation_record.expires_at,

    'already_used',
      invitation_record.used_at
        is not null
  );
end;
$function$;


comment on function public.claim_member_access(
  text
)
is
'EWUKAI - reclame un acces membre sans ecraser un role organisation existant et refuse les organisations inactives.';


comment on function public.get_member_access_invitation(
  text
)
is
'EWUKAI - retourne les informations d une invitation membre et ne la declare valide que si le membre et l organisation sont actifs.';


notify pgrst,
  'reload schema';

commit;
