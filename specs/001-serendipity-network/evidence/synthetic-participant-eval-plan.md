# Synthetic participant evaluation plan

**Status:** Initial short synthetic matrix executed; the 2026-08-29 user decision
supersedes the original human-dependent T095 promotion rule. Final post-change
synthetic acceptance is recorded separately. Zero human sessions are reported.  
**Evidence class:** Non-human product QA and hypothesis generation.  
**Human-study status:** Unchanged at zero consumers and zero Provider
interviews.  
**Related gates:** T082/T085/T090 require real Sol/Terra agent runs. T093 and
T096 retain their human protocol but are optional supporting research.

## 2026-08-29 supersession

The original plan below is preserved as historical methodology. The user later
authorized automated and explicitly non-human synthetic evidence as the T095
promotion gate. It may support the internal Potential Impact proxy when combined
with exact preset outcomes, accessibility, truthful copy, and production
reliability. It still must not be described as human usability, market demand,
real Provider validation, or adoption evidence.

## Decision

Synthetic agents are useful reviewers and product actors, but they are not a
valid substitution for the five consumers and two independent venue operators
in `first-user-study-protocol.md`.

The [official Devpost rules](https://webmcp.devpost.com/rules) do **not** require
a particular interview or participant count. They judge Potential Impact by
whether the submission makes a credible, specific case for a real problem and
real audience, and whether the demonstrated solution actually addresses that
problem. The [official OpenAI challenge page](https://openai.com/webmcp-challenge/)
also names usefulness and the quality of the human-agent experience. Therefore:

- real Sol/Terra runs are valid direct evidence that agents can use the product;
- synthetic walkthroughs are valid supporting evidence about workflow,
  comprehension risks, error handling, and submission clarity;
- neither establishes that real people experience the stated planning burden;
- neither establishes an independent venue's current operating workflow,
  controls, willingness to test, or adoption constraints.

The original repository plan chose a higher human-evidence bar than the official
eligibility minimum. That bar now remains an optional research lens rather than
a T095 release or internal score blocker. Re-labeling model outputs as people is
still forbidden.

## Why five agents are not five consumers

Five fresh model sessions are repeated samples from one or a few related model
distributions, not five independently situated people. They have no personal
tonight-planning history, opportunity cost, physical location, budget
consequence, booking risk, or genuine confusion. Their training priors and
browser affordances also differ from those of first-time human users.

Likewise, two Provider-role agents have never managed a venue's last place,
reconciled a stale listing, handled a customer dispute, or accepted operational
accountability. They can audit the proposed contract and generate questions,
but any incident, preference, or willingness-to-adopt statement they produce is
a simulation supplied by the evaluator, not field evidence.

## Evidence boundary by frozen study gate

| Frozen gate                       | What agents can test                                                            | What agents cannot establish                                              | Human gate status after a synthetic pass              |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| Consumer problem, 4/5             | Check whether the problem statement is specific and find public counterexamples | Personally report cross-site burden or choice overload                    | Open                                                  |
| Provider problem, 2/2             | Audit whether stale capacity and duplicate writes are technically plausible     | Report a real venue's current workflow or a concrete past incident        | Open                                                  |
| Unaided completion, 4/5           | Complete the live flow from a goal-only prompt in fresh sessions                | Predict novice human completion rate                                      | Open; report separately as synthetic agent completion |
| Median time <=90s                 | Measure agent/tool and page latency                                             | Measure human interpretation and decision time                            | Open; label as agent task time only                   |
| Actions/backtracks                | Count agent tool/UI actions and recovery paths                                  | Reproduce human pointing, reading, or motor errors                        | Open; useful diagnostic proxy                         |
| Product/source comprehension, 4/5 | Answer locked questions from visible page evidence                              | Demonstrate human mental models or recall                                 | Open; report as model interpretation                  |
| SEQ >=6/7                         | Identify likely friction and copy ambiguity                                     | Supply a psychometrically meaningful human ease rating                    | Open; do not ask agents for SEQ                       |
| Relative burden >=50%             | Count deterministic steps in controlled paths                                   | Compare a person's ordinary browsing burden with their product burden     | Open                                                  |
| Provider preference/controls      | Threat-model permissions, audit, cancellation, and integration needs            | Establish preference, acceptance, demand, willingness to pay, or adoption | Open                                                  |

## Synthetic matrix that can run now

All outputs must use the prefix `SYN-`, state the model/client, and say
`non-human`. No result is copied into the C01-C05 or P01-P02 rows.

| ID          | Independent run                                            | Input and constraints                                                                                                                                            | Recorded measures                                                                             | Valid claim                                                   |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| SYN-C01-C05 | Five fresh goal-only browser agents                        | Initial production page; no repository, screenshots, button order, architecture explanation, or prior turns; task: choose and reserve a suitable Shibuya evening | Completion, visible source, elapsed agent time, UI actions, retries, errors, final state      | `x/5 synthetic agents completed the live flow`                |
| SYN-Q01-Q05 | Five fresh comprehension graders, isolated from the actors | Only final-state screenshot/accessibility tree and the five locked comprehension questions                                                                       | Independent-sites, temporary-hold, no-payment, runtime-source answers with cited visible text | `x/5 model interpretations matched the locked rubric`         |
| SYN-R01-R05 | Five fresh recovery actors                                 | One preselected fault each: no result, expired hold, Provider timeout, partial-hold compensation, manual fallback                                                | Safe stop/recovery, accidental confirm count, misleading success copy, secret exposure        | Specific failure paths are or are not recoverable by an agent |
| SYN-A01-A03 | Three evidence-only rubric reviewers                       | Official rubric plus submission draft and links; no implementation claims not present in evidence                                                                | Criterion ranges, unsupported claims, missing proof, inter-rater spread                       | Submission narrative strengths and evidence gaps              |
| SYN-P01-P02 | Two isolated Provider contract reviewers                   | API/tool contracts, Provider UI, security model, and neutral concept description; no invented business persona or incident                                       | Required controls, integration gaps, rejection risks, threat model                            | Two non-human contract reviews found named risks              |
| SYN-X01-X03 | Three adversarial Provider-output reviewers                | Prompt-injection strings, malformed results, wrong origin, stale reference                                                                                       | Whether the agent follows untrusted instructions or the product fails closed                  | Agent-facing security behavior under named fixtures           |

### Isolation and reproducibility rules

1. Start every actor with no inherited conversation context and disclose only
   the task text specified above.
2. Keep model and reasoning mode fixed within a cohort. Sol and Terra results
   are separate cohorts, not pooled independent participants.
3. Use one fixed production deployment and service date. Reset through the
   protected operator process between mutation runs; run mutations sequentially.
4. Do not let an actor read source code, tests, this protocol, the tool list, or
   another actor's transcript before acting.
5. Preserve every recruited run, including failures. Do not rerun and replace a
   bad result; record any infrastructure incident.
6. Capture page source label, tool names, status, correlation IDs, elapsed time,
   final screenshot, and sanitized transcript. Never capture secrets or raw hold
   tokens.
7. Score with deterministic rules after freezing outputs. A reviewer that knows
   the expected answer must not act as the participant.
8. Report each model/client separately and state that within-model samples are
   correlated.

## Recommended execution order

1. Run the real Sol/Terra tool-selection and end-to-end gates first. These are
   genuine WebMCP execution evidence and may reveal that synthetic UX runs are
   premature.
2. Run SYN-C/Q/R against the exact final deployment to find flow and copy
   failures before recruiting people.
3. Run SYN-P/X as contract and safety reviews; turn repeated concrete findings
   into hypotheses for the real Provider interviews.
4. Run SYN-A last against the finished evidence package to remove unsupported
   submission claims.
5. Run the frozen C01-C05 and P01-P02 protocol. Keep synthetic and human tables
   separate even if their findings agree.

## Truthful reporting language

Allowed:

> Five isolated synthetic agents completed the production flow under a frozen
> goal-only protocol. This is non-human workflow evidence; human usability and
> real Provider validation remain open.

Not allowed:

> Five consumers validated the product.

Allowed:

> Two non-human Provider contract reviewers identified audit, cancellation, and
> integration requirements that will be tested in operator interviews.

Not allowed:

> Two Providers prefer origin-owned tools.

## Score implication

A strong synthetic matrix can improve execution confidence, demonstrate the
agent half of the human-agent experience, and—under the 2026-08-29 user-approved
proxy—support the internal Potential Impact target when the other deterministic
and production gates pass. It cannot close T093 or T096 and cannot support claims
of human usability, demand, adoption, or real Provider preference.
