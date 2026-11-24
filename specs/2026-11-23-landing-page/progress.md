# Progress: A product landing page for naciocheck.vgr.cat

Append-only. The builder adds one entry per step; never edit earlier entries.
The reviewer reads this but checks the real diff, not these claims.
At-a-glance status lives in the `## Status` checklist of `plan.md`; this file holds the evidence.

<!-- Entry format:

## YYYY-MM-DD - Step N: <title>
- **Status:** done | blocked | partial
- **Changed:** `path`, `path`
- **Verified:** `<command>` -> pass/fail (short result)
- **Commit:** uncommitted, proposed "<subject>" | <short hash>
- **Open issues:** none | <list>

Under `/implement-phase` the orchestrator, not the builder, writes this file. Its per-step entry
adds two fields:
- **Run by:** implement-phase (builder subagent, model <model>)
- **Proposed commit (builder):** the builder's full proposed message in a plain fenced block
(the `Commit:` line stays `uncommitted, proposed "<subject>"`)

The orchestrator also appends one entry per phase:

## YYYY-MM-DD - Phase N: <title>
- **Status:** done | partial | blocked
- **Steps:** per step: done / flagged / blocked
- **File check:** pass | <files outside any step's Files, and the step blamed>
- **Phase verify:** `<command>` -> pass/fail
- **Commit proposal:** <the groups and subjects proposed>
- **Open issues:** none | <list>


## 2026-11-23 - Autonomous run

The owner is away and delegated every open question and decision to Claude for this spec (2026-11-23). Each
decision taken on that delegation is marked **Decided by Claude (delegated)** below. Nothing is committed:
the owner's settings require approval for `git commit`, so each phase lists its proposed commits.

## 2026-11-23 - Step 1: Amend ADR 0005 for the landing site

- **Status:** done
- **Changed:** `docs/adr/0005-distribution-and-public-pages.md` (new amendment "a product landing site in three languages, built from sources")
- **Verified:** `npm run format:check` -> pass
- **Commit:** uncommitted, proposed "docs(adr): amend 0005 for the landing site build"
- **Open issues:**
  - **Decided by Claude (delegated), G1:** amendment accepted after reading it; its status line says so. The per-language `vgr.cat` URLs are left out of the ADR (interim, still open in the spec).
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
docs(adr): amend 0005 for the landing site build
```

## 2026-11-23 - Step 2: Teach the site gate the new rules

- **Status:** done
- **Changed:** `scripts/check-site.mjs`, `scripts/check-site.d.mts`, `tests/site-gate.test.ts`
- **Verified:** `npx vitest run tests/site-gate.test.ts` -> pass (206); `npm run check:site` -> pass (6 pages); eslint, prettier, typecheck -> clean
- **Commit:** uncommitted, proposed "feat(site): gate outbound links, images and Catalan pages"
- **Open issues:**
  - New exports `LANGUAGES`, `binaryProblems`, `parityProblems`. Allowed outbound prefixes, exact LinkedIn and repository forms, own origin only in canonical/alternate links and `og:`/`twitter:` meta, `rel="me"` exactly `https://vgr.cat/`.
  - Builder's choices, kept (**Decided by Claude (delegated)**): PNG/WebP/ICO checked by magic number; extra SVG refusals (`image-set(`, SMIL `href`, character references, backslashes, entities); `rel` must be exactly `me`, `canonical` or `alternate`; the unknown-file message kept as is.
  - A page's `lang` is not yet checked against its language directory (old fixtures use `lang="es"` on `en/` paths). **Decided by Claude (delegated):** step 10 adds that check for the built site.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): gate outbound links, images and Catalan pages
