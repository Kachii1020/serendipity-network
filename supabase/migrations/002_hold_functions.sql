create function public.expire_due_holds(
  p_provider_id uuid,
  p_now timestamptz default clock_timestamp()
)
returns table (
  hold_id uuid,
  slot_id uuid,
  status public.hold_status,
  capacity_restored boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.holds%rowtype;
  v_updated integer;
begin
  for v_hold in
    select h.*
    from public.holds as h
    where h.provider_id = p_provider_id
      and h.status = 'HELD'
      and h.expires_at <= p_now
    order by h.expires_at, h.id
    for update skip locked
  loop
    update public.holds as h
    set
      status = 'EXPIRED',
      expired_at = p_now
    where h.id = v_hold.id
      and h.status = 'HELD';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      continue;
    end if;

    update public.slots as s
    set
      capacity_remaining = s.capacity_remaining + v_hold.quantity,
      inventory_version = s.inventory_version + 1,
      updated_at = p_now
    where s.id = v_hold.slot_id
      and s.provider_id = v_hold.provider_id
      and s.capacity_remaining + v_hold.quantity <= s.capacity_total;

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception using
        errcode = '23514',
        message = 'hold expiry would violate slot capacity';
    end if;

    return query
      select
        v_hold.id,
        v_hold.slot_id,
        'EXPIRED'::public.hold_status,
        true;
  end loop;
end;
$$;

create function public.create_slot_hold(
  p_provider_id uuid,
  p_slot_id uuid,
  p_expected_inventory_version bigint,
  p_browser_session_id uuid,
  p_client_request_id uuid,
  p_proposed_hold_id uuid,
  p_token_hash text,
  p_quantity integer,
  p_creation_idempotency_hash text,
  p_request_hash text,
  p_now timestamptz default clock_timestamp()
)
returns table (
  ok boolean,
  error_code text,
  hold_id uuid,
  slot_id uuid,
  status public.hold_status,
  expires_at timestamptz,
  inventory_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.holds%rowtype;
  v_slot public.slots%rowtype;
  v_new_inventory_version bigint;
begin
  if p_quantity <> 1
    or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_creation_idempotency_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
  then
    return query
      select false, 'VALIDATION_ERROR', null::uuid, null::uuid,
        null::public.hold_status, null::timestamptz, null::bigint;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_provider_id::text || ':create:' || p_creation_idempotency_hash,
      0
    )
  );

  select h.*
  into v_existing
  from public.holds as h
  where h.provider_id = p_provider_id
    and h.creation_idempotency_hash = p_creation_idempotency_hash
  for update;

  if found then
    if v_existing.creation_request_hash <> p_request_hash then
      return query
        select false, 'IDEMPOTENCY_CONFLICT', v_existing.id, v_existing.slot_id,
          v_existing.status, v_existing.expires_at, null::bigint;
    else
      return query
        select true, null::text, v_existing.id, v_existing.slot_id,
          v_existing.status, v_existing.expires_at,
          (
            select s.inventory_version
            from public.slots as s
            where s.id = v_existing.slot_id
          );
    end if;
    return;
  end if;

  perform 1
  from public.expire_due_holds(p_provider_id, p_now);

  select s.*
  into v_slot
  from public.slots as s
  where s.id = p_slot_id
    and s.provider_id = p_provider_id
  for update;

  if not found then
    return query
      select false, 'SLOT_NOT_FOUND', null::uuid, p_slot_id,
        null::public.hold_status, null::timestamptz, null::bigint;
    return;
  end if;

  if v_slot.status <> 'ACTIVE'
    or v_slot.inventory_version <> p_expected_inventory_version
    or v_slot.capacity_remaining < p_quantity
  then
    return query
      select false, 'SLOT_UNAVAILABLE', null::uuid, p_slot_id,
        null::public.hold_status, null::timestamptz, v_slot.inventory_version;
    return;
  end if;

  begin
    update public.slots as s
    set
      capacity_remaining = s.capacity_remaining - p_quantity,
      inventory_version = s.inventory_version + 1,
      updated_at = p_now
    where s.id = p_slot_id
      and s.provider_id = p_provider_id
    returning s.inventory_version into v_new_inventory_version;

    insert into public.holds (
      id,
      provider_id,
      slot_id,
      browser_session_id,
      client_request_id,
      quantity,
      token_hash,
      status,
      expires_at,
      creation_idempotency_hash,
      creation_request_hash,
      created_at
    )
    values (
      p_proposed_hold_id,
      p_provider_id,
      p_slot_id,
      p_browser_session_id,
      p_client_request_id,
      p_quantity,
      p_token_hash,
      'HELD',
      p_now + interval '90 seconds',
      p_creation_idempotency_hash,
      p_request_hash,
      p_now
    );
  exception
    when unique_violation then
      return query
        select false, 'IDEMPOTENCY_CONFLICT', null::uuid, p_slot_id,
          null::public.hold_status, null::timestamptz, null::bigint;
      return;
  end;

  return query
    select true, null::text, p_proposed_hold_id, p_slot_id,
      'HELD'::public.hold_status, p_now + interval '90 seconds',
      v_new_inventory_version;
