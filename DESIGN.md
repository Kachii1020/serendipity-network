# Serendipity Sticker Network Design Contract

**Status**: Approved for MVP implementation  
**Approved**: 2026-08-27  
**Applies to**: Hub, Provider `/`, Provider `/embed`, deterministic visual fixtures

## Product posture

Serendipity Network should feel like accepting a playful invitation, not operating
a booking dashboard. The first viewport asks one large question, offers a few
large mood choices, and presents one obvious action. The technical achievement is
still visible: three independent Provider sites respond as a live sticker network.

The visual direction is **Sticker Network**, an owned adaptation of the selected
Sticker City/Slush direction. It keeps strong color, black cutout outlines, oversized
controls, and sticker-like Provider identities. It deliberately rejects Slush's
extreme 200px display type, 3D ribbon assets, and continuous decorative motion.

## Experience layers

1. **Invitation layer**: mood question, large choices, compact constraints, one CTA.
2. **Journey layer**: one recommended three-stop evening, totals, reason, and one
   state-derived action.
3. **Live WebMCP layer**: Kiln, Nori, and Loop Provider stickers remain visible and
   show actual connection and operation progress.
4. **Proof layer**: `See WebMCP in action` expands the real cross-origin Provider
   `/embed` iframes, route proof, and sanitized Tool Activity.

The proof layer is secondary in visual weight, never fake, and always one user
action away. The live Provider strip is part of the main experience at all widths.

## Tokens

### Core surfaces and actions

| Token             | Value     | Required use                               |
| ----------------- | --------- | ------------------------------------------ |
| `canvas`          | `#DCEEFF` | page atmosphere                            |
| `paper`           | `#FFFFFF` | focused content and proof surfaces         |
| `ink` / `outline` | `#000000` | primary text and cutout borders            |
| `action`          | `#5C4ADE` | the single dominant action                 |
| `action-ink`      | `#FFFFFF` | text/icons on `action`                     |
| `soft-lavender`   | `#E9CCFF` | secondary decorative or comparison surface |
| `focus`           | `#5C4ADE` | visible 3px focus ring with 2px offset     |

Verified contrast pairs: black/canvas `17.72:1`, black/paper `21:1`, and
white/action `6.02:1`. Components must not create unchecked foreground/background
pairs from these tokens.

### Provider identity

| Provider     | Identity token   | Foreground |  Contrast |
| ------------ | ---------------- | ---------- | --------: |
| Kiln Studio  | mint `#55DB9C`   | black      | `12.00:1` |
| Nori Counter | yellow `#FFD731` | black      | `15.02:1` |
| Loop Room    | orange `#FB8050` | black      |  `8.31:1` |

Provider colors mean identity only. They never mean success, warning, or failure.
Operation status uses an icon or shape plus a text label, with semantic state tokens
defined separately in `packages/ui`.

### Type, shape, and spacing

- UI copy uses Inter when bundled locally and a system sans-serif fallback.
- Display copy uses an owned heavy condensed stack with a system fallback. No
  runtime font request is required for the canonical path.
- Display headline: `clamp(2.5rem, 6vw, 4.75rem)`, compact line-height `0.94–1.02`.
- Body copy is at least 16px; supporting copy is at least 14px.
- Cards use 24–36px radii; interactive pills may use `999px`.
- Interactive controls are at least 52px high; the primary CTA is 56–64px high.
- Cutout surfaces use a 1px black outline and, when needed, a restrained 2–3px
  solid offset shadow. Avoid layered glass, soft SaaS shadows, and card nesting.

## Component recipes

### Mood choice

- Large outlined pill or tile with a plain-language label and optional small symbol.
- Selected state uses fill, check icon, and `Selected` semantics; fill alone is not
  sufficient.
- Four choices should be visible without horizontal scrolling at 390px.

### Live Provider sticker

- Shows Provider name, separate connection label, separate latest-operation label,
  and an icon/stamp.
- Uses the Provider identity color as its base.
- Allowed operation labels: `Ready`, `Checking`, `Found`, `Holding`, `Held`,
  `Confirming`, `Confirmed`, `Releasing`, `Released`, `Needs attention`, `Unknown`.
