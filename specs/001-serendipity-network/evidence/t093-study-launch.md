# T093 human-study launch package

**Status:** RECRUITING  
**Human consumers completed:** 0/5  
**Human Providers completed:** 0/2  
**Outcome status:** Not run; no usability, problem, preference, or impact result
is claimed in this file.

This is the copy-ready launch companion to the frozen
[first-user study protocol](./first-user-study-protocol.md). The protocol remains
the source of truth for eligibility, scripts, scoring, analysis, and evidence
rules. This package makes recruitment and session operations executable without
changing those rules.

## Evidence boundary

- `C01`–`C05` are five first-time adult consumers. `P01`–`P02` are two
  independent venue operators or operators of closely comparable small
  experience businesses.
- A recruited, scheduled, or screened person is not a completed participant. A
  session counts only after affirmative consent and the applicable protocol has
  been run; every recruited outcome, including failures, remains in the frozen
  cohort.
- Synthetic agents may perform non-human product QA and generate hypotheses.
  They never occupy `C01`–`C05` or `P01`–`P02`, never increase the human counts,
  and cannot satisfy T093 or the human Potential Impact gate.
- A non-Shibuya consumer or Provider may support the general workflow-problem
  finding, but cannot validate Shibuya supply or another area's readiness.
- The product shown is a Shibuya prototype for one person with synthetic demo
  inventory. It takes no payment and does not contact a venue.

## Copy-paste recruitment messages

Send invitations privately. Do not publish names, handles, replies, or contact
details in the repository.

### Consumer — Korean

> 안녕하세요. 갑자기 시간이 생긴 저녁에 여러 장소를 함께 계획하는 경험과
> 새로운 웹 프로토타입의 첫 사용성을 알아보는 약 15분 연구 참가자를 찾고
> 있습니다. 만 18세 이상이며, 시부야에 거주·근무했거나 방문 경험이 있고,
> 이 프로젝트나 데모를 전에 본 적이 없는 분이 대상입니다. 연구용 합성 재고만
> 사용하며 결제나 실제 장소 예약은 발생하지 않습니다. 참여는 자발적이고,
> 질문을 건너뛰거나 언제든 중단할 수 있습니다. 화면·음성 녹화는 별도로
> 동의한 경우에만 진행합니다. 관심이 있다면 아래 짧은 적격성 질문에 답해
> 주세요. 참여 전 연구 내용과 개인정보 처리 범위를 다시 설명드리겠습니다.

### Consumer — English

> Hello. We are recruiting participants for a 15-minute study about planning an
> unexpected evening across multiple places and the first-time use of a web
> prototype. You may be eligible if you are 18 or older, have lived, worked, or
> visited in Shibuya, and have never seen this project or its demo. The prototype
> uses synthetic study inventory; it makes no payment or real venue booking.
> Participation is voluntary, and you may skip a question or stop at any time.
> Screen or audio recording happens only with separate consent. If interested,
> please answer the short eligibility questions below. We will explain the study
> and privacy boundaries again before participation.

### Provider — Korean

> 안녕하세요. 독립 매장 또는 소규모 체험 사업에서 당일 빈자리와 여러
> 게시·예약 채널을 어떻게 관리하는지 알아보는 약 15분 인터뷰 참가자를 찾고
> 있습니다. 만 18세 이상이며, 현재 빈자리·목록·막바지 수용 가능 인원을 직접
> 관리하거나 책임지는 분이 대상입니다. 현재 업무를 먼저 여쭙고, 이후 결제나
> 실제 예약이 없는 연구용 프로토타입 개념을 간단히 설명드립니다. 고객정보,
> 계정 접근, 매출, 영업기밀은 요청하지 않습니다. 참여는 자발적이고, 질문을
> 건너뛰거나 언제든 중단할 수 있으며 녹화는 별도 동의가 있을 때만 진행합니다.
> 관심이 있다면 아래 짧은 적격성 질문에 답해 주세요.

### Provider — English

> Hello. We are recruiting participants for a 15-minute interview about how
> independent venues or small experience businesses manage same-day openings
> across listing or reservation channels. You may be eligible if you are 18 or
> older and currently manage or are responsible for availability, listings, or
> last-minute capacity. We will ask about the current workflow first, then give a
> short description of a study prototype that makes no payment or real booking.
> We will not request customer data, account access, revenue, or business
> secrets. Participation is voluntary; you may skip a question or stop at any
> time, and recording requires separate consent. If interested, please answer
> the short eligibility questions below.

## Minimal eligibility screeners

Ask only these questions. Store recruitment contact details separately from the
research row, and transfer only the permitted broad fields after eligibility is
confirmed.

