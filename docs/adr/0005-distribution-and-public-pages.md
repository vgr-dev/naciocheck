# 0005. Store-only distribution, public repo after first release, pages on vgr.cat

- **Status:** accepted
- **Date:** 2026-11-06, amended 2026-11-25 (recorded 2026-11-18)

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

## Amendment 2026-11-23: a product landing site in three languages, built from sources

- **Amendment status:** accepted 2026-11-23 (by Claude on the owner's delegation). See `specs/2026-11-23-landing-page/`.

### Context

The landing page at `naciocheck.vgr.cat` is a placeholder. It becomes a product page for applicants, with a
credit and a block for agencies that points to `vgr.cat`. That needs three languages (Spanish, English,
Catalan), shared layout and themes, a social card, a favicon, a changelog and a 404 page. Hand-copying that
across 15 pages would drift, and the store URLs and the repository link do not exist yet. The page has to
stay static and has to keep the privacy properties of the pages it replaces.

### Decision

- The site is a product page in `es` (`/`), `en` (`/en/`) and `ca` (`/ca/`). Each language has a landing,
  privacy, feedback and changelog page and a `404.html`, with a language switcher on every page and
  `hreflang` alternates on every page except the 404 pages (added 2026-11-24: a 404 has no address of its own
  and is `noindex`; its switcher links each language's home). Catalan uses the Spanish screenshots until the
  extension has a Catalan locale.
- The hand-written pages stay in `site/`. `npm run build:site` (`scripts/build-site.mjs`) writes the
  deployable site into `.output/site/`, and `wrangler.jsonc` serves that directory. The build copies the
  pages (not `site/_build/`, which holds its config, strings and partials), expands a fixed set of HTML
  comment markers (head metadata, inline CSS, header, footer, install buttons, changelog, an optional
  repository block), renders the changelog from `CHANGELOG.md` and generates the social card, favicon and
  resized screenshots from `brand/` and `store/screenshots/`. An unknown marker fails the build. It makes no
  network request.
- The store URLs and whether the repository is public are set in one place, `site/_build/config.json`. A
  null store URL renders a "coming soon" button that links nowhere. While the repository is private, the
  source and per-release GitHub links are left out.
- Outbound links (`<a href>`) may only start with `https://vgr.cat/`, `https://www.linkedin.com/in/vagonzal/`,
  `https://github.com/vgr-dev/naciocheck`, `https://chromewebstore.google.com/` or
  `https://addons.mozilla.org/`, plus the existing Turnstile privacy link on the feedback and privacy pages.
  The site's own origin, `https://naciocheck.vgr.cat/`, may appear only in canonical and alternate `<link>`
  elements and in Open Graph and Twitter card `<meta>` content. `https://vgr.cat/` may also appear in
  `<link rel="me">`. Nothing absolute is ever allowed in `src`, `srcset`, `poster`, `data`, `action`, CSS
  `url()` or `@import`: no remote resource is loaded, no remote font, no cookie.
- The landing, privacy, changelog and 404 pages carry no JavaScript except the optional theme bootstrap
  approved in the 2026-11-24 amendment below. Feedback pages keep their one same-origin script and
  Turnstile's script, and may also carry that theme bootstrap.
- `npm run deploy:site` builds first, then deploys. It stays the user's action, as do store uploads and
  changing repository visibility. Cloudflare Web Analytics stays as disclosed above, for the website only.

### Consequences

- `npm run check:site` builds the site and checks `.output/site/`, not the sources. It stays offline. It
  gains these rules: `lang` may be `es`, `en` or `ca`; every language has the same set of pages; same-origin
  `.png`, `.webp`, `.svg` and `.ico` files are allowed alongside the scoped scripts in the
  amendment below; an SVG may not carry a script, an event attribute, `<foreignObject>` or a reference that
  is not a `#fragment`; outbound links follow the list above. It does not see the Cloudflare Web Analytics
  beacon, which is injected at the edge.
- The sources of the feedback and privacy pages now contain markers where their CSS and navigation were.
  Tests that read those sources keep working, and the gate sees the expanded pages.
- The privacy pages keep stating what the site loads and sends, in all three languages, including the
  Catalan page's disclosure of Turnstile and Cloudflare Web Analytics (website only, not the extension). The
  user reviews the Catalan wording before release.
- `CHANGELOG.md` is the single source of release notes, in English. Pages for other languages say so. Each
  release links to its GitHub release only once the repository is public.
- The agency block and the credit link to `vgr.cat` only. Pricing, a paid tier and any contact form are not
  part of this site.
- Any new outbound link, remote resource or script is a new amendment to this ADR, and the gate fails until
  it is made.

### Amendment 2026-11-24: site theme preference and static product images

#### Context

The three-language site gains a local theme selector. It uses a small same-origin bootstrap
to apply a saved choice before first paint. The landing page uses static screenshots to show the
extension.

#### Decision

- Pages may include at most one exact classic `<script src="/theme.js"></script>` element in the
  document head (superseded 2026-11-24, see the amendment below: the script is inline). It reads and writes only the `naciocheck-theme` local-storage key, whose accepted
  values are `auto`, `light` and `dark`, and applies the selected theme before first paint. It must
  not use network APIs, dynamic code or telemetry. The existing feedback pages retain their exact
  feedback and Turnstile script elements; the theme script is an additional optional same-origin
  script.

#### Consequences

- The offline site gate enforces the optional script exception and the existing static-image policy.
  It rejects video elements and video files, unrelated scripts, external resources and inline
  handlers. The theme script is checked for dynamic code and network APIs.

### Amendment 2026-11-24: the theme bootstrap is inline

#### Context

An external blocking `<script src="/theme.js">` in the head costs a round trip before first paint, even
when the file is cached. Step 11 of `specs/2026-11-24-landing-page-polish/` measured about +186 ms cold and
+236 ms warm first contentful paint on the phone profile (Fast 4G, 4x CPU) against the site without it.

#### Decision

- Every page, including the `404.html` pages, carries exactly one inline classic `<script>` in the document
  head, before the inline styles, and no other inline script. Its text equals, byte for byte, the source
  `site/theme.js`, which stays the single source and is not served: `npm run build:site` reads it and writes
  its contents into each page, and the output has no `/theme.js` and no reference to it.
- What the script may do is unchanged: read and write only the `naciocheck-theme` local-storage key (`auto`,
  `light`, `dark`), apply the choice before first paint, and use no network API, dynamic code or telemetry.
- The feedback pages keep their exact two external scripts (`/feedback/feedback.js` and Turnstile) beside it.
  No other page loads any external script.

#### Consequences

- `npm run check:site` requires that inline script once per page, in the head, compared byte for byte with
  `site/theme.js`, and applies the dynamic-code and network-API checks to it. It keeps rejecting every other
  inline script, every `on*` handler, every external script, a script element with attributes around the
  bootstrap, any reference to `/theme.js`, and a served `theme.js` file.
- The build fails if `site/theme.js` is missing or contains `</script` or `<!--`.
- Any change to `site/theme.js` changes every page; the gate follows it because it reads the same file.

## Amendment 2026-11-25: GitHub Release assets are for verification, not installation

- **Amendment status:** accepted 2026-11-25 (owner sign-off of `specs/2026-11-25-ci-and-public-repo/`, question Q1).

### Context

The CI spec has a manual release workflow that builds the Chrome, Firefox and sources zips from `main` and
creates a draft GitHub Release with a SHA-256 checksum file, so the owner uploads to the stores from a
reproducible build instead of a local one. Once the owner publishes that draft, the zips are downloadable
from a public page. The decision above says "No unlisted or self-hosted releases", and read literally that
would forbid the release.

### Decision

- The decision above stands: the stores are the only supported way to install NacioCheck. Nothing here adds
  an install channel.
- A GitHub Release holds reproducibility and verification artefacts: the browser zips and the source
  archive exactly as sent to the stores, and their checksums, so anyone can rebuild from the tagged source
  and compare. It is not distribution, and no page, README text or store listing points people to it to
  install.
- The README says to install from the stores and that the release files are for verifying a build.
- The release workflow only ever creates a draft. Dispatching it, publishing the draft (which creates the
  tag), uploading to the stores and changing repository settings remain the user's actions, never an
  agent's.

### Consequences

- `README.md` describes the assets that way; `docs/github-settings.md` protects the
  `v*` tags from being moved or deleted.
- Whether to publish a draft at all is the owner's call per release. If the owner decides that downloadable
  zips are unwanted, publish releases with the sources and checksums only, or keep the draft unpublished;
  that needs a new amendment, not a silent change to the workflow.
