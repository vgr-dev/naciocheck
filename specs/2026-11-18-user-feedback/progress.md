# Progress: User feedback without telemetry

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


## 2026-11-23 - Step 1: Build and redact the report

- **Status:** done
- **Changed:** `src/core/report.ts` (new), `tests/report.test.ts` (new)
- **Verified:** `npx vitest run tests/report.test.ts` -> pass (43); `npx eslint src/core/report.ts tests/report.test.ts` -> clean
- **Commit:** uncommitted, proposed "feat(core): build and redact a problem report"
- **Open issues:**
  - Additive exports beyond the contract: `REPORT_FIELDS`, `ReportField`, `REPORT_LABELS`, `TRUNCATED_MARKER`, `ReportLocale`.
  - `REPORT_FIELDS` has a tenth field, `explanation` (`explicación` / `explanation`), for `buildGuideReport`.
  - The cap covers everything but the trailing empty `comment:` line, so the total including `[truncated]` is at most 4000 and the comment line is never cut.
  - `buildGuideReport` redacts the catalogue explanation too, so the preview matches what the Worker mails; a year in catalogue text shows as `[NUMBER]` (test locks it).
  - Error messages joined with ` | `, values collapsed to one line, `version` and `browser` not redacted, `outcome` and `statusKey` stay machine values.
  - Dates match `/` and `-` only (a version like `0.4.12` is not a date); NIE/REF case-insensitive with Unicode-aware lookarounds; `redact` is idempotent over a whole report.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(core): build and redact a problem report
```

## 2026-11-23 - Step 2: Add the panel and guide texts

- **Status:** done
- **Changed:** `src/core/locales/es.ts`, `src/core/locales/en.ts`
- **Verified:** `npx vitest run tests/i18n.test.ts` -> pass (21); `npm run typecheck` -> clean; `npx eslint src/core/locales` -> clean
- **Commit:** uncommitted, proposed "feat(i18n): add report panel and wrong-explanation texts"
- **Open issues:** none. Eight `report.*` keys in a new section between the result view and the guide, plus `statuses.explanationWrong` after `statuses.branchHint`; no placeholders; nothing claims to be official.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(i18n): add report panel and wrong-explanation texts
```

## 2026-11-23 - Step 3: Let the site gate admit the feedback pages

- **Status:** done
- **Changed:** `scripts/check-site.mjs`, `scripts/check-site.d.mts`, `tests/site-gate.test.ts`
- **Verified:** `npx vitest run tests/site-gate.test.ts` -> pass (48); `npm run check:site` -> pass (4 pages); `npx eslint scripts/check-site.mjs tests/site-gate.test.ts` -> clean
- **Commit:** uncommitted, proposed "feat(site): let the site gate admit the feedback pages"
- **Open issues:**
  - New export `assetProblems(name, text)`; `feedback/feedback.js` is the only non-HTML file allowed.
  - Beyond the plan: `assetProblems` also rejects protocol-relative strings (`"//host`) in `feedback.js`.
  - `siteProblems` normalises names to forward slashes.
  - The success message still says "no scripts"; step 11 updates it with `REQUIRED_PAGES`.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): let the site gate admit the feedback pages
```

## 2026-11-23 - Step 4: Write the Worker's request checks as pure functions

- **Status:** done
- **Changed:** `worker/checks.ts` (new), `tests/feedback-checks.test.ts` (new)
- **Verified:** `npx vitest run tests/feedback-checks.test.ts` -> pass (62); `npx eslint worker/checks.ts tests/feedback-checks.test.ts` -> clean
- **Commit:** uncommitted, proposed "feat(worker): add pure request checks for the feedback endpoint"
- **Open issues:**
  - Judgement calls: `parseBody` rejects extra keys, caps `token` at 2048 chars (`MAX_TOKEN_CHARS`), and returns a discriminated result; `checkRequest` ignores a malformed `Content-Length`, so step 10 must cap the body read itself.
  - Check order: method, origin, content-type, too-large.
  - Step 9 must confirm `worker/checks.ts` typechecks under the Workers tsconfig.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(worker): add pure request checks for the feedback endpoint
```

## 2026-11-23 - Phase 1: Pure pieces

