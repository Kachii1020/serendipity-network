# Feature Specification: Tokyo three-hub meal planner

**Status**: Ready for implementation
**Input**: User-approved Serendipity v3 plan, 2026-08-30
**Evolution**: Replaces v2 only after an independently verified v3 promotion;
specifications 001 and 002 remain immutable history

## Problem and outcome

The source-backed v2 planner proves that Serendipity can build a trustworthy
route, but it is limited to Shibuya, one person, two visible interests, and
mostly free public places. Its dense split dashboard makes the result harder to
read than the choices justify. A visitor cannot plan the common case of going
out with friends and including dinner, so the product still feels narrower than
the problem it claims to solve.

Version 3 lets one to three adults choose Shibuya, Shinjuku, or Ikebukuro, a
same-day time window, a per-person budget, a supported mood, and whether to
include a meal. It returns one readable two- or three-stop route made from real
places with published hours and price evidence. Official menu prices determine
budget feasibility; an optional Google Places check may add transient business
status, planned-time hours, price-level, price-range, and Maps-link context but
never substitutes for the official budget evidence.

The desired result is a useful Tokyo evening plan first and a WebMCP proof
second: every visible action works manually, while an assistant can perform the
same multi-step planning, verification, adjustment, save, and delete flow
through exactly five Site Tools.

## Scope

### In scope

- Three bounded Tokyo hubs: Shibuya, Shinjuku, and Ikebukuro.
- One to three adults; party size affects the displayed group estimate but does
  not claim seating or reservation capacity.
- Per-person budget, date, time window, walking cap, one interest preset, tag
  exclusions, and an explicit include-meal choice.
- A three-stop `Activity -> Meal -> Activity` route when a meal is included,
  with an honest `Activity -> Meal` fallback when three stops do not fit.
- A two- or three-activity route when a meal is excluded.
- Source-backed identity, address, coordinates, hours, public access, official
  links, and official-menu price evidence for every routable place.
- One selected plan, one-stop replacement, source disclosure, official links,
  and validated local save/delete.
- Optional server-only Google Places enrichment for pre-registered restaurant
  place IDs, with policy-compliant attribution and no persistent Google content.
- The existing five Site Tool names, upgraded to the v3 contract and sharing
  the same controller as the visible controls.
- Parallel `/v3` and `/v3/plan` preview routes, followed by a gated promotion to
  `/` and `/plan`; v2 moves to `/legacy/source-planner` only after promotion.
- Public privacy and terms pages covering the Google Maps Platform boundary.

### Non-goals

- Arbitrary Tokyo or free-text area search, maps SDKs, turn-by-turn routing, or
  transit planning.
- Live table inventory, group seating guarantees, reservations, holds,
  payments, discounts, affiliations, or price guarantees.
- Runtime scraping or storage/republication of Google, Tabelog, review, rating,
  photo, or third-party description content.
- Tabelog links or data in the v3 release. A future outbound-link-only addition
  requires a separate reviewed specification.
- Accounts, server-side saved plans, migration of v2 local data, Provider or
  Supabase changes, and changes to the historical reservation demo.

## User scenarios

### US1 — Build a useful plan in one of three hubs (P1)

A visitor chooses one supported hub and receives one feasible route that fits
the selected time, walking cap, meal choice, and published per-person budget.

**Independent verification**: One canonical input for each hub produces a
two- or three-stop route whose places, times, travel estimates, and official
evidence can be inspected without navigating away.

1. **Given** an ACTIVE pack for the selected hub, **when** the visitor submits a
   valid intent with meal enabled, **then** the planner returns
   `Activity -> Meal -> Activity` or the honest two-stop
   `Activity -> Meal` fallback.
2. **Given** meal is disabled, **when** the visitor submits a valid intent,
   **then** the route contains only two or three activities.
3. **Given** no allowed grammar can satisfy every hard constraint, **when** the
   search completes, **then** the current plan is preserved if one exists and
   an adjustment-oriented no-result is shown without invented availability or
   price.

### US2 — Plan for one to three adults with a real budget (P1)

A visitor understands both the per-person estimate used for feasibility and the
derived whole-group estimate.

