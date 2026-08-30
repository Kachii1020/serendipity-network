# Public Contract: Planner v3, REST, and Site Tools

All public v3 inputs and envelopes require `schemaVersion: "3"`, reject unknown
properties, pass semantic validation, and are independent of v1/v2 contracts.
The shared data types are defined in [data-model.md](../data-model.md).

## Envelope, metadata, and errors

```ts
type PlannerMetaV3 = {
  correlationId: string;
  origin: string;
  completedAt: string;
  area: "shibuya" | "shinjuku" | "ikebukuro" | null;
  areaPackVersion: string | null;
};

type PlannerErrorCodeV3 =
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "CANCELLED"
  | "NO_VALID_PLAN"
  | "NO_REPLACEMENT"
  | "PLACE_NOT_FOUND"
  | "AREA_NOT_ACTIVE"
  | "STALE_DATA_PACK"
  | "STALE_PLAN"
  | "STORAGE_LIMIT_REACHED"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_CORRUPT"
  | "INTERNAL_ERROR";

type PlannerPublicErrorV3 = {
  code: PlannerErrorCodeV3;
  message: string; // 1..240 safe, actionable characters
  retryable: boolean;
  safeReference?: string;
};

type PlannerEnvelopeV3<T> =
  | { schemaVersion: "3"; ok: true; data: T; meta: PlannerMetaV3 }
  | {
      schemaVersion: "3";
      ok: false;
      error: PlannerPublicErrorV3;
      meta: PlannerMetaV3;
    };
```

Every endpoint and tool has a dedicated exact success-data validator; a generic
safe-looking object is insufficient. The serialized UTF-8 envelope must be at
most 65,536 bytes and pass the shared public-safety scanner. No credential,
request header, raw HTML, Google raw response/error, Provider field, PII,
session token, or cycle may serialize.

## Search

```http
POST /api/v3/plans/search
Content-Type: application/json
```

Input is exact `PlannerIntentV3`.

```ts
type GoogleEnrichmentSummaryV3 = {
  mode: "DISABLED" | "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
  checkedPlaceIds: string[]; // reviewed Google place IDs only, max 3
};

type SearchPlansDataV3 = {
  candidateSetId: string;
  plan: EveningPlanV3;
  warnings: string[];
  googleEnrichment: GoogleEnrichmentSummaryV3;
};
```

- The pure engine produces deterministic ranked candidates before Google calls.
- `DISABLED` means the feature flag is off; no warning is required.
- `PARTIAL`/`UNAVAILABLE` produces a safe warning while preserving a valid
  official-source plan.
- Only selected-stop normalized Google signals enter `plan`; closed candidates
  are not returned.
- `NO_VALID_PLAN` is a normalized failure envelope and never contains candidate
  data or upstream details.

## Swap

```http
POST /api/v3/plans/swap
Content-Type: application/json
```

```ts
type SwapPreferenceV3 = "CHEAPER" | "LESS_WALKING" | "DIFFERENT_INTEREST";

type SwapPlanInputV3 = {
  schemaVersion: "3";
  candidateSetId: string;
  planId: string;
  intent: PlannerIntentV3;
  plan: EveningPlanV3;
  stopIndex: 0 | 1 | 2;
  preference: SwapPreferenceV3;
};

type SwapPlanDataV3 = {
  candidateSetId: string;
  plan: EveningPlanV3;
  replacedStopIndex: 0 | 1 | 2;
  preference: SwapPreferenceV3;
  warnings: string[];
  googleEnrichment: GoogleEnrichmentSummaryV3;
};
```

- The target kind cannot change. Every non-target place ID is identical.
- All times, walking, official price totals, group totals, warnings, and Google
  context are recomputed.
- `CHEAPER` compares the official per-person maximum only.
- `NO_REPLACEMENT`, stale input, cancellation, malformed success, and Google
  degradation leave the visible plan unchanged. A successful swap replaces the
  prior warning set rather than merging it.

## Evidence