```

## 2026-11-23 - Step 3: Add CHANGELOG.md and its parser

- **Status:** done
- **Changed:** `CHANGELOG.md`, `scripts/changelog.mjs`, `scripts/changelog.d.mts`, `tests/changelog.test.ts` (all new)
- **Verified:** `npx vitest run tests/changelog.test.ts` -> pass (16); eslint, prettier, typecheck -> clean
- **Commit:** uncommitted, proposed "feat(site): add the changelog source and its parser"
- **Open issues:**
  - `renderChangelog` takes `strings: { noReleases, githubRelease }`; step 5 reads them per language from `site/_build/strings.json`.
  - Builder's choices, kept (**Decided by Claude (delegated)**): `<article class="release" id="v…">` markup with `lang="en"` on non-English pages; strict parser (no links in entries, no pre-release versions, duplicates and empty sections throw); ISO dates.
  - `CHANGELOG.md` holds one `## [Unreleased]` section with the 0.1.0 features, so the site shows "no releases yet".
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): add the changelog source and its parser
```

## 2026-11-23 - Step 4: Render the site images from the brand assets

- **Status:** done
- **Changed:** `scripts/site-assets.mjs`, `scripts/site-assets.d.mts`, `tests/site-assets.test.ts` (all new)
- **Verified:** `npx vitest run tests/site-assets.test.ts` -> pass (7); eslint, prettier, typecheck -> clean; manual render of `social-card.png` looked right
- **Commit:** uncommitted, proposed "feat(site): render the site images from the brand assets"
- **Open issues:**
  - Writes `social-card.png` (1200×630, plain logo on teal-50), `favicon.ico` (32 px PNG in an ICO), `favicon.svg`, `apple-touch-icon.png` (180 px on white), `img/icon-animated.svg`, `img/logo-light.svg`, `img/logo-dark.svg`, and WebP screens at 640 and 1280 for all five screenshots in es and en.
  - **Decided by Claude (delegated):** all five screenshots stay in the build, not only the three Q3 maps; the encryption screenshot may illustrate the privacy section.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): render the site images from the brand assets
```

## 2026-11-23 - Phase 1: Decision, gate rules and build parts

- **Status:** done
- **Steps:** 1 done, 2 done, 3 done, 4 done
- **File check:** pass (11 changed or new files, each in its step's Files; plus the orchestrator's plan.md)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (extension 34 files, 901 tests; worker 2 files, 31 tests; check:site 6 pages)
- **Commit proposal:** one commit per step, then the plan and progress updates
- **Open issues:** step 10 adds the `lang`-matches-directory check

## 2026-11-23 - Step 5: Build the site into .output/site

- **Status:** done
- **Changed:** `scripts/build-site.mjs`, `scripts/build-site.d.mts`, `tests/build-site.test.ts`, `site/_build/config.json`, `site/_build/strings.json`, `site/_build/partials/{base.css,landing.css,footer.es.html,footer.en.html,footer.ca.html}` (placeholders) (all new); `package.json` (`build:site`; `check:site`, `dev:site`, `deploy:site` build first); `wrangler.jsonc` (`assets.directory` only); `scripts/check-site.mjs` (default directory `.output/site` only)
- **Verified:** `npx vitest run tests/build-site.test.ts` -> pass (39); `npm run check:site` -> builds and passes (6 pages, byte-identical to the sources since they carry no markers yet); `npm run build:chrome && ls .output/site` -> the site output survives a WXT build (plan risk did not occur); typecheck, eslint, prettier -> clean
- **Commit:** uncommitted, proposed "feat(site): build the site into .output/site from marked sources"
- **Open issues:**
  - `buildSite({ sourceDir, outDir, config?, changelog?, writeAssets? })`; validates `config.json`, requires every `strings.json` key in es, en and ca, refuses an `outDir` inside the source.
  - Builder's choices, kept (**Decided by Claude (delegated)**): a `404.html` gets favicon, author and `rel="me"` but no canonical, hreflang or social tags, and its switcher links each language's home; `@head` reads the page's own `<title>` and meta description and fails without them; `@changelog` emits the "entries are in English" note itself, so step 9 must not repeat it; partials may only hold `@if`/`@endif`; no nested `@if`.
  - Markup contract for step 6: `.install.is-soon` / `.install-chrome` / `.install-firefox`, `nav.lang-switch` with `aria-current="page"`, the header logo as a `<picture>` with a dark `<source>` at 260×64.
  - Hreflang alternates list ca before the ca pages exist; Phase 4 adds them.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): build the site into .output/site from marked sources
