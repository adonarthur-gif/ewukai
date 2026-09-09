-- ============================================================
-- AFRI CLUB
-- MIGRATION 045
-- RAPPORT FINANCIER - SYNTHESE DE TRESORERIE
--
-- Objectifs :
-- - fournir une source serveur fiable pour les rapports financiers
-- - isoler strictement les donnees par organization_id
-- - autoriser uniquement owner / president / treasurer / auditor
-- - calculer les soldes et ventilations directement en PostgreSQL
-- - ne jamais melanger les abonnements SaaS Afri Club
--   avec la tresorerie de la mutuelle
-- ============================================================

create or replace function public.get_organization_financial_report_treasury(
  target_organization_id uuid,
  target_start_date date,
  target_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$

declare

  opening_balance bigint := 0;
  period_credits bigint := 0;
  period_debits bigint := 0;
  closing_balance bigint := 0;

  credits_by_category jsonb := '[]'::jsonb;
  debits_by_category jsonb := '[]'::jsonb;
  movements jsonb := '[]'::jsonb;

begin

  -- ==========================================================
  -- 1. AUTHENTIFICATION
  -- ==========================================================

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_start_date is null or target_end_date is null then
    raise exception 'Report period is required';
  end if;

  if target_start_date > target_end_date then
    raise exception 'Invalid report period';
  end if;

  -- Maximum 5 ans par extraction pour eviter les rapports accidentels
  -- excessivement volumineux.
  if target_end_date > (target_start_date + interval '5 years')::date then
    raise exception 'Report period is too large';
  end if;

  -- ==========================================================
  -- 2. DROITS
  -- ==========================================================

  if not private.has_organization_role(
    target_organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role,
      'auditor'::public.organization_role
    ]
  ) then
    raise exception 'Not authorized';
  end if;

  -- ==========================================================
  -- 3. SOLDE D'OUVERTURE
  -- ==========================================================

  select
    coalesce(
      sum(
        case
          when le.direction::text = 'credit' then le.amount
          when le.direction::text = 'debit' then -le.amount
          else 0
        end
      ),
      0
    )::bigint
  into opening_balance
  from public.ledger_entries as le
  where le.organization_id = target_organization_id
    and le.entry_date < target_start_date;

  -- ==========================================================
  -- 4. MOUVEMENTS DE LA PERIODE
  -- ==========================================================

  select
    coalesce(
      sum(le.amount)
        filter (where le.direction::text = 'credit'),
      0
    )::bigint,
    coalesce(
      sum(le.amount)
        filter (where le.direction::text = 'debit'),
      0
    )::bigint
  into
    period_credits,
    period_debits
  from public.ledger_entries as le
  where le.organization_id = target_organization_id
    and le.entry_date >= target_start_date
    and le.entry_date <= target_end_date;

  closing_balance :=
    opening_balance
    + period_credits
    - period_debits;

  -- ==========================================================
  -- 5. ENTREES PAR CATEGORIE
  -- ==========================================================

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category', x.category,
          'amount', x.amount,
          'movement_count', x.movement_count
        )
        order by x.amount desc, x.category asc
      ),
      '[]'::jsonb
    )
  into credits_by_category
  from (
    select
      coalesce(
        nullif(
          btrim(le.category::text),
          ''
        ),
        'Autre'
      ) as category,
      sum(le.amount)::bigint as amount,
      count(*)::bigint as movement_count
    from public.ledger_entries as le
    where le.organization_id = target_organization_id
      and le.direction::text = 'credit'
      and le.entry_date >= target_start_date
      and le.entry_date <= target_end_date
    group by 1
  ) as x;

  -- ==========================================================
  -- 6. SORTIES PAR CATEGORIE
  -- ==========================================================

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category', x.category,
          'amount', x.amount,
          'movement_count', x.movement_count
        )
        order by x.amount desc, x.category asc
      ),
      '[]'::jsonb
    )
  into debits_by_category
  from (
    select
      coalesce(
        nullif(
          btrim(le.category::text),
          ''
        ),
        'Autre'
      ) as category,
      sum(le.amount)::bigint as amount,
      count(*)::bigint as movement_count
    from public.ledger_entries as le
    where le.organization_id = target_organization_id
      and le.direction::text = 'debit'
      and le.entry_date >= target_start_date
      and le.entry_date <= target_end_date
    group by 1
  ) as x;

  -- ==========================================================
  -- 7. JOURNAL DETAILLE DE LA PERIODE
  -- ==========================================================

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'direction', x.direction,
          'category', x.category,
          'amount', x.amount,
          'description', x.description,
          'entry_date', x.entry_date,
          'created_at', x.created_at
        )
        order by x.entry_date asc, x.created_at asc, x.id asc
      ),
      '[]'::jsonb
    )
  into movements
  from (
    select
      le.id,
      le.direction::text as direction,
      coalesce(
        nullif(
          btrim(le.category::text),
          ''
        ),
        'Autre'
      ) as category,
      le.amount::bigint as amount,
      le.description,
      le.entry_date,
      le.created_at
    from public.ledger_entries as le
    where le.organization_id = target_organization_id
      and le.entry_date >= target_start_date
      and le.entry_date <= target_end_date
  ) as x;

  -- ==========================================================
  -- 8. RESULTAT
  -- ==========================================================

  return jsonb_build_object(
    'organization_id', target_organization_id,
    'start_date', target_start_date,
    'end_date', target_end_date,
    'opening_balance', opening_balance,
    'period_credits', period_credits,
    'period_debits', period_debits,
    'period_net', period_credits - period_debits,
    'closing_balance', closing_balance,
    'credits_by_category', credits_by_category,
    'debits_by_category', debits_by_category,
    'movements', movements
  );

end;

$function$;

-- ============================================================
-- 9. PERMISSIONS
-- ============================================================

revoke all
on function public.get_organization_financial_report_treasury(
  uuid,
  date,
  date
)
from public;

revoke all
on function public.get_organization_financial_report_treasury(
  uuid,
  date,
  date
)
from anon;

revoke all
on function public.get_organization_financial_report_treasury(
  uuid,
  date,
  date
)
from authenticated;

grant execute
on function public.get_organization_financial_report_treasury(
  uuid,
  date,
  date
)
to authenticated;

notify pgrst, 'reload schema';