```http
GET /api/v3/areas/{area}/places/{placeId}/evidence?startsAt={iso}&endsAt={iso}
```

Both path components are closed/slug validated. `placeId` must resolve in the
named ACTIVE area. `startsAt` and `endsAt` are an optional pair: both or neither
must be present, both use strict JST timestamps, and the interval must equal the
current or saved stop interval. Without the pair, the endpoint returns official
evidence only; with it, a registered meal may also receive fresh Google context.

```ts
type PlaceEvidenceDataV3 = {
  officialEvidence: PlaceEvidenceV3;
  googleSignal?: GooglePlaceSignalV3;
  warnings: string[];
};
```

- `officialEvidence` includes only the selected place's declared official/open
  sources and material calendar/menu sources.
- `googleSignal` is optional, transient, normalized, and structurally separate.
- Evidence never returns permission files, raw source/Google content, a complete
  pack, or a Google signal for an unregistered ID.
- A late evidence response whose source `planId` is no longer current is
  discarded by the controller even when the HTTP envelope is valid.

## HTTP boundary

- Request-body maximum: 16,384 UTF-8 bytes before JSON parsing.
- Every response: JSON UTF-8, `Cache-Control: no-store`, and
  `X-Correlation-Id` matching `meta.correlationId`.
- Methods not declared by the route return 405; unsupported media type returns
  415; oversized requests return 413.
- 200: successful data or expected domain failures `NO_VALID_PLAN` and
  `NO_REPLACEMENT` in normalized envelopes.
- 400: invalid JSON, schema, semantic date/time, or schema version.
- 404: `PLACE_NOT_FOUND`.
- 409: `AREA_NOT_ACTIVE`, `STALE_DATA_PACK`, or `STALE_PLAN`.
- 499: `CANCELLED` where supported by the runtime boundary.
- 500: sanitized `INTERNAL_ERROR`; Google errors never create a raw 500.
- CORS and fixed-origin behavior remain the Hub policy. No v3 endpoint accepts
  user-provided URLs or hosts.

## Google gateway contract

The gateway is an internal server interface, not a public route:

```ts
type GooglePlacesGatewayV3 = {
  enrichRestaurant(input: {
    googlePlaceId: string;
    plannedStartsAt: string;
    plannedEndsAt: string;
    signal: AbortSignal;
  }): Promise<
    | { ok: true; signal: GooglePlaceSignalV3 }
    | {
        ok: false;
        reason:
          | "DISABLED"
          | "TIMEOUT"
          | "UPSTREAM_ERROR"
          | "INVALID_RESPONSE"
          | "ID_MISMATCH"
          | "ATTRIBUTION_INVALID"
          | "UNSUPPORTED_CURRENCY";
      }
  >;
};
```

The production implementation permits only IDs present in the resolved reviewed
pack, fixes the host/path/field mask, makes no retry, and performs request-local
deduplication only. The result is normalized before leaving the adapter; raw
data and headers are discarded and never logged. `UNSUPPORTED_CURRENCY` omits
only the price range when the rest of the response is independently valid;
otherwise it degrades the full signal to unknown. An omitted response
`attributions` field normalizes to an empty array; malformed returned provider
attribution prevents all Google content from display. The UI's separate Google
Maps attribution is mandatory in either case.

## Exactly five top-level Site Tools

The planner registers exactly these names. `untrustedContentHint: true` applies
to all five. `find`, `showEvidence`, `swap`, `save`, and `deleteSaved` are the
only controller actions and are shared with visible UI.

### `find_evening_plan`

```ts
type FindEveningPlanToolInputV3 = PlannerIntentV3;
type FindEveningPlanToolOutputV3 = PlannerEnvelopeV3<SearchPlansDataV3>;
```

- `readOnlyHint: true`.
- Projects the exact normalized area, party, date/time, custom budget, meal
  setting, preset, walking cap, and exclusions into the visible form and URL.
- Replaces visible state only after exact output validation and current-operation
  checks. Does not save, reserve, navigate externally, or claim availability.

