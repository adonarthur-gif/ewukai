-- ============================================================
-- EWUKAI
-- GESTION DES STATUTS ET SUPPRESSIONS SECURISEES
-- Membres + Organisations
--
-- Principes :
-- - la désactivation conserve l'historique ;
-- - la suppression définitive exige d'abord une désactivation ;
-- - aucune suppression définitive si des données métier existent ;
-- - les droits sont revérifiés côté base ;
-- - la désactivation d'une organisation suspend temporairement
--   ses accès sans perdre l'état antérieur des utilisateurs.
-- ============================================================

-- ============================================================
-- 1. SNAPSHOT DES ACCES D'UNE ORGANISATION DESACTIVEE
-- ============================================================

create table if not exists private.organization_access_state_snapshot (
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  was_active boolean not null,

  captured_at timestamptz
    not null
    default now(),

  primary key (
    organization_id,
    user_id
  )
);

revoke all
on table private.organization_access_state_snapshot
from public;

revoke all
on table private.organization_access_state_snapshot
from anon;

revoke all
on table private.organization_access_state_snapshot
from authenticated;


-- ============================================================
-- 1 BIS. SNAPSHOT DES PARAMETRES PUBLICS DE L'ORGANISATION
-- ============================================================

create table if not exists private.organization_status_snapshot (
  organization_id uuid
    primary key
    references public.organizations(id)
    on delete cascade,

  public_page_enabled boolean
    not null,

  online_membership_enabled boolean
    not null,

  captured_at timestamptz
    not null
    default now()
);

revoke all
on table private.organization_status_snapshot
from public;

revoke all
on table private.organization_status_snapshot
from anon;

revoke all
on table private.organization_status_snapshot
from authenticated;


-- ============================================================
-- 2. ACTIVER / DESACTIVER UN MEMBRE
-- ============================================================

create or replace function public.set_member_management_status(
  target_member_id uuid,
  target_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
  member_record record;
  normalized_status text;
begin
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'Authentication required';
  end if;

  if target_member_id is null then
    raise exception
      'Member id is required';
  end if;

  normalized_status :=
    lower(
      btrim(
        coalesce(
          target_status,
          ''
        )
      )
    );

  if normalized_status
     not in (
       'active',
       'inactive'
     ) then
    raise exception
      'Invalid member status';
  end if;

  select
    m.id,
    m.organization_id,
    m.user_id,
    m.status::text
      as current_status
  into
    member_record
  from public.members as m
  where
    m.id =
      target_member_id
  for update;

  if not found then
    raise exception
      'Member not found';
  end if;

  if not private.has_organization_role(
    member_record.organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'secretary'::public.organization_role
    ]
  ) then
    raise exception
      'Not authorized';
  end if;

  if normalized_status =
     'active' then

    update public.members
    set
      status =
        'active'::public.member_status,
      updated_at =
        now()
    where
      id =
        target_member_id;

    -- On ne réactive que le rôle membre.
    -- Un responsable conserve ses propres droits de gestion.
    if member_record.user_id
       is not null then

      update public.organization_users
      set
        is_active =
          true
      where
        organization_id =
          member_record.organization_id
        and user_id =
          member_record.user_id
        and role::text =
          'member';

    end if;

  else

    update public.members
    set
      status =
        'inactive'::public.member_status,
      updated_at =
        now()
    where
      id =
        target_member_id;

    -- Révoquer toute invitation encore exploitable.
    update public.member_access_invitations
    set
      revoked_at =
        coalesce(
          revoked_at,
          now()
        ),
      revoked_by =
        coalesce(
          revoked_by,
          current_user_id
        )
    where
      member_id =
        target_member_id
      and used_at is null
      and revoked_at is null;

    -- Si le compte n'est qu'un membre ordinaire de cette
    -- organisation, son accès organisation est désactivé.
    -- Les autres organisations du même compte ne sont jamais touchées.
    if member_record.user_id
       is not null then

      update public.organization_users
      set
        is_active =
          false
      where
        organization_id =
          member_record.organization_id
        and user_id =
          member_record.user_id
        and role::text =
          'member';

    end if;

  end if;

  return
    normalized_status;
end;
$function$;


revoke all
on function public.set_member_management_status(
  uuid,
  text
)
from public;

revoke all
on function public.set_member_management_status(
  uuid,
  text
)
from anon;

revoke all
on function public.set_member_management_status(
  uuid,
  text
)
from authenticated;

grant execute
on function public.set_member_management_status(
  uuid,
  text
)
to authenticated;


