# Local mutation and production read-only reliability validation

**Date**: 2026-08-28  
**Scope**: local mutation/recovery plus fixed-production read-only search  
**Safety boundary**: no production reset, hold, confirm, release, or secret output

## Reproducible commands

```sh
node scripts/measure-local-workflow.mjs
node scripts/measure-readonly-production.mjs
pnpm exec eslint scripts/measure-local-workflow.mjs scripts/measure-readonly-production.mjs --max-warnings=0
pnpm exec prettier --check scripts/measure-local-workflow.mjs scripts/measure-readonly-production.mjs
```

`measure-local-workflow.mjs` rejects every non-loopback application and database
origin before it starts. It reads the existing local Supabase credentials into
memory, starts the four local apps, and never prints those credentials.
`measure-readonly-production.mjs` has one exact HTTPS origin and one exact path
allowlisted: `POST /api/manual/search` on the fixed Hub. It contains no mutation
or reset operation.

Both harnesses use nearest-rank percentiles. Endpoint durations include response
body parsing. Every measured request supplies a unique correlation ID and checks
that both the response header and public envelope return the same ID.

## Local three-Provider result

The committed local harness completed:

- 20 `search → hold → confirm` workflows;
- 20 separate `search → hold → reload/recover → release` workflows;
- 140/140 valid Hub API responses and 140 unique correlation IDs;
- 21 deterministic local resets, including the final cleanup;
- zero active holds after cleanup;
- all nine slots active at their exact seeded capacity, total capacity 17.

The deterministic local service date was `2030-05-17`.

| Operation                  | Count | p50    | p95      | Max      |
| -------------------------- | ----: | ------ | -------- | -------- |
| Search                     |    40 | 33 ms  | 113 ms   | 853 ms   |
| Three-Provider hold        |    40 | 45 ms  | 399 ms   | 627 ms   |
| Three-Provider confirm     |    20 | 86 ms  | 478 ms   | 834 ms   |
| Search-to-confirm workflow |    20 | 203 ms | 1,149 ms | 2,087 ms |
| Three-Provider recovery    |    20 | 41 ms  | 273 ms   | 1,328 ms |
| Three-Provider release     |    20 | 110 ms | 310 ms   | 950 ms   |
| Recovery/release workflow  |    20 | 224 ms | 822 ms   | 2,333 ms |
| Local reset                |    21 | 8 ms   | 53 ms    | 164 ms   |

The local PA-012 thresholds pass: search p95 is below 3 seconds, hold and
confirm p95 are below 5 seconds, and the API search-to-confirm p95 is below 20
seconds. This is a real local Supabase and real three-Provider HTTP workflow,
not a mocked route result. It is not a browser click-to-receipt measurement.

## Fixed-production read-only result

The fixed production Hub completed 20 sequential current-Tokyo searches for
`2026-08-28`:

| Result                 |  Value |
| ---------------------- | -----: |
| Successful envelopes   |  20/20 |
| Non-2xx responses      |      0 |
| Invalid envelopes      |      0 |
| Unique correlation IDs |  20/20 |
| p50                    | 184 ms |
| p95                    | 303 ms |
| maximum                | 478 ms |
| minimum                | 158 ms |

This independently reconfirms the production read-only portion of T081 and is
well below the 3-second search p95 threshold. It does not consume inventory.

An independent rerun also passed 20/20 with zero non-2xx or invalid envelopes,
20 unique correlation IDs, p50 170 ms, p95 256 ms, minimum 144 ms, and maximum
581 ms. Both retained runs passed; neither was used to hide the other's slower
sample.

## Gate disposition

- **PA-012 local slice**: passes with the measurements above.
- **HO-016**: the deterministic product workflow test now passes full
  chronological find → hold → confirm and find → hold → release activity
  projection, including origin, transport, status, duration, timestamp,
  correlation, and secret-sanitization assertions.
- **T081**: the local portion documented here passes. A later fixed-production
  execution also passes 20/20 mutation workflows, p95 bounds, Provider state
  transitions, final reset, and post-reset baseline, closing the task; see
  `production-mutation-reliability.md`.
- **T085**: remains open. These measurements do not use a real Sol/Terra Site
  Tools session and do not prove the production observer-facing activity panel.

The fixed-origin `reset → search → hold → confirm → final reset` harness is now
the passing T081 production evidence.
`scripts/measure-production-workflow.mjs` implements that fixed 20-run sequence,
requires an exact explicit opt-in before reading Keychain or making a request,
and always attempts the final reset. Static validation and its no-opt-in refusal
pass. An initial authorized attempt stopped during first-iteration diagnostics
and restored the baseline; see the historical attempt ledger. A later freshly
authorized run passed the complete 20-run gate in
`production-mutation-reliability.md`.
T085 additionally requires the Site Tools runtime and real Sol/Terra workflow;
local WebMCP emulation or manual fallback cannot substitute for that evidence.
