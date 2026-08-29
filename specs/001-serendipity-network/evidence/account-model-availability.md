# Site Tools account and model availability

**Checked**: 2026-08-27  
**Status**: Sol verified / Site Tools runtime unavailable / direct fallback selected

Official OpenAI documentation requires the latest ChatGPT desktop app, GPT-5.6
Sol or GPT-5.6 Terra, a supported non-Enterprise/non-Edu workspace, rollout
availability, and a page that provides Site Tools.

The Codex in-app browser loaded both `http://localhost:3100` and
`https://serendipity-phase0-hub.vercel.app`. Earlier automation could not expose
the selected model name and observed `typeof document.modelContext === "undefined"`
in three runs per origin.

The bounded T019 recheck then verified `gpt-5.6-sol` from the active task metadata.
The fixed HTTPS Hub was reloaded three more times in the Codex in-app browser;
`document.modelContext` remained unavailable in all runs. HTTPS, OAC, CSP, and
permissions-policy pass independent checks. The remaining cause is therefore a
desktop setting/version/workspace/rollout condition outside the application, not
the selected model or fixed deployment.

Recorded outcome:

1. Model requirement: passed with `gpt-5.6-sol`.
2. Fixed HTTPS page load: passed.
3. Site Tools runtime/inventory: unavailable 3/3.
4. Architecture decision: `direct`, per the bounded fallback rule.

The release preflight still inspects Available site tools and Recently used if
the production demo account later receives the runtime.
