# Implementation Plan: Source-backed evening planner

**Spec**: [spec.md](spec.md)
**Contract**: [contracts/planner-v2.md](contracts/planner-v2.md)
**Data model**: [data-model.md](data-model.md)

## Summary

Build v2 beside the verified reservation demo. Reuse the monorepo, JSON Schema
validation, safe envelopes, deterministic composition patterns, shared WebMCP
registration, UI primitives, accessibility suite, and Vercel deployment. Do not
extend v1 Provider/Slot/hold semantics. The new primary route reads one validated
static Shibuya pack, returns one source-backed plan, supports a feasible one-stop
swap, and saves immutable snapshots locally.

## Gate 0 baseline and rollback

Gate 0 is complete and MUST remain recoverable throughout implementation.

- Baseline commit: `f786b68429967b2fee3fe2dc5de8bd37220153ac`
- Baseline tag: `v1-production-2026-08-29`
- v2 branch: `feat/v2-source-backed-planner`
- Source archive checksum:
  `42aaa7c1e87fdadb00f8a4f467149700f8fd2dcf99ed45c649aa01fe3a7d02fc`
  for `work/v1-source-2026-08-29.tar.gz`
- Rollback deployment IDs:
  - Hub: `dpl_J1mVSFuwhxwVfam9gHyiucMMwwZU`
  - Kiln: `dpl_Ab3ghGoJGcs58Be3nwHioqAMd9Ez`
  - Nori: `dpl_35nwh5uiMXFEH8KLUueVa8MMnn58`
  - Loop: `dpl_9h5DmnVhJA3G3pDV9FRWx7JVQpGR`

Rollback means promote the listed Hub deployment or deploy the baseline tag,
leave the three Provider deployments unchanged, and verify `/`, `/plan`, and the
read-only v1 search. No production database reset or migration reversal is
required by v2.

## Architecture and reuse

### Contracts

- Keep `SCHEMA_VERSION = "1"`, `Provider`, `Slot`, `BundleSummary`,
  `AreaDataPack`, and all reservation envelopes unchanged.
- Add a separate `PLANNER_SCHEMA_VERSION = "2"`, planner schemas/types,
  validators, error enum, and result envelope in the contracts package.
- Reuse `assertPublicPayloadSafe`, the 65,536-byte result limit, correlation
  metadata shape, timestamp/ID patterns, and Ajv's fail-closed validation style.
- Add new schemas rather than adding required fields to any v1 schema.

### Data and composition

- Store the sole runtime pack at
  `apps/hub/data/shibuya.places.v2.json`; import it at build/server startup.
- Add v2 composition beside the current bundle engine. Preserve
  `composeBundles` and its tests. The new pure functions are
  `composeItinerariesV2` and `swapPlanStopV2`.
- Resolve each place's identity/location/hours/price/official-link source
  references into the
  bounded `PlaceEvidenceV2` projection before serialization. Never return raw
  HTML, permission evidence, or the complete pack.
- Runtime composition is local and deterministic; it performs no network or
  database access.

### Hub/API and client state

- Add `POST /api/v2/plans/search`, `POST /api/v2/plans/swap`, and
  `GET /api/v2/places/{placeId}/evidence`. Search validates a v2 intent, loads
  the ACTIVE pack, injects the clock, and returns a v2 envelope with one plan.
- Keep the candidate pool in the client action controller, keyed by a
  deterministic `candidateSetId`. Do not persist a server session.
- The approved Site Tools are exactly `find_evening_plan`,
  `show_place_evidence`, `swap_plan_stop`, `save_plan`, and
  `delete_saved_plan`. Search/evidence/swap are read-only with respect to the
  outside world; save/delete are explicit local mutations. Every tool has
  `untrustedContentHint: true`.
- Tool callbacks and visible controls call the same controller. Tool activity
  records transport, duration, result, and correlation ID without pretending a
  manual click was a Site Tool call.

### Local save

- Use `serendipity.saved-itineraries.v2`; never reuse the v1 compensation
  session key.
- Store at most ten validated immutable snapshots and at most 256 KiB. Saving
  the same plan is an idempotent `ALREADY_SAVED`; the eleventh distinct plan
  returns `STORAGE_LIMIT_REACHED` and never evicts existing data.
- Quota/unavailable failures leave the previous value intact. Corrupt storage
  is not automatically deleted; the UI offers an explicit clear/delete path.
- A saved plan from an older pack remains a read-only snapshot and displays a
  recheck warning and its official links.

## Data flow

```text
UI or Site Tool intent
  -> shared action controller
  -> POST /api/v2/plans/search
  -> v2 intent validator
  -> ACTIVE pack loader + source/freshness validation
  -> composeItinerariesV2(intent, pack, injected clock)
  -> one public itinerary + candidateSetId
  -> safe v2 envelope (<= 65,536 bytes)
  -> same visible result state

Evidence
  -> current itinerary/place guard
  -> resolved public citations only

Swap
  -> current candidateSet/plan/targetPlace guard
  -> POST /api/v2/plans/swap with current intent and resolved stopIndex
  -> replace one place, recompute complete schedule and price range
  -> update visible result only after feasibility succeeds

Save/delete
  -> validate current itinerary or saved-plan ID
  -> localStorage transaction
  -> no fetch, cookie, Supabase, Provider, or navigation
```

## Feasibility and ranking

1. Reject hard-stale or improperly licensed hours/price claims.
2. Resolve the requested Tokyo weekday and date exception.
3. Filter tags and exclusions before enumerating routes.
4. Enumerate unique ordered 3-place permutations; for `AUTO`, enumerate two
   places only if no 3-place route is feasible.
