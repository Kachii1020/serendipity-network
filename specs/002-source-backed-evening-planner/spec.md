# Feature Specification: Source-backed evening planner

**Status**: Implemented and production-verified; public repo/video packaging pending
**Input**: Product reset approved on 2026-08-29
**Replaces in the primary experience**: the consumer-facing Provider reservation demo in specification 001

## Problem and outcome

The current product proves cross-site orchestration but does not give a first-time
visitor enough real information to act. Kiln, Nori, and Loop are internal demo
identities; their prices, availability, and venue claims do not describe real
places. A visually polished page therefore leaves the user asking what the
product actually solved.

Version 2 lets a solo visitor give an afternoon/evening time window, reference
budget, interests, exclusions, and walking tolerance. It returns one feasible
2- or 3-stop Shibuya plan whose place identities, opening hours, reference
prices, official links, and walking estimates are traceable to open data or
explicit permission. It never claims live availability or booking authority.

## Scope

### In scope

- Shibuya, solo planning, same-day afternoon/evening windows, and an automatic
  2–3-stop result.
- One selected plan at a time, with one-stop swap goals for cheaper, less
  walking, or closer interest fit.
- Source evidence, checked dates, visible attribution, and official outbound
  links for every stop.
- A conservative reference range based only on source-backed `FREE`, `EXACT`,
  or `RANGE` amounts; feasibility uses the sum of maximum amounts.
- Five top-level Site Tools that share the visible UI controller:
  `find_evening_plan`, `show_place_evidence`, `swap_plan_stop`, `save_plan`, and
  `delete_saved_plan`.
- Explicit local save/delete in the browser; no account or server persistence.
- Preservation of specification 001 and `/phase0` as a rollback and technical
  evidence path.

### Non-goals

- Live inventory, reservation, hold, confirmation, payment, or guaranteed
  admission.
- Provider onboarding, accounts, party sizes other than one, multiple cities,
  free-form chat UI, or a general trip planner.
- Runtime scraping, Google Maps data, copied venue descriptions, unlicensed
  images/logos, or automatic navigation to third-party sites.
- Reuse of v1 `Provider`, `Slot`, `BundleSummary`, reservation session, or
  Supabase mutation semantics in the v2 public contract.

## User scenarios

### US1 — Find an actionable evening (P1)

A visitor chooses a time window, budget, interests, exclusions, and maximum
walking leg and receives one source-backed route they can understand and follow.

**Independent verification**: A canonical input reaches a 2- or 3-stop plan in
production, and every stop shows its identity, description, planned time,
address, reference amount and basis, official link, source link/check date, and
travel from the prior location.

1. **Given** an ACTIVE and fresh-enough Shibuya pack, **when** a valid intent is
   submitted, **then** the selected plan fits the requested time, budget, tags,
   and per-leg walking cap.
2. **Given** no feasible 3-stop route for the required `AUTO` request, **when** a feasible
   2-stop route exists, **then** the product returns that route and says it
   reduced the stop count.
3. **Given** matching places but no feasible sequence, **when** the user
   searches, **then** the UI returns an honest adjustment-oriented no-result and
   invents no place or amount.

### US2 — Verify the plan (P1)

A visitor or agent can inspect why a place, time, or price is shown before
leaving the product.

**Independent verification**: `show_place_evidence` returns only the current
plan's place claims, each with one or more declared sources, their checked date,
license/permission basis, and official link; the same facts are reachable in the
visible UI.

1. **Given** a selected plan, **when** evidence for a displayed place is opened,
   **then** identity, hours, reference price, coordinate sources, transparent
   walking-estimate method, attribution, and freshness are visible.
2. **Given** a source is soft-stale, **when** its place remains usable, **then**
   the plan says to recheck it.
3. **Given** a required claim is hard-stale or lacks rights evidence, **when** a
   search runs, **then** the claim cannot enter the selected plan.

### US3 — Adjust one stop without starting over (P2)

A visitor can ask for one stop to be cheaper, require less walking, or better
match their interests while keeping the other stops when a feasible replacement
exists.

**Independent verification**: `swap_plan_stop` changes exactly one place ID,
recomputes all times/totals from the Shibuya Station anchor, preserves all
constraints, and updates the same plan shown on screen.

1. **Given** a current plan and feasible replacement, **when** a swap is
   requested, **then** exactly the selected position changes and all downstream
   times are recomputed.
2. **Given** no valid one-place replacement, **when** a swap is requested,
   **then** the existing plan remains visible and `NO_REPLACEMENT` is returned.
3. **Given** a stale candidate-set or itinerary ID, **when** a swap is requested,
   **then** no state changes and `STALE_PLAN` is returned.

### US4 — Save and revisit locally (P2)

A visitor can explicitly save the current plan on the current browser and later
remove it.

