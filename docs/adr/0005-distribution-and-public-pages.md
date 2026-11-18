# 0005. Store-only distribution, public repo after first release, pages on vgr.cat

- **Status:** accepted
- **Date:** 2026-11-06 (recorded 2026-11-18)

## Context

Store installs are the trusted path for a tool that touches personal data. The organisation's Free GitHub
plan cannot serve Pages from a private repository, and the user already runs `vgr.cat` on Cloudflare Workers.

## Decision

- Publish listed on the Chrome Web Store and AMO only. No unlisted or self-hosted releases. The AMO listing
  also enables Firefox for Android.
- Public pages (privacy policy, landing) are served from `naciocheck.vgr.cat` through Cloudflare Workers
  static assets with an explicit custom domain and no wildcard routes.
- The repository is private until the first public release, then public for good. The whole git history
  becomes public, so personal data is never committed and the history is audited before the switch.
- Deploying the site, uploading to the stores and changing repository visibility are the user's actions,
  never an agent's.

## Consequences

- `npm run deploy:site` is the user's; agents only prepare and verify offline (`npm run check:site`).
- The history audit result is in `docs/pre-release-audit-2026-11-18.md` (AUD-04, AUD-05).
