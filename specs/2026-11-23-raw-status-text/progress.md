# Progress: Show the status exactly as the site printed it

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

-->

## 2026-11-23 - Step 1: Name the status by its raw text in the result view

- **Status:** done
- **Changed:** `src/core/alerts.ts`, `tests/alerts.test.ts`
- **Verified:** `npx vitest run tests/alerts.test.ts` -> pass (22/22); `npm run typecheck` -> pass
- **Commit:** uncommitted, proposed "feat(ui): name the status by its raw site text on the result page"
- **Open issues:** none
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat: name the status by its raw text in the result view
```

## 2026-11-23 - Step 2: Name the states by their raw texts in the anomaly note

- **Status:** done
- **Changed:** `src/core/anomaly.ts`, `tests/anomaly.test.ts`
- **Verified:** `npx vitest run tests/anomaly.test.ts` -> pass (11/11); `npx eslint src/core/anomaly.ts` -> pass
- **Commit:** uncommitted, proposed "feat(ui): name the states by their raw site text in the anomaly note"
- **Open issues:** none (cached notes keep old wording until the next check, as planned)
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat: name states by their raw site text in the anomaly note
```

## 2026-11-23 - Step 3: Show the raw text in the popup and the options history

- **Status:** done
- **Changed:** `src/entrypoints/popup/main.ts`, `src/entrypoints/options/main.ts`
- **Verified:** `npm run typecheck` -> pass; `npx eslint src/entrypoints/popup/main.ts src/entrypoints/options/main.ts` -> pass
- **Commit:** uncommitted, proposed "feat(ui): show the raw status text in the popup and history"
- **Open issues:** none
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(ui): show the raw status text in the popup and history
```

## 2026-11-23 - Step 4: Lead each guide entry with the Spanish name and an English gloss

- **Status:** done
- **Changed:** `src/entrypoints/statuses/main.ts`, `src/entrypoints/shared/pages.css`
- **Verified:** `npm run typecheck` -> pass; `npx eslint src/entrypoints/statuses/main.ts` -> pass; `npx prettier --check` on both files -> pass
- **Commit:** uncommitted, proposed "feat(statuses): lead guide entries with the Spanish name and a gloss"
- **Open issues:** none
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
feat(statuses): lead guide entries with the Spanish name and a gloss
```

## 2026-11-23 - Phase 1: Switch every status name to the raw text

- **Status:** done
- **Steps:** 1 done; 2 done; 3 done; 4 done
- **File check:** pass (8 changed files, each in its step's Files; only other change is this spec folder)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck` -> pass (25 files, 461 tests)
- **Commit proposal:** one commit for steps 1-3 (status name from the site's text), one for step 4 (guide), one for the spec folder
- **Open issues:** E2E not run; expected red on status names and baselines until phases 3 and 4 (accepted)

## 2026-11-23 - Step 5: Delete displayStatus and its unit tests

- **Status:** done
- **Changed:** `src/core/statuses.ts`, `tests/statuses.test.ts`
- **Verified:** `npx vitest run tests/statuses.test.ts` -> pass (31); `npm run typecheck` -> pass; `grep -rn displayStatus src tests e2e` -> no output
- **Commit:** uncommitted, proposed "refactor(statuses): remove the unused displayStatus helper"
- **Open issues:** none
- **Run by:** implement-phase (builder subagent, model sonnet)
- **Proposed commit (builder):**

```
refactor(statuses): remove the unused displayStatus helper
```

## 2026-11-23 - Phase 2: Remove displayStatus

- **Status:** done
- **Steps:** 5 done
- **File check:** pass (2 changed files, both in step 5's Files; plus the orchestrator's plan.md)
- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck` -> pass (25 files, 458 tests)
- **Commit proposal:** one commit for step 5, one for the plan and progress updates
- **Open issues:** E2E still expected red until phases 3 and 4 (accepted)
