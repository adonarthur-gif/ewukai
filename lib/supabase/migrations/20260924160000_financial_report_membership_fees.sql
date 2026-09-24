-- ============================================================================
-- EWUKAI
-- RAPPORT FINANCIER - DROITS D'ADHESION
-- Migration : 20260924160000_financial_report_membership_fees.sql
--
-- Objectif :
-- - intégrer les droits d'adhésion au rapport financier ;
-- - distinguer les droits acceptés, encaissés, en attente et exonérés ;
-- - ne jamais assimiler un droit en attente à un encaissement ;
-- - permettre la lecture aux rôles financiers/autorisés sans ouvrir un accès
--   direct supplémentaire à membership_applications.
-- ============================================================================

create or replace function public.get_organization_membership_fee_report(
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
  end_exclusive timestamptz;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  if target_organization_id is null then
    raise exception
      'Organization id is required';
  end if;

  if target_start_date is null
     or target_end_date is null
     or target_start_date > target_end_date then
    raise exception
      'Invalid report period';
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
    raise exception
      'Not authorized';
  end if;

  end_exclusive :=
    (target_end_date + 1)::timestamptz;

  with fee_rows as (
    select
      ma.id,
      ma.first_name,
      ma.last_name,
      ma.status::text
        as application_status,
      ma.membership_fee_amount_xof,
      ma.membership_fee_status,
      ma.created_at,
      ma.reviewed_at,
      ma.membership_fee_paid_at,
      ma.membership_fee_waived_at
    from public.membership_applications as ma
    where
      ma.organization_id =
        target_organization_id
      and ma.membership_fee_required = true
      and ma.membership_fee_amount_xof > 0
      and (
        (
          ma.reviewed_at >=
            target_start_date::timestamptz
          and ma.reviewed_at <
            end_exclusive
        )
        or (
          ma.membership_fee_paid_at >=
            target_start_date::timestamptz
          and ma.membership_fee_paid_at <
            end_exclusive
        )
        or (
          ma.membership_fee_waived_at >=
            target_start_date::timestamptz
          and ma.membership_fee_waived_at <
            end_exclusive
        )
        or (
          ma.status::text =
            'awaiting_payment'
          and ma.membership_fee_status =
            'pending'
          and ma.reviewed_at is not null
          and ma.reviewed_at <
            end_exclusive
        )
      )
  ),
  summary as (
    select
      coalesce(
        sum(
          membership_fee_amount_xof
        ) filter (
          where
            reviewed_at >=
              target_start_date::timestamptz
            and reviewed_at <
              end_exclusive
            and application_status in (
              'awaiting_payment',
              'approved'
            )
        ),
        0
      )::bigint
        as accepted_amount,

      coalesce(
        sum(
          membership_fee_amount_xof
        ) filter (
          where
            membership_fee_status =
              'paid'
            and membership_fee_paid_at >=
              target_start_date::timestamptz
            and membership_fee_paid_at <
              end_exclusive
        ),
        0
      )::bigint
        as collected_amount,

      coalesce(
        sum(
          membership_fee_amount_xof
        ) filter (
          where
            application_status =
              'awaiting_payment'
            and membership_fee_status =
              'pending'
            and reviewed_at is not null
            and reviewed_at <
              end_exclusive
        ),
        0
      )::bigint
        as outstanding_amount,

      coalesce(
        sum(
          membership_fee_amount_xof
        ) filter (
          where
            membership_fee_status =
              'waived'
            and membership_fee_waived_at >=
              target_start_date::timestamptz
            and membership_fee_waived_at <
              end_exclusive
        ),
        0
      )::bigint
        as waived_amount,

      count(*) filter (
        where
          reviewed_at >=
            target_start_date::timestamptz
          and reviewed_at <
            end_exclusive
          and application_status in (
            'awaiting_payment',
            'approved'
          )
      )::bigint
        as accepted_count,

      count(*) filter (
        where
          membership_fee_status =
            'paid'
          and membership_fee_paid_at >=
            target_start_date::timestamptz
          and membership_fee_paid_at <
            end_exclusive
      )::bigint
        as paid_count,

      count(*) filter (
        where
          application_status =
            'awaiting_payment'
          and membership_fee_status =
            'pending'
          and reviewed_at is not null
          and reviewed_at <
            end_exclusive
      )::bigint
        as outstanding_count,

      count(*) filter (
        where
          membership_fee_status =
            'waived'
          and membership_fee_waived_at >=
            target_start_date::timestamptz
          and membership_fee_waived_at <
            end_exclusive
      )::bigint
        as waived_count
    from fee_rows
  ),
  detail as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'application_id',
              fr.id,
            'applicant_name',
              btrim(
                concat_ws(
                  ' ',
                  upper(
                    coalesce(
                      fr.last_name,
                      ''
                    )
                  ),
                  coalesce(
                    fr.first_name,
                    ''
                  )
                )
              ),
            'amount_xof',
              fr.membership_fee_amount_xof,
            'application_status',
              fr.application_status,
            'fee_status',
              fr.membership_fee_status,
            'submitted_at',
              fr.created_at,
            'reviewed_at',
              fr.reviewed_at,
            'paid_at',
              fr.membership_fee_paid_at,
            'waived_at',
              fr.membership_fee_waived_at
          )
          order by
            coalesce(
              fr.membership_fee_paid_at,
              fr.membership_fee_waived_at,
              fr.reviewed_at,
              fr.created_at
            ) desc
        ),
        '[]'::jsonb
      )
        as rows
    from fee_rows as fr
  )
  select
    jsonb_build_object(
      'accepted_amount',
        s.accepted_amount,
      'collected_amount',
        s.collected_amount,
      'outstanding_amount',
        s.outstanding_amount,
      'waived_amount',
        s.waived_amount,
      'accepted_count',
        s.accepted_count,
      'paid_count',
        s.paid_count,
      'outstanding_count',
        s.outstanding_count,
      'waived_count',
        s.waived_count,
      'rows',
        d.rows
    )
  into result
  from summary as s
  cross join detail as d;

  return coalesce(
    result,
    jsonb_build_object(
      'accepted_amount', 0,
      'collected_amount', 0,
      'outstanding_amount', 0,
      'waived_amount', 0,
      'accepted_count', 0,
      'paid_count', 0,
      'outstanding_count', 0,
      'waived_count', 0,
      'rows', '[]'::jsonb
    )
  );
end;
$function$;

revoke all
on function public.get_organization_membership_fee_report(
  uuid,
  date,
  date
)
from public;

revoke all
on function public.get_organization_membership_fee_report(
  uuid,
  date,
  date
)
from anon;

revoke all
on function public.get_organization_membership_fee_report(
  uuid,
  date,
  date
)
from authenticated;

grant execute
on function public.get_organization_membership_fee_report(
  uuid,
  date,
  date
)
to authenticated;