```

## 2026-11-23 - Phase 2: Build step

- **Status:** done
- **Steps:** 5 done
- **File check:** pass (13 changed or new files, all in step 5's Files; plus the orchestrator's plan.md and progress.md); `.output/` is git-ignored
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (extension 35 files, 940 tests; worker 2 files, 31 tests; check:site builds and passes on 6 pages)
- **Commit proposal:** one commit for step 5, then the plan and progress updates
- **Open issues:** none

## 2026-11-23 - Step 6: Give every page the shared layout and both themes

- **Status:** done
- **Changed:** `site/_build/partials/base.css` (real stylesheet), `site/_build/partials/footer.{es,en,ca}.html`, the six existing pages (`site/index.html`, `site/en/index.html`, `site/privacy/index.html`, `site/en/privacy/index.html`, `site/feedback/index.html`, `site/en/feedback/index.html`), `tests/site-contrast.test.ts` (new)
- **Verified:** `npx vitest run tests/site-contrast.test.ts tests/feedback-page.test.ts tests/brand.test.ts` -> pass (138); `npm run check:site` -> builds 6 pages and 27 generated files, passes; build-site and site-gate tests -> pass (245); a deliberately failing dark `--muted` made three contrast pairs fail, then restored
- **Commit:** uncommitted, proposed "feat(site): give every page the shared layout and both themes"
- **Open issues:**
  - Tokens on `:root` redefined under `prefers-color-scheme: dark`; system fonts; 3px `:focus-visible` ring; skip link; logical properties; reduced-motion, forced-colors and print rules. The contrast test checks 25 pairs per theme (4.5:1 text, 3:1 focus and borders).
  - Builder's choices, kept (**Decided by Claude (delegated)**): the feedback pages keep a small Home/Privacy nav because `tests/feedback-page.test.ts` requires it in the sources; the feedback page keeps "Esta página no es un canal oficial." as a hint; privacy pages drop their old nav and footer for the shared ones; landing pages stay interim until step 7; the skip-link text is written per page.
  - Catalan footer line, to be reviewed by the owner with the other Catalan text: "NacioCheck és un projecte personal i independent. No té cap vincle amb el Ministerio de Justicia ni amb cap organisme públic."
  - Footer links to `/changelog/` and `/ca/...` lead nowhere until steps 8 and 9. **Decided by Claude (delegated):** step 10 adds an internal-link check to the gate.
  - Screenshots by the builder at 1280, 390 and 360 px in both themes (served locally, Turnstile removed): no overflow, header on one row at 360 px, dark logo variant shown.
- **Run by:** implement-phase (builder subagent, model opus)
- **Proposed commit (builder):**

```
feat(site): give every page the shared layout and both themes
```

## 2026-11-23 - Phase 3: Shared layout

- **Status:** done
- **Steps:** 6 done
- **File check:** pass (11 changed or new files, all in step 6's Files; plus the orchestrator's plan.md and progress.md)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (extension 36 files, 1001 tests; worker 2 files, 31 tests; 6 pages)
- **Commit proposal:** step 5 (Phase 2), then step 6, then the plan and progress updates
- **Open issues:** step 10 adds the internal-link and `lang`-matches-directory checks

## 2026-11-24 - Step 7: Write the landing page in three languages

- **Status:** done
- **Changed:** `site/index.html`, `site/en/index.html` (rewritten), `site/ca/index.html` (new), `site/_build/partials/landing.css` (real styles), `tests/site-landing.test.ts` (new)
- **Verified:** `npx vitest run tests/site-landing.test.ts tests/brand.test.ts` -> pass (79); prettier, eslint, typecheck -> clean; `npm run check:site` -> builds 15 pages and passes. The builder served `.output/site` locally and looked at es and ca at 1280 and 390 px in both themes: no horizontal scroll, every request local.
- **Commit:** uncommitted, proposed "feat(site): write the landing page in Spanish, English and Catalan"
- **Open issues:**
  - Sections `#hero`, `#how-it-works`, `#statuses`, `#privacy`, `#faq`, `#agencies`, then the shared footer. Status teaser `data-state` R, T1, T2, T3, T4, C, F under an "orientative, not official" note, with the sede's Spanish text on every page. Agency band with CSS-only rings, off under reduced motion, linking to the interim `vgr.cat` URLs.
  - Builder's choices, kept (**Decided by Claude (delegated)**): no lazy loading on screenshots (blank full-page captures); the animated hero icon hidden below 52rem (the badge already shows twice on phones); state names stay in Spanish; the GitHub link inside the privacy "Open source" card under `@if repository`.
  - **Decided by Claude (delegated), corrected by the orchestrator:** the FAQ said the extension works on Firefox for Android. The store listings say it is a target not yet verified on a device, so the answer now says so in es, en and ca.
  - The whole Catalan page, including the tagline, needs the owner's review.
