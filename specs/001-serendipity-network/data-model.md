# Data Model: Serendipity Network

**Spec**: [spec.md](./spec.md)  
**Status**: Implemented in five migrations; 73/73 local pgTAP assertions pass;
all five are active on the dedicated production project

## Design principles

- Provider inventory and holds are authoritative in Postgres, not Zustand or bundle snapshots.
- All capacity-changing transitions occur inside database functions/transactions.
- Bundle candidates are immutable snapshots; they are not proof that capacity is still available.
- Idempotency keys are hashed before persistence. The Provider authority stores only a hold-token hash; manual/server mode may keep a separate application-encrypted active token. Neither form is written to audit payloads.
- A release or expiry restores capacity only on the single transition from `HELD`.
- The schema supports the exact MVP rather than a general booking platform.

## Enums

```sql
create type provider_slug as enum ('kiln', 'nori', 'loop');
create type provider_category as enum ('workshop', 'food', 'culture');
create type slot_status as enum ('ACTIVE', 'CANCELLED', 'SOLD_OUT');
create type hold_status as enum ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED');
create type bundle_phase as enum (
  'idle', 'discovering', 'composed', 'holding', 'held',
  'confirming', 'reconciling', 'confirmed', 'recovering',
  'no_results', 'error'
);
create type bundle_item_status as enum (
  'CANDIDATE', 'HOLDING', 'HELD', 'CONFIRMED',
  'RELEASED', 'EXPIRED', 'FAILED'
);
create type audit_status as enum ('STARTED', 'SUCCESS', 'ERROR', 'CANCELLED');
```

`unsupported` is a client capability state and is not persisted as a server workflow phase.

## Tables

### `providers`

| Column       | Type              | Constraints / meaning      |
| ------------ | ----------------- | -------------------------- |
| `id`         | uuid              | primary key                |
| `slug`       | provider_slug     | unique, not null           |
| `name`       | text              | not null, 1–80 chars       |
| `category`   | provider_category | not null                   |
| `origin`     | text              | unique, exact HTTPS origin |
| `active`     | boolean           | not null, default true     |
| `created_at` | timestamptz       | not null                   |
| `updated_at` | timestamptz       | not null                   |

The runtime Provider app accepts exactly one configured slug and rejects database rows for another slug.

### `locations`

| Column          | Type    | Constraints / meaning                 |
| --------------- | ------- | ------------------------------------- |
| `id`            | text    | primary key, stable travel-matrix key |
| `provider_id`   | uuid    | foreign key to `providers`, not null  |
| `name`          | text    | not null                              |
| `address_short` | text    | display-only demo address             |
| `map_x`         | numeric | SVG coordinate, 0–100                 |
| `map_y`         | numeric | SVG coordinate, 0–100                 |
| `active`        | boolean | not null, default true                |

The MVP does not store live-routing geometry or require latitude/longitude.

### `travel_times`

| Column             | Type    | Constraints / meaning      |
| ------------------ | ------- | -------------------------- |
| `from_location_id` | text    | foreign key to `locations` |
| `to_location_id`   | text    | foreign key to `locations` |
| `minutes`          | integer | `minutes >= 0`             |

Primary key: `(from_location_id, to_location_id)`. Seed data includes both directions even when values are equal. Missing pairs make a candidate infeasible.

### `slots`

| Column               | Type         | Constraints / meaning                             |
| -------------------- | ------------ | ------------------------------------------------- |
| `id`                 | uuid         | primary key                                       |
| `seed_key`           | text         | unique stable fixture key                         |
| `provider_id`        | uuid         | foreign key, not null                             |
| `location_id`        | text         | foreign key, not null                             |
| `title`              | text         | 1–120 chars                                       |
| `starts_at`          | timestamptz  | not null                                          |
| `ends_at`            | timestamptz  | `ends_at > starts_at`                             |
| `price_yen`          | integer      | `>= 0`                                            |
| `original_price_yen` | integer      | `>= price_yen`                                    |
| `capacity_total`     | integer      | `> 0`                                             |
| `capacity_remaining` | integer      | `between 0 and capacity_total`                    |
| `status`             | slot_status  | not null, default `ACTIVE`                        |
| `tags`               | text[]       | normalized lowercase enum-like values             |
| `novelty_score`      | numeric(4,3) | between 0 and 1                                   |
| `inventory_version`  | bigint       | positive, incremented on capacity/status mutation |
| `updated_at`         | timestamptz  | not null                                          |