-- ============================================================
-- 3. SUPPRIMER UN MEMBRE SEULEMENT S'IL EST REELLEMENT VIDE
-- ============================================================

create or replace function public.delete_member_if_safe(
  target_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  member_record record;
  fk_record record;
  has_related_rows boolean;
begin
  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  if target_member_id is null then
    raise exception
      'Member id is required';
  end if;

  select
    m.id,
    m.organization_id,
    m.user_id,
    m.status::text
      as current_status
  into
    member_record
  from public.members as m
  where
    m.id =
      target_member_id
  for update;

  if not found then
    raise exception
      'Member not found';
  end if;

  if not private.has_organization_role(
    member_record.organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'secretary'::public.organization_role
    ]
  ) then
    raise exception
      'Not authorized';
  end if;

  if member_record.current_status <>
     'inactive' then
    raise exception
      'Member must be inactive before deletion';
  end if;

  -- Un dossier déjà lié à un compte EWUKAI ne doit pas être
  -- supprimé physiquement depuis une organisation.
  if member_record.user_id
     is not null then
    raise exception
      'Member has an EWUKAI account';
  end if;

  -- Parcourir toutes les clés étrangères simples qui pointent
  -- vers public.members(id). Toute donnée liée bloque la suppression,
  -- sauf les invitations d'accès qui sont purement techniques.
  for fk_record in
    select
      ns.nspname
        as schema_name,
      cls.relname
        as table_name,
      att.attname
        as column_name
    from pg_catalog.pg_constraint as con
    join pg_catalog.pg_class as cls
      on cls.oid =
        con.conrelid
    join pg_catalog.pg_namespace as ns
      on ns.oid =
        cls.relnamespace
    join pg_catalog.pg_attribute as att
      on att.attrelid =
        con.conrelid
      and att.attnum =
        con.conkey[1]
    where
      con.contype =
        'f'
      and con.confrelid =
        'public.members'::regclass
      and pg_catalog.array_length(
        con.conkey,
        1
      ) = 1
      and pg_catalog.array_length(
        con.confkey,
        1
      ) = 1
  loop

    if fk_record.schema_name =
       'public'
       and fk_record.table_name =
       'member_access_invitations' then
      continue;
    end if;

    execute pg_catalog.format(
      'select exists (
         select 1
         from %I.%I
         where %I = $1
         limit 1
       )',
      fk_record.schema_name,
      fk_record.table_name,
      fk_record.column_name
    )
    into
      has_related_rows
    using
      target_member_id;

    if has_related_rows then
      raise exception
        'Member has related history in %.%',
        fk_record.schema_name,
        fk_record.table_name;
    end if;

  end loop;

  -- Invitations techniques : supprimables avec le dossier
  -- lorsque le membre n'a aucun autre historique.
  delete from
    public.member_access_invitations
  where
    member_id =
      target_member_id;

  delete from
    public.members
  where
    id =
      target_member_id;

  return true;

exception
  when foreign_key_violation then
    raise exception
      'Member has related history';
end;
$function$;


revoke all
on function public.delete_member_if_safe(
  uuid
)
from public;

revoke all
on function public.delete_member_if_safe(
  uuid
)
from anon;

revoke all
on function public.delete_member_if_safe(
  uuid
)
from authenticated;

grant execute
on function public.delete_member_if_safe(
  uuid
)
to authenticated;


-- ============================================================
-- 4. ACTIVER / DESACTIVER UNE ORGANISATION - SUPER ADMIN
-- ============================================================