end;
$$;

create function public.get_hold_status(
  p_provider_id uuid,
  p_browser_session_id uuid,
  p_token_hash text default null,
  p_client_request_id uuid default null
)
returns table (
  ok boolean,
  error_code text,
  hold_id uuid,
  slot_id uuid,
  status public.hold_status,
  expires_at timestamptz,
  reservation_ref text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.holds%rowtype;
begin
  if (p_token_hash is null) = (p_client_request_id is null) then
    return query
      select false, 'VALIDATION_ERROR', null::uuid, null::uuid,
        null::public.hold_status, null::timestamptz, null::text;
    return;
  end if;

  select h.*
  into v_hold
  from public.holds as h
  where h.provider_id = p_provider_id
    and h.browser_session_id = p_browser_session_id
    and (
      (p_token_hash is not null and h.token_hash = p_token_hash)
      or (
        p_client_request_id is not null
        and h.client_request_id = p_client_request_id
      )
    )
  limit 1;

  if not found then
    return query
      select false, 'HOLD_NOT_FOUND', null::uuid, null::uuid,
        null::public.hold_status, null::timestamptz, null::text;
    return;
  end if;

  return query
    select true, null::text, v_hold.id, v_hold.slot_id, v_hold.status,
      v_hold.expires_at, v_hold.reservation_ref;
end;
$$;

create function public.confirm_slot_hold(
  p_provider_id uuid,
  p_token_hash text,
  p_idempotency_hash text,
  p_request_hash text,
  p_now timestamptz default clock_timestamp()
)
returns table (
  ok boolean,
  error_code text,
  hold_id uuid,
  status public.hold_status,
  reservation_ref text,
  confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.holds%rowtype;
  v_conflict public.holds%rowtype;
  v_provider_slug public.provider_slug;
  v_reservation_ref text;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$'
    or p_idempotency_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
  then
    return query
      select false, 'VALIDATION_ERROR', null::uuid,
        null::public.hold_status, null::text, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_provider_id::text || ':confirm:' || p_idempotency_hash, 0)
  );

  select h.*
  into v_hold
  from public.holds as h
  where h.provider_id = p_provider_id
    and h.token_hash = p_token_hash
  for update;

  if not found then
    return query
      select false, 'HOLD_NOT_FOUND', null::uuid,
        null::public.hold_status, null::text, null::timestamptz;
    return;
  end if;

  select h.*
  into v_conflict
  from public.holds as h
  where h.provider_id = p_provider_id
    and h.confirm_idempotency_hash = p_idempotency_hash
  limit 1;

  if found and (
    v_conflict.id <> v_hold.id
    or v_conflict.confirm_request_hash <> p_request_hash
  ) then
    return query
      select false, 'IDEMPOTENCY_CONFLICT', v_hold.id, v_hold.status,
        v_hold.reservation_ref, v_hold.confirmed_at;
    return;
  end if;

  if v_hold.confirm_idempotency_hash = p_idempotency_hash
    and v_hold.confirm_request_hash <> p_request_hash
  then
    return query
      select false, 'IDEMPOTENCY_CONFLICT', v_hold.id, v_hold.status,
        v_hold.reservation_ref, v_hold.confirmed_at;
    return;
  end if;

  if v_hold.status = 'CONFIRMED' then
    return query
      select true, null::text, v_hold.id, v_hold.status,
        v_hold.reservation_ref, v_hold.confirmed_at;
    return;
  elsif v_hold.status = 'RELEASED' then
    return query
      select false, 'HOLD_RELEASED', v_hold.id, v_hold.status,
        null::text, null::timestamptz;
    return;
  elsif v_hold.status = 'EXPIRED' then
    return query
      select false, 'HOLD_EXPIRED', v_hold.id, v_hold.status,
        null::text, null::timestamptz;
    return;
  end if;

  if v_hold.expires_at <= p_now then
    update public.holds as h
    set
      status = 'EXPIRED',
      expired_at = p_now
    where h.id = v_hold.id
      and h.status = 'HELD';

    update public.slots as s
    set
      capacity_remaining = s.capacity_remaining + v_hold.quantity,
      inventory_version = s.inventory_version + 1,
      updated_at = p_now
    where s.id = v_hold.slot_id
      and s.provider_id = v_hold.provider_id
      and s.capacity_remaining + v_hold.quantity <= s.capacity_total;

    return query
      select false, 'HOLD_EXPIRED', v_hold.id,
        'EXPIRED'::public.hold_status, null::text, null::timestamptz;
    return;
  end if;

  select p.slug
  into v_provider_slug
  from public.providers as p
  where p.id = p_provider_id;

  v_reservation_ref :=
    'RSV-' || upper(v_provider_slug::text) || '-' ||
    upper(replace(v_hold.id::text, '-', ''));

  update public.holds as h
  set
    status = 'CONFIRMED',
    confirm_idempotency_hash = p_idempotency_hash,
    confirm_request_hash = p_request_hash,
    reservation_ref = v_reservation_ref,
    confirmed_at = p_now
  where h.id = v_hold.id;

  return query
    select true, null::text, v_hold.id, 'CONFIRMED'::public.hold_status,
      v_reservation_ref, p_now;
