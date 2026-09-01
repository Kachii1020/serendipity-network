# Serendipity — Devpost submission package

## Core fields

**Project name**  
Serendipity

**Tagline**  
One Tokyo evening, planned with evidence.

**Live application**  
<https://serendipity-phase0-hub.vercel.app>

**Direct planner**  
<https://serendipity-phase0-hub.vercel.app/plan>

**Public repository**  
<https://github.com/Kachii1020/serendipity-network>

**Demo video**  
`<PUBLIC YOUTUBE URL AFTER USER UPLOAD>`

**Built with**  
WebMCP, TypeScript, Next.js, React, Vercel, AJV, Vitest, Playwright

## Short description

Serendipity lets a person or AI assistant build one source-backed Tokyo evening
across activities and an official-menu meal, then inspect evidence, replace one
stop, and save the result through the same five typed WebMCP actions.

## Additional Details answers

Use these only when the corresponding custom field appears after login.

**Submitter type**  
Select `Individual` if submitting solo; otherwise select `Team` and add every
actual contributor in Step 1.

**Country of residence**  
The user must select their actual legal country of residence.

**Category**  
Web / Machine Learning & AI

**Is this a new or existing project?**  
New project created during The WebMCP Challenge submission period.

**How did you improve or extend it during the hackathon?**

> During the submission period, Serendipity progressed from a Shibuya-only
> reservation-network experiment into the shipped three-hub source-backed Tokyo
> planner. The new work added the complete v3 contracts and deterministic engine,
> 21 reviewed activity and official-menu records across Shibuya, Shinjuku, and
> Ikebukuro, party and per-person budget support, full-width consumer UI, a
> truthful multi-stage analysis experience, browser-local saved plans, and five
> top-level WebMCP tools sharing the visible controller. The public commit history
> records these changes and distinguishes the preserved legacy experiments.

**Repository URL**  
https://github.com/Kachii1020/serendipity-network

**Open-source license**  
MIT

**Is the repository public?**  
Yes

**Testing credentials**  
None required

**Required developer-tool feedback, if asked**

> WebMCP was strongest when we exposed five goal-level actions instead of
> mirroring every button. Shared typed contracts improved both the agent and
> human paths: stable IDs, explicit effects, cancellation, safe outputs, and
> honest no-result behavior became product requirements. The hardest practical
> issue was client availability; Chrome's testing flag provided deterministic
> compatibility coverage while the current ChatGPT account did not expose the
> built-in Site Tools surface.

## Project story

### Inspiration

An unexpectedly free evening should feel spontaneous. In practice, it becomes
browser work: open several venue and restaurant pages, compare hours and menu
prices, estimate walking time, then rebuild the route when one choice does not
fit. Search results and generic itinerary generators often hide where their
claims came from, and agents that drive page controls must guess at interface
structure.

Serendipity asks a narrower question: can a person and an agent work on the same
visible plan while every important place, time, price, and next action remains
inspectable?

### What it does

A user chooses Shibuya, Shinjuku, or Ikebukuro; one to three adults; a time
window; a per-person budget; an interest; a walking limit; and whether to include
a meal. Serendipity returns one feasible two- or three-stop route.

Every stop shows its visit time, factual description, address, official price
basis, and coordinate-estimated travel. The evidence disclosure links the
publisher, checked date, official hours, official menu, and source URL. It does
not claim live seats, make a reservation, guarantee a final bill, or copy review
scores, photos, or marketplace price estimates.

The same page exposes exactly five WebMCP tools:

- `find_evening_plan` searches and projects one plan;
- `show_place_evidence` opens a stop's evidence in the visible page;
- `swap_plan_stop` replaces one activity with an activity or one meal with a
  meal while keeping the rest of the route stable;
- `save_plan` stores a validated snapshot in the browser;
- `delete_saved_plan` removes it idempotently.

### Why WebMCP is a strong fit

This job crosses several constraints and requires follow-up changes. A person
may say, “Plan a calm Ikebukuro evening for three, include dinner, keep it under
¥4,000 per person, then show me the meal evidence and make one stop cheaper.”

Without WebMCP, an assistant must interpret and manipulate a changing visual
form, scrape result cards, and infer whether a replacement succeeded. With
WebMCP, the website declares the allowed actions and JSON Schemas. The agent can
send the full intent in one call, address the current plan by stable IDs, open
the exact evidence the person should review, and request one bounded change.
Every successful action updates the same page the person is looking at.

This makes the collaboration faster and more reliable while preserving human
control. Search, evidence, and swaps are read-only. Save and delete are explicit
browser-local mutations. Official-site links remain ordinary user-selected
links rather than a hidden sixth tool.

### How we built it

Serendipity is a Next.js and React application deployed on Vercel. Parallel v3
contracts validate every public intent, plan, evidence response, tool input, and
tool result. An AJV boundary rejects unknown properties and unsafe payloads.

A deterministic composer explores valid activity/meal sequences for each Tokyo
hub. It enforces published hours, hard per-person budget limits using official
menu maxima, stop duration, closing headroom, maximum walking time, unique
places, and role-preserving replacements. Ranking and IDs are deterministic.
Walking time is explicitly labelled as a coordinate estimate.

The three reviewed data packs contain 21 places: four activities and three meals
per hub. Each routable place binds identity, address, coordinates, hours, price,
public access, official URL, and source metadata to a reviewed claim ledger.
Google Places enrichment is implemented behind a server-only flag but remains
off in production; the shipped route relies on official sources and menu pages.

All five top-level tools call the same `find`, `showEvidence`, `swap`, `save`,
and `deleteSaved` controller used by the visible interface. Tool wrappers contain
validation and state checks, not a second business implementation. Registration
is rolled back if any one tool fails, so the page never exposes a partial tool
inventory.

