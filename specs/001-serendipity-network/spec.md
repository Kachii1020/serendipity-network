# Feature Specification: Serendipity Network

**Status**: 87/91 required tasks complete, with two optional research tasks;
production/reset/reliability and T095/T101 UI acceptance are deployed; only the
four real Site Tools evidence tasks remain pending  
**Input**: `pasted-text.txt` research brief supplied by the user  
**Last updated**: 2026-08-29

## Problem and outcome

Last-minute seats are fragmented across unrelated provider websites. A person who wants a spontaneous evening must search each site, compare time and cost, estimate travel, and coordinate several short-lived reservations.

Serendipity Network demonstrates that independent websites can expose live actions through WebMCP and that a browser agent can compose those actions into one visible, reversible workflow. The MVP produces a deterministic three-stop solo evening in Shibuya from three separately deployed provider origins.

The desired outcome is not a general booking marketplace. It is a reliable, legible demonstration of cross-origin tool discovery, composition, temporary holds, confirmation, and failure recovery while the person and the agent share the same live page.

## Actors

- **Explorer**: A person asking for a spontaneous evening and reviewing the result.
- **Browser agent**: Codex or ChatGPT Work in the ChatGPT desktop built-in browser.
- **Hub**: The top-level Serendipity page that interprets structured intent, composes bundles, and coordinates provider actions.
- **Provider**: One independently deployed demo origin that owns its seeded
  inventory UI and reservation actions. Third-party/real venue Providers are a
  version 2 integration.
- **Operator**: The demo owner who resets seeded data and triggers a controlled failure scenario.

## Fixed MVP vocabulary

- **Intent**: A normalized request for one solo evening in Shibuya, expressed in `Asia/Tokyo` time and JPY.
- **Slot**: One provider-owned activity with a start, end, price, remaining capacity, location, tags, and novelty score.
- **Bundle**: Exactly three non-overlapping slots, one from each of Kiln Studio, Nori Counter, and Loop Room.
- **Candidate set**: At most three valid bundles ranked deterministically for one intent.
- **Hold**: A provider-owned, 90-second temporary capacity reservation.
- **Bundle hold**: Three successful provider holds. Its expiry is the earliest provider `expiresAt`.
- **Confirmation**: Conversion of every active provider hold into a demo reservation. No payment occurs.
- **Recovery**: Compensation after a partial hold failure, followed by presenting an unheld replacement candidate.

## Scope

### Phase 0 — WebMCP capability gate

- One Hub and two minimal Provider deployments on distinct secure origins.
- Cross-origin tool registration, discovery, execution, UI synchronization, cancellation, and failure propagation.
- A Hub tool that discovers and executes Provider tools from inside its own `execute()` callback.
- Verification in Chrome's WebMCP test mode and in the ChatGPT desktop built-in browser with Codex.
- A recorded decision to keep nested composition or activate the direct-provider fallback.

Phase 0 contains no Supabase dependency and uses deterministic in-memory fixtures. This keeps the architecture gate independent of database and UI work.

### Full MVP

- Three Provider origins: Kiln Studio, Nori Counter, and Loop Room.
- One Hub origin with an oversized mood prompt, compact intent constraints, three-stop journey, persistent live Provider sticker strip, hold countdown, confirmation receipt, recovery notice, and an expandable WebMCP proof layer containing the actual cross-origin demo Provider iframes, stylized SVG route, and sanitized tool activity.
- One closed-by-default `Adjust time & budget` disclosure with a fixed set of
  start-time and budget presets. It extends the existing invitation without adding
  another dominant action or broadening the launch scope.
- Search, hold, hold-status, confirm, and release capabilities for each Provider.
- Deterministic bundle feasibility and ranking.
- Transactional capacity holds, idempotency, expiry, compensation, and sanitized audit events in Supabase Postgres.
- A manual non-agent path using the same business rules when WebMCP is unavailable.
- A deterministic demo reset and one controlled “last seat disappeared” scenario.

### Non-goals

- Real payment, refunds, provider contracts, email, or ticket issuance.
- User accounts, cross-device continuity, or long-term preference history.
- Cities or areas outside Shibuya, currencies other than JPY, or party sizes other than one.
- A region selector, party-size selector, or third-party/real venue Provider
  onboarding. Those require a version 2 contract, real supply, and independent
  promotion evidence.
- Partial two-stop bundles or more than three activities.
- Google Maps, live routing, live traffic, or geocoding.
- Machine-learned ranking or open-ended LLM arithmetic.
- Automatic rollback after a reservation has already reached `CONFIRMED` at a Provider.
- Simulating a confirm-stage business failure in the demo; unknown confirm outcomes are reconciled by status lookup.
- Mobile-first optimization. Basic responsive and accessible operation remain required.
- A standalone AI chat interface inside the Hub.

## User scenarios

