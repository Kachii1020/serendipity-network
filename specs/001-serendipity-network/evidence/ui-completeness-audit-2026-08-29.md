# Production UI completeness audit

**Date**: 2026-08-29 JST  
**Target**: `https://serendipity-phase0-hub.vercel.app/`  
**Deployment**: Hub `dpl_C54FxdZuDCJyxF4gE4UU7ZWcFdFY` plus the final Kiln/Nori/Loop production set  
**Status**: **78/100 — strong MVP presentation, not yet final-polish complete**  
**Mutation policy**: read-only searches only; no Hold, Confirm, Release, or reset was invoked in this audit

## Decision

The UI is colorful, coherent, understandable, and reliable in its primary
desktop and 390px paths. It is not generally over-complex: one mood choice, one
closed time/budget disclosure, one dominant action, progressive technical proof,
and explicit Provider status form a strong hierarchy.

It should not yet be called fully complete. Narrow/short and enlarged-text
post-action focus can land users in the middle of the route or leave the new
search controls completely above the viewport. Release and incomplete-
compensation states also contain interaction dead ends or races that are not
covered by the current green screenshot/reflow suite.

## Frozen composite rubric

This audit intentionally evaluates more than visual breakage and button count.

| Area                                     |  Weight |  Score | Evidence-based judgment                                                                                                                |
| ---------------------------------------- | ------: | -----: | -------------------------------------------------------------------------------------------------------------------------------------- |
| Visual integrity and responsive geometry |      20 |     15 | Strong desktop/390 composition and zero document overflow; 320 warning and embedded proof clipping remain                              |
| First-use clarity and cognitive load     |      15 |     13 | One action and progressive disclosure are excellent; unsupported-browser technical chrome competes with the invitation                 |
| System status, provenance, and trust     |      15 |     12 | Provider identities and state changes are explicit; initial `Ready`, detection flash, and clipped proof weaken precision               |
| Interaction safety and state transitions |      15 |      9 | Search/hold/confirm guards are strong; Release has no in-flight UI phase and alternative selection loses focus                         |
| Results, comparison, error, and recovery |      15 |     12 | Route comparison and no-result copy are decision-ready; reset scroll and incomplete compensation can strand a user                     |
| Accessibility, keyboard, touch, and zoom |      10 |      7 | Semantic controls, targets, focus rings, reduced motion, and 200% static reflow pass; transition focus geometry and headings need work |
| Reliability and perceived performance    |      10 |     10 | Production search health, feedback timing, CLS, fonts, and previous 20/20 mutation reliability are strong                              |
| **Total**                                | **100** | **78** | Fix the P1 transition issues before treating the UI as final                                                                           |

## Validation bundle

### Automated and production checks

