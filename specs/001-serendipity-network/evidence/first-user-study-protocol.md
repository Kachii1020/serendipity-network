# First-user and Provider study protocol

**Status:** Protocol only; no participants have been run and no outcome is
recorded here.  
**Target evidence:** `IMP-001` and `IMP-004`  
**Cohort:** Five first-time consumers and two independent venue operators  
**Product scope disclosed to participants:** Shibuya launch network, solo,
synthetic demo inventory, no payment

This protocol freezes recruitment, wording, assistance rules, metrics, and
analysis before sessions begin. A blank field means “not run,” never zero or a
pass. Results belong in a dated, separate evidence record so this document
cannot be mistaken for completed research.

## Questions and decision gates

The study answers four bounded questions:

1. Do urban residents, workers, or visitors experience cross-site compatibility
   work or choice overload when planning an unplanned evening?
2. Can a first-time user reach the Serendipity receipt without explanation or
   recovery help?
3. Do users understand that three independent sites contributed availability,
   a hold is temporary, no payment occurred, and their run used either a Site
   Tool or the labeled manual fallback?
4. Do independent venue operators recognize stale-capacity or duplicate-listing
   work, and under what conditions would an origin-owned tool be acceptable?

Do not add product controls based on anecdotes. The predeclared gates are:

| Gate                  | Pass condition                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Consumer problem      | At least 4/5 independently describe cross-site compatibility work or choice overload.                                                    |
| Provider problem      | 2/2 independently recognize stale capacity or duplicate listing work in their current or a closely comparable workflow.                  |
| Unaided completion    | At least 4/5 reach a three-Provider receipt without procedural assistance.                                                               |
| Time                  | Median entry-to-receipt time is at most 90 seconds.                                                                                      |
| Interaction           | Median dominant actions are at most 4 and median backtracks/misclicks are at most 1.                                                     |
| Product comprehension | At least 4/5 correctly explain three independent sites, a temporary hold, and no payment.                                                |
| Source comprehension  | At least 4/5 correctly identify the observed run as `Site tool` or `Manual fallback`.                                                    |
| Ease                  | Median Single Ease Question score is at least 6/7.                                                                                       |
| Relative burden       | For paired, completed observations, median planning time or cross-site steps are at least 50% lower than the ordinary-browsing baseline. |

Report every gate independently. Do not convert a partial pass into one combined
“validated” result. A Shibuya session can support the general problem statement
and the Shibuya launch-network experience; it cannot prove supply or usability
in another city.

## Recruitment

### Consumers: C01–C05

Recruit five adults who have never seen Serendipity, its screenshots, or a demo.
Across the five, include all three relationships to urban evenings: resident,
worker, and visitor. A participant may fit more than one category.

Exclude:

- anyone who built, reviewed, or previously tested this project;
- anyone who has seen the product flow or been told its three-click sequence;
- anyone under 18;
- duplicate household/team participants if they could have discussed the task.

Record only participant code, broad relationship (`resident`, `worker`,
`visitor`, or a combination), broad city/region, session language, and whether
they use itinerary or reservation sites at least monthly. Do not record name,
email, exact address, employer, account identifiers, or demographic attributes
that are not needed for this decision.

### Providers: P01–P02

Recruit two adults who manage availability, listings, or last-minute capacity
for independent venues or closely comparable small experience businesses. They
must not be affiliated with the project. Record only participant code, broad
venue category, broad city/region, role type, and number of listing channels as
a range. A non-Shibuya operator validates only the workflow problem, not launch
network supply.

## Consent and privacy

Read this verbatim before either session type:

> Serendipity is a prototype study, not a real booking service. This session
> takes about 15 minutes. Product actions use synthetic demo inventory; they do
> not charge you or contact a venue. We will record task timestamps, action
> counts, and your answers under a participant code, not your name. Participation
> is voluntary. You may skip a question, stop at any time, or ask us to delete
> your session data. Screen or audio recording happens only if you separately
> agree. Do you consent to participate and to the anonymized measures described?

Record `consented: yes/no` and date in a private session sheet. Stop immediately
if consent is not affirmative. Ask separately:

> May we record the task screen and audio for analysis? Saying no will not affect
> participation.

No recording is the default. Before any permitted screen recording, close other
tabs and hide browser profiles, notifications, account menus, and extension
panels. Never record ChatGPT account history, cookies, credentials, request
headers, Supabase data, Vercel panels, or the reset secret.

Store raw notes or permitted recordings only under an ignored local artifact
directory such as `artifacts/user-study/raw/`. Keep the committed evidence to
aggregates and short anonymized paraphrases. Delete raw material 30 days after
submission, or earlier on withdrawal. Do not publish a verbatim quote, venue
name, recording, screenshot, or re-identifying combination without separate,
specific permission.

