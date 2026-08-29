begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_type('public', 'provider_slug', 'provider_slug enum exists');
select has_type('public', 'hold_status', 'hold_status enum exists');
select has_type('public', 'bundle_phase', 'bundle_phase enum exists');
select has_table('public', 'providers', 'providers table exists');
select has_table('public', 'locations', 'locations table exists');
select has_table('public', 'travel_times', 'travel_times table exists');
select has_table('public', 'slots', 'slots table exists');
select has_table('public', 'holds', 'holds table exists');
select has_table('public', 'bundle_sessions', 'bundle_sessions table exists');
select has_table('public', 'bundle_items', 'bundle_items table exists');
select has_table('public', 'audit_events', 'audit_events table exists');
select col_is_pk('public', 'holds', 'id', 'holds.id is the primary key');
select col_is_unique(
  'public',
  'slots',
  'seed_key',
  'slot seed keys are stable and unique'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.slots'::regclass),
  'slots has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.holds'::regclass),
  'holds has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.bundle_sessions'::regclass),
  'bundle sessions have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'audit events have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.slots', 'INSERT'),
  'anon cannot insert slots'
);
select ok(
  not has_table_privilege('anon', 'public.slots', 'UPDATE'),
  'anon cannot update slots'
);
select ok(
  not has_table_privilege('authenticated', 'public.holds', 'INSERT'),
  'authenticated cannot create holds directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.holds', 'UPDATE'),
  'authenticated cannot mutate holds directly'
);
select ok(
  has_table_privilege('service_role', 'public.holds', 'INSERT'),
  'service role can reach the server-owned table boundary'
);
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot use the private schema'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated cannot use the private schema'
);

select * from finish();
rollback;