**Independent verification**: The same route for party sizes one and three
keeps its per-person range and multiplies both group bounds by exactly the party
size without changing the hard-budget decision.

1. **Given** a restaurant with published official-menu prices, **when** a route
   is evaluated, **then** the sum of all stops' maximum per-person amounts is at
   or below `budgetPerPersonYen`.
2. **Given** party size three, **when** the plan renders, **then** the group
   minimum and maximum equal the corresponding per-person totals multiplied by
   three and are labelled estimates.
3. **Given** only a Google price level or price range, **when** budget feasibility
   is calculated, **then** that Google value is ignored and no numeric amount is
   inferred from it.

### US3 — Choose a meaningful mood (P1)

A visitor can select more than two genuine planning directions without turning
the form into a tag dashboard.

**Independent verification**: Every ACTIVE hub exposes `SURPRISE` plus at least
four evidenced themed presets; every visible preset has a promotion fixture
that returns a valid result for its declared fixture window.

1. **Given** a non-`SURPRISE` preset, **when** a plan is selected, **then** at
   least one stop matches that preset and the remaining ranking influence is a
   soft preference.
2. **Given** `SURPRISE`, **when** a plan is selected, **then** no interest match
   is required and deterministic quality ranking chooses the route.
3. **Given** `FOOD_DISCOVERY` with meal disabled, **when** the intent is
   submitted, **then** it is rejected as `VALIDATION_ERROR` before any network
   request or state change.
4. **Given** a preset without a passing fixture for the selected hub, **when**
   the form renders, **then** that preset is absent rather than selectable and
   broken.

### US4 — Verify official evidence and optional Google context (P1)

A visitor can tell which values control the plan, which values came from Google
Maps, and what must be checked before leaving.

**Independent verification**: Each stop exposes official evidence, source
publisher, checked date, and official URL. A restaurant can additionally show a
visually separated Google Maps block with required attribution, while the
official-menu amount remains labelled `Budget basis`.

1. **Given** a routable place, **when** `Sources & hours` is opened, **then** the
   official identity, address, coordinate, hours, access, price/menu, and link
   claims are traceable to allowed sources.
2. **Given** Google enrichment succeeds, **when** Google content is displayed
   without a map, **then** it is in a distinct container with visible Google
   Maps attribution and any response-provided third-party attribution.
3. **Given** Google is disabled, times out, returns malformed data, omits a
   field, or returns a non-JPY price range, **when** a search runs, **then** the
   official-source plan remains usable with a truthful enrichment warning.
4. **Given** Google reports a restaurant not operational or closed during the
   planned interval, **when** alternatives exist, **then** that restaurant is
   excluded and the next feasible ranked route is selected; no table
   availability claim is made.

### US5 — Adjust one stop without losing the plan (P2)

A visitor can choose `Change this stop` and request a cheaper, shorter-walk, or
different-interest replacement while retaining the rest of the route.

**Independent verification**: A successful replacement changes exactly one
place of the same kind, recomputes all route values, and preserves every hard
constraint; failure leaves the current plan unchanged.

1. **Given** a meal stop, **when** a replacement is requested, **then** only a
   meal may replace it; activity positions accept only activities.
2. **Given** `CHEAPER`, **when** candidates are ranked, **then** comparison uses
   only the official per-person `maxYen`, never Google price fields.
3. **Given** no valid same-kind replacement, **when** the request completes,
   **then** the dialog closes or presents recovery, `NO_REPLACEMENT` is returned,
   and the existing plan remains visible and savable.

### US6 — Save safely on the current browser (P2)

A visitor can explicitly save the official-source plan snapshot, revisit it,
and delete it without an account.

**Independent verification**: Reload preserves at most ten valid v3 snapshots;
saved JSON contains only the allowed official snapshot and Google place IDs,
and opening a saved plan obtains any Google context anew.

1. **Given** a current plan, **when** it is saved, **then** intent, immutable
   official-source plan, official evidence snapshot, Google place IDs, and
   `savedAt` are written under `serendipity.saved-itineraries.v3`.
2. **Given** transient Google content in the current response, **when** save
   runs, **then** Google names, addresses, hours, price values, URLs,
   attributions, and raw payload are absent from localStorage.
