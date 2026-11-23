# Plan: A product landing page for naciocheck.vgr.cat, in Spanish, English and Catalan

Spec: `spec.md`

**Sign-off:** Approved by Victor Gonzalez on 2026-11-23

## Status

<!-- One line per step, in step order. The only part of this file that changes after sign-off.
[ ] todo | [~] in progress | [x] done | [-] deferred | [!] blocked
After the title: `uncommitted`, a short commit hash, or the reason (deferred/blocked).
Never [x] for partial work. Details live in progress.md.
Group the lines by phase with a bold `**Phase N: <title>**` line, blank line between phases; step
numbers are global across phases. -->

**Phase 1: Decision, gate rules and build parts**

- [ ] 1. Amend ADR 0005 for the landing site
- [ ] 2. Teach the site gate the new rules
- [ ] 3. Add CHANGELOG.md and its parser
- [ ] 4. Render the site images from the brand assets

**Phase 2: Build step**

- [ ] 5. Build the site into .output/site

**Phase 3: Shared layout**

- [ ] 6. Give every page the shared layout and both themes

**Phase 4: Pages**

- [ ] 7. Write the landing page in three languages
- [ ] 8. Add the Catalan privacy and feedback pages
- [ ] 9. Add the changelog and 404 pages

**Phase 5: Full gate and E2E harness**

- [ ] 10. Require every page in every language
- [ ] 11. Serve the built site to the E2E browser

**Phase 6: Baselines and docs**

- [ ] 12. Photograph the site and rewrite the baselines
- [ ] 13. Document the site build

## Before building (gates)

Builders must not start until each gate is closed. Answers go into `spec.md` or the "Risks / open questions"
list at the end of this plan.

- **G1.** Closed 2026-11-23: Q7 accepted and the spec is `status: active`. Still applies: step 1 drafts the
  ADR 0005 amendment, and Phase 2 does not start until the user has accepted its text.
- **G2.** Closed 2026-11-23, approved by the user. The dependency change is approved: `axe-core` as a dev dependency for the accessibility check
  (step 11). It is read from `node_modules` and injected into the page, so nothing is fetched. If you decline
  it, step 11 drops the axe check, and the check is the contrast unit test (step 6) plus the structural checks
  in step 7's test. The acceptance criterion "the accessibility check reports no violations" would then be
  only partly met.
- **G3.** Closed 2026-11-23: the user accepted every default in Q1–Q7, including the Catalan tagline "El
  teu expedient de nacionalitat, al dia."

## Contracts shared by several steps

These are fixed here so parallel builders agree. Change them only by amending this plan.

- **Source and output.** The hand-written pages stay in `site/`. `site/_build/` holds the build inputs
  (`config.json`, `strings.json`, `partials/`) and is never copied. `npm run build:site` (`node
scripts/build-site.mjs`) wipes and writes `.output/site/`, which is already git-, Prettier- and
  ESLint-ignored. `wrangler.jsonc` `assets.directory` is `./.output/site`. Scripts: `build:site`;
  `check:site` = `npm run build:site && node scripts/check-site.mjs` (it is still offline);
  `dev:site` = `npm run build:site && wrangler dev`; `deploy:site` = `npm run build:site && wrangler deploy`.
  `scripts/check-site.mjs` checks `.output/site/` by default. `siteProblems(dir)` stays injectable.
- **Languages and pages.** `es` at `/`, `en` at `/en/` and `ca` at `/ca/`. Every language has `index.html`,
  `privacy/index.html`, `feedback/index.html`, `changelog/index.html` and `404.html`. `404.html` sits at
  each language root because Workers assets `404-page` serves the nearest one.
- **Build config, "one place"** (`site/_build/config.json`):
  `{ "chromeStoreUrl": null, "firefoxStoreUrl": null, "repositoryPublic": false }`. A store URL must start
  with its allowed prefix or the build fails. While `repositoryPublic` is false, the build drops the source
  links and the per-release GitHub links.
