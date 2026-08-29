# UI Implementation Contract: Serendipity Sticker Network

**Spec**: [spec.md](./spec.md)  
**Visual source of truth**: [DESIGN.md](../../DESIGN.md)  
**Status**: Locked at T008 on 2026-08-27 and amended by the user-authorized
T095 and T098–T101 contracts on 2026-08-29; Provider and Hub Sticker Network UI
is implemented and production-verified through T101  
**Review basis**: User selected direction C, Sticker City, refined here as
**Sticker Network** with first-class WebMCP visibility.

## 1. Locked product decisions

Serendipity Network is a lightweight, colorful one-session experience. It is not
an operations dashboard, travel search portal, or technical console. A person
should understand the next step without inspecting a grid of fields or status tables.

The approved design has two coordinated layers:

- **Experience layer**: one large mood prompt, four large choices, compact fixed
  constraints, one closed time/budget disclosure, one primary action, a live
  three-Provider sticker strip, and one three-stop journey.
- **Proof layer**: an expandable `See WebMCP in action` disclosure containing the
  actual cross-origin demo Provider iframes, exact-origin identity, route proof,
  and sanitized activity.

WebMCP is not hidden as developer trivia. The experience layer visibly shows the
three independent sites participating. The proof layer lets a judge verify that
the activity is real without making diagnostics the product's first impression.

Rejected structures:

- permanent 8/4 journey-and-network dashboard;
- multi-field intent bar in the first viewport;
- map or iframe rail above the recommendation;
- small uppercase operational labels as the primary hierarchy;
- fake staged progress, looping animation, or static success badges;
- raw Slush styling such as 200px display text, 3D ribbons, and constant color noise.

## 2. Experience principles

1. **Invitation before configuration**: ask how tonight should feel, then summarize
   the MVP's fixed scope and constraints compactly.
2. **One decision at a time**: every Hub state has zero or one dominant enabled
   action. Secondary actions stay visually quiet.
3. **The network performs in public**: Kiln, Nori, and Loop stickers show actual
   connection and operation changes in the primary reading path.
4. **Result before mechanism**: the recommended evening is easier to scan than the
   transport and tool details that produced it.
5. **Proof is one action away**: real iframes, origin labels, route, and sanitized
   events are never more than one disclosure action away.
6. **Playful but trustworthy**: strong color and sticker shapes express energy;
   text, icons, explicit uncertainty, and authoritative results express correctness.
7. **No invented state**: view components consume explicit state-machine and
   Provider-operation projections. They never infer business state from time,
   animation completion, iframe text, or missing fields.
8. **Bounded agency without form sprawl**: time and budget use a small closed set
   behind one disclosure; region, party size, and real Provider onboarding do not
   enter the MVP UI.
9. **Scope before commitment**: the user sees demo/no-payment/no-real-booking
   limitations before invoking a hold, not only after confirmation.
10. **Context survives transitions**: user-initiated success, reset, alternative,
    release, and recovery transitions reveal and focus the exact durable state;
    browser default focus or prior scroll position never determines the next view.
11. **Uncertainty blocks mutation, not understanding**: release and incomplete
    compensation states remove conflicting actions, name what is known, and offer
    only the next action supported by authoritative status.

## 3. Information architecture

### Shared shell

1. `Header`: Serendipity wordmark, supported/manual compatibility label, operator
   demo reset as a quiet utility when authorized.
2. Main workflow region, whose content changes by Hub state.
3. `LiveProviderStrip`: Kiln, Nori, and Loop stickers; persistent after the header
   on the invitation and adjacent to the result heading when space permits.
4. `WebMcpProof`: stable disclosure after the main journey/recovery content.

### Idle invitation

1. `MoodPrompt`: one large question, e.g. “What kind of tonight?”
2. Four large multi-select choices using the allowed preference vocabulary.
3. `ConstraintSummary`: Shibuya, solo, Tokyo-local date/time, budget, and end limit;
   `Adjust time & budget` is closed by default and contains only the approved
   presets.
4. One `Plan my night` action.
5. Live Provider stickers showing `Connecting`, `Live site`, `Unavailable`, or
   `Manual connection` independently from operation state.

### T095 bounded-adjustment amendment

This amendment is additive to the T008 visual lock. It does not authorize a
multi-field search bar or change the dominant action.

