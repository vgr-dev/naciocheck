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

## 2026-11-24 - Step 11: Compare performance and check the manual states

- **Status:** partial (stopped at the theme-script threshold, as the plan requires)
- **Changed:** `baseline.md` (new "After (step 11)" section)
- **Verified:** The recorded Before numbers came from a slower machine state, so the builder built
  `666b6d9` in a temporary worktree and measured both sites in the same Chrome session (via
  `chrome-agent`) with the same settings; traced and plain loads are reported separately. Phone
  FCP/LCP: cold 244 → 430 ms, warm 252 → 488 ms (plain). The LCP element is the hero description
  on phone and the hero image on desktop. CLS 0.00 in every run. Cold transfer: phone 71,265 →
  39,205 B, desktop 71,265 → 60,011 B. Budgets met (`theme.js` 2,010 B, hero 10.9 KB).
- **Verified:** Threshold tripped: warm FCP on the phone profile regressed by 142–236 ms across
  comparisons, and cold by about 186 ms. First paint waits for the blocking `/theme.js`, which
  revalidates with a 304 on every view. No `_headers` or source change was made.
- **Verified:** Manual states pass: opposite-OS theme both ways with persistence and
  `theme-color`, reduced motion (badge plays once), tab order and focus ring, responsive image
  selection, missing images (footprint kept), FAQ wrapping at 320 px, reflow at 200%/400%
  (emulated), feedback theme control offline (Turnstile tag removed in a scratch copy only), hero
  and theme same-origin only. Fixtures, extension code and baselines, store originals and page
  metadata unchanged against `666b6d9`; only `theme-color` tags are new.
- **Verified:** Audit Medium findings all confirmed. The forced-colours logo is worse than stated:
  with a light system scheme and Dark stored, "Nacio" is white on white in the header and hero.
  Two Low findings corrected: the logos add one request, not three; `fetchpriority` would not
  change the phone LCP (the hero description).
- **Commit:** uncommitted, proposed "docs(specs): record landing page performance and manual state check"
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
docs(specs): record landing page performance and manual state check
```

- **Open issues:** Owner chose to inline the theme bootstrap and to fix the four Medium findings
  in a new Phase 7, with the hero showing the changed-result banner; Phase 8 repeats the final
  checks. Uncovered: Firefox, Safari, real Windows high contrast, real browser zoom, a browser
  without `light-dark()`, screen readers, live Turnstile, non-Spanish performance, INP and field
  data, a fresh load at 768 px.

## 2026-11-24 - Phase 6: Verify the finished site

- **Status:** partial
- **Steps:** 11 partial (threshold tripped; the owner approved Phases 7 and 8 to fix and re-verify).
- **File check:** pass. Only `baseline.md` (step 11) changed besides the orchestrator's
  `plan.md`; the builder's temporary worktree and servers were removed.
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && npm run test:e2e && npm run check:privacy`
  passed: 1,446 application and 31 Worker tests, lint, format, typecheck, the offline gate for
  15 pages, 6 E2E spec files (147 tests, visual 0 above tolerance, 0 unexpected requests) and
  the privacy check.
- **Commit proposal:** one docs commit with `baseline.md`, `plan.md` (Phases 7 and 8 added) and
  this log.
- **Open issues:** Phase 7 started on top of this uncommitted phase with the owner's approval.

## 2026-11-24 - Step 12: Inline the theme bootstrap

- **Status:** done
- **Changed:** `scripts/{build-site,check-site}.mjs`, `docs/adr/0005-distribution-and-public-pages.md`,
  `tests/{build-site,site-gate}.test.ts`
- **Verified:** The build reads `site/theme.js` (unchanged) and writes it as one bare inline
  `<script>` after the `theme-color` metas and before the inline styles on every page, 404
  included; `theme.js` is no longer copied to the output. The build fails if the source is
  missing or contains `</script` or `<!--`. The gate requires exactly that script once in
  `<head>`, byte for byte against `site/theme.js`, runs the dynamic-code and network-API checks on
  it, and rejects duplicates, misplaced or commented copies, attribute variants, unrelated inline
  scripts, any `/theme.js` reference and a served `theme.js`. Feedback pages keep their two
  external scripts. ADR 0005 has a new amendment with the step 11 figures.