Indexes:

- `(provider_id, starts_at, ends_at)` where `status = 'ACTIVE'`
- `(location_id)`
- GIN on `tags` only if query evidence justifies it; fixture size does not require it initially.

### `holds`

| Column                      | Type        | Constraints / meaning                           |
| --------------------------- | ----------- | ----------------------------------------------- |
| `id`                        | uuid        | primary key proposed by Provider server         |
| `provider_id`               | uuid        | foreign key, not null                           |
| `slot_id`                   | uuid        | foreign key, not null                           |
| `browser_session_id`        | uuid        | workflow grouping, not authorization            |
| `client_request_id`         | uuid        | safe reference for unknown-result lookup        |
| `quantity`                  | integer     | MVP constraint `quantity = 1`                   |
| `token_hash`                | text        | unique SHA-256 hash of signed opaque hold token |
| `status`                    | hold_status | not null                                        |
| `expires_at`                | timestamptz | not null                                        |
| `creation_idempotency_hash` | text        | unique within Provider                          |
| `creation_request_hash`     | text        | detects key reuse with different input          |
| `confirm_idempotency_hash`  | text        | nullable                                        |
| `confirm_request_hash`      | text        | nullable                                        |
| `release_idempotency_hash`  | text        | nullable                                        |
| `release_request_hash`      | text        | nullable                                        |
| `reservation_ref`           | text        | unique nullable public demo reference           |
| `created_at`                | timestamptz | not null                                        |
| `confirmed_at`              | timestamptz | nullable                                        |
| `released_at`               | timestamptz | nullable                                        |
| `expired_at`                | timestamptz | nullable                                        |

Constraints and indexes:

- Unique `(provider_id, creation_idempotency_hash)`.
- Unique `(provider_id, client_request_id)`.
- Partial unique indexes on non-null `(provider_id, confirm_idempotency_hash)` and `(provider_id, release_idempotency_hash)`.
- Index `(slot_id, status, expires_at)`.
- Terminal timestamp checks match status.

Token construction is deterministic for a persisted hold ID and Provider secret:

```text
tokenPayload = base64url(providerSlug + "." + holdId)
signature = HMAC-SHA256(HOLD_TOKEN_SECRET, tokenPayload)
holdToken = tokenPayload + "." + base64url(signature)
tokenHash = SHA-256(holdToken)
```

On an idempotent replay, the database returns the existing hold ID and the Provider server derives the same token without storing plaintext.

### `bundle_sessions`

| Column                   | Type         | Constraints / meaning                 |
| ------------------------ | ------------ | ------------------------------------- |
| `id`                     | uuid         | primary key, `bundleSessionId`        |
| `browser_session_id`     | uuid         | not null                              |
| `intent_json`            | jsonb        | normalized intent only, no raw prompt |
| `candidate_bundles_json` | jsonb        | at most three immutable snapshots     |
| `candidate_set_version`  | integer      | positive monotonic version            |
| `selected_bundle_id`     | text         | nullable                              |
| `phase`                  | bundle_phase | not null                              |
| `hold_expires_at`        | timestamptz  | nullable, earliest Provider expiry    |
| `last_error_code`        | text         | nullable, normalized code only        |
| `created_at`             | timestamptz  | not null                              |
| `updated_at`             | timestamptz  | not null                              |

Candidate snapshots never contain hold tokens, idempotency keys, service credentials, or raw Provider responses.

### `bundle_items`

