# Final public-surface security scan

**Date**: 2026-08-28  
**Status**: PASS

## Automated evidence

```text
pnpm --filter @serendipity/hub build
pnpm --filter @serendipity/provider build
pnpm test:security
PHASE0_BASE_URL=https://serendipity-phase0-hub.vercel.app \
  NEXT_PUBLIC_HUB_ORIGIN=https://serendipity-phase0-hub.vercel.app \
  NEXT_PUBLIC_PROVIDER_ORIGINS=<the three fixed Provider origins> \
  pnpm test:security
```

- The strengthened static scanner passed 50 browser assets across the Hub and
  three Provider builds. It rejects server secret names including
  `SUPABASE_SECRET_KEY`, `BUNDLE_ENCRYPTION_KEY`, and the Provider/Hub signing
  secret names, plus any configured secret value available to the scanner.
- Runtime security passed 3/3 both locally and against the fixed production
  origins. The checks cover exact OAC/CSP/Permissions-Policy headers, rendered
  Hub and iframe content, resource URLs, and every frame's local/session storage.
- A binary/text scan of `artifacts/`, `test-results/`, and `playwright-report/`
  returned zero matches for Supabase secret/JWT prefixes, configured local test
  secrets, or server signing/encryption environment names.

## Manual inspection

- Opened the approved expanded-proof screenshot and confirmed it contains only
  public product copy, Provider identities, operation states, and sanitized
  event counts.
- Located and inspected the generated Hub chunk containing `See WebMCP in
action`, `3 sites ready via WebMCP`, and `Manual connection`. It contains the
  intended public state projection; the static scanner found no server secret
  name or configured value in that chunk.
- Located the generated Provider UI chunk independently and included it in the
  same 50-file scan.

No secret value is copied into this evidence record.
