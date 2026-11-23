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