- **Run by:** implement-phase (builder subagent, model opus)
- **Proposed commit (builder):**

```
feat(site): write the landing page in Spanish, English and Catalan
```

## 2026-11-24 - Step 8: Add the Catalan privacy and feedback pages

- **Status:** done
- **Changed:** `site/ca/privacy/index.html`, `site/ca/feedback/index.html` (new), `site/feedback/feedback.js` (Catalan messages, Turnstile `language: ca`), `tests/feedback-page.test.ts` (`ca` added to every case, two new cases)
- **Verified:** `npx vitest run tests/feedback-page.test.ts tests/site-gate.test.ts` -> pass (291); prettier, eslint, typecheck -> clean
- **Commit:** uncommitted, proposed "feat(site): add the Catalan privacy and feedback pages"
- **Open issues:**
  - The Catalan privacy page states the same as es and en, including Turnstile, the email delivery and Cloudflare Web Analytics (website only). Section anchors are in Catalan (**Decided by Claude (delegated)**).
  - Wording for the owner to check: "seu electrònica", "el web", "galetes", "correu brossa", "Elimina", the imperative button labels "Envia"/"Copia", "llances una comprovació", and "vegeu" mixed with "tu" in two places.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): add the Catalan privacy and feedback pages
```

## 2026-11-24 - Step 9: Add the changelog and 404 pages

- **Status:** done
- **Changed:** `site/changelog/index.html`, `site/en/changelog/index.html`, `site/ca/changelog/index.html`, `site/404.html`, `site/en/404.html`, `site/ca/404.html` (all new)
- **Verified:** `npm run build:site` -> 12 pages at the time, changelog pages with the "no releases yet" state, a `404.html` per language; no unexpanded markers; one h1 each
- **Commit:** uncommitted, proposed "feat(site): add the changelog and 404 pages in es, en and ca"
- **Open issues:** the 404 pages add `noindex` (**Decided by Claude (delegated)**: kept). Catalan wording for the owner: "Novetats", "No trobem aquesta pàgina", "Vés a l'inici", "Salta al contingut".
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): add the changelog and 404 pages in es, en and ca
```

## 2026-11-24 - Phase 4: Pages

- **Status:** done
- **Steps:** 7 done, 8 done, 9 done
- **File check:** pass (17 changed or new files, each in its step's Files; plus the orchestrator's plan.md and progress.md; the FAQ correction is the orchestrator's, in step 7's files)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (extension 37 files, 1088 tests; worker 2 files, 31 tests). By hand, on a separate `wrangler dev --port 8789` (metrics off, no login asked): `/favicon.ico` -> 200 `image/vnd.microsoft.icon`; `/nope/` -> the es 404 page, `/en/nope/` -> en, `/ca/nope/` -> ca; `/`, `/en/`, `/ca/`, `/ca/privacy/`, `/changelog/`, `/social-card.png` -> 200. Stopped afterwards.
- **Commit proposal:** step 7, step 8, step 9, then the plan and progress updates
- **Open issues:** `check:site` still requires only the original 6 pages; step 10 requires all 15 and adds the internal-link and `lang`-matches-directory checks

