begin;

select set_config('serendipity.test_service_date', '2030-05-17', true);

create extension if not exists pgtap with schema extensions;

select plan(17);

select throws_ok(
  $$ select * from public.reset_demo_state('wrong-scope') $$,
  '42501',
  'invalid demo operator scope',
  'DB-018 rejects the wrong reset scope'
);
select lives_ok(
  $$ select * from public.reset_demo_state('serendipity-demo-v1') $$,
  'DB-018 reset succeeds with the bounded demo scope'
);
select lives_ok(
  $$ select * from public.reset_demo_state('serendipity-demo-v1') $$,
  'DB-018 reset replay is idempotent'
);
select is(
  (select count(*)::integer from public.slots),
  9,
  'DB-018 reset retains all canonical slots'
);
select is(
  (select sum(capacity_remaining)::integer from public.slots),
  17,
  'DB-018 reset restores canonical capacity'
);
select lives_ok(
  $$ select * from public.reset_demo_state_for_date('serendipity-demo-v1', '2031-06-01', 20) $$,
  'IMP-002 reset accepts an explicit service date and bounded demo capacity'
);
select is(
  (select sum(capacity_remaining)::integer from public.slots),
  180,
  'IMP-002 capacity override supports at least twenty complete demo runs'
);
select is(
  (
    select min(starts_at at time zone 'Asia/Tokyo')::date::text
    from public.slots
  ),
  '2031-06-01',
  'IMP-002 reset projects every slot onto the requested Tokyo service date'
);
select * from public.reset_demo_state('serendipity-demo-v1');
select set_config('serendipity.test_service_date', '', true);
select lives_ok(
  $$ select * from public.reset_demo_state('serendipity-demo-v1') $$,
  'IMP-002 production reset derives the current Tokyo service date'
);
select is(
  (select sum(capacity_remaining)::integer from public.slots),
  180,
  'IMP-002 production reset restores twenty units for every demo slot'
);
select set_config('serendipity.test_service_date', '2030-05-17', true);
select * from public.reset_demo_state('serendipity-demo-v1');

select is(
  (
    select status::text
    from public.cancel_demo_slot(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002'
    )
  ),
  'CANCELLED',
  'DB-021 cancels an active Provider-owned demo slot'
);
select is(
  (select inventory_version from public.slots where id = '10000000-0000-4000-8000-000000000002'),
  2::bigint,
  'DB-021 cancellation increments inventory version once'
);
select is(
  (
    select inventory_version
    from public.cancel_demo_slot(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002'
    )
  ),
  2::bigint,
  'DB-021 cancellation replay keeps the version stable'
);
select is(
  (
    select error_code
    from public.cancel_demo_slot(
      '00000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000002'
    )
  ),
  'SLOT_NOT_FOUND',
  'DB-021 cancellation enforces Provider ownership'
);

select * from public.reset_demo_state('serendipity-demo-v1');
select ok(
  (
    select ok
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      1,
      '20000000-0000-4000-8000-000000000006',
      '30000000-0000-4000-8000-000000000006',
      '40000000-0000-4000-8000-000000000006',
      repeat('3', 64),
      1,
      repeat('4', 64),
      repeat('5', 64),
      '2030-05-17T17:55:00+09:00'
    )
  ),
  'DB-021 active-hold cancellation fixture created'
);
select is(
  (
    select error_code
    from public.cancel_demo_slot(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002'
    )
  ),
  'SLOT_UNAVAILABLE',
  'DB-021 cancellation rejects a slot with an active hold'
);
select * from public.reset_demo_state('serendipity-demo-v1');
select is(
  (select count(*)::integer from public.holds),
  0,
  'reset keeps tests free of orphan holds'
);

select * from finish();
rollback;
