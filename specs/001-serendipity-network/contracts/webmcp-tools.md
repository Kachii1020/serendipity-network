# Interface Contract: Hub and Provider Tools

**Spec**: [../spec.md](../spec.md)  
**Schema version**: `1`  
**Status**: Provider and direct-mode Chrome diagnostics implemented; five-tool
top-level ChatGPT product surface planned; transport encoding pinned by historical
Phase 0 evidence

## Contract rules

1. JSON Schema files in `packages/contracts/src/schemas` are the source of truth.
2. TypeScript types are derived from those schema objects; hand-written duplicate interfaces are prohibited outside documentation.
3. Every input and returned envelope is validated at the receiving boundary.
4. All timestamp fields are RFC 3339 strings with an explicit offset. MVP intent and fixtures use `+09:00` and resolve in `Asia/Tokyo`.
5. All IDs are opaque strings. Callers may compare or return them but may not parse business meaning from them.
6. Business failures fulfill with `ok: false`. Cancellation or a broken WebMCP runtime may reject, then the caller normalizes it.
7. Mutation idempotency keys are 128-bit-or-greater random values, scoped to Provider and operation, limited to 128 characters, hashed before database persistence, and omitted from logs/results.
8. Free-text is not accepted in MVP tool inputs. Tags come from configured allowlists.
9. Results are JSON-serializable and remain below 64 KiB. Search returns at most 10 slots per Provider.
10. The WebMCP draft transport may serialize results; `packages/webmcp` parses exactly once and never `eval`s content.

## Common result envelope

```ts
type Success<T> = {
  schemaVersion: "1";
  ok: true;
  data: T;
  meta: {
    correlationId: string;
    origin: string;
    completedAt: string;
  };
};

type Failure = {
  schemaVersion: "1";
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    provider?: "kiln" | "nori" | "loop";
    safeReference?: string;
  };
  meta: {
    correlationId: string;
    origin: string;
    completedAt: string;
  };
};

type Result<T> = Success<T> | Failure;
```

`message` is concise UI-safe copy. Stack traces, raw Provider payloads, SQL details, hold tokens, idempotency keys, and raw prompts are forbidden.

## Error codes

| Code                         |     Retryable | Meaning                                                     |
| ---------------------------- | ------------: | ----------------------------------------------------------- |
| `VALIDATION_ERROR`           |            no | Input or output did not satisfy schema                      |
| `UNSUPPORTED_SCHEMA_VERSION` |            no | Caller and receiver contracts differ                        |
| `WEBMCP_UNAVAILABLE`         |            no | `document.modelContext` is absent                           |
| `WEBMCP_PERMISSION_DENIED`   |            no | Origin isolation or `tools` permission failed               |
| `ORIGIN_MISMATCH`            |            no | Tool origin was not the configured exact origin             |
| `TOOL_NOT_FOUND`             |           yes | Tool was absent or became stale after navigation            |
| `PROVIDER_OFFLINE`           |           yes | Provider could not be reached                               |
| `PROVIDER_TIMEOUT`           |           yes | Bounded operation timeout elapsed                           |
| `CANCELLED`                  | conditionally | User/agent aborted the operation                            |
| `NO_VALID_BUNDLE`            |            no | No exact three-Provider bundle meets hard constraints       |
| `BUNDLE_NOT_FOUND`           |            no | Unknown bundle/session identifier                           |
| `STALE_BUNDLE`               |           yes | Candidate version is no longer current                      |
| `SLOT_NOT_FOUND`             |            no | Unknown or wrong-Provider slot                              |
| `SLOT_UNAVAILABLE`           |           yes | Capacity or slot status changed                             |
| `HOLD_NOT_FOUND`             |            no | Token/reference does not resolve at owning Provider         |
| `HOLD_EXPIRED`               |           yes | Hold expired and capacity was restored                      |
| `HOLD_RELEASED`              |           yes | Hold has already been released                              |
| `ALREADY_CONFIRMED`          |            no | Release was attempted after confirmation                    |
| `IDEMPOTENCY_CONFLICT`       |            no | Same key was reused for different input                     |
| `COMPENSATION_INCOMPLETE`    |           yes | At least one successful hold could not be verified released |
| `RECONCILIATION_REQUIRED`    |           yes | Mutation result remains unknown after bounded lookup        |
| `CONFIRMATION_INCONSISTENT`  |            no | Providers report a mixed confirmed/non-confirmed state      |
| `INTERNAL_ERROR`             |           yes | Sanitized unexpected server failure                         |

