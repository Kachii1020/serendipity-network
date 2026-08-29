# Phase 0 composition decision

**Status**: ACCEPTED — `direct` selected; T019 complete  
**Date**: 2026-08-27

## Current evidence

- Chrome 151 local harness: 15/15 specs passed, 3 consecutive runs.
- Chrome 151 fixed-HTTPS harness: 15/15 specs passed, 3 consecutive runs.
- Nested Hub read: passed against Kiln and Nori.
- Nested Hub mutation: passed exactly once against Kiln and Nori.
- Exact-origin, permission denial, exposure denial, reload invalidation, timeout,
  error normalization, and wrong-origin duplicate checks: passed.
- Chrome execution encoding: `json-string` accepted; object rejected.
- Codex in-app browser on localhost and fixed HTTPS initially exposed no
  `document.modelContext` in 3/3 runs for each environment; no tool inventory or
  routing execution was possible.
- Fixed HTTPS Vercel Hub/Kiln/Nori: READY, aliased, and exact-origin headers verified.
- A bounded recheck on 2026-08-27 confirmed the active Codex task model as
  `gpt-5.6-sol` from task metadata and loaded the fixed HTTPS Hub in the Codex
  in-app browser three times. Every run still reported
  `document.modelContext === undefined`; Hub and both Provider frames rendered
  their unsupported state. Site Tools inventory and routing therefore remained
  unavailable on the supported model.
- Official OpenAI documentation confirms Sol is a Site Tools-capable model and
  notes that availability also depends on desktop version, workspace type, and
  rollout. The application cannot resolve those client-side conditions.

## Selected values

```text
WEBMCP_EXECUTION_ENCODING=json-string
WEBMCP_COMPOSITION_MODE=direct
```

These are build-time values. A state-changing operation is never retried with an
alternate execution encoding.

## Decision

Select `direct` because required nested behavior remained unavailable after the
bounded fixed-HTTPS investigation on `gpt-5.6-sol`. P0-018/019 did not pass, and
the specification explicitly requires the direct-provider fallback in this case.

Direct mode is safe enough to continue because Provider tools keep unique,
origin-owned names; Hub tools accept validated Provider results only; the ordinary
HTTP path remains functional when Site Tools are absent; and all contracts,
idempotency, exact-origin, redaction, and compensation rules remain unchanged.

This decision does not claim that Site Tools are generally unavailable. It records
the current judged-client result and prevents an open-ended compatibility delay.
The final production preflight must still verify whether the demo account exposes
the directly registered Provider tools.

Evidence: `codex-sol-https-run-1.md` through `codex-sol-https-run-3.md`.
