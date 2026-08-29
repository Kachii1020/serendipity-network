begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

insert into public.audit_events (
  correlation_id,
  browser_session_id,
  origin,
  operation,
  status,
  safe_payload
) values (
  '60000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'hub-server',
  'discover',
  'SUCCESS',
  '{"candidateCount": 3, "failedProvider": "nori"}'::jsonb
);

select is(
  (
    select safe_payload
    from public.audit_events
    where correlation_id = '60000000-0000-4000-8000-000000000001'
  ),
  '{"candidateCount": 3, "failedProvider": "nori"}'::jsonb,
  'DB-019 persists the server sanitizer projection without modification'
);

select ok(
  not (
    select safe_payload
    from public.audit_events
    where correlation_id = '60000000-0000-4000-8000-000000000001'
  ) ?| array['holdToken', 'idempotencyKey', 'rawPrompt', 'serviceRoleKey'],
  'DB-019 persisted audit projection contains no forbidden field'
);

select * from finish();
rollback;
