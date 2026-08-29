# Sticker Network implementation reference analysis

**Generated**: 2026-08-27  
**Purpose**: Image-first implementation baseline for T070–T079  
**Authority**: `DESIGN.md` and `ui-plan.md` override generated-image deviations

## Reference set

1. Desktop invitation: `exec-3e10930d-34b2-4148-96f9-7f39ee9f4c99.png`
2. Desktop composed journey: `exec-59dadb96-5a83-4d23-83a8-36eb72ba71ae.png`
3. Expanded WebMCP proof: `exec-80e23f4c-640f-4893-b041-449873003725.png`
4. Narrow held review: `exec-9597347e-89e5-4de3-97c7-a686d0b66e2f.png`
5. Desktop recovery: `exec-130e4479-5bac-4a3d-90d2-adbe697f11e9.png`

The generated files remain preview references under the Codex generated-image
directory. Production UI uses CSS and real Provider frames; no generated bitmap is
shipped in the application.

## Extracted system

- **Hierarchy**: a compact wordmark/header, one 1–3 line condensed display statement,
  one short supporting line, and at most one dominant violet action.
- **Invitation rhythm**: headline → four 52px-or-larger mood controls → one compact
  constraint sentence → 60–64px CTA → three Provider stickers → proof disclosure.
- **Journey rhythm**: heading/summary with a compact Provider strip → three 72–88px
  full-width identity bands → unboxed travel/spare copy between bands → one reason →
  primary action → native disclosures.
- **Provider stickers**: irregular-but-controlled cutout silhouettes, black outline,
  white halo/solid offset shadow, large Provider name, and separate connection and
  operation text. Identity color never substitutes for a status label.
- **Proof**: one white paper surface, plain-language independence statement, three
  actual Provider frames in a single row when space permits, route geometry plus an
  ordered text equivalent, then a sparse sanitized activity list.
- **Held state**: countdown is a high-priority text fact immediately after the
  heading. Provider stamps become authoritative before the confirm action appears.
- **Recovery**: durable compensation copy, Released/Needs attention text on Provider
  stickers, a conspicuous `Not held` replacement marker, and no replacement action
  until compensation is complete.
- **Responsive behavior**: desktop uses a centered open column rather than a
  dashboard shell. Narrow layouts stack the same reading order, retain 16px body
  type and 52px controls, and keep route bands and disclosures full width.

## Implementation corrections

Generated references sometimes use gradients, oversized decorative stickers, a
compressed three-column mobile Provider row, or status color more strongly than the
approved contract permits. Production therefore uses:

- solid `#5C4ADE` for the dominant action;
- CSS-only edge decoration with low visual priority;
- the exact token contrast pairs and semantic status text/icons;
- responsive Provider wrapping/stacking when labels would become cramped;
- one meaningful surface per section, without cards nested inside cards;
- real `/embed` iframes rather than illustrated or fake browser previews.

## Verification targets

- At 1440×900, invitation and composed states preserve the reference hierarchy and
  show the primary action without a permanent proof rail.
- At 390×844, the first interaction and active workflow state have no horizontal
  overflow; technical proof remains one disclosure away.
- At 320px/200% zoom, labels wrap, controls remain operable, and the ordered route
  text remains available if visual geometry simplifies.
- Reduced motion removes insertion/stamp/route transitions without hiding state.
