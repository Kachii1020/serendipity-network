# Production read-only search — 20-run UI measurement

**Date**: 2026-08-28  
**Origin**: `https://serendipity-phase0-hub.vercel.app/`  
**Surface**: Codex in-app browser  
**Status**: PASS for read-only search; does not close mutation reliability

## Method

Each iteration navigated to the fixed production Hub, waited for the primary
`Plan my night` action, clicked it once, and measured until
`Tonight got interesting.` became visible. A successful iteration also required:

- exactly three visible `Found` Provider states;
- the `Hold for 90 seconds` next action;
- no visible route-paused or needs-attention state.

The same browser session was used, with a full top-level navigation before every
iteration. No hold, confirm, release, reset, or other production mutation ran.

## Results

- Success: **20/20**
- Minimum: **272 ms**
- p50: **283 ms**
- p95, nearest-rank: **603 ms**
- Maximum: **2,901 ms**
- Visible Provider result: Kiln, Nori, and Loop `Found` in every run
- Browser-visible application errors: **0**

Raw click-to-result timings in milliseconds:

```text
2901, 603, 602, 305, 341, 279, 272, 288, 275, 282,
274, 277, 277, 395, 381, 379, 276, 281, 283, 293
```

The first run is retained as the cold-ish maximum rather than discarded.

## Proof and security observation

After the measurement, the architecture disclosure showed one sanitized
`Manual fallback` search activity with Hub origin, duration, timestamp, and
correlation id. It made no Site Tool execution claim. The rendered document did
not contain `holdToken`, `idempotencyKey`, `SUPABASE_SECRET_KEY`, or
`DEMO_OPERATOR_SECRET`.

## Scope boundary

This result supports production read-only search reliability and the three-second
search target. It does **not** satisfy PA-012, which requires search, hold,
status, confirm, and release at p95 over 20 runs. It also does not satisfy the
real Sol/Terra Site Tools ladder: `document.modelContext` and its register/get/
execute methods were absent in this client.