## Shared data shapes

### `Slot`

```ts
type Slot = {
  slotId: string;
  provider: "kiln" | "nori" | "loop";
  title: string; // 1..120 chars
  category: "workshop" | "food" | "culture";
  startsAt: string;
  endsAt: string;
  priceYen: number; // integer >= 0
  originalPriceYen: number; // integer >= priceYen
  capacityRemaining: number; // integer >= 0
  location: {
    locationId: string;
    name: string;
    addressShort: string;
    mapX: number; // 0..100
    mapY: number; // 0..100
  };
  tags: string[]; // max 12 configured tags
  noveltyScore: number; // 0..1
  inventoryVersion: string; // opaque updated-at/version token
};
```

### `BundleSummary`

```ts
type BundleSummary = {
  bundleId: string;
  bundleVersion: number;
  items: Array<{
    position: 0 | 1 | 2;
    slot: Slot;
    travelFromPreviousMinutes: number | null;
    spareGapFromPreviousMinutes: number | null;
  }>;
  totalPriceYen: number;
  totalTravelMinutes: number;
  startsAt: string;
  endsAt: string;
  score: number;
  scoreBreakdown: {
    preferenceFit: number;
    novelty: number;
    timeUtilization: number;
    discount: number;
    travelBurden: number;
  };
  reasonCodes: Array<
    | "MATCHES_PREFERENCES"
    | "HIGH_NOVELTY"
    | "LOW_TRAVEL"
    | "GOOD_VALUE"
    | "USES_TIME_WELL"
  >;
};
```

`items` has `minItems = maxItems = 3` and unique Provider values.

## Provider tools — Chrome cross-origin diagnostics

The official
[OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp) states
that ChatGPT's built-in browser does not discover tools registered inside either
same-origin or cross-origin iframes. The following Provider tools remain the
implemented Chrome/WebMCP cross-origin diagnostic surface and are not the
production ChatGPT judge surface.

Every Provider deployment registers the same five operations with its slug-prefixed name. For example, Kiln registers `kiln_search_slots`; Nori registers `nori_search_slots`.

Provider descriptions identify the owning Provider and a narrow operation. They do not tell the model to ignore Hub tools or contain unrelated instructions.

### `{provider}_search_slots`

**Annotation**: `readOnlyHint: true`, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  startAt: string;
  endAt: string;
  maxPriceYen: number;       // integer 0..100000
  partySize: 1;
  preferredTags: string[];   // max 5
  excludedTags: string[];    // max 5
}
```

Output data:

```ts
{
  provider: "kiln" | "nori" | "loop";
  slots: Slot[];             // max 10, sorted by start then ID
  inventoryAsOf: string;
}
```

The tool changes the iframe's visible activity state but does not change inventory.

### `{provider}_hold_slot`

**Annotation**: no read-only hint, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  slotId: string;
  inventoryVersion: string;
  quantity: 1;
  browserSessionId: string;
  clientRequestId: string;
}
```

Output data:

```ts
{
  provider: "kiln" | "nori" | "loop";
  holdSafeReference: string;
  slotId: string;
  status: "HELD";
  expiresAt: string;
}
```

The public tool input contains only the stable `clientRequestId`. The owning Provider iframe derives a Provider/operation-scoped idempotency key from that reference and sends the key only in its same-origin private HTTP body. The Provider Route Handler returns an opaque token to its same-origin Provider page. The tool stores it in origin-scoped `sessionStorage`, keyed by browser session and `holdSafeReference`, then removes it from the tool result. The token is cleared after confirmed/released/expired status. Neither nested nor direct mode exposes the key or token to the browser agent.

### `{provider}_get_hold_status`

**Annotation**: `readOnlyHint: true`, `untrustedContentHint: true`

Input accepts exactly one lookup:

```ts
{
  schemaVersion: "1";
  holdSafeReference: string;
  browserSessionId: string;
  clientRequestId?: never;
}
|
{
  schemaVersion: "1";
  holdSafeReference?: never;
  clientRequestId: string;
  browserSessionId: string;
}
```

Output data:

```ts
{
  provider: "kiln" | "nori" | "loop";
  holdSafeReference: string;
  slotId: string;
  status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expiresAt: string;
  reservationRef?: string;
}
```

