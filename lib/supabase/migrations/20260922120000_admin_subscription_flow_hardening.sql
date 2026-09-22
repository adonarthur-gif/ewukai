begin;

-- ============================================================
-- EWUKAI
-- DURCISSEMENT DU CHANGEMENT ADMINISTRATIF D'ABONNEMENT
--
-- Regles :
-- - Standard / Pro passent exclusivement par le circuit
--   demande -> facture -> paiement confirme ;
-- - Gratuit peut etre active administrativement ;
-- - Entreprise peut etre active administrativement comme offre
--   sur devis / contrat, avec cycle "custom" ;
-- - une facture encore ouverte ou brouillon bloque le changement ;
-- - une demande pending_payment orpheline sans facture ouverte
--   peut etre annulee proprement avant le changement ;
-- - controle Super-admin conserve cote PostgreSQL.
-- ============================================================


create or replace function public.change_platform_organization_subscription(
  target_organization_id uuid,
  target_plan_code text,
  change_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
  clean_plan_code text;
  clean_note text;
  requested_plan record;
  current_subscription_id uuid;
  current_plan_code text;
  pending_subscription_id uuid;
  new_subscription_id uuid;
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


  -- ----------------------------------------------------------
  -- Verrou organisation : serialise les changements concurrents.
  -- ----------------------------------------------------------

  perform
    o.id
  from public.organizations as o
  where
    o.id =
      target_organization_id
  for update;

  if not found then
    raise exception
      'Organization not found';
  end if;


  clean_plan_code :=
    lower(
      btrim(
        coalesce(
          target_plan_code,
          ''
        )
      )
    );

  clean_note :=
    nullif(
      btrim(
        coalesce(
          change_note,
          ''
        )
      ),
      ''
    );


  -- ----------------------------------------------------------
  -- Cette RPC est strictement administrative.
  -- Standard / Pro ne doivent jamais passer par elle.
  -- ----------------------------------------------------------

  if clean_plan_code not in (
    'free',
    'enterprise'
  ) then
    raise exception
      'Administrative subscription changes are limited to Free and Enterprise';
  end if;


  select
    sp.id,
    sp.code,
    sp.name,
    sp.monthly_price_xof,
    sp.is_custom_pricing
  into
    requested_plan
  from public.subscription_plans as sp
  where
    lower(sp.code) =
      clean_plan_code
    and sp.is_active =
      true
  limit 1;

  if requested_plan.id is null then
    raise exception
      'Subscription plan not found';
  end if;


  if clean_plan_code = 'enterprise'
     and coalesce(
       requested_plan.is_custom_pricing,
       false
     ) <> true then
    raise exception
      'Enterprise plan must use custom pricing';
  end if;


  -- ----------------------------------------------------------
  -- Abonnement actuellement effectif.
  -- ----------------------------------------------------------

  select
    os.id,
    sp.code
  into
    current_subscription_id,
    current_plan_code
  from public.organization_subscriptions as os
  join public.subscription_plans as sp
    on sp.id =
      os.plan_id
  where
    os.organization_id =
      target_organization_id
    and os.status in (
      'trialing',
      'active',
      'past_due'
    )
  order by
    os.created_at desc
  limit 1
  for update of os;


  if current_subscription_id is not null
     and lower(current_plan_code) =
       clean_plan_code then
    raise exception
      'Selected plan is already active';
  end if;


  -- ----------------------------------------------------------
  -- Une facture commerciale encore ouverte ne doit jamais etre
  -- annulee implicitement par un changement administratif.
  -- ----------------------------------------------------------

  if exists (
    select 1
    from public.subscription_invoices as si
    join public.organization_subscriptions as os
      on os.id =
        si.subscription_id
    where
      os.organization_id =
        target_organization_id
      and si.status in (
        'open',
        'draft'
      )
  ) then
    raise exception
      'Pending subscription invoice must be resolved first';
  end if;


  -- ----------------------------------------------------------
  -- Nettoyage d'une eventuelle demande pending_payment devenue
  -- orpheline (aucune facture open/draft, controle ci-dessus).
  -- ----------------------------------------------------------

  select
    os.id
  into
    pending_subscription_id
  from public.organization_subscriptions as os
  where
    os.organization_id =
      target_organization_id
    and os.status =
      'pending_payment'
  order by
    os.created_at desc
  limit 1
  for update;


  if pending_subscription_id is not null then
    update public.organization_subscriptions as os
    set
      status =
        'cancelled',
      ended_at =
        now(),
      updated_at =
        now()
    where
      os.id =
        pending_subscription_id;
  end if;


  -- ----------------------------------------------------------
  -- Remplacer l'abonnement effectif actuel.
  -- ----------------------------------------------------------

  if current_subscription_id is not null then
    update public.organization_subscriptions as os
    set
      status =
        'replaced',
      ended_at =
        now(),
      cancel_at_period_end =
        false,
      updated_at =
        now()
    where
      os.id =
        current_subscription_id;
  end if;


  -- ----------------------------------------------------------
  -- GRATUIT
  -- ----------------------------------------------------------

  if clean_plan_code = 'free' then
    insert into public.organization_subscriptions (
      organization_id,
      plan_id,
      status,
      billing_cycle,
      starts_at,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      notes,
      created_by
    )
    values (
      target_organization_id,
      requested_plan.id,
      'active',
      'free',
      now(),
      now(),
      null,
      false,
      clean_note,
      current_user_id
    )
    returning id
    into new_subscription_id;

    perform private.write_platform_audit_event(
      'admin.subscription_changed_to_free',
      'platform_admin',
      current_user_id,
      target_organization_id,
      new_subscription_id,
      null,
      null,
      null,
      jsonb_build_object(
        'reason',
        clean_note
      )
    );

    return
      public.get_platform_subscription_detail(
        target_organization_id
      );
  end if;


  -- ----------------------------------------------------------
  -- ENTREPRISE
  --
  -- Offre sur devis / contrat gere administrativement.
  -- Aucun paiement automatique ni facture V1.
  -- ----------------------------------------------------------

  insert into public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    billing_cycle,
    starts_at,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    notes,
    created_by
  )
  values (
    target_organization_id,
    requested_plan.id,
    'active',
    'custom',
    now(),
    now(),
    null,
    false,
    clean_note,
    current_user_id
  )
  returning id
  into new_subscription_id;


  perform private.write_platform_audit_event(
    'admin.subscription_changed_to_enterprise',
    'platform_admin',
    current_user_id,
    target_organization_id,
    new_subscription_id,
    null,
    null,
    null,
    jsonb_build_object(
      'reason',
      clean_note,
      'pricing',
      'custom'
    )
  );


  return
    public.get_platform_subscription_detail(
      target_organization_id
    );
end;
$function$;


-- ============================================================
-- PRIVILEGES
-- ============================================================

revoke all
on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
from public;

revoke all
on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
from anon;

revoke all
on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
from authenticated;

grant execute
on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
to authenticated;

grant execute
on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
to service_role;


comment on function public.change_platform_organization_subscription(
  uuid,
  text,
  text
)
is
'EWUKAI - changement administratif Super-admin limite aux offres Gratuit et Entreprise. Standard et Pro passent exclusivement par le circuit de paiement. Une facture ouverte ou brouillon bloque le changement.';


notify pgrst,
  'reload schema';

commit;