- **Status:** done
- **Steps:** 1 done, 2 done, 3 done, 4 done
- **File check:** pass (9 changed or new files, each in its step's Files; plus the orchestrator's plan.md and progress.md)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (27 files, 605 tests; check:site 4 pages)
- **Commit proposal:** one commit per step, one for the plan and progress updates
- **Open issues:** step 10 must cap the body read (checks ignore a malformed `Content-Length`); step 9 must typecheck `worker/checks.ts` under the Workers tsconfig; step 11 updates the site check's success message

## 2026-11-23 - Step 5: Carry the report input in the result payload

- **Status:** done
- **Changed:** `src/entrypoints/background.ts`, `tests/background.test.ts`
- **Verified:** `npx vitest run tests/background.test.ts` -> pass (45); `npm run typecheck` -> clean; `npx eslint src/entrypoints/background.ts tests/background.test.ts` -> clean
- **Commit:** uncommitted, proposed "feat(background): carry the report input in the result payload"
- **Open issues:**
  - `reportOf(check)` copies `outcome` and `statusKey` by name; set for status, error, unknown (`unknown`/`unknown`), deleted (`null`) and both `resultForCheck` branches.
  - Beyond the plan: `report: null` also in the save-failed catch branch of `handleOutcome` (no check to report on); `resultFor` is now exported for the history-reopen tests.
  - `isResultPayload` accepts a missing or `null` `report` and rejects a malformed one; `resultForCached` reads a pre-change cached payload as `report: null`.
  - `src/entrypoints/result/main.ts` keeps its own `ResultPayload` and guard without `report`; step 7 owns that.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(background): carry the report input in the result payload
```

## 2026-11-23 - Step 6: Build the report panel

- **Status:** done
- **Changed:** `src/entrypoints/shared/report-panel.ts` (new), `src/entrypoints/shared/report-panel.css` (new), `tests/report-panel.test.ts` (new)
- **Verified:** `npx vitest run tests/report-panel.test.ts` -> pass (8); `npx eslint src/entrypoints/shared/report-panel.ts tests/report-panel.test.ts` -> clean
- **Commit:** uncommitted, proposed "feat(ui): add the report panel with copy and continue buttons"
- **Open issues:**
  - Reuses the page classes `.field`, `.row`, `.button`, `.primary`, `p.hint`; steps 7 and 8 must check no page-level rule for `.row` or `.field` conflicts (no scoping added).
  - Copy failure, including a missing clipboard, selects the textarea and announces `report.copyFailed`.
  - CSS (44 px summary, `:focus-visible` outlines, logical properties for RTL) is not covered by jsdom; the visual check is Phase 7.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(ui): add the report panel with copy and continue buttons
```

## 2026-11-23 - Phase 2: Report input and panel

- **Status:** done
- **Steps:** 5 done, 6 done
- **File check:** pass (5 changed or new files, each in its step's Files; plus the orchestrator's plan.md and progress.md)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck` -> pass (28 files, 620 tests)
- **Commit proposal:** one commit per step, one for the plan and progress updates (which also records the Phase 1 hashes)
- **Open issues:** step 7 adds `report` to the result page's own `ResultPayload` and guard; steps 7 and 8 check `.row` / `.field` styles on their pages

## 2026-11-23 - Step 7: Offer the panel on the result page

- **Status:** done
- **Changed:** `src/entrypoints/result/main.ts`, `src/entrypoints/result/style.css`
- **Verified:** `npm run typecheck` -> clean; `npx eslint src/entrypoints/result/main.ts` -> clean
- **Commit:** uncommitted, proposed "feat(result): offer the report panel on errors and anomalies"
- **Open issues:**
  - The page's `ResultPayload` gains `report` (missing read as `null`); the panel is appended after the disclaimer when `report !== null` and the view is an error or has an anomaly (Q1).
  - Importing `reportPanel` now loads `shared/pages.css` on the result page. Four of its rules clashed with the page's (`body`, `.app`, `.disclaimer`, `button.primary`); the page's rules were made more specific (`html body`, `main.app`, `.app .disclaimer`, `.actions > button.primary`) and `--gray-500` added to `:root`.
  - Local `browserLabel(userAgent)` (name and major version, no OS); duplicates step 8's `browserName()`, see the phase entry.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(result): offer the report panel on errors and anomalies
```

## 2026-11-23 - Step 8: Offer "this explanation looks wrong" in the guide