3. **Given** corrupt or unavailable storage, **when** load/save/delete runs,
   **then** valid independent records are preserved, unreadable bytes are not
   silently erased, and a normalized recovery message is shown.

### US7 — Use the same planner through Site Tools (P1)

An assistant can find, verify, adjust, save, and delete a plan through exactly
the actions available to a person.

**Independent verification**: In three fresh supported-client contexts, the
exact `find -> evidence -> swap -> save -> delete` journey projects the same
intent, plan, disclosures, and storage state as the visible controls.

1. **Given** `/v3/plan` or promoted `/plan`, **when** all registrations succeed,
   **then** exactly five approved Site Tools are exposed and the neutral status
   says `Agent tools connected`.
2. **Given** any registration failure, **when** mounting completes, **then** all
   prior handles are disposed and the UI remains fully usable in manual mode.
3. **Given** concurrent, stale, malformed, or oversized tool work, **when** it
   crosses the controller boundary, **then** it fails closed before network,
   UI, or storage mutation and the last stable plan remains intact.

## Functional requirements

- **FR-301**: The planner MUST accept only `schemaVersion: "3"` intents for
  `shibuya`, `shinjuku`, or `ikebukuro`; party size 1–3; a same-Tokyo-date
  2–10-hour window within today through today +7; integer per-person budget
  0–30,000 JPY; include-meal boolean; one closed interest preset; integer
  5–30-minute walking cap; and unique, non-conflicting excluded tags.
- **FR-302**: UI defaults MUST be tomorrow when today's default start has passed,
  otherwise today; 17:00–22:00; Shibuya; one adult; 4,000 JPY/person; meal on;
  `SURPRISE`; and 20-minute walking legs. Visible presets are 2,000, 4,000, and
  7,000 JPY/person, while valid custom tool values remain editable in the form.
- **FR-303**: `FOOD_DISCOVERY` with meal off MUST fail as `VALIDATION_ERROR`.
  All other non-surprise interests are soft ranking preferences with the hard
  condition that at least one selected stop matches the preset.
- **FR-304**: Every ACTIVE area MUST expose `SURPRISE` and at least four themed
  presets backed by passing canonical fixtures; unsupported themed presets MUST
  be hidden for that area rather than disabled after selection.
- **FR-305**: Meal-on composition MUST attempt three distinct stops in the order
  `ACTIVITY, MEAL, ACTIVITY`, then two distinct stops in the order
  `ACTIVITY, MEAL`. Meal-off composition MUST attempt three, then two, distinct
  `ACTIVITY` stops. No other grammar or one-stop result is valid.
- **FR-306**: Every plan MUST satisfy published hours, at most 30 minutes of
  waiting, at least 10 minutes of closing headroom, the requested end, the
  per-leg walking cap, excluded tags, place-kind grammar, and per-person budget.
- **FR-307**: Walking MUST retain the v2 coordinate estimate—haversine distance
  x1.25, 75m/minute, rounded up to five minutes—from the selected hub station,
  and MUST never be described as a Google route or live navigation result.
- **FR-308**: Per-person feasibility MUST sum every stop's official-source
  `maxYen`. Output MUST expose per-person min/max and group min/max, with group
  values calculated by multiplying the exact per-person bounds by party size.
- **FR-309**: Numeric price evidence MUST be `FREE`, `EXACT`, or `RANGE`, have
  `basis: "PER_PERSON"`, use JPY, and cite an official menu or other permitted
  official price source. Unknown required prices cannot be treated as zero or
  enter a hard-budget route.
- **FR-310**: Each hub MUST have an independent versioned pack and reviewed
  claim ledger. Production promotion requires all three packs ACTIVE, each with
  at least four routable activities, three routable restaurants, two activity
  categories, one station anchor, and the preset fixtures required by FR-304.
- **FR-311**: Every routable place MUST have source-backed identity, address,
  coordinates, hours/exceptions, public access, official URL, self-authored
  summary, kind/category/tags, visit duration, and price. Every restaurant MUST
  additionally have an official menu URL and a pre-reviewed Google place ID.
