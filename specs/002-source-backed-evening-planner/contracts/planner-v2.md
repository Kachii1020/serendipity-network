# Public Contract: Planner v2 and Site Tools

All public inputs and envelopes require `schemaVersion: "2"` and reject extra
properties. These contracts are parallel to v1; no v1 schema or tool name is
repurposed.

## Envelope and errors

```ts
type PlannerMetaV2 = {
  correlationId: string;
  origin: string;
  completedAt: string;
  packVersion: string;
};

type PlannerErrorCodeV2 =
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "CANCELLED"
  | "NO_VALID_PLAN"
  | "NO_REPLACEMENT"
  | "PLACE_NOT_FOUND"
  | "STALE_DATA_PACK"
  | "STALE_PLAN"
  | "ALREADY_SAVED"
  | "STORAGE_LIMIT_REACHED"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_CORRUPT"
  | "INTERNAL_ERROR";

type PlannerPublicErrorV2 = {
  code: PlannerErrorCodeV2;
  message: string; // 1..240, safe and actionable
  retryable: boolean;
  safeReference?: string;
};

type PlannerEnvelopeV2<T> =
  | { schemaVersion: "2"; ok: true; data: T; meta: PlannerMetaV2 }
  | {
      schemaVersion: "2";
      ok: false;
      error: PlannerPublicErrorV2;
      meta: PlannerMetaV2;
    };
```

Every serialized response is at most 65,536 UTF-8 bytes and passes the shared
public-payload safety scanner. Timestamps must describe real Gregorian dates;
values that JavaScript would normalize, such as `2026-09-31`, are invalid at
the intent, pack, evidence, saved-snapshot, and envelope boundaries.
`STORAGE_CORRUPT` and `STORAGE_UNAVAILABLE` preserve existing bytes and cross
the Site Tool boundary only as safe messages.

## REST endpoints

### Search

```http
POST /api/v2/plans/search
Content-Type: application/json
```

Input is `PlannerIntentV2` from [data-model.md](../data-model.md).

```ts
type SearchPlansDataV2 = {
  candidateSetId: string;
  plan: EveningPlanV2; // exactly one selected plan
  warnings: string[];
};
```

### Swap by position

```http
POST /api/v2/plans/swap
Content-Type: application/json
```

```ts
type SwapPlanInputV2 = {
  schemaVersion: "2";
  candidateSetId: string;
  planId: string;
  intent: PlannerIntentV2;
  plan: EveningPlanV2;
  stopIndex: 0 | 1 | 2;
  preference: "CHEAPER" | "LESS_WALKING" | "DIFFERENT_INTEREST";
};

type SwapPlanDataV2 = {
  candidateSetId: string;
  plan: EveningPlanV2;
  replacedStopIndex: number;
  preference: "CHEAPER" | "LESS_WALKING" | "DIFFERENT_INTEREST";
  warnings: string[];
};
```

The server preserves all non-target place IDs, recomputes the complete route,
returns the warning set for the replacement plan, and returns `NO_REPLACEMENT`
without changing the visible plan when none exists. A successful swap replaces
the prior warning set rather than merging warnings from a removed place.

### Evidence

```http
GET /api/v2/places/{placeId}/evidence
```

`placeId` is a lowercase hyphenated slug, 1–128 characters.

```ts
type PlaceEvidenceDataV2 = {
  evidence: {
    schemaVersion: "2";
    packVersion: string;
    placeId: string;
    placeName: string;
    officialUrl: string;
    evidenceAsOf: string;
    claims: {
      identity: EvidenceClaimV2;
      address: EvidenceClaimV2;
      coordinates: EvidenceClaimV2 | null;
      hours: EvidenceClaimV2;
      price: EvidenceClaimV2;
      publicAccess: EvidenceClaimV2;
      officialLink: EvidenceClaimV2;
    };
    sources: SourceRecordV2[];
  };
};
```

Only sources used by that place are returned. This includes the place's
supplemental official holiday/daily-calendar sources, which the visible UI
labels as schedule-calendar evidence even when they are not the primary hours
claim. Permission documents, raw source content, and the complete data pack
never cross this boundary.

### HTTP behavior

- Request body limit: 16,384 UTF-8 bytes.
- Every response: `Cache-Control: no-store`, JSON UTF-8, and
  `X-Correlation-Id`.
- Every success data object and every failure error object must have the exact
  keys declared by its endpoint/tool contract. A safe-looking but malformed
  success cannot be projected into UI state.
- 200: success, `NO_VALID_PLAN`, or `NO_REPLACEMENT`.
- 400: invalid JSON/schema/version/date semantics.
- 404: `PLACE_NOT_FOUND`.
- 409: `STALE_DATA_PACK` or `STALE_PLAN`.
- 499: `CANCELLED`.
- 500: `INTERNAL_ERROR` or normalized storage failure.
- Search/swap/evidence perform no Provider, Supabase, scraping, or third-party
  runtime request.

## Reviewed pack boundary

