# Plan: NacioCheck landing page polish

Spec: `spec.md`

**Sign-off:** Approved by Victor Gonzalez on 2026-11-24.
Scope revised on 2026-11-24 at the owner’s request to use static product screenshots.
Step 9 Files extended on 2026-11-24 with the owner’s approval to include `e2e/specs/visual.e2e.ts`.
Phases 7 and 8 added on 2026-11-24 with the owner’s approval: inline the theme bootstrap, fix the
confirmed Medium audit findings, and show the changed-result banner in the hero.
Phase 8 inserted on 2026-11-24 with the owner’s approval: replace the header theme select with a
segmented footer switcher. The re-verify moved to Phase 9 as step 16.

## Status

<!-- One line per step. Only this section changes after sign-off. Details and verification evidence go in progress.md. -->

**Phase 1: Baseline and site policy**

- [x] 1. Record the performance and visual baseline (c563e0b)
- [x] 2. Allow the theme script and enforce the static-image policy (546835f)
- [-] 3. Produce the offline demo clips and posters (withdrawn)
- [-] 4. Serve WebM and byte ranges from the offline site server (withdrawn)

**Phase 2: Tokens and type scale**

- [x] 5. Make the palette theme-switchable and set the type scale (6f85a9e)

**Phase 3: Theme selection and landing sections**

- [x] 6. Apply and persist the theme on every page (31d869f)
- [x] 7. Refresh the landing sections and centre the FAQ icons (fc26c26)

**Phase 4: Show static product screenshots**

- [x] 8. Show a static product screenshot in the hero (9a5ce81)

**Phase 5: Baselines and code audit**

- [x] 9. Regenerate and review the site visual baselines (0487ac0)
- [x] 10. Audit the changed code against the guidelines (1fb4f60)

**Phase 6: Verify the finished site**

- [!] 11. Compare performance and check the manual states (theme-script threshold tripped; fixed in phase 7, rerun as step 16)

**Phase 7: Fix the measured and audited issues**

- [x] 12. Inline the theme bootstrap (f2aa426)
- [x] 13. Fix the forced-colours logo and the current-language cue (a955670)
- [x] 14. Make the hero a legible changed-result banner (7ca7d91)

**Phase 8: Move the theme control to the footer**

- [x] 15. Replace the theme select with a segmented footer switcher (uncommitted)

**Phase 9: Re-verify the finished site**

- [ ] 16. Regenerate the baselines and repeat the final checks

## Running steps in parallel

Steps in one phase run side by side in the same working tree, so:

- `npm run build:site`, `npm run check:site`, `npm run dev:site` and `npm run test:e2e` all rewrite
  `.output/`. A step that shares its phase with another step verifies with `vitest`, `lint` and
  `typecheck` only. Builds, the site gate and E2E run in the Phase verify, one after another. The
  only exception is step 1, which builds the original site to capture the baseline.
- Builders never write `progress.md` or `plan.md` (`/implement-phase` owns them). Evidence a
  step produces goes to its own file in this spec folder: `baseline.md`, `visual-review.md` and `audit.md`.
- Visual baselines (`e2e/baselines/`) are regenerated once, in step 9. Until then no Phase verify
  runs `E2E_SPEC=visual`, and no step touches the baselines.
- Phase 3 uses separate E2E files for landing sections (`site.e2e.ts`, step 7) and the theme
  (`site-theme.e2e.ts`, step 6). Step 8 extends the landing coverage in its own phase.
- The gate allows the exact theme script as optional in step 2. Step 6 requires it on every
  generated page.

## Design direction

Applicants arrive to learn what NacioCheck does, whether they can trust it, and how to install it.
Make the reminder, human captcha step and changed result the main story. Give the hero
screenshot enough space to show the extension and keep its framing quiet. Use the existing teal
wordmark and neutral surfaces. Start with six palette anchors already present in the site: white
`#FFFFFF`, dark canvas `#111827`, light ink `#0F172A`, dark-mode text `#F1F5F9`, light-mode teal
`#0F766E` and dark-mode teal `#5EEAD4`. Derive secondary surfaces and interactive colours through
semantic tokens and test each used pairing.

