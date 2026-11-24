# Progress: NacioCheck landing page polish

## 2026-11-24 - Step 1: Record the performance and visual baseline

- **Status:** done
- **Changed:** `specs/2026-11-24-landing-page-polish/baseline.md`
- **Verified:** `npm run dev:site` and visible Chrome MCP capture passed. The record includes 12
  runs, FCP, LCP, CLS, request and response sizes, and cache headers. Targeted Prettier check passed.
- **Commit:** uncommitted, proposed "docs: record landing page performance baseline"
- **Run by:** implement-phase (builder subagent, model GPT-6 Luna)
- **Proposed commit (builder):**

```
docs: record landing page performance baseline
```

- **Open issues:** INP and CrUX field data were unavailable in the local navigation-only capture.

## 2026-11-24 - Step 2: Allow the theme script and demo media in ADR 0005 and the gate

- **Status:** done
- **Changed:** `docs/adr/0005-distribution-and-public-pages.md`, `scripts/check-site.mjs`,
  `tests/site-gate.test.ts`
- **Verified:** `npx vitest run tests/site-gate.test.ts` passed 506 tests. The initial sandboxed
  run could not bind loopback and the approved local retry passed. Targeted Prettier check passed.
- **Commit:** uncommitted, proposed "fix(site): allow approved theme and walkthrough assets"
- **Run by:** implement-phase (builder subagent, model GPT-6 Luna)
- **Proposed commit (builder):**

```
fix(site): allow approved theme and walkthrough assets
```

- **Open issues:** The approved script and media references become required in their integration steps.

## 2026-11-24 - Step 3: Produce the offline demo clips and posters

- **Status:** done
- **Changed:** `site/img/demo/{es,en}/{walkthrough.webm,poster.webp}`,
  `specs/2026-11-24-landing-page-polish/demo-assets.md`
- **Verified:** Local Sharp and FFmpeg export passed. Both silent VP9 clips play through to 12.625 s
  in Chrome and Firefox, and all six scene frames and both posters were reviewed. Clip and poster
  sizes meet their budgets. The Firefox session was closed.
- **Commit:** uncommitted, proposed "feat(site): add localized offline walkthrough media"
- **Run by:** implement-phase (builder subagent, model GPT-6 Luna)
- **Proposed commit (builder):**

```
feat(site): add localized offline walkthrough media
```

- **Open issues:** The reminder caption carries the schedule cue because the available capture
  shows saved applications. The English result preserves the source's Spanish status wording.

## 2026-11-24 - Step 4: Serve WebM and byte ranges from the offline site server

- **Status:** done
- **Changed:** `e2e/support/site-server.ts`
- **Verified:** `npm run typecheck && npm run lint` passed. The review caught a missing WebM MIME
  mapping in the first version. The builder added it and reran both checks successfully.
- **Commit:** uncommitted, proposed "fix(e2e): serve WebM byte ranges"
- **Run by:** implement-phase (builder subagent, model GPT-6 Luna)
- **Proposed commit (builder):**

```
fix(e2e): serve WebM byte ranges
```

- **Open issues:** Playback and range behaviour in the E2E server are exercised in Phase 4.

## 2026-11-24 - Phase 1: Baseline, site policy and demo assets