- **FR-312**: Source rights, field scopes, strict calendar semantics, reviewed
  claim matching, 7-day promotion freshness, 14-day warning, and 60-day
  exclusion MUST remain at least as strict as v2. `OFFICIAL_LINK_ONLY` cannot
  substantiate a factual claim.
- **FR-313**: Runtime MUST never scrape. Tabelog content and outbound links MUST
  be absent from source packs, reviewed ledgers, responses, storage, UI, and
  submission assets for this release.
- **FR-314**: Optional Google enrichment MUST run server-side only, be limited
  to pre-registered restaurant place IDs, request no more than three distinct
  IDs per user search, use a two-second per-request timeout and no retry, and
  request only the approved field mask.
- **FR-315**: Google place IDs MAY be stored indefinitely; all other Google
  Places content MUST be request-scoped only—never written to repo data,
  reviewed ledgers, application caches, localStorage, analytics, or logs. Every
  HTTP/tool response containing it MUST use `Cache-Control: no-store` and pass
  the public-safety serializer.
- **FR-316**: Displayed Google content MUST be visibly separate from official
  plan evidence, include compliant Google Maps attribution in the same
  container, include returned third-party attributions, and never be labelled
  `Budget basis`, official evidence, live seating, or live availability.
- **FR-317**: Google enrichment MUST be controlled by
  `GOOGLE_PLACES_ENABLED` and a server-only `GOOGLE_PLACES_API_KEY`. Missing
  configuration, quota, timeout, non-2xx, invalid JSON/schema, mismatched ID,
  invalid returned attribution, or unsupported currency MUST degrade to official-source
  planning with a safe warning and expose no secret or raw upstream body.
- **FR-318**: Search MUST deterministically rank feasible routes by interest
  fit, walking efficiency, time use, and category diversity, then break ties by
  walk, official maximum per-person price, end time, and canonical plan ID.
  Google may remove a known-closed restaurant but cannot otherwise change score.
- **FR-319**: Swap MUST replace exactly one stop with the same kind, preserve
  the other place IDs, recompute the entire route and totals, and fail without
  visible-plan mutation when no replacement exists. `CHEAPER` MUST compare only
  official `maxYen`.
- **FR-320**: The primary result MUST use at least 70% of the available desktop
  content width; the input form becomes a closed `Adjust plan` disclosure after
  success. The first post-search viewport MUST contain the route title, compact
  summary chips, and the first stop's name, time, and price.
- **FR-321**: The summary MUST be at most 35 words and each stop's collapsed
  descriptive copy at most 45 words. Detailed hours, source reasoning, menu
  evidence, and Google attribution belong in labelled disclosures.
- **FR-322**: The production visual language MUST preserve the colourful
  ticket/sticker hierarchy and activity/meal distinction through colour,
  borders, shadows, and radius only. Functional controls, summaries, stamps,
  and route cards MUST have no resting rotation.
- **FR-323**: The UI MUST expose one primary `Save this plan` CTA, one
  `Change this stop` action per stop that opens a preference dialog, direct
  user-initiated official links, and an explicit delete confirmation. It MUST
  not add a sixth Site Tool for outbound navigation.
- **FR-324**: v3 local storage MUST use
  `serendipity.saved-itineraries.v3`, allow at most ten records and 256KiB,
  validate complete cross-references, preserve valid records during partial
  corruption, and retain no PII, credential, activity log, correlation ID, raw
  HTML, or Google content beyond place IDs.
- **FR-325**: The planner document MUST register exactly
  `find_evening_plan`, `show_place_evidence`, `swap_plan_stop`, `save_plan`, and
  `delete_saved_plan`; the first three are read-only and the final two are
  explicit local-storage mutations. Manual and Site Tool actions MUST use one
  controller and one concurrency/stale-result guard.
- **FR-326**: Navigation inventory MUST be exactly `5 -> 0 -> 5` for
  planner -> landing -> planner, with no duplicate registrations, and
  registration MUST be all-or-none across mount, failure, unmount, and Strict
  Mode remount.
