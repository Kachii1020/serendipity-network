create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create type public.provider_slug as enum ('kiln', 'nori', 'loop');
create type public.provider_category as enum ('workshop', 'food', 'culture');
create type public.slot_status as enum ('ACTIVE', 'CANCELLED', 'SOLD_OUT');
create type public.hold_status as enum ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED');
create type public.bundle_phase as enum (
  'idle',
  'discovering',
  'composed',
  'holding',
  'held',
  'confirming',
  'reconciling',
  'confirmed',
  'recovering',
  'no_results',
  'error'
);
create type public.bundle_item_status as enum (
  'CANDIDATE',
  'HOLDING',
  'HELD',
  'CONFIRMED',
  'RELEASED',
  'EXPIRED',
  'FAILED'
);
create type public.audit_status as enum ('STARTED', 'SUCCESS', 'ERROR', 'CANCELLED');

create table public.providers (
  id uuid primary key,
  slug public.provider_slug not null unique,
  name text not null check (char_length(name) between 1 and 80),
  category public.provider_category not null,
  origin text not null unique check (
    origin ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$'
  ),
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.locations (
  id text primary key check (char_length(id) between 1 and 128),
  provider_id uuid not null references public.providers(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  address_short text not null check (char_length(address_short) between 1 and 120),
  map_x numeric not null check (map_x between 0 and 100),
  map_y numeric not null check (map_y between 0 and 100),
  active boolean not null default true,
  unique (id, provider_id)
);

create table public.travel_times (
  from_location_id text not null references public.locations(id) on delete cascade,
  to_location_id text not null references public.locations(id) on delete cascade,
  minutes integer not null check (minutes >= 0),
  primary key (from_location_id, to_location_id),
  check (from_location_id <> to_location_id)
);

create table public.slots (
  id uuid primary key,
  seed_key text not null unique check (char_length(seed_key) between 1 and 128),
  provider_id uuid not null references public.providers(id) on delete restrict,
  location_id text not null,
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  price_yen integer not null check (price_yen >= 0),
  original_price_yen integer not null check (original_price_yen >= price_yen),
  capacity_total integer not null check (capacity_total > 0),
  capacity_remaining integer not null check (
    capacity_remaining between 0 and capacity_total
  ),
  status public.slot_status not null default 'ACTIVE',
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  novelty_score numeric(4, 3) not null check (novelty_score between 0 and 1),
  inventory_version bigint not null default 1 check (inventory_version > 0),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, provider_id),
  foreign key (location_id, provider_id)
    references public.locations(id, provider_id)
    on delete restrict
);

create index slots_active_time_idx
  on public.slots (provider_id, starts_at, ends_at)
  where status = 'ACTIVE';
create index slots_location_idx on public.slots (location_id);

create table public.holds (
  id uuid primary key,
  provider_id uuid not null references public.providers(id) on delete restrict,
  slot_id uuid not null,
  browser_session_id uuid not null,
  client_request_id uuid not null,
  quantity integer not null check (quantity = 1),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status public.hold_status not null,
  expires_at timestamptz not null,
  creation_idempotency_hash text not null check (
    creation_idempotency_hash ~ '^[a-f0-9]{64}$'
  ),
  creation_request_hash text not null check (
    creation_request_hash ~ '^[a-f0-9]{64}$'
  ),
  confirm_idempotency_hash text check (
    confirm_idempotency_hash is null
    or confirm_idempotency_hash ~ '^[a-f0-9]{64}$'
  ),
  confirm_request_hash text check (
    confirm_request_hash is null
    or confirm_request_hash ~ '^[a-f0-9]{64}$'
  ),
  release_idempotency_hash text check (
    release_idempotency_hash is null
    or release_idempotency_hash ~ '^[a-f0-9]{64}$'
  ),
  release_request_hash text check (
    release_request_hash is null
    or release_request_hash ~ '^[a-f0-9]{64}$'
  ),
  reservation_ref text unique,
  created_at timestamptz not null,
  confirmed_at timestamptz,
  released_at timestamptz,
  expired_at timestamptz,
  unique (provider_id, creation_idempotency_hash),
  unique (provider_id, client_request_id),
  unique (id, provider_id, slot_id),
  foreign key (slot_id, provider_id)
    references public.slots(id, provider_id)
    on delete restrict,
  check (expires_at > created_at),
  check (
    (status = 'HELD' and confirmed_at is null and released_at is null and expired_at is null)
    or (status = 'CONFIRMED' and confirmed_at is not null and released_at is null and expired_at is null and reservation_ref is not null)
    or (status = 'RELEASED' and confirmed_at is null and released_at is not null and expired_at is null)
    or (status = 'EXPIRED' and confirmed_at is null and released_at is null and expired_at is not null)
  )
);

create unique index holds_confirm_idempotency_idx
  on public.holds (provider_id, confirm_idempotency_hash)
  where confirm_idempotency_hash is not null;
create unique index holds_release_idempotency_idx
  on public.holds (provider_id, release_idempotency_hash)
  where release_idempotency_hash is not null;
create index holds_slot_status_expiry_idx
  on public.holds (slot_id, status, expires_at);

create table public.bundle_sessions (
  id uuid primary key,
  browser_session_id uuid not null,
  intent_json jsonb not null,
  candidate_bundles_json jsonb not null check (
    jsonb_typeof(candidate_bundles_json) = 'array'
    and jsonb_array_length(candidate_bundles_json) <= 3
  ),
  candidate_set_version integer not null check (candidate_set_version > 0),
  selected_bundle_id text,
  phase public.bundle_phase not null,
  hold_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.bundle_items (
  bundle_session_id uuid not null references public.bundle_sessions(id) on delete cascade,
  position smallint not null check (position between 0 and 2),
  provider_id uuid not null references public.providers(id) on delete restrict,
  slot_id uuid not null,
  hold_id uuid,
  hold_token_ciphertext bytea,
  status public.bundle_item_status not null,
  public_reference text,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (bundle_session_id, position),
  unique (bundle_session_id, provider_id),
  foreign key (slot_id, provider_id)
    references public.slots(id, provider_id)
    on delete restrict,
  foreign key (hold_id, provider_id, slot_id)
    references public.holds(id, provider_id, slot_id)
    on delete restrict,
  check (hold_token_ciphertext is null or octet_length(hold_token_ciphertext) >= 29)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  correlation_id uuid not null,
  browser_session_id uuid,
  bundle_session_id uuid references public.bundle_sessions(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  origin text not null check (char_length(origin) between 1 and 255),
  operation text not null check (char_length(operation) between 1 and 80),
  status public.audit_status not null,
  error_code text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  safe_payload jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  check (jsonb_typeof(safe_payload) = 'object')
);

create table private.demo_slot_baselines (
  slot_id uuid primary key references public.slots(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_yen integer not null,
  original_price_yen integer not null,
  capacity_total integer not null,
  capacity_remaining integer not null,
  status public.slot_status not null,
  tags text[] not null,
  novelty_score numeric(4, 3) not null,
  inventory_version bigint not null
);

alter table public.providers enable row level security;
alter table public.locations enable row level security;
alter table public.travel_times enable row level security;
alter table public.slots enable row level security;
alter table public.holds enable row level security;
alter table public.bundle_sessions enable row level security;
alter table public.bundle_items enable row level security;
alter table public.audit_events enable row level security;

alter table public.providers force row level security;
alter table public.locations force row level security;
alter table public.travel_times force row level security;
alter table public.slots force row level security;
alter table public.holds force row level security;
alter table public.bundle_sessions force row level security;
alter table public.bundle_items force row level security;
alter table public.audit_events force row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public
  grant execute on functions to service_role;
