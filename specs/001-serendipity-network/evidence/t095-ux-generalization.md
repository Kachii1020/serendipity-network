# T095 bounded UX and intent generalization

**Date**: 2026-08-29  
**Status**: PASS — implemented, deployed, and production-reverified  
**Live Hub**: `https://serendipity-phase0-hub.vercel.app`

## Implemented scope

- one native, closed-by-default `Adjust time & budget` disclosure;
- start presets 18:00, 18:30, and 19:00;
- budget presets ¥4,500, ¥5,000, and ¥6,000;
- unchanged defaults: 18:00 and ¥5,000;
- fixed Shibuya, solo, current Tokyo date, and 22:30 end boundary;
- one dominant `Plan my night` action;
- human controls and `find_serendipity_options` use the same validated `Intent`
  and `search()` controller;
- effective constraints stay visible in result, held, receipt, and no-result
  contexts;
- neutral three-Provider wording and explicit Provider-API/manual-fallback versus
  Site Tool provenance;
- no simultaneous `Connecting` and `Ready` projection;
- temporary demo/no-payment/no-real-booking copy before Hold;
- stable Route 1/2/3 labels with time, price, travel, and activity titles.

Region selection, party size, variable Provider count, real inventory, payment,
and real Provider onboarding remain version 2.

## Exact preset matrix

The same matrix passed against deterministic fixtures and the fixed production
Hub on service date `2026-08-29`.

| Start |    ¥4,500 |    ¥5,000 |    ¥6,000 |
| ----- | --------: | --------: | --------: |
| 18:00 |         3 |         3 |         3 |
| 18:30 | no result |         2 |         3 |
| 19:00 | no result | no result | no result |

Every success count is the exact number of returned candidates. Every zero is a
contract-valid `NO_VALID_BUNDLE`; no partial or invented route is displayed.
The production run used nine unique correlation IDs and changed no inventory.

## Local verification

| Gate                                      | Result            |
| ----------------------------------------- | ----------------- |
| Format, lint, 8 workspace typechecks      | pass              |
| Vitest                                    | 38 files, 178/178 |
| Production builds                         | 8/8 workspaces    |
| Chrome Phase 0 + product Site Tool        | 24/24             |
| Accessibility/responsive/200% zoom        | 9/9               |
| Public assets + runtime security          | 50 assets + 4/4   |
| Reviewed visual baselines                 | 8/8               |
| Human preset and Site Tool request parity | pass              |

The mobile expanded-control baseline keeps the primary action in view; the idle
desktop retains the invitation, four moods, one disclosure, one CTA, all three
Provider stickers, and proof entry without a dashboard layout.

## Deployment

| Role | Deployment                         | State                    |
| ---- | ---------------------------------- | ------------------------ |
| Hub  | `dpl_C54FxdZuDCJyxF4gE4UU7ZWcFdFY` | READY / production alias |
| Kiln | `dpl_AJe7iHgDXxoG6cPuX9xAQeoR2wEW` | READY / production alias |
| Nori | `dpl_Fp4S19GMbWZtAbBuyFxZnPDX35GY` | READY / production alias |
| Loop | `dpl_BVMMRE3KmhiykYgg2kAnp95NtPpb` | READY / production alias |

All deployment configs retain `hnd1`. The Provider redeploys contain a
listener-first exact-origin ready/bind handshake with retry until bound.
All four fixed aliases return HTTP 200. Each Provider's initial server-rendered
embed shows `Connecting` without rendering or exposing `Ready`; Hub inspection
and all three Provider inspections confirm READY lambdas deployed to `hnd1`.

## Production reliability after T095

The final fixed-origin sequential run passes:

- confirmed receipts: **20/20**;
- all three Provider `HELD → CONFIRMED` transitions: **20/20**;
- unique safe correlations: **201/201**;
- invalid or unknown results: **0**;
- click-to-receipt p50 **922 ms**, p95 **1,285 ms**, max **1,739 ms**;
- search p95 **292 ms**;
- hold p95 **451 ms**;
- confirm p95 **459 ms**;
- Provider held/confirmed status p95 **169/164 ms**;
- observer proof p95 **161 ms**;
- reset p95 **590 ms**;
- mandatory final reset restored **9 slots**.

After the final reset, a separate read-only baseline passed 20/20 with p50
139 ms, p95 218 ms, maximum 310 ms, zero invalid/non-2xx envelopes, and 20
unique correlations.

The post-audit run also preserves the exact production preset matrix at 9/9.
The non-human goal-only cohort passes 5/5 and the combined provenance/Hold/no-
payment comprehension gate passes 4/5; see `t095-synthetic-acceptance.md`.

## Bounded rescue findings

Two automation failures exposed real presentation-readiness races rather than
inventory or orchestration failures:

1. static markup could receive a click before React hydration; the Hub now
   exposes an explicit client-ready marker used by the reliability harness;
2. Provider frames could announce ready before installing their bind listener;
   they now install listener-first and retry exact-origin readiness every 500 ms
   until the Hub binds them.

The final 20/20 run waits for both client readiness and all three Provider binds.
No product failure was hidden or test weakened.

A later blocking-only audit found and closed three additional state boundaries:
only one safe search may be in flight, stale responses cannot commit, failed or
no-result searches clear the prior candidate session, and v1 Site Tool input must
end at 22:30 Tokyo time. Provider embed markup now also suppresses `Ready` while
the connection is still `Connecting`. These fixes added three Chrome cases and
one Provider SSR case before the final deployment and reliability run.

## Evidence boundary

This closes IMP-003 and UI-028–032 through deterministic, browser, security,
visual, synthetic, and fixed-production evidence. T093/T096 remain optional
supporting research. This evidence does not claim a second area, multi-person
support, real Provider independence, or real Sol/Terra Site Tools execution.
