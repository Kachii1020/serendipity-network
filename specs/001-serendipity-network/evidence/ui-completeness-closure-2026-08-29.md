# T098–T101 UI completeness closure

**Date**: 2026-08-29 JST  
**Status**: PASS — implemented, deployed, and dual-path production reliability verified  
**Live Hub**: `https://serendipity-phase0-hub.vercel.app/`

## Closed defects

- Search, Hold, Release, receipt, error, no-result, reset, recovery, and
  alternative selection focus exact durable headings and reveal them with
  non-animated start alignment; initial load does not steal focus.
- A 320×568 result begins with its Route context instead of the middle of the
  stop list. `Adjust search` returns to the visible invitation heading.
- `releasing` is a real busy phase: Confirm, duplicate Release, Reset, and
  conflicting Site Tool mutations are blocked before a second request.
- Retryable Release failure retains the same hold for one idempotent retry;
  non-retryable failure uses the validated owned bundle-status endpoint and can
  project only Released/Expired, Confirmed receipt, Held retry, or locked mixed
  state.
- Incomplete Hold compensation persists only an ISO timestamp in sessionStorage,
  blocks every mutation for the remaining 90-second safety window after reload,
  makes no automatic request or release claim, and then exposes only fresh search.
- The 320px manual warning wraps without clipping. All three proof documents fit
  their 20rem frames in both axes and preserve Provider identity, connection,
  operation, and latest action.
- Selecting an alternative preserves Route numbering and moves focus to the new
  Route summary instead of `BODY`.

No DB migration, external Site Tool name/input, REST path, Provider business
contract, Shibuya/solo boundary, or primary visual hierarchy changed.

## Final deployments

| Role | Deployment                         | State/region   |
| ---- | ---------------------------------- | -------------- |
| Hub  | `dpl_7i8KYoyjqzk8CYbKgMhYZjd3712U` | READY / `hnd1` |
| Kiln | `dpl_3YDeGAFgXTDQEUW36D8zb78BbKbu` | READY / `hnd1` |
| Nori | `dpl_J8ss1JZJgFbNL1uNESQiUUsWDzW6` | READY / `hnd1` |
| Loop | `dpl_4EcvAeh4DDW5utd6YYWD3gTGTEJS` | READY / `hnd1` |

All fixed aliases return HTTP 200.

## Local and fixed-production gates

| Gate                            | Result                                        |
| ------------------------------- | --------------------------------------------- |
| Format, lint, typecheck, Vitest | pass; 39 files, 187/187; 8/8 workspaces       |
| Production builds               | 8/8                                           |
| Focused reducer/component       | 28/28                                         |
| Focused UI-completeness browser | 13/13 local; 8/8 fixed production read-only   |
| Chrome WebMCP/product           | 27/27                                         |
| Accessibility/responsive/200%   | 9/9 local and 9/9 fixed production            |
| Visual baselines                | 10/10 local and 10/10 fixed production        |
| Public assets/runtime security  | 50 assets plus 4/4 local and fixed production |
| Exact production preset matrix  | 9/9                                           |

Existing visual tests no longer call `scrollTo(0, 0)` after result/Held
transitions. New baselines preserve the real automatic focus position at 320px.

## Post-fix UI completeness score

The same frozen rubric used by the pre-fix audit now scores **93/100**, up from
78/100:

| Area                                     | Before | After |
| ---------------------------------------- | -----: | ----: |
| Visual integrity and responsive geometry |  15/20 | 19/20 |
| First-use clarity and cognitive load     |  13/15 | 13/15 |
| System status, provenance, and trust     |  12/15 | 14/15 |
| Interaction safety and state transitions |   9/15 | 14/15 |
| Results, comparison, error, and recovery |  12/15 | 14/15 |
| Accessibility, keyboard, touch, and zoom |   7/10 |  9/10 |
| Reliability and perceived performance    |  10/10 | 10/10 |

The remaining seven points are the explicitly deferred P3 polish and current
Site Tools client availability—not any known blocker in the primary manual or
Chrome WebMCP product paths.

## Non-human production acceptance

- goal-only completion: **4/5**;
- critical source/Hold/no-payment/recovery comprehension: **4/5**;
- production mutation: **0**;
- observed mode: truthful manual Provider-API fallback.

The retained failure is precise: pre-Hold copy explains source, 90 seconds, no
payment, and not-yet-confirmed status, but not the recovery action if Hold fails.
The agreed 4/5 gate passes; this result is not relabeled 5/5 and is not human
usability evidence. See `ui-completeness-synthetic-2026-08-29.md`.

## Production Confirm reliability

- complete receipts and three-Provider `HELD → CONFIRMED`: **20/20**;
- unique safe correlations: **201/201**; missing/duplicate/invalid/unknown: **0**;
- click-to-receipt p50/p95/max: **844/1,002/1,740 ms**;
- search/hold/confirm p95: **334/330/437 ms**;
- Provider Held/Confirmed p95: **164/158 ms**;
- proof/reset p95: **161/150 ms**;
- mandatory final reset restored **9 slots**.

Only the exact first-load Hub/Kiln/Nori/Loop favicon 404s were ignored. No other
browser event was accepted.

## Production Release reliability

- complete Release workflows and three-Provider `HELD → RELEASED/EXPIRED`:
  **20/20**;
- central `Releasing` state observed: **20/20**;
- terminal `requiresFreshSearch`: **20/20**;
- Confirm endpoint requests: **0**; Release endpoint requests: exactly one per
  run;
- unique safe correlations: **201/201**; missing/duplicate/invalid/unknown: **0**;
- click-to-release p50/p95/max: **1,020/1,248/1,468 ms**;
- search/hold/release p95: **373/407/633 ms**;
- Provider Held/Released p95: **167/165 ms**;
- proof/reset p95: **264/193 ms**;
- mandatory final reset restored **9 slots**.

After the Release final reset, a separate production read-only search passed
**20/20** at p50 **134 ms**, p95 **252 ms**, max **374 ms**, with zero invalid or
non-2xx envelopes and 20 unique correlations.

## Safety and claim boundary

- The production harness retained exact origin/mode opt-ins, Keychain-only
  operator secret loading, per-request hard deadlines, stop-on-first-error,
  browser termination verification, 12-second quiescence, and mandatory reset.
- Session storage contains only `serendipity-compensation-blocked-until-v1` with
  an ISO timestamp; public scans found no token or credential field.
- This closure does not claim real Sol/Terra Site Tools execution. The current
  client still exposes no `document.modelContext`; T082/T085/T089/T090 remain
  open and separate.
