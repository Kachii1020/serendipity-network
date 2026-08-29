# Full-system verification ledger

**Date**: 2026-08-29  
**Status**: Local suites and production reset/read-only/confirm/release
reliability complete through T101; top-level WebMCP real-model gates pending and
human research optional

## Passing local gates

| Command                                         | Result                                       |
| ----------------------------------------------- | -------------------------------------------- |
| `pnpm test`                                     | 39 files, 187/187 tests                      |
| `pnpm typecheck`                                | 8/8 workspaces                               |
| `pnpm exec tsc -p tests/tsconfig.json --noEmit` | pass                                         |
| `pnpm lint`                                     | pass, zero warnings                          |
| `pnpm format:check`                             | pass                                         |
| Hub and Provider production builds              | pass                                         |
| `pnpm db:reset`                                 | five migrations plus deterministic seed      |
| `pnpm db:test`                                  | 5 files, 73/73 pgTAP assertions              |
| `pnpm db:lint`                                  | zero schema errors                           |
| `pnpm test:provider-api:local`                  | live Route Handler-to-Supabase workflow pass |
| `pnpm test:phase0`                              | 27/27 Chrome WebMCP/product Site Tool cases  |
| `pnpm test:a11y`                                | 9/9                                          |
| `pnpm test:security`                            | 50 assets plus 4/4 runtime cases             |
| `pnpm test:visual`                              | 10/10; reviewed runtime-focus baselines      |

The Provider smoke command is self-contained: it reads the dedicated local
Supabase status at runtime, starts a temporary Provider with matching local-only
configuration, runs auth/search/hold/status/confirm/release/demo-cancel checks,
and terminates the server. It does not persist or print the database credential.

## Passing fixed-origin read-only gates

- Hub, Kiln, Nori, and Loop return HTTP 200 over HTTPS.
- Exact OAC, CSP, `frame-src`/`frame-ancestors`, and Permissions-Policy headers
  pass against all four production aliases.
- The T095 local accessibility/responsive/200%-zoom matrix passes 9/9; the
  production read-only header/security parity remains green.
- The production rendered-content, iframe, URL, storage, and header security
  matrix passes 3/3.

## Passing fixed-origin database-backed canonical gate

- Dedicated Supabase project `gwluomrqzulnuhpdmucr` is healthy in
  `ap-northeast-1`; migrations 001–005 plus `supabase/seed.sql` were applied.
- Kiln, Nori, and Loop were redeployed with the dedicated production URL and
  server secret after the complete repository quality gate and production build
  passed.
- The exact production UI action that previously failed now renders all three
  seeded stops. Hub `/api/manual/search` and every Provider `/api/slots` request
  returned HTTP 200 in the same run.
- One separately authorized production run completed search, all three holds,
  and all three confirmations. Hub search/hold/confirm plus the nine Provider
  POSTs returned HTTP 200, and the receipt appeared in approximately 76 seconds.
- The observer proof opened in one action and approximately 0.8 seconds, but the
  available in-app browser ran the honest manual fallback rather than WebMCP.
- A new regression test proves missing Provider configuration yields a
  contract-valid HTTP 500 `INTERNAL_ERROR` JSON envelope with `no-store` and a
  correlation id, without exposing configuration details.

## T081 fixed-origin closure

- Local PA-012 passes 20 confirmations plus 20 recovery/releases against real
  local Supabase and four HTTP origins.
- Fixed production passes 20 sequential reset/search/hold/confirm receipts.
  Every run independently proves all three Providers transition from `HELD` to
  `CONFIRMED`; all search, hold, confirm, proof, and click-to-receipt p95 bounds
  pass.
- The run records 201/201 unique safe correlation IDs, no invalid or unknown
  result, and a mandatory final reset restoring nine slots.
- A post-reset production read-only harness passes 20/20 with p95 374 ms and
  zero invalid/non-2xx envelope.
- HO-016 chronological safe activity projection, fixed-origin security,
  accessibility, deployment, database, and contract gates remain green.