- **FR-327**: Public v3 REST and Site Tool inputs/outputs MUST use exact schemas,
  reject additional properties, validate safe HTTPS links and strict dates,
  limit request bodies to 16,384 UTF-8 bytes and responses/tool outputs to
  65,536 bytes, and never serialize secrets, raw upstream bodies, or cycles.
- **FR-328**: Search/swap/evidence/storage races MUST preserve the last stable
  plan; obsolete Google, evidence, search, or swap results MUST be discarded by
  operation and plan identity before UI or storage projection.
- **FR-329**: The product MUST state: `Built from published information, not
live availability. Check each official site before you go.` It MUST also say
  that group totals exclude transport, optional orders, tax, and service
  charges when those amounts are not explicitly included by the source.
- **FR-330**: v3 MUST ship beside v2 until every release gate passes. Promotion
  moves v2 to `/legacy/source-planner`, preserves `/legacy/network-demo` and
  Provider/Supabase deployments unchanged, and retains
  `dpl_CLfLvnMvXbSVtK1ciH4kc4DvnbS6` as the immediate rollback target.
- **FR-331**: Interest choices MUST render as exactly 6 columns at widths of
  at least 1100px, 3 columns at 600–1099px, and 2 columns below 600px.
- **FR-332**: The route connector and nodes MUST share one geometric centre
  system for both 2-stop and 3-stop plans. Card actions and separators MUST
  remain inside the card border without protruding lines.
- **FR-333**: Programmatic result and changed-stop focus MUST use intentional
  purple focus treatment and MUST NOT expose the browser's default blue
  outline. Keyboard focus on interactive controls remains visibly distinct.
- **FR-334**: An accepted search MUST show a full-width, truthful progress
  presentation for at least 700ms while the real request runs. It MUST present
  validation, published-hours/menu matching, and route/walking composition,
  distinguish `Planner` from `AI tool · find_evening_plan`, and never imply
  live web or inventory search.
- **FR-335**: Search cancellation, validation failure, and transport errors
  MUST bypass the minimum presentation delay. Reduced-motion users MUST receive
  the same textual progress without movement, pulse, or fade.
- **FR-336**: Hub labels MUST be centred on both axes and segmented selections
  MUST be clipped by their shared rounded parent at every supported width.
- **FR-337**: The result MUST contain no separate area stamp, route rail, or
  route node decoration. Ordered card numbers and each stop's actual walk from
  its origin/previous stop MUST communicate sequence.
- **FR-338**: Result summaries MUST render as exactly 4×1 at 1000px and above
  and 2×2 below 1000px. A 3+1 orphan arrangement is forbidden.
- **FR-339**: Accepted success and honest no-result searches MUST receive a
  minimum 2100ms analysis presentation with four truthful stages and dynamic
  Activity/Meal target slots. It MUST not invent place names, counts, live
  search, or completion before the real response.
- **FR-340**: Browser-zoom-equivalent CSS viewports 1600, 1280, 1067, and 800px
  MUST be first-class release fixtures in addition to responsive mobile sizes.

## Key entities

- **PlannerIntentV3**: normalized area, party, time, budget, meal, interest,
  walking, and exclusion request shared by UI, URL, API, and Site Tools.
- **AreaRegistryEntryV3**: one hub's station, ACTIVE data pack, reviewed ledger,
  evidence resolver, and supported preset set.
- **PlannerPlaceV3**: an official-source activity or meal candidate with a
  per-person price basis and optional stored Google place ID.
- **GooglePlaceSignalV3**: transient, normalized Google context for the current
  response; never part of the reviewed pack or saved snapshot.
- **EveningPlanV3**: one immutable source-backed route and its per-person/group
  totals, with transient Google signals kept structurally separate.
- **SavedPlanRecordV3**: the official plan/evidence snapshot, intent, Google
  place IDs, and save time stored only in the browser.

## Success criteria

- **SC-301**: A first-time reviewer can identify the supported hubs, party size,
  per-person budget, meal choice, output, price basis, and next action within 30
  seconds.
- **SC-302**: All three hubs meet FR-310 and pass the 12 canonical
  area x party(1/3) x meal(on/off) scenarios plus their declared preset
  fixtures.
- **SC-303**: Every selected route uses the required grammar, fits all hard
  constraints, and has 100% source linkage for every displayed official claim.
