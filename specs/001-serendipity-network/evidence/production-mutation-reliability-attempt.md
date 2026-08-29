# Production mutation reliability attempt

**Date**: 2026-08-28  
**Origin**: `https://serendipity-phase0-hub.vercel.app/`  
**Authorized target**: 20 sequential
`reset → Plan → Hold → Confirm → Provider status/proof audit` workflows  
**Result**: HISTORICAL RESCUE LOG — later fixed 20-run execution passed

## Safety contract

The harness is fixed to the four production origins and exactly 20 sequential
runs. It requires an exact opt-in before reading the dedicated Keychain item or
making a request. It aborts on the first mismatch, bounds browser and tool work,
waits 12 seconds for in-flight Provider work to settle on failure, and then
performs a mandatory protected reset. No secret, hold token, idempotency key, or
raw private payload is printed or stored.

## Attempt ledger

No attempt reached an evidenced confirmed receipt. Every attempt stopped in its
first iteration and its mandatory final reset returned `restoredSlots: 9`.

| Attempt | Lowest safe observation                                   | Final reset correlation                                             |
| ------: | --------------------------------------------------------- | ------------------------------------------------------------------- |
|       1 | Browser/workflow error after search; diagnostic too broad | `production-reliability-reset-aedacbc1-fbed-4b5d-b401-43dea66b5809` |
|       2 | Unexpected local harness exception; diagnostic too broad  | `production-reliability-reset-bcc9dd08-f52f-4681-aab1-47012eb95f47` |
|       3 | Kiln independent `HELD` proof did not pass all checks     | `production-reliability-reset-a5ac9c8d-1717-474d-987c-e83fe841f656` |
|       4 | Hub console recorded an anonymous 404 after search        | `production-reliability-reset-0f3ad416-437a-41d3-b564-faeaf36be5a5` |
|       5 | 404 source isolated to Hub `/favicon.ico`                 | `production-reliability-reset-3337dd5c-a0b7-47de-a492-3a06792a06c8` |

A subsequent execution request was blocked before process creation because it
would have exceeded the already-consumed mutation/recovery attempts without a
fresh explicit approval. It made no request and changed no state.

## Root-cause findings

Read-only HTTP checks show `/favicon.ico` returns 404 on Hub, Kiln, Nori, and
Loop. The page workflow and APIs remain healthy; a missing decorative favicon is
not a reservation failure. The harness was therefore stricter than the product
contract when it treated this exact 404 as fatal.

The Kiln `HELD` proof failure occurred before the favicon source was isolated.
Provider auditor pages were also treating their own favicon 404 as a fatal
browser error, so that is the leading explanation, but it is an inference rather
than a completed rerun. The harness now:

- records the exact four-origin favicon 404s as non-blocking diagnostics;
- keeps every other console, page, document, API, status, identity, correlation,
  and proof mismatch fatal;
- emits boolean-only public status diagnostics if a Provider state proof still
  fails.

Static validation after the change passes Prettier, ESLint, and `node --check`.
The updated 20-run mutation sequence has not been executed.

## Final production baseline

After the last successful final reset, a mutation-free production search
measurement passed:

- 20/20 successful three-Provider envelopes;
- zero non-2xx and zero invalid envelopes;
- 20 unique correlation IDs;
- p50 165 ms, p95 705 ms, maximum 990 ms;
- current Tokyo service date `2026-08-28`.

This proved the public demo returned to a healthy read-only baseline at that
point. A later freshly authorized execution passed the complete 20-run gate; see
`production-mutation-reliability.md`.
