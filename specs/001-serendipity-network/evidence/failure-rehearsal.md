# Failure rehearsal — FAULT-NORI-DISAPPEARS

**Date**: 2026-08-28  
**Composition mode**: `direct`  
**Status**: PASS

## Commands

```text
pnpm db:reset
pnpm db:test
pnpm exec vitest run apps/hub/lib/orchestrator/hold.test.ts apps/hub/lib/tools/direct/direct-tools.test.ts
```

## Results

- The local schema, seed, transactional hold functions, and demo controls passed
  68/68 pgTAP assertions. The reset invariant leaves no orphan active holds.
- The focused Hub rehearsal passed 10/10 cases.
- In `FAULT-NORI-DISAPPEARS`, Nori returns `SLOT_UNAVAILABLE` after a bundle
  has been selected. Kiln and Loop are each released exactly once.
- Complete compensation returns `compensationComplete: true`, selects a
  different replacement bundle, and does not hold that replacement.
- If a release cannot be proven, the workflow returns
  `COMPENSATION_INCOMPLETE`, never exposes a held success, and keeps the state
  blocked for explicit reconciliation.
- The direct-mode rehearsal independently proves that the Hub clears its held
  workflow after partial failure, emits release operations only for Providers
  with known successes, rejects incomplete release results, and exposes the
  replacement only after every release is authoritative.

No raw Provider hold token, idempotency key, database credential, or user prompt
was written to this record.