- Labels are derived from validated orchestration events, never decorative timers.
- `HELD` and `CONFIRMED` stamps appear only after the corresponding Provider result
  is authoritative. A compensation path visibly changes prior successes to
  `Releasing` then `Released`.

### Stop band

- One full-width colored band per stop, ordered chronologically.
- Provider identity, start time, activity title, and price are large and scannable.
- Travel and spare gap are text between bands, not tiny metadata inside a card.
- Stop and Provider sticker share the same Provider identity token and name.

### Primary action

- Exactly one filled violet action may dominate a workflow state.
- Copy states the effect, using `Plan my night`, `Hold for 90 seconds`,
  `Confirm demo reservation`, `Check status`, or `Start over` as applicable.
- Pending mutation states have no conflicting enabled primary action.

### WebMCP proof disclosure

- The persistent trigger reads `See WebMCP in action` and includes the current live
  Provider count or latest event count.
- The detailed proof is collapsed at idle by default and never auto-opens over the
  user's task. During operations, the main Provider stickers supply the live proof.
- Expanded order: explanation of independent origins, three real `/embed` iframes,
  stylized route with text equivalent, sanitized Tool Activity.
- Iframes remain mounted when required for tool registration even when their visual
  proof region is collapsed; collapsed content must not become keyboard-focusable.
- Manual mode says `Manual connection` and must not claim WebMCP is connected.

## State and motion

- State changes may use a single 120–240ms opacity/transform transition, a short
  stamp arrival, or a one-time route draw.
- No looping stickers, parallax, animated gradients, autoplay media, or motion that
  is required to understand state.
- `prefers-reduced-motion` renders final geometry immediately while preserving all
  text labels and announcements.
- Layout space for Provider stickers and proof frames is stable across connection
  and operation changes.

## Responsive contract

- `>= 1280px`: centered single journey column up to about 1120px. The live Provider
  strip may sit beside the result heading only when the result remains dominant;
  detailed proof expands below the journey.
- `768–1279px`: single column; three Provider stickers remain in one row when each
  retains readable name and status, otherwise wrap.
- `< 768px`: order is header/status, mood prompt, constraints/action, live Provider
  strip, journey, alternatives, proof disclosure. Provider stickers may be a 3-row
  stack; no horizontal workflow scroll.
- At 320px and 200% zoom, content reflows without hiding actions. The visual route
  may simplify, but its text equivalent stays present.

## Accessibility, privacy, and performance

- Native controls, logical headings, visible focus, 44px minimum targets, and
  text/icon status parity are non-negotiable.
- Material workflow changes use appropriate live-region announcements. Background
  Provider changes never steal focus.
- Iframes have stable titles that name the Provider and purpose.
- Tool Activity shows only origin, public tool name, status, timestamp, duration,
  safe correlation ID, and sanitized error code. It never exposes prompts, tokens,
  idempotency keys, credentials, or hidden reasoning.
- The invitation shell renders without waiting for Provider connection. No map SDK,
  remote font, heavy hero image, or required illustration asset is in the MVP path.

## Do / do not

Do make the first interaction feel immediate, keep labels conversational, and let
the three real sites visibly participate. Do use asymmetry and a few paper-cut
shapes for energy when they do not reduce comprehension.

Do not recreate a SaaS dashboard rail, bury the result under technical panels,
place cards inside cards, use color as the only status signal, fake sequential
Provider progress, or expose raw debugging data.

## Reference lineage

- Selected base: [Slush / Sticker City](https://styles.refero.design/style/8b6b547f-a357-4f1b-9842-4579c62dd42b)
- Supporting product evidence: [Partiful](https://partiful.com/),
  [PamPam](https://www.pampam.city/ai-trip-planner), [Luma](https://luma.com/),
  and [Fever](https://feverup.com/en)
- Comparison prototype: `work/design-md-scout/serendipity-light-ui/product-preview.html`
- Research report: `.lazyweb/design-improve/serendipity-hub-2026-08-27/report.html`

References informed hierarchy and visual language only. Serendipity owns its
tokens, copy, Provider identity system, WebMCP proof model, and implementation.
