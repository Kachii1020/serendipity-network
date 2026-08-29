# Test Matrix: Source-backed evening planner

No v1 expectation may be deleted, skipped, or loosened. Evidence records commit,
pack version, clock, browser, viewport, deployment ID, and local/preview/
production scope.

## Contract and source-pack gates

| ID          | Scenario                                                                                             | Expected                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| V2-CTR-001  | Canonical `schemaVersion: "2"` intent                                                                | Passes with Shibuya, solo, AUTO, +09:00, 2–10h, date 0–7d |
| V2-CTR-002  | Missing/extra field or schema 1/3                                                                    | Safe validation/version failure; engine 0 calls           |
| V2-CTR-003  | Cross-date, wrong offset, reversed time, <2h/>10h, before 12:00, after 23:30, past/>7d               | Rejected                                                  |
| V2-CTR-004  | Budget outside 0–30k, walk outside 5–30, overlapping/invalid tags                                    | Rejected                                                  |
| V2-CTR-005  | Impossible Gregorian date in intent, pack, source, evidence, envelope, tool output, or snapshot      | Rejected rather than normalized by JavaScript             |
| V2-PACK-001 | Pack absent or invalid JSON                                                                          | Static audit and runtime loader fail closed               |
| V2-PACK-002 | Duplicate place/source ID or orphan evidence source reference                                        | Rejected                                                  |
| V2-PACK-003 | HTTP/userinfo source, license, or official URL                                                       | Rejected                                                  |
| V2-PACK-004 | Identity/address/coordinates/hours/price cites `OFFICIAL_LINK_ONLY`                                  | Rejected                                                  |
| V2-PACK-005 | Explicit permission has no matching permission evidence Markdown                                     | Audit fails                                               |
| V2-PACK-006 | Any `UNKNOWN`, travelEdges, capacity, inventory, hold, reservation, or discount field                | Rejected                                                  |
| V2-PACK-007 | FREE not 0..0, EXACT unequal, RANGE unordered/equal                                                  | Rejected                                                  |
| V2-PACK-008 | Weekly/exception hours reverse or cross midnight                                                     | Rejected                                                  |
| V2-PACK-009 | ODbL source without ODbL pack license/attribution                                                    | Audit fails                                               |
| V2-PACK-010 | ACTIVE has <9 routable places, <3 categories, or source check >7d at generatedAt                     | Rejected                                                  |
| V2-PACK-011 | Official URL evidence is not same-origin `OFFICIAL_SITE`                                             | Audit fails                                               |
| V2-PACK-012 | Declared source unused or checked after generatedAt                                                  | Rejected                                                  |
| V2-PACK-013 | Address and coordinate claims reuse one unsupported source                                           | Rejected                                                  |
| V2-PACK-014 | OFFICIAL_FACT_REFERENCE scope omits the cited fact                                                   | Rejected                                                  |
| V2-PACK-015 | Inferred 00:00–23:59 or planner-zero marked routable                                                 | Rejected                                                  |
| V2-PACK-016 | validThrough exceeds 60 Tokyo dates, outlives a 60-day hours/price source, or uses another offset    | Rejected                                                  |
| V2-PACK-017 | Calendar source is non-official/non-HOURS; exception date is duplicate or outside horizon            | Rejected                                                  |
| V2-PACK-018 | Pack value, source metadata/usage, calendar source, station, or root data-license drifts from review | Audit and engine reject as unreviewed/stale               |

## Composition and swap