| Column                  | Type               | Constraints / meaning                                             |
| ----------------------- | ------------------ | ----------------------------------------------------------------- |
| `bundle_session_id`     | uuid               | foreign key, part of primary key                                  |
| `position`              | smallint           | primary key part, 0–2                                             |
| `provider_id`           | uuid               | foreign key, unique within session                                |
| `slot_id`               | uuid               | foreign key, not null                                             |
| `hold_id`               | uuid               | nullable foreign key to `holds`                                   |
| `hold_token_ciphertext` | bytea              | nullable, Hub-encrypted token for manual/server mode while active |
| `status`                | bundle_item_status | not null                                                          |
| `public_reference`      | text               | safe UI reference, nullable                                       |
| `updated_at`            | timestamptz        | not null                                                          |

Unique `(bundle_session_id, provider_id)`. A trigger or application assertion ensures exactly three rows before a session can enter `held` or `confirmed`.

`hold_token_ciphertext` is populated only when the Hub server performs manual/server-side Provider HTTP orchestration. It is encrypted before persistence with a Hub key distinct from Provider token-signing keys, never selected by browser-facing views, and set to null after confirmation, verified release/expiry, or reset. Nested WebMCP mode leaves this column null because each Provider iframe retains its own token and exposes only a safe reference. The Provider still verifies every token against `holds.token_hash`.

### `audit_events`

| Column               | Type             | Constraints / meaning        |
| -------------------- | ---------------- | ---------------------------- |
| `id`                 | bigint generated | primary key                  |
| `correlation_id`     | uuid             | indexed                      |
| `browser_session_id` | uuid             | nullable                     |
| `bundle_session_id`  | uuid             | nullable                     |
| `provider_id`        | uuid             | nullable                     |
| `origin`             | text             | exact origin or `hub-server` |
| `operation`          | text             | bounded known operation name |
| `status`             | audit_status     | not null                     |
| `error_code`         | text             | nullable normalized code     |
| `duration_ms`        | integer          | nullable, `>= 0`             |
| `safe_payload`       | jsonb            | allowlisted metadata only    |
| `created_at`         | timestamptz      | not null                     |

Allowed `safe_payload` examples: slot count, candidate count, bundle public ID, HTTP status, retry count, and failed Provider slug. A database check cannot prove semantic safety, so server code builds this field from explicit allowlists rather than arbitrary object spreading.

## Database functions

### `expire_due_holds(p_provider_id, p_now)`

For every matching `HELD` row with `expires_at <= p_now`:

1. Lock the hold row.
2. Transition `HELD -> EXPIRED` and set `expired_at`.
3. Increment the linked slot's capacity and `inventory_version`, with a capacity upper-bound check.
4. Return expired hold IDs.

Concurrent calls must skip rows no longer in `HELD`, making capacity restoration exactly once.

### `create_slot_hold(...)`

Inputs include Provider, slot, expected inventory version, browser session, client request ID, proposed hold ID, token hash, quantity, creation idempotency hash, request hash, and server `now`.

Transaction:

1. Resolve an existing idempotency row for the Provider.
2. If found with a different request hash, return `IDEMPOTENCY_CONFLICT`.
3. If found with the same hash, return the existing hold without capacity mutation.
4. Expire due holds for the target Provider.
5. Atomically decrement capacity and increment `inventory_version` only where the slot is active, the expected inventory version matches, and capacity is sufficient.
6. Insert a `HELD` row with `expires_at = now + interval '90 seconds'`.
7. Return hold ID, status, expiry, and safe slot summary.

If step 5 changes no row, return `SLOT_UNAVAILABLE`. Any later insert failure rolls back the decrement.

### `confirm_slot_hold(...)`

1. Lock the hold row and verify Provider ownership.
2. Resolve confirm idempotency; mismatched request hash returns `IDEMPOTENCY_CONFLICT`.
3. `CONFIRMED` returns the existing reservation reference.
4. `RELEASED` returns `HOLD_RELEASED`; `EXPIRED` returns `HOLD_EXPIRED`.
5. If `HELD` but expired, perform the exact expiry transition and return `HOLD_EXPIRED`.
6. Otherwise transition `HELD -> CONFIRMED`, generate a stable public reservation reference, and return it.

Confirmation does not change capacity because the seat was already deducted at hold creation.

### `release_slot_hold(...)`