| Control        | Values                 | Default |
| -------------- | ---------------------- | ------- |
| `Start after`  | 18:00, 18:30, 19:00    | 18:00   |
| `Total budget` | ¥4,500, ¥5,000, ¥6,000 | ¥5,000  |

Rules:

- The native `Adjust time & budget` disclosure is closed on initial render and
  reset. Its summary remains a secondary control, never a second dominant action.
- Shibuya, one person, and `Ends by 22:30` remain visible outside the disclosure
  so the fixed launch boundary cannot be mistaken for an editable field.
- Opening, closing, or changing a preset makes no request. The existing
  `Plan my night` action submits the selected values through the shared validated
  intent path.
- Result, no-result, hold review, and receipt context repeat the effective start
  and budget. No-result preserves the selected values when returning to adjust.
- Unsupported typed values are not exposed by the human UI. Region, party size,
  and third-party/real Provider controls remain version 2.

The seeded preset outcomes are part of the UI acceptance contract: all three
18:00 budgets produce a route; 18:30 produces no route at ¥4,500, two routes at
¥5,000, and three routes at ¥6,000; all three 19:00 budgets produce no route.

### T095 clarity amendment

- Generic network identity uses neutral `Three Provider sites` copy. `Site Tool`
  and `Manual fallback` appear only when describing transport provenance.
- The manual compatibility notice says that availability still comes through the
  three Provider APIs and that no Site Tool call occurred.
- While a Provider connection is `Connecting`, its `Ready` operation label is
  hidden or suppressed from the accessible projection; the two states never
  appear simultaneously.
- The composed state places a visible temporary-demo/no-payment/no-real-booking
  notice before `Hold for 90 seconds`.
- Candidate ranks are stable. `Route 1`, `Route 2`, and `Route 3` retain their
  original rank labels after selection, and every option exposes time, price,
  travel, and activity titles.

### T098–T101 UI-completeness amendment

- Search success and alternative selection focus `.journey-summary`; hold,
  release, recovery/error, no-result, and receipt transitions focus their exact
  durable heading/container; `Adjust search` and start-over focus `#mood-heading`.
- Focus uses `preventScroll` followed by non-animated start alignment. Initial
  render and background Provider messages never steal focus, and stale scheduled
  focus is cancelled during cleanup.
- Release has its own visible `releasing` state. `Confirm` and `Release` disappear
  while it is active, every competing UI/Site Tool mutation fails closed, and the
  Provider strip projects `Releasing` from the actual operation.
- Retryable release failure offers only `Retry release safely` with the same hold
  identity. Non-retryable failure offers only `Check latest Provider status`;
  released/expired, confirmed, still-held, and mixed/unknown reload results map to
  fresh-search, receipt, retry-release, and locked status-check states.
- Incomplete compensation displays a session-persisted 90-second guard. Before
  expiry its disabled action names the wait; after expiry it offers only
  `Start a fresh search`. Expiry neither calls the network nor claims release.
- At 320px, the manual warning wraps, `/embed` documents follow their actual frame
  width, and 20rem proof frames show Provider name, connection, operation, and
  latest action without internal horizontal or vertical scrolling.

### Journey and reservation

1. `JourneySummary`: playful result statement, deterministic reason, total price,
   start/end, and current durable workflow notice.
2. `StopBandList`: exactly three full-width Provider-colored stop bands with travel
   and spare gaps between them.
3. `JourneyAction`: the single state-derived action and, when applicable, earliest
   authoritative hold expiry.
4. `Alternatives`: collapsed ranked alternatives with count and rank visible.
5. Recovery, confirmation receipt, or no-results content in the same main region.
6. `WebMcpProof` after the decision path.

### Proof order

When `See WebMCP in action` is expanded, show:

1. A plain-language statement that three separate origins supplied actions.
2. Kiln, Nori, and Loop exact-origin labels and their actual titled demo `/embed`
   iframes.
3. `RouteProof`: deterministic SVG route plus an ordered text equivalent.
4. `ToolActivity`: sanitized observable facts only.

The iframes may need to remain mounted while the visual proof is collapsed so their
tools stay registered. The implementation must use a stable, non-focusable collapsed
host and prove the lifecycle in UI/P0 tests. If the selected browser suppresses a
fully hidden iframe, the proof host remains visually compact rather than unmounting it.

## 4. Hub and Provider state contract

### Hub state presentation