**Independent verification**: Save and delete perform no network request, retain
no credential or PII, survive reload, and expose official links from an immutable
snapshot.

1. **Given** a valid selected plan, **when** it is saved, **then** it is stored
   under the v2 key and appears in saved plans after reload.
2. **Given** the same plan is saved again, **when** storage succeeds, **then** it
   returns idempotent `ALREADY_SAVED` without duplication or reordering.
3. **Given** storage is unavailable or corrupt, **when** save/load runs, **then**
   existing data is not silently deleted and a normalized recovery message is
   shown.

## Requirements

- **FR-201**: The product MUST accept only `schemaVersion: "2"` Shibuya solo
  intents with a same-local-date 2–10 hour window starting no earlier than
  12:00 and ending no later than 23:30, 0–100,000 JPY reference budget, `AUTO`
  stop count, and 5–30 minute maximum walking leg.
- **FR-202**: The product MUST generate schedules from Shibuya Station using
  normalized opening windows, planned durations, and evidenced coordinates.
  Walking is a labelled estimate: haversine distance ×1.25, divided by 75m/min,
  then rounded up to the next five minutes; waiting for a place to open is
  capped at 30 minutes.
- **FR-203**: A plan MUST contain two or three distinct real places and remain
  within the requested end time, reference budget, exclusions, and walking cap;
  it MUST contain at least two place categories.
- **FR-204**: Every factual identity, location, opening-hours, price, and station
  coordinate claim MUST cite one `OPEN_LICENSE` or evidenced
  `EXPLICIT_PERMISSION` source reference with its checked timestamp.
- **FR-205**: `OFFICIAL_LINK_ONLY` sources MAY supply outbound official links
  but MUST NOT substantiate copied factual claims.
- **FR-206**: The UI and tool output MUST show the minimum–maximum reference
  total, display source checked dates and attribution, label walking as a
  coordinate estimate, and state that no live availability or booking is
  provided.
- **FR-207**: Hours/price whose newest referenced source is older than 60 days
  MUST be excluded; data older than 14 days MAY remain only with a visible
  recheck warning.
- **FR-208**: Search ranking MUST use only interest fit, walking efficiency,
  time use, and category variety with deterministic tie-breaking.
- **FR-209**: One-stop swap (`CHEAPER`, `LESS_WALKING`, or
  `DIFFERENT_INTEREST`) MUST preserve the non-selected place IDs, rerun all
  feasibility calculations, and fail without replacing the visible plan if no
  valid alternative exists.
- **FR-210**: Save/delete MUST use validated localStorage only, retain at most
  ten immutable snapshots, make no network request, and store no PII or secret.
- **FR-211**: The top-level document MUST register exactly the approved five
  Site Tools; visible controls and Site Tools MUST call the same action
  controller.
- **FR-212**: Runtime search MUST make zero Provider, Supabase, scraping, or
  third-party API calls; the data pack is validated before use and invalid or
  absent packs fail closed.
- **FR-213**: v1 contracts, database schema, tests, and production rollback
  assets MUST remain intact under `/phase0`.
- **FR-214**: No public v2 payload or copy MAY claim capacity, reservation,
  discount, real-time status, sponsorship, or affiliation.
- **FR-215**: Search results and Site Tool envelopes MUST remain at or below
  65,536 UTF-8 bytes and contain no token, credential, raw source HTML, or
  permission document.

## Success criteria

- **SC-201**: A cold reviewer can identify the problem, input, output, what each
  place is, why the price is shown, and why Site Tools help within 30 seconds.
- **SC-202**: The three promotion fixtures each return a feasible plan with all
  source/evidence fields and no unsupported claims.
- **SC-203**: At least nine ACTIVE places across three categories pass source,
  license, freshness, link, and static data audits.
- **SC-204**: The canonical production `find → evidence → swap → save → delete`
  path succeeds 20/20 with no external mutation and search p95 at or below 3s.
- **SC-205**: 320px, mobile landscape, keyboard, 200% text, 400% zoom, and axe
  checks pass for input, result, evidence, swap, saved, no-result, and error
  states.
- **SC-206**: Existing v1 checks pass without weakening or deleting their
  expectations, and rollback restores the tagged baseline and known deployment
  set.

## Assumptions and dependencies

- Tokyo has no daylight-saving offset; v2 accepts `+09:00` timestamps only.
- Reference amounts are per person and exclude transport and optional purchases.
- Opening hours are normalized weekly windows plus explicit date exceptions;
  public-holiday differences that are not sourced remain an explicit caveat.
- The first source set is limited to licenses that can be documented and
  attributed; official venue pages are outbound links unless permission exists.
- Actual venue names are factual identifiers, not affiliation claims. No
  third-party branding or media is required for the product to work.