- This closes T081. Product proof iframes and the available ChatGPT client remain
  separate T082/T085/T089/T090 concerns; mutation reliability does not substitute
  for a real Sol/Terra Site Tools pass.

## T095 bounded UX closure

- One closed disclosure now offers only 18:00/18:30/19:00 and
  ¥4,500/¥5,000/¥6,000 while Shibuya, solo, and 22:30 stay fixed.
- Human input and `find_serendipity_options` share the same validated `Intent`
  and controller. The production nine-preset matrix returns the exact expected
  candidate counts or an honest `NO_VALID_BUNDLE`, with no inventory mutation.
- Provider/API provenance, pre-Hold demo/no-payment meaning, connecting status,
  stable Route labels, detailed alternatives, mobile layout, and 200% zoom all
  pass their automated gates.
- After the final Hub and three Provider deployments, a new 20-run production
  workflow passed 20/20 receipts and all three `HELD → CONFIRMED` transitions,
  with click-to-receipt p95 1,285 ms and a mandatory final nine-slot reset.
- The post-reset read-only baseline passed 20/20 at p95 218 ms with no invalid or
  non-2xx envelope. Full details are in `t095-ux-generalization.md`.

## Final rollout verification

- Hub, Kiln, Nori, and Loop were redeployed to `hnd1`; the active deployment
  identifiers are recorded in `deployment-origins.md`.
- The final provenance-aware production read-only search completed in 3.778
  seconds. All three Providers reached `Found`; the Hub, embedded Provider
  pages, and activity list consistently labeled the transport as manual.
- Browser console inspection showed no errors or warnings, and the expanded
  proof made no claim that an iframe WebMCP tool executed.
- Three fresh production reloads observed zero Site Tools and no
  `document.modelContext`. See `top-level-site-tools-rollout-check.md`; this is a
  client-availability blocker, not passing Sol/Terra evidence.
- A separate 20-iteration production UI measurement passed read-only search
  20/20 with p50 283 ms, nearest-rank p95 603 ms, and maximum 2,901 ms. Every
  iteration rendered three `Found` Providers and the hold action. See
  `production-readonly-search-20-run.md`; this read-only record alone does not
  close PA-012 because no mutation operation was included.
- A real local Supabase/four-origin harness completed 20 confirm workflows and
  20 recovery/release workflows: 140/140 valid requests, no duplicate
  correlation IDs, and zero active holds after final reset. Search, hold,
  confirm, recovery, and release all pass their local p95 thresholds. See
  `local-reliability-validation.md`.
- The HO-016 deterministic browser test now verifies complete chronological
  find → hold → confirm and find → hold → release activity rows with truthful
  transport, tool, origin, status, timing, correlation, and secret
  sanitization.
- The pre-T095 T081 freshly authorized fixed-origin harness completes 20/20 receipts,
  20/20 three-Provider status transitions, every p95 gate, 201/201 unique
  correlations, and the mandatory final reset. The final independent read-only
  baseline passes 20/20 with p95 374 ms. The later T095 closure above supersedes
  this as the current final deployment baseline. See
  `production-mutation-reliability.md`; the earlier rescue history remains in
  `production-mutation-reliability-attempt.md`.

## T101 UI-completeness closure

- Deterministic result/reset/alternative focus, explicit `releasing`, safe
  release retry/status projection, the reload-persistent 90-second compensation
  guard, wrapped 320px warning, and internally overflow-free Provider proof pass.
- Focused local acceptance passes 28/28 reducer/component/contract cases and
  13/13 browser cases; fixed-production narrow/zoom/proof acceptance passes 8/8.
- Final production passes the preset matrix 9/9, confirm reliability 20/20,
  release reliability 20/20 with Releasing UI 20/20 and Confirm requests 0, and
  two mandatory nine-slot resets.
- The final independent read-only baseline passes 20/20 at p95 252 ms with zero
  invalid/non-2xx result. See `ui-completeness-closure-2026-08-29.md`.

This record marks T081 complete. It does not mark any real-model or human gate
complete.
