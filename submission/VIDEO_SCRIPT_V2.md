# Serendipity demo narration v2

## Voice direction

- Model: `gpt-4o-mini-tts-2025-12-15`
- First choice: `cedar`
- A/B alternative: `marin`
- Disclosure: `AI-generated narration`
- Keep the existing production footage and scene order.

Voice instruction:

> Speak like a thoughtful solo developer showing a friend something they built.
> Use natural American English. Sound calm, warm, and slightly informal. Keep a
> steady conversational pace with small pauses after short sentences. Avoid
> announcer energy, sales-pitch cadence, exaggerated enthusiasm, and polished
> corporate delivery. Pronounce WebMCP as “Web M C P.”

## Script

### 0:00 — The problem

> This started with a pretty ordinary problem. I’d have a free evening in Tokyo,
> open a place, check dinner nearby, then look at walking time—and somehow end up
> with ten tabs and no plan.

### 0:15 — The choices

> Serendipity is the version I wanted for myself. I choose a neighborhood, how
> many people are going, what we want to spend, and what kind of night sounds
> good. I can include dinner, or leave it out.

### 0:31 — What it checks

> When I build the plan, it checks published opening hours, official menu prices,
> and the walking time between stops. The point is to get one route that actually
> fits the evening.

### 0:46 — The result

> For this run, it found Animate Ikebukuro, dinner at Ootoya, and Sunshine 60.
> That’s three stops, about twenty-five minutes of walking, with a price estimate
> for the whole group. If a third stop doesn’t fit, it just shows two and tells me
> why.

### 1:06 — The evidence

> I didn’t want the plan to sound more certain than its sources. So every stop
> shows where its hours and price came from, plus the official page to check
> before going. It doesn’t pretend a seat is available, and it doesn’t make a
> booking.

### 1:24 — Why WebMCP

> The WebMCP part is what makes this more than a form. Instead of trying to click
> around the page, an AI assistant gets five clear actions: find a plan, show the
> evidence, change one stop, save it, or delete it. And I can see those changes on
> the same screen while it works.

### 1:52 — Save and delete

> Only save and delete change anything, and the saved plan stays in this browser.
> There’s no account, no payment, and nothing gets sent to a venue.

### 2:08 — Close

> That’s the idea behind Serendipity. Give me one Tokyo evening, and help me turn
> it into a plan I can actually check and use.

## Why this version is less synthetic

- Starts with a concrete moment instead of a product thesis.
- Uses a consistent first-person builder perspective instead of a detached pitch.
- Uses short spoken sentences and contractions.
- Removes phrases such as “actionable route,” “bounded mutation,” “source-backed
  workflow,” and “validated controller.”
- Explains WebMCP through the visible difference rather than architecture.
- Leaves technical proof on screen instead of reading every implementation fact
  aloud.

## Audio acceptance

- Generate the problem and WebMCP sections in both `cedar` and `marin` first.
- Reject any voice that sounds like an advertisement or news narration.
- Check pronunciation of Shibuya, Shinjuku, Ikebukuro, Ootoya, and WebMCP.
- After selection, generate one WAV per scene.
- Transcribe the generated WAVs and keep the real timestamps for captions.
- Burn a small visible `AI-generated narration` disclosure into the intro.
- Preserve the existing MP4 until the replacement passes full listening review.
