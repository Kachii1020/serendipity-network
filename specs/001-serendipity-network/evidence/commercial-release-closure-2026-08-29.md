# Commercial release closure — 2026-08-29

**Status**: T103–T105 PASS; T102/T106 PARTIAL on external prerequisites  
**Landing**: `https://serendipity-phase0-hub.vercel.app/`  
**Planner / judged tool document**:
`https://serendipity-phase0-hub.vercel.app/plan`

## What shipped

- Static consumer landing with one planner CTA, product example, three steps,
  original Provider illustrations, safety/demo scope, and human/agent parity.
- Request-dynamic `/plan` containing the complete workflow and exactly five
  top-level product tools; root contains zero product tools.
- Allowlisted mood/start/budget deep links with no automatic request and redirect
  sanitization for unknown, array, or invalid query keys.
- Complete Tokyo/JST demo receipt, branded confirmation dialog, release-before-
  leave navigation, 400% reflow, lazy proof frames, launch metadata, and no
  consumer link to `/phase0`.
- Server-only exact-origin evaluation gateway for the three approved AE faults.
  The gateway is not active in production and is absent from public inputs.

## Design evidence

- Source contract: `design/serendipity-commercial.md`
- Six-candidate preview:
  `work/design-md-scout/serendipity-commercial/preview.html`
- Built-in image generation produced four original, text-free cut-paper assets:
  `serendipity-night-hero.webp`, `kiln-vignette.webp`,
  `nori-vignette.webp`, and `loop-vignette.webp` under
  `apps/hub/public/brand/`.
- Prompt set: a wide connected Shibuya-night collage plus separate square
  pottery, seasonal-tasting, and listening-room vignettes; mint/yellow/coral/
  violet palette; editorial cut-paper grain; no text, logo, watermark,
  photography claim, face, gradient, or dashboard UI.
- Production captures: `commercial-landing-production.png` and
  `commercial-planner-production-mobile.png`.

## Final deployments

| Role | Deployment                         | State / region |
| ---- | ---------------------------------- | -------------- |
| Hub  | `dpl_J1mVSFuwhxwVfam9gHyiucMMwwZU` | READY / `hnd1` |
| Kiln | `dpl_Ab3ghGoJGcs58Be3nwHioqAMd9Ez` | READY / `hnd1` |
| Nori | `dpl_35nwh5uiMXFEH8KLUueVa8MMnn58` | READY / `hnd1` |
| Loop | `dpl_9h5DmnVhJA3G3pDV9FRWx7JVQpGR` | READY / `hnd1` |

All four fixed aliases are active. Hub and three Provider favicons return HTTP 200. Opening production proof emits zero browser console errors.

## Verification ledger

| Gate                     | Result                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `pnpm check`             | 40 files / 192 tests; lint, format, and 8/8 typecheck PASS                                        |
| `pnpm build`             | 8/8 PASS; `/` static and `/plan` request-dynamic                                                  |
| Phase 0 Chrome           | 27/27 PASS                                                                                        |
| Accessibility/reflow     | 9/9 PASS plus landing/planner 400% PASS                                                           |
| Visual                   | 12/12 PASS including landing desktop/mobile and complete receipt                                  |
| Commercial route suite   | 7/7 production PASS                                                                               |
| UI completeness/workflow | 13/13 PASS                                                                                        |
| Security                 | 53 public build assets + 4/4 browser checks PASS                                                  |
| Production UI            | root/planner metadata, `5 → 0 → 5`, lazy proof, deep-link sanitization, release-before-leave PASS |

### Lighthouse production landing

| Metric              |   Result |
| ------------------- | -------: |
| Performance         |       95 |
| Accessibility       |      100 |
| Best Practices      |      100 |
| SEO                 |      100 |
| LCP                 | 2,362 ms |
| CLS                 |        0 |
| Total Blocking Time |   167 ms |

### Final production mutation reliability

Confirm cohort:

- receipt completion and Provider `HELD → CONFIRMED`: 20/20;
- correlations: 201 total, 201 unique, zero missing/duplicate;
- p95 search 594 ms, hold 594 ms, confirm 1,162 ms;
- p95 click-to-receipt 2,228 ms; p95 proof audit 91 ms;
- mandatory final reset restored nine slots.

Release cohort:

- release completion, Releasing UI, and fresh-search state: 20/20;
- Confirm endpoint requests: 0;
- Provider `HELD → RELEASED`: 20/20;
- correlations: 201 total, 201 unique, zero missing/duplicate;
- p95 search 500 ms, hold 607 ms, release 1,238 ms;
- p95 click-to-release 1,880 ms; p95 proof audit 145 ms;
- mandatory final reset restored nine slots.

After all four final deployments, the last independent read-only measurement
passed 20/20 with zero invalid/non-2xx envelopes, 20 unique correlations, p50
406 ms, p95 2,466 ms, and max 3,054 ms. The p95 search gate remains below three
seconds.

## Honest external blockers

### Isolated Supabase evaluation database

Supabase project creation was attempted in organization
`wirlnwexnigkdpalmxke`, Tokyo `ap-northeast-1`. It failed before creation
because the free organization already has two active projects. No existing
project was paused, deleted, overwritten, or repurposed. The generated eval DB
password remains only in macOS Keychain service
`serendipity-network-site-tools-eval-db`.

Therefore T102 remains PARTIAL: code and tests pass, but no fixed eval deployment
or AE-007/009/012 real-client staging run exists.

### Real Sol/Terra Site Tools

The final production `/plan` was opened in the available Codex in-app browser
and reloaded three times. Every attempt reported:

```json
{
  "hasModelContext": false,
  "registerTool": "undefined",
  "getTools": "undefined",
  "executeTool": "undefined"
}
```

The rendered page truthfully showed `Manual fallback`, `3 Provider APIs · manual
mode`, and “makes no Site Tool claim.” Automated Chrome proves the exact-five
surface and complete workflow but is not substituted for the required real
Sol/Terra Available/Recently used evidence. T082/T085/T089/T090 and final T106
remain open.

## Commercial readiness proxy

The frozen consumer-launch proxy is 93/100: brand 14/15, IA/navigation 14/15,
core task 19/20, trust/completion 13/15, responsive/accessibility 14/15,
performance 10/10, launch metadata 9/10. Every category is at least 80%. This is
an internal readiness score, not an official hackathon score.