| Hub state     | Main content                                         | Dominant action                | Live Provider behavior                                                               | Announcement / safe recovery                                             |
| ------------- | ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `idle`        | mood prompt and compact constraints                  | Plan my night                  | connection labels; operation `Ready`                                                 | supported/manual mode is named                                           |
| `unsupported` | same usable invitation plus compatibility note       | Plan my night                  | `Manual connection`; never “WebMCP live”                                             | manual path and limits are named                                         |
| `discovering` | stable invitation/result shell with concise progress | none                           | each site becomes `Checking`, then `Found` or `Checked — no match` from real results | per-Provider completion is polite; final result gets focus               |
| `composed`    | one journey, totals, reason, alternatives            | Hold for 90 seconds            | selected Provider results remain `Found`                                             | options ready; selection changes together                                |
| `holding`     | immutable selected summary and Provider progress     | none                           | each site moves `Holding` → `Held` or `Needs attention` only from results            | hold started; durable per-Provider outcomes                              |
| `held`        | final review and earliest-expiry countdown           | Confirm demo reservation       | all three `Held`                                                                     | hold ready and expiry is announced                                       |
| `releasing`   | immutable held summary plus release progress         | none                           | all three known holds project `Releasing` until an authoritative result              | release heading gets focus; confirm and duplicate release are blocked    |
| `confirming`  | locked summary and reconciliation-safe progress      | none                           | `Confirming` → `Confirmed` independently                                             | confirmation started                                                     |
| `reconciling` | explicit uncertain confirm/release notice            | Check status when safe         | affected Provider `Unknown`; known states remain named                               | actual result is being verified                                          |
| `confirmed`   | receipt with three safe references                   | Start over                     | all three `Confirmed`                                                                | receipt gets focus; no secret token                                      |
| `recovering`  | failure, release progress, next candidate            | none until compensation ends   | failed site `Needs attention`; successful holds `Releasing` → `Released`             | failure and compensation progress; incomplete compensation blocks action |
| `no_results`  | constraint explanation without invented inventory    | Adjust search                  | completed checks remain named                                                        | no exact bundle and safe change are named                                |
| `error`       | normalized safe message and retained safe context    | Retry safe step, if one exists | affected sites `Needs attention` or `Unknown`                                        | error summary and safe next step                                         |

Rules:

- Toasts supplement but never replace durable state.
- Pending mutations disable conflicting actions and state what is awaited.
- The countdown uses the earliest Provider expiry, has a textual value, and blocks
  confirmation at zero without relying on color.
- A recovery candidate is explicitly marked `Not held`.
- Confirmed references are safe display references, never Provider hold tokens.
- `Connecting` and operation `Ready` are mutually exclusive in visible and
  accessible compact Provider projections.
- Composed alternatives retain the original deterministic rank labels for the
  lifetime of the candidate set.
- Release or compensation locks are shared by human and Site Tool actions; hiding
  a button is never the sole mutation guard.
- `COMPENSATION_INCOMPLETE` persists only an ISO deadline in session storage and
  never persists a hold token, safe reference, or Provider payload.

### Provider presentation projection

Connection and operation are separate dimensions:

| Runtime fact                                   | Human connection label         |
| ---------------------------------------------- | ------------------------------ |
| document/tool discovery pending                | `Connecting`                   |
| expected exact-origin document discovered      | `Live site`                    |
| denied, offline, timed out, or origin mismatch | `Unavailable` plus safe reason |
| WebMCP unsupported and HTTP gateway selected   | `Manual connection`            |

| Validated operation event                | Human operation label |
| ---------------------------------------- | --------------------- |
| no active or completed operation         | `Ready`               |
| search invoked                           | `Checking`            |
| valid selected/candidate result          | `Found`               |
| valid empty search result                | `Checked — no match`  |
| hold invoked                             | `Holding`             |
| persisted Provider hold returned         | `Held`                |
| confirm invoked                          | `Confirming`          |
| persisted Provider confirmation returned | `Confirmed`           |
| compensation/release invoked             | `Releasing`           |
| persisted release/expiry returned        | `Released`            |
| normalized terminal failure              | `Needs attention`     |
| side-effect result cannot yet be proven  | `Unknown`             |

Every label includes an icon or stamp and accessible text. Provider identity colors
never encode these states. A single projection is shared by the Provider sticker,
its iframe presentation message/view, and the Hub live-region summary.

## 5. Representative layout contract

These wireframes lock order, hierarchy, and disclosure placement. Literal styling
comes from the root `DESIGN.md`.

