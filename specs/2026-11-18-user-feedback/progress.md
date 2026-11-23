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
