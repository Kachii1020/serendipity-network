begin;

select set_config('serendipity.test_service_date', '2030-05-17', true);

create extension if not exists pgtap with schema extensions;

select plan(28);

select is(
  (
    select error_code
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      1,
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      1,
      repeat('2', 64),
      repeat('3', 64),
      '2030-05-17T17:55:00+09:00'
    )
  ),
  null,
  'DB-001 creates a hold without an error'
);
select is(
  (select capacity_remaining from public.slots where seed_key = 'kiln.beginner-pottery'),
  1,
  'DB-001 decrements capacity once'
);
select is(
  (
    select expires_at
    from public.holds
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  '2030-05-17T08:56:30Z'::timestamptz,
  'DB-001 expiry is server-now plus 90 seconds'
);

select is(
  (
    select hold_id
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      1,
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000099',
      repeat('9', 64),
      1,
      repeat('2', 64),
      repeat('3', 64),
      '2030-05-17T17:55:05+09:00'
    )
  ),
  '40000000-0000-4000-8000-000000000001'::uuid,
  'DB-004 same idempotency request returns the original hold'
);
select is(
  (select capacity_remaining from public.slots where seed_key = 'kiln.beginner-pottery'),
  1,
  'DB-004 idempotent replay does not decrement twice'
);
select is(
  (
    select error_code
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      1,
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000099',
      repeat('9', 64),
      1,
      repeat('2', 64),
      repeat('4', 64),
      '2030-05-17T17:55:06+09:00'
    )
  ),
  'IDEMPOTENCY_CONFLICT',
  'DB-005 same key with another request is rejected'
);

select is(
  (
    select error_code
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      2,
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000002',
      repeat('5', 64),
      1,
      repeat('6', 64),
      repeat('7', 64),
      '2030-05-17T17:55:10+09:00'
    )
  ),
  'SLOT_NOT_FOUND',
  'DB-003 rejects a slot owned by another Provider'
);

select is(
  (
    select status::text
    from public.get_hold_status(
      '00000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      null
    )
  ),
  'HELD',
  'DB-015 valid token hash resolves the hold'
);
select is(
  (
    select error_code
    from public.get_hold_status(
      '00000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      repeat('8', 64),
      null
    )
  ),
  'HOLD_NOT_FOUND',
  'DB-016 invalid token hash does not resolve a hold'
);
select is(
  (
    select status::text
    from public.get_hold_status(
      '00000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      null,
      '30000000-0000-4000-8000-000000000001'
    )
  ),
  'HELD',
  'DB-006 request ID lookup recovers a committed hold'
);

select is(
  (
    select status::text
    from public.confirm_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      repeat('a', 64),
      repeat('b', 64),
      '2030-05-17T17:55:30+09:00'
    )
  ),
  'CONFIRMED',
  'DB-011 confirms an active hold'
);
select is(
  (select capacity_remaining from public.slots where seed_key = 'kiln.beginner-pottery'),
  1,
  'DB-011 confirmation does not change capacity'
);
select isnt(
  (
    select reservation_ref
    from public.holds
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  null,
  'DB-011 confirmation creates a reservation reference'
);
select is(
  (
    select reservation_ref
    from public.confirm_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      repeat('a', 64),
      repeat('b', 64),
      '2030-05-17T17:55:31+09:00'
    )
  ),
  (
    select reservation_ref
    from public.holds
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  'DB-012 confirmation replay returns the stable reservation'
);
select is(
  (
    select error_code
    from public.release_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      repeat('c', 64),
      repeat('d', 64),
      '2030-05-17T17:55:32+09:00'
    )
  ),
  'ALREADY_CONFIRMED',
  'DB-014 confirmed holds cannot be released'
);

select * from public.reset_demo_state('serendipity-demo-v1');

select ok(
  (
    select ok
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000004',
      1,
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000002',
      repeat('5', 64),
      1,
      repeat('6', 64),
      repeat('7', 64),
      '2030-05-17T17:55:00+09:00'
    )
  ),
  'DB-007 release fixture hold created'
);
select is(
  (
    select status::text
    from public.release_slot_hold(
      '00000000-0000-4000-8000-000000000002',
      repeat('5', 64),
      repeat('c', 64),
      repeat('d', 64),
      '2030-05-17T17:55:20+09:00'
    )
  ),
  'RELEASED',
  'DB-007 releases an active hold'
);
select is(
  (select capacity_remaining from public.slots where seed_key = 'nori.seasonal-counter'),
  2,
  'DB-007 release restores capacity once'
);
select ok(
  not (
    select capacity_restored
    from public.release_slot_hold(
      '00000000-0000-4000-8000-000000000002',
      repeat('5', 64),
      repeat('c', 64),
      repeat('d', 64),
      '2030-05-17T17:55:21+09:00'
    )
  ),
  'DB-008 release replay does not restore twice'
);

select * from public.reset_demo_state('serendipity-demo-v1');

select ok(
  (
    select ok
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000007',
      1,
      '20000000-0000-4000-8000-000000000003',
      '30000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000003',
      repeat('8', 64),
      1,
      repeat('9', 64),
      repeat('0', 64),
      '2030-05-17T17:55:00+09:00'
    )
  ),
  'DB-009 expiry fixture hold created'
);
select is(
  (
    select count(*)::integer
    from public.expire_due_holds(
      '00000000-0000-4000-8000-000000000003',
      '2030-05-17T17:57:00+09:00'
    )
  ),
  1,
  'DB-009 expiry transitions one due hold'
);
select is(
  (select capacity_remaining from public.slots where seed_key = 'loop.experimental-listening'),
  2,
  'DB-009 expiry restores capacity'
);
select is(
  (
    select count(*)::integer
    from public.expire_due_holds(
      '00000000-0000-4000-8000-000000000003',
      '2030-05-17T17:57:01+09:00'
    )
  ),
  0,
  'DB-010 repeated expiry has no second transition'
);

select is(
  (select count(*)::integer from public.holds where status = 'HELD'),
  0,
  'DB-020 tested transitions leave no active holds'
);

select * from public.reset_demo_state('serendipity-demo-v1');
select * from public.cancel_demo_slot(
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
select is(
  (
    select error_code
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      2,
      '20000000-0000-4000-8000-000000000004',
      '30000000-0000-4000-8000-000000000004',
      '40000000-0000-4000-8000-000000000004',
      repeat('4', 64),
      1,
      repeat('5', 64),
      repeat('6', 64),
      '2030-05-17T17:55:00+09:00'
    )
  ),
  'SLOT_UNAVAILABLE',
  'DB-002 rejects a cancelled slot'
);

select * from public.reset_demo_state('serendipity-demo-v1');
select ok(
  (
    select ok
    from public.create_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      1,
      '20000000-0000-4000-8000-000000000005',
      '30000000-0000-4000-8000-000000000005',
      '40000000-0000-4000-8000-000000000005',
      repeat('d', 64),
      1,
      repeat('e', 64),
      repeat('f', 64),
      '2030-05-17T17:55:00+09:00'
    )
  ),
  'DB-013 expired-confirm fixture hold created'
);
select is(
  (
    select error_code
    from public.confirm_slot_hold(
      '00000000-0000-4000-8000-000000000001',
      repeat('d', 64),
      repeat('1', 64),
      repeat('2', 64),
      '2030-05-17T17:57:00+09:00'
    )
  ),
  'HOLD_EXPIRED',
  'DB-013 confirmation after expiry fails closed'
);
select is(
  (select capacity_remaining from public.slots where seed_key = 'kiln.glaze-lab'),
  1,
  'DB-013 expired confirmation restores capacity exactly once'
);

select * from finish();
rollback;