| ID          | Scenario                                           | Expected                                                                 |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| V2-ENG-001  | Canonical evening intent                           | One stable 3-stop plan when feasible                                     |
| V2-ENG-002  | No feasible 3-stop, feasible 2-stop                | One honest 2-stop plan                                                   |
| V2-ENG-003  | No feasible 2/3-stop route                         | `NO_VALID_PLAN`; no invented fallback                                    |
| V2-ENG-004  | Shibuya Station→first and place→place distances    | Haversine ×1.25 ÷75m/min, rounded up to next 5 minutes                   |
| V2-ENG-005  | Estimated leg exceeds requested cap                | Route rejected; estimate not clamped                                     |
| V2-ENG-006  | Arrival precedes opening                           | Start waits for opening; times remain exact                              |
| V2-ENG-007  | Closing or intent end overrun                      | Route rejected                                                           |
| V2-ENG-008  | Sum of maxYen exceeds budget                       | Route rejected even when minYen fits                                     |
| V2-ENG-009  | Alcohol/smoking/outdoors excluded                  | Matching tagged place absent                                             |
| V2-ENG-010  | FREE/EXACT/RANGE mix                               | Exact summed min/max and labels returned                                 |
| V2-ENG-011  | Newest hours/price evidence >14d and <=60d         | Route may remain with stale warning                                      |
| V2-ENG-012  | Newest hours/price evidence >60d                   | Place excluded; `STALE_DATA_PACK` if no route remains                    |
| V2-ENG-013  | Equal score                                        | Walk, max total, end, stable plan-ID tie-break deterministic             |
| V2-ENG-014  | 30-place upper-bound pack                          | Composition p95 <=100ms; envelope <=65,536 bytes                         |
| V2-ENG-015  | Opening wait >30 minutes or route has one category | Route rejected                                                           |
| V2-ENG-016  | Stop ends <10 minutes before published closing     | Route rejected                                                           |
| V2-ENG-017  | Intent ends after pack validThrough                | `STALE_DATA_PACK`; no route                                              |
| V2-SWAP-001 | CHEAPER replacement                                | Exactly target place changes; max total decreases                        |
| V2-SWAP-002 | LESS_WALKING replacement                           | Exactly target place changes; walking decreases                          |
| V2-SWAP-003 | DIFFERENT_INTEREST replacement                     | Exactly target place changes to a different compatible interest/category |
| V2-SWAP-004 | No feasible replacement                            | `NO_REPLACEMENT`; current plan retained                                  |
| V2-SWAP-005 | Stale candidate/plan or target not current         | `STALE_PLAN`/validation failure; current plan retained                   |
| V2-SWAP-006 | Replacement has a different soft-stale source set  | Response returns its warnings; UI replaces removed-place warnings        |

## API and Site Tools

| ID          | Scenario                                   | Expected                                                                       |
| ----------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| V2-API-001  | Valid `POST /api/v2/plans/search`          | 200 v2 envelope with exactly one plan and packVersion meta                     |
| V2-API-002  | Valid `POST /api/v2/plans/swap`            | 200 v2 envelope; one replaced index and recomputed plan                        |
| V2-API-003  | Valid `GET /api/v2/places/{id}/evidence`   | Only that place's public source records                                        |
| V2-API-004  | Invalid JSON or >16KiB body                | 400; execute 0 calls                                                           |
| V2-API-005  | Search/swap/evidence dependency spies      | Provider, Supabase, scraping, external fetch calls remain 0                    |
| V2-API-006  | Domain and stale errors                    | NO_VALID_PLAN/NO_REPLACEMENT 200; PLACE_NOT_FOUND 404; stale 409               |
| V2-API-007  | Safe-shaped but malformed/poisoned success | Exact action validator rejects it; visible plan/evidence remains unchanged     |
| V2-TOOL-001 | Top-level registration                     | Exactly five approved names; v1 tools absent                                   |
| V2-TOOL-002 | Tool annotations                           | find/evidence/swap read-only; save/delete local mutation; all untrusted        |
| V2-TOOL-003 | Strict Mode remount                        | No duplicates; all registrations disposed                                      |
| V2-TOOL-004 | find/evidence/swap                         | Same actions and visible state as matching UI controls                         |
| V2-TOOL-005 | Tool stale/extra/invalid refs              | Fails before action; no state change                                           |
| V2-TOOL-006 | Concurrent/aborted/late action             | CANCELLED or discarded; duplicate storage/network mutation 0                   |
| V2-TOOL-007 | Malformed/private/oversized action output  | Replaced by safe INTERNAL_ERROR                                                |
| V2-TOOL-008 | Public payload scan                        | No secret, raw HTML, permission file, source pack, stack, or >64KiB output     |
| V2-TOOL-009 | Third registration throws/rejects          | Earlier handles disposed; connected claim remains false                        |
| V2-TOOL-010 | Exact error/payload safety boundary        | Extra error keys, credential keys, markup, cycles, or ref mismatch fail closed |

