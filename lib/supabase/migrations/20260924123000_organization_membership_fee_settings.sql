-- ============================================================================
-- EWUKAI
-- CONFIGURATION DES ADHESIONS EN LIGNE ET DU DROIT D'ADHESION
-- Migration : 20260924123000_organization_membership_fee_settings.sql
--
-- Principes :
-- - l'organisation décide si les demandes d'adhésion en ligne sont ouvertes ;
-- - l'organisation décide si l'adhésion est gratuite ou payante ;
-- - si elle est payante, le responsable fixe le montant ;
-- - le paiement d'une adhésion payante intervient après validation par le bureau ;
-- - owner / president configurent la politique d'adhésion ;
-- - les paramètres financiers ne sont pas modifiables directement depuis le navigateur ;
-- - une lecture publique minimale est exposée uniquement pour la page d'adhésion.
-- ============================================================================

create table if not exists public.organization_membership_settings (
  organization_id uuid
    primary key
    references public.organizations(id)
    on delete cascade,

  membership_fee_enabled boolean
    not null
    default false,

  membership_fee_amount_xof bigint
    not null
    default 0,

  payment_timing text
    not null
    default 'after_approval',

  allow_fee_waiver boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  updated_by uuid
    references auth.users(id)
    on delete set null,

  constraint organization_membership_settings_fee_amount_check
    check (
      membership_fee_amount_xof >= 0
      and (
        membership_fee_enabled = false
        or membership_fee_amount_xof > 0
      )
    ),

  constraint organization_membership_settings_payment_timing_check
    check (
      payment_timing in ('after_approval')
    )
);

comment on table public.organization_membership_settings is
  'Configuration de la politique d adhesion propre a chaque organisation EWUKAI.';

comment on column public.organization_membership_settings.membership_fee_enabled is
  'Indique si un droit d adhesion est exige.';

comment on column public.organization_membership_settings.membership_fee_amount_xof is
  'Montant du droit d adhesion en FCFA/XOF lorsque l adhesion est payante.';

comment on column public.organization_membership_settings.payment_timing is
  'Moment du paiement. V1 : apres approbation de la demande.';

comment on column public.organization_membership_settings.allow_fee_waiver is
  'Autorise owner/president a exonerer exceptionnellement un candidat.';

insert into public.organization_membership_settings (
  organization_id
)
select
  o.id
from public.organizations as o
on conflict (organization_id)
do nothing;

alter table public.organization_membership_settings
  enable row level security;

revoke all
on table public.organization_membership_settings
from public;

revoke all
on table public.organization_membership_settings
from anon;

revoke all
on table public.organization_membership_settings
from authenticated;

create or replace function public.get_organization_membership_settings(
  target_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization id is required';
  end if;

  if not private.has_organization_role(
    target_organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role,
      'secretary'::public.organization_role,
      'auditor'::public.organization_role
    ]
  ) then
    raise exception 'Not authorized';
  end if;

  select
    jsonb_build_object(
      'organization_id', o.id,
      'organization_name', o.name,
      'short_name', o.short_name,
      'public_slug', o.public_slug,
      'online_membership_enabled', coalesce(o.online_membership_enabled, false),
      'membership_fee_enabled', coalesce(s.membership_fee_enabled, false),
      'membership_fee_amount_xof', coalesce(s.membership_fee_amount_xof, 0),
      'payment_timing', coalesce(s.payment_timing, 'after_approval'),
      'allow_fee_waiver', coalesce(s.allow_fee_waiver, true),
      'updated_at', s.updated_at
    )
  into result
  from public.organizations as o
  left join public.organization_membership_settings as s
    on s.organization_id = o.id
  where o.id = target_organization_id;

  if result is null then
    raise exception 'Organization not found';
  end if;

  return result;
end;
$function$;

revoke all
on function public.get_organization_membership_settings(uuid)
from public;

revoke all
on function public.get_organization_membership_settings(uuid)
from anon;

revoke all
on function public.get_organization_membership_settings(uuid)
from authenticated;

grant execute
on function public.get_organization_membership_settings(uuid)
to authenticated;