- **Status:** done
- **Steps:** 1 done, 2 done, 3 done, 4 done.
- **File check:** pass. All builder changes match their Files lists. The orchestrator activated
  the spec, updated plan status, and logged the phase.
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`
  passed after formatting the demo notes. 1,398 application tests and 31 Worker tests passed.
  The site gate passed on all 15 built pages.
- **Phase verify:** Local Wrangler served both clips as `video/webm`. Both range requests
  returned HTTP 200 with the full clip. Recorded in `demo-assets.md`.
- **Commit proposal:** Baseline evidence, precise media and script policy, walkthrough assets
  and source notes, then offline range serving and phase tracking.
- **Open issues:** Verify seek and replay against local Wrangler with the native player in Phase 4.
  The documented baseline can be used for the later performance comparison.

## 2026-11-24 - Scope revision: Static product screenshots

- The owner chose static product screenshots. Steps 3 and 4 are withdrawn. Step 8 will select
  and frame genuine localized screenshots at both widths using the existing image formats.
- The performance baseline was committed as `c563e0b`. The theme-script policy from
  `8abc4d5` carries forward. This uncommitted revision removes that commit's video allowance
  from ADR 0005 and the site gate and adds rejection coverage for video.
- The four uncommitted demo files were moved outside the repository. The uncommitted WebM
  server patch was reversed after saving a copy alongside those assets. Earlier verification
  remains recorded in `demo-assets.md` for context.
- The verification chain passed. It included all 1,428 tests, lint, format, typecheck, and
  the site gate on all 15 pages. The build contained no demo videos.

## 2026-11-24 - Step 5: Make the palette theme-switchable and set the type scale

- **Status:** done
- **Changed:** `site/_build/partials/base.css`, `tests/site-contrast.test.ts`,
  `tests/site-landing.test.ts`
- **Verified:** `npx vitest run tests/{site-contrast,site-landing}.test.ts` passed 115 tests with
  local loopback access. Targeted format and whitespace checks passed. A visible Chrome smoke
  check using the shared CSS passed Auto, Light and Dark against both system schemes. It also
  passed a simulated unsupported-feature check for the light fallback and wordmark selectors.
- **Commit:** uncommitted, proposed "refactor(site): consolidate theme palette and type scale"
- **Run by:** implement-phase (builder subagent, model GPT-6 inherited)
- **Proposed commit (builder):**

```
refactor(site): consolidate theme palette and type scale
```

- **Open issues:** Steps 6 and 7 connect the prepared wordmark classes to the page markup.
  Until then, existing browser-selected wordmarks can mismatch the light palette in browsers
  that lack `light-dark()` and prefer dark. Visual baselines are scheduled for Phase 5.

## 2026-11-24 - Phase 2: Tokens and type scale

- **Status:** done
- **Steps:** 5 done.
- **File check:** pass. Added the existing landing contrast parser to Step 5 because it read
  the old palette block. Builder changes matched the revised Files list.
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`
  passed. 1,398 application tests and 31 Worker tests passed. The offline gate passed for all
  15 generated pages.
- **Commit proposal:** Consolidate theme and type tokens, update both contrast readers, and
  record the phase together.
- **Open issues:** Theme selection and landing sections are next. Phase 1's static-image policy
  was reconciled to `546835f`.

## 2026-11-24 - Step 6: Apply and persist the theme on every page

- **Status:** done
- **Changed:** `site/theme.js`, `site/_build/strings.json`, `site/_build/partials/base.css`,
  `scripts/build-site.mjs`, `scripts/check-site.mjs`, `tests/{build-site,site-gate,feedback-page}.test.ts`,
  `e2e/specs/site-theme.e2e.ts`
- **Verified:** `npx vitest run tests/{build-site,site-gate,feedback-page}.test.ts` passed 661
  tests. `E2E_SPEC=site-theme npm run test:e2e` passed both browser tests with zero unexpected
  requests. Capturing a frame removed a stale computed background in headless Chrome.
  Visible Chrome also confirmed that the explicit Dark choice updates the built page.
- **Commit:** uncommitted, proposed "feat(site): add a persistent site-wide theme selector"
- **Run by:** implement-phase (builder subagent, model GPT-6 inherited)
- **Proposed commit (builder):**

```
feat(site): add a persistent site-wide theme selector
```

- **Open issues:** None.

## 2026-11-24 - Step 7: Refresh the landing sections and centre the FAQ icons

- **Status:** done
- **Changed:** `site/index.html`, `site/en/index.html`, `site/ca/index.html`,
  `site/_build/partials/landing.css`, `tests/site-landing.test.ts`, `e2e/specs/site.e2e.ts`
- **Verified:** `npx vitest run tests/site-landing.test.ts` passed 72 tests.
  `E2E_SPEC=site npm run test:e2e` passed 64 browser tests with zero unexpected requests,
  including FAQ alignment and keyboard interaction at both widths, forced colours, lazy image
  loading, and axe checks. The image test scrolls in the page and captures a frame before checking
  the native lazy load and decode. A visible Chrome spot check confirmed the dark mobile FAQ
  and loaded supporting screenshots. The brand badge plays once and respects reduced motion.