Typography stays on system UI (ADR 0005: nothing loaded from elsewhere, and no font request on the
critical path). It carries hierarchy through a deliberate scale rather than a new face:

| Role                       | Size (min → max)          | Weight | Notes                                  |
| -------------------------- | ------------------------- | ------ | -------------------------------------- |
| Hero tagline (the message) | `clamp(1.75rem … 2.5rem)` | 750    | Largest text on the page, balanced     |
| Section `h2`               | `clamp(1.4rem … 1.75rem)` | 700    | Always smaller than the tagline        |
| `h3`, FAQ question         | `1.15rem … 1.25rem`       | 650    |                                        |
| Body                       | `1.0625rem`, line 1.65    | 400    | Prose `max-inline-size: 68ch` (~70 ch) |
| Small (captions, notes)    | `0.9375rem`               | 400    | Never below this for running text      |

Today the section headings (up to 2rem) outrank the tagline (up to 1.9rem), and `--measure: 46rem`
gives about 85 characters per line; both are corrected. Keep prose left aligned. Use spacing and
quiet dividers to show grouping, and reserve visual prominence for the screenshots and install
actions.

```text
Desktop
  Wordmark                           Language     Theme
  Tagline, value, install          | Product screenshot
  Privacy and independence facts   | Localized screenshot caption
  Reminder → human captcha → result  (three-step overview)
  Status guide and privacy
  FAQ
  Agency contact and footer

Phone
  Wordmark
  Language     Theme
  Tagline, value, install, facts
  Product screenshot
  Reminder → human captcha → result
  Status guide, privacy, FAQ
  Agency contact and footer
```

Keep the section order. Each replaced block and the visitor task it serves:

- **Hero screenshot visible on desktop and phone.** Use an authentic localized capture that
  shows a distinct product capability. The current hero repeats the changed-result shot from
  the steps and disappears on phones. Pick a different existing capture or crop a relevant
  area while keeping the install actions near the opening copy.