## 2026-11-24 - Step 10: Require every page in every language

- **Status:** done
- **Changed:** `scripts/check-site.mjs`, `tests/site-gate.test.ts`; also `scripts/check-site.d.mts` (outside the step's Files: it types the new exports `PAGES` and `linkProblems`, without which lint fails; kept)
- **Verified:** `npx vitest run tests/site-gate.test.ts` -> pass (257); `npm run check:site` -> builds and passes on 15 pages with every internal link resolving
- **Commit:** uncommitted, proposed "feat(site): require every page in every language and resolve links"
- **Open issues:**
  - `REQUIRED_PAGES` = `LANGUAGES` × `PAGES` (landing, privacy, feedback, changelog, 404).
  - **Decided by Claude (delegated), beyond the plan's scope:** `<html lang>` must match the language directory, and every same-origin `href` must resolve to a page or file in the output. Existing fixtures got their `lang` set to the path's language through a wrapper, so no rule lost coverage.
  - Builder's choices, kept: the link check covers `href` only (image sources are covered by the E2E site spec); `/privacy` without a slash counts as resolving.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): require every page in every language and resolve links
```

## 2026-11-24 - Step 11: Serve the built site to the E2E browser

- **Status:** done
- **Changed:** `e2e/support/site-server.ts`, `e2e/specs/site.e2e.ts` (new), `e2e/wdio.conf.ts`, `package.json`, `package-lock.json` (`axe-core@4.14.1`, `^4.14.1`, dev dependency approved at G2)
- **Verified:** `E2E_SPEC=site npm run test:e2e` -> 55 passing, guard `outside it 0`; axe found no violations in any page, light or dark; eslint, typecheck, prettier -> clean
- **Commit:** uncommitted, proposed "test(site): serve the built site to the E2E browser and audit it with axe"
- **Open issues:**
  - The site is served over http on 127.0.0.1 and reached as `http://site.naciocheck.test/` through a host rule; the server mimics `auto-trailing-slash` and `404-page`, and reports any other Host to the guard. `onPrepare` builds the site after the extension.
  - Per language: landing, privacy, changelog and 404 pages; `lang`, title, one h1, favicons, axe in both schemes (with a check that axe ran over ten rules), landing images rendered, 404 status, `/en` redirect. Feedback pages excluded (Q6).
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
test(site): serve the built site to the E2E browser and audit it with axe
```

## 2026-11-24 - Orchestrator fix: midnight flake in the visual spec

- **Status:** done
- **Found:** the first full E2E run (just after midnight) failed `onboarding: an application just saved` and `options: an application just saved`. The diff showed only the "Añadida el …" date: `maskSavedDates` matched `\d{2}:\d{2}`, but the time renders as `0:10` before 10:00, so the real date leaked into the capture. Pre-existing, not caused by this spec.
- **Changed:** `e2e/specs/visual.e2e.ts` (the mask accepts a one-digit hour). The file is step 12's.
- **Verified:** full `npm run test:e2e` afterwards -> pass (see Phase 5).
- **Commit:** uncommitted, proposed "test(e2e): mask saved times with a one-digit hour"

## 2026-11-24 - Phase 5: Full gate and E2E harness

- **Status:** done
- **Steps:** 10 done (one file outside its list, kept), 11 done
- **File check:** pass apart from `scripts/check-site.d.mts` (step 10, explained above) and `e2e/specs/visual.e2e.ts` (orchestrator fix)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (extension 37 files, 1139 tests; worker 2 files, 31 tests; check:site 15 pages); `npm run test:e2e` -> pass (13, 41, 55, 2 and 20 passing), network guard `outside it 0` in all five workers. A session interruption happened between the fix and the rerun; the rerun is the result recorded here.
- **Commit proposal:** the visual mask fix, step 10, step 11, then the plan and progress updates
- **Open issues:** none

## 2026-11-24 - Step 12: Photograph the site and rewrite the baselines

- **Status:** done
- **Changed:** `e2e/specs/visual.e2e.ts` (two site tests, light and dark; `openSitePage` waits for decoded images and the colour scheme), `e2e/baselines/chrome/site-*.png` (48 new), `.claude/commands/review-ui.md` (site pages, `ca`, themes; hand-formatted, Prettier ignores `.claude/`)
- **Verified:** `npm run test:e2e:update-baselines` -> pass (22), guard 0; `E2E_SPEC=visual npm run test:e2e` -> pass (22), 0 above tolerance; `git diff --stat e2e/baselines` -> empty (the 104 extension baselines byte-identical)
- **Commit:** uncommitted, proposed "test(site): photograph the site in three languages and both themes"
- **Open issues:** `/review-ui` (32 of 48 images opened): no High, nothing blocking AA or the brand rules. Medium: agency band art cut off on phones. Low: badge twice above the fold and a tall gap after the hero; red alert in the step 3 screenshot (accurate); hyphenated tokens breaking; gaps in inline code; sparse changelog empty state; teal tints outside the four brand teals (owner's call). **Decided by Claude (delegated):** fix the Medium and the cheap Lows in an added step 14; leave the red alert and the tints to the owner.
- **Run by:** implement-phase (builder subagent, model opus)
- **Proposed commit (builder):**

```
test(site): photograph the site in three languages and both themes
```

## 2026-11-24 - Step 13: Document the site build

- **Status:** done
- **Changed:** `README.md` ("The website" section, Catalan links, the `site` E2E spec), `docs/manual-firefox-checklist.md` (row 17 "The deployed website", Not run), `AGENTS.md` (`build:site`; `check:site` builds first)
- **Verified:** `npm run format:check` -> pass; `npx vitest run tests/licence.test.ts` -> pass (13)
- **Commit:** uncommitted, proposed "docs: describe the site build and add a Firefox site check"
- **Open issues:** the README baseline count was stale; step 14 fixed it.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
docs: describe the site build and add a Firefox site check
```

## 2026-11-24 - Step 14: Polish the findings of the UI review

- **Status:** done
- **Changed:** `site/_build/partials/landing.css`, `site/_build/partials/base.css`, the three landing, privacy and changelog pages, `README.md` (152 baselines: 104 extension + 48 site), `e2e/baselines/chrome/site-*` (rewritten)
- **Verified:** `npx vitest run tests/site-landing.test.ts tests/site-contrast.test.ts tests/feedback-page.test.ts` -> pass (199); `npm run check:site` -> pass; `npm run test:e2e:update-baselines` -> pass on run 1; run 2 failed on the known extension flake ("options: editing an application") and deleted three extension baselines, which the builder restored from HEAD with `git restore` (no extension baseline differs from HEAD); `npm run test:e2e` twice -> pass, guard 0
- **Commit:** uncommitted, proposed "fix(site): polish the hero, agency band, code and changelog after review"
- **Open issues:**
  - Agency art sits whole under the button on phones; hero gap tightened; `.nowrap` on `GPL-3.0`, `PBKDF2-HMAC-SHA-256` and the repository path; `code` inline padding 0.12em; changelog pages link back to the landing page.
  - **Decided by Claude (delegated), after looking at the 1280 hero:** the hero `<h1>` is the logo with the animated icon as its badge (the wordmark cropped by CSS, `direction: ltr`), and the right-hand art is the `result-changed` screenshot on wide screens. Accepted: it reads as the product moment, not a warning. Low, left to the owner: that screenshot appears again in step 3.
  - Re-review: no High or Medium. The flaky options-editing test, which deletes its baselines when it fails under `update-baselines`, deserves a follow-up (seen in two specs now).
- **Run by:** implement-phase (builder subagent, model opus)
- **Proposed commit (builder):**

```
fix(site): polish the hero, agency band, code and changelog after review
```

## 2026-11-24 - Phase 6: Baselines and docs

- **Status:** done
- **Steps:** 12 done, 13 done, 14 done (added during the phase)
- **File check:** pass (each file in its step's Files; the three restored extension baselines end identical to HEAD)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && npm run build:chrome && npm run build:firefox && npm run check:privacy && npm run test:e2e` -> pass (extension 37 files, 1139 tests; worker 31 tests; 15 pages; privacy gate: notices present, no forbidden APIs, URLs allowed; E2E 13 + 41 + 55 + 2 + 22 passing, guard `outside it 0` in all five workers; 152 baselines, no extension change)
- **Commit proposal:** step 12, step 14 (site files and README), step 13, then the plan and progress updates
- **Open issues:** the final independent review follows

## 2026-11-24 - Final review

- **Run by:** reviewer subagent, model opus; full text in `review.md`.
- **Verdict:** PASS WITH CHANGES. Every command passed; no mechanical fixes needed.
- **Medium 1 (gate bypasses: second `srcset` candidate, `https:` without slashes, backslashes, leading whitespace, character references, CSS escapes, `<meta http-equiv="refresh">`):** fixed in step 15.
- **Medium 2 (privacy pages point to a repository and store listings that do not exist yet):** left to the owner (es and en wording predates this spec).
- **Delegated decisions:** the reviewer agreed with all but one (shipping unused screenshots), which step 15 fixed; it asks the owner to restate the ADR 0005 amendment's acceptance line in their own name.
- **Lows fixed in step 15:** `deploy:site` now runs the gate; the English changelog no longer says its entries are in English. Left: axe incomplete results unasserted, the landing privacy card's narrower wording, the teal tints, the repeated hero screenshot.

## 2026-11-24 - Step 15: Close the review's gate gaps and small findings

- **Status:** done
- **Changed:** `scripts/check-site.mjs`, `tests/site-gate.test.ts`, `package.json`, `scripts/build-site.mjs`, `tests/build-site.test.ts`, `scripts/site-assets.mjs`, `tests/site-assets.test.ts`; the four `e2e/baselines/chrome/site-changelog-{light,dark}-en-{1280x800,412x915}.png` rewritten by the orchestrator
- **Verified:** `npx vitest run tests/site-gate.test.ts tests/build-site.test.ts tests/site-assets.test.ts` -> pass (352); `npm run check:site` -> pass. The builder's `npm run test:e2e` failed only on the four English changelog images (expected: the note is gone). **Decided by Claude (delegated):** rewrite them. `npm run test:e2e:update-baselines` -> pass (22), guard 0; a checksum comparison of all 152 baselines before and after showed exactly those four changed.
- **Commit:** uncommitted, proposed "fix(site): normalise URLs in the gate and ship only used screenshots"
- **Open issues:**
  - The gate normalises each URL the way a browser does (character references, whitespace, `\` as `/`, every `srcset` candidate, CSS escapes) before checking, refuses `http-equiv="refresh"`, and keeps the old rules as a second layer; 49 new tests, 36 of which fail with the new pass disabled. Any `href` scheme outside the allowed links is now refused, including `mailto:` and `tel:` (the site uses neither).
  - `SITE_SCREENS` (options-several, result-changed, statuses-guide) is the one list of shipped screenshots; 8 unused WebP files no longer ship (19 generated files instead of 27). It is not exported (the `.d.mts` was outside the step's Files); the test checks the shipped files against the pages instead.
  - The builder ran a stray `git stash` and popped it at once; the orchestrator confirmed no stash remains and the tree is intact.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
fix(site): normalise URLs in the gate and ship only used screenshots
```

## 2026-11-24 - Final verification

- **Status:** all planned steps done; the spec stays `active` until the owner's checks below
- **Commands:** `npm test` -> pass (extension 37 files, 1188 tests; worker 31 tests); `npm run lint`, `npm run format:check` (after formatting `review.md`), `npm run typecheck` -> pass; `npm run check:site` -> 15 pages; `npm run build:chrome && npm run build:firefox && npm run check:privacy` -> pass; `npm run test:e2e` -> 13 + 41 + 55 + 2 + 22 passing, guard `outside it 0` in all five workers; 152 baselines
- **Left for the owner:**
  - review the Catalan wording (every Catalan page; lists in the step 6, 7, 8 and 9 entries);
  - decide the privacy wording about the repository and store listings (review Medium 2);
  - restate the ADR 0005 amendment's acceptance line in your own name;
  - optionally: the teal tints in `brand/README.md`, the repeated hero screenshot, the interim `vgr.cat` URLs (the vgr.cat tie-in spec);
  - deploy (`npm run deploy:site` now runs the gate first), then Firefox checklist row 17 and the spec's last acceptance criterion;
  - follow-up: the flaky "options: editing an application" E2E test, which deletes its baselines when it fails under `update-baselines`.

## 2026-11-24 - Step 16: Fix the independent review's findings

- **Status:** done
- **Run by:** implement-phase (four builder subagents in parallel, model sonnet; the 404 decision and the baselines by the orchestrator), at the owner's request "check and fix with sonnet sub agents"
- **Changed:**
  - A (finding 1, High; finding 3, gate side): `scripts/check-site.mjs`, `tests/site-gate.test.ts` — any `on*` event attribute fails on every page (15 spellings × 9 pages; the two approved feedback script tags still pass; "onboarding", `data-on`, `content="on"` do not trip it); exactly `img/OFL.txt` is the one allowed text file, and it must ship whenever an outlined logo ships. 187 of the new tests fail against the old gate.
  - B (finding 3): `scripts/site-assets.mjs`, `tests/site-assets.test.ts` — `img/OFL.txt` is a byte copy of `brand/OFL.txt` next to the outlined logos (the test checks bytes and directory).
  - C (finding 4): the three privacy pages and `tests/feedback-page.test.ts` — the contact section names the same-language feedback page as the route that works now; the repository and "the history is in the repository" sit inside `@if repository`; the store listing appears only as "once it is published". Tests check the feedback route per language and that no repository mention survives outside `@if repository`.
  - D (finding 5): `e2e/specs/site.e2e.ts` — axe `incomplete` results (rule, impact, targets) per page, language and scheme go to the run output and `e2e/.artifacts/axe-incomplete.json`, without failing.
  - Orchestrator (finding 2): `spec.md` and `docs/adr/0005-distribution-and-public-pages.md` exempt the 404 pages from `hreflang` alternates (no address of their own, `noindex`; the switcher links each language's home). **Decided by Claude (on the owner's request to fix):** the build already behaved so, and pointing alternates at other 404 files would be meaningless. This edits a settled ADR line; the owner should confirm.
  - Orchestrator: the 12 `site-privacy-*` baselines rewritten.
- **Verified:** `npm test` -> pass (extension 37 files, 1388 tests; worker 31); lint, format, typecheck -> clean; `npm run check:site` -> 15 pages. `npm run test:e2e:update-baselines`: the first run failed with the guard at "seen 0" (the local servers did not answer; transient) and deleted 80 baselines, restored from git with `git restore e2e/baselines`; the rerun passed (22, guard 0). A checksum of all 152 baselines before and after shows exactly the 12 `site-privacy-*` images changed. `npm run test:e2e` -> 13 + 41 + 55 + 2 + 22 passing, guard `outside it 0` in all five workers.
- **axe incomplete:** 108 elements in 24 of 24 audits, all `color-contrast`: `.hero-facts > li`, `.hero-tagline`, `.hero-value` (text over the hero's teal gradient) and the language switcher links (the pill). Their token pairs pass the contrast unit test in both themes; axe cannot compute contrast over a gradient. Left as a manual AA check for the owner.
- **Commit:** uncommitted, proposed per part (see the end of the turn)
- **Open issues:** confirm the 404 exemption in the ADR and the privacy pages' promise that the store listing will take questions once published.
