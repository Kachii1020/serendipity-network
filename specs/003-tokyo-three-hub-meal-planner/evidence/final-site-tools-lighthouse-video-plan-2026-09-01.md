# Final Site Tools, Lighthouse, and video plan — 2026-09-01

## Current production evidence

Immutable production deployment `dpl_97KgepTTGC78xp14v6cQw97NeAfi` remains
bound to <https://serendipity-phase0-hub.vercel.app>. Google Places enrichment
is off; the official-menu path is the production path.

Lighthouse 13.4.1 was run against the public fixed alias on 2026-09-01 JST.

| Route   | Performance | Accessibility | Best Practices | SEO |   LCP |     CLS |   TBT |
| ------- | ----------: | ------------: | -------------: | --: | ----: | ------: | ----: |
| `/`     |          99 |           100 |            100 | 100 | 2.12s |       0 | 8.5ms |
| `/plan` |          98 |           100 |            100 | 100 | 2.28s | 0.00016 | 7.5ms |

The HTML and JSON reports are retained locally under `artifacts/lighthouse/`.
They are generated evidence and are not required in the public repository.

## Real Site Tools status

Official OpenAI guidance says Site Tools are available only in the ChatGPT
desktop built-in browser when the account and selected model support them. The
address-bar arrow is the authoritative Available/Recently used surface.

The current production `/plan` was freshly loaded three times in the actual
built-in browser. All three loads returned:

- `document.modelContext`: absent;
- available tools: zero;
- page status: `Planner ready`, not `AI tools connected`.

This is a client/account availability block, not a production registration
failure: the same fixed production deployment passed the Chrome WebMCP exact-
five lifecycle in the public 14-case browser suite. Automated Chrome evidence is
not counted as real Sol/Terra evidence.

### Exact closure procedure when access appears

1. In ChatGPT desktop Browser settings, confirm **Permissions → Enable site
   tools**.
2. Open production `/plan` in Work with one eligible model. Use Sol first; use
   Terra as a separate series if it is exposed. Never mix models inside a 3-run
   series.
3. Before any call, open Available and capture exactly these five tools:
   `find_evening_plan`, `show_place_evidence`, `swap_plan_stop`, `save_plan`,
   `delete_saved_plan`.
4. Run three fresh consecutive conversations with the same canonical intent:
   Shinjuku, three adults, 17:30–22:30, ¥7,000 per person, Food discovery, meal
   on, 20-minute walking limit.
5. In every run ask the model to find the plan, open the meal evidence, change
   one stop, save it, and delete the saved copy. Review every mutation prompt.
6. Capture the rendered route, source/menu disclosure, changed stop, save/delete
   state, address-bar Available, and Recently used sequence.
7. Fail the whole series on a missing/extra tool, DOM/manual substitution,
   duplicate mutation, secret-shaped field, stale result, or UI/tool mismatch.
8. Record model, app version, run number, elapsed time, exact tool order, safe
   correlation IDs, and sanitized screenshot names. Restart the series from
   zero after any failure.

## Alpaca video method recovered

The Alpaca project did not record a conventional screen narration. It used a
reproducible artifact pipeline:

1. Freeze a fact-lock JSON before editing the story.
2. Capture clean production scenes with Playwright at 1920×1080/30fps.
3. Store narration as eight scene records in `video-narration.json`.
4. Generate one WAV per scene with OpenAI neural TTS (`marin`) in a GitHub
   workflow whose key is held in a GitHub Environment secret.
5. Transcribe each generated WAV with `whisper-1` to obtain actual speech
   timestamps.
6. Keep those timestamps but correct transcript spelling to the approved source
   narration; do not estimate caption timing.
7. Normalize the base MP4 once. Render captions as a transparent alpha timeline
   and overlay it once with FFmpeg, avoiding repeated stream-copy timestamp
   discontinuities.
8. Export H.264/AAC 48kHz stereo, inspect representative frames, measure audio,
   decode the whole file, and run a secret/claim scan before freezing the MP4.

## Serendipity adaptation — target 2:20

The production method stays the same; the story is shorter and Site Tools are
recorded only after the real-client gate passes.

| Time      | Scene       | Visible proof                                 | Narration purpose                                          |
| --------- | ----------- | --------------------------------------------- | ---------------------------------------------------------- |
| 0:00–0:12 | Hook        | Three Tokyo hubs and one CTA                  | Free time should not become tab work.                      |
| 0:12–0:32 | Inputs      | Hub, party, per-person budget, interest, meal | Show the real consumer choices.                            |
| 0:32–0:48 | Analysis    | All four truthful analysis stages             | Explain published hours/menu matching and walking balance. |
| 0:48–1:14 | Route       | Full-width A→M→A result and group estimate    | Show an actionable plan, not a dashboard.                  |
| 1:14–1:34 | Evidence    | Official menu, hours, checked date            | Establish why the price and timing are defensible.         |
| 1:34–1:58 | Site Tools  | Available → find → evidence → swap            | Show why typed WebMCP beats DOM driving.                   |
| 1:58–2:10 | Save/delete | Explicit local save and deletion              | Demonstrate bounded mutations and shared UI state.         |
| 2:10–2:20 | Close       | Three hubs plus limitation copy               | Published information, not live availability or booking.   |

### Files to create after real-client closure

- `.github/workflows/render-submission-tts.yml`
- `scripts/render_submission_tts.py`
- `scripts/record-v3-demo.mjs`
- `submission/video-narration.json`
- `submission/fact-lock-final.json`
- `submission/serendipity-demo.mp4`
- `specs/003-tokyo-three-hub-meal-planner/evidence/VIDEO_SCRIPT.md`

### Promotion gates

- duration 2:10–2:40 and always below the 2:59 limit;
- 1920×1080, 30fps, H.264/AAC 48kHz stereo;
- English narration and burned-in captions, maximum two lines;
- no profiles, notifications, secrets, account identifiers, copyrighted music,
  third-party photos, or unsupported live/booking claim;
- every number and claim equals the fact lock;
- entire MP4 decodes, no clipped captions, no audio clipping, and representative
  start/middle/end frames pass visual review;
- manual fallback footage is never labelled as Site Tools evidence;
- if real Site Tools remain unavailable, cut the Site Tools execution scene and
  state the availability limitation instead of fabricating it.

## Immediate blocker

The Serendipity repository currently has no `OPENAI_API_KEY` GitHub secret. Do
not create or transmit a key until the user explicitly authorizes adding it to a
dedicated GitHub Environment. This does not block scripting, production scene
capture, fact lock, or the final human voice alternative.