### Challenges we ran into

The hardest problem was truth, not route generation. A schedule can look
convincing while silently relying on inferred opening hours, stale exceptions,
uncited coordinates, or a price that is not actually published. We rebuilt the
data boundary to fail closed, added per-place calendar sources, bound reviewed
source metadata and data-license claims, rejected impossible dates, and removed
places that could not support a budget claim.

The second challenge was keeping human and agent state identical. Concurrent
searches, stale evidence, storage corruption, partial tool registration, browser
Back, and late cancellation all needed explicit locks and validation. The
resulting controller prevents a Site Tool response from updating a plan the user
has already replaced.

The third challenge was product clarity. We replaced a dense two-dashboard
prototype with a full-width route, a four-stage analysis state, compact evidence
disclosures, and one primary save action. Responsive tests cover 320 through
1440 pixels plus 200% and 400% reflow.

### Accomplishments that we're proud of

- Three ACTIVE Tokyo hub packs with four activities and three official-menu
  meals each.
- Exactly five top-level tools with human/tool controller parity and atomic
  registration cleanup.
- One deterministic Activity → Meal → Activity route with an honest two-stop
  fallback.
- Source and rights audits that fail closed on unreviewed claims or stale packs.
- Production read-only reliability: 20/20 searches, 20 unique correlations,
  p95 77ms.
- Public browser regression: 14/14 across routing, WebMCP lifecycle, responsive
  geometry, storage, accessibility, and 200%/400% reflow.
- Lighthouse: 99/100/100/100 on the home page and 98/100/100/100 on the planner.

### What we learned

WebMCP is most useful when the website exposes a small set of goal-level actions
instead of mirroring every button. The best tool boundary also improves the
human application: stable IDs, explicit effects, safe outputs, cancellation,
and honest errors become product requirements rather than test details.

We also learned that an agent-native experience is not permission to hide the
evidence. The most valuable moment is the handoff: the agent proposes a route,
the page shows exactly why it fits, and the person decides whether to follow an
official link.

### What's next

The current product deliberately supports three Tokyo hubs and parties of one to
three. Next steps are additional independently reviewed area packs, a user-
controlled live Google enrichment option, transit-aware travel estimates, and
saved-plan sharing that keeps source freshness visible. Booking and payment will
remain out of scope until a venue provides genuine authority and a safe
transaction contract.

## Testing instructions

1. Open <https://serendipity-phase0-hub.vercel.app/plan> in ChatGPT's built-in
   browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.
2. Confirm the page exposes exactly five tools named above.
3. Call `find_evening_plan` with Ikebukuro, three adults, 17:30–22:30, ¥4,000 per
   person, meal on, `CALM_QUIET`, and a 20-minute walking limit.
4. Call `show_place_evidence` for the meal stop and confirm the Sources & hours
   disclosure opens in the page.
5. Call `swap_plan_stop` with `CHEAPER` for that meal and confirm one stop changes
   while the other stops remain stable.
6. Call `save_plan`, inspect Saved plans, then call `delete_saved_plan`.

No login or credentials are required. Google Places is intentionally disabled.
The app makes no booking or external mutation.

## Upload mapping

| Devpost requirement | File or value                                                       |
| ------------------- | ------------------------------------------------------------------- |
| Project name        | `Serendipity`                                                       |
| Tagline             | `One Tokyo evening, planned with evidence.`                         |
| Project story       | This document's Project story section                               |
| Built with          | WebMCP, TypeScript, Next.js, React, Vercel, AJV, Vitest, Playwright |
| Try it out          | `https://serendipity-phase0-hub.vercel.app`                         |
| Source code         | `https://github.com/Kachii1020/serendipity-network`                 |
| Video               | `submission/serendipity-demo.mp4`, then public YouTube URL          |
| Project thumbnail   | `submission/serendipity-thumbnail-3x2.png`                          |
| YouTube thumbnail   | `submission/serendipity-cover.png`                                  |
| Gallery 1           | `submission/gallery-01-inputs.png`                                  |
| Gallery 2           | `submission/gallery-02-route.png`                                   |
| Gallery 3           | `submission/gallery-03-evidence.png`                                |
| Gallery 4           | `submission/gallery-04-webmcp.png`                                  |

## Final manual steps

1. Log in to Devpost and join The WebMCP Challenge.
2. Create or edit the submission and paste the fields above.
3. Upload the cover and gallery images.
4. Upload `serendipity-demo.mp4` to YouTube as **Public** and paste its URL.
5. Confirm the GitHub repository About panel detects the MIT license.
6. Open every submitted URL while logged out.
7. Save Draft, reopen the video and images, then review every checkbox.
8. The user performs the final Submit action before 2026-09-04 05:00 JST.

## YouTube upload

**Title**  
Serendipity — WebMCP Tokyo Evening Planner Demo

**Description**

> Serendipity builds one source-backed Tokyo evening across Shibuya, Shinjuku,
> or Ikebukuro. People and agents use the same five typed WebMCP actions to find
> a plan, inspect official evidence, replace one stop, and explicitly save or
> delete a browser-local copy.
>
> Live app: https://serendipity-phase0-hub.vercel.app  
> Source: https://github.com/Kachii1020/serendipity-network
>
> The WebMCP segment uses Chrome 149+ with the WebMCP testing flag and a
> compatibility test client. It is not presented as a ChatGPT model capture.
> Google Places is off. The product uses published information and official menu
> prices, not live availability, and makes no booking or payment.

**Visibility**  
Public

**Audience**  
Not made for kids

**Thumbnail**  
`submission/serendipity-cover.png`