- **Status:** done
- **Changed:** `src/entrypoints/statuses/main.ts`
- **Verified:** `npm run typecheck` -> clean; `npx eslint src/entrypoints/statuses/main.ts` -> clean
- **Commit:** uncommitted, proposed "feat(statuses): offer a report panel on every guide card"
- **Open issues:**
  - Every card ends with a closed panel built from `buildGuideReport(entry.key, entry[locale].explanation, context)`.
  - Local `browserName()`; duplicates step 7's helper and misses Edge on Android (`EdgA/`), see the phase entry.
  - CSS (read only): `.card p` gives the panel's hints `margin: 0 0 6px`, and the panel is a bordered box inside the bordered card. Harmless; a tweak would go in `report-panel.css`.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(statuses): offer a report panel on every guide card
```

## 2026-11-23 - Phase 3: Panel on the pages

- **Status:** done
- **Steps:** 7 done, 8 done
- **File check:** pass (3 changed files, each in its step's Files; plus the orchestrator's plan.md and progress.md)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck` -> pass (28 files, 620 tests). Diagnostic, beyond the phase verify: `npm run build:chrome && E2E_SPEC=visual E2E_BROWSER=chrome npx wdio run e2e/wdio.conf.ts` -> 18 passing, 3 failing: the guide and the error-result captures (expected until Phase 7) and the after-all screenshot hook; every other result view matches its baseline, so loading `pages.css` on the result page changed nothing else; network guard 0 outside the fake site
- **Commit proposal:** one commit per step, one for the plan and progress updates
- **Open issues:** two browser-name helpers (`browserLabel` in `result/main.ts`, `browserName` in `statuses/main.ts`) that disagree on Edge for Android; proposed follow-up: move one tested helper into `src/core/report.ts` and use it in both pages

## 2026-11-23 - Step 8a: Share one tested browser label helper

- **Status:** done
- **Changed:** `src/core/report.ts`, `tests/report.test.ts`, `src/entrypoints/result/main.ts`, `src/entrypoints/statuses/main.ts`
- **Verified:** `npx vitest run tests/report.test.ts` -> pass (53); `npm run typecheck` -> clean; `npx eslint` on the four files -> clean; `grep -rn "function browser" src/entrypoints` -> no match; `npm test` -> pass (28 files, 630 tests); `npm run lint` -> clean; `npm run format:check` -> clean
- **Commit:** uncommitted, proposed "refactor(core): share one browser label helper across report pages"
- **Open issues:** none. `browserLabel(userAgent)` keeps the result page's patterns (word-bounded, `EdgA/` for Edge on Android); the guide now gets Edge on Android right. Tests cover nine made-up agents (desktop and Android Chrome, Edge, Firefox, plus Opera, an unknown and an empty agent) and assert no OS or platform token in any label.

## 2026-11-23 - Step 9: Add the Worker, its bindings and its test harness

- **Status:** done
- **Changed:** `package.json`, `package-lock.json`, `wrangler.jsonc`, `worker/index.ts` (new), `worker/tsconfig.json` (new), `tests/worker/tsconfig.json` (new), `tests/worker/smoke.test.ts` (new), `tsconfig.json`, `vitest.config.ts`, `vitest.worker.config.ts` (new); `eslint.config.js` not needed
- **Verified:** `npx vitest run -c vitest.worker.config.ts` -> pass (1), also inside `unshare -rn` with loopback only, so the `send_email` and `ratelimits` bindings load offline; `npm run typecheck` -> clean (root, e2e, worker; `worker/checks.ts` included); `npx eslint worker tests/worker vitest.worker.config.ts` -> clean; `npm test`, `npm run lint`, `npm run format:check`, `npm run check:site` -> pass
- **Commit:** uncommitted, proposed "feat(worker): add the Worker skeleton, bindings and test harness"
- **Open issues:**
  - Installed: `@cloudflare/vitest-plugin` 1.9.0 (`^1.9.0`), `@cloudflare/workers-types` 5.20261123.1 (`^5.20261123.1`). The plugin brings `miniflare@5.20261119.0-beta` and `workerd@1.20261119.1` beside wrangler's own copies; `npm audit` 0 vulnerabilities; npm warns that 5 packages (edgedriver, esbuild, geckodriver, workerd twice) have install scripts outside `allowScripts`.
  - `wrangler.jsonc`: `main`, `run_worker_first: ["/api/*"]`, `observability.enabled: false`, `FEEDBACK_LIMIT` (namespace `1001`, 2 per 60 s), `FEEDBACK_MAIL` (`destination_address` naciocheck@vgr.cat), `vars.TURNSTILE_EXPECTED_HOSTNAME`; no secret, no other address, no `remote: true`.
  - `worker/index.ts` augments `Cloudflare.Env` and `GlobalProps.mainModule` (one `eslint-disable-next-line @typescript-eslint/no-namespace` with its reason); the test config passes a dummy `TURNSTILE_SECRET` (`test-only-not-a-real-secret`).
  - For step 10: the plugin has no outbound fetch mock in this version, so siteverify is stubbed with `vi.spyOn(globalThis, 'fetch')`; workers-types exposes a structured `send(EmailMessageBuilder)` overload besides `send(EmailMessage)`, shape not yet checked.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(worker): add the Worker skeleton, bindings and test harness