Lookup by `clientRequestId` is limited to the same Provider and browser session and exists to resolve an unknown hold-create result. If the Provider Route Handler recovers an active committed hold, it re-derives the private token and returns it only in the same-origin `x-serendipity-recovered-hold-token` response header. The tool stores that token in its origin-scoped session store and returns only the public status envelope. Terminal status responses omit the header and cause the tool to clear any stored token.

### `{provider}_confirm_hold`

**Annotation**: no read-only hint, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  holdSafeReference: string;
  browserSessionId: string;
}
```

Output data:

```ts
{
  provider: "kiln" | "nori" | "loop";
  holdSafeReference: string;
  status: "CONFIRMED";
  reservationRef: string;
  confirmedAt: string;
}
```

### `{provider}_release_hold`

**Annotation**: no read-only hint, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  holdSafeReference: string;
  browserSessionId: string;
  reason: "USER_CANCELLED" |
    "BUNDLE_COMPENSATION" |
    "HOLD_EXPIRED_UI" |
    "DEMO_RESET";
}
```

Output data:

```ts
{
  provider: "kiln" | "nori" | "loop";
  holdSafeReference: string;
  slotId: string;
  status: "RELEASED" | "EXPIRED";
  capacityRestored: boolean;
}
```

`capacityRestored` is true only for the invocation that performed `HELD -> RELEASED`; idempotent replays return false.

Confirm and release keys are derived privately from the safe hold reference plus Provider and operation. Replaying the same public input therefore sends the same private key without exposing it in Site Tools activity.

## Production ChatGPT Site Tools surface

The production judge surface registers exactly the following five JavaScript
tools in the **top-level Hub document**:

1. `find_serendipity_options` — read-only discovery
2. `show_bundle` — read-only presentation/selection
3. `hold_bundle` — inventory mutation
4. `confirm_bundle` — reservation mutation
5. `release_bundle` — hold mutation

Their callbacks call the existing same-origin Hub workflow Route Handlers, which
use the server-side HTTP Provider gateway and existing validation,
idempotency/compensation, encrypted persistence, and reconciliation. A top-level
callback never discovers or executes an iframe tool. Manual UI actions invoke the
same product controller and routes but are labeled `Manual fallback`, not `Site
tool`.

The five definitions reuse the high-level operation shapes below. This is a
transport evolution, not a new business contract, and does not rewrite T019's
historical `direct` Chrome decision.

## Hub high-level operation shapes

### `find_serendipity_options`

**Annotation**: `readOnlyHint: true`, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  area: "shibuya";
  startAt: string;
  endAt: string;
  totalBudgetYen: number;    // integer 1..100000
  partySize: 1;
  preferredTags: string[];  // max 5
  excludedTags: string[];   // max 5
}
```

Output data:

```ts
{
  bundleSessionId: string;
  bundleVersion: number;
  selectedBundle: BundleSummary;
  alternatives: BundleSummary[]; // max 2
  providerStatuses: Record<"kiln" | "nori" | "loop", "ONLINE" | "INVALID" | "OFFLINE">;
}
```

It updates only the current page's ephemeral candidate state. The selected snapshot is persisted when the first hold mutation begins, so the read-only annotation does not conceal an inventory or durable workflow mutation.

Version 1 accepts only `area: "shibuya"`. A request for another area must fail
validation or receive an explicit supported-area boundary response before any
Provider network call. A general urban audience statement does not expand the
live area enum.

### `show_bundle`

**Annotation**: `readOnlyHint: true`, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  bundleSessionId: string;
  bundleId: string;
  bundleVersion: number;
}
```

Output data: selected `BundleSummary` and its deterministic two-sentence-or-shorter explanation.

### `hold_bundle`

**Annotation**: no read-only hint, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  bundleSessionId: string;
  bundleId: string;
  bundleVersion: number;
}
```

Output data:

```ts
{
  bundleHoldId: string;
  bundleId: string;
  status: "HELD";
  expiresAt: string; // earliest Provider expiry
  providerHolds: Array<{
    provider: "kiln" | "nori" | "loop";
    holdSafeReference: string;
    status: "HELD";
  }>;
}
```

Provider hold tokens and operation idempotency keys are deliberately absent.

### `confirm_bundle`

**Annotation**: no read-only hint, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  bundleSessionId: string;
  bundleHoldId: string;
}
```