end;
$$;

create function public.release_slot_hold(
  p_provider_id uuid,
  p_token_hash text,
  p_idempotency_hash text,
  p_request_hash text,
  p_now timestamptz default clock_timestamp()
)
returns table (
  ok boolean,
  error_code text,
  hold_id uuid,
  slot_id uuid,
  status public.hold_status,
  capacity_restored boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.holds%rowtype;
  v_conflict public.holds%rowtype;
  v_terminal_status public.hold_status;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$'
    or p_idempotency_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
  then
    return query
      select false, 'VALIDATION_ERROR', null::uuid, null::uuid,
        null::public.hold_status, false;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_provider_id::text || ':release:' || p_idempotency_hash, 0)
  );

  select h.*
  into v_hold
  from public.holds as h
  where h.provider_id = p_provider_id
    and h.token_hash = p_token_hash
  for update;

  if not found then
    return query
      select false, 'HOLD_NOT_FOUND', null::uuid, null::uuid,
        null::public.hold_status, false;
    return;
  end if;

  select h.*
  into v_conflict
  from public.holds as h
  where h.provider_id = p_provider_id
    and h.release_idempotency_hash = p_idempotency_hash
  limit 1;

  if found and (
    v_conflict.id <> v_hold.id
    or v_conflict.release_request_hash <> p_request_hash
  ) then
    return query
      select false, 'IDEMPOTENCY_CONFLICT', v_hold.id, v_hold.slot_id,
        v_hold.status, false;
    return;
  end if;

  if v_hold.release_idempotency_hash = p_idempotency_hash
    and v_hold.release_request_hash <> p_request_hash
  then
    return query
      select false, 'IDEMPOTENCY_CONFLICT', v_hold.id, v_hold.slot_id,
        v_hold.status, false;
    return;
  end if;

  if v_hold.status = 'CONFIRMED' then
    return query
      select false, 'ALREADY_CONFIRMED', v_hold.id, v_hold.slot_id,
        v_hold.status, false;
    return;
  elsif v_hold.status in ('RELEASED', 'EXPIRED') then
    return query
      select true, null::text, v_hold.id, v_hold.slot_id, v_hold.status, false;
    return;
  end if;

  v_terminal_status := case
    when v_hold.expires_at <= p_now then 'EXPIRED'::public.hold_status
    else 'RELEASED'::public.hold_status
  end;

  update public.holds as h
  set
    status = v_terminal_status,
    release_idempotency_hash = p_idempotency_hash,
    release_request_hash = p_request_hash,
    released_at = case when v_terminal_status = 'RELEASED' then p_now else null end,
    expired_at = case when v_terminal_status = 'EXPIRED' then p_now else null end
  where h.id = v_hold.id
    and h.status = 'HELD';

  update public.slots as s
  set
    capacity_remaining = s.capacity_remaining + v_hold.quantity,
    inventory_version = s.inventory_version + 1,
    updated_at = p_now
  where s.id = v_hold.slot_id
    and s.provider_id = v_hold.provider_id
    and s.capacity_remaining + v_hold.quantity <= s.capacity_total;

  return query
    select true, null::text, v_hold.id, v_hold.slot_id,
      v_terminal_status, true;
end;
$$;

revoke all on function public.expire_due_holds(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.create_slot_hold(
  uuid, uuid, bigint, uuid, uuid, uuid, text, integer, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.get_hold_status(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.confirm_slot_hold(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.release_slot_hold(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.expire_due_holds(uuid, timestamptz)
  to service_role;
grant execute on function public.create_slot_hold(
  uuid, uuid, bigint, uuid, uuid, uuid, text, integer, text, text, timestamptz
) to service_role;
grant execute on function public.get_hold_status(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.confirm_slot_hold(uuid, text, text, text, timestamptz)
  to service_role;
grant execute on function public.release_slot_hold(uuid, text, text, text, timestamptz)
  to service_role;
