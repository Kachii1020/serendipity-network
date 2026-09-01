# Test Matrix: Tokyo three-hub meal planner

**Status**: Planned. No row below is current implementation evidence.
**Rule**: Tests may add coverage but may not delete v1/v2 expectations, widen
tolerances, mock away an external boundary in release evidence, or claim a
preview/production result from a different commit or deployment.

## Contract and semantic validation

| ID         | Scenario                                                                                                  | Expected                                                             | Requirements   |
| ---------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------- |
| V3-CTR-001 | Exact valid intents for three areas, parties 1–3, meal on/off, six presets, custom budget/walk/exclusions | Accepted and normalized without hidden defaults                      | FR-301–FR-304  |
| V3-CTR-002 | Extra/missing keys, wrong schema, area, party, enum, types, ranges                                        | `VALIDATION_ERROR` or `UNSUPPORTED_SCHEMA_VERSION`; no state/network | FR-301, FR-327 |
| V3-CTR-003 | Impossible dates, non-JST, cross-date, past/out-of-horizon, <2h/>10h, before 12:00/after 23:30            | Rejected before runtime                                              | FR-301, FR-327 |
| V3-CTR-004 | `FOOD_DISCOVERY` with meal off                                                                            | Exact `VALIDATION_ERROR`; current plan retained                      | FR-303         |
| V3-CTR-005 | Exclusion duplication, unknown tag, conflict with required preset match                                   | Invalid or honest `NO_VALID_PLAN`; no hidden relaxation              | FR-301, FR-303 |
| V3-CTR-006 | Every success/failure data shape gets extra/missing/poison/cycle/oversize fields                          | Dedicated validator fails closed                                     | FR-327         |
| V3-CTR-007 | Correlation/meta exactness, strict timestamps, response size                                              | Header/meta match; <=64KiB; safe payload                             | FR-327         |
| V3-CTR-008 | URL roundtrip including custom tool values and `auto=1`                                                   | Form, URL, API intent, and tool input are identical                  | FR-302, FR-325 |

## Area packs, source rights, and reviewed ledgers

| ID          | Scenario                                                                                   | Expected                                                                     | Requirements          |
| ----------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------- |
| V3-DATA-001 | Shibuya ACTIVE pack                                                                        | >=4 activities, >=3 meals, >=2 activity categories, station, fixtures        | FR-304, FR-310–FR-312 |
| V3-DATA-002 | Shinjuku ACTIVE pack                                                                       | Same minimums and independently reviewed version                             | FR-304, FR-310–FR-312 |
| V3-DATA-003 | Ikebukuro ACTIVE pack                                                                      | Same minimums and independently reviewed version                             | FR-304, FR-310–FR-312 |
| V3-DATA-004 | Restaurant identity/address/coordinates/hours/menu/price/access/link fields                | Every field resolves to permitted source scope; place ID pre-reviewed        | FR-309–FR-312         |
| V3-DATA-005 | Activity evidence and self-authored summary                                                | Complete source linkage; copied description/photo/logo 0                     | FR-311–FR-313         |
| V3-DATA-006 | FREE/EXACT/RANGE and per-person/JPY semantic mutations                                     | Invalid bounds, currency, unit, or unknown price rejected                    | FR-308–FR-312         |
| V3-DATA-007 | Pack/review drift across facts, source metadata/usage, station, presets, fixtures, license | `STALE_DATA_PACK` before composition/Google                                  | FR-310–FR-312         |
| V3-DATA-008 | generatedAt/validThrough/source/evidence/exception malformed or impossible dates           | Pack invalid; no JavaScript normalization                                    | FR-312, FR-327        |
| V3-DATA-009 | Source age at 7/14/60-day boundaries                                                       | Promotion reject, warning, and exclusion occur exactly                       | FR-312                |
| V3-DATA-010 | Calendar exceptions and pack horizon                                                       | Fixture respects closures; request beyond horizon fails                      | FR-306, FR-312        |
| V3-DATA-011 | `supportedInterestPresets` and fixtures                                                    | `SURPRISE` + >=4 themed; exact union shown by UI; each listed fixture passes | FR-304, FR-310        |
| V3-SRC-001  | Repository/source/payload scan for Tabelog domains/names and copied content                | Zero v3 matches except this specification's prohibition text                 | FR-313                |
| V3-SRC-002  | Live release source/menu/official URLs                                                     | 200–399; HTTPS; official origins; no redirect to disallowed source           | FR-309–FR-313         |
| V3-SRC-003  | Place names, addresses, times, prices, public access, links visible in UI                  | Claim-to-source linkage 100%; UNKNOWN rights 0                               | FR-311–FR-313         |