The ACTIVE runtime pack has a build-time reviewed-claim ledger keyed by
`packVersion`. The engine accepts the pack only when the ledger exactly matches:

- pack status, generated/valid-through timestamps, and root data-license ID,
  URL, and attribution;
- Shibuya Station name, coordinates, and complete source metadata;
- each place's identity, address, coordinates, hours/provenance/exceptions,
  price/provenance, public-access eligibility, and official URL;
- each referenced source's ID, URL, checked/published timestamps, title,
  publisher, kind, complete usage/license/fact-scope object, and notes; and
- all pack- and place-level official calendar sources.

The reviewed ledger is a release artifact, not a public API response. Missing
or mismatched review data fails closed as `STALE_DATA_PACK` before composition;
changing only a source attribution or root data-license field is still drift.

## Top-level Site Tools

The planner document registers exactly these five tools. The first three are
read-only with respect to the outside world and the final two are explicit
browser-storage mutations. All have `untrustedContentHint: true`.

### `find_evening_plan`

```ts
type FindEveningPlanToolInputV2 = PlannerIntentV2;
type FindEveningPlanToolOutputV2 = PlannerEnvelopeV2<SearchPlansDataV2>;
```

- `readOnlyHint: true`
- Uses the same search action as the visible primary CTA.
- Atomically replaces the visible plan only after a validated success.
- Projects the normalized intent into the same visible form and allowlisted URL
  representation used by a manual search.
- Does not save, navigate, reserve, or claim live availability.

### `show_place_evidence`

```ts
type ShowPlaceEvidenceToolInputV2 = {
  schemaVersion: "2";
  candidateSetId: string;
  planId: string;
  placeId: string;
};

type ShowPlaceEvidenceToolOutputV2 = PlannerEnvelopeV2<PlaceEvidenceDataV2>;
```

- `readOnlyHint: true`
- State guard accepts only a place in the current candidate set and plan.
- The controller fetches the evidence endpoint and opens the same visible
  disclosure. It never opens `officialUrl` automatically.

### `swap_plan_stop`

```ts
type SwapPlanStopToolInputV2 = {
  schemaVersion: "2";
  candidateSetId: string;
  planId: string;
  targetPlaceId: string;
  preference: "CHEAPER" | "LESS_WALKING" | "DIFFERENT_INTEREST";
};

type SwapPlanStopToolOutputV2 = PlannerEnvelopeV2<SwapPlanDataV2>;
```

- `readOnlyHint: true`; it changes only the reversible local preview.
- The controller resolves `targetPlaceId` to the current stop index and sends
  the complete current intent to the REST swap contract.
- A success changes exactly one place and then updates the visible plan.
- Invalid/stale references and `NO_REPLACEMENT` preserve the prior plan.
- A success replaces the visible freshness-warning set with the warning set in
  the swap response.

### `save_plan`

```ts
type SavePlanToolInputV2 = {
  schemaVersion: "2";
  candidateSetId: string;
  planId: string;
};

type SavePlanDataV2 = {
  savedPlanId: string;
  savedAt: string;
  status: "SAVED" | "ALREADY_SAVED";
};
```

- `readOnlyHint: false`
- Saves the current immutable plan and loaded public evidence under
  `serendipity.saved-itineraries.v2`.
- Duplicate save is idempotent `ALREADY_SAVED`; it is not duplicated or
  reordered.
- Performs no fetch, navigation, cookie, account, Provider, or server write.

### `delete_saved_plan`

```ts
type DeleteSavedPlanToolInputV2 = {
  schemaVersion: "2";
  planId: string;
};

type DeleteSavedPlanDataV2 = {
  savedPlanId: string;
  deleted: boolean;
};
```

- `readOnlyHint: false`
- Delete is idempotent; an absent ID is a successful `deleted: false` no-op.
- A failed storage write keeps the previous document intact.

## State, concurrency, and stable IDs

```ts
type PlannerPhaseV2 =
  "idle" | "searching" | "planned" | "swapping" | "no_results" | "error";
```

- Only one search/swap/storage operation runs at a time. A concurrent Site Tool
  call returns `CANCELLED` before network or storage work.
- Search clears the previous candidate set only when starting a deliberate new
  query. Swap failure retains the last stable plan.
- Registered callbacks use the current controller reference. Registration is
  all-or-none: if any of the five registrations throws or rejects, every prior
  registration is disposed and the page remains in manual-controls mode.
  Successful registrations are disposed on unmount/Strict Mode remount.
- Evidence carries the source plan ID. A late evidence success/failure whose
  plan ID no longer matches, including one arriving after search or swap, is
  discarded and cannot enter a later saved snapshot.
- `candidateSetId` and `planId` are deterministic hashes of validated public
  input/pack/selected place data. They are references, not credentials or
  authorization tokens.
- Tool wrappers validate the exact success payload for their own tool and the
  exact `{code,message,retryable}` failure before serialization. Unknown
  credential-like keys, raw markup, cycles, oversize output, and cross-reference
  mismatches normalize to a safe `INTERNAL_ERROR`.