- **Markers** (HTML comments in source pages; the build replaces each one, and an unknown marker fails the
  build):
  - `<!-- @head -->`: favicon links (`/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`); canonical;
    `hreflang` alternates for es, en and ca plus `x-default` → es; Open Graph and Twitter `summary_large_image`
    tags built from the page's own `<title>` and `<meta name="description">`; `og:locale` (`es_ES`, `en_GB`,
    `ca_ES`); `<meta name="author" content="Victor Gonzalez">`; `<link rel="me" href="https://vgr.cat/">`.
  - `<!-- @style -->` / `<!-- @style landing -->`: an inline `<style>` with `partials/base.css`, plus
    `partials/landing.css` for the second form.
  - `<!-- @header -->`: the outlined logo (a `<picture>` that switches light and dark with
    `prefers-color-scheme`), linking to the language's home, and the language switcher (`<nav>` with links to
    the same page in the other languages and `aria-current="page"` on the current one).
  - `<!-- @footer -->`: `partials/footer.<lang>.html`.
  - `<!-- @install -->`: the Chrome and Firefox buttons. A null URL renders a non-link
    `<span class="install is-soon">` with "Próximamente", "Coming soon" or "Properament" (from `strings.json`).
  - `<!-- @changelog -->`: the rendered releases (step 3's renderer).
  - `<!-- @if repository -->…<!-- @endif -->`: kept only when `repositoryPublic` is true.
- **Absolute URLs.** Outbound `<a href>` may only start with one of the spec's prefixes:
  `https://vgr.cat/`, `https://www.linkedin.com/in/vagonzal/` (exact), `https://github.com/vgr-dev/naciocheck`,
  `https://chromewebstore.google.com/`, `https://addons.mozilla.org/`, plus the existing Turnstile addendum
  link on its pages. The site's own origin, `https://naciocheck.vgr.cat/`, may appear only in
  `<link rel="canonical|alternate">` `href` and in `og:`/`twitter:` `<meta content>`. `https://vgr.cat/` may
  also appear in `<link rel="me">` (Q5). Nothing absolute is ever allowed in `src`, `srcset`, `poster`,
  `data`, `action`, CSS `url()` or `@import`.
- **Generated files** (step 4 writes them, step 5 calls step 4):
  - `social-card.png` (1200×630)
  - `favicon.ico` (a 32 px PNG in an ICO container), `favicon.svg` (copy of `brand/icon.svg`),
    `apple-touch-icon.png` (180)
  - `img/icon-animated.svg`
  - `img/logo-light.svg`, `img/logo-dark.svg` (outlined, no tagline)
  - `img/screens/<es|en>/<name>-<640|1280>.webp`, from `store/screenshots/`
- **Changelog** (`scripts/changelog.mjs`):
  - `parseChangelog(text)` → `Release[]`, where `Release` is
    `{ version: string; date: string | null; sections: { heading: string; items: string[] }[] }`.
  - Accepted input is a Keep a Changelog subset: `## [Unreleased]` or `## [x.y.z] - YYYY-MM-DD`,
    `### Added|Changed|Fixed|Removed|Security`, `- ` items, and inline `` `code` `` and `**bold**`. Anything else throws with the line number, including Markdown links (an outbound link
    has to pass the gate).
  - `renderChangelog(releases, { lang, strings, repositoryPublic })` → HTML. It escapes all text and leaves
    out `Unreleased`. When there are no releases it renders the localised "no releases yet" line. When
    `repositoryPublic` is true, each release links to
    `https://github.com/vgr-dev/naciocheck/releases/tag/v<version>`.
- **Status teaser.** Each landing page lists the main path as `<li data-state="<id>">` in the order of
  `MAIN_PATH_STATES`, under a heading and a note that call it orientative, not official. Step 7's test
  checks the ids and their order against `src/core/paths.ts`, so the page fails a test if the catalogue
  changes.

## Phase 1: Decision, gate rules and build parts

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`;
  all pass. `check:site` still checks `site/` at this point, and its pages are unchanged.

### 1. Amend ADR 0005 for the landing site

- **Goal:** ADR 0005 gains a dated amendment (Context, Decision, Consequences, in the style of the feedback
  amendment). It records:
  - the landing becomes a product page in es, en and ca;
  - the allowed outbound links and own-origin metadata (the "Absolute URLs" contract);
  - the build step, with source in `site/`, output in `.output/site/` and the markers;
  - `deploy:site` builds first and stays the user's action;
  - the gate checks the build output;
  - still no JavaScript outside the feedback pages, no remote resource, and Web Analytics as already
    disclosed.
- **Files:** `docs/adr/0005-distribution-and-public-pages.md`
- **Verify:** `npm run format:check`; it passes. The builder then stops for the user to accept it (G1).
- **Out of scope:** any other ADR, and code.

### 2. Teach the site gate the new rules

- **Goal:** `scripts/check-site.mjs` enforces the "Absolute URLs" contract:
  - It accepts `lang="es|en|ca"`.
  - `LANGUAGES = ['es','en','ca']` drives the feedback-page and Turnstile-link allowances (so
    `ca/feedback/index.html` and `ca/privacy/index.html` are allowed).
  - Parity: every language directory that exists has the same set of `.html` paths as `es`.
  - It allows non-HTML files of type `.png`, `.webp`, `.svg` and `.ico`, beside `feedback/feedback.js`.
  - An `.svg` is rejected if it has `<script`, an `on*=` attribute, `<foreignObject`, or any `href`,
    `xlink:href` or `url()` that is not a `#fragment`.
  - Every other file type is rejected.
  - `REQUIRED_PAGES` stays the current six for now (step 10 widens it).
  - The default directory stays `site/` (step 5 switches it).
  - The `.d.mts` matches the exports.
- **Files:** `scripts/check-site.mjs`, `scripts/check-site.d.mts`, `tests/site-gate.test.ts`
- **Verify:** `npx vitest run tests/site-gate.test.ts`. Pass means new cases for each allowed and refused
  URL form, SVG rules, file types, parity and `lang="ca"` all pass, and so do the existing cases.
- **Out of scope:** page content; the build script; changing the required page set.

### 3. Add CHANGELOG.md and its parser

- **Goal:** `CHANGELOG.md` at the root, in English, in the accepted subset, with the content from Q4.
  `scripts/changelog.mjs` exports `parseChangelog` and `renderChangelog` as specified, with no dependency and
  no I/O.
- **Files:** `CHANGELOG.md`, `scripts/changelog.mjs`, `scripts/changelog.d.mts`, `tests/changelog.test.ts`
- **Verify:** `npx vitest run tests/changelog.test.ts`. It passes with:
  - a parse of an inline sample changelog: releases, Unreleased, sections, and errors with line numbers for a
    link and an unknown heading;
  - HTML escaping;
  - GitHub links present only when `repositoryPublic` is true;
  - the empty state;
  - a parse of the real `CHANGELOG.md` that does not throw.
- **Out of scope:** writing pages; calling it from a build.

### 4. Render the site images from the brand assets

- **Goal:** `scripts/site-assets.mjs` exports `writeSiteAssets(outDir)`. It writes every file in "Generated
  files" with Sharp, from `brand/` and `store/screenshots/` only, using the pattern in
  `scripts/store-images.mjs`. The social card follows Q2. Neither the brand files nor the screenshots are
  modified.
- **Files:** `scripts/site-assets.mjs`, `scripts/site-assets.d.mts`, `tests/site-assets.test.ts`
- **Verify:** `npx vitest run tests/site-assets.test.ts`. It writes into a temporary directory, and checks
  that every file exists, the dimensions are right (card 1200×630, touch icon 180, WebP widths 640 and 1280),
  `favicon.ico` starts with the ICO header and holds a PNG, and the copied SVGs equal their sources.
- **Out of scope:** the build orchestrator; HTML; new brand assets.

## Phase 2: Build step

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`;
  all pass. `check:site` now builds and checks `.output/site/`.

### 5. Build the site into .output/site

- **Goal:** `scripts/build-site.mjs` exports `buildSite({ sourceDir, outDir, config })` and runs it as a CLI.
  It:
  - wipes `outDir`;
  - copies `site/` except `_build/`;
  - expands every marker in the "Markers" contract;
  - fails on an unknown marker or a store URL outside its prefix;
  - calls `writeSiteAssets`;
  - renders `<!-- @changelog -->` from `CHANGELOG.md`.

  It adds `site/_build/config.json` and `site/_build/strings.json` (es, en, ca: coming soon, button labels,
  language names, the "entries are in English" note, no releases yet), and placeholder partials so markers
  resolve (step 6 writes the real ones). It also updates the `package.json` scripts and `wrangler.jsonc`
  `assets.directory`, and switches `check-site.mjs`'s default directory to `.output/site`. The existing pages
  have no markers yet, so they build unchanged.

- **Files:** `scripts/build-site.mjs`, `scripts/build-site.d.mts`, `tests/build-site.test.ts`,
  `site/_build/config.json`, `site/_build/strings.json`, `site/_build/partials/*` (placeholders),
  `package.json`, `wrangler.jsonc`, `scripts/check-site.mjs` (default directory only)
- **Verify:**
  - `npx vitest run tests/build-site.test.ts`: fixture source directories in a temporary directory. It checks
    each marker, the `@if repository` block in both states, both install states, the unknown-marker failure,
    `_build/` not copied, and hreflang and canonical paths for a nested page.
  - `npm run check:site`: it builds and passes.
  - `npm run build:chrome && ls .output/site`: the site output survives a WXT build.
- **Out of scope:** the real CSS and partials, and page content; E2E; running `deploy:site`.

## Phase 3: Shared layout

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`;
  all pass.

### 6. Give every page the shared layout and both themes

- **Goal:**
  - `partials/base.css` holds colour tokens on `:root`, the same tokens redefined under
    `@media (prefers-color-scheme: dark)`, brand colours from `brand/README.md`, a system font stack only,
    a visible `:focus-visible`, a skip link, and the header, switcher, footer and button styles.
  - `partials/footer.<lang>.html` holds: "Hecho por / Made by / Fet per Victor Gonzalez", linking to `vgr.cat`
    (es `https://vgr.cat/es/`, en `https://vgr.cat/`, ca `https://vgr.cat/ca/`); LinkedIn; the source link
    inside `@if repository`; changelog, privacy and feedback links; and the non-affiliation line.
  - The existing es and en privacy, feedback and landing pages switch to `@head`, `@style`, `@header` and
    `@footer`. They drop their own duplicated CSS and nav, and keep their text, scripts and sitekey unchanged.
  - A unit test parses the tokens and asserts WCAG AA (4.5:1 text, 3:1 large text and focus ring) for every
    foreground and background pair, in both themes.
- **Files:**
  - `site/_build/partials/base.css`, `site/_build/partials/footer.es.html`,
    `site/_build/partials/footer.en.html`, `site/_build/partials/footer.ca.html`
  - `site/index.html`, `site/en/index.html`, `site/privacy/index.html`, `site/en/privacy/index.html`,
    `site/feedback/index.html`, `site/en/feedback/index.html`
  - `tests/site-contrast.test.ts`
- **Verify:**
  - `npx vitest run tests/site-contrast.test.ts tests/feedback-page.test.ts tests/brand.test.ts`: all pass.
  - `npm run check:site`: it passes.
- **Out of scope:**
  - The landing sections (step 7) and the Catalan pages.
  - Any change to `feedback.js`, the Worker or the privacy wording.

## Phase 4: Pages

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`;
  all pass, and parity holds with `ca/` complete. Then, by hand:
  - `npm run dev:site`, then `curl -sI localhost:8787/favicon.ico` → 200, `curl -s localhost:8787/nope/`
    → the es 404 page, and `curl -s localhost:8787/en/nope/` → the en 404 page.
  - If `wrangler dev` asks for a login or a network call, stop and ask the user.

### 7. Write the landing page in three languages

- **Goal:** `/`, `/en/` and `/ca/` each have the seven spec sections in order:
  1. Hero: `img/icon-animated.svg`, the logo, the tagline as text, one value line, and `@install`.
  2. Three steps with the WebP screenshots, using `srcset` and Q3's mapping. Catalan uses the `es` images.
  3. Status teaser per the contract, labelled orientative and not official.
  4. Privacy promises, with the repository link inside `@if repository`.
  5. FAQ with `<details>`, so no JavaScript.
  6. Agency band: full width, a CSS-only animation turned off under `prefers-reduced-motion`, linking to
     the locale's `vgr.cat` URL.
  7. `@footer`.

  Landing-only CSS goes in `partials/landing.css`, using the base tokens. Headings run h1 → h2 → h3 with no
  gaps. Every image has `alt` text and width and height. The English page keeps the decided tagline in text
  (`tests/brand.test.ts`).

- **Files:** `site/index.html`, `site/en/index.html`, `site/ca/index.html`,
  `site/_build/partials/landing.css`, `tests/site-landing.test.ts`
- **Verify:** `npx vitest run tests/site-landing.test.ts tests/brand.test.ts`. They pass, with each source
  page checked for:
  - the seven sections, by id;
  - `data-state` ids equal to `MAIN_PATH_STATES` in order;
  - the "not official" note;
  - an `@install` marker;
  - one h1 and no skipped heading levels;
  - `alt` on every `<img>`;
  - no `<script>`.
- **Out of scope:** the other Catalan pages; changes to `src/`; the `vgr.cat` side.

### 8. Add the Catalan privacy and feedback pages

- **Goal:**
  - `/ca/privacy/` translates the es policy faithfully, including the Turnstile and Cloudflare Web Analytics
    disclosure ("website only, not the extension"). The user reviews the wording before release.
  - `/ca/feedback/` mirrors the es page, with the same sitekey and script tags.
  - `feedback.js` gains Catalan `TEXTS` and picks `ca` from `lang` (Turnstile `language: 'ca'`).
  - `feedback-page.test.ts` adds the `ca` page to `PAGES`.
- **Files:** `site/ca/privacy/index.html`, `site/ca/feedback/index.html`, `site/feedback/feedback.js`,
  `tests/feedback-page.test.ts`
- **Verify:** `npx vitest run tests/feedback-page.test.ts tests/site-gate.test.ts`; they pass, with the
  existing cases also run for `ca`.
- **Out of scope:** the Worker (it is same-origin, so it needs no change); the es and en wording; the
  extension's feedback URL.

### 9. Add the changelog and 404 pages

- **Goal:**
  - `site/{,en/,ca/}changelog/index.html` each carry the localised page chrome, the "entries are in English"
    note for es and ca, and `<!-- @changelog -->`.
  - `site/{,en/,ca/}404.html` each carry a short localised "page not found" with links home and to the other
    languages' homes. They use absolute paths (`/`, `/en/`, `/ca/`), because a 404 is served at any depth.
- **Files:** `site/changelog/index.html`, `site/en/changelog/index.html`, `site/ca/changelog/index.html`,
  `site/404.html`, `site/en/404.html`, `site/ca/404.html`
- **Verify:** `npm run build:site && ls .output/site/changelog .output/site/en/changelog .output/site/ca/changelog`.
  It builds, each page has the rendered entries, and `.output/site/404.html` exists for each language.
- **Out of scope:** the parser (step 3); `CHANGELOG.md` content.

## Phase 5: Full gate and E2E harness

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && npm run test:e2e`;
  all pass, and the run summary prints `outside it 0`.

### 10. Require every page in every language

- **Goal:** `REQUIRED_PAGES` becomes the full set: `es`, `en` and `ca` × the five pages. The gate now fails if
  a language lacks a page.
- **Files:** `scripts/check-site.mjs`, `tests/site-gate.test.ts`
- **Verify:** `npx vitest run tests/site-gate.test.ts && npm run check:site`. Both pass, and the new test case
  "a missing `ca/changelog/index.html` fails" passes.
- **Out of scope:** any other rule.

### 11. Serve the built site to the E2E browser

- **Goal:**
  - `e2e/support/site-server.ts` serves `.output/site/` over http on 127.0.0.1. It behaves like
    `auto-trailing-slash` (`/en` → `/en/`) and `404-page` (the nearest `404.html`, status 404).
  - The browser reaches it as `site.naciocheck.test`, with a fixed port such as `E2E_SITE_PORT` (default
    `47444`), added to `HOST_RULES`. The network guard allows that host and nothing more.
  - `onPrepare` runs `npm run build:site` after the extension build.
  - `e2e/specs/site.e2e.ts` covers every page in each language. Each page loads, the 404 path returns the
    localised page, the favicon is served, the hero image renders and the guard is clean. With G2 approved,
    `axe-core` is injected from `node_modules` and runs in light and dark (`browser.emulate('colorScheme',
…)`), with zero violations.
  - The feedback pages are left out of browser checks per Q6.
- **Files:** `e2e/support/site-server.ts`, `e2e/wdio.conf.ts`, `e2e/specs/site.e2e.ts`; with G2, also
  `package.json` and `package-lock.json`.
- **Verify:** `E2E_SPEC=site npm run test:e2e`; the spec passes and the summary prints `outside it 0`.
- **Out of scope:** visual baselines (step 12); any change to the fake sede or the extension specs; test-only
  build flags.

## Phase 6: Baselines and docs

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && npm run build:chrome && npm run check:privacy && npm run test:e2e`;
  all pass, and the guard prints `outside it 0`.

### 12. Photograph the site and rewrite the baselines

- **Goal:** `visual.e2e.ts` gains a site block. It covers landing, privacy, changelog and 404 × es, en and ca ×
  desktop and phone × light and dark. Landing and privacy are whole-page (`full1280`, `full412`); changelog and
  404 use `1280x800` and `412x915`. The tag is `screenTag('site-<page>', '<theme>', '<lang>', viewport)`, which
  makes 48 images. Reduced motion stays forced. The `review-ui` command's matrix table gains the `site-*`
  pages, the `ca` locale and the light and dark states.
- **Files:** `e2e/specs/visual.e2e.ts`, `e2e/baselines/chrome/*`, `.claude/commands/review-ui.md`
- **Verify:**
  - `npm run test:e2e:update-baselines`, then `E2E_SPEC=visual npm run test:e2e`: every image is within
    tolerance. Diff the extension baselines with `git diff --stat e2e/baselines`: they are unchanged or
    explained in `progress.md`.
  - Then run `/review-ui` and record the findings in `progress.md`.
- **Out of scope:** fixing design findings beyond what blocks AA or the brand rules (report them).

### 13. Document the site build

- **Goal:** the docs describe the new site build:
  - `README.md`: the site section covers the three languages, the build, and that the privacy policy
    sources are in `site/` with the generated output in `.output/site/`.
  - `docs/manual-firefox-checklist.md`: a row for the deployed site in Firefox (landing, themes, language
    switcher, 404), for the post-deploy criterion.
  - `AGENTS.md` `Commands`: adds `npm run build:site` and notes that `check:site` builds first.
- **Files:** `README.md`, `docs/manual-firefox-checklist.md`, `AGENTS.md`
- **Verify:** `npm run format:check && npx vitest run tests/licence.test.ts`; both pass.
- **Out of scope:** the deploy itself; the store listings; the pre-release audit file.

## Risks / open questions

Each question has a proposed default. The user accepted all of them on 2026-11-23 (G3).

- **Q1. Catalan tagline and logo.** No Catalan outlined tagline logo exists. Default: every language uses the
  logo without a tagline, with the tagline as HTML text. The Catalan line is "El teu expedient de
  nacionalitat, al dia." and the owner must confirm it. The alternative is to generate Catalan outlined logos
  with `npm run logo:outline`, which is a brand change and needs Nunito locally.
- **Q2. Social card.** Default: one language-neutral `social-card.png` (icon and logo without a tagline, on
  `teal-50`). Per-language cards need a Catalan tagline logo (Q1).
- **Q3. How-it-works images.** No store screenshot shows the captcha step. Default mapping:
  - reminder → `options-several`;
  - captcha → no image, only the text (the fake form baselines look like the official site, which ADR
    0003 and 0006 rule out);
  - result → `result-changed`;
  - `statuses-guide` → beside the status teaser.
- **Q4. CHANGELOG.md content.** Nothing is released yet. Default: one `## [Unreleased]` section summarising
  the 0.1.0 features, which the site does not render, so the page shows "no releases yet" until the user
  dates a release.
- **Q5. Own-origin and `rel="me"` URLs.** The spec's list is for outbound links. Default: also allow
  `https://naciocheck.vgr.cat/` in canonical, hreflang and `og:`/`twitter:` metadata, and `https://vgr.cat/`
  in `<link rel="me">`. These are never loaded as resources.
- **Q6. Feedback pages in the browser tests.** They load Turnstile from `challenges.cloudflare.com`, which
  the guard would count. Default: leave them out of the visual and axe runs, where the jsdom tests already
  cover them. The matrix is then landing, privacy, changelog and 404. The alternative is to photograph them
  and take the one expected Turnstile request with `takeUnexpected()`, which would show the widget's failed
  state.
- **Q7. Templating.** Shared head, layout, footer and install buttons come from build markers, not
  hand-copied HTML. This is what puts the store URLs in one place and keeps 15 pages consistent. The source
  feedback pages then have markers where their CSS was, but `tests/feedback-page.test.ts` still reads the
  sources. It must be accepted at G1.
- **Risk: WXT and `.output/`.** The plan assumes `wxt build` cleans only its own `.output/<browser>-mv3`.
  Step 5 verifies it. If WXT wipes `.output/site`, stop and ask; the fallback is a new ignored directory.
- **Risk: baseline rewrite.** `test:e2e:update-baselines` deletes every baseline. Step 12 must check that the
  extension images did not change unexpectedly.
- **Not decided here:** the final `vgr.cat` URLs (spec open question, interim links as listed); the Catalan
  privacy wording, which the user reviews before release; the store URLs and repository visibility, which are
  set in `site/_build/config.json` when they exist.
