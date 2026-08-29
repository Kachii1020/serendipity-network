create function public.reset_demo_state_for_date(
  p_operator_scope text,
  p_service_date date,
  p_capacity_override integer default null
)
returns table (
  deleted_holds integer,
  restored_slots integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_holds integer;
  v_restored_slots integer;
begin
  if p_operator_scope <> 'serendipity-demo-v1' then
    raise exception using
      errcode = '42501',
      message = 'invalid demo operator scope';
  end if;
  if p_service_date is null then
    raise exception using
      errcode = '22004',
      message = 'demo service date is required';
  end if;
  if p_capacity_override is not null
    and (p_capacity_override < 1 or p_capacity_override > 100)
  then
    raise exception using
      errcode = '22023',
      message = 'demo capacity override is invalid';
  end if;

  delete from public.bundle_items;
  delete from public.audit_events;
  delete from public.bundle_sessions;
  delete from public.holds;
  get diagnostics v_deleted_holds = row_count;

  update public.slots as s
  set
    title = b.title,
    starts_at = (
      p_service_date + (b.starts_at at time zone 'Asia/Tokyo')::time
    ) at time zone 'Asia/Tokyo',
    ends_at = (
      p_service_date + (b.ends_at at time zone 'Asia/Tokyo')::time
    ) at time zone 'Asia/Tokyo',
    price_yen = b.price_yen,
    original_price_yen = b.original_price_yen,
    capacity_total = coalesce(p_capacity_override, b.capacity_total),
    capacity_remaining = coalesce(p_capacity_override, b.capacity_remaining),
    status = b.status,
    tags = b.tags,
    novelty_score = b.novelty_score,
    inventory_version = b.inventory_version,
    updated_at = clock_timestamp()
  from private.demo_slot_baselines as b
  where b.slot_id = s.id;
  get diagnostics v_restored_slots = row_count;

  return query select v_deleted_holds, v_restored_slots;
end;
$$;

create or replace function public.reset_demo_state(p_operator_scope text)
returns table (
  deleted_holds integer,
  restored_slots integer
)
language sql
security definer
set search_path = ''
as $$
  with settings as (
    select nullif(
      current_setting('serendipity.test_service_date', true),
      ''
    )::date as test_service_date
  )
  select reset_result.*
  from settings
  cross join lateral public.reset_demo_state_for_date(
    p_operator_scope,
    coalesce(
      settings.test_service_date,
      (clock_timestamp() at time zone 'Asia/Tokyo')::date
    ),
    case when settings.test_service_date is null then 20 else null end
  ) as reset_result;
$$;

revoke all on function public.reset_demo_state_for_date(text, date, integer)
  from public, anon, authenticated;
revoke all on function public.reset_demo_state(text)
  from public, anon, authenticated;

grant execute on function public.reset_demo_state_for_date(text, date, integer)
  to service_role;
grant execute on function public.reset_demo_state(text) to service_role;