create or replace function public.update_organization_membership_settings(
  target_organization_id uuid,
  target_online_membership_enabled boolean,
  target_fee_enabled boolean,
  target_fee_amount_xof bigint,
  target_allow_fee_waiver boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_fee_enabled boolean;
  normalized_fee_amount_xof bigint;
  normalized_allow_fee_waiver boolean;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization id is required';
  end if;

  if not private.has_organization_role(
    target_organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role
    ]
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.organizations as o
    where o.id = target_organization_id
  ) then
    raise exception 'Organization not found';
  end if;

  normalized_fee_enabled := coalesce(target_fee_enabled, false);
  normalized_allow_fee_waiver := coalesce(target_allow_fee_waiver, true);

  if normalized_fee_enabled then
    normalized_fee_amount_xof := coalesce(target_fee_amount_xof, 0);

    if normalized_fee_amount_xof <= 0 then
      raise exception 'Membership fee amount must be greater than zero';
    end if;
  else
    normalized_fee_amount_xof := 0;
  end if;

  update public.organizations
  set
    online_membership_enabled = coalesce(target_online_membership_enabled, false),
    updated_at = now()
  where id = target_organization_id;

  insert into public.organization_membership_settings (
    organization_id,
    membership_fee_enabled,
    membership_fee_amount_xof,
    payment_timing,
    allow_fee_waiver,
    updated_at,
    updated_by
  )
  values (
    target_organization_id,
    normalized_fee_enabled,
    normalized_fee_amount_xof,
    'after_approval',
    normalized_allow_fee_waiver,
    now(),
    auth.uid()
  )
  on conflict (organization_id)
  do update
  set
    membership_fee_enabled = excluded.membership_fee_enabled,
    membership_fee_amount_xof = excluded.membership_fee_amount_xof,
    payment_timing = excluded.payment_timing,
    allow_fee_waiver = excluded.allow_fee_waiver,
    updated_at = now(),
    updated_by = auth.uid();

  select
    jsonb_build_object(
      'organization_id', o.id,
      'public_slug', o.public_slug,
      'online_membership_enabled', coalesce(o.online_membership_enabled, false),
      'membership_fee_enabled', s.membership_fee_enabled,
      'membership_fee_amount_xof', s.membership_fee_amount_xof,
      'payment_timing', s.payment_timing,
      'allow_fee_waiver', s.allow_fee_waiver,
      'updated_at', s.updated_at
    )
  into result
  from public.organizations as o
  join public.organization_membership_settings as s
    on s.organization_id = o.id
  where o.id = target_organization_id;

  return result;
end;
$function$;

revoke all
on function public.update_organization_membership_settings(
  uuid,
  boolean,
  boolean,
  bigint,
  boolean
)
from public;

revoke all
on function public.update_organization_membership_settings(
  uuid,
  boolean,
  boolean,
  bigint,
  boolean
)
from anon;

revoke all
on function public.update_organization_membership_settings(
  uuid,
  boolean,
  boolean,
  bigint,
  boolean
)
from authenticated;

grant execute
on function public.update_organization_membership_settings(
  uuid,
  boolean,
  boolean,
  bigint,
  boolean
)
to authenticated;

create or replace function public.get_public_membership_offer(
  target_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  normalized_slug text;
  result jsonb;
begin
  normalized_slug := lower(btrim(coalesce(target_slug, '')));

  if normalized_slug = '' then
    return null;
  end if;

  select
    jsonb_build_object(
      'organization_id', o.id,
      'organization_name', o.name,
      'short_name', o.short_name,
      'public_slug', o.public_slug,
      'membership_fee_enabled', coalesce(s.membership_fee_enabled, false),
      'membership_fee_amount_xof',
        case
          when coalesce(s.membership_fee_enabled, false)
          then coalesce(s.membership_fee_amount_xof, 0)
          else 0
        end,
      'payment_timing', coalesce(s.payment_timing, 'after_approval')
    )
  into result
  from public.organizations as o
  left join public.organization_membership_settings as s
    on s.organization_id = o.id
  where
    lower(btrim(o.public_slug)) = normalized_slug
    and o.status::text = 'active'
    and coalesce(o.online_membership_enabled, false) = true
  limit 1;

  return result;
end;
$function$;

revoke all
on function public.get_public_membership_offer(text)
from public;

revoke all
on function public.get_public_membership_offer(text)
from anon;

revoke all
on function public.get_public_membership_offer(text)
from authenticated;

grant execute
on function public.get_public_membership_offer(text)
to anon;

grant execute
on function public.get_public_membership_offer(text)
to authenticated;