| Gate                             | Result                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm check`                     | 38 files, 178/178 tests; format, lint, and 8/8 typechecks pass                       |
| `pnpm build`                     | 8/8 workspaces pass                                                                  |
| Chrome WebMCP/product automation | 24/24 pass locally                                                                   |
| Accessibility/responsive/200%    | 9/9 local and 9/9 fixed production                                                   |
| Visual baselines                 | 8/8 local and 8/8 fixed production                                                   |
| Security                         | 50 public assets plus 4/4 runtime cases locally and on exact production origins      |
| Production read-only health      | 20/20, p50 140 ms, p95 350 ms, max 564 ms, 0 invalid/non-2xx, 20 unique correlations |

The first production security invocation intentionally remains in the work log:
it used the production Hub with default localhost Provider expectations and
failed 2 header cases. Re-running with the exact four production origins passed
4/4. This was a harness-input error, not a product failure.

### Live visual/cognitive matrix

- Profiles: 1440×900, 1280×720, 1024×768, 820×1180, 768×1024,
  767×1024, 640×450, 390×844, 320×568, and 200% text enlargement.
- States: idle, controls open, searching, success, alternatives, no-result,
  reset/recovery, proof, and an existing receipt.
- Document-level horizontal overflow: zero in every profile.
- Layout shift: zero in measured desktop, mobile, and 320px profiles.
- Primary search feedback appeared within 120 ms; three Providers moved to
  `Checking` before the response.
- Measured read-only production success/no-result presentation: approximately
  805/834 ms in the visual walk-through.
- In-app browser console: no application errors or warnings. Independent Chrome
  showed four expected unsupported-`tools`/Permissions-Policy warnings and one
  favicon 404, with no application JavaScript error.

## Findings

### P1 — narrow/zoomed result transition hides the result context

Fresh 320×568 default Plan:

- `scrollY = 806–808`;
- `.journey-shell` top `-157px`;
- result heading `-133…-52px`, fully above the viewport;
- Hold action `591…651px`, initially below the 568px viewport.

The user lands in the middle of the colored stop bands without seeing the
`Tonight got interesting`, Route number, Provider strip, or next action. At a
640×450 200%-reflow equivalent and actual 200% text enlargement, the result
heading is also completely above the viewport.

Cause: `apps/hub/components/product/hub-client.tsx:283` focuses the entire tall
`.journey-shell`, leaving browser scroll alignment in control. Existing visual
tests call `scrollTo(0, 0)` after transitions and therefore conceal the runtime
geometry.

Artifacts: `/private/tmp/serendipity-320-success-fresh.png` and
`/private/tmp/serendipity-zoom200-success.png`.

### P1 — `Adjust search` can appear to do nothing at 320px

After a fresh 320px no-result, selecting `Adjust search` produced:

- `scrollY = 800px`;
- invitation h1 `-494…-359px`;
- Plan CTA `-53…7px`;
- focus on `BODY`.

The visible viewport contains Provider cards, proof, and the footer—not the
restored search controls. Cause: reset at
`apps/hub/components/product/hub-client.tsx:826` has no invitation focus/scroll
target. Artifact: `/private/tmp/serendipity-320-recovery-fresh.png`.

### P1 — Release has no in-flight UI phase

`apps/hub/components/product/hub-client.tsx:746` starts the release request and
updates Provider operation labels, but the Hub phase remains `held` until the
response. `apps/hub/components/product/journey.tsx:233` therefore keeps both
Confirm and Release controls active. A second Release or Release/Confirm race is
possible, and the user does not receive a central `Releasing…` state.

### P1 — incomplete compensation is a deliberate but unexplained dead end

`apps/hub/components/product/product-view.tsx:208` disables the sole recovery
action for `COMPENSATION_INCOMPLETE`. Blocking another hold is correct, but the
screen offers no status recheck, automatic retry state, or operator next step.

### P2 — the visible Provider proof is internally clipped

At 320px the Hub iframe is 250px wide, while the Provider document has
`min-width: 320px`:

```text
iframe client width 248, Provider scroll width 320
iframe client height 238, Provider scroll height 292
```

The outer document does not overflow, so the current responsive assertion passes,
but the Provider proof itself has horizontal/vertical internal overflow and
clips status copy. The conflict is between
`apps/hub/app/globals.css:797`, `apps/hub/app/globals.css:808`, and
`apps/provider/app/globals.css:23`.

### P2 — alternative selection loses focus and change confirmation

Selecting Route 2 removes the clicked alternative from the DOM. The route label
updates correctly, but focus falls to `BODY`; the phase remains `composed`, so
the existing phase-based focus effect does not run. This is visible in
`apps/hub/components/product/journey.tsx:278` and
`apps/hub/components/product/hub-client.tsx:493`.

### P2 — 320px manual-fallback notice clips its strong line

Independent in-app and Playwright runs measured the notice at `clientWidth 290–291`
and `scrollWidth 308`. `apps/hub/app/globals.css:179` forces the strong text to
stay on one line while `.product-shell` hides overflow. Artifact:
`/private/tmp/serendipity-minimum-320x568-idle.png`.

### P2/P3 refinements

- A WebMCP-capable client initially renders manual mode until async registration
  succeeds; a neutral detecting state would avoid a false warning flash.
- Post-idle states begin at h2 after the invitation h1 is removed.
- `Ready` before a search can read as live availability rather than controller
  readiness; `Awaiting search` would be more precise.
- Proof and constraint summaries can clip their outer focus outline because the
  details container uses `overflow: clip`.
- The proof summary removes the native marker without adding a chevron or other
  expanded-state indicator.
- Secondary controls have inconsistent hover feedback; footer link touch height
  is about 15px; safe-area insets and page `theme-color` are absent.
- At 1280×720 manual mode, the CTA is visible but Provider identities begin at
  the bottom edge. The top badge communicates three APIs, yet the named network
  is not fully visible without a small scroll.

## Strengths that should be preserved

- The colorful Sticker Network direction is distinctive and internally
  consistent; it does not look like a dashboard.
- Four moods, one closed constraint disclosure, and one primary CTA keep the
  default path light.
- Controls are semantic, labeled, keyboard reachable, and at least 44px in the
  primary path. Focus-visible, skip link, reduced motion, and screen-reader state
  text are present.
- Search progress and Provider identity/state are immediate and explicit.
- Route output contains the information needed to decide: activity, exact time,
  price, travel, spare time, and stable Route number.
- Hold meaning, 90-second duration, no payment, and no confirmed reservation are
  stated immediately before the mutation.
- Alternatives are useful rather than decorative; no-result refuses invented or
  partial supply and gives one recovery action.
- Technical architecture stays behind disclosure and, when opened, shows three
  exact Provider origins plus sanitized activity instead of raw payloads.

## Site Tools boundary

The current in-app browser was reloaded three times on the final Hub deployment.
Every run returned no `document.modelContext`, `getTools`, or `registerTool`.
The real Sol/Terra ladder therefore did not start and T082/T085/T089/T090 remain
open. This is recorded as a client-availability block, not an application pass or
failure. The official OpenAI documentation requires Sol or Terra and notes that
availability also depends on workspace and rollout.

## Recommended order

1. Fix result/reset focus geometry and add tests that do not manually normalize
   scroll position.
2. Add a Release in-flight state/lock and a safe incomplete-compensation next
   step.
3. Make embedded Provider proof responsive and wrap the 320px fallback warning.
4. Restore focus after alternative selection and refine `Ready`/detecting copy.
5. Apply low-risk hover, disclosure marker, safe-area, and theme-color polish.
6. Re-run the same matrix; only then call the UI final.