### Consumer screener

1. Are you 18 or older? (`yes` required)
2. Have you built, reviewed, tested, seen, or been told how to use Serendipity or
   this demo? (`no` required)
3. What is your relationship to Shibuya? (`resident`, `worker`, `visitor`, or a
   combination; at least one required)
4. What broad city or region do you currently relate to? (no exact address)
5. Which session language do you prefer? (`Korean` or `English`)
6. Do you use an itinerary or reservation site at least monthly? (`yes/no`; not
   an exclusion criterion)
7. Is anyone from your household or team already taking part, or likely to
   discuss the task with you before your session? (`no` required)

Across the final five eligible consumers, retain all three urban relationships:
resident, worker, and visitor. Do not collect exact age, employer, address,
account ID, or unrelated demographic attributes.

### Provider screener

1. Are you 18 or older? (`yes` required)
2. Do you currently manage or take responsibility for availability, listings,
   or last-minute capacity for an independent venue or closely comparable small
   experience business? (`yes` required)
3. Are you affiliated with, or have you built, reviewed, or tested,
   Serendipity? (`no` required)
4. What is the broad venue category and broad city or region? (no venue or
   business name)
5. What broad role type best describes the responsibility?
6. How many listing or reservation channels are maintained? Record only a range
   (`1`, `2–3`, `4–6`, or `7+`).

## Recruitment and aggregate tracker

This committed table contains counts only. Participant contact details,
screening answers, consent records, and raw notes stay in a private session
sheet. Update counts without inserting identifying text.

| Human cohort | Target | Invited | Screened | Eligible | Scheduled | Consented | Completed |
| ------------ | -----: | ------: | -------: | -------: | --------: | --------: | --------: |
| Consumers    |      5 |       0 |        0 |        0 |         0 |         0 |         0 |
| Providers    |      2 |       0 |        0 |        0 |         0 |         0 |         0 |

Outcome aggregates stay explicitly not run until the cohort is frozen and the
dated result report exists.

| Frozen gate                  | Target                        | Current human evidence |
| ---------------------------- | ----------------------------- | ---------------------- |
| Consumer problem             | At least 4/5                  | — (not run)            |
| Provider problem             | 2/2                           | — (not run)            |
| Unaided receipt              | At least 4/5                  | — (not run)            |
| Entry-to-receipt time        | Median at most 90 seconds     | — (not run)            |
| Actions/backtracks           | Median at most 4 / at most 1  | — (not run)            |
| Product comprehension        | At least 4/5                  | — (not run)            |
| Runtime-source comprehension | At least 4/5                  | — (not run)            |
| Single Ease Question         | Median at least 6/7           | — (not run)            |
| Relative planning burden     | Median reduction at least 50% | — (not run)            |

## Scheduling and session-preparation checklist

### Silent observer attention list

The initial non-human QA identified these hypotheses. Observers may record them
when they occur but must not mention, explain, point to, or ask about them before
the frozen comprehension questions:

- whether `Live Provider network` and `Manual connection` appear contradictory;
- whether the participant mistakes the temporary hold for task completion;
- whether alternative cost/travel summaries are sufficient before selection or
  changing option numbers causes confusion;
- whether a Provider appears both `Connecting` and `Ready` at once.

These are not scored passes or assumed defects. Preserve unprompted behavior and
record `not observed` when absent.

### Schedule privately

- [ ] Confirm eligibility without collecting extra demographic or business
      information.
- [ ] Assign the next code (`C01`–`C05` or `P01`–`P02`); keep the person's name
      and contact details in a separate private calendar or contact sheet.
- [ ] Book one uninterrupted 15-minute slot and allow setup/cleanup time between
      sessions. Do not let participants discuss the task with each other.
- [ ] Send only time, meeting/location details, the prototype/no-payment
      disclosure, voluntary-participation reminder, and any recording request.
      Do not reveal the three-action sequence, controls, Provider architecture,
      temporary-hold meaning, or expected answers.
- [ ] Prepare a private observation row with every protocol field blank. A
      missing result remains blank, never zero or pass.

### Before every participant

- [ ] Read the protocol's consent statement verbatim and record affirmative
      participation consent and date in the private sheet. Ask recording consent
      separately; no recording is the default.
- [ ] If recording was approved, close other tabs and hide browser profiles,
      notifications, account menus, and extensions before capture.
- [ ] Prepare a monotonic timer and observation sheet. Do not rely on video for
      primary timing.
- [ ] For Provider interviews, ask all current-workflow questions and lock the
      problem codes before reading the neutral concept description.

