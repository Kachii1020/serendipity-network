# Production mutation reliability — 20-run pass

**Date**: 2026-08-28  
**Origin**: `https://serendipity-phase0-hub.vercel.app/`  
**Path**: `reset → Plan → Hold → Provider HELD proof → Confirm → Provider CONFIRMED proof → receipt/proof audit`  
**Status**: PASS

## Result

The fixed-origin harness completed 20 sequential production workflows and one
mandatory final reset.

| Gate                                 |  Result |
| ------------------------------------ | ------: |
| Confirmed receipts                   |   20/20 |
| Three-Provider `HELD → CONFIRMED`    |   20/20 |
| Invalid or unknown results           |       0 |
| Missing or duplicate correlations    |       0 |
| Unique sanitized correlation IDs     | 201/201 |
| Search p95 ≤3 seconds                |    pass |
| Hold p95 ≤5 seconds                  |    pass |
| Confirm p95 ≤5 seconds               |    pass |
| Click-to-receipt p95 ≤20 seconds     |    pass |
| Final reset restored exactly 9 slots |    pass |

The 201 correlations cover 21 resets, 60 Hub UI operations, and 120
Provider-authoritative status reads. Search, hold, and confirm request/response
correlations were caller-bound; Provider status correlations were unique and
matched their public envelope metadata.

## Performance

Nearest-rank percentiles include the first cold-ish run.

| Operation                         | Count | p50      | p95      | Max      |
| --------------------------------- | ----: | -------- | -------- | -------- |
| Full click-to-receipt path        |    20 | 1,032 ms | 1,370 ms | 2,717 ms |
| Hub search                        |    20 | 286 ms   | 374 ms   | 1,693 ms |
| Hub three-Provider hold           |    20 | 278 ms   | 540 ms   | 613 ms   |
| Hub three-Provider confirm        |    20 | 417 ms   | 516 ms   | 523 ms   |
| Provider `HELD` status proof      |    60 | 100 ms   | 184 ms   | 201 ms   |
| Provider `CONFIRMED` status proof |    60 | 96 ms    | 200 ms   | 495 ms   |
| Observer proof audit              |    20 | 157 ms   | 335 ms   | 607 ms   |
| Protected reset, including final  |    21 | 93 ms    | 152 ms   | 508 ms   |

## State and safety proof

Every iteration used a fresh browser context and a protected reset. The harness
checked:

- search → hold → confirm bundle/session/hold identity continuity;
- all three Provider slot IDs, hold-safe references, and reservation references;
- authoritative Provider `HELD` and `CONFIRMED` status through read-only
  Provider tools;
- three confirmed stickers, three safe receipt references, and three ordered
  sanitized activity rows;
- exact iframe origins, one browser-session query only, HTTP 200 documents, and
  the truthful manual presentation state;
- absence of operator secret, hold token, and idempotency fields from the proof.

The first iteration recorded the known Hub/Kiln/Nori/Loop favicon 404s as
non-functional diagnostics. Subsequent contexts reused cached favicon results;
no other browser or workflow error was ignored.

The mandatory final reset returned:

```json
{
  "correlationId": "production-reliability-reset-25ab066f-bc18-44a4-93d8-31e2f7b6a251",
  "deletedHolds": 3,
  "restoredSlots": 9,
  "status": "RESET"
}
```

After that reset, an independent mutation-free search harness passed 20/20 with
zero invalid/non-2xx envelopes, 20 unique correlations, p50 185 ms, p95 374 ms,
and maximum 547 ms for service date `2026-08-28`.

## Evidence boundary

This is real fixed-production UI and Provider/database lifecycle evidence. The
human actions were automated clicks, and Provider status checks used Chrome's
WebMCP test surface. It is not a real ChatGPT Sol/Terra top-level Site Tools
selection run and does not close T082/T085/T089/T090.

The earlier bounded failure/recovery history is preserved separately in
`production-mutation-reliability-attempt.md`.