```

## 2026-11-23 - Phase 4: Worker harness

- **Status:** done
- **Steps:** 9 done
- **File check:** pass (10 changed or new files, each in step 9's Files; plus the orchestrator's plan.md and progress.md)
- **Phase verify:** `npm ci && npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (extension 28 files, 630 tests; worker 1 file, 1 test; check:site 4 pages)
- **Commit proposal:** one commit for step 9, one for the plan and progress updates
- **Open issues:** before Phase 5, the Turnstile sitekey (Q7) is still needed for step 11; step 10 stubs siteverify through `globalThis.fetch` and checks the structured `send` overload

## 2026-11-23 - Step 10: Handle POST /api/feedback

- **Status:** done (reported partial: its Verify passed, the worker typecheck failed until step 10a)
- **Changed:** `worker/index.ts`, `worker/feedback.ts` (new), `tests/worker/feedback.test.ts` (new), `worker/checks.ts`, `tests/feedback-checks.test.ts`, `wrangler.jsonc`, `.dev.vars.example` (new), `.gitignore`, `package.json`
- **Verified:** `npx vitest run -c vitest.worker.config.ts` -> pass (31), also inside `unshare -rn`; `npx vitest run tests/feedback-checks.test.ts` -> pass (64); `npx eslint worker tests/worker tests/feedback-checks.test.ts` -> clean; `git check-ignore .dev.vars` -> `.dev.vars`; `npx tsc --noEmit -p worker/tsconfig.json` -> fail (5 errors from `storage.ts`/`crypto.ts` via `report.ts`), fixed by step 10a
- **Commit:** uncommitted, proposed "feat(worker): handle POST /api/feedback with Turnstile and mail"
- **Open issues:**
  - Order: `checkRequest(request, env.FEEDBACK_ORIGIN)` → rate limit (key `CF-Connecting-IP`, else `unknown`) → streamed body read capped at 8192 bytes (a missing or lying `Content-Length` still gives 413) → `parseBody` → siteverify (`remoteip` omitted when unknown; network error, non-2xx or non-JSON is `502 upstream`) → `readSiteverify` against `env.TURNSTILE_EXPECTED_HOSTNAME` → `redact` → send → `204`.
  - Mail uses the structured `send({ from, to, subject, text })` overload of `@cloudflare/workers-types` 5.20261123.1, from and to `naciocheck@vgr.cat`, subject `NacioCheck feedback`; no hand-built MIME.
  - No `console.*` in the Worker; errors are `{"error":"<code>"}` with `Cache-Control: no-store`; other `/api/*` paths are `404 {"error":"not-found"}`.
  - Tests call `handleFeedback` with stubbed `FEEDBACK_MAIL` and `FEEDBACK_LIMIT`, plus two routing tests through `exports.default.fetch`; siteverify via `vi.spyOn(globalThis, 'fetch')`, any other URL fails the test in `afterEach`.
  - Not exercised: `wrangler dev` and the local `send_email` simulation (hands-on, the user's).
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(worker): handle POST /api/feedback with Turnstile and mail
```

## 2026-11-23 - Step 10a: Give redact a module of its own

- **Status:** done
- **Changed:** `src/core/redact.ts` (new), `src/core/report.ts`, `worker/feedback.ts`, `tests/redact.test.ts` (new)
- **Verified:** `npm run typecheck` -> clean (root, e2e, worker); `npx vitest run tests/report.test.ts tests/redact.test.ts` -> pass (56); `npx vitest run -c vitest.worker.config.ts` -> pass (31); `npx eslint` on the four files -> clean
- **Commit:** uncommitted, proposed "refactor(core): move redact into its own module"
- **Open issues:** none. Added to the plan during Phase 5 after the user chose to split `redact` out rather than add DOM to the worker tsconfig. `redact` and its patterns moved verbatim; `report.ts` re-exports it; the worker tsconfig is unchanged.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
refactor(core): move redact into its own module
```

## 2026-11-23 - Step 11: Add the feedback pages

- **Status:** done
- **Changed:** `site/feedback/index.html` (new), `site/en/feedback/index.html` (new), `site/feedback/feedback.js` (new), `scripts/check-site.mjs`, `tests/site-gate.test.ts`, `eslint.config.js`, `tests/feedback-page.test.ts` (new)
- **Verified:** `npm run check:site` -> pass (6 pages); `npx vitest run tests/feedback-page.test.ts tests/site-gate.test.ts` -> pass (109); `npx eslint site scripts/check-site.mjs tests/feedback-page.test.ts tests/site-gate.test.ts` -> clean
- **Commit:** uncommitted, proposed "feat(site): add the es and en feedback pages"
- **Open issues:**
  - Container `<div id="turnstile" data-sitekey="0x4AAAAAAGPHi96wZq5N-xcv">` without `cf-turnstile`; `feedback.js` renders explicitly with the real key only on `naciocheck.vgr.cat`, the always-pass test key elsewhere; renders once whichever script loads first (`turnstile.ready` when present), shows a message if the widget never loads.
  - Send needs text and a token; every outcome resets the widget; after a success Send stays disabled until the text changes. Messages in es and en for every contract code, a network error and an unknown body. Copy falls back to `execCommand('copy')`.
  - Pages carry a `<noscript>` note and a footer saying the page is not an official channel. No language switch link, because the fragment is cleared on load and switching would lose the report.
  - Site gate: one `data-sitekey` matching `^0x[A-Za-z0-9_-]+$` per feedback page; `feedback.js` may hold only the one always-pass test key; success message now "scripts only on the feedback pages". `eslint.config.js` gives `site/**/*.js` browser globals, `turnstile` readonly, `sourceType: 'script'`.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(site): add the es and en feedback pages
```

## 2026-11-23 - Phase 5: Endpoint and feedback pages

- **Status:** done
- **Steps:** 10 done (typecheck fixed by 10a), 10a done (added during the phase), 11 done
- **File check:** pass (18 changed or new files, each in its step's Files; `worker/feedback.ts` is in both 10 and 10a; plus the orchestrator's plan.md and progress.md)
- **Phase verify:** first run `npm run typecheck` -> fail (worker project, 5 errors); after step 10a: `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (extension 30 files, 696 tests; worker 2 files, 31 tests; check:site 6 pages)
- **Commit proposal:** 10a first (so every commit typechecks), then 10, then 11, then the plan and progress updates
- **Open issues:** hands-on, the user's: `wrangler dev` with `.dev.vars`, enabling Email Routing and verifying that `naciocheck@vgr.cat` can send to itself, restricting the widget hostname, `wrangler secret put TURNSTILE_SECRET`

## 2026-11-23 - Step 12: Cover the panel in the Chrome E2E suite

- **Status:** done (reported partial: the anomaly case failed on a real defect, fixed by step 12a without editing the test)
- **Changed:** `e2e/specs/pages.e2e.ts`
- **Verified:** `npm run typecheck` -> clean; `npx eslint e2e/specs/pages.e2e.ts` -> clean; `E2E_SPEC=pages npm run test:e2e` -> 39 passing, 1 failing (anomaly case) before 12a, 40 passing after; full `npm run test:e2e` -> guard 0 outside the fake site
- **Commit:** uncommitted, proposed "test(e2e): cover the report panel on the result page and guide"
- **Open issues:**
  - Helpers: `recordTabCreation` / `recordedTabs` (replace `chrome.tabs.create` before the click, so no feedback page loads), `openPanelWithKeyboard`, `identityValues`.
  - Guide: one closed panel per card; en keyboard open, edit, Continue records one `tabs.create` to `https://naciocheck.vgr.cat/en/feedback/#` with the edited text.
  - Result: error result (`result-error-captcha.htm`) panel closed, after the disclaimer, keyboard-openable, no `raw`/`subStatus`, no identity values; Continue records `https://naciocheck.vgr.cat/feedback/#…`, `sede.posts` stays 1. Normal status: no panel. Anomaly: closed panel, report free of either check's site text.
  - Not covered: an unknown-page result (no fixture ends on one; `synthetic-unknown-form.html` exercises the content-script fallback only).
  - Headless Chrome's agent says `HeadlessChrome/158`, which `browserLabel` reads as `unknown`; the browser line is not asserted. Cosmetic, headless only.
  - WebdriverIO `setValue` drops newlines in a textarea, so edited text in the tests is one line.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
test(e2e): cover the report panel on the result page and guide
```

## 2026-11-23 - Step 12a: Report an anomaly by its state ids, never its note text

- **Status:** done
- **Changed:** `src/core/anomaly.ts`, `src/core/alerts.ts`, `src/core/report.ts`, `src/entrypoints/result/main.ts`, `tests/anomaly.test.ts`, `tests/alerts.test.ts`, `tests/report.test.ts`; `background.ts` and its test not needed (the guard only checks `view` exists and the view is cached whole)
- **Verified:** `npx vitest run tests/anomaly.test.ts tests/alerts.test.ts tests/report.test.ts tests/background.test.ts` -> pass (136); `npm run typecheck` -> clean; `npx eslint` on the 7 files -> clean; `E2E_SPEC=pages npm run test:e2e` -> 40 passing, guard 0
- **Commit:** uncommitted, proposed "fix(report): name an anomaly by its state ids, not the note text"
- **Open issues:**
  - Added to the plan during Phase 6 after step 12 found that `detectAnomaly`'s note quotes both checks' `raw` and `subStatus`, which reached the report (breaks Q2). The user chose state ids only.
  - `AnomalyNote` gains `from`/`to`; `ResultView.anomalyMove` carries kind and ids; `ReportContext.anomaly` is `{ kind, from, to } | null`. The visible note on the result page is unchanged. A view cached before this change builds a report with no anomaly line.
  - Labels kept as `nota` / `anomaly note` (step 12's E2E asserts `nota: `); the plan's example was corrected to match.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
fix(report): name an anomaly by its state ids, not the note text
```

## 2026-11-23 - Step 13: State the feedback channel in the policy and docs

- **Status:** done
- **Changed:** `site/privacy/index.html`, `site/en/privacy/index.html`, `README.md`, `store/permissions.md`, `store/listing.es.md`, `store/listing.en.md`, `docs/manual-firefox-checklist.md`
- **Verified:** `npm run check:site` -> pass (6 pages); `npx vitest run tests/licence.test.ts` -> pass (13); `npx prettier --check README.md store docs/manual-firefox-checklist.md site` -> clean
- **Commit:** uncommitted, proposed "docs: state the feedback channel in the policy and docs"
- **Open issues:**
  - Privacy pages gain an "Informar de un problema" / "Reporting a problem" section with a nav link and the plain Turnstile Privacy Addendum link; the summary card points to it; "last reviewed" moved to 23 November 2026.
  - README: a "Reporting a problem" paragraph and a "Test the feedback page locally" subsection; the stale `check:site` "no scripts" comment corrected.
  - Store: a "Feedback channel" bullet in Chrome data usage and a clause in the AMO answer (data collected stays "none"); both listings gain a "Your data" bullet and a privacy-summary sentence; short descriptions untouched.
  - Firefox checklist row 15 "Report a problem" (Not run). Its wording says to seed an error "with the dev helper below, or a real failed check", but the dev helper seeds a status check: the user may want to reword it.
  - The home pages have no explicit "loads nothing from elsewhere" sentence and were outside this step's Files.
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
docs: state the feedback channel in the policy and docs
```

## 2026-11-23 - Phase 6: End-to-end checks and wording

- **Status:** done
- **Steps:** 12 done (anomaly case fixed by 12a), 12a done (added during the phase), 13 done
- **File check:** pass (15 changed files, each in its step's Files; plus the orchestrator's plan.md and progress.md)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site` -> pass (extension 30 files, 701 tests; worker 2 files, 31 tests; 6 pages); `npm run test:e2e` -> check-flow 13, pages 40, 2, visual 18 passing; visual 3 failing as expected until Phase 7 (status guide, error result, after-all screenshot hook); network guard 0 outside the fake site in all four workers
- **Commit proposal:** 12a first (the fix), then 12, then 13, then the plan and progress updates
- **Open issues:** Firefox checklist row 15 wording (dev helper seeds a status, not an error); headless Chrome reports `navegador: unknown`; no unknown-page result fixture