## Concurrency and projection races

| ID          | Scenario                                              | Expected                                                                    |
| ----------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| V2-RACE-001 | Evidence for plan A finishes after plan B swap/search | Late result discarded; plan B and its saved snapshot contain no A evidence  |
| V2-RACE-002 | Swap fails while evidence is in flight                | Stable plan retained; obsolete disclosure/loading state is closed           |
| V2-REC-001  | A planned re-search is cancelled or finds no result   | Previous verified plan/evidence/warnings remain; 320px alert is in viewport |
| V2-LOCK-001 | Save is pending while manual/tool mutation is invoked | Other search/swap/save is CANCELLED; exactly one storage mutation           |

## Local storage

| ID         | Scenario                                                     | Expected                                                                          |
| ---------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| V2-STO-001 | Save then reload                                             | Immutable plan+evidence snapshot rehydrates from v2 key                           |
| V2-STO-002 | Save same plan twice                                         | ALREADY_SAVED; one unchanged record                                               |
| V2-STO-003 | Save eleventh distinct plan                                  | STORAGE_LIMIT_REACHED; ten prior records unchanged                                |
| V2-STO-004 | Serialized document >256KiB or quota/security exception      | Storage failure; previous bytes unchanged                                         |
| V2-STO-005 | Corrupt JSON/schema                                          | Corruption reported; data not silently cleared/overwritten                        |
| V2-STO-006 | Delete existing ID                                           | Only that snapshot removed; DELETED                                               |
| V2-STO-007 | Delete absent ID                                             | Successful idempotent NOT_FOUND; bytes unchanged                                  |
| V2-STO-008 | Public snapshot scan                                         | No PII, cookie, token, correlation ID, raw source, or permission evidence         |
| V2-STO-009 | Readable document mixes valid and malformed/poisoned records | Keep valid records; repair only on explicit mutation; clear warning after success |

## Product clarity, accessibility, and visual quality

| ID        | Scenario                                   | Expected                                                                                           |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| V2-UX-001 | Five-second first viewport                 | User can name problem, inputs, output, Shibuya/solo, and no-booking boundary                       |
| V2-UX-002 | First result                               | Real names, summaries, times, min–max total, estimated walks, and evidence cues visible            |
| V2-UX-003 | Evidence disclosure                        | Publisher, checked date, license/permission, source and official links understood                  |
| V2-UX-004 | Browser without Site Tools                 | Compact neutral status; planner remains complete and unblocked                                     |
| V2-UX-005 | 320×568 and mobile landscape               | No document/internal clipping or unreachable CTA/evidence                                          |
| V2-UX-006 | 200% text and 400% zoom                    | Logical order, one-axis scroll, readable and operable controls                                     |
| V2-UX-007 | Keyboard search/evidence/swap/save/delete  | Visible focus and result-summary focus after change                                                |
| V2-UX-008 | Axe states                                 | idle/searching/planned/evidence/swapping/saved/no-result/error have no serious/critical violations |
| V2-UX-009 | Official link                              | HTTPS, labelled external, noopener/noreferrer; tool never auto-opens                               |
| V2-UX-010 | Claim scan                                 | No live availability, reservation, discount, sponsorship, or guarantee language                    |
| V2-UX-011 | Evidence backed by holiday/daily calendar  | Visible `Schedule calendar` source with publisher, checked date, and link                          |
| V2-UX-012 | Search or swap returns soft-stale warnings | Visible recheck guidance matches only the current plan                                             |

## Promotion fixtures

Fixture dates are generated within the next seven Tokyo dates. Expected place
IDs are frozen only after the audited pack is final.

| ID         | Window / constraints                                                          | Purpose               |
| ---------- | ----------------------------------------------------------------------------- | --------------------- |
| V2-FIX-001 | Weekday 13:00–18:00, ¥5,000, art/books/quiet, no alcohol/smoking, 20-min legs | Afternoon route       |
| V2-FIX-002 | Weekday 17:00–22:00, same constraints                                         | Weekday-evening route |
| V2-FIX-003 | Weekend 17:00–22:00, same constraints                                         | Weekend-evening route |

