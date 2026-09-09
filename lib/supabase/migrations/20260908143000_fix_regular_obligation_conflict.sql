-- ============================================================
-- AFRI CLUB
-- Correction ON CONFLICT des obligations régulières
--
-- L'index unique existant est partiel :
-- WHERE contribution_call_id IS NULL
--
-- PostgreSQL exige que le conflict target reprenne
-- également ce prédicat pour pouvoir inférer l'index.
-- ============================================================


-- ============================================================
-- 1. GENERATION MENSUELLE DES OBLIGATIONS
-- ============================================================

create or replace function public.generate_contribution_obligations(
  target_organization_id uuid,
  target_period date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$

declare

  target_month date;
  target_month_end date;

  inserted_count integer := 0;

begin

  -- ----------------------------------------------------------
  -- AUTORISATION
  -- ----------------------------------------------------------

  if not private.has_organization_role(
    target_organization_id,
    array[
      'owner'::public.organization_role,
      'president'::public.organization_role,
      'treasurer'::public.organization_role
    ]
  ) then

    raise exception 'Not authorized';

  end if;


  -- ----------------------------------------------------------
  -- PERIODE
  -- ----------------------------------------------------------

  target_month :=
    date_trunc(
      'month',
      target_period
    )::date;


  target_month_end :=
    (
      target_month
      + interval '1 month'
      - interval '1 day'
    )::date;


  -- ----------------------------------------------------------
  -- TYPES ELIGIBLES
  -- ----------------------------------------------------------

  with eligible_types as (

    select

      ct.*,

      case

        when ct.frequency =
          'one_time'
        then
          ct.start_date

        else
          make_date(
            extract(
              year
              from target_month
            )::integer,

            extract(
              month
              from target_month
            )::integer,

            coalesce(
              ct.due_day,
              28
            )
          )

      end
        as calculated_due_date

    from
      public.contribution_types ct

    where

      ct.organization_id =
        target_organization_id

      and ct.is_active =
        true

      and ct.is_mandatory =
        true

      and ct.start_date <=
        target_month_end

      and (
        ct.end_date is null
        or
        ct.end_date >=
          target_month
      )

      and (

        ct.frequency =
          'monthly'

        or (

          ct.frequency =
            'quarterly'

          and

          mod(
            (
              extract(
                year
                from target_month
              )::integer
              -
              extract(
                year
                from ct.start_date
              )::integer
            ) * 12
            +
            (
              extract(
                month
                from target_month
              )::integer
              -
              extract(
                month
                from ct.start_date
              )::integer
            ),
            3
          ) = 0
        )

        or (

          ct.frequency =
            'annual'

          and

          mod(
            (
              extract(
                year
                from target_month
              )::integer
              -
              extract(
                year
                from ct.start_date
              )::integer
            ) * 12
            +
            (
              extract(
                month
                from target_month
              )::integer
              -
              extract(
                month
                from ct.start_date
              )::integer
            ),
            12
          ) = 0
        )

        or (

          ct.frequency =
            'one_time'

          and

          date_trunc(
            'month',
            ct.start_date
          )::date =
            target_month
        )
      )
  )


  -- ----------------------------------------------------------
  -- CREATION DES OBLIGATIONS
  -- ----------------------------------------------------------

  insert into
    public.contribution_obligations (
      organization_id,
      contribution_type_id,
      member_id,
      period_start,
      due_date,
      amount_due,
      status
    )

  select

    target_organization_id,

    ct.id,

    m.id,

    target_month,

    ct.calculated_due_date,

    ct.amount,

    'open'
      ::public.obligation_status

  from
    eligible_types ct

  join
    public.members m
      on m.organization_id =
        target_organization_id

  where

    m.status =
      'active'

    and m.joined_at <=
      ct.calculated_due_date

    and ct.calculated_due_date >=
      ct.start_date

    and (
      ct.end_date is null
      or
      ct.calculated_due_date <=
        ct.end_date
    )

  on conflict (
    organization_id,
    contribution_type_id,
    member_id,
    period_start
  )
  where contribution_call_id is null
  do nothing;


  get diagnostics
    inserted_count =
      row_count;


  return
    inserted_count;

end;

$function$;



-- ============================================================
-- 2. GENERATION ANNUELLE D'UN MEMBRE
-- ============================================================

create or replace function private.ensure_member_obligations_for_year(
  target_member_id uuid,
  target_contribution_type_id uuid,
  target_year integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$

declare

  member_org_id uuid;
  member_joined_at date;

  contribution_org_id uuid;

  contribution_frequency
    public.contribution_frequency;

  contribution_start_date date;
  contribution_end_date date;
  contribution_due_day integer;
  contribution_amount bigint;
  contribution_active boolean;

  inserted_count integer := 0;

begin

  if
    target_year < 2000
    or
    target_year > 2100
  then

    raise exception
      'Invalid year';

  end if;


  -- ----------------------------------------------------------
  -- MEMBRE
  -- ----------------------------------------------------------

  select
    m.organization_id,
    m.joined_at

  into
    member_org_id,
    member_joined_at

  from
    public.members m

  where
    m.id =
      target_member_id

    and m.status =
      'active';


  if member_org_id is null then

    raise exception
      'Active member not found';

  end if;


  -- ----------------------------------------------------------
  -- COTISATION
  -- ----------------------------------------------------------

  select

    ct.organization_id,
    ct.frequency,
    ct.start_date,
    ct.end_date,
    ct.due_day,
    ct.amount,
    ct.is_active

  into

    contribution_org_id,
    contribution_frequency,
    contribution_start_date,
    contribution_end_date,
    contribution_due_day,
    contribution_amount,
    contribution_active

  from
    public.contribution_types ct

  where
    ct.id =
      target_contribution_type_id;


  if contribution_org_id is null then

    raise exception
      'Contribution type not found';

  end if;


  if
    member_org_id <>
    contribution_org_id
  then

    raise exception
      'Organization mismatch';

  end if;


  if contribution_active is not true then

    raise exception
      'Contribution type is inactive';

  end if;


  -- ----------------------------------------------------------
  -- GENERATION
  -- ----------------------------------------------------------

  with months as (

    select

      generate_series(
        make_date(
          target_year,
          1,
          1
        ),

        make_date(
          target_year,
          12,
          1
        ),

        interval '1 month'
      )::date
        as month_start
  ),

  eligible as (

    select

      month_start,

      case

        when
          contribution_frequency =
            'one_time'

        then
          contribution_start_date

        else
          make_date(
            extract(
              year
              from month_start
            )::integer,

            extract(
              month
              from month_start
            )::integer,

            coalesce(
              contribution_due_day,
              28
            )
          )

      end
        as calculated_due_date

    from
      months

    where

      month_start >=
        date_trunc(
          'month',
          contribution_start_date
        )::date

      and (

        contribution_end_date
          is null

        or

        month_start <=
          date_trunc(
            'month',
            contribution_end_date
          )::date
      )

      and (

        contribution_frequency =
          'monthly'

        or (

          contribution_frequency =
            'quarterly'

          and

          mod(
            (
              extract(
                year
                from month_start
              )::integer
              -
              extract(
                year
                from contribution_start_date
              )::integer
            ) * 12
            +
            (
              extract(
                month
                from month_start
              )::integer
              -
              extract(
                month
                from contribution_start_date
              )::integer
            ),
            3
          ) = 0
        )

        or (

          contribution_frequency =
            'annual'

          and

          mod(
            (
              extract(
                year
                from month_start
              )::integer
              -
              extract(
                year
                from contribution_start_date
              )::integer
            ) * 12
            +
            (
              extract(
                month
                from month_start
              )::integer
              -
              extract(
                month
                from contribution_start_date
              )::integer
            ),
            12
          ) = 0
        )

        or (

          contribution_frequency =
            'one_time'

          and

          month_start =
            date_trunc(
              'month',
              contribution_start_date
            )::date
        )
      )
  )


  insert into
    public.contribution_obligations (
      organization_id,
      contribution_type_id,
      member_id,
      period_start,
      due_date,
      amount_due,
      status
    )

  select

    member_org_id,

    target_contribution_type_id,

    target_member_id,

    e.month_start,

    e.calculated_due_date,

    contribution_amount,

    'open'
      ::public.obligation_status

  from
    eligible e

  where

    member_joined_at <=
      e.calculated_due_date

    and
      e.calculated_due_date >=
        contribution_start_date

    and (
      contribution_end_date is null
      or
      e.calculated_due_date <=
        contribution_end_date
    )

  on conflict (
    organization_id,
    contribution_type_id,
    member_id,
    period_start
  )
  where contribution_call_id is null
  do nothing;


  get diagnostics
    inserted_count =
      row_count;


  return
    inserted_count;

end;

$function$;


-- ============================================================
-- RECHARGEMENT POSTGREST
-- ============================================================

notify pgrst,
  'reload schema';