## Canonical area, party, and meal matrix

Each ACTIVE pack declares version-bound `canonicalMealFixture` and
`canonicalActivityFixture` intents with a real date inside its audited horizon.
The test replaces only `partySize` and uses the fixture's budget/time/preset.

| ID         | Area      | Party | Meal | Required grammar/result          |
| ---------- | --------- | ----: | ---- | -------------------------------- |
| V3-FIX-001 | Shibuya   |     1 | on   | `A,M,A` or `A,M` valid plan      |
| V3-FIX-002 | Shibuya   |     3 | on   | Same per-person bounds; group x3 |
| V3-FIX-003 | Shibuya   |     1 | off  | `A,A,A` or `A,A` valid plan      |
| V3-FIX-004 | Shibuya   |     3 | off  | Same per-person bounds; group x3 |
| V3-FIX-005 | Shinjuku  |     1 | on   | `A,M,A` or `A,M` valid plan      |
| V3-FIX-006 | Shinjuku  |     3 | on   | Same per-person bounds; group x3 |
| V3-FIX-007 | Shinjuku  |     1 | off  | `A,A,A` or `A,A` valid plan      |
| V3-FIX-008 | Shinjuku  |     3 | off  | Same per-person bounds; group x3 |
| V3-FIX-009 | Ikebukuro |     1 | on   | `A,M,A` or `A,M` valid plan      |
| V3-FIX-010 | Ikebukuro |     3 | on   | Same per-person bounds; group x3 |
| V3-FIX-011 | Ikebukuro |     1 | off  | `A,A,A` or `A,A` valid plan      |
| V3-FIX-012 | Ikebukuro |     3 | off  | Same per-person bounds; group x3 |

These rows verify FR-301–FR-312 and SC-302–SC-304. Production promotion also
requires every visible area/preset fixture; the 12 rows do not substitute for
the preset matrix.

## Engine and swap

| ID           | Scenario                                                     | Expected                                             | Requirements          |
| ------------ | ------------------------------------------------------------ | ---------------------------------------------------- | --------------------- |
| V3-ENG-001   | Three-stop meal grammar feasible                             | Exact `A,M,A`, distinct places, all hard constraints | FR-305–FR-309         |
| V3-ENG-002   | Three-stop meal route fails but two-stop fits                | Exact `A,M`; fallback warning                        | FR-305–FR-306         |
| V3-ENG-003   | Meal off                                                     | Only `A,A,A` then `A,A`; no restaurant               | FR-305                |
| V3-ENG-004   | Time, hours, wait >30m, closing headroom <10m, walk overflow | Candidate excluded, never clamped or relaxed         | FR-306–FR-307         |
| V3-ENG-005   | Official per-person total at budget boundary                 | Sum(max) <= budget accepted; +1 rejected             | FR-308–FR-309         |
| V3-PRICE-001 | Party 1/2/3 with same plan                                   | Per-person unchanged; group exact x1/x2/x3           | FR-308                |
| V3-PRICE-002 | Google priceLevel/priceRange mutated across extremes         | Engine totals, score, IDs, selection unchanged       | FR-308–FR-309, FR-318 |
| V3-ENG-006   | Non-surprise preset with matching and nonmatching routes     | >=1 match required; soft score chooses best feasible | FR-303, FR-318        |
| V3-ENG-007   | `SURPRISE`                                                   | No match required; deterministic quality ranking     | FR-303, FR-318        |
| V3-ENG-008   | Same input repeated and shuffled pack order                  | Identical plan/candidate IDs, route, times, totals   | FR-318                |
| V3-ENG-009   | Tie on score                                                 | Walk -> official max -> end -> plan ID tie-break     | FR-318                |
| V3-ENG-010   | Up to 30 candidates                                          | Pure composition p95 <=100ms in isolated benchmark   | SC-310                |
| V3-SWAP-001  | Meal replacement                                             | Exactly one `MEAL` changes; other IDs retained       | FR-319                |
| V3-SWAP-002  | Activity replacement                                         | Exactly one `ACTIVITY` changes; other IDs retained   | FR-319                |
| V3-SWAP-003  | `CHEAPER`                                                    | Replacement official max is lower; Google ignored    | FR-319                |
| V3-SWAP-004  | Less walking/different interest                              | Whole route recomputed and preference improves       | FR-319                |
| V3-SWAP-005  | No replacement/stale plan/malformed plan                     | Stable plan and warnings retained; exact failure     | FR-319, FR-328        |

