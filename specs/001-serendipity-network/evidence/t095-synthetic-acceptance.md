# T095 non-human synthetic acceptance

**Date**: 2026-08-29 JST  
**Execution window**: 00:59:21–01:03:06 JST
(`2026-08-28T15:59:21Z`–`16:03:06Z`)  
**Evidence class**: NON-HUMAN, rendered-UI-only synthetic product QA  
**Target**: `https://serendipity-phase0-hub.vercel.app/`  
**Result**: PASS — goal completion **5/5**; critical comprehension **4/5**

This record is deliberately not a human study and makes no claim about demand,
delight, willingness to pay, Provider adoption, or real-world impact. It closes
the automated/synthetic acceptance gate approved for T095 only.

## Isolation and method

- The evaluator used the Codex in-app browser and only the rendered accessible
  page state, visible labels, and controls.
- Source code, tests, specifications, and existing evidence were not inspected
  until all ten runs below had finished.
- Every run began in a fresh browser tab. No state was carried from another
  run.
- Searches were read-only. `Hold for 90 seconds` and `Confirm` were never
  activated, so the run made **zero production mutations**.
- The browser did not expose WebMCP. The visible banner therefore identified
  the path as `3 Provider APIs · manual mode` and explicitly said that no Site
  Tool call was claimed.
- An initial local-target probe is preserved: `http://127.0.0.1:3001/` rendered
  an unrelated `Personal OS` email-login screen. It was rejected before any
  interaction or scoring. The acceptance run then used the current production
  app read-only.

## Gate A — five fresh goal-only sessions

The evaluator received the goal sentence only, then used labels and controls
visible in that fresh tab. A pass required reaching the stated outcome without
source knowledge, invented availability, or a production mutation.

| Run | Exact goal prompt                                                                         | Visible actions                                                                                       | Outcome                                                                                                                                                                                                                          | Result |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| S1  | `Make me a surprising solo Shibuya night with the defaults.`                              | `Plan my night`                                                                                       | Route 1 appeared with three named stops, 18:15–22:00, ¥4,500; the displayed constraint was Shibuya · solo · 18:00–22:30 · up to ¥5,000.                                                                                          | PASS   |
| S2  | `Give me a cozy plan starting 18:30 within ¥6,000.`                                       | Cozy → `Adjust time & budget` → 18:30 → ¥6,000 → `Plan my night`                                      | A cozy Route 1 appeared with three stops, 18:30–22:00, ¥5,200.                                                                                                                                                                   | PASS   |
| S3  | `Plan from 19:00 within ¥5,000; if nothing fits, recover to a workable plan.`             | `Adjust time & budget` → 19:00 → `Plan my night` → `Adjust search` → 18:30 + ¥6,000 → `Plan my night` | First result honestly said all three sites were checked and nothing fit; no partial route was shown. Recovery produced a three-stop Route 1 at ¥5,200.                                                                           | PASS   |
| S4  | `Compare the alternatives and choose Route 2 without losing route identity.`              | `Plan my night` → `Compare 2 alternatives` → compare titles/time/price/travel → Route 2               | The selected header remained `Route 2`; the remaining choices stayed `Route 1` and `Route 3`. Route 2 showed its own activities, 18:15–22:10, ¥4,300, and 38 min travel.                                                         | PASS   |
| S5  | `Decide whether it is safe to proceed to a hold without paying or making a real booking.` | `Plan my night` → read the pre-Hold explanation → stop before mutation                                | The page stated demo only, no payment, a temporary 90-second hold, and not a confirmed reservation. The next button was `Hold for 90 seconds`. This is the approved read-only safe equivalent, not a runtime hold/release claim. | PASS   |

**Goal-only completion: 5/5.** The acceptance threshold was at least 4/5.

## Gate B — five fresh visible-copy comprehension checks

Each check used a new tab and the same five questions. Answers were scored only
when the currently visible copy supported them.

1. In this browser, where did availability come from, and was a Site Tool used?
2. What would Hold do, and for how long?
3. Would this take payment or create a real/confirmed booking?
4. What location and party-size scope is fixed?
5. What is the next primary action?

Expected rendered-copy answers were:

- three separate Provider APIs in Manual fallback; no Site Tool call claimed in
  this browser;
- temporarily set the three available stops aside for 90 seconds;
- demo only, no payment, and not a confirmed reservation;
- Shibuya and solo;
- `Plan my night` on the invitation, or `Hold for 90 seconds` on a recommendation.

| Check | Fresh visible state                     | Provenance | 90-sec temporary Hold |                                      No payment + no real booking | Shibuya + solo |                  Next action | Critical bundle |
| ----- | --------------------------------------- | ---------: | --------------------: | ----------------------------------------------------------------: | -------------: | ---------------------------: | --------------: |
| C1    | Invitation only                         |       PASS |  FAIL — not yet shown | FAIL — no payment was shown, but no-real-booking was not explicit |           PASS |       PASS — `Plan my night` |            FAIL |
| C2    | Default Route 1 recommendation          |       PASS |                  PASS |                                                              PASS |           PASS | PASS — `Hold for 90 seconds` |            PASS |
| C3    | Cozy, 18:30, ¥6,000 recommendation      |       PASS |                  PASS |                                                              PASS |           PASS | PASS — `Hold for 90 seconds` |            PASS |
| C4    | Route 3 selected with alternatives open |       PASS |                  PASS |                                                              PASS |           PASS | PASS — `Hold for 90 seconds` |            PASS |
| C5    | Hands-on recommendation                 |       PASS |                  PASS |                                                              PASS |           PASS | PASS — `Hold for 90 seconds` |            PASS |

Per-dimension results:

- Provider API / Manual fallback / no-Site-Tool provenance: **5/5**;
- temporary 90-second Hold: **4/5**;
- no payment and no real/confirmed booking: **4/5**;
- fixed Shibuya and solo scope: **5/5**;
- correct next action: **5/5**;
- full critical bundle of provenance + Hold + no-payment/no-booking: **4/5**.

The critical comprehension threshold was at least 4/5, so the gate passes.
The one strict failure is retained rather than normalized away: before a plan
exists, the invitation says `Demo only · no payment` but does not yet explain
Hold duration or explicitly say that no real booking occurs. That explanation
does appear immediately before the first Hold action.

## Observed product facts

- The default path remained a three-action-shaped journey: Plan, Hold, Confirm;
  this read-only acceptance stopped before mutation.
- The one closed disclosure exposed only three start-time and three budget
  presets while keeping Shibuya and solo fixed.
- The 19:00 + ¥5,000 combination produced an honest no-result with a single
  `Adjust search` recovery action.
- Alternative cards exposed activity titles, time range, total price, and
  travel before selection; route numbering remained stable after selection.
- Provider state never displayed `Checking` and `Ready` simultaneously in the
  captured rendered states.

## Limitations and claim boundary

- Five runs are five isolated synthetic sessions from one model evaluator, not
  five independent people.
- The run validates clarity and task mechanics in rendered UI; it cannot replace
  consumer discovery or Provider interviews for a Potential Impact claim.
- Because production mutation was forbidden, S5 verifies the pre-Hold decision
  boundary only. Actual Hold/Confirm/release reliability is covered separately
  by the production 20/20 mutation evidence.
- The manual-fallback provenance was tested. A WebMCP-enabled Sol/Terra Site Tool
  presentation was not available in this browser and is not claimed here.
- Region choice, party size, real inventory, payment, and real Provider
  connections remain outside T095.