create or replace function public.set_platform_organization_status(
  target_organization_id uuid,
  target_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
  normalized_status text;
  organization_record record;
  snapshot_exists boolean;
begin
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

  if target_organization_id is null then
    raise exception
      'Organization id is required';
  end if;

  normalized_status :=
    lower(
      btrim(
        coalesce(
          target_status,
          ''
        )
      )
    );

  if normalized_status
     not in (
       'active',
       'inactive'
     ) then
    raise exception
      'Invalid organization status';
  end if;

  select
    o.id,
    o.status::text
      as current_status,
    o.public_page_enabled,
    o.online_membership_enabled
  into
    organization_record
  from public.organizations as o
  where
    o.id =
      target_organization_id
  for update;

  if not found then
    raise exception
      'Organization not found';
  end if;

  -- Une demande identique a l'etat actuel ne doit produire
  -- aucun effet secondaire sur les acces ou les parametres.
  -- Cela rend la fonction idempotente :
  -- active -> active et inactive -> inactive ne modifient rien.
  if organization_record.current_status =
     normalized_status then
    return normalized_status;
  end if;

  if normalized_status =
     'inactive' then

    -- Snapshot idempotent : si l'organisation est déjà désactivée,
    -- on ne remplace pas l'état historique des accès.
    if organization_record.current_status <>
       'inactive' then

      delete from
        private.organization_access_state_snapshot
      where
        organization_id =
          target_organization_id;

      insert into
        private.organization_status_snapshot (
          organization_id,
          public_page_enabled,
          online_membership_enabled,
          captured_at
        )
      values (
        target_organization_id,
        coalesce(
          organization_record.public_page_enabled,
          false
        ),
        coalesce(
          organization_record.online_membership_enabled,
          false
        ),
        now()
      )
      on conflict (
        organization_id
      )
      do update
      set
        public_page_enabled =
          excluded.public_page_enabled,
        online_membership_enabled =
          excluded.online_membership_enabled,
        captured_at =
          excluded.captured_at;

      insert into
        private.organization_access_state_snapshot (
          organization_id,
          user_id,
          was_active
        )
      select
        ou.organization_id,
        ou.user_id,
        ou.is_active
      from
        public.organization_users as ou
      where
        ou.organization_id =
          target_organization_id
      on conflict (
        organization_id,
        user_id
      )
      do update
      set
        was_active =
          excluded.was_active,
        captured_at =
          now();

    end if;

    -- Couper les accès de l'organisation sans toucher aux comptes
    -- EWUKAI ni aux autres organisations des utilisateurs.
    update public.organization_users
    set
      is_active =
        false
    where
      organization_id =
        target_organization_id;

    update public.organizations
    set
      status =
        'inactive',
      public_page_enabled =
        false,
      online_membership_enabled =
        false,
      updated_at =
        now()
    where
      id =
        target_organization_id;

  else

    select
      exists (
        select 1
        from private.organization_access_state_snapshot as s
        where
          s.organization_id =
            target_organization_id
      )
    into
      snapshot_exists;

    if snapshot_exists then

      update public.organization_users as ou
      set
        is_active =
          s.was_active
      from
        private.organization_access_state_snapshot as s
      where
        s.organization_id =
          target_organization_id
        and ou.organization_id =
          s.organization_id
        and ou.user_id =
          s.user_id;

      delete from
        private.organization_access_state_snapshot
      where
        organization_id =
          target_organization_id;

    else

      -- Repli pour une organisation qui aurait été rendue inactive
      -- avant cette migration : on garantit au minimum le retour
      -- d'un propriétaire actif.
      update public.organization_users
      set
        is_active =
          true
      where
        organization_id =
          target_organization_id
        and role::text =
          'owner';

    end if;

    if exists (
      select 1
      from private.organization_status_snapshot as oss
      where
        oss.organization_id =
          target_organization_id
    ) then

      update public.organizations as o
      set
        status =
          'active',
        public_page_enabled =
          oss.public_page_enabled,
        online_membership_enabled =
          oss.online_membership_enabled,
        updated_at =
          now()
      from
        private.organization_status_snapshot as oss
      where
        o.id =
          target_organization_id
        and oss.organization_id =
          target_organization_id;

      delete from
        private.organization_status_snapshot
      where
        organization_id =
          target_organization_id;

    else

      update public.organizations
      set
        status =
          'active',
        updated_at =
          now()
      where
        id =
          target_organization_id;

    end if;

  end if;

  return
    normalized_status;
end;
$function$;


revoke all
on function public.set_platform_organization_status(
  uuid,
  text
)
from public;

revoke all
on function public.set_platform_organization_status(
  uuid,
  text
)
from anon;

revoke all
on function public.set_platform_organization_status(
  uuid,
  text
)
from authenticated;

grant execute
on function public.set_platform_organization_status(
  uuid,
  text
)
to authenticated;


-- ============================================================
-- 5. SUPPRIMER UNE ORGANISATION VIDE - SUPER ADMIN
-- ============================================================

create or replace function public.delete_platform_organization_if_safe(
  target_organization_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
  organization_record record;
  fk_record record;
  has_related_rows boolean;
  has_billing_history boolean;
begin
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

  if target_organization_id is null then
    raise exception
      'Organization id is required';
  end if;

  select
    o.id,
    o.status::text
      as current_status
  into
    organization_record
  from public.organizations as o
  where
    o.id =
      target_organization_id
  for update;

  if not found then
    raise exception
      'Organization not found';
  end if;

  if organization_record.current_status <>
     'inactive' then
    raise exception
      'Organization must be inactive before deletion';
  end if;

  -- Toute facture d'abonnement constitue un historique de facturation.
  select
    exists (
      select 1
      from public.subscription_invoices as si
      join public.organization_subscriptions as os
        on os.id =
          si.subscription_id
      where
        os.organization_id =
          target_organization_id
    )
  into
    has_billing_history;

  if has_billing_history then
    raise exception
      'Organization has billing history';
  end if;

  -- Toute tentative de paiement SaaS constitue également un historique.
  if pg_catalog.to_regclass(
       'public.subscription_payment_attempts'
     ) is not null then

    execute
      'select exists (
         select 1
         from public.subscription_payment_attempts
         where organization_id = $1
         limit 1
       )'
    into
      has_billing_history
    using
      target_organization_id;

    if has_billing_history then
      raise exception
        'Organization has billing history';
    end if;

  end if;

  -- Bloquer la suppression si une table métier quelconque référence
  -- encore l'organisation. Les seules exceptions sont :
  -- - organization_users : droits techniques ;
  -- - organization_public_profiles : branding/configuration ;
  -- - organization_subscriptions : abonnement sans facture ;
  -- - snapshot privé : état technique de suspension.
  for fk_record in
    select
      ns.nspname
        as schema_name,
      cls.relname
        as table_name,
      att.attname
        as column_name
    from pg_catalog.pg_constraint as con
    join pg_catalog.pg_class as cls
      on cls.oid =
        con.conrelid
    join pg_catalog.pg_namespace as ns
      on ns.oid =
        cls.relnamespace
    join pg_catalog.pg_attribute as att
      on att.attrelid =
        con.conrelid
      and att.attnum =
        con.conkey[1]
    where
      con.contype =
        'f'
      and con.confrelid =
        'public.organizations'::regclass
      and pg_catalog.array_length(
        con.conkey,
        1
      ) = 1
      and pg_catalog.array_length(
        con.confkey,
        1
      ) = 1
  loop

    if (
      fk_record.schema_name =
        'public'
      and fk_record.table_name
        in (
          'organization_users',
          'organization_public_profiles',
          'organization_subscriptions'
        )
    ) or (
      fk_record.schema_name =
        'private'
      and fk_record.table_name
        in (
          'organization_access_state_snapshot',
          'organization_status_snapshot'
        )
    ) then
      continue;
    end if;

    execute pg_catalog.format(
      'select exists (
         select 1
         from %I.%I
         where %I = $1
         limit 1
       )',
      fk_record.schema_name,
      fk_record.table_name,
      fk_record.column_name
    )
    into
      has_related_rows
    using
      target_organization_id;

    if has_related_rows then
      raise exception
        'Organization has related data in %.%',
        fk_record.schema_name,
        fk_record.table_name;
    end if;

  end loop;

  delete from
    private.organization_access_state_snapshot
  where
    organization_id =
      target_organization_id;

  delete from
    private.organization_status_snapshot
  where
    organization_id =
      target_organization_id;

  delete from
    public.organization_users
  where
    organization_id =
      target_organization_id;

  delete from
    public.organization_public_profiles
  where
    organization_id =
      target_organization_id;

  delete from
    public.organization_subscriptions
  where
    organization_id =
      target_organization_id;

  delete from
    public.organizations
  where
    id =
      target_organization_id;

  return true;

exception
  when foreign_key_violation then
    raise exception
      'Organization has related data';
end;
$function$;


revoke all
on function public.delete_platform_organization_if_safe(
  uuid
)
from public;

revoke all
on function public.delete_platform_organization_if_safe(
  uuid
)
from anon;

revoke all
on function public.delete_platform_organization_if_safe(
  uuid
)
from authenticated;

grant execute
on function public.delete_platform_organization_if_safe(
  uuid
)
to authenticated;


comment on function public.set_member_management_status(
  uuid,
  text
)
is
'EWUKAI - active ou désactive un membre avec contrôle des rôles et des accès.';

comment on function public.delete_member_if_safe(
  uuid
)
is
'EWUKAI - supprime physiquement un membre uniquement s il est inactif, sans compte lié et sans historique.';

comment on function public.set_platform_organization_status(
  uuid,
  text
)
is
'EWUKAI - Super-admin : active ou désactive une organisation et suspend/restaure ses accès.';

comment on function public.delete_platform_organization_if_safe(
  uuid
)
is
'EWUKAI - Super-admin : supprime uniquement une organisation inactive et dépourvue de données métier ou de facturation.';


notify pgrst,
  'reload schema';