### Desktop invitation, `>=1280px`

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ SERENDIPITY                              ● 3 sites live via WebMCP  Reset  │
│                                                                            │
│                 WHAT KIND OF TONIGHT?                                      │
│           [ Surprising ✓ ] [ Cozy ] [ Hands-on ] [ Late ]                  │
│                                                                            │
│        Shibuya · solo · after 18:00 · under ¥5,000 · by 22:30              │
│                   ▸ Adjust time & budget                                    │
│                       [ PLAN MY NIGHT → ]                                   │
│                                                                            │
│  [ KILN · Live site · Ready ] [ NORI · Live site · Ready ]                 │
│                         [ LOOP · Live site · Ready ]                        │
│                                                                            │
│                    ▸ See WebMCP in action                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Desktop composed journey

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ SERENDIPITY                              ● 3 sites live via WebMCP         │
│                                                                            │
│ TONIGHT GOT INTERESTING.                  [KILN Found][NORI Found][LOOP Found]│
│ A varied 3-stop route · ¥4,800 · 18:20–22:10                               │
│ ┌ KILN / MINT ───────────────────────────────────────────────────────────┐ │
│ │ 18:20   Small-batch ceramics                                  ¥1,400 │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                    12 min travel · 8 min spare                             │
│ ┌ NORI / YELLOW ─────────────────────────────────────────────────────────┐ │
│ │ 19:40   Counter tasting                                      ¥1,700 │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                     9 min travel · 16 min spare                            │
│ ┌ LOOP / ORANGE ─────────────────────────────────────────────────────────┐ │
│ │ 21:00   Listening room                                      ¥1,700 │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                      [ HOLD FOR 90 SECONDS ]                               │
│                    ▸ Compare 2 alternatives                                │
│                    ▸ See WebMCP in action · 6 events                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### Narrow, `<768px` including `390×844`

```text
┌────────────────────────────┐
│ SERENDIPITY       [3 live] │
│                            │
│ WHAT KIND OF TONIGHT?      │
│ [Surprising ✓] [Cozy]      │
│ [Hands-on]     [Late]      │
│ Shibuya · solo · by 22:30  │
│ ▸ Adjust time & budget     │
│   18:00 · ¥5,000           │
│ [ PLAN MY NIGHT → ]        │
│                            │
│ [KILN · Live · Ready]      │
│ [NORI · Live · Ready]      │
│ [LOOP · Live · Ready]      │
│                            │
│ result / three stop bands  │
│ primary state action       │
│ ▸ Alternatives             │
│ ▸ See WebMCP in action     │
└────────────────────────────┘
```

### Breakpoint rules

- `>=1280px`: centered single journey column up to about 1120px. A compact Provider
  strip may align with the result heading; the proof never becomes a permanent rail.
- `768–1279px`: one decision column. Provider stickers use a three-column row only
  while full names and status labels remain readable.
- `<768px`: header/status, prompt, constraints/action, Provider strip, journey,
  alternatives, proof. Provider iframes stack inside expanded proof with no inner
  horizontal workflow scroll.
- At 320px/200% zoom, the visual route may simplify but the text route remains;
  result and reset headings are brought into view and the primary action remains
  reachable by forward document scroll.
- At 320px, each proof iframe is 20rem high and its embed document fits in both
  axes. The standalone Provider home may retain a 320px minimum width, but that
  minimum must not apply to the embed document.

## 6. Component and ownership boundaries

| Component             | Owns                                                     | Must not own                                              |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `MoodPrompt`          | preference choice presentation and local errors          | intent normalization or network calls                     |
| `ConstraintSummary`   | fixed scope, approved preset selection, disclosure state | intent normalization, network calls, or bundle arithmetic |
| `JourneySummary`      | reason, totals, current durable notice                   | score calculation                                         |
| `StopBandList`        | ordered stops, travel, and spare gaps                    | feasibility logic                                         |
| `JourneyAction`       | state-derived label and disabled semantics               | orchestration decisions                                   |
| `Alternatives`        | candidate comparison and selection event                 | inventory mutation                                        |
| `LiveProviderStrip`   | three Provider projections and aggregate connection copy | tool discovery or business authority                      |
| `ProviderSticker`     | one identity, connection, operation label/stamp          | time-simulated progress                                   |
| `WebMcpProof`         | disclosure, proof ordering, event count                  | tool registration or raw logs                             |
| `ProviderFrames`      | real iframe placement, titles, collapsed-focus behavior  | Provider business state authority                         |
| `RouteProof`          | SVG route and ordered text equivalent                    | live maps/geocoding                                       |
| `HoldCountdown`       | display from authoritative expiry and local clock        | extending or recreating holds                             |
| `ConfirmationReceipt` | safe references and demo notice                          | tokens or raw Provider responses                          |
| `RecoveryNotice`      | failed/released/replacement facts                        | compensation execution                                    |
| `ToolActivity`        | sanitized projection and disclosure                      | prompts, secrets, or hidden reasoning                     |

