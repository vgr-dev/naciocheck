---
status: active # draft | active | done | abandoned
created: 2026-11-23
status-date: 2026-11-23
---

# A product landing page for naciocheck.vgr.cat, in Spanish, English and Catalan

## Goal

`naciocheck.vgr.cat` is a placeholder: a title, one paragraph and a disclaimer. It becomes a product page at
the quality level of `vgr.cat`. First it serves applicants: what NacioCheck does, how it works, why it is
safe, and where to install it. Then it serves as a showcase: a "made by" credit and a prominent block invite
immigration agencies, law firms and associations that need more to talk to Victor Gonzalez through
`vgr.cat`. NacioCheck keeps its own brand and stays static. Besides Cloudflare's own Web Analytics and the Turnstile
widget on the feedback page, it loads nothing from elsewhere.

## Scope

- **Three languages, whole site:** Spanish (`/`), English (`/en/`) and Catalan (`/ca/`) for the landing,
  privacy and feedback pages, with a language switcher on every page and `hreflang` alternates. The Catalan
  pages use the Spanish screenshots until the extension has a Catalan locale.
- **Landing sections, in order:**
  1. Hero: the animated icon (`brand/icon-animated.svg`, static with reduced motion), the outlined logo with
     the tagline, one line of value, and install buttons for Chrome and Firefox. Until the stores list the
     extension, the buttons show "Próximamente" / "Coming soon" / "Properament" and link nowhere.
  2. How it works, in three steps (reminder, captcha, result), with the store screenshots.
  3. Status guide teaser: the main path of states from the extension's catalogue (`MAIN_PATH_STATES` in
     `src/core/paths.ts`), one plain sentence each, labelled as orientative and not official.
  4. Privacy promises about the extension: nothing leaves the browser, optional encryption, no tracking or
     analytics in the extension, open source (GPL-3.0)
     with a link to the repository once it is public.
  5. FAQ: is it official (no), does it solve the captcha (no, the person does), where the data lives, is it
     free (the current features are and will stay free), which browsers.
  6. Agency block: a full-width band with a CSS-only animation that respects `prefers-reduced-motion`. Copy
     along the lines of "¿Sois una gestoría o un despacho? NacioCheck es gratis para todos; si necesitáis
     más (seguimiento de muchos expedientes, herramientas propias), hablemos", linking to `vgr.cat`.
  7. Footer: "Hecho por Victor Gonzalez" with links to `vgr.cat` and LinkedIn, the source code link, the
     changelog, privacy and feedback, and the non-affiliation line.
- **Changelog:** `CHANGELOG.md` at the repository root is the single source of release notes, written in
  English. A build script turns it into static `/changelog/` pages (es, en, ca chrome, English entries with a
  one-line note saying so), each release linking to its GitHub release. No fetch at runtime.
- **Quality bar:** dark mode that follows the system setting; Open Graph and Twitter card tags with a social
  card image generated from the brand assets (`sharp`, as `scripts/store-images.mjs` does); a favicon from
  `brand/icon.svg`; the missing `404.html` (in three languages or language-neutral); `rel="me"` and author
  metadata pointing to `vgr.cat`; semantic headings, visible focus, WCAG AA contrast in both themes.
- **Build step:** a `build:site` script produces the deployable site (changelog pages, social card, favicon
  and copied screenshots) from the hand-written pages; `wrangler.jsonc` points at its output and
  `deploy:site` builds before deploying.
- **Site gate (`scripts/check-site.mjs`):** accepts `lang="ca"`; allows same-origin images (PNG, WebP, SVG,
  ICO) and the generated files; checks that every language has the same set of pages; allows exactly these
  outbound links and nothing else: `https://vgr.cat/`, `https://www.linkedin.com/in/vagonzal/`,
  `https://github.com/vgr-dev/naciocheck`, `https://chromewebstore.google.com/`,
  `https://addons.mozilla.org/`, and the existing Turnstile addendum link. No remote resource is ever loaded.