## Regression, deployment, and rollback

| ID         | Scenario                                           | Expected                                                                |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| V2-REG-001 | `pnpm check` and 8/8 build                         | v1 and v2 pass without weakened tests                                   |
| V2-REG-002 | Existing phase0 Chrome/security/reliability suites | No v1 regression                                                        |
| V2-REG-003 | Current pack 1.3.0 closure batch                   | Fresh contract/data/engine/tool/storage/race/browser gate on one commit |
| V2-DEP-001 | Hub preview exact journey                          | find → evidence → swap → save → delete succeeds 3/3                     |
| V2-DEP-002 | Five cold synthetic goals                          | Completion and source/no-booking understanding >=4/5                    |
| V2-DEP-003 | Production read-only reliability                   | 20/20, search p95 <=3s, external mutations 0                            |
| V2-DEP-004 | Production source/link audit                       | All displayed claims resolve; no 404/410 official link                  |
| V2-RBK-001 | Baseline                                           | Tag resolves to `f786b68...`; source SHA equals `42aaa7c...d02fc`       |
| V2-RBK-002 | Promote prior Hub                                  | Recorded v1 `/`, `/plan`, and read-only search return                   |

## Release-candidate regression evidence

The rows below identify the automated evidence implemented for the pack 1.3.0
closure batch. Focused and browser gates are recorded independently from the
still-pending final post-documentation `pnpm check`; prior production results
are not substituted for any current-candidate result.

| Matrix IDs                               | Automated evidence                                                                | Current execution status                |
| ---------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| V2-CTR-005                               | `packages/contracts/src/planner-v2.test.ts`; query, API, tool, and storage tests  | PASS in focused current-candidate gates |
| V2-PACK-018                              | Contract reviewed-snapshot mutations, source-audit mutations, engine review input | PASS in focused current-candidate gates |
| V2-SWAP-006, V2-UX-012                   | Bundle warning fixture; planner reducer warning replacement; visible warning UI   | PASS in focused current-candidate gates |
| V2-API-007, V2-TOOL-010                  | Exact search/evidence/swap output validators and public-safety regressions        | PASS in focused current-candidate gates |
| V2-TOOL-009                              | Third-registration failure rollback test                                          | PASS in focused current-candidate gates |
| V2-RACE-001–002, V2-REC-001, V2-LOCK-001 | Reducer plan-ID guard and `tests/e2e/planner-v2.spec.ts` race/recovery/lock cases | PASS in focused/browser gates           |
| V2-STO-009                               | Mixed-validity, poison, impossible-date, dedupe, and repair storage tests         | PASS in focused current-candidate gates |
| V2-UX-011                                | Component rendering and human/Site Tool browser evidence assertions               | PASS in focused/browser gates           |

## Current release-candidate execution ledger

| Gate                                   | Exact candidate evidence required                          | Status                                   |
| -------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Pack identity                          | 1.3.0; 9 routable places; 18 sources; valid through Oct 28 | PRESENT in source and reviewed ledger    |
| Focused contracts/data/engine/API/UI   | `pnpm test:v2` and source-audit regressions                | PASS — 135/135; audit 11/11 + standalone |
| Unit regression/build                  | Unit suite; 8/8 `pnpm build`                               | PASS — 342/342; build 8/8                |
| Browser/a11y/security                  | Current local exact paths                                  | PASS — 12/12; 9/9; 56 assets + 5/5       |
| Final post-documentation regression    | `pnpm check`                                               | PASS; T208 complete                      |
| Preview exact five-tool path           | Fresh supported-client contexts 3/3                        | PENDING                                  |
| Production read-only reliability       | Current deployment 20/20, p95 ≤3s, external mutation 0     | PENDING                                  |
| Supported-client production Site Tools | Exact inventory and path                                   | PENDING                                  |

Production promotion is blocked until all required rows pass. A source-rights
failure cannot be waived by copy or a demo disclaimer; remove the place or keep
the pack CANDIDATE.