All components consume explicit view models derived from the Hub state machine and
Provider operation events. They do not read arbitrary iframe text as state.

## 7. Visual contract

The complete token and component rules are in [DESIGN.md](../../DESIGN.md).
Implementation-critical summary:

- light-blue `#DCEEFF` canvas, white paper, black ink/outlines;
- violet `#5C4ADE` single dominant action with white text;
- Kiln mint, Nori yellow, and Loop orange identity tokens with black text;
- 24–36px card radii, pill controls, 1px cutout outline, restrained solid offset shadow;
- 52px minimum control height and 56–64px primary action;
- display type capped by `clamp()`, 16px body minimum, no remote font dependency;
- CSS-first abstract paper-cut decoration only after content and controls;
- identity tokens and semantic status tokens are separate.

### Motion budget

- Allowed: one-time stop insertion, 120–240ms Provider sticker transition/stamp,
  route drawing after composition, and countdown updates without layout shift.
- Disallowed: looping ambient motion, parallax, animated gradients, auto-advancing
  alternatives, fake sequential completion, or motion required to understand state.
- Reduced motion: render final geometry immediately and retain text/status changes.

## 8. Content and localization

- Primary labels state effects, using `Plan my night`, `Hold for 90 seconds`,
  `Confirm demo reservation`, `Release hold`, `Check status`, or `Start over` as
  applicable.
- Generic identity says `Three Provider sites`; provenance says `Site Tool` or
  `Manual fallback` only when that transport is known.
- Manual mode states both facts: availability came through Provider APIs and no
  Site Tool call occurred.
- Before hold, visible copy includes `Temporary demo hold`, `No payment`, and
  `No real booking` semantics; equivalent wording is acceptable when all three
  meanings remain explicit.
- Alternatives use stable `Route 1`, `Route 2`, and `Route 3` labels and include
  time, price, travel, and activity titles.
- Confirmation clearly says it is a demo and no payment occurs.
- Tokyo-local time format and JPY formatting remain consistent.
- Travel minutes and spare gap minutes are named separately.
- Technical proof uses plain language before tool/origin metadata.
- Errors identify the safe next action without transport internals, credentials, or
  raw tool output.
- Long Provider/activity names and 200% zoom wrap without hiding actions.
- The unsupported/manual warning may wrap across lines below 768px and must not
  clip its strong label or explanation at 320px.

## 9. Accessibility contract

- One `main` landmark and logical headings; visual scale does not set heading level.
- Timeline/stops use an ordered semantic list; route has equivalent ordered text.
- Every iframe has a stable title naming Provider and purpose.
- Material status changes use a polite live region. Confirmation, expiry, and
  incomplete compensation use assertive announcement only when interruption is needed.
- Focus moves only after user actions: to options/result after search, hold review
  after success, release heading during release, recovery/error/no-result notice,
  receipt after confirmation, and invitation after adjust/start-over. Alternative
  selection targets the updated route summary instead of `body`. Background
  Provider events never steal focus.
- Every transition focus uses deterministic start alignment without smooth
  animation; pending animation-frame work is cancelled when state changes again.
- Native controls are preferred. Disclosures expose expanded state and operate with
  keyboard defaults. Collapsed proof descendants are not tabbable.
- The time and budget choices use labeled native radio groups or equivalent
  single-select semantics; focus order follows disclosure summary, time group,
  budget group, then the existing plan action.
- Visible focus and WCAG AA contrast are token gates. Status always includes text or
  icon plus text; hue alone is insufficient.
- Touch targets are at least 44×44 CSS pixels, with approved primary controls larger.

## 10. Performance, lifecycle, and privacy

- Invitation content renders without waiting for Provider discovery.
- Provider connection/status changes reserve stable layout space.
- Real Provider frames use exact configured origins and `allow="tools"`; unexpected
  origins never receive a visual fallback that looks connected.