## Google Places gateway and policy boundary

| ID         | Scenario                                                                       | Expected                                                       | Requirements          |
| ---------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------- |
| V3-GGL-001 | Feature flag off or key absent                                                 | Zero calls; `DISABLED`; official plan succeeds                 | FR-314, FR-317        |
| V3-GGL-002 | Normal allowlisted response with JPY range                                     | Exact field mask; normalized signal; selected card attribution | FR-314–FR-317         |
| V3-GGL-003 | Three meal IDs including duplicate                                             | <=3 distinct parallel calls; request-local dedupe; retry 0     | FR-314–FR-315         |
| V3-GGL-004 | Unknown/unregistered ID or injected path/host                                  | Rejected before fetch; fixed Google origin                     | FR-314, FR-327        |
| V3-GGL-005 | Timeout at two seconds, 4xx/5xx, quota, invalid JSON/schema                    | Safe degradation warning; official plan succeeds               | FR-317                |
| V3-GGL-006 | Returned ID mismatch                                                           | Signal discarded; no upstream content exposed                  | FR-317                |
| V3-GGL-007 | `CLOSED_PERMANENTLY`, temporary/non-operational, complete planned-time closure | Candidate excluded; next ranked route selected                 | FR-314, FR-318        |
| V3-GGL-008 | Missing/ambiguous opening periods                                              | `UNKNOWN`; official hours retain authority                     | FR-314–FR-317         |
| V3-GGL-009 | Non-JPY/malformed price range                                                  | Price omitted/degraded; official budget unchanged              | FR-308, FR-317        |
| V3-GGL-010 | Omitted attribution list; malformed returned attribution/URI/text              | Omitted list becomes empty; malformed content blocks Google UI | FR-316–FR-317, FR-327 |
| V3-GGL-011 | Response used twice/reload/saved-plan reopen                                   | No cross-request cache; fresh lookup; place ID only persists   | FR-315, FR-324        |
| V3-GGL-012 | Browser attribution at 320/390/desktop and disclosure closed/open              | Same-container, visible, legible `Google Maps` plus providers  | FR-316, SC-308        |
| V3-GGL-013 | Terms/privacy/key restriction/quota/budget release audit                       | All present before flag ON; otherwise release flag OFF         | FR-317, FR-330        |

## REST, Site Tools, races, and storage

| ID          | Scenario                                                                                              | Expected                                                         | Requirements           |
| ----------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| V3-API-001  | Search/swap/evidence happy paths                                                                      | Exact envelope/header/status/size; no-store                      | FR-327                 |
| V3-API-002  | Invalid method/media/JSON/size/path/version or incomplete/mismatched evidence time pair               | 405/415/400/413/404 as specified; safe body                      | FR-327                 |
| V3-API-003  | Area CANDIDATE/stale/review drift                                                                     | 409 normalized failure before Google                             | FR-310–FR-312, FR-327  |
| V3-TOOL-001 | Inventory on planner/landing/planner                                                                  | Exact `5 -> 0 -> 5`; duplicate 0                                 | FR-325–FR-326          |
| V3-TOOL-002 | Each tool input/output happy path                                                                     | Dedicated exact validator and correct annotations                | FR-325, FR-327         |
| V3-TOOL-003 | Registration throws/rejects at positions 1–5                                                          | All prior handles disposed; manual mode                          | FR-326                 |
| V3-TOOL-004 | Strict Mode mount/remount/unmount                                                                     | One live inventory; all stale handles disposed                   | FR-326                 |
| V3-TOOL-005 | Manual and Site Tool find with identical/custom intent                                                | Same URL, form, plan, Google mode, and activity proof            | FR-302, FR-325         |
| V3-TOOL-006 | Tool evidence/swap/save/delete vs visible controls                                                    | Same controller/state/storage outcomes                           | FR-323–FR-328          |
| V3-RACE-001 | Delayed search -> newer search                                                                        | Late result/Google signal discarded                              | FR-328                 |
| V3-RACE-002 | Delayed evidence -> swap/search -> save                                                               | Obsolete evidence/Google data absent from new save               | FR-328                 |
| V3-RACE-003 | Search/swap/save/delete overlap                                                                       | Later action `CANCELLED`; network/storage mutation count exact   | FR-325, FR-328         |
| V3-STO-001  | Save/reload/delete and duplicate/absent operations                                                    | Persistent official snapshot; idempotent results                 | FR-324                 |
| V3-STO-002  | Eleven records or >256KiB                                                                             | `STORAGE_LIMIT_REACHED`; no eviction/change                      | FR-324                 |
| V3-STO-003  | One corrupt among valid records                                                                       | Valid retained; warning; explicit mutation repairs readable JSON | FR-324                 |
| V3-STO-004  | Unreadable bytes/quota/unavailable                                                                    | Original bytes preserved; safe failure                           | FR-324                 |
| V3-STO-005  | Inject Google fields, raw payload, HTML, PII, credentials, correlation/session, cross-reference drift | Record rejected; no partial projection                           | FR-315, FR-324, FR-327 |
| V3-STO-006  | v2 and v3 keys coexist                                                                                | Neither reads/mutates/migrates the other                         | FR-324, FR-330         |