- **ADR 0005 amendment** for the outbound links and the build step.
- **Tests:** visual baselines for the site pages in the existing Chrome E2E suite (es, en, ca × phone and
  desktop × light and dark) and automated accessibility checks, served locally with the network guard at 0.

## Non-goals

- A Catalan locale for the extension itself (separate spec).
- Any JavaScript on the landing, privacy or changelog pages; the feedback pages keep their one script.
- Any analytics beyond the Cloudflare Web Analytics the owner keeps on the site (ADR 0005); tracking,
  cookies or remote fonts.
- The `vgr.cat` side (case study, agency route, contact topic): `vgr-dev/vgr.cat`,
  `specs/2026-11-23-naciocheck-tie-in/`.
- Store listing work, version bumps or releases.
- Pricing or a paid tier on this site.

## Relevant files

- `site/` (all pages), new `site/ca/`, and the generated build output.
- `scripts/check-site.mjs`, `scripts/check-site.d.mts`, `tests/site-gate.test.ts`: the gate.
- `scripts/` new `build-site.mjs` (changelog, social card, favicon, assets), `package.json` scripts,
  `wrangler.jsonc` (`assets.directory`).
- `CHANGELOG.md` (new).
- `brand/` (icon, animated icon, outlined logos; read only), `store/screenshots/` (read only).
- `src/core/paths.ts`, `src/core/statuses.ts`: source of the status teaser text (read only).
- `e2e/specs/visual.e2e.ts`, `e2e/baselines/`, possibly a new site spec in `e2e/specs/`.
- `docs/adr/0005-distribution-and-public-pages.md`, `README.md`, `docs/manual-firefox-checklist.md`.

## Constraints (do not touch)

- ADRs 0003, 0004, 0006 and 0007: nothing official-looking, no network request from the extension, brand
  rules (`brand/README.md`), tests never reach a real host.
- The extension, its manifest, permissions and `scripts/allowed-urls.json` do not change.
- Status explanations are never presented as official; the non-affiliation line stays on every page.
- The privacy pages keep stating accurately what the site loads and sends, in all three languages.
- The feedback pages, the Worker and their tests keep working unchanged apart from translation and shared
  layout.
- Fake identities only in screenshots and baselines.
- `npm run deploy:site` stays the user's action.

## Acceptance criteria

- [ ] Every landing, privacy, feedback, changelog and 404 page exists in es, en and ca, with a working
      language switcher and `hreflang` alternates; the gate fails if a language lacks a page.
- [ ] The landing page has the seven sections above in each language; the install buttons show the
      "coming soon" state until store URLs are set in one place.
- [ ] `npm run check:site` passes and fails on any remote resource, any outbound link outside the allowed
      list, any script outside the feedback pages, and any unknown file type.
- [ ] `npm run build:site` turns `CHANGELOG.md` into `/changelog/` pages without network access; a test
      covers the parser on a sample changelog.
- [ ] Dark and light themes both meet WCAG AA contrast; the accessibility check reports no violations.
- [ ] Chrome E2E visual baselines exist for the site pages (3 languages × 2 widths × 2 themes), reviewed
      with `/review-ui`; the network guard reports 0 unexpected requests.
- [ ] Open Graph tags and the social card render; the favicon and the 404 page are served by
      `wrangler dev`.
- [ ] `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run check:site && npm run check:privacy`
      pass.
- [ ] The Catalan privacy page discloses Cloudflare Web Analytics like the es and en pages: website only,
      not the extension.
- [ ] After the user deploys: the pages render correctly in Chrome and Firefox.

## Open questions

- **Exact `vgr.cat` URLs** for the agency band and the credit (case study per locale, contact anchor, topic
  parameter): agreed with `vgr-dev/vgr.cat` `specs/2026-11-23-naciocheck-tie-in/`. Until then the links go
  to `https://vgr.cat/` (es: `/es/`, ca: `/ca/`).
- **Catalan privacy policy:** the user reviews the wording before release.
- **Store URLs and repository visibility:** filled in when they exist; the page degrades gracefully before.
