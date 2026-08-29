# Score-lift implementation evidence

**Date**: 2026-08-29  
**Status**: Local and production foundation plus T095/T101 pass; real Sol/Terra
validation remains and human research is optional

## Implemented

- Exactly five top-level Hub product tools: two read-only and three mutating.
- Human buttons and Site Tools share the same Hub action controller and existing
  server workflow routes.
- Manual and Site Tool activity are labeled separately with safe origin,
  duration, timestamp, and correlation ID.
- Product Provider iframes delegate `allow="tools"` for Chrome diagnostics; the
  documentation does not claim ChatGPT discovers iframe tools.
- Result, hold, recovery/error, and receipt focus targets are explicit; the
  one-second countdown is no longer a live region; result mood copy is dynamic.
- Vercel project configs select Fluid Compute and the Tokyo `hnd1` region.
- HTTP Provider calls have a five-second internal deadline distinct from caller
  cancellation.
- The protected production reset script fails closed without exact opt-in and a
  32-byte operator secret.
- Migration 004 adds fixed-test/current-Tokyo reset dates and a production-only
  capacity override of 20 per seeded slot.
- Product positioning is general to urban spontaneous-evening planning while
  Shibuya remains the only supported launch network; future regions require a
  complete, versioned area data pack.
- Versioned area data packs now require three exact HTTPS Provider origins,
  provider-correct unique slots, a complete directed travel graph, a feasible
  route, and explicit reset/reliability/production gates. A valid Shinjuku
  candidate remains structurally accepted but impossible to expose.
- Root README, credential-free CI, hardened ignore rules, and a frozen
  first-user/provider study protocol are ready locally. License selection,
  public Git, video upload, and participant execution remain external actions.
- T095 adds one closed time/budget disclosure, shared human/Site Tool Intent,
  exact nine-preset behavior, and five targeted clarity fixes without expanding
  beyond Shibuya, solo, or the three demo Providers.
- T101 closes narrow/zoom transition focus, atomic Release UI/state, 90-second
  compensation protection, alternative focus restoration, and internally
  responsive Provider proof without changing public tool inputs or DB schema.

## Passing evidence

| Gate                                 | Result                                        |
| ------------------------------------ | --------------------------------------------- |
| Format, lint, 8 workspace typechecks | pass                                          |
| Vitest                               | 39 files, 187/187                             |
| Production builds                    | 8/8 workspaces                                |
| pgTAP                                | 5 files, 73/73                                |
| DB lint                              | zero schema errors                            |
| Chrome Phase 0 + product Site Tool   | 27/27                                         |
| Accessibility/responsive/200% zoom   | 9/9                                           |
| Public asset + runtime security      | 50 assets + 4/4                               |
| Visual regression                    | 10/10 inspected runtime-focus baselines       |
| Fixed-production Confirm reliability | 20/20 receipts and Provider state transitions |
| Fixed-production Release reliability | 20/20 release/state/UI, zero Confirm requests |

The product Site Tool browser test proves one top-level
`find_serendipity_options` execution changes the real Hub UI and records a
`Site tool` activity. It does not substitute for the real Sol/Terra 3/3 gate.

## Production rollout

- Keychain service `serendipity-network-demo-operator` stores the generated
  operator secret; the value is not present in repository or evidence output.
- Hub production has `DEMO_MODE=true` and a matching sensitive operator secret.
- Hub, Kiln, Nori, and Loop are READY production deployments with every lambda
  deployed to `hnd1`.
- Migration 004 added rolling Tokyo service dates. Migration 005 added explicit
  predicates required by the production safe-delete guard after the first reset
  returned SQLSTATE `21000`; local production-branch tests were added before
  retrying.
- Protected reset pass 1 deleted three prior hold rows and restored nine slots.
- Protected reset pass 2 deleted zero hold rows and restored the same nine slots,
  proving idempotency and zero orphan active holds.