## Session preparation

Use the same production Hub origin and one desktop/laptop viewport for all
consumer sessions. Record browser name/version and whether the page truthfully
reports `Site tool` availability or `Manual fallback`; do not switch modes after
seeing performance.

Before each consumer session:

1. Confirm the production Hub loads with no account or personal data visible.
2. Use the protected reset only through the approved operator process. Never
   show or copy its secret into study notes.
3. Run one read-only search to confirm Kiln, Nori, and Loop answer, then reset the
   page to its initial state. Do not rehearse hold or confirmation in the
   participant's browser.
4. Open ordinary browsing in a clean profile for the baseline and the Hub in a
   separate clean profile or fresh context for the product task.
5. Start with the `Surprising` mood selected. Do not point to any control.
6. Prepare a monotonic timer and the observation sheet; do not rely on video for
   primary timing.

If an infrastructure outage occurs before the participant acts, stop and rerun
on another day under the same protocol. If it occurs after the participant acts,
keep the observation as a completion failure, label the technical cause, and do
not silently replace the participant.

## Consumer session script

Target duration is 15 minutes. Text marked **Say** is read verbatim. Do not
explain WebMCP, the three Providers, temporary holds, or the button sequence
before the comprehension questions.

### 1. Context and ordinary-browsing baseline (maximum 5 minutes)

**Say:**

> Imagine you unexpectedly have tonight free in Shibuya from 6:00 p.m. to 10:30
> p.m. You are going alone and can spend at most ¥5,000. Using the web as you
> normally would, assemble an enjoyable evening with multiple compatible stops.
> Tell me when you have a route you would actually choose. You have up to five
> minutes.

Start the baseline timer after the final sentence. Observe without suggestions.
Record:

- whether a route satisfying time, budget, and location was completed;
- seconds to declared route, capped and labeled `>300` if unfinished;
- number of distinct venue/search sites opened;
- cross-site transitions (switching from one site to another to compare or
  reconcile details);
- stated uncertainty about compatibility, availability, or choice overload;
- a short paraphrase of the main difficulty, if any.

After the task, ask exactly:

> What was the hardest part of making those choices fit together, if anything?

Do not offer examples until after the answer is final. Code cross-site
compatibility or choice overload only when the participant expresses it in
their own words.

### 2. First-use Serendipity task (maximum 3 minutes)

Place the participant on a fresh initial Hub page.

**Say:**

> Now solve the same situation with this site. Choose and reserve an evening you
> would enjoy. Stop when you believe the task is complete. I cannot tell you
> where to click, but you may think aloud.

Start the product timer after the final sentence. Give no procedural help. If
asked what to do, respond only:

> Please do what you would normally try on a new site.

If the participant remains inactive for 30 seconds, ask only:

> What are you looking for right now?

This neutral prompt is not assistance. Any statement naming a control, action
order, Provider, proof disclosure, temporary hold, or expected result is
procedural assistance. Mark the run `aided`, continue for diagnostic learning,
and do not count it as unaided success.

Stop the timer at the first visible receipt containing three Provider-safe
references, at 180 seconds, or when the participant gives up. Record:

- receipt reached (`yes/no`);
- unaided (`yes/no`) and exact assistance, if any;
- entry-to-receipt or stop time in seconds;
- dominant actions: Plan, Hold, Confirm, Release, or a replacement search;
- backtracks/misclicks: an action immediately reversed, an ineffective click,
  or navigation away from the intended flow;
- retries and any visible error/recovery state;
- observed runtime source exactly as displayed (`Site tool`, `Manual fallback`,
  or unavailable/unknown);
- whether the participant opened the proof disclosure without prompting.

### 3. Unprompted understanding, then scored comprehension

Ask each question in order and record a concise paraphrase before showing any
answer choices.

1. **“In your own words, what just happened?”**
2. **“Where did the three activities and their availability come from?”**
3. **“What did ‘Hold for 90 seconds’ do?”**
4. **“Did this interaction charge money or make a real venue booking?”**
5. **“Did this run use a Site Tool, a manual fallback, or are you not sure? What
   on the page tells you that?”**

Score with this locked rubric:

- `independent-sites`: correct only if the answer recognizes three separate
  Provider/venue sites or origins, not one centralized inventory list;
- `temporary-hold`: correct only if inventory was reserved temporarily and could
  expire or be released;
- `no-payment`: correct only if no money was charged and the reservation is a
  demo;
- `runtime-source`: correct only if it matches the page's recorded source and
  cites the banner/activity/proof rather than guessing.

Do not teach between questions. After all answers are locked, clarification is
allowed but must not alter scores.

### 4. Ease and closing questions

**Say:**

> Overall, how difficult or easy was this task? Choose one number from 1, very
> difficult, to 7, very easy.

