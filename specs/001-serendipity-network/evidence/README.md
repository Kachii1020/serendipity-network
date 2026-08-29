# Phase 0 evidence

Only sanitized, reproducible evidence belongs here. Never store browser profiles,
cookies, credentials, raw prompts, hold tokens, or full request headers.

## Required records

- `chrome-run-1.json` through `chrome-run-3.json`
- `codex-run-1.md` through `codex-run-3.md`
- `deployment-origins.md`
- `phase0-decision.md`
- `failure-rehearsal.md`
- `final-security-scan.md`
- `full-system-verification.md`
- `convergence-gaps.md`
- `score-lift-implementation.md`
- `top-level-site-tools-rollout-check.md`
- `production-readonly-search-20-run.md`
- `production-mutation-reliability-attempt.md`
- `production-mutation-reliability.md`
- `local-reliability-validation.md`
- `first-user-study-protocol.md`
- `synthetic-participant-eval-plan.md`
- `synthetic-participant-eval-results.md`
- `t095-synthetic-acceptance.md`
- `t093-study-launch.md`
- `t095-ux-generalization.md`
- `ui-completeness-audit-2026-08-29.md`
- `ui-completeness-closure-2026-08-29.md`
- `ui-completeness-synthetic-2026-08-29.md`
- `commercial-release-closure-2026-08-29.md`
- `demo-video-script.md`
- `devpost-submission-draft.md`

Generated screenshots, traces, and browser reports stay in the ignored
`artifacts/` directory. Committed records refer to them by filename and include a
sanitized summary.

## Current local UI captures

Preliminary product-UI checks for T070–T076 are stored outside this evidence
directory under `artifacts/ui/`: `ui-idle-1440.png`, `ui-idle-1024.png`,
`ui-idle-390.png`, and `ui-proof-390.png`. They contain only public demo UI and
local origins. They are informal inspection captures and are not the executable
acceptance baselines.

The deterministic T079/T095/T101 baselines live beside their executable spec under
`tests/e2e/visual.spec.ts-snapshots/`. They cover idle desktop/tablet/mobile,
expanded time/budget controls on mobile, composed desktop, held mobile,
confirmed desktop, expanded proof desktop, and real focused result/reset views
at 320px, plus commercial landing desktop/mobile. Re-running `pnpm test:visual` without snapshot updates is the
acceptance check.

The T083 compensation evidence is recorded in `failure-rehearsal.md`. It maps
the named `FAULT-NORI-DISAPPEARS` fixture to both the nested orchestration
boundary and the selected direct coordination mode.

The T084 production/public-surface results are recorded in
`final-security-scan.md`, including the repeatable commands and bounded manual
bundle/screenshot inspection.

The T081/T095/T101 closure ledger and current reconciliation are recorded in
`full-system-verification.md`, `t095-ux-generalization.md`,
`ui-completeness-closure-2026-08-29.md`, and `convergence-gaps.md`. They include
fixed-production Confirm/Release reliability, protected reset, exact preset
outcomes, and post-reset read-only health. Real Sol/Terra Site Tools remain
unclaimed; human validation is optional and likewise not claimed.

The T103–T105 commercial production release, Lighthouse metrics, final
Confirm/Release 20-run revalidation, final four deployment IDs, isolated
Supabase quota blocker, and final in-app-browser 3/3 Site Tools blocker are
recorded in `commercial-release-closure-2026-08-29.md`.