1. Lock and verify the hold.
2. Resolve release idempotency and request hash.
3. If `HELD`, transition to `RELEASED`, set `released_at`, restore capacity once, and increment the slot's `inventory_version`.
4. If already `RELEASED` or `EXPIRED`, return its terminal state without capacity mutation.
5. If `CONFIRMED`, return `ALREADY_CONFIRMED`.

### `get_hold_status(...)`

Returns only the current status, expiry, safe slot summary, and reservation reference where applicable. Hold-token verification occurs in the Provider server before the function is called. Search by `client_request_id` is available only to the owning Provider server for unknown create results.

### `cancel_demo_slot(p_provider_id, p_slot_id)`

- Valid only through an operator-authenticated demo Route Handler.
- Locks the Provider-owned slot, requires `ACTIVE` status, and rejects a slot with an active `HELD` or `CONFIRMED` hold.
- Transitions the slot to `CANCELLED` and increments `inventory_version` exactly once.
- Replays return the existing `CANCELLED` state without another version increment.
- Is unavailable when the deployment is not explicitly configured as a demo environment.

### `reset_demo_state(p_operator_scope)`

- Valid only through an operator-authenticated Route Handler.
- Restores fixture slots from canonical seed values.
- Deletes or archives only demo bundle sessions, holds, and audit events.
- Is idempotent.
- Never drops tables or changes schema.

## RLS and grants

- Enable RLS on every public-schema table.
- Revoke direct mutation privileges from `anon` and `authenticated` for Providers, slots, holds, bundle sessions, bundle items, and audit events.
- Prefer server-only calls through scoped server modules. The service-role key is not exposed to clients.
- If a read-only public inventory view is later exposed, grant only `SELECT` on a purpose-built view that omits hold and audit data.
- SQL functions set an explicit empty `search_path`, schema-qualify objects, and validate Provider ownership.
- pgTAP tests ship in the same migration sequence as grants/functions.

## Canonical seed contract

The seed contains at least three active slots per Provider for one fixed demo date that can be shifted to “today” by reset. Stable `seed_key` values allow tests to assert behavior without depending on UUIDs.

Canonical winning bundle for the default intent:

| Seed key                      | Time        |  Price | Original | Novelty | Representative tags                 |
| ----------------------------- | ----------- | -----: | -------: | ------: | ----------------------------------- |
| `kiln.beginner-pottery`       | 18:15–19:15 | ¥1,500 |   ¥2,500 |    0.90 | `creative`, `hands-on`, `beginner`  |
| `nori.seasonal-counter`       | 19:40–20:30 | ¥1,800 |   ¥3,000 |    0.78 | `seasonal`, `food`, `solo-friendly` |
| `loop.experimental-listening` | 21:00–22:00 | ¥1,200 |   ¥2,000 |    0.96 | `experimental`, `music`, `intimate` |

Canonical travel matrix entries:

- Kiln main studio → Nori counter: 20 minutes.
- Nori counter → Loop Room: 18 minutes.
- The displayed spare gaps are therefore 5 and 12 minutes.

The default test intent requests tags `creative`, `seasonal`, and `experimental`, starts at 18:00, ends at 22:30, and has a ¥5,000 budget. Alternative fixtures must not outrank the canonical bundle under the documented score and tie-break rules.

## Lifecycle invariants

- `capacity_remaining + active HELD quantity + CONFIRMED quantity` is bounded by `capacity_total` for fixture history that has not been reset.
- No hold can transition out of `CONFIRMED` in the MVP.
- No hold can transition from `RELEASED` or `EXPIRED` back to `HELD`.
- A bundle session enters `held` only when three linked items are `HELD` and share the selected candidate version.
- A bundle session enters `confirmed` only when three linked items are `CONFIRMED`.
- A bundle session leaving a partial-hold recovery records either zero active holds or `COMPENSATION_INCOMPLETE`.

## Retention

This is a public hackathon demo:

- Holds and bundle sessions may be deleted during operator reset.
- Audit events retain only the latest seven days or the latest bounded demo run set.
- No raw prompts or personal identifiers are collected.
- Browser session IDs are random and carry no account identity.