### US1 — Compose an evening (P1)

The Explorer asks the browser agent for a solo evening after a given time, under a budget, with an end-time limit and optional preferences. The Hub queries the three Providers and presents the best valid bundle plus up to two alternatives.

**Independent verification**: Seeded inventory produces the expected top-ranked three-stop bundle, with all hard constraints and totals independently recomputed by the test.

1. **Given** all three Provider frames are online with compatible slots, **when** the Explorer requests an evening after 18:00, under ¥5,000, ending by 22:30, **then** the Hub shows one selected bundle containing exactly one slot from each Provider.
2. **Given** multiple valid bundles, **when** composition completes, **then** the Hub stores and displays no more than three candidates in deterministic rank order.
3. **Given** Provider output that fails schema validation, **when** composition runs, **then** that Provider is marked invalid and the Hub returns a structured failure rather than composing from malformed data.

### US2 — Inspect and select an alternative (P2)

The Explorer can inspect why the selected bundle fits and choose another ranked candidate before holding anything.

**Independent verification**: Selecting candidate two changes the main timeline and map without mutating Provider inventory.

1. **Given** two or more candidates, **when** the Explorer or agent selects a different `bundleId` and current `bundleVersion`, **then** the timeline, totals, route, and explanation update together.
2. **Given** a stale or unknown bundle version, **when** selection is requested, **then** the Hub returns `STALE_BUNDLE` and leaves the current selection unchanged.

### US3 — Hold the selected evening (P1)

The Explorer asks to secure the selected bundle. The Hub attempts one hold at each Provider and shows a single bundle countdown only after all three succeed.

**Independent verification**: Successful holds decrement capacity once; a repeated request with the same idempotency keys returns the original holds without further decrement.

1. **Given** three available selected slots, **when** the Explorer requests a hold, **then** all Providers show `HELD`, the Hub shows the earliest expiry, and capacity is decremented exactly once per slot.
2. **Given** one Provider rejects the hold after other holds succeeded, **when** compensation finishes, **then** every successful hold is released exactly once and no bundle is shown as held.
3. **Given** an active bundle hold, **when** its earliest Provider hold expires, **then** confirmation becomes unavailable and the Hub requires a fresh search before another hold.

### US4 — Confirm the held evening (P1)

The Explorer reviews the final price, time, and demo reservation notice and explicitly confirms the active hold.

**Independent verification**: All three holds become confirmed and the receipt contains stable reservation references without exposing hold tokens.

1. **Given** an unexpired bundle hold, **when** the Explorer explicitly invokes confirmation, **then** each Provider is confirmed idempotently and the Hub shows one receipt.
2. **Given** a confirm response is lost or times out, **when** the Hub reconciles with `get_hold_status`, **then** it displays the Provider's actual persisted state and does not blindly create another reservation.
3. **Given** an expired hold, **when** confirmation is attempted, **then** the Hub returns `HOLD_EXPIRED` and does not report success.

### US5 — Recover from a disappearing seat (P1)

The controlled demo can make one selected slot unavailable during holding. The Hub releases other holds, explains what happened, and selects the best remaining valid candidate without holding it automatically.

**Independent verification**: The recovery candidate excludes the failed slot, all prior holds are released, and a new hold requires another explicit action.

1. **Given** the Nori slot disappears during `hold_bundle`, **when** compensation completes, **then** the UI names the failed Provider, reports released holds, and presents the next valid bundle.
2. **Given** no replacement bundle remains, **when** recovery completes, **then** the Hub shows `NO_VALID_BUNDLE` with a safe retry action.

### US6 — Use the product without WebMCP (P2)

An Explorer opening the Hub in an unsupported browser sees a clear compatibility notice but can still use a manual preference form and the ordinary HTTP-backed workflow.

**Independent verification**: With `document.modelContext` absent, manual search, hold, release, and confirm use the same contracts and produce the same deterministic bundle as the WebMCP path.

1. **Given** WebMCP is unavailable, **when** the page loads, **then** agent-specific actions are disabled, the normal interface remains usable, and no runtime exception is emitted.
2. **Given** manual mode, **when** the Explorer completes the workflow, **then** Provider state and Hub state remain synchronized.

### US7 — Understand the live network (P2)

The Explorer can see that separate sites performed the work without reading raw debug logs.

**Independent verification**: The Hub's three Provider stickers reflect validated connection and operation events from three exact origins, each embedded demo Provider document displays its own latest action and status, and the expandable proof layer shows sanitized execution facts.