Record the Single Ease Question response as an integer 1–7. Then ask:

1. **“What, if anything, made you hesitate?”**
2. **“What is the smallest change that would make this useful for a real evening?”**
3. **“Where else would you expect this to work, and what would you need to trust
   that area?”**

The final answer is exploratory. Do not convert requested cities into supported
area claims or implementation commitments.

## Provider interview script

Target duration is 15 minutes. Do not mention a centralized marketplace or an
origin-owned tool until the participant has described the current workflow.

### 1. Current workflow

Ask verbatim:

1. **“When a same-day opening appears, how do potential customers learn it is
   available?”**
2. **“Which sites or channels must someone update, and who updates them?”**
3. **“Tell me about the last time availability became stale or two listings
   disagreed. If that has not happened, what prevents it?”**
4. **“What work is duplicated across those channels, if any?”**
5. **“What happens operationally when two customers try to take the last place?”**

Lock the problem coding before showing the concept. `stale-capacity` requires a
concrete stale or conflicting availability scenario. `duplicate-listing-work`
requires the same availability to be maintained in more than one place. “This
sounds useful” alone satisfies neither code.

### 2. Neutral concept description

Read verbatim:

> Serendipity is a prototype in which each venue keeps availability and booking
> actions on its own website. A browser agent can combine compatible openings
> from three sites, place temporary holds, and confirm only when all three are
> available. The current demo uses synthetic Shibuya inventory, one person, and
> no payment. It is not yet a marketplace or a live venue integration.

Then ask:

1. **“How would this fit or fail to fit your current workflow?”**
2. **“Would keeping the availability action on your own site be preferable,
   worse, or equivalent to maintaining another centralized listing? Why?”**
3. **“What control, audit trail, cancellation rule, or customer information
   would you require before trying it?”**
4. **“What is the smallest integration you would realistically test?”**
5. **“What would make you reject this approach?”**

Record preference as `prefer`, `conditional`, `equivalent`, or `reject`, plus an
anonymized reason. This is stated preference about a prototype, not adoption,
revenue, demand, or willingness-to-pay evidence.

## Observation schema

Create one private row per participant using these fields. Leave values blank
until observed.

### Consumer fields

```text
participant_code
consent_date
recording_consent
relationship_to_city
broad_city_region
session_language
browser_and_version
runtime_source_displayed
baseline_completed
baseline_seconds
baseline_distinct_sites
baseline_cross_site_transitions
problem_compatibility_or_overload
product_receipt_completed
product_unaided
product_seconds
dominant_actions
backtracks_or_misclicks
retries
technical_failure
proof_opened_unprompted
understands_independent_sites
understands_temporary_hold
understands_no_payment
identifies_runtime_source
seq_1_to_7
paraphrased_findings
```

### Provider fields

```text
participant_code
consent_date
recording_consent
venue_category
broad_city_region
role_type
listing_channel_range
recognizes_stale_capacity
recognizes_duplicate_listing_work
origin_owned_tool_preference
required_controls
smallest_testable_integration
rejection_conditions
paraphrased_findings
```

## Analysis rules

1. Freeze the five consumer rows and two Provider rows before calculating
   aggregates; do not replace a difficult session or exclude an outlier after
   looking at results.
2. Treat an aided receipt as a product completion for diagnosis but not as
   unaided success.
3. Calculate a median by sorting the five consumer values and taking the third.
   Do not average the two middle values or report excessive precision.
4. Calculate paired burden reduction only for a measure observed in both tasks:
   `(baseline - product) / baseline * 100`. Report the paired sample size and
   all censored or missing cases. Do not treat `>300` as exactly 300.
5. Count product comprehension as passed per participant only when independent
   sites, temporary hold, and no payment are all correct.
6. Compare runtime-source answers with the source displayed during that exact
   session. Manual fallback success is not WebMCP success.
7. Separate usability failures, infrastructure failures, and unsupported-area
   requests in the narrative, but retain all five recruited consumer outcomes.
8. Use short anonymized paraphrases. Quotes, recordings, participant identities,
   and raw browsing history stay private unless separately authorized.

## Evidence report template

Create a new dated file only after sessions run. It must include:

- recruitment dates and inclusion/exclusion counts;
- browser, viewport, product deployment, service date, and runtime mode;
- a five-row anonymized consumer metric table;
- a two-row anonymized Provider finding table;
- numerator/denominator and median for every gate;
- failed gates and contradictory findings with the same prominence as passes;
- technical incidents and any protocol deviations;
- the resulting `build`, `revise`, or `stop` decision;
- a statement that Shibuya evidence does not prove other-area supply.

Until that report exists, the accurate status is: **protocol prepared; zero
consumer sessions and zero Provider interviews completed**.