- Both reset runs ended in a successful read-only three-Provider search.
- A separate read-only response inspection showed three `2026-08-28` slots,
  each with capacity 20.
- The actual product UI reached the three-stop result in 2.721 seconds, showed
  all Providers as `Found`, exposed `allow="tools"` on all three iframes, and
  emitted no browser error/warning.

Active production deployments:

| Role | Deployment                         | Region |
| ---- | ---------------------------------- | ------ |
| Hub  | `dpl_7i8KYoyjqzk8CYbKgMhYZjd3712U` | `hnd1` |
| Kiln | `dpl_3YDeGAFgXTDQEUW36D8zb78BbKbu` | `hnd1` |
| Nori | `dpl_J8ss1JZJgFbNL1uNESQiUUsWDzW6` | `hnd1` |
| Loop | `dpl_4EcvAeh4DDW5utd6YYWD3gTGTEJS` | `hnd1` |

Production logs record HTTP 200 for the protected reset, Hub manual search, and
all three Provider `/api/slots` requests. The available in-app browser still
does not expose Site Tools, so the real Sol/Terra 3/3 gate remains open.

Three new fixed-production reloads again observed no `document.modelContext` or
Site Tools API. The application displayed the correct manual fallback on all
three. See `top-level-site-tools-rollout-check.md`. Deterministic Chrome now
executes top-level `find → hold → confirm` and `find → hold → release`, proves
manual/Site Tool provenance, discovers fifteen delegated Provider diagnostic
tools, and fails closed when one iframe delegation is removed. These checks do
not replace ChatGPT Available/Recently Used evidence.

After the transport-aware Provider presentation bridge was deployed, a final
production read-only search completed in 3.778 seconds. Hub, all three embedded
Provider pages, and the activity list consistently said `Manual fallback`; all
three Providers were `Found`, the expanded proof made no iframe-tool claim, and
the browser emitted no errors or warnings.

## Additional priority validation

- Production UI read-only search passed 20/20 with p50 283 ms, p95 603 ms, and
  maximum 2,901 ms; every run rendered all three Providers as `Found`.
- A separate API-level production read-only harness passed twice: each run was
  20/20 with unique correlations and zero invalid/non-2xx envelopes; p95 was
  303 ms and 256 ms respectively.
- The local real-Supabase lifecycle harness passed 20 confirmations and 20
  recovery/releases with 140/140 valid Hub responses, zero duplicate
  correlations, and zero active holds after final reset.
- HO-016 now asserts chronological, provenance-complete, secret-safe activity
  for both confirm and release terminal paths.
- The fixed 20-run production reset → Plan → Hold → Confirm harness passes static
  and no-opt-in safety checks. A freshly authorized execution then passes 20/20
  receipts, all three Provider `HELD → CONFIRMED` transitions per run, every p95
  bound, 201/201 unique correlations, and the mandatory final reset. The final
  independent read-only baseline passes 20/20 at p95 374 ms. Exact favicon 404s
  are retained as non-functional diagnostics; no other browser error is ignored.
- The current Sol client still receives no Site Tools runtime from the desktop
  client, so real Sol/Terra 3/3 remains blocked rather than failed.
- Synthetic agents are approved only as non-human workflow, comprehension,
  recovery, contract, and adversarial QA. They do not replace C01–C05 or
  P01–P02 and do not close Potential Impact 20+.

## Commercial product release — 2026-08-29

The Hub now separates a static consumer landing at `/` from the complete judged
workflow at `/plan`. The final deployment and three Provider favicon-only
deployments are recorded in `commercial-release-closure-2026-08-29.md`.
Production revalidation passes Confirm 20/20, Release 20/20 with zero Confirm
requests, final read-only 20/20, Lighthouse 95/100/100/100, exact-five Chrome
lifecycle, and zero proof console errors. The real Sol/Terra gate remains blocked
3/3 by the available client's missing `document.modelContext` and is not claimed.