1. **Given** all configured Provider documents are exposed, **when** the Hub loads in supported mode, **then** Kiln, Nori, and Loop appear as distinct live Provider stickers with named connection state.
2. **Given** a Provider operation starts and completes, **when** validated orchestration events change, **then** its sticker and real iframe move through the applicable operation labels without timer-simulated success.
3. **Given** a hold succeeds or later requires compensation, **when** Provider results arrive, **then** `Held`, `Releasing`, and `Released` appear only for the Providers whose authoritative state supports those labels.
4. **Given** tool activity exists, **when** the Explorer expands `See WebMCP in action`, **then** the proof layer shows the three independently named origins, actual cross-origin demo Provider iframes, route proof, and tool, origin, status, timestamp, duration, and correlation ID without secrets or user reasoning.
5. **Given** WebMCP is unavailable, **when** the manual workflow runs, **then** the same Provider identities remain visible but are explicitly labeled as manual connections and never claim live WebMCP connectivity.

### US8 — Adjust a bounded time and budget (P2)

The Explorer may adjust only the start boundary and total budget through one
closed-by-default disclosure. The control remains a small preset choice, not a
general search form.

**Independent verification**: Automated component, bundle-fixture, accessibility,
and browser tests cover every supported preset pair and prove that the effective
intent and visible summary agree.

1. **Given** a fresh invitation, **when** the disclosure remains closed, **then**
   the effective defaults are start after 18:00 and total budget ¥5,000, with
   Shibuya, one person, and the 22:30 end boundary visible and fixed.
2. **Given** the disclosure is opened, **when** the Explorer adjusts constraints,
   **then** start time is limited to 18:00, 18:30, or 19:00 and total budget is
   limited to ¥4,500, ¥5,000, or ¥6,000; changing a preset performs no search
   until the existing `Plan my night` action is invoked.
3. **Given** any supported preset pair, **when** search runs, **then** the human
   action and top-level Site Tool path use the same validated `Intent` contract,
   and the result or no-result state repeats the effective start and budget.
4. **Given** the canonical seeded inventory, **when** all nine preset pairs run,
   **then** every 18:00 pair returns exactly three routes; 18:30 with ¥4,500 returns
   no result, 18:30 with ¥5,000 returns two routes, and 18:30 with ¥6,000 returns
   three routes; every 19:00 pair returns no result.

### US9 — Understand scope, provenance, and route choices (P2)

The Explorer can tell what the demo will do, where availability came from, and
which ranked route remains selected without decoding technical terminology.

**Independent verification**: Automated component, accessibility, and visual
tests exercise supported and manual modes, the pre-hold review, and selection of
all ranked alternatives.

1. **Given** the product is naming the network generically, **when** no transport
   fact is being described, **then** it uses neutral `Three Provider sites`
   wording rather than implying that manual fallback is WebMCP execution.
2. **Given** Site Tools are unavailable, **when** the manual notice appears,
   **then** it states that availability still comes through the three Provider
   APIs and that no Site Tool call occurred.
3. **Given** a Provider connection is still `Connecting`, **when** its compact
   status renders, **then** the UI does not simultaneously project the operation
   as `Ready`.
4. **Given** a composed route, **when** the Explorer reaches the hold decision,
   **then** visible copy states that the hold is temporary, the reservation is a
   demo, no payment occurs, and no real booking is created before the hold action.
5. **Given** up to three ranked candidates, **when** the Explorer compares or
   selects them, **then** stable `Route 1`, `Route 2`, and `Route 3` labels retain
   their original ranks and each choice shows time, price, travel, and activity
   titles without renumbering after selection.

### US10 — Complete and recover safely on a narrow screen (P1)

The Explorer can follow the same route, release, and recovery flow at 320px or
200% text enlargement without losing the current decision, focus target, or safe
next action.

**Independent verification**: Deterministic browser tests exercise result,
alternative, reset, release, compensation, and proof states at the affected
viewport/text sizes and observe request counts as well as internal overflow.

1. **Given** a 320px viewport or 200% text enlargement, **when** search completes,
   **then** the selected route heading is focused and visible before any lower
   action, with the hold action reachable by forward scrolling.
2. **Given** a no-result or completed journey at a prior scroll position, **when**
   the Explorer chooses `Adjust search` or starts over, **then** focus and scroll
   return to the invitation heading.
3. **Given** an active hold, **when** release begins, **then** confirmation and
   duplicate release are blocked until one terminal result; a failed release
   offers only the authoritative safe retry or status-check action.
4. **Given** incomplete compensation, **when** the page reloads before the
   90-second safety window ends, **then** the guard persists, makes no automatic
   release claim or request, and enables only a fresh search after the window.
5. **Given** the proof is opened at 320px, **when** the three Provider documents
   render, **then** their identity, connection, operation, and latest-action facts
   fit their frames without internal scrolling, and the manual warning wraps
   without clipping.
6. **Given** an alternative route is selected, **when** its choice button leaves
   the comparison list, **then** focus moves to the updated stable route summary
   rather than falling to the document body.

## State model

The Hub uses one explicit state machine. Transient states are visible but do not create separate pages.