- Collapsing proof must not unregister tools. Navigation/unmount must unregister stale
  tools and require rediscovery before the next mutation.
- No map SDK, autoplay media, image-heavy hero, required illustration, remote font,
  Realtime subscription, or general cache client is in the critical path.
- Inventory and hold state are not visually cached past expiry/reconciliation.
- Screenshots, activity, errors, and traces exclude tokens, idempotency keys, raw
  prompts, service credentials, and internal reasoning.

## 11. Verification contract

Canonical fixtures freeze or mask countdowns, timestamps, and correlation IDs in
visual comparisons. Exact executable cases live in [test-matrix.md](./test-matrix.md).

| IDs          | Focus                                                           | Required evidence                                           |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------------- |
| `UI-001–008` | canonical, fallback, and activity journeys                      | functional component/E2E results                            |
| `UI-009–013` | keyboard, semantics, axe, reduced motion, responsive layout     | 1440 and 390, plus specified intermediate widths            |
| `UI-014–015` | operation bounds and full demo                                  | staging timing and recording                                |
| `UI-016–020` | approved baselines, identity, one action, zoom, Provider faults | deterministic visual/component/E2E evidence                 |
| `UI-021`     | Sticker Network first-view hierarchy                            | no dashboard rail; one invitation/result and action         |
| `UI-022`     | event-derived Provider stickers                                 | no timer/CSS success; independent named progress            |
| `UI-023`     | real proof disclosure                                           | exact origins, titled iframes, route text, safe activity    |
| `UI-024`     | Provider identity/state separation                              | same identity across sticker/stop/embed; non-color status   |
| `UI-025`     | authoritative hold/confirm/recovery stamps                      | no premature success; compensation visible                  |
| `UI-026`     | honest manual mode                                              | no false WebMCP connection claim                            |
| `UI-027`     | judge legibility                                                | three sites, states, and proof understood within 10 seconds |
| `UI-028`     | closed bounded presets                                          | exact values/defaults, no request on change, one action     |
| `UI-029`     | preset outcome and intent parity                                | exact nine-case matrix and visible effective constraints    |
| `UI-030`     | provenance and connection clarity                               | neutral identity, honest manual notice, no Connecting+Ready |
| `UI-031`     | pre-hold scope clarity                                          | temporary demo, no payment, and no real booking before hold |
| `UI-032`     | stable alternative identity                                     | Route 1/2/3 never renumber; complete comparison facts       |
| `UI-033`     | result transition focus at 320px/200%                           | route summary focused and heading intersects viewport       |
| `UI-034`     | reset/adjust focus and scroll                                   | invitation heading focused and visible from prior position  |
| `UI-035`     | release lock, retry, and authoritative status                   | one POST; zero conflicting mutation; safe terminal mapping  |
| `UI-036`     | 90-second compensation guard                                    | session reload persistence; zero auto request; fresh-search |
| `UI-037`     | narrow warning and proof containment                            | no internal overflow; essential Provider facts visible      |
| `UI-038`     | alternative transition focus                                    | updated stable Route summary focused; no body fallback      |

Manual visual review remains a recommended release-quality supplement for
hierarchy, copy clarity, focus visibility, color balance, stop/Provider identity
correspondence, and whether the WebMCP proof is obvious without overwhelming the
journey. It is not a T095 acceptance or score gate.

For T095, deterministic component, fixture, accessibility, and visual evidence is
the acceptance gate. Human sessions may provide supporting research but are not
required to implement, release, or report the bounded UX slice.

## 12. Design research and selected direction

The initial Field Guide recommendation was rejected because its multi-column form,
small labels, timeline, map, iframe rail, and activity panel read as functional
software rather than a lightweight invitation.

A second comparison used six lightweight DESIGN.md references and real-product
patterns. The user selected **C. Sticker City**, based on Slush, because its bold
outlines, shared sticker palette, and outgoing energy match a playful MVP. The final
contract is **C2. Sticker Network**: it adopts that visual language and adds a visible,
truthful WebMCP system.

| Direction                       | Outcome                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| A. Big Night / MindMarket       | strong simplicity, but less distinctive for the three-site network story      |
| B. Pastel Stops / Aboard        | safe and friendly, but trends toward generic SaaS                             |
| **C2. Sticker Network / Slush** | selected; strongest mood and clearest identity bridge between sites and stops |

Artifacts:

- [Six-candidate lightweight preview](../../work/design-md-scout/serendipity-light-ui/preview.html)
- [Three-direction product preview](../../work/design-md-scout/serendipity-light-ui/product-preview.html)
- [Rendered product comparison](../../work/design-md-scout/serendipity-light-ui/product-preview-full.png)
- [Candidate notes and sources](../../work/design-md-scout/serendipity-light-ui/candidate-notes.md)
- [Lazyweb evidence report](../../.lazyweb/design-improve/serendipity-hub-2026-08-27/report.html)

Primary reference: [Slush](https://styles.refero.design/style/8b6b547f-a357-4f1b-9842-4579c62dd42b).
Supporting hierarchy evidence came from Partiful, PamPam, Luma, and Fever as listed
in the root `DESIGN.md`. References are inputs, not copied production assets.

## 13. T008 approval record

- [x] User approved the experience principles and experience/proof hierarchy.
- [x] User selected direction C and approved its refinement as Sticker Network.
- [x] Representative desktop and narrow hierarchy is locked by the wireframes above.
- [x] Every Hub state has a primary action, Provider behavior, announcement, and safe recovery rule.
- [x] Provider `/` and `/embed` scope and identity treatment are accepted.
- [x] Responsive ordering at 1440, 1024, 390, and 320/200% zoom is defined.
- [x] Accessibility and reduced-motion behavior are implementation constraints.
- [x] UI-001–027 cover the approved states and visual requirements.
- [x] The approved change is reconciled into `DESIGN.md`, `spec.md`, `plan.md`,
      `tasks.md`, and `test-matrix.md` before component code starts.

T008 is complete. At approval time its next implementation gate was T019: record
supported Sol/Terra Site Tools evidence, select `nested` or `direct`, and pin the
execution encoding before post-Phase-0 implementation. That historical gate is
now complete; it does not authorize or complete the later T095 amendment.

## 14. T095 authorization record

- [x] User authorized the bounded time/budget and clarity scope on 2026-08-29.
- [x] Start presets are locked to 18:00, 18:30, and 19:00; budget presets are
      locked to ¥4,500, ¥5,000, and ¥6,000; defaults remain 18:00 and ¥5,000.
- [x] Shibuya, one person, 22:30 end boundary, and synthetic Provider network stay
      fixed; region, party size, and real Provider onboarding remain version 2.
- [x] T093/T096 human studies are optional supporting research, not T095 or score
      blockers.
- [x] T095 implementation and UI-028–032/IMP-003 automated evidence pass.

T095 is complete within this bounded scope. Its evidence does not authorize
region, party-size, real-Provider, or payment expansion.

## 15. T098–T101 authorization record

- [x] User authorized the seven-issue UI-completeness repair on 2026-08-29.
- [x] UI-033–038 lock deterministic focus, release/compensation safety, and narrow
      proof/warning containment without changing T095 product scope.
- [x] T098 specification reconciliation, T099 implementation, and T100 focused
      automated acceptance pass locally.
- [x] T101 redeploys Hub/Kiln/Nori/Loop and closes the production confirm/release
      reliability matrix, mandatory reset, and post-reset read-only baseline.

T095 remains historically complete. This follow-up does not authorize sticky
actions, a layout redesign, payment, new regions, party sizes, or real Provider
onboarding.

## 16. Commercial Sticker Editorial authorization record

- [x] User authorized the full commercial productization plan on 2026-08-29.
- [x] Public information architecture is locked to static `/` plus stateful
      `/plan`; results, holds, release, recovery, and receipt remain one planner
      document.
- [x] Devpost, README, and demo instructions point directly to `/plan`; the root
      landing registers no Site Tools.
- [x] The selected visual direction is Sticker Editorial: existing Provider
      colors and large display type, one maximal hero, calmer editorial sections,
      original cut-paper illustrations, and real product captures.
- [x] The six-candidate commercial preview is stored at
      `work/design-md-scout/serendipity-commercial/preview.html`; Slush remains the
      primary source, with MindMarket/Aboard used only for spacing and restraint.
- [x] Landing claims remain Shibuya/solo/demo/no-payment and use no testimonials,
      fake usage counts, maps, pricing, or real-venue photography.
- [x] Planner interaction preserves one dominant action, exact presets, safe
      release/recovery, and truthful Manual fallback/Site Tool provenance.
- [x] UI-039–048 and SC-018–024 define commercial acceptance; required task count
      expands to 96 and no new task is complete from specification text alone.