### `show_place_evidence`

```ts
type ShowPlaceEvidenceToolInputV3 = {
  schemaVersion: "3";
  area: PlannerAreaV3;
  candidateSetId: string;
  planId: string;
  placeId: string;
};

type ShowPlaceEvidenceToolOutputV3 = PlannerEnvelopeV3<PlaceEvidenceDataV3>;
```

- `readOnlyHint: true`.
- Accepts only a place in the current plan and opens the same `Sources & hours`
  disclosure after validating official/Google separation.
- The controller, not the tool input, supplies the current stop's `startsAt` and
  `endsAt` to the evidence request; stale or mismatched intervals fail closed.
- Never opens an official or Google Maps URL automatically.

### `swap_plan_stop`

```ts
type SwapPlanStopToolInputV3 = {
  schemaVersion: "3";
  candidateSetId: string;
  planId: string;
  targetPlaceId: string;
  preference: SwapPreferenceV3;
};

type SwapPlanStopToolOutputV3 = PlannerEnvelopeV3<SwapPlanDataV3>;
```

- `readOnlyHint: true`; it changes only the reversible local plan preview.
- Resolves the target from current state and uses the same operation as the
  `Change this stop` dialog.
- A success focuses the changed stop. Failure retains current focus/plan and
  exposes a recovery message.

### `save_plan`

```ts
type SavePlanToolInputV3 = {
  schemaVersion: "3";
  candidateSetId: string;
  planId: string;
};

type SavePlanDataV3 = {
  savedPlanId: string;
  savedAt: string;
  status: "SAVED" | "ALREADY_SAVED";
};
```

- `readOnlyHint: false`.
- Saves only the exact sanitized `SavedPlanRecordV3`; no fetch or server write.
- Duplicate save is a successful idempotent `ALREADY_SAVED` result and does not
  reorder or duplicate the record.
- Success uses `aria-live` and does not scroll.

### `delete_saved_plan`

```ts
type DeleteSavedPlanToolInputV3 = {
  schemaVersion: "3";
  planId: string;
};

type DeleteSavedPlanDataV3 = {
  savedPlanId: string;
  deleted: boolean;
};
```

- `readOnlyHint: false`.
- Delete is idempotent; absent records return `deleted: false`.
- Visible UI requires a confirmation dialog; the Site Tool call is itself an
  explicit mutation request and does not add a second modal-only tool.
- A failed write leaves prior storage bytes intact.

## Registration, state, and concurrency

- Tools register on `/v3/plan` and promoted `/plan`, not either landing page.
- The inventory is exactly `5 -> 0 -> 5` across planner -> landing -> planner.
- Registration is all-or-none for synchronous throws and asynchronous rejects;
  every earlier handle is disposed on failure and every handle is disposed on
  unmount/Strict Mode remount.
- Connection copy stays `Manual controls` until all five registrations resolve;
  only then may it say `Agent tools connected`.
- A single shared operation lock covers search, swap, save, and delete. A
  concurrent action returns `CANCELLED` before network or storage mutation.
- Evidence is independently abortable but carries operation epoch, source
  plan ID, and place membership; late results cannot enter a replacement plan
  or its saved snapshot.
- A new search may keep the old plan visible while pending, but only an exact
  current success replaces it. Search/no-result/error and swap failure never
  leave a half-projected intent or Google signal.

## URL, external links, and storage boundary

- Allowlisted query keys are `area,party,date,start,end,budget,meal,interest,
walk,exclude,auto`; unknown keys are ignored and never enter tool inputs.
- External official/Google Maps links require HTTPS, pre-reviewed origins or a
  validated Google URI, `target="_blank"`, and `rel="noopener noreferrer"`.
- Link activation is always a user gesture and never a Site Tool.
- Storage key is `serendipity.saved-itineraries.v3`; v2 storage is not read,
  mutated, or migrated.
- The storage validator rejects the transient Google signal keys even if their
  values appear schema-safe. Only `googlePlaceIds` from the current reviewed
  stops may persist.