| State         | Allowed entry                                        | Allowed exit                                       |
| ------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `idle`        | Initial load or demo reset                           | `discovering`, `unsupported`                       |
| `unsupported` | WebMCP feature detection fails                       | `discovering` through manual mode                  |
| `discovering` | Search requested                                     | `composed`, `no_results`, `error`                  |
| `composed`    | Valid candidates exist or recovery selects one       | `composed`, `holding`, `discovering`               |
| `holding`     | Hold explicitly requested for current bundle/version | `held`, `recovering`, `error`                      |
| `held`        | All three holds succeeded                            | `confirming`, `releasing`, `composed` after expiry |
| `releasing`   | Explicit release or an approved idempotent retry     | `composed`, `reconciling`, `error`                 |
| `confirming`  | Confirmation explicitly requested                    | `confirmed`, `reconciling`, `error`                |
| `reconciling` | A confirm outcome or release result needs status     | `confirmed`, `composed`, `held`, `error`           |
| `confirmed`   | All three Providers report confirmed                 | Terminal until demo reset                          |
| `recovering`  | A partial hold failed                                | `composed`, `no_results`, `error`                  |
| `no_results`  | No valid three-stop bundle exists                    | `discovering`, `idle`                              |
| `error`       | Non-recoverable normalized error                     | Previous safe state, `discovering`, or `idle`      |

Invariants:

- Only `held`, `releasing`, `confirming`, `reconciling`, and an explicitly locked
  recovery/error state may retain active Provider hold references.
- `confirmed` requires all three Provider statuses to be `CONFIRMED`.
- A transition to `composed`, `no_results`, or `error` after partial hold failure requires successful compensation or an explicit `COMPENSATION_INCOMPLETE` warning.
- While release is in flight or compensation is incomplete, every conflicting UI
  and Site Tool mutation fails closed before another Provider request.
- Candidate selection never changes Provider inventory.

## Bundle feasibility and ranking contract

### Hard constraints

A candidate is valid only when all are true:

- It contains exactly one slot from each configured Provider.
- Every slot has at least one remaining seat.
- Slots are ordered chronologically and do not overlap.
- `previous.endsAt + travelMinutes(previous.locationId, next.locationId) <= next.startsAt`.
- Total price is less than or equal to `totalBudgetYen`.
- First start is at or after `startAt`; final end is at or before `endAt`.
- No slot contains an excluded tag.
- All timestamps resolve to the same Tokyo calendar date requested by the intent.

The UI displays both travel minutes and spare gap minutes. Travel feasibility does not add an undisclosed buffer.

### Deterministic score

Every valid bundle receives a score from 0 to 100:

```text
score =
  preferenceFit * 35
  + novelty * 25
  + timeUtilization * 15
  + discount * 10
  - travelBurden * 15
```

The final score is `clamp(rawScore, 0, 100)` rounded to four decimal places before sorting or serialization.

All components are clamped to `[0, 1]`:

- `preferenceFit`: requested tags present in the union of all bundle-item tags divided by requested tags; `0.5` when no preference tags are supplied.
- `novelty`: average seeded `noveltyScore` of the three slots. No personal history is inferred.
- `timeUtilization`: total activity minutes divided by requested window minutes.
- `discount`: average `(originalPriceYen - priceYen) / originalPriceYen`, with zero when no discount exists.
- `travelBurden`: `min(totalTravelMinutes / 60, 1)`.

Tie-break order is score descending, total price ascending, final end ascending, then bundle ID ascending. User-facing reasons come from deterministic reason codes and templates, not model-generated arithmetic.

`bundleId` is a deterministic truncated SHA-256 digest of schema version plus the ordered `(provider, slotId, inventoryVersion)` tuples. `bundleVersion` is the candidate-set version and increments whenever search or recovery replaces the candidate set.

## Functional requirements