## UI, copy, accessibility, and visual acceptance

| ID            | Scenario                                                                    | Expected                                                                                       | Requirements                  |
| ------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| V3-UX-001     | Landing at 1440x900 and 390x844                                             | Area, party, time, budget, visible moods, meal, CTA in first viewport                          | FR-302, FR-304, FR-320–FR-323 |
| V3-UX-002     | Successful desktop search                                                   | Adjust collapsed; result >=70% width; no 50:50 dashboard                                       | FR-320                        |
| V3-UX-003     | Successful 390x844 search                                                   | Title/chips and first stop name/time/price intersect first focused viewport                    | FR-320                        |
| V3-UX-004     | Summary/card static word audit                                              | Summary <=35 words; collapsed stop copy <=45 words                                             | FR-321                        |
| V3-UX-005     | Mood switches by area                                                       | Only manifest-backed presets visible; selection recovers if area removes it                    | FR-304                        |
| V3-UX-006     | Party/budget/meal changes                                                   | Visible values, URL, result arithmetic, grammar remain synchronized                            | FR-301–FR-309                 |
| V3-UX-007     | `Change this stop` dialog                                                   | One trigger; three labelled preferences; focus trap/restore                                    | FR-319, FR-323                |
| V3-UX-008     | Sources/hours/menu and Google disclosure                                    | Official/Google blocks separated; official link direct and safe                                | FR-316, FR-321–FR-323         |
| V3-UX-009     | Save drawer/delete dialog/no-result/error/recovery                          | One primary CTA; stable plan retained where required                                           | FR-323–FR-324, FR-328         |
| V3-COPY-001   | Public DOM/tool/assets string scan                                          | Required published-info caveat present; forbidden live/booking/Provider claims 0               | FR-329                        |
| V3-VIS-001    | Landing/result against three generated references                           | Ticket/sticker hierarchy and kind/area distinction retained without raster-copy implementation | FR-322                        |
| V3-VIS-002    | 320, 390, 768, 1440, 200%, 400%, reduced motion, forced colours             | No document/internal overflow, clipping, overlap, unreadable rotation                          | FR-320–FR-323                 |
| V3-A11Y-001   | axe in idle/search/result/swap/evidence/no-result/error/saved/delete states | Serious/critical 0                                                                             | SC-308                        |
| V3-A11Y-002   | Keyboard-only full journey                                                  | Logical focus/order, dialog trap/restore, disclosures, external links                          | FR-320–FR-323, SC-308         |
| V3-A11Y-003   | Search/swap/evidence/save announcements                                     | Exact target focus; save aria-live only; no decorative announcements                           | FR-320–FR-323                 |
| V3-VIS-003    | Interest layout at 1440/768/390                                             | Exact 6×1, 3×2, 2×3 geometry; equal heights; no orphan row                                     | FR-331, SC-313                |
| V3-VIS-004    | Two- and three-stop connector geometry                                      | Line and node centres within 1px vertical/2px endpoint tolerance                               | FR-332, SC-314                |
| V3-VIS-005    | Focus and card-bound geometry                                               | Purple result/stop focus; no native blue; actions/separators contained; resting rotation none  | FR-332–FR-333, SC-317         |
| V3-PROG-001   | Fast manual success and no-result                                           | Planner-labelled 3-stage presentation visible 650–900ms before projection                      | FR-334, SC-315                |
| V3-PROG-002   | Delayed response beyond 700ms                                               | Routing stage remains pending; no completion claim until response                              | FR-334, SC-315                |
| V3-PROG-003   | Validation, abort, timeout, and unsafe response                             | Immediate safe failure; no artificial minimum delay; stable-plan rules preserved               | FR-335, SC-315                |
| V3-PROG-004   | Site Tool search and reduced-motion manual/tool paths                       | Exact transport label; no manual AI claim; no reduced-motion bar/pulse/fade                    | FR-334–FR-335, SC-316         |
| V3-RESCUE-001 | Hub and segmented selections across zoom matrix                             | Text/card centres <=1px; selected fill clipped inside parent                                   | FR-336, SC-319                |
| V3-RESCUE-002 | Result structure at 1600/1280/1067/800/768/600/390                          | Stamp/rail/node 0; ordered walk labels; action/disclosure contained                            | FR-337, SC-320                |
| V3-RESCUE-003 | Summary layout across the same matrix                                       | Only 4×1 or 2×2; no orphan row                                                                 | FR-338, SC-321                |
| V3-PROG-005   | Fast/slow/no-result 2100ms analysis canvas                                  | Four truthful stages and role slots; 1950–2400ms fast projection; slow remains pending         | FR-339, SC-322                |
| V3-ZOOM-001   | Desktop browser zoom proxy matrix                                           | 1600/1280/1067/800 screenshots and geometry assertions pass                                    | FR-340, SC-319–SC-321         |