Output data:

```ts
{
  bundleId: string;
  status: "CONFIRMED";
  confirmedAt: string;
  totalPriceYen: number;
  reservations: Array<{
    provider: "kiln" | "nori" | "loop";
    reservationRef: string;
  }>;
}
```

### `release_bundle`

**Annotation**: no read-only hint, `untrustedContentHint: true`

Input:

```ts
{
  schemaVersion: "1";
  bundleSessionId: string;
  bundleHoldId: string;
  reason: "USER_CANCELLED" | "HOLD_EXPIRED_UI";
}
```

Output data includes the three safe Provider statuses and `status: "RELEASED"`. It returns `ALREADY_CONFIRMED` if any item is confirmed and does not claim a rollback.

## Historical direct-provider Chrome diagnostic contract

This surface is activated by the recorded Phase 0 decision. Provider tools above
remain unchanged. A compatible Chrome diagnostic caller performs Provider calls
explicitly, while Hub coordination tools validate and render the workflow. It is
not offered as a workaround for ChatGPT's iframe limitation.

Fallback-only Hub tools:

1. `hub_compose_provider_results`
   - Accepts exactly three successful `search_slots` envelopes, one per configured Provider.
   - Validates origin/provider identity and uses the same bundle engine.
   - Returns the same candidate-set data as `find_serendipity_options`.
2. `hub_prepare_bundle_hold`
   - Accepts current session/bundle/version.
   - Returns three Provider-specific hold inputs with stable operation references.
3. `hub_record_bundle_hold_results`
   - Accepts exactly three Provider hold envelopes.
   - On full success, stores the three safe references in Hub workflow state and returns the same public `hold_bundle` output. Raw tokens remain owned by the Provider frames.
   - On any failure, returns explicit Provider release instructions for every successful hold and enters `recovering`.
4. `hub_prepare_bundle_release`
   - Accepts the active bundle session/hold plus `USER_CANCELLED` or `HOLD_EXPIRED_UI`.
   - Returns three Provider release inputs containing only owned safe references.
5. `hub_record_release_results`
   - Accepts the required release envelopes and verifies compensation completeness.
   - Completes either a partial-hold compensation plan or an explicit three-Provider user release; any missing/failed compensation remains `COMPENSATION_INCOMPLETE`.
6. `hub_prepare_bundle_confirmation`
   - Returns three Provider confirm inputs for the active bundle hold.
7. `hub_record_confirmation_results`
   - Validates three confirm/status envelopes and renders confirmed or reconciliation state.

Fallback coordination inputs contain only safe request/hold references. Provider frames resolve their own origin-scoped tokens and privately derived idempotency keys for mutation calls. The T065–T067 contract, tool-integration, compensation, reconciliation, and three-Provider in-process E2E tests are active because `WEBMCP_COMPOSITION_MODE=direct`.

## Chrome diagnostic discovery and origin verification

On the Chrome diagnostic surface, the Hub does not select a tool by name alone.
Discovery must match:

```text
registeredTool.origin === configuredProvider.origin
registeredTool.name === configuredProvider.slug + "_" + operation
```

Zero matches returns `TOOL_NOT_FOUND`. More than one exact match returns
`ORIGIN_MISMATCH`/configuration error. Cached `RegisteredTool` values are
invalidated on `toolchange`, iframe `load`, and before every mutation. Production
top-level tools do not call `getTools({ fromOrigins })` and therefore do not depend
on descendant discovery.

## Tool lifecycle

- Top-level production registration occurs once per mounted Hub Client Component
  through an `AbortController`; exactly five names remain after a Strict Mode
  dispose/remount.
- Diagnostic iframe registration follows the same lifecycle independently in each
  Provider document.
- Unmount aborts registration and any in-flight fetch.
- React development Strict Mode double-mount must not leave duplicate registrations.
- Provider iframe action status is set before the Route Handler call and resolved from the normalized result.
- User/agent cancellation propagates the provided signal into fetch and then into orchestration compensation where a mutation may already have committed.

## HTTP parity

Provider HTTP endpoints use the same business envelopes wrapped in standard HTTP semantics. The same-origin hold API additionally returns a private `holdToken` field to the Provider page or authorized Hub server; the WebMCP tool strips this field before returning its public envelope.