- **FR-001**: The system MUST support Codex or ChatGPT Work in the latest ChatGPT desktop built-in browser using a Site Tools-capable model, and Chrome WebMCP test mode as the diagnostic reference.
- **FR-002**: The Hub MUST feature-detect WebMCP and preserve a functional manual interface when it is unavailable.
- **FR-003**: The MVP intent MUST be limited to Shibuya, `Asia/Tokyo`, JPY, party size one, one calendar date, a start time, an end time, a positive budget, preference tags, and excluded tags.
- **FR-004**: Search MUST query every configured active Provider and apply a bounded timeout to each call.
- **FR-005**: All tool and HTTP inputs and outputs MUST be validated against shared schemas before use.
- **FR-006**: The bundle engine MUST enforce every hard constraint and MUST NOT return partial bundles.
- **FR-007**: The bundle engine MUST rank candidates using the documented deterministic score and tie-break rules and retain at most three.
- **FR-008**: The Hub MUST display normalized intent, timeline, provider identity, travel, spare gap, total price, final end, and short deterministic reasons.
- **FR-009**: Candidate selection MUST require `bundleId` and `bundleVersion` and MUST reject stale selections without side effects.
- **FR-010**: Provider search MUST be read-only and MUST NOT change capacity.
- **FR-011**: A Provider hold MUST atomically verify and decrement capacity and create one 90-second hold.
- **FR-012**: Hold creation, confirmation, and release MUST be idempotent for the same operation key and request hash.
- **FR-013**: A failed bundle hold MUST compensate every successful hold and MUST report incomplete compensation explicitly.
- **FR-014**: The bundle countdown and confirm eligibility MUST use the earliest Provider expiry, never a new client-derived 90-second deadline.
- **FR-015**: Confirmation MUST require an explicit Explorer action after the final summary is visible.
- **FR-016**: Unknown confirm outcomes MUST be reconciled through Provider status lookup before success or failure is reported.
- **FR-017**: A confirmed bundle MUST render a receipt with three reservation references and no secret tokens.
- **FR-018**: Release and expiry MUST restore capacity exactly once only when a hold transitions from `HELD`.
- **FR-019**: Recovery MUST exclude the failed slot, select the next ranked valid candidate, and MUST NOT automatically hold the replacement.
- **FR-020**: If no valid candidate exists, the Hub MUST show a no-result explanation and safe retry path.
- **FR-021**: Each Provider proof card MUST contain its actual cross-origin `/embed` iframe and reflect tool execution in its own UI, even when the proof region is visually collapsed.
- **FR-022**: Phase 0 MUST decide nested composition using the gate in this specification; a failed gate MUST activate and document the direct-provider fallback before MVP work continues.
- **FR-023**: Cross-origin access MUST use `allow="tools"`, exact secure origins, explicit `fromOrigins`, origin-keyed documents, and restrictive frame policies.
- **FR-024**: Service-role keys, hold token plaintext, idempotency keys, and raw user prompts MUST NOT appear in built browser assets, URLs, public tool inputs/results, audit payloads, Site Tools activity, or UI logs. Hold-token plaintext MAY exist only in trusted server memory and, for an active Provider-owned WebMCP operation, transiently in that Provider's same-origin private HTTP response/runtime and origin-scoped session store. Manual/server orchestration MUST encrypt active tokens at rest. Every runtime/session copy MUST be cleared after terminal workflow state or session invalidation.
- **FR-025**: Provider Route Handlers MUST repeat authorization and schema validation even when the request originated from a WebMCP tool.
- **FR-026**: All primary actions and disclosures MUST be keyboard accessible, announce material status changes, meet WCAG AA contrast, and honor reduced motion.
- **FR-027**: Search SHOULD settle within 3 seconds and hold/confirm/release SHOULD settle within 5 seconds under seeded demo conditions, excluding explicit fault injection.
- **FR-028**: The operator MUST be able to reset seed state and trigger exactly one controlled hold-stage cancellation without database console access.
- **FR-029**: Tool activity MUST record only observable execution metadata and sanitized error facts, not hidden reasoning or secrets.
- **FR-030**: Page reload or iframe navigation MUST unregister stale tools; the Hub MUST rediscover tools before the next side-effecting operation.
- **FR-031**: The Hub product UI MUST follow the approved root `DESIGN.md` Sticker Network contract: the first viewport prioritizes one large mood question, large choices, compact constraints, and at most one dominant action rather than a dashboard or permanent technical rail.
- **FR-032**: A persistent live Provider strip MUST show Kiln, Nori, and Loop as distinct Provider stickers with separately named connection and latest-operation states derived from validated runtime and orchestration events, never from decorative timers; every status MUST include text or an icon plus text.
- **FR-033**: A `See WebMCP in action` disclosure MUST expose the three actual Provider `/embed` iframes, exact-origin identity, route proof with a text equivalent, and sanitized Tool Activity without displacing the primary journey when collapsed.
- **FR-034**: Provider stickers, journey stops, and Provider embeds MUST share one Provider identity token and accessible name per origin, while workflow success, warning, unknown, and failure semantics MUST use a separate non-color-only status system.
- **FR-035**: The UI MUST show `Held` or `Confirmed` for a Provider only after an authoritative result and MUST expose per-Provider `Releasing`/`Released` or `Needs attention` states during compensation; manual mode MUST NOT present its connections as live WebMCP.
- **FR-036**: The invitation MUST expose exactly one closed-by-default `Adjust time & budget` disclosure with start presets 18:00, 18:30, and 19:00 and budget presets ¥4,500, ¥5,000, and ¥6,000; defaults MUST remain 18:00 and ¥5,000.
- **FR-037**: Preset changes MUST perform no network or inventory operation until the existing plan action, MUST flow through the shared validated `Intent` contract, and MUST be repeated in result and no-result context; Shibuya, party size one, and the 22:30 end boundary remain fixed.
- **FR-038**: Product copy MUST distinguish neutral Provider-site identity from transport provenance: manual fallback MUST say availability came through Provider APIs and that no Site Tool call occurred, and a connecting Provider MUST NOT simultaneously appear operation-ready.
- **FR-039**: Before hold, the UI MUST state that the hold is temporary, the reservation is a demo, no payment occurs, and no real booking is created.
- **FR-040**: Candidate choices MUST use stable `Route 1` through `Route 3` rank labels and show time, total price, total travel, and activity titles without renumbering after selection.
- **FR-041**: After a user-initiated state transition, the Hub MUST move focus to the exact durable target for that state and reveal it with deterministic non-animated scrolling; search success and alternative selection target the route summary, hold success targets the held heading, release targets the release heading, receipt targets the receipt, no-result/error/recovery target their notices, and adjust/start-over targets `#mood-heading`. Initial load and background Provider events MUST NOT steal focus, and stale scheduled focus work MUST be cancelled.
- **FR-042**: Release MUST have an explicit in-flight state that blocks confirmation, duplicate release, reset, and every conflicting Site Tool mutation before a second Provider request. A failed release MUST retain the same active hold identity and expose only an idempotent safe release retry when retryable, or an authoritative bundle-status check otherwise; released/expired, confirmed, held, and mixed/unknown outcomes MUST project to safe terminal, receipt, retry-release, and locked-check states respectively.
- **FR-043**: `COMPENSATION_INCOMPLETE` MUST start a 90-second safety guard from the response `meta.completedAt`, falling back to the client receipt time only when that timestamp is absent or invalid. The Hub MUST persist only the ISO `blockedUntil` in session storage, restore an unexpired guard after reload, block search/hold/confirm/release and Site Tool mutations during it, make no automatic network request or release-complete claim at expiry, and enable only `Start a fresh search` after the window.
- **FR-044**: At a 320px Hub viewport, the unsupported/manual warning MUST wrap without clipping and each expanded Provider proof document MUST fit its iframe in both axes while keeping Provider identity, connection, operation, and latest action visible. The Provider `/embed` document MUST adapt to the iframe width; a standalone Provider home MAY retain its 320px minimum width.

