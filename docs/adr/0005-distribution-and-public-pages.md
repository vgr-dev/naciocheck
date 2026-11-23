# 0005. Store-only distribution, public repo after first release, pages on vgr.cat

- **Status:** accepted
- **Date:** 2026-11-06, amended 2026-11-23 (recorded 2026-11-18)

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

## Amendment 2026-11-23: a feedback endpoint on the site

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
- Every send passes Cloudflare Turnstile. The Worker validates the token with siteverify (success and the
  expected hostname) before anything else reaches the mail binding; a request without a valid token sends
  nothing.
- The Worker mails the report to `naciocheck@vgr.cat`, the project's public contact address, through a
  `send_email` binding fixed to that one `destination_address`. It stores nothing, does not log request bodies, caps the size, accepts
  same-origin posts only, rate-limits per client and redacts anything shaped like an identifier.
- The feedback pages carry one same-origin script and Turnstile's script, loaded from
  `https://challenges.cloudflare.com/turnstile/v0/api.js`. No other page loads anything from another origin.
- The Turnstile secret is a Worker secret; it never appears in the repo or the Wrangler config.

### Consequences

- The site is no longer static pages only. `npm run check:site` gets scoped exceptions: on the feedback
  pages, the same-origin script and the exact Turnstile script URL; on the feedback and privacy pages, a
  plain link to Cloudflare's Turnstile privacy policy. Every other rule stays.
- The privacy policy (es + en) and store data-usage answers state that the feedback page loads Cloudflare
  Turnstile and that a report sent from it goes through Cloudflare to the maintainer by email and is not
  stored.
- Added 2026-11-23: the website (all of `naciocheck.vgr.cat`, not the extension) counts visits with
  Cloudflare Web Analytics, which Cloudflare injects at the edge. The owner keeps it on: the site is already
  served and protected by Cloudflare. The privacy pages disclose it and say that it applies to the website
  only; the extension still sends nothing (ADR 0004). `npm run check:site` checks the source files, so it
  does not see the injected beacon.
- Worker tests run offline under `@cloudflare/vitest-plugin`, with the mail and rate-limit bindings stubbed
  and siteverify intercepted (ADR 0007: tests never reach a real host).
- Enabling Email Routing on `vgr.cat`, verifying the address, creating the Turnstile widget, setting its
  secret and deploying stay the user's actions.
- The reporting channel can change by redeploying the site, without an extension release.
