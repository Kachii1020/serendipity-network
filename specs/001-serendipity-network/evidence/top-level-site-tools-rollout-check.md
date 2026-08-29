# Top-level Site Tools production rollout check

**Date**: 2026-08-28  
**URL**: `https://serendipity-phase0-hub.vercel.app/`  
**Surface**: Codex in-app browser selected for the fixed production URL  
**Status**: BLOCKED BY CLIENT AVAILABILITY — product fallback passed

The production Hub was reloaded three times after the five top-level product
tools were deployed. Every run observed:

```json
{
  "document.modelContext": false,
  "registerTool": "undefined",
  "getTools": "undefined",
  "executeTool": "undefined",
  "visibleToolCount": 0
}
```

The application responded correctly on every load:

- `Manual browser connection` was visible;
- the unsupported notice made no live-tool claim;
- Kiln, Nori, and Loop each displayed `Manual connection` and `Ready`;
- the ordinary manual path remained available;
- the proof entry was labeled `See the live site architecture`, not
  `See WebMCP in action`.

This evidence does not fail the deployed registration code because the client
never exposed the API needed to register a tool. The Chrome product test remains
the deterministic evidence that the same build registers exactly five top-level
tools and that a tool execution changes the real UI. Neither Chrome nor this
blocked observation satisfies STL-008/009: a latest eligible ChatGPT desktop,
personal/Pro workspace, Site Tools enabled, and Sol/Terra must expose the five
tools before the 3/3 agent ladder can run.

Official reference:
[OpenAI Site Tools](https://learn.chatgpt.com/docs/webmcp).

## Final-deployment recheck — 2026-08-29

The same check was repeated three times on final Hub deployment
`dpl_C54FxdZuDCJyxF4gE4UU7ZWcFdFY` during the production UI completeness audit.
All three runs again observed:

```json
{
  "document.modelContext": false,
  "registerTool": "undefined",
  "getTools": "undefined"
}
```

The fresh UI correctly exposed manual fallback, and read-only Plan/no-result/
alternative/proof flows remained functional. No Sol/Terra tool call was claimed;
T082/T085/T089/T090 stay open. See `ui-completeness-audit-2026-08-29.md`.

## Commercial `/plan` recheck — 2026-08-29

The final judged document moved to
`https://serendipity-phase0-hub.vercel.app/plan` on Hub deployment
`dpl_J1mVSFuwhxwVfam9gHyiucMMwwZU`. Three fresh loads in the selected Codex
in-app browser each observed:

```json
{
  "hasModelContext": false,
  "registerTool": "undefined",
  "getTools": "undefined",
  "executeTool": "undefined"
}
```

The page showed `Manual fallback`, `3 Provider APIs · manual mode`, and explicit
copy that no Site Tool claim was made. Chrome on the identical final route passes
the `5 → 0 → 5` route lifecycle, exact-five inventory, full workflows, and
security checks. This remains deterministic implementation evidence only; no
Available/Recently used or Sol/Terra call is claimed. T082/T085/T089/T090 remain
open. See `commercial-release-closure-2026-08-29.md`.
