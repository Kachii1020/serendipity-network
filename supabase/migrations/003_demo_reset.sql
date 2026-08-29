create function public.reset_demo_state(p_operator_scope text)
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

  delete from public.bundle_items;
  delete from public.audit_events;
  delete from public.bundle_sessions;
  delete from public.holds;
  get diagnostics v_deleted_holds = row_count;

  update public.slots as s
  set
    title = b.title,
    starts_at = b.starts_at,
    ends_at = b.ends_at,
    price_yen = b.price_yen,
    original_price_yen = b.original_price_yen,
    capacity_total = b.capacity_total,
    capacity_remaining = b.capacity_remaining,
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

create function public.cancel_demo_slot(
  p_provider_id uuid,
  p_slot_id uuid
)
returns table (
  ok boolean,
  error_code text,
  status public.slot_status,
  inventory_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.slots%rowtype;
  v_inventory_version bigint;
begin
  select s.*
  into v_slot
  from public.slots as s
  where s.id = p_slot_id
    and s.provider_id = p_provider_id
  for update;

  if not found then
    return query
      select false, 'SLOT_NOT_FOUND', null::public.slot_status, null::bigint;
    return;
  end if;

  if v_slot.status = 'CANCELLED' then
    return query
      select true, null::text, v_slot.status, v_slot.inventory_version;
    return;
  end if;

  if v_slot.status <> 'ACTIVE'
    or exists (
      select 1
      from public.holds as h
      where h.provider_id = p_provider_id
        and h.slot_id = p_slot_id
        and h.status in ('HELD', 'CONFIRMED')
    )
  then
    return query
      select false, 'SLOT_UNAVAILABLE', v_slot.status, v_slot.inventory_version;
    return;
  end if;

  update public.slots as s
  set
    status = 'CANCELLED',
    inventory_version = s.inventory_version + 1,
    updated_at = clock_timestamp()
  where s.id = p_slot_id
  returning s.inventory_version into v_inventory_version;

  return query
    select true, null::text, 'CANCELLED'::public.slot_status,
      v_inventory_version;
end;
$$;

revoke all on function public.reset_demo_state(text)
  from public, anon, authenticated;
revoke all on function public.cancel_demo_slot(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reset_demo_state(text) to service_role;
grant execute on function public.cancel_demo_slot(uuid, uuid) to service_role;