| Route                           | Method                         | Tool equivalent              |
| ------------------------------- | ------------------------------ | ---------------------------- |
| `/api/slots`                    | POST with validated JSON       | `{provider}_search_slots`    |
| `/api/holds`                    | POST                           | `{provider}_hold_slot`       |
| `/api/holds/status`             | POST with `clientRequestId`    | unknown create-result lookup |
| `/api/holds/:reference`         | POST with safe reference       | `{provider}_get_hold_status` |
| `/api/holds/:reference/confirm` | POST with private token header | `{provider}_confirm_hold`    |
| `/api/holds/:reference/release` | POST with private token header | `{provider}_release_hold`    |

HTTP status codes help operators, but callers always parse the common envelope. Business conflicts use 409/410 as appropriate; malformed input uses 400; authentication failures use 401/403; unexpected errors use 500.

Top-level Hub tools use the same Hub routes as human actions:

| Hub product tool           | Existing Hub workflow boundary                 |
| -------------------------- | ---------------------------------------------- |
| `find_serendipity_options` | `POST /api/manual/search`                      |
| `show_bundle`              | validated current candidate state, no mutation |
| `hold_bundle`              | `POST /api/manual/hold`                        |
| `confirm_bundle`           | `POST /api/manual/confirm`                     |
| `release_bundle`           | `POST /api/manual/release`                     |

The `/api/manual/*` path name is historical. Activity provenance comes from the
caller (`Site tool` or `Manual fallback`) and does not change the business
envelope.

## Product presentation sync

Manual mode and top-level Hub Site Tools use `window.postMessage` only to mirror
safe operation state into the actual Provider iframe:

```ts
type ProviderReadyMessage = {
  type: "serendipity.provider-ready.v1";
  schemaVersion: "1";
  provider: "kiln" | "nori" | "loop";
  frameInstanceId: string;
};

type HubSessionBindMessage = {
  type: "serendipity.bind-session.v1";
  schemaVersion: "1";
  provider: "kiln" | "nori" | "loop";
  frameInstanceId: string;
  browserSessionId: string;
};

type ProviderPresentationMessage = {
  type: "serendipity.provider-state.v1";
  schemaVersion: "1";
  browserSessionId: string;
  provider: "kiln" | "nori" | "loop";
  frameInstanceId: string;
  action: "SEARCH" | "HOLD" | "CONFIRM" | "RELEASE" | "RESET";
  status:
    "QUERYING" | "AVAILABLE" | "HELD" | "CONFIRMED" | "RELEASED" | "ERROR";
  expiresAt?: string;
  correlationId: string;
};
```

On iframe load, the Provider announces a random `frameInstanceId` to the configured exact Hub origin. The Hub returns a session bind message to the Provider's exact origin. The Provider then accepts state messages only for the configured Hub origin, its own slug, bound browser session, and current frame instance. A reload invalidates the previous instance. These handlers update presentation state only; they cannot call Route Handlers or mutate inventory.

## Area data-pack expansion contract

The launch contract exposes Shibuya only. Future area support is data-driven but
not automatically live. A versioned area pack must provide:

```ts
type AreaDataPack = {
  packVersion: string;
  areaSlug: string;
  timezone: string; // IANA identifier
  currency: "JPY"; // broaden only with a contract-version review
  providerSlugs: [string, string, string];
  locations: Array<{ locationId: string; provider: string }>;
  directedTravelMinutes: Array<{
    fromLocationId: string;
    toLocationId: string;
    minutes: number;
  }>;
  serviceWindow: { startsLocal: string; endsLocal: string };
  localizedBoundaryCopy: string;
};
```

A pack is eligible for the public `area` enum only after exact-origin Provider
configuration, a complete directed travel matrix, at least one deterministic
three-Provider feasible bundle, schema/headers/security checks, repeatable reset,
and one production end-to-end journey pass. Until then, unsupported-area requests
make zero Provider calls and the UI does not display that area. Adding an enum
value requires an explicit compatibility review because older version-1 validators
may reject it.

## Contract compatibility policy

- `schemaVersion: "1"` is required in every public input/envelope.
- Additive optional output fields are allowed within version 1.
- New required fields, changed semantics, or removed enum values require version 2 and a compatibility update.
- Phase 0 records the WebMCP draft date, Chrome version, ChatGPT desktop version, model, composition mode, and execution encoding in test evidence.