- **Tracked all-caps labels above every `h2` → removed.** Each label repeats its heading ("Cómo
  funciona" over "Aviso, captcha y resultado"). Without them, visitors scanning for a section read
  one line per section instead of two. The label text that carries information the heading lacks
  moves into the heading or the intro; the anchors stay.
- **Four identical privacy cards → a two-column list with quiet dividers.** The four promises are
  parallel statements, not separate objects. A divided list reads faster, matches the FAQ and
  timeline treatment, and stops competing with the product screenshots for attention.
- **Hero gradient wash → a flat band surface.** It is decoration with no information.
- **Agency band rings and motion → a quiet contact treatment.** Keep the contact link as easy
  to find and let the copy carry the invitation.
- **Native FAQ disclosures stay.** Visitors scan the questions and expand only the ones they need.

Check that the animated brand badge plays once. If it loops, raise it with the owner under
the brand rules. The numbered steps
stay numbered because they are a real sequence. Preserve each locale's anchors, reading order, key
actions, factual terms and the stores' coming-soon behaviour.

### Styling decision

Keep the existing CSS and use shared component classes and semantic tokens. The current build
already combines a shared stylesheet with a landing stylesheet and uses the same classes across
all three locales. Tailwind's build-time CLI could provide consistent primitives, but would
require a dependency, a compile step, source discovery across HTML and build templates, and a
decision about its base reset. It would also repeat more presentation choices across localized
markup. Its generated CSS size would depend on the final class set. Compare the delivered CSS
against the baseline below and revisit tooling only if the implementation exposes a specific
maintenance or size problem that justifies a separately approved change.
[Tailwind CLI](https://tailwindcss.com/docs/installation/tailwind-cli)

Define each colour once with `light-dark()` and drive it with `color-scheme`: Auto keeps
`color-scheme: light dark` (system theming with no script), and the explicit modes set
`:root[data-theme="light"] { color-scheme: light }` and `:root[data-theme="dark"] { color-scheme:
dark }`. One palette source then serves page colours, native controls and scrollbars. Browsers
without `light-dark()` (Safari before 17.5) get the light palette from an
`@supports not (color: light-dark(#000, #fff))` block, so they still render legibly.

### Performance and visual evidence

- **Baseline (step 1), before any site change:** save the commit, Chrome version, viewport,
  throttling profile (Chrome's "Fast 4G" plus 4× CPU for phone, none for desktop) and three
  **cold** and three **warm** (cached, reload) traces each for a representative phone and desktop
  landing. Use the built local site via `npm run dev:site` and the Chrome MCP performance and
  network tools. Record median FCP, LCP and CLS, the LCP element, transferred HTML/CSS/script/image
  bytes before interaction, and the response headers of each asset (Wrangler's `Cache-Control`,
  `ETag`, content type). If traces are unavailable, record request counts, sizes and observed
  layout shifts separately and name the unmeasured metrics.
- **Known figures at planning time:** about 42 KB of HTML per landing (10.7 KB gzip) with about
  24 KB of source CSS inlined. On a phone the hidden hero image still downloads its 640w file
  (`result-changed-640.webp`, 20.5 KB), and the below-fold step and status screenshots load
  eagerly (about 55 KB at 640w). A correctly sized hero source and lazy-loading the other
  screenshots should make the phone first load lighter. Record the actual change.
- **Budgets:** 3 KiB raw for the theme script, aim for up to 35 KiB for the hero image selected at
  the measured viewport, and at most 45 KiB extra first-load transfer at each measured width.
  Preserve screenshot legibility. Measure before raising a budget and record material trade-offs
  for owner review.
- **The theme script on repeat visits.** The site has no `_headers` file, so static assets are
  likely served with Workers' default revalidating cache policy (confirm in step 1). A blocking
  `/theme.js` in `<head>` would then wait for a conditional round trip before first paint on every
  page view, even when cached. Cold-only traces would miss this, hence the warm runs. If step 11
  shows a warm-load FCP regression of 50 ms or more at the phone profile, stop and propose a
  follow-up: a content-hashed script name plus a `_headers` rule with `immutable`. That adds a
  served file and changes the gate, so it needs owner approval.
- **Request waterfall:** Check hero image discovery and responsive source selection, whether both
  logo variants download, and the cost of the early theme script. Keep the hero image eager with
  fixed dimensions. Give screenshots in the steps and status sections `loading="lazy"`, intrinsic
  dimensions and accurate `sizes`.
- **Reading the numbers:** compare repeat runs for practical regressions. Use LCP ≤ 2.5 s and
  CLS ≤ 0.1 as lab reference values. Describe interaction traces as lab samples: the Core Web
  Vitals thresholds apply to the 75th percentile of field loads.
  [Web Vitals](https://web.dev/articles/vitals) · [Chrome Performance panel](https://developer.chrome.com/docs/devtools/performance/overview)
- **Visual baselines (step 9 only):** `E2E_UPDATE_BASELINES=1 E2E_SPEC=visual npm run test:e2e`
  runs the existing writer without deleting the baseline directory. Keep only reviewed `site-*`
  baseline changes. Compare the extension baselines against the commit before Phase 2 and
  investigate any difference. Rerun `E2E_SPEC=visual npm run test:e2e` in compare mode. Follow
  `.claude/commands/review-ui.md` for screenshot review, and track font and coverage limits.

## Phase 1: Baseline and site policy

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`.
  The site builds offline, the gate allows the approved theme bootstrap, and the baseline is recorded.

### 1. Record the performance and visual baseline

- **Goal:** `baseline.md` records the baseline protocol for the original site, cold and warm,
  phone and desktop, including asset response headers.
- **Files:** This spec's `baseline.md`.
- **Verify:** The record lists every metric or names what could not be measured.
- **Out of scope:** Changes to the site, tests or tools.

### 2. Allow the theme script and enforce the static-image policy

- **Goal:** ADR 0005 and the site gate allow at most one exact classic
  `<script src="/theme.js"></script>` in the head of each page. The site gate rejects unrelated
  scripts, inline handlers and network or dynamic code in the theme script. Feedback keeps its
  existing script pair. Images use the existing allowlist and the gate rejects video.
- **Files:** `docs/adr/0005-distribution-and-public-pages.md`, `scripts/check-site.mjs`,
  `tests/site-gate.test.ts`.
- **Verify:** `npx vitest run tests/site-gate.test.ts`. The site gate runs in Phase verify.
- **Out of scope:** Creating `theme.js`, changing page markup or adding asset types.

### 3. Produce the offline demo clips and posters

Withdrawn when the owner chose static product screenshots. See `progress.md` for prior work.

### 4. Serve WebM and byte ranges from the offline site server

Withdrawn with the clips. See `progress.md` for prior work.

## Phase 2: Tokens and type scale

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`.
  All 15 generated pages and both contrast modes pass.

### 5. Make the palette theme-switchable and set the type scale

- **Goal:** Rewrite the two token blocks in `base.css` as one palette using `light-dark()` per
  the styling decision, with Auto on `:root`, explicit `[data-theme="light"|"dark"]` modes setting
  `color-scheme`, and a light fallback for browsers without `light-dark()`. Add the semantic tokens
  the refresh needs and the type-scale tokens from the design direction; set `--measure` to `68ch`.
  Add logo-variant classes (`.logo-for-light`, `.logo-for-dark`) that show exactly one variant for
  the effective theme, in Auto through the media query and in explicit modes through the root
  attribute, so they also work with JavaScript disabled. Without a `data-theme` attribute the
  pages look as before apart from the measure and type scale.
- **Files:** `site/_build/partials/base.css`, `tests/site-contrast.test.ts`,
  `tests/site-landing.test.ts` (palette parsing only).
- **Verify:** `npx vitest run tests/{site-contrast,site-landing}.test.ts`. Both contrast suites read
  the `light-dark()` palette and check their existing text, icon and focus pairings in both modes.
- **Out of scope:** Header markup, the theme control, landing sections.

## Phase 3: Theme selection and landing sections

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`,
  then `E2E_SPEC=site npm run test:e2e` and `E2E_SPEC=site-theme npm run test:e2e`, one after
  the other. Zero unexpected requests. No visual compare yet.

### 6. Apply and persist the theme on every page

- **Goal:** Emit a single classic `/theme.js` via `@head` before the inline styles, including the
  404 branch, and a `<meta name="theme-color">` per scheme (`media` attributes) that matches the
  page background. Emit a labelled, localized native `<select>` via `@header` with
  `autocomplete="off"` (Firefox would otherwise restore a stale value on reload), explicit
  `background-color` and `color` (Windows dark mode), and `touch-action: manipulation`. Keep it
  hidden with `visibility` until the script marks the root ready, so its space is reserved and
  revealing it shifts nothing.
- Before first paint, accept only `light`, `dark` or `auto` under one site-specific localStorage
  key. Apply explicit modes as `data-theme` on the root; Auto removes it and the CSS handles live
  system changes. Update `theme-color` for explicit modes. Guard storage reads and writes: invalid
  or missing data falls back to Auto, and denied storage still allows a choice for the current
  page. Set the select's value from storage, and resync on `pageshow` (back/forward cache) and on
  `storage` events.
- Replace the OS-only `<picture>` logo in the generated header with both outlined assets using the
  step 5 classes, one reserved footprint, and one accessible name. Localize labels in the shared
  strings file. Make the gate require the script exactly once on each built page and reject a
  missing asset.
- Tests: all generated locale/page combinations, including 404 and feedback. Keep the feedback
  tests offline by exercising its built header and bootstrap in the existing DOM test harness with
  external resources disabled; preserve the existing feedback script tests. In Chrome E2E, use the
  real control and verify both overrides, Auto after live emulated OS changes, reload,
  cross-page/locale navigation, a nested 404, matching computed colours, `theme-color` and the
  visible logo, with a clean storage reset between examples. Exercise storage exceptions and the
  script-disabled fallback in the DOM or browser harness.
- **Files:** `site/theme.js`, `site/_build/strings.json`, `site/_build/partials/base.css` (header
  and theme-control rules only), `scripts/build-site.mjs`, `scripts/check-site.mjs`,
  `tests/{build-site,site-gate,feedback-page}.test.ts`, `e2e/specs/site-theme.e2e.ts`.
- **Verify:** `npx vitest run tests/{build-site,site-gate,feedback-page}.test.ts`. E2E runs in the
  Phase verify.
- **Out of scope:** Landing HTML (the hero wordmark is step 7), extra storage, cookies, feedback
  behaviour, extension code, baselines.

### 7. Refresh the landing sections and centre the FAQ icons

- **Goal:** Apply the design direction across all three landing sources: the type scale, the
  block replacements listed there (labels removed, privacy list, flat hero band, quiet agency
  band), install actions and their availability easy to scan, and the same semantic colour roles
  for surfaces, links, borders and focus across the steps, status guide, privacy, FAQ and agency
  blocks. Give existing product screenshots one restrained frame and preserve aspect ratios,
  content, alt text and responsive variants; add `loading="lazy"` to every screenshot below the
  hero. Balance long captions and paragraph widths across languages. Keep the status disclaimer
  next to the guide and source visibility conditional. Preserve footer destinations, credit and
  independence wording. Switch the hero wordmark to the step 5 logo classes. Mark the brand name
  `translate="no"` where it appears as a name. Check whether the animated badge loops (see design
  direction). Step 8 picks and frames the hero screenshot.
- Centre the FAQ mark with two equal CSS-drawn strokes (`::before` and `::after` on the indicator,
  using borders or `currentColor`, not background gradients) inside the circular indicator. Show
  only the horizontal stroke when open. Keep the whole `summary` as the native hit target with
  `touch-action: manipulation` and visible focus when the question wraps. Check the icon in
  `forced-colors: active`.
- **Files:** `site/index.html`, `site/en/index.html`, `site/ca/index.html`,
  `site/_build/partials/landing.css`, `tests/site-landing.test.ts`, `e2e/specs/site.e2e.ts`.
- **Verify:** `npx vitest run tests/site-landing.test.ts` (new colour pairs, including focus
  against each surface and the FAQ open/hover states). E2E (FAQ pointer and keyboard expand and
  collapse, icon geometry at phone and desktop widths with wrapped questions) runs in the Phase
  verify.
- **Out of scope:** The hero screenshot replacement, `base.css`, new brand assets, policy-page copy, styling
  dependencies, baselines.

## Phase 4: Show static product screenshots

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`,
  then `E2E_SPEC=site npm run test:e2e` and `E2E_SPEC=site-theme npm run test:e2e`.
  The hero screenshot is visible at both widths in all locales, and no unexpected requests occur.

### 8. Show a static product screenshot in the hero

- **Goal:** Choose a genuine extension capture that shows a capability distinct from the
  changed-result shot in the steps. Start with the existing localized options or status guide
  captures, and use the existing Sharp build if a new crop or responsive derivative is needed.
  Keep the capture visible on phones and desktop without moving the install actions below it.
  Use English imagery on English pages and the Spanish capture on Catalan pages with localized
  alt text and context. Keep the reminder, human captcha and result explanation in localized HTML.
- Match the hero screenshot framing to the supporting images. Use intrinsic dimensions,
  responsive sources and accurate `sizes`. Keep the hero image eager and verify that the
  deferred images decode after scrolling. Check narrow widths and both themes for legibility,
  overflow, early image discovery and a stable layout when the image is absent.
- **Files:** `site/index.html`, `site/en/index.html`, `site/ca/index.html`,
  `site/_build/partials/landing.css`, `scripts/site-assets.mjs` and
  `tests/site-assets.test.ts` if derivatives are added, `tests/site-landing.test.ts`,
  and `e2e/specs/site.e2e.ts`.
- **Verify:** `npx vitest run tests/{site-assets,site-landing}.test.ts`, `npm run check:site` and
  `E2E_SPEC=site npm run test:e2e`. Check selected image URLs and their rendered dimensions
  in local Chrome at phone and desktop widths.
- **Out of scope:** Video, player controls, new file types, changes to store originals and baselines.

## Phase 5: Baselines and code audit

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && E2E_SPEC=visual npm run test:e2e`.
  Zero screenshot differences above tolerance.

### 9. Regenerate and review the site visual baselines

- **Goal:** Regenerate the 48 site visual combinations (three locales, two schemes, both widths,
  landing and other pages) using the procedure above. Review them with
  `.claude/commands/review-ui.md` and record findings by severity in `visual-review.md`. Extension
  baselines are unchanged against the commit before Phase 2.
- **Files:** `e2e/specs/visual.e2e.ts` (load lazy images before photographing site pages; test
  helper only), `e2e/baselines/chrome/site-*`, this spec's `visual-review.md`.
- **Verify:** The compare run passes; `git diff --stat` shows only `site-*` baselines changed.
- **Out of scope:** Fixing findings (they go back to the step that owns the file).

### 10. Audit the changed code against the guidelines

- **Goal:** Read-only. Review the changed HTML, CSS, `theme.js` and the generated header with the
  bundled `web-design-guidelines` rules, and critique the result against the design direction with
  `frontend-design`. Report findings in `audit.md` as `file:line` with severity, including forced
  colours, the theme control, screenshot text alternatives and layout, and contrast evidence for
  focus, icons and overlays.
- **Files:** this spec's `audit.md`.
- **Verify:** Every finding cites a file and line or says why it cannot.
- **Out of scope:** Edits to source, builds, browser runs.

## Phase 6: Verify the finished site

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && npm run test:e2e && npm run check:privacy`.
  E2E builds both browsers before the privacy check. Zero unexpected requests and zero screenshot
  differences above tolerance.

### 11. Compare performance and check the manual states

- **Goal:** Repeat the baseline protocol with the same settings and add an "After" section to
  `baseline.md` comparing metrics, budgets and the request waterfall. Apply the theme-script
  revalidation threshold above and stop for owner approval if it trips. Check by hand the states
  screenshots miss: opposite-OS theme, reduced motion, tab order, responsive image selection, missing
  images, FAQ wrapping, reflow at narrow width and 200%/400% zoom, forced colours. Check feedback's
  theme control offline without contacting Turnstile, and confirm the hero and theme work without
  external services. Record actual metrics, uncovered cases and deviations. Confirm fixture bytes,
  extension code and baselines, store originals, privacy promises and metadata are unchanged.
  Final release and Firefox gates stay in the existing checklist and audit trail.
- **Files:** this spec's `baseline.md`.
- **Verify:** The phase verify above, plus the comparison in `baseline.md`.
- **Out of scope:** Deployment, store uploads, a deployed-site audit, `_headers` (a follow-up
  only with owner approval).

## Phase 7: Fix the measured and audited issues

Step 11 measured the blocking `/theme.js` request delaying first paint on the phone profile by
about 186 ms cold and 236 ms warm, and confirmed the four Medium findings in `audit.md`. The owner
chose to inline the bootstrap (fixes cold and warm) and to fix the findings here. The three steps
share no files and do not build; builds, the gate and E2E run in the Phase verify.

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`,
  then `E2E_SPEC=site npm run test:e2e` and `E2E_SPEC=site-theme npm run test:e2e`, one after the
  other. Zero unexpected requests. No visual compare yet (step 16 regenerates the baselines).

### 12. Inline the theme bootstrap

- **Goal:** The build reads `site/theme.js` (kept as the single source) and emits its contents as
  one inline classic `<script>` in `<head>`, before the inline styles, on every page including the
  404 branch; `/theme.js` is no longer served or referenced. Behaviour is unchanged: the same key,
  values, storage guards, `theme-color` update, `pageshow` and `storage` resync, and control
  wiring once the DOM is ready. Amend ADR 0005 (new dated amendment) so pages carry exactly one
  inline script whose text equals the built `theme.js` source, and record why: an external
  blocking script cost a round trip before first paint even when cached. Teach the gate to require
  exactly that inline script once per page, compared byte for byte with the source, to apply the
  existing dynamic-code and network-API checks to it, and to keep rejecting every other inline
  script, `on*` handler, external script and the old `/theme.js` reference or asset. Feedback
  pages keep their exact two external scripts.
- **Files:** `scripts/build-site.mjs`, `scripts/check-site.mjs`,
  `docs/adr/0005-distribution-and-public-pages.md`, `tests/{build-site,site-gate}.test.ts`.
- **Verify:** `npx vitest run tests/{build-site,site-gate}.test.ts`. Cases cover the inline script
  present once, missing, duplicated, modified by one byte, an unrelated inline script, a leftover
  external `/theme.js`, and the feedback pages.
- **Out of scope:** Changing what the script does, `_headers`, CSS, landing content.

### 13. Fix the forced-colours logo and the current-language cue

- **Goal:** Under `forced-colors: active`, the header and hero wordmark choose the variant from
  the forced palette (its `prefers-color-scheme`), not from a stored theme, so no combination of
  stored theme and system contrast theme leaves part of the wordmark invisible. Outside forced
  colours, behaviour is unchanged. Mark the current language with a cue that is not colour alone
  (for example an underline or border plus weight), visible in both themes and in forced colours,
  keeping `aria-current="page"`. In the same rules, add the `touch-action: manipulation` the audit
  lists as missing on the language links.
- **Files:** `site/_build/partials/base.css`, `tests/site-contrast.test.ts`,
  `e2e/specs/site-theme.e2e.ts`.
- **Verify:** `npx vitest run tests/site-contrast.test.ts`. The new E2E cases (forced-colours
  emulation with a light and a dark system scheme against each stored theme, checking the visible
  logo variant; the current-language cue's non-colour property) run in the Phase verify.
- **Out of scope:** Landing HTML and CSS, the theme script, new brand assets.

### 14. Make the hero a legible changed-result banner

- **Goal:** The hero shows a tight crop of the changed-result screen around the "status changed"
  notice and the old → new status, built by Sharp from the unchanged store screenshots for `es` and
  `en` (Catalan uses `es`), replacing the saved-applications crop so the hero no longer repeats
  step 1. At a 390 px viewport the key status text renders at 12 CSS px or more at DPR 1. Keep
  intrinsic dimensions, eager loading, localized alt text that states the change, and the
  responsive widths. Step 1 keeps the saved-applications screen and step 3 keeps the full
  changed-result screen. Remove the now-unused hero crop and its assets.
- **Files:** `site/index.html`, `site/en/index.html`, `site/ca/index.html`,
  `site/_build/partials/landing.css`, `scripts/site-assets.mjs`,
  `tests/{site-assets,site-landing}.test.ts`, `e2e/specs/site.e2e.ts`.
- **Verify:** `npx vitest run tests/{site-assets,site-landing}.test.ts`. Record the crop bounds and
  the rendered text size calculation in the builder report. E2E (hero image chosen, footprint,
  no duplicate of step 1) runs in the Phase verify.
- **Out of scope:** New captures, store screenshots, other sections, `base.css`.

## Phase 8: Move the theme control to the footer

The owner preferred a compact segmented switcher in the footer, in the style of the Tailwind CSS
documentation, over the native select in the header. Moving it also leaves the header as the logo
and language links, which removes the locale-dependent header wrap at 412 px noted in
`visual-review.md`. One step, alone in its phase, so it may build.

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`,
  then `E2E_SPEC=site npm run test:e2e` and `E2E_SPEC=site-theme npm run test:e2e`, one after the
  other. Zero unexpected requests. No visual compare yet (step 16 regenerates the baselines).

### 15. Replace the theme select with a segmented footer switcher

- **Goal:** Remove the theme `<select>` from the generated header. The build adds the switcher to
  the shared footer output on every page (landing, privacy, feedback, changelog and 404, all three
  languages) through one `<!-- @theme -->` marker in each footer partial, so the markup is
  defined once in `build-site.mjs`. The switcher is a `<fieldset>` with a visually hidden localized
  legend, holding three native radio inputs in a fixed order: Auto, Light, Dark. All three share
  one `name`, and each has a visually hidden localized label. Each segment shows a small inline SVG
  icon (monitor, sun, moon) drawn for this site, with `aria-hidden="true"` and `focusable="false"`,
  using `currentColor` with no external references.
- **Look and behaviour:**
  - One rounded group with even segments of at least 32 × 32 px and a 1 px control border. It sits
    at the end of the footer row and wraps under the links on a phone.
  - The checked segment has a filled surface and a stronger border, so selection does not rely on
    colour alone. Hover is quieter than checked.
  - The focus ring follows `:focus-visible` on the input and is drawn on its segment.
  - Icons meet 3:1 against every surface they sit on, in both themes.
  - Under `forced-colors: active`, the checked segment uses `Highlight` for its outline.
  - `touch-action: manipulation` on the segments.
  - The control stays hidden until the script marks the root ready, with its space reserved, as
    today. Without JavaScript the system theme still applies.
- **Script:** `site/theme.js` sets the checked radio from storage and saves on `change`, instead
  of reading the select. Storage, accepted values, `theme-color`, the `pageshow` and `storage`
  resync and the inline delivery are unchanged. The gate follows the new script text because it
  compares the inline script with this file.
- **Gate:** reject inline `<svg>` in pages that carries `<script>`, `foreignObject`, event
  attributes or any `href`/`xlink:href`, so the new icons cannot open a path the site rules close.
- **Files:** `scripts/build-site.mjs`, `scripts/check-site.mjs`, `site/theme.js`,
  `site/_build/strings.json`, `site/_build/partials/footer.{es,en,ca}.html` (marker only),
  `site/_build/partials/base.css`, `tests/{build-site,site-gate,site-contrast,feedback-page}.test.ts`,
  `e2e/specs/site-theme.e2e.ts`.
- **Verify:** `npx vitest run tests/{build-site,site-gate,site-contrast,feedback-page}.test.ts`,
  then `npm run check:site` and `E2E_SPEC=site-theme npm run test:e2e`.
  - E2E drives the real radios by pointer and by keyboard (arrow keys move and select). It covers
    both overrides, Auto following live OS emulation, reload and cross-page/locale persistence, a
    nested 404 and the feedback page.
  - It also checks the accessible names (the group and each option in all three languages), that
    exactly one radio is checked, the forced-colours checked outline, and that the header no
    longer holds a theme control.
  - Storage exceptions and the script-disabled fallback stay covered in the DOM harness.
- **Out of scope:** Landing sections, the hero, footer links and wording, new brand assets, a
  served icon file.

## Phase 9: Re-verify the finished site

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && npm run test:e2e && npm run check:privacy`.
  Zero unexpected requests and zero screenshot differences above tolerance.

### 16. Regenerate the baselines and repeat the final checks

- **Goal:** First, regenerate the 48 `site-*` baselines (delete the old `site-*` files, then run
  the writer, as step 9 found the writer only saves missing images), review them per
  `.claude/commands/review-ui.md`, and update `visual-review.md`. Then repeat step 11 with its
  same-session method: compare against the `666b6d9` build and the step 11 "After" figures,
  apply the 50 ms threshold, and recheck the four Medium findings, forced colours and the hero
  legibility in the visible Chrome via `chrome-agent`, plus the footer switcher by keyboard,
  pointer and forced colours, and the header at 390 px and 412 px in all three languages. Add an
  "After phases 7 and 8" section to `baseline.md`. Extension baselines and fixture bytes stay
  unchanged.
- **Files:** `e2e/baselines/chrome/site-*`, this spec's `visual-review.md` and `baseline.md`.
- **Verify:** `E2E_SPEC=visual npm run test:e2e` in compare mode passes; the phase verify above.
- **Out of scope:** Source changes (a failed check goes back to the owning phase 7 or 8 step),
  `_headers`, deployment.

## Risks / open questions

- **Theme script caching.** With no `_headers`, repeat visits may pay a revalidation round trip
  before first paint. The fix (hashed name plus `immutable`) adds a served file and changes the
  gate, so it is a separate, owner-approved follow-up, triggered only by the step 11 measurement.
- **`light-dark()` support.** Older browsers get the light palette via the `@supports` fallback;
  step 11 checks one with the property disabled or a fallback test.
- **Parallel builders share one working tree.** A builder that runs a site build or E2E outside
  the Phase verify will corrupt another builder's run. Builders stop and report instead.
- Review the first-paint cost of the theme bootstrap and the hero image against the baseline. Fix an
  avoidable regression before regenerating baselines in step 9.