## Edge cases and failure behavior

- A Provider timeout yields `PROVIDER_TIMEOUT`; search may fail closed because an exact three-Provider bundle cannot be formed.
- A Provider iframe reload invalidates prior `RegisteredTool` references; the next action rediscover tools.
- A duplicate tool name from an unexpected origin is ignored and recorded as `ORIGIN_MISMATCH`.
- Invalid dates, non-Tokyo offsets, budgets below zero, or `partySize != 1` fail input validation.
- A stale candidate cannot be held even if its underlying slot still appears available.
- A hold response lost after commit is recovered by retrying with the same idempotency key or by status lookup; it is never recreated with a fresh key automatically.
- Releasing an already released or expired hold returns its persisted terminal state without incrementing capacity.
- Releasing a confirmed reservation returns `ALREADY_CONFIRMED`; confirmed cancellation is outside MVP scope.
- If compensation remains incomplete after bounded retries, the Hub exposes the affected Provider and hold reference-safe identifier and blocks confirmation.
- Repeated confirm, release, reset, or Site Tool mutation attempts during release or
  the compensation guard fail before issuing another Provider request.
- A retryable release failure reuses the same safe hold identity and idempotent
  operation; a non-retryable or `ALREADY_CONFIRMED` result requires authoritative
  bundle reload before any terminal UI is shown.
- An expired compensation timestamp restores no lock. An unexpired timestamp
  restores only the countdown; no token, reference, Provider payload, or success
  claim is persisted with it.
- Browser safety review, user cancellation, or `AbortSignal` cancellation leaves the UI in the last safe state and attempts compensation for completed holds.
- Unsupported typed time or budget values are not representable in the human UI;
  forged values still pass through the existing contract validator and fail closed
  when invalid.
- A supported preset may honestly return `NO_VALID_BUNDLE`; the UI retains the
  selected presets and offers the same adjustment disclosure without inventing or
  partially filling a route.

## Key entities

- **Provider**: One separately deployed inventory owner and WebMCP origin.
- **Location**: A stable place ID, label, SVG coordinates, and travel-matrix key.
- **Slot**: Provider inventory for one activity occurrence.
- **Intent**: Validated constraints used by the bundle engine.
- **Bundle candidate**: Immutable, versioned composition snapshot.
- **Hold**: Provider-owned temporary reservation with a hashed secret token.
- **Bundle session**: Hub-owned workflow state and sanitized candidate snapshots.
- **Bundle item**: Link from a bundle session to one Provider slot and optional hold.
- **Audit event**: Sanitized fact about an API or tool execution.

## Success criteria

