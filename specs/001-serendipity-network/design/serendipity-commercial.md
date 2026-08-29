# Serendipity Commercial Sticker Editorial

**Status**: Approved implementation contract  
**Extends**: root `DESIGN.md`  
**Preview**: `work/design-md-scout/serendipity-commercial/preview.html`

## Posture

Serendipity should look like a well-funded consumer invitation, not a booking
dashboard and not a raw neobrutalist prototype. One expressive hero earns
attention; the planner becomes quieter and more precise as consequences rise.

## Source lineage

- Primary: [Slush / Sticker City](https://styles.refero.design/style/8b6b547f-a357-4f1b-9842-4579c62dd42b)
- Spacing restraint: [MindMarket](https://styles.refero.design/style/9130ad37-bf80-458f-b808-ac0ef6a8d1e9)
- Product control restraint: [Aboard](https://styles.refero.design/style/fabacd2a-acb6-46c4-939c-4a464df15440)
- Secondary-source risk control: [Mallow SaaS](https://freedesignmd.com/system/mallow-saas)

References inform tokens and rhythm only. Generated production illustrations are
original Serendipity assets and never imply real venue photography.

## System

- Canvas: pale sky `#DCEEFF`; editorial paper `#FFFDF7`; ink `#111111`.
- Primary action: violet `#5C4ADE`; one filled action per workflow state.
- Provider identity: Kiln `#55DB9C`, Nori `#FFD731`, Loop `#FB8050`.
- Display: locally bundled condensed sans, `clamp(3rem, 8vw, 7rem)`, line-height
  `0.88–0.96`; UI/body: locally bundled Inter, 14px minimum supporting text and
  16–18px reading text.
- Marketing sections use 72–128px vertical rhythm and at most one large surface.
  Planner states use 24–48px rhythm and no nested card stacks.
- Black outlines/offset shadows belong to Provider stickers, primary actions,
  and deliberate brand cutouts only. Trust copy and navigation use hairlines.
- Motion uses opacity/transform for 120–240ms, stops under reduced motion, and is
  never required to perceive state.

## Landing

- Header: wordmark, three anchor links on desktop, one Plan CTA; wordmark and CTA
  only on narrow screens.
- Hero: consumer outcome first, CTA second, original wide journey illustration.
- Product preview: actual final planner capture labeled as a demo.
- Sections: three-step journey, Provider network, reversible safety, human/agent
  parity. Repeat the same Plan destination, never introduce a competing signup.
- Claims are active, specific, and bounded to Shibuya, solo, demo-only, and no
  payment. Do not add reviews, counts, waitlists, or pricing.

## Planner

- Keep `What kind of tonight?`, the four moods, closed time/budget disclosure,
  one CTA, Provider strip, route bands, and proof.
- Compact technical status must not push the value proposition or CTA below the
  first 390×844 viewport.
- Result and receipt foreground route/date/time/total before implementation
  metadata. The detailed WebMCP proof remains secondary and on demand.
- Dialogs are branded but semantic, focus trapped, Escape dismissible, and return
  focus. Active-hold departure releases safely before routing away.

## Original image assets

- `apps/hub/public/brand/serendipity-night-hero.webp`
- `apps/hub/public/brand/kiln-vignette.webp`
- `apps/hub/public/brand/nori-vignette.webp`
- `apps/hub/public/brand/loop-vignette.webp`

Every image is rendered with explicit dimensions. Hero is eager/priority only on
the root page; Provider vignettes are lazy below the fold.