## Security, regression, deployment, and rollback

| ID         | Scenario                                               | Expected                                                           | Requirements                  |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------- |
| V3-SEC-001 | Secret/public asset/log/env scan                       | Google key and all credentials absent                              | FR-315, FR-317, FR-327        |
| V3-SEC-002 | SSRF/URL/header injection corpus                       | Fixed host, allowlisted ID, exact headers; no user URL             | FR-314, FR-327                |
| V3-SEC-003 | Google/Tabelog/raw HTML/PII/public payload scan        | Forbidden content 0; safe URI/attribution only                     | FR-313, FR-315–FR-317, FR-327 |
| V3-SEC-004 | External links                                         | HTTPS, `_blank`, `noopener noreferrer`, user gesture only          | FR-323, FR-327                |
| V3-REG-001 | `pnpm check` and all 8 builds                          | v1/v2/v3 pass without weakened tests                               | FR-330, SC-311                |
| V3-REG-002 | Existing v1/v2 browser/security/source suites          | No regression; legacy routes function                              | FR-330, SC-311                |
| V3-DEP-001 | Immutable preview exact human journey per hub          | Search -> evidence -> swap -> save -> delete passes                | FR-301–FR-329                 |
| V3-DEP-002 | Supported-client exact-five journey                    | Fresh contexts 3/3; inventory and parity pass                      | FR-325–FR-328, SC-309         |
| V3-DEP-003 | Production search reliability                          | 20/20; p95 <=3s; invalid envelope/mutation 0                       | SC-310                        |
| V3-DEP-004 | Google-on/off production smoke and 15-minute log watch | Official route works both modes; no secret/raw payload/error burst | FR-314–FR-317, FR-330         |
| V3-DEP-005 | Lighthouse and product-reality audit                   | Performance >=90; A11y/BP/SEO >=95; reality >=85/no dimension <70% | SC-312                        |
| V3-RBK-001 | Pre-promotion rollback resolution                      | Deployment ID and v2 commit/routes verified                        | FR-330                        |
| V3-RBK-002 | Re-promote recorded v2 after injected v3 failure       | `/`, `/plan`, v2 API/tool smoke recover; legacy/network unchanged  | FR-330, SC-312                |

## Requirement coverage index

| Requirement range | Matrix coverage                                             |
| ----------------- | ----------------------------------------------------------- |
| FR-301–FR-304     | V3-CTR-001–005/008, V3-DATA-011, V3-FIX, V3-UX-001/005/006  |
| FR-305–FR-309     | V3-FIX, V3-ENG-001–007, V3-PRICE-001–002                    |
| FR-310–FR-313     | V3-DATA-001–011, V3-SRC-001–003, V3-API-003                 |
| FR-314–FR-317     | V3-GGL-001–013, V3-SEC-001–003, V3-DEP-004                  |
| FR-318–FR-319     | V3-ENG-006–010, V3-SWAP-001–005, V3-UX-007                  |
| FR-320–FR-323     | V3-UX-001–009, V3-COPY-001, V3-VIS-001–002, V3-A11Y-001–003 |
| FR-324            | V3-STO-001–006, V3-UX-009                                   |
| FR-325–FR-328     | V3-API-001–003, V3-TOOL-001–006, V3-RACE-001–003            |
| FR-329–FR-330     | V3-COPY-001, V3-REG-001–002, V3-DEP-001–005, V3-RBK-001–002 |
| FR-331–FR-335     | V3-VIS-003–005, V3-PROG-001–004, V3-A11Y-001–003            |
| FR-336–FR-340     | V3-RESCUE-001–003, V3-PROG-005, V3-ZOOM-001                 |
