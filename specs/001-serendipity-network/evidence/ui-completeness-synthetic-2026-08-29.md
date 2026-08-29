# UI completeness synthetic acceptance — 2026-08-29

## Verdict

The fixed production Hub passed the synthetic, goal-only UI gate without a
human participant:

- goal completion: **4/5**
- critical comprehension: **4/5**
- production mutations: **0**
- observed execution mode: **manual Provider-API fallback**; no Site Tool call
  was claimed

Both required thresholds (`>= 4/5`) passed. One failure is intentionally
preserved: before Hold, the page explains the source, 90-second lifetime,
no-payment status, and non-reservation status, but it does not state the next
recovery action if Hold fails.

## Method

- Target: `https://serendipity-phase0-hub.vercel.app/`
- Surface: rendered production UI and accessibility tree only
- Browser viewport: 320 x 568 for every counted session
- Freshness: each counted session began in a newly created top-level tab
- Mutation guard: no Hold, Confirm, Release, reset, or other mutation control
  was invoked
- Source isolation: repository source, specifications, and tests were not read
  until all five sessions had finished

An initial viewport setup attempt opened at 1280 x 720 and was discarded before
scoring. It is not counted among the five sessions below.

## Goal-only sessions

| Session | Goal                                                                              | Result                      | Rendered evidence                                                                                                                                                                                                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | Create the default plan at 320 px and identify the result title and route context | **Pass**                    | `Tonight got interesting.` rendered at y=23.13–104.34. `Your three-stop route · Route 1` intersected the viewport at y=-0.17–14.33, and the focused element was the full `.journey-summary`. Document width was exactly 320 px with no horizontal overflow.                                                                          |
| 2       | Choose 19:00, reach the honest no-result state, then use Adjust search            | **Pass**                    | The no-result screen stated that all three sites were checked and offered `Adjust search`. After activation, focus moved to `#mood-heading`; the invitation rendered at y=15.98–151.33 and `Plan my night` at y=457.31–517.31, both inside the 568 px viewport.                                                                      |
| 3       | Choose Route 2 and understand what changed without losing its number              | **Pass**                    | The selected summary became `Route 2`; time/price changed from `18:15–22:00 · ¥4,500` to `18:15–22:10 · ¥4,300`. Alternatives remained explicitly numbered Route 1 and Route 3. Focus moved to the updated journey summary instead of `BODY`.                                                                                        |
| 4       | Open architecture proof at 320 px and read all Provider proof                     | **Pass**                    | Kiln Studio, Nori Counter, and Loop Room each exposed identity, `Manual connection`, `Ready`, and `Waiting for a Serendipity request`. Every iframe measured 248 x 318 internally; for all three, `scrollWidth = clientWidth = 248` and `scrollHeight = clientHeight = 318`. No proof content required an internal scroll.           |
| 5       | Decide whether Hold is safe without activating it                                 | **Fail (bounded copy gap)** | The UI clearly said the data came from three Provider APIs in manual mode; Hold would temporarily set aside all three stops for 90 seconds; no payment would be taken; and this was not a confirmed reservation. It did not explain the next recovery action if Hold failed, so the complete goal was not met. Hold was not clicked. |

## Critical comprehension

| Question                                      | Understood from the rendered UI? | Evidence                                                                                           |
| --------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Where did the plan come from?                 | **Yes**                          | `3 Provider APIs · manual mode`, three named Provider states, and the explicit no-Site-Tool notice |
| What does 90 seconds mean?                    | **Yes**                          | A temporary Hold sets all three available stops aside for 90 seconds                               |
| Will payment be taken?                        | **Yes**                          | `Demo only · no payment will be taken`                                                             |
| Is this already a real booking?               | **Yes**                          | `it is not a confirmed reservation`                                                                |
| What is the recovery next step if Hold fails? | **No**                           | No pre-Hold recovery instruction was present                                                       |

Critical comprehension therefore passed at **4/5**. This does not claim that
the fifth item was understood or infer a recovery action not shown by the UI.

## Read-only and mode evidence

The final session's visible sanitized activity ledger contained exactly one
event:

- `Manual search three providers`
- `Manual fallback · Complete`

No Hold, Confirm, Release, reset, token, or raw Provider payload appeared. The
five sessions therefore validate the production fallback UI, not native
Sol/Terra Site Tools availability and not the mutation path.

## Closure decision

The automated acceptance gate is satisfied at 4/5 goals and 4/5 critical
comprehension. The remaining recovery-copy gap is non-blocking under the agreed
threshold but should remain visible in any final UI-quality score; it must not
be rewritten as a 5/5 result.