- **Commit:** uncommitted, proposed "feat(site): refresh localized landing sections and faq"
- **Run by:** implement-phase (builder subagent, model GPT-6 inherited, GPT-6 Luna for the
  lazy-image test follow-up)
- **Proposed commit (builder):**

```
feat(site): refresh localized landing sections and faq
```

- **Open issues:** The Phase 5 visual capture must scroll deferred images into view and capture
  a frame before waiting for decode. The current visual helper waits for all images before
  scrolling. Phase 4 owns the hero screenshot.

## 2026-11-24 - Phase 3: Theme selection and landing sections

- **Status:** done
- **Steps:** 6 done, 7 done.
- **File check:** pass. Builder changes match their Files lists. The orchestrator reconciled
  Phase 2 to `6f85a9e` and updated the plan and progress.
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`
  passed after scoped lint fixes. 1,442 application tests and 31 Worker tests passed. The site gate
  passed all 15 generated pages.
- **Phase verify:** `E2E_SPEC=site npm run test:e2e` passed 64 checks and
  `E2E_SPEC=site-theme npm run test:e2e` passed 2 checks. Both runs reported zero unexpected
  requests. Earlier browser attempts exposed a WebDriver wheel timeout and pending browser
  rendering. The passing runs use DOM scrolling and a frame capture before assertions.
- **Commit proposal:** Commit the theme control, site gate and theme tests together. Commit the
  landing refresh, its tests, and the workflow records together.
- **Open issues:** The static hero screenshot is next. Formal visual review and the lazy-loading
  adjustment to the screenshot harness are planned for Phase 5.

## 2026-11-24 - Step 8: Show a static product screenshot in the hero

- **Status:** done
- **Changed:** `site/{index.html,en/index.html,ca/index.html}`,
  `site/_build/partials/landing.css`, `scripts/site-assets.mjs`,
  `tests/{site-assets,site-landing}.test.ts`, `e2e/specs/site.e2e.ts`
- **Verified:** The hero uses a crop of the actual saved-applications screen above the supporting
  sections, with localized alt text and captions. Catalan uses the Spanish image. Sharp produces
  640 × 400 and 832 × 520 WebP assets from the unchanged store screenshots. Viewed the English
  crop after adjusting its bounds and confirmed both application cards are intact.
- **Verified:** `npx vitest run tests/{site-assets,site-landing}.test.ts` passed 86 tests.
  `npm run check:site` passed. `E2E_SPEC=site npm run test:e2e` passed 67 checks with zero
  unexpected requests. Chrome chose the 640w image in all three locales at both tested widths,
  rendering approximately 343 × 215 CSS px at 390px and 470 × 294 CSS px at 1280px. The tests
  verified the image footprint when its source is removed. All four variants are under 16 KB.
- **Commit:** uncommitted, proposed "feat(site): show localized product screenshot in hero"
- **Run by:** implement-phase (builder subagent, model GPT-6 Luna)
- **Proposed commit (builder):**

```
feat(site): show localized product screenshot in hero
```

- **Open issues:** Full visual review is scheduled for Phase 5.

## 2026-11-24 - Phase 4: Show static product screenshots

- **Status:** done
- **Steps:** 8 done.
- **File check:** pass. Builder changes matched the Files list. The orchestrator reconciled
  Phase 3 to `31d869f` and `fc26c26` and updated the plan and progress.
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`
  passed after correcting the typed E2E observations. 1,446 application tests and 31 Worker
  tests passed. The offline gate passed for all 15 generated pages.
- **Phase verify:** `E2E_SPEC=site npm run test:e2e` and `E2E_SPEC=site-theme npm run test:e2e`
  passed 67 and 2 checks respectively with zero unexpected requests.
- **Commit proposal:** Commit the localized hero, crop build, tests and workflow records together.
- **Open issues:** Phase 5 will adapt the visual helper for lazy-loaded images, regenerate the
  site baseline matrix, and audit the changed interface.

## 2026-11-24 - Step 9: Regenerate and review the site visual baselines