- **SC-001**: Every Phase 0 gate case passes three consecutive times in Chrome and three consecutive times through Codex in the ChatGPT desktop built-in browser, or the fallback decision is recorded before Phase 1.
- **SC-002**: For the canonical prompt, seeded data produces the same selected bundle, totals, score breakdown, and reasons across 20 repeated runs.
- **SC-003**: Property tests generate at least 1,000 slot sets without any returned bundle violating a hard constraint.
- **SC-004**: With 20 concurrent hold attempts for one remaining seat, at most one hold succeeds and capacity never becomes negative.
- **SC-005**: Every injected partial hold failure leaves zero active orphan holds after compensation completes or raises `COMPENSATION_INCOMPLETE` within 5 seconds.
- **SC-006**: Idempotency tests prove repeated hold, confirm, release, and expiry processing do not duplicate capacity or reservations.
- **SC-007**: Automated scans and manual Site Tools activity inspection find no service key, hold token, idempotency key, raw prompt, or database connection string in browser assets, public tool inputs/results, audit events, traces, or test screenshots.
- **SC-008**: The canonical discover → hold → confirm flow can be demonstrated in under three minutes while making all three Provider origin/state changes visible.
- **SC-009**: The primary workflow passes keyboard-only operation, visible focus, accessible-name, live-status, contrast, and reduced-motion checks at 1440px and 390px widths.
- **SC-010**: Manual mode and nested WebMCP mode return equivalent candidate ordering for the same fixtures.
- **SC-011**: Within 10 seconds of starting the canonical discover action on seeded staging, an observer can identify three independent Provider identities, distinguish each current operation state, and open the detailed WebMCP proof without reading raw logs.
- **SC-012**: Automated tests cover all nine T095 preset pairs and produce the exact success/count/no-result matrix in US8 while preserving the canonical default winner.
- **SC-013**: Component, accessibility, and visual tests prove the T095 disclosure is closed by default, one dominant action remains, provenance/scope copy is truthful, connecting state is not also ready, pre-hold limitations are visible, and stable route labels do not renumber.
- **SC-014**: At 320×568 and at 200% text enlargement, search success places the route heading inside the viewport; adjust/start-over returns the invitation heading into view; and alternative selection focuses the updated route summary without a body-focus fallback or reverse-scroll requirement.
- **SC-015**: A delayed release produces exactly one release request and zero confirm or duplicate-release requests; retryable failure reuses the same hold, while a non-retryable result reaches only the state proven by authoritative status lookup.
- **SC-016**: Automated reload/clock tests prove the compensation guard persists for the remaining portion of exactly 90 seconds, issues zero automatic requests, blocks every mutation until expiry, and then exposes only the fresh-search action.
- **SC-017**: At 320px, the manual warning and all three expanded Provider proof documents have no internal horizontal overflow; each proof document also fits vertically in its 20rem frame with identity, connection, operation, and latest action visible.

## Phase 0 decision gate

Nested composition is accepted only when all are true:

1. The Hub discovers both cross-origin Provider tools from exact origins.
2. The Hub executes both read-only and state-changing Provider tools.
3. Each Provider iframe reflects execution state and completion visibly.
4. A Hub WebMCP tool performs discovery and Provider execution inside its own `execute()` callback and returns the normalized result.
5. Provider rejection, timeout, cancellation, and iframe unload become bounded normalized outcomes.
6. Exact-origin and missing-`allow="tools"` negative tests fail closed.
7. Current `executeTool` input-shape behavior is pinned in the adapter contract and tested without retrying side effects using an alternate shape.
8. Items 1–7 pass three consecutive times in both required environments.

If any item cannot pass after one bounded compatibility investigation, the architecture switches to direct Provider tools plus Hub presentation tools. Phase 0 is not allowed to drift into an open-ended browser compatibility project.

## Assumptions and dependencies

- The final demo account has Site Tools availability and can use GPT-5.6 Sol or Terra. Availability is verified before recording.
- Chrome 149+ with the current WebMCP test flag is available for diagnostics.
- Provider content is seeded demo content but is still treated as cross-origin untrusted output.
- The three Provider applications share one codebase and one Supabase project for hackathon practicality; they remain distinct HTTPS origins and preserve Provider-owned routes and tools.
- Production or fixed staging origins are used for cross-origin acceptance. Ephemeral preview origins are not added through wildcards.
- The approved visual source of truth is the root `DESIGN.md` Sticker Network contract. It uses a light, colorful invitation and journey surface plus a persistent live Provider strip and a secondary, expandable technical proof layer.
- T095 is implemented and passes its automated IMP/UI acceptance plus fixed-
  production reliability recheck. T093 and T096 are optional supporting research;
  recruiting or human-study completion is not an implementation, release, or
  internal score-reporting blocker.