- **Verified:** `npx vitest run tests/{build-site,site-gate}.test.ts` passed 580 tests (678 with
  `feedback-page`). No other file mentions an external `/theme.js` except the superseded ADR
  amendment, which now points to the new one.
- **Commit:** uncommitted, proposed "feat(site): inline the theme bootstrap to avoid a blocking request"
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
feat(site): inline the theme bootstrap to avoid a blocking request
```

- **Open issues:** The first-paint gain is measured in step 15.

## 2026-11-24 - Step 13: Fix the forced-colours logo and the current-language cue

- **Status:** done
- **Changed:** `site/_build/partials/base.css`, `tests/site-contrast.test.ts`,
  `e2e/specs/site-theme.e2e.ts`
- **Verified:** Under `forced-colors: active` the logo variant follows the forced palette's
  `prefers-color-scheme` and ignores the stored theme; the rule ties the stored-theme rules'
  specificity and wins by source order. The current language adds weight 700 and a 2 px
  underline to the tint, keeps `aria-current="page"`, and the language links gain
  `touch-action: manipulation`.
- **Verified:** `npx vitest run tests/site-contrast.test.ts` passed 64 tests. New E2E cases cover
  the logo under a light and a dark forced palette with each stored theme on the landing and
  privacy pages, and the language cue in both themes and both forced palettes; they passed in the
  Phase verify.
- **Commit:** uncommitted, proposed "fix(site): follow forced palette for logo and mark current language"
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
fix(site): follow forced palette for logo and mark current language
```

- **Open issues:** The bolder current link is slightly wider; check the 390 px header wrap in
  step 15.

## 2026-11-24 - Step 14: Make the hero a legible changed-result banner

- **Status:** done
- **Changed:** `scripts/site-assets.mjs`, `site/{index.html,en/index.html,ca/index.html}`,
  `site/_build/partials/landing.css` (comment only), `tests/{site-assets,site-landing}.test.ts`,
  `e2e/specs/site.e2e.ts`
- **Verified:** The hero is `result-changed-hero-{342,448}.webp` (448 × 318), built by Sharp from
  the unchanged store screenshots for `es` and `en` (Catalan uses `es`). A contiguous crop that
  keeps the notice is 664 px wide and would put the old-status line at about 8 px on a 390 px
  phone, so the image stacks three cropped bands of the same screenshot (notice centre at 416,24
  448 × 185; new status at 292,296 448 × 68; old status at 292,430 448 × 32) on white. Pixels are
  cropped, never redrawn; the alt text and code comments say so. The owner approved this
  composite. At 390 px the 16 px status lines render at about 12.1 px (target 12). The
  saved-applications hero crop and its assets are removed; step 1 and step 3 images are unchanged.
- **Verified:** `npx vitest run tests/{site-assets,site-landing}.test.ts` passed 87 tests. The
  builder viewed the es and en outputs: notice and both statuses intact, fake data only. E2E
  (hero file, no shared `currentSrc` with any step, footprint, text-size bound at 390 px) passed
  in the Phase verify.
- **Commit:** uncommitted, proposed "feat(site): show the changed-result banner in the landing hero"
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
feat(site): show the changed-result banner in the landing hero
```

- **Open issues:** Below about 388 px the status lines drop under 12 px; the srcset stops at 448w,
  so high-DPR phones show it slightly soft.

## 2026-11-24 - Phase 7: Fix the measured and audited issues

- **Status:** done
- **Steps:** 12 done; 13 done; 14 done (composite hero approved by the owner).
- **File check:** pass. Every changed file is in its step's Files list; `baseline.md`,
  `plan.md` and `progress.md` carry the uncommitted Phase 6 records and the orchestrator's logs.
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`,
  then `E2E_SPEC=site npm run test:e2e` and `E2E_SPEC=site-theme npm run test:e2e`: pass. 1,466
  application and 31 Worker tests, the offline gate for 15 pages, site 67 and site-theme 12 E2E
  checks, 0 unexpected requests.
- **Commit proposal:** one commit per step, then the Phase 6 and 7 records together.
- **Open issues:** Visual baselines are stale until step 15 regenerates them.