### Additional consumer-session preparation

- [ ] Use the same production Hub,
      `https://serendipity-phase0-hub.vercel.app`, and the same desktop/laptop
      viewport for all five sessions. Record browser name/version and the source
      label displayed by that exact run.
- [ ] Obtain the fresh production-reset authorization below before running any
      study reset. Prior reliability-test authorization does not extend to human
      sessions.
- [ ] Run the protected reset without exposing its secret, confirm `RESET` and
      exactly nine restored slots, then run one read-only search confirming
      Kiln, Nori, and Loop. Return the page to its initial state without
      rehearsing Hold or Confirm in the participant's browser.
- [ ] Put ordinary browsing in one clean profile and the Hub in a separate fresh
      profile or context. Start with `Surprising` selected and point to no
      control.
- [ ] After the session, run the separately authorized cleanup reset before the
      next consumer. Confirm nine restored slots and record only the safe reset
      status/correlation in the operator log, not the participant sheet.

## Exact production-reset approval prerequisite

No T093 consumer session may invoke the production reset until the project owner
has issued this exact batch authorization:

> 전용 demo production `https://serendipity-phase0-hub.vercel.app`에서 T093
> 소비자 세션 C01–C05를 위해 각 세션 직전과 각 세션 종료 후 보호 reset을
> 순차 실행하는 것을 승인합니다. reset이 기존 demo active hold를 삭제할 수
> 있음을 이해하며, 매회 정확히 9개 슬롯 복원을 확인합니다. reset 또는
> read-only 사전 검증이 실패하면 해당 세션을 시작하지 않고 추가 production
> mutation 없이 중단합니다.

The operator must also make the technical target explicit with
`ALLOW_PRODUCTION_RESET=serendipity-phase0-hub.vercel.app`. The secret must come
from the existing approved operator process (macOS Keychain service
`serendipity-network-demo-operator` or the private server environment), must be
at least 32 bytes, and must never enter a command transcript, study note,
recording, screenshot, or committed file. Do not substitute a different origin,
expand the mutation scope, or proceed after a reset envelope other than
successful `RESET` with nine restored slots.

## Stop, consent, and privacy boundaries

Stop or exclude as follows; never improvise around these conditions:

- No affirmative participation consent: stop immediately and collect no task
  measures. No separate recording consent: continue only without recording.
- Under 18, prior product exposure, project affiliation, or household/team
  contamination: do not enroll that person in the applicable cohort.
- Infrastructure outage before participant action, failed reset, fewer or more
  than nine restored slots, failed three-Provider read-only search, unexpected
  payment/real booking/venue contact, or exposed credential: stop before the
  task and reschedule only under the same protocol after the issue is resolved.
- Infrastructure failure after participant action: stop safely, retain the
  observation as a completion failure, label the technical cause, and do not
  replace the participant or silently rerun the session.
- During the product task, stop timing at the first valid three-Provider
  receipt, 180 seconds, or participant withdrawal/give-up. Preserve aided and
  failed outcomes under their original codes.
- If personal, customer, account, or confidential business information appears,
  pause capture, remove it from notes, and continue only if the session can do
  so without that information.
- A participant may skip any question, stop, withdraw, or request deletion.
  Delete their raw session material and remove the row from analysis when
  requested; document only the aggregate withdrawal count.

Keep the committed evidence to aggregate counts and short anonymized
paraphrases. Never commit names, emails, handles, exact addresses, employers,
venue names, account identifiers, browsing history, recordings, request
headers, cookies, Supabase/Vercel panels, secrets, raw hold tokens, or
re-identifying combinations. Store permitted raw notes or recordings only in an
ignored local directory such as `artifacts/user-study/raw/`; delete them 30 days
after submission or earlier on withdrawal. Quotes, screenshots, venue names, or
recordings require separate specific publication permission.

## Launch sequence

1. Send the appropriate bilingual recruitment message and screener privately.
2. Select eligible people without substituting, removing, or replacing a hard
   case after outcomes are visible; schedule `C01`–`C05` and `P01`–`P02`.
3. Obtain the exact production-reset approval before the first consumer reset.
4. Run each session with the frozen verbatim script and assistance rules; store
   raw records privately and counts here.
5. Freeze all five consumer and two Provider rows before calculating any gate.
6. Create a separate dated evidence report containing recruitment counts,
   environment, all anonymized rows, gate numerators/denominators and medians,
   failures, deviations, and the resulting `build`, `revise`, or `stop`
   decision.

Until step 6 is complete, the only accurate result statement is: **recruitment
package prepared; zero human consumer sessions and zero human Provider
interviews completed.**