- **SC-304**: Party-size tests prove exact per-person/group arithmetic and zero
  uses of Google fields in hard-budget feasibility.
- **SC-305**: With Google enabled, normal, closed, missing-field, timeout, quota,
  non-JPY, poisoned, and attribution-error fixtures all pass; with Google
  disabled, every canonical official-source route remains usable.
- **SC-306**: Google content outside place IDs is absent from git, packs,
  reviewed ledgers, logs, caches, localStorage, saved exports, and analytics;
  Tabelog strings/content are absent from every public v3 asset and payload.
- **SC-307**: The result occupies at least 70% desktop width, meets the 35/45
  word caps, and shows the first stop's name/time/price in the first 390x844
  post-search viewport.
- **SC-308**: Idle, result, adjust, swap dialog, evidence, no-result, error,
  saved drawer, and delete dialog pass keyboard, reduced-motion, axe, 320/390,
  landscape, 200% text, and 400% zoom with no serious/critical issue or internal
  overflow.
- **SC-309**: The exact five-tool journey succeeds 3/3 in fresh supported-client
  contexts with UI/tool parity and inventory `5 -> 0 -> 5`.
- **SC-310**: Production search succeeds 20/20 with no invalid envelope,
  mutation, or unsupported claim and p95 at or below three seconds; composition
  of an area pack up to 30 places has p95 at or below 100ms excluding Google
  network time.
- **SC-311**: `pnpm check`, all eight workspace builds, v1/v2 regressions,
  source/security/browser/a11y gates, and live source-link checks pass without
  weakened expectations.
- **SC-312**: A product-reality audit scores at least 85/100 with no dimension
  below 70%; any failure keeps v2 production in place or triggers the recorded
  v2 rollback.
- **SC-313**: At 1440px, 768px, and 390px the interest grid is respectively
  6×1, 3×2, and 2×3 with equal-height controls and no orphan row.
- **SC-314**: Route line/node centres differ by at most 1px vertically and 2px
  at the first/last horizontal endpoints for both 2-stop and 3-stop plans.
- **SC-315**: Fast successful and honest no-result searches show progress for
  650–900ms; slower requests remain in a truthful pending state until their
  actual response arrives, and errors/cancellation surface immediately.
- **SC-316**: Manual progress never claims an AI tool; Site Tool progress shows
  exactly `find_evening_plan`. Reduced-motion progress has no active animation.
- **SC-317**: No functional or data card has a resting rotation, no separator
  or action exceeds its card bounds, and result focus uses the purple design
  token instead of the native blue outline.
- **SC-318**: The UI repair preserves `pnpm check`, all 8 builds, security and
  source gates, exact-five parity, and the v3 20/20 read-only reliability gate.
- **SC-319**: Hub text/card centre error is at most 1px and selected segment
  bounds remain inside their shared parent at every zoom fixture.
- **SC-320**: Area stamp, route line, and route node DOM counts are zero; no
  functional element protrudes from its container.
- **SC-321**: Summary row counts are `[4]` or `[2,2]` only across the complete
  zoom/responsive matrix.
- **SC-322**: Fast analysis presentation lasts 1950–2400ms, shows the four
  stages in order, and keeps a truthful waiting state beyond 2100ms when the
  actual response is slower.

## Assumptions and dependencies

- Tokyo uses JST (`+09:00`) and no daylight-saving transition.
- Prices are for a typical adult's published required admission/order basis,
  not a promise of final spend. Tax/service inclusion follows the cited menu and
  is disclosed rather than inferred.
- Party size does not change duration, walking, or candidate capacity because
  live seating and reservation inventory are unavailable.
- Each hub is independently promoted from CANDIDATE to ACTIVE, but production
  v3 promotion requires all three hubs ACTIVE.
- Google enrichment depends on a billing-enabled project, Places API (New), a
  restricted key, quota, and budget alert. The product remains correct with the
  feature flag off.
- Google policy references are pinned in the implementation plan; policy drift
  requires review before deployment, not silent contract relaxation.
- The generated PNGs under `design/` are visual references, not third-party
  venue photography or automatically shippable assets.
