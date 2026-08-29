# Devpost submission draft

**Status**: Draft; public repository, license, video URL, human results, and real
Sol/Terra 3/3 evidence are not yet available.

## Project name

Serendipity Network

## One-line description

A WebMCP-powered urban evening planner that safely composes and reserves one
feasible route across three independent venue websites.

## The problem

An unexpectedly free evening often becomes cross-site coordination work. A
person must compare availability, timing, travel, budget, and reservation state
across unrelated venue pages. Results become stale while the person switches
tabs, and one unavailable stop can invalidate the whole plan.

Serendipity targets urban residents, workers, and visitors facing that task.
Shibuya is the only supported launch network today: one person, three synthetic
Providers, seeded demo inventory, and no payment. We do not claim supply in
another area before its data pack passes the same gates.

## Why WebMCP is a strong fit

This is coordination across live webpage state, not a chatbot over static data.
The top-level Hub registers exactly five Site Tools:

- find_serendipity_options and show_bundle are read-only;
- hold_bundle, confirm_bundle, and release_bundle are explicit mutations.

The tools reuse the same application controller and server workflows as the
human UI. Search calls three independently deployed Provider APIs in parallel.
The Hub validates every public envelope, composes only complete feasible routes,
and shows the result in the page shared by the person and agent.

OpenAI's built-in browser does not discover iframe tools, so the judged path is
deliberately registered in the top-level Hub document. Provider iframe tools
remain a Chrome compatibility diagnostic and are never misrepresented as the
ChatGPT path.

## Better human-agent experience

A person can ask the agent to find a route without reserving anything, inspect
the visible result, then explicitly request a temporary hold or confirmation.
Every material state is also visible in the UI: three separately named Provider
cards, route totals and travel gaps, a shared hold countdown, and a final receipt.

The proof disclosure shows only safe facts: source, tool name, exact origin,
status, duration, timestamp, and correlation ID. If Site Tools are unavailable,
the same orchestration remains usable through a clearly labeled manual fallback;
the product makes no false live-tool claim.

## Implementation

- Next.js/React Hub and one Provider application deployed to four fixed Vercel
  origins in Tokyo.
- JSON Schema/Ajv contracts for every intent, Slot, tool input/output, and public
  result envelope.
- Pure deterministic bundle engine with feasibility, score, tie-break, and
  complete directed travel-time checks.
- Supabase transaction functions for idempotent hold, status, confirm, release,
  expiry, protected reset, and current-Tokyo demo service dates.
- Server-only HMAC Provider calls, AES-256-GCM token persistence, exact-origin
  policies, bounded payloads, compensation, and unknown-result reconciliation.
- Versioned area data packs. A structurally valid non-Shibuya candidate remains
  dark until reset, reliability, production E2E, ACTIVE status, and explicit
  allowlisting all pass.

## What is now possible

Each venue can retain its own origin and inventory authority while an agent
assembles a cross-site transaction that a person can inspect and control. The
Hub does not scrape buttons, invent partial availability, or expose Provider
credentials. It coordinates through a small, typed tool surface and visibly
fails closed.

## Verification snapshot

- 187/187 deterministic unit/integration tests across 39 files.
- 73/73 pgTAP database assertions and zero schema-lint errors.
- 27/27 Chrome WebMCP/product Site Tool cases.
- 9/9 accessibility/responsive/200%-zoom checks.
- 50 public assets plus 4/4 runtime security checks.
- 10/10 reviewed visual baselines, including real 320px result/reset focus.
- Production protected reset is repeatable; all four deployments run in hnd1;
  current-Tokyo read-only search reaches a three-stop route.

These automated results do not substitute for real ChatGPT evidence. The current
available in-app client exposed no Site Tools API in three production reloads,
so the Sol/Terra 3/3 gate remains honestly blocked rather than marked passed.

## Known limits

- Shibuya only; no multi-city supply claim.
- One-person demo inventory and no payment or real venue integration.
- Public repository URL, owner-selected open-source license, and public video
  remain submission gates. First-user/Provider study results are optional
  supporting evidence, not official eligibility requirements.

## Links

- Live Hub: https://serendipity-phase0-hub.vercel.app
- Kiln: https://serendipity-phase0-kiln.vercel.app
- Nori: https://serendipity-phase0-nori.vercel.app
- Loop: https://serendipity-loop.vercel.app
- Source repository: TBD
- Demo video: TBD