- **Status:** done
- **Changed:** `e2e/specs/visual.e2e.ts` (added to the step's Files with the owner's approval),
  48 `e2e/baselines/chrome/site-*.png`, `visual-review.md`
- **Verified:** The first writer run failed both site visual tests: `openSitePage` waited for every
  image to report `complete`, and the lazy screenshots below the fold never load. The helper now
  sets each image to eager loading inside the test before the same complete/decode wait.
  Production keeps `loading="lazy"` and no build flag was added. The writer only saves missing
  baselines, so the 48 old `site-*` files were deleted and regenerated (4 pages × 3 languages ×
  2 themes × 2 widths). The procedure in the plan does not mention this deletion.
- **Verified:** `E2E_SPEC=visual npm run test:e2e` in compare mode passed 22 tests with 0 of 152
  images above tolerance. `git diff --stat 546835f -- e2e/baselines` lists only the 48 `site-*`
  files, so the 104 extension baselines are unchanged. Network guard: 1,087 requests, 0 outside
  the fake site. Review per `.claude/commands/review-ui.md`: 0 High, 0 Medium, 9 Low. The en and
  ca landing, privacy, changelog and 404 images were reviewed as reduced sheets.
- **Commit:** uncommitted, proposed "test(site): regenerate site baselines for the polished landing page"
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
test(site): regenerate site baselines for the polished landing page
```

- **Open issues:** Low findings in `visual-review.md` (hero duplicates step 1, unreadable phone
  screenshot text, Catalan screenshots in Spanish, header rows differ by locale at 412 px, text
  pages use a narrower centred column, English footer label versus page title, bright screenshots
  in dark mode, empty right third at 1280 px in FAQ and agency, check mark would mirror in RTL).
  The matrix has no hover, focus, open-FAQ, forced-colours, print or Firefox states.

## 2026-11-24 - Step 10: Audit the changed code against the guidelines

- **Status:** done
- **Changed:** `audit.md`
- **Verified:** Applied every bundled `web-design-guidelines` rule and the `frontend-design`
  guidance to `scripts/build-site.mjs`, `site/_build/partials/{base,landing}.css`,
  `site/_build/strings.json`, `site/theme.js` and the three landing pages, from source only (no
  build or browser, as the step requires). Findings: 0 High, 4 Medium, 17 Low, 8 Nit, each with a
  `file:line` and the owning step. Contrast was computed from the token values: all tested pairs
  pass, and the focus ring is 4.86–11.99:1 on every surface. The orchestrator ran Prettier on
  `audit.md` to pass `format:check`.
- **Commit:** uncommitted, proposed "docs(spec): add landing page polish code audit"
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
docs(spec): add landing page polish code audit
```

- **Open issues:** Medium findings: the logo variant ignores forced colours (steps 6 and 7); the
  current language is marked only by a 1.13:1 / 1.87:1 tint (step 6); the hero repeats the
  step 1 saved-applications screenshot and shows neither the captcha nor the result (steps 7 and
  8); screenshot text renders at about 4–6 px on a phone (arithmetic, unverified; steps 7 and 8).
  Low and Nit findings are listed in `audit.md`. Rendered checks are candidates for step 11.

## 2026-11-24 - Phase 5: Baselines and code audit

- **Status:** done
- **Steps:** 9 done (Files extended with the owner's approval after it blocked on the lazy-image
  helper); 10 done.
- **File check:** pass. `e2e/specs/visual.e2e.ts`, 48 `site-*` baselines and `visual-review.md`
  belong to step 9; `audit.md` to step 10. The orchestrator changed `plan.md` (status lines,
  step 8 reconciled to `9a5ce81`, step 9 Files) and `progress.md`.
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && E2E_SPEC=visual npm run test:e2e`
  passed after formatting `audit.md`: 1,446 application and 31 Worker tests, lint, format,
  typecheck, the offline gate for 15 pages, and 22 visual tests with 0 differences above
  tolerance and 0 unexpected requests.
- **Commit proposal:** baselines and helper together; the audit and visual review with the plan
  and progress records.
- **Open issues:** Decide which `audit.md` Medium findings and `visual-review.md` Low findings to
  fix before step 11, and in which owning step. The visual baseline procedure should mention
  deleting the old `site-*` files before the writer runs.
