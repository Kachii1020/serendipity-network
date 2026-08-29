# Hackathon readiness and first-use audit

**Date**: 2026-08-28  
**Target**: OpenAI The WebMCP Challenge  
**Status**: Repeatable production product workflow and bounded UX pass;
judge-visible real-model WebMCP remains at risk

**Score-lift response**: [Draft plan to reach 20+ per criterion](../score-lift-plan.md)

**Resolution update (2026-08-29)**: five top-level Hub product tools are now
deployed, Provider iframes carry `allow="tools"`, protected reset is repeatable,
all lambdas run in `hnd1`, and current-Tokyo inventory has capacity 20. The
original findings below are preserved as the pre-change baseline. Fixed
production mutation reliability now passes 20/20 with Provider status proof,
p95 bounds, mandatory final reset, and a healthy post-reset baseline. T095 also
passes its exact preset matrix, shared Intent, clarity, accessibility, visual,
and post-deploy 20/20 gates. Real Sol/Terra 3/3 Site Tools and public submission
packaging remain open; human study execution is optional supporting evidence.

## Method

This audit combines four independent evidence classes:

1. The official, equally weighted judging criteria in the
   [Devpost rules](https://webmcp.devpost.com/rules): WebMCP Leverage,
   Execution, Potential Impact, and Creativity & Ambition.
2. The official OpenAI interpretation of usefulness, originality, execution,
   thoughtful WebMCP use, and human-agent experience quality in the
   [challenge FAQ](https://openai.com/webmcp-challenge/).
3. A production cognitive walkthrough and one authorized database-backed
   `search → hold → confirm` run.
4. Source review against the current
   [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
   plus the repository's test matrix and evidence ledger.

The official rules do not publish a numeric scoring scale. The table below is
an evidence-calibrated proxy that maps the four equally weighted criteria to
25 points each; it is not an organizer-issued score.

## Pre-change judging proxy

| Official criterion    |      Proxy | Defensible range | Evidence-based reason                                                                                                                                              |
| --------------------- | ---------: | ---------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WebMCP Leverage       |      14/25 |            11–17 | Non-trivial tool, origin, schema, and mutation design; however, the verified product run used manual HTTP and production Provider iframes do not delegate `tools`. |
| Execution             |      18/25 |            16–20 | A coherent 3-click production flow completed in about 76 seconds with all requests succeeding; repeatability, p95, and submission packaging remain open.           |
| Potential Impact      |      13/25 |            11–15 | Cross-site evening composition and atomic reservation solve a recognizable problem, but the MVP uses a fixed 2030 Shibuya/solo fixture and demo inventory.         |
| Creativity & Ambition |      22/25 |            20–23 | Three independent origins, coordinated reversible holds, safe references, compensation, and the Sticker Network proof are distinctive and ambitious.               |
| **Total**             | **67/100** |        **58–75** | Strong architecture and originality; current live WebMCP proof, real-world scope, and repeatable judging path cap the score.                                       |

Stage 1 theme/API eligibility is likely to pass from the code and Phase 0
evidence, but the final product demonstration is amber: the primary product
URL has not completed a live agent-driven WebMCP workflow in the available
in-app browser.

## Production completion evidence

One authorized run started from a fresh page and completed the default
`Surprising` journey:

- Interaction path: `Plan my night → Hold for 90 seconds → Confirm demo reservation`.
- Dominant action clicks: 3; no backtrack or retry.
- Page entry to confirmed receipt: approximately 76 seconds, below the
  three-minute target.
- Proof disclosure: one action, approximately 0.8 seconds.
- Hub POSTs: search, hold, and confirm all returned HTTP 200.
- Provider POSTs: 3 searches, 3 holds, and 3 confirmations all returned HTTP 200.
- Final UI: Kiln, Nori, and Loop all displayed `Confirmed`; the receipt exposed
  only three Provider-safe reservation references.
- Browser console: no error or warning during the final workflow.

This is one scripted production success, not a human first-use success rate.
No first-time participant has yet attempted the workflow without guidance.

## Quantified first-use and UI assessment

| Measure                                   | Observed result                            | Interpretation                                                               |
| ----------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| Initial in-viewport controls at 1280×720  | 6: home, 4 moods, 1 CTA                    | Low decision load and one obvious primary action                             |
| Default completion actions                | 3                                          | Economical canonical flow                                                    |
| Initial visible product copy              | approximately 609 characters               | Compact enough for a lightweight MVP                                         |
| WebMCP proof position at 1280×720         | top at 742px, 22px below viewport          | Product task stays primary, but the judging proof is not immediately visible |
| Proof open time                           | approximately 0.8 seconds                  | Under the 10-second mechanical disclosure target                             |
| Responsive automated coverage             | 1440×900, 1024×768, 390×844, 320×720, 200% | No tested horizontal workflow overflow                                       |
| Automated canonical production completion | 1/1                                        | Functional signal only; sample too small for a reliability rate              |
| Unmoderated first-time participants       | 0                                          | “Users never get lost” remains unproven                                      |

Heuristic scores, separated so visual simplicity does not hide product risks:

| Dimension                         |      Score | Main reason                                                                                             |
| --------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------- |
| Completion economy                |       9/10 | 3 dominant clicks and one primary action per state                                                      |
| Visual/cognitive simplicity       |       8/10 | 4 large mood choices, compact constraints, technical detail collapsed                                   |
| First-use clarity                 |       7/10 | Goal and CTA are clear; fixed constraints look descriptive rather than editable                         |
| Accessibility/state feedback      |       6/10 | Strong semantics and status copy, but incomplete focus movement and noisy countdown live region         |
| WebMCP proof credibility          |       4/10 | Current environment says manual, human CTA uses manual route, and Provider iframe delegation is missing |
| **Overall source/flow heuristic** | **6.8/10** | Simple product surface, incomplete proof of the event-defining mechanism                                |

## Material findings

### P0 — submission and demo blockers

1. `apps/hub/components/product/webmcp-proof.tsx:93` — the three production
   Provider iframes omit `allow="tools"`. Production DOM inspection confirmed
   `allow === null` for Kiln, Nori, and Loop. The Phase 0 harness delegates this
   permission, but the product proof does not, so the selected direct-mode agent
   cannot rely on those embedded Provider tools from the product URL.
2. `apps/hub/components/product/hub-client.tsx:449` — the human
   `Plan my night` action always calls `/api/manual/search`; the verified
   product completion therefore demonstrates the fallback, not live WebMCP.
3. The repository root is not currently a Git repository and contains no root
   `README` or `LICENSE`; no public YouTube demo URL is recorded. Against the
   four observable submission artifacts—live URL, public repo, visible license,
   and under-three-minute public video—only the live URL is presently verified.
4. Canonical Kiln/Nori/Loop slots each started with capacity 2. The production
   confirmation consumed one of each, so only one identical canonical
   confirmation remains. `DEMO_MODE` is absent and there is no established
   private production reset procedure. No further production confirmation
   should run before repeatability is resolved.

### P1 — score caps

1. `apps/hub/components/product/hub-client.tsx:73` and
   `packages/test-fixtures/src/index.ts:3` — intent is fixed to
   2030-05-17, Shibuya, solo, ¥5,000, and 22:30; users can change only mood.
   This is a credible protocol/demo prototype, not yet a general “tonight”
   planner.
2. `apps/hub/components/product/hub-client.tsx:399` — WebMCP-ready presentation
   can be reached from Hub registration and iframe binding without proving that
   all three Provider toolsets are visible to the agent.
3. `apps/hub/components/product/hub-client.tsx:211` — focus moves to the final
   receipt only. Search result, held review, recovery, no-result, and error state
   transitions do not meet the focus movement contract in `ui-plan.md`.
4. `apps/hub/components/product/hold-countdown.tsx:38` — the 1-second countdown
   is a polite live region, potentially announcing every tick to screen readers.
5. `apps/hub/components/product/journey.tsx:59` — the result summary always says
   `A surprising 3-stop route`, even after selecting Cozy, Hands-on, or Late.
6. `apps/hub/components/product/product-view.tsx:174` — the disclosure remains
   `See WebMCP in action` in manual mode. The banner is honest, but the two
   messages create avoidable cognitive tension.
7. `apps/hub/app/layout.tsx:8` — no page `theme-color` metadata is defined; this
   is a minor current Web Interface Guidelines gap rather than a task blocker.

## Evidence coverage and what it does not prove

- Directly verified matrix IDs after the production rehearsal: 138/167 (82.6%).
- Strong automated evidence: 151/151 unit/integration tests, 68/68 database
  assertions, 15/15 Phase 0 Chrome tests, 8/8 accessibility/responsive tests,
  7/7 visual cases, and the public-surface security checks.
- Still unrun: PA-012, HO-016, UI-014, AE-001–012, and SEC-013.
- P0-018/019 remain environment-blocked in the available in-app browser.
- The test named keyboard canonical flow checks the skip link and proof
  disclosure, not keyboard `Plan → Hold → Confirm`.
- The axe scan covers the idle product state, not held, error, recovery, and
  receipt states.
- UI-027 automates finding known DOM elements; it is not evidence that a novice
  understands the network in 10 seconds.

## Required validation before adding product features

This section is the preserved 2026-08-28 pre-change recommendation. The
2026-08-29 user decision superseded its human-dependent T095 sequencing: bounded
time/budget controls now pass automated and synthetic gates, while human study
work is optional. Region, party-size, payment, and real Provider expansion still
remain outside version 1.

1. Preserve the remaining canonical inventory and define a private, repeatable
   reset/reseed procedure before another confirmation or public demo.
2. Restore and verify real product-page Provider tool delegation, then capture
   one complete judge-environment agent workflow. Do not use the manual path as
   evidence of WebMCP Leverage.
3. Create the submission repository package: root README, visible open-source
   license, setup instructions, and public repository URL; prepare the English
   description and a public narrated video under three minutes.
4. Run five unmoderated first-time tests with no prior explanation. Minimum
   acceptance: at least 4/5 reach the receipt, median time at most 90 seconds,
   median dominant clicks at most 4, median backtracks at most 1, proof
   comprehension at least 80%, and SEQ at least 6/7.
5. Historical recommendation: only after those gates, decide whether editable
   date/time/budget/location is necessary. The time/budget portion was later
   superseded; location remains version 2. Continue to frame the submission as a
   cross-origin WebMCP coordination and reversible demo-reservation prototype,
   not a production booking marketplace.
