# 0005. Store-only distribution, public repo after first release, pages on vgr.cat

- **Status:** accepted
- **Date:** 2026-11-06 (recorded 2026-11-18), amendment proposed 2026-11-23

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

## Amendment 2026-11-23: a feedback endpoint on the site (proposed)

### Context

People need a way to report a status NacioCheck cannot read, without an account and without the extension
sending anything (ADR 0004). GitHub issues need an account and a public repo; a `mailto:` link needs a public
address and a mail client. The site already runs on a Cloudflare Worker, and Cloudflare Email Routing can
send from a Worker to verified addresses only. See `specs/2026-11-18-user-feedback/`.

### Decision

- The site gains two feedback pages (`/feedback/`, `/en/feedback/`) and one endpoint, `POST /api/feedback`,
  served by the same Worker on the same custom domain. Every other path stays static assets.
- The extension only opens the feedback page in a new tab, with the report in the URL fragment. The page
  posts it on an explicit Send click after the person has seen and edited it.
- The Worker mails the report to the maintainer's verified address through the `send_email` binding. It
  stores nothing, does not log request bodies, caps the size, accepts same-origin posts only, rate-limits
  per client and redacts anything shaped like an identifier.
- The feedback pages carry one same-origin script. They load nothing from another origin unless a later
  decision adds bot protection (spec question F6).

### Consequences

- The site is no longer static pages only. `npm run check:site` gets a scoped exception for the feedback
  pages' script; every other rule stays.
- The privacy policy (es + en) and store data-usage answers state that a report sent from the website goes
  through Cloudflare to the maintainer by email and is not stored.
- Enabling Email Routing on `vgr.cat`, verifying the address and deploying stay the user's actions.
- The reporting channel can change by redeploying the site, without an extension release.