- T098–T101 implement, deploy, and verify the user-authorized UI-completeness
  follow-up without changing the public tool names, REST routes, database schema,
  or Shibuya/solo scope. Confirm and Release production paths each pass 20/20,
  followed by mandatory reset and read-only health.
- Region selection, party sizes above one, and third-party/real Provider onboarding
  remain version 2 work and are not implied by the T095 presets.

## Deferred, non-blocking decisions

- Whether optional paper-cut illustration assets are added after the CSS-only Sticker Network baseline passes accessibility, performance, and visual tests.
- Whether the public demo exposes manual mode by default or behind “Set preferences manually.”
- Whether Supabase Realtime is added for an optional operator-triggered cancellation animation. Polling or tool results are sufficient for MVP correctness.

## Commercial productization amendment — 2026-08-29

### US11 — Meet the product, then plan without losing the simple path (P1)

An Explorer can understand Serendipity from a consumer-facing home page and
enter the existing planner in one action. The planner remains one document from
intent through receipt so WebMCP registration, hold ownership, recovery, and
focus state do not fragment across routes.

1. **Given** the public root page, **when** it loads, **then** it explains the
   Shibuya solo demo, three independent Providers, reversible Hold, and one Plan
   action without registering Site Tools or contacting Provider APIs.
2. **Given** the root CTA, **when** it is followed, **then** `/plan` renders the
   existing three-action path and exactly five top-level Hub tools.
3. **Given** an allowlisted mood/time/budget query, **when** `/plan` loads,
   **then** it seeds only those controls and performs no search until the user or
   agent explicitly plans.
4. **Given** a receipt, **when** it is presented, **then** the Tokyo date/JST,
   three stops, time range, total, demo/no-payment status, and safe references
   are visible without implying a real paid booking.

### US12 — Validate the final judged path and bounded failures (P1)

The final eligible Sol/Terra client runs the exact five-tool ladder on `/plan`.
Normal flows use production. Fault-only AE-007/009/012 use an isolated,
fixed-origin, same-contract evaluation environment and are labeled as staging
evidence rather than production behavior.

- **FR-045**: `/` MUST be a mostly static consumer landing page with one primary
  `/plan` CTA and MUST register zero Serendipity Site Tools or perform Provider or
  database requests.
- **FR-046**: The landing page MUST state Shibuya, solo, demo-only, no-payment,
  and independent-Provider scope without testimonials, user counts, live
  inventory, or other unsupported commercial claims.
- **FR-047**: Launch metadata MUST provide a canonical URL, favicon/app icons,
  Open Graph/Twitter image, theme color, robots, sitemap, and zero known first-load
  404s. `/phase0` MUST be `noindex,nofollow` and absent from consumer navigation.
- **FR-048**: `/plan` MUST be request-dynamic, keep the full workflow in one
  document, and register exactly five top-level product tools only while that
  document is mounted. `/plan → / → /plan` MUST produce `5 → 0 → 5` registrations
  with zero duplicates or stale mutations.
- **FR-049**: Planner query parameters MAY contain only allowlisted mood, start,
  and budget presets. Invalid values fall back to defaults; no query may contain
  session, bundle, hold, reference, correlation, credential, or token data.
- **FR-050**: Confirmation and active-hold navigation MUST use an accessible,
  branded decision surface. Leaving an active hold MUST release it successfully
  before navigation; mutation states MUST block conflicting navigation.
- **FR-051**: Product proof Provider iframes MUST perform zero requests while the
  disclosure remains unopened and MUST mount with exact-origin labels when
  opened. `/phase0` retains the unconditional Chrome diagnostic surface.
- **FR-052**: Evaluation fault selection MUST be server-only, exact-origin,
  unavailable in production, absent from public tools/URLs/assets, and limited to
  the three approved deterministic scenarios.
- **SC-018**: Root-to-planner entry takes one action; the default planner retains
  the existing Plan → Hold → Confirm count and all nine preset outcomes.
- **SC-019**: Landing Lighthouse lab scores reach Performance ≥90 and
  Accessibility/Best Practices/SEO ≥95; LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1.
- **SC-020**: Landing and every planner state pass axe, keyboard navigation,
  320/390/768/1024/1440 layouts, short-height layouts, and 200%/400% reflow.
- **SC-021**: The commercial readiness rubric scores ≥90/100 with no category
  below 80% while the fixed-production Confirm and Release paths remain 20/20.
- **SC-022**: Final `/plan` Site Tools inventory and canonical workflow pass 3/3
  in one eligible Sol or Terra cohort; proof remains legible within ten seconds.
- **SC-023**: AE-001–012 pass 3/3 with the three fault-only rows explicitly
  attributed to isolated evaluation staging and all other rows to production.
- **SC-024**: Final Available/Recently used, DOM, storage, URL, asset, evidence,
  and log scans expose no hold token, idempotency key, operator/interservice
  secret, Supabase credential, raw prompt, cookie, or sensitive header.