5. Start at Shibuya Station at `startAt`. Derive each walking estimate as
   `ceil((haversineMetres × 1.25 / 75) / 5) × 5`, wait at most 30 minutes for
   opening, and add the configured recommended visit duration.
6. Reject a route with fewer than two categories or one exceeding a closing
   time, `endAt`, maximum walking leg, or the budget using the conservative sum
   of each stop's `maxYen`.
7. Score interest fit 40%, walking efficiency 25%, time use 20%, and category
   variety 15%. Price is a hard constraint rather than a hidden preference.
8. Sort by score descending, walking ascending, maximum reference total
   ascending, end ascending, then stable plan ID.

Swap preserves the other place IDs and recomputes the entire route. `CHEAPER`
sorts first by lower maximum reference total, `LESS_WALKING` by total walking,
and `DIFFERENT_INTEREST` by a different compatible tag/category. A replacement
is committed only if all original constraints still pass.

## Source, freshness, and licensing gates

- Run `node scripts/audit-v2-sources.mjs` before build and deployment. A missing
  pack, missing evidence, non-HTTPS source, unlicensed factual claim,
  `UNKNOWN` placeholder, invalid reference amount, or missing permission record
  fails closed.
- First-party official pages marked `OFFICIAL_LINK_ONLY` are links only.
- ACTIVE promotion requires every source check to be within seven days of
  `generatedAt`. At runtime, the newest referenced hours/price source becomes
  soft-stale after 14 days and hard-stale after 60 days. Soft-stale data gets a
  warning; hard-stale places are excluded and may yield `STALE_DATA_PACK`.
- Render all unique attribution text in the result and footer. An OSM-derived
  pack requires `ODbL-1.0` as the pack database license and visible
  `© OpenStreetMap contributors` credit.
- No unlicensed media is in the first release. The UI uses typography, color,
  shape, and original copy rather than venue imagery.

## Failure and recovery behavior

| Condition                              | Public result                                                     | HTTP / state behavior                        |
| -------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| Invalid shape/version                  | `VALIDATION_ERROR` or `UNSUPPORTED_SCHEMA_VERSION`                | 400; zero engine work                        |
| Date outside the 7-day/same-day window | `VALIDATION_ERROR`                                                | 400; retain input                            |
| No feasible 2- or 3-stop route         | `NO_VALID_PLAN`                                                   | 200 domain failure; suggest time/budget/walk |
| Hard-stale claims caused the loss      | `STALE_DATA_PACK`                                                 | 409; no invented fallback                    |
| Pack absent/invalid/rights audit fails | fail build/startup; safe `INTERNAL_ERROR` if unexpectedly reached | no sample fallback                           |
| Stale plan/candidate set               | `STALE_PLAN`                                                      | 409; no state change                         |
| Unknown evidence place                 | `PLACE_NOT_FOUND`                                                 | 404; no disclosure change                    |
| No single-stop replacement             | `NO_REPLACEMENT`                                                  | 200; keep existing plan visible              |
| Ten-plan/256 KiB local limit           | `STORAGE_LIMIT_REACHED`                                           | keep plan and prior storage                  |
| Blocked browser storage                | `STORAGE_UNAVAILABLE`                                             | preserve bytes; expose recovery copy         |
| Corrupt browser storage                | `STORAGE_CORRUPT`                                                 | preserve bytes; require explicit recovery    |
| Cancellation                           | `CANCELLED`                                                       | keep last stable state                       |
| Unexpected exception                   | `INTERNAL_ERROR`                                                  | safe message, no stack/source payload        |

Expected no-result and swap failures preserve the user's input and current plan
where one exists. External links are returned/rendered but never opened by a
tool automatically.

## Rollout

1. Complete Gate 0 and keep production unchanged.
2. Land v2 schemas and failing contract/engine/storage tests.
3. Produce a CANDIDATE pack, run static rights/link/freshness audits, and prove
   one canonical route locally.
4. Finish search, evidence, swap, save/delete, and first-viewport UI behind the
   v2 branch.
5. Deploy a Hub preview only. Provider deployments and Supabase remain untouched.
6. Pass contract, engine, tool, accessibility, visual, security, pack, and exact
   preview-path gates.
7. Promote the pack to ACTIVE only after nine places, three categories, three
   promotion fixtures, attribution, and source audits pass.
8. Promote Hub production, then replay 20 read-only journeys. A failure restores
   the baseline Hub deployment; no database action is necessary.

## Decisions and rejected alternatives

| Decision             | Choice                        | Reason                                                    | Rejected alternative                            |
| -------------------- | ----------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| Compatibility        | Parallel v2 schemas and route | Avoids changing Provider/DB assumptions spread through v1 | Change global schema version                    |
| Runtime data         | Versioned static pack         | Deterministic, fast, authorized, reliable                 | Runtime scraping or third-party API fan-out     |
| Persistence          | localStorage snapshots        | Meets user goal without auth/data migration               | Supabase saved-plan tables                      |
| Booking              | Official links only           | Truthful with available authority                         | Rebrand demo holds as real reservation          |
| Search output        | One selected plan             | Clear first-use outcome                                   | Expose a dense marketplace grid                 |
| Adjustment           | One-position constrained swap | Useful and bounded                                        | General free-form itinerary editor              |
| Data imagery         | None initially                | Removes copyright and latency risk                        | Scraped venue photos/logos                      |
| Historical artifacts | New specification 002         | Preserves evidence and rollback truth                     | Rewrite specification 001 as if v2 was original |
