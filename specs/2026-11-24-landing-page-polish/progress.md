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
