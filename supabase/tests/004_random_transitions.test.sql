begin;

select set_config('serendipity.test_service_date', '2030-05-17', true);

create extension if not exists pgtap with schema extensions;

select plan(2);

select lives_ok(
  $test$
  do $body$
  declare
    v_action integer;
    v_browser_session_id uuid;
    v_client_request_id uuid;
    v_created boolean;
    v_hold_id uuid;
    v_i integer;
    v_now timestamptz;
    v_provider_id uuid;
    v_slot_id uuid;
    v_token_hash text;
    v_version bigint;
  begin
    perform setseed(0.4242);
    perform public.reset_demo_state('serendipity-demo-v1');

    for v_i in 1..100 loop
      if v_i % 11 = 0 then
        perform public.reset_demo_state('serendipity-demo-v1');
      end if;

      select id, provider_id, inventory_version
      into v_slot_id, v_provider_id, v_version
      from public.slots
      where status = 'ACTIVE' and capacity_remaining > 0
      order by random()
      limit 1;

      if v_slot_id is null then
        perform public.reset_demo_state('serendipity-demo-v1');
        continue;
      end if;

      v_hold_id := (
        '40000000-0000-4000-8000-' || lpad(v_i::text, 12, '0')
      )::uuid;
      v_browser_session_id := (
        '20000000-0000-4000-8000-' || lpad(v_i::text, 12, '0')
      )::uuid;
      v_client_request_id := (
        '30000000-0000-4000-8000-' || lpad(v_i::text, 12, '0')
      )::uuid;
      v_token_hash := lpad(to_hex(1000 + v_i), 64, '0');
      v_now := '2030-05-17T17:00:00+09:00'::timestamptz + make_interval(secs => v_i);

      select result.ok
      into v_created
      from public.create_slot_hold(
        v_provider_id,
        v_slot_id,
        v_version,
        v_browser_session_id,
        v_client_request_id,
        v_hold_id,
        v_token_hash,
        1,
        lpad(to_hex(2000 + v_i), 64, '0'),
        lpad(to_hex(3000 + v_i), 64, '0'),
        v_now
      ) as result;

      if v_created then
        v_action := floor(random() * 3)::integer;
        if v_action = 0 then
          perform * from public.confirm_slot_hold(
            v_provider_id,
            v_token_hash,
            lpad(to_hex(4000 + v_i), 64, '0'),
            lpad(to_hex(5000 + v_i), 64, '0'),
            v_now + interval '10 seconds'
          );
        elsif v_action = 1 then
          perform * from public.release_slot_hold(
            v_provider_id,
            v_token_hash,
            lpad(to_hex(6000 + v_i), 64, '0'),
            lpad(to_hex(7000 + v_i), 64, '0'),
            v_now + interval '10 seconds'
          );
        else
          perform * from public.expire_due_holds(
            v_provider_id,
            v_now + interval '2 minutes'
          );
        end if;
      end if;

      if exists (
        select 1
        from public.slots as slot
        where slot.capacity_remaining < 0
          or slot.capacity_remaining > slot.capacity_total
          or slot.capacity_remaining + (
            select count(*)::integer
            from public.holds as hold
            where hold.slot_id = slot.id
              and hold.status in ('HELD', 'CONFIRMED')
          ) <> slot.capacity_total
      ) then
        raise exception 'capacity invariant failed at transition %', v_i;
      end if;

      v_slot_id := null;
    end loop;

    perform public.reset_demo_state('serendipity-demo-v1');
  end
  $body$;
  $test$,
  'DB-020 seeded random transitions preserve state and capacity invariants'
);

select is(
  (select sum(capacity_remaining)::integer from public.slots),
  17,
  'DB-020 randomized sequence ends at canonical capacity after reset'
);

select * from finish();
rollback;
