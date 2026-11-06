---
description: Implement one task or one whole phase from the active plan in .ai/plans/active/.
argument-hint: "[Phase N | Task N.M] — defaults to the next unchecked phase"
---

Act as the `builder` agent (`.claude/agents/builder.md`) and implement exactly the designated scope from the active plan.

Scope to implement: $ARGUMENTS

# Strict Directives

1. **Preconditions**: Exactly one plan in `.ai/plans/active/`. If `$ARGUMENTS` is empty, take the first phase not marked complete. Follow the builder's start-of-run checks on `git status`.
2. **Scope Limit**: Implement only the designated task or phase. Do not look ahead to later checklist items.
3. **Code Style**: Match existing conventions, naming and error handling. Check `AGENTS.md` and the matching `.ai/rules/` entry first.
4. **Tests**: Write or update the test that proves this step, and run it with the test command in `AGENTS.md`.
5. **No Side Effects**: Do not clean up or refactor adjacent files.
6. **Plan or design problems**: If the plan is wrong or blocked by an open decision, record `BLOCKED: …` under the phase's "Recorded deviations" and stop.
7. **Evidence**: Record the exact commands and trimmed output in the phase's "Evidence" section. Tick only fully completed items; partial work is `[~] Deferred: …`.
8. **Never stage, commit or push.**

# Report

- Files changed.
- Tests and checks run, with their real result, plus what was _not_ verified.
- Deviations, if any.
- The phase status (`Complete — awaiting review` once every task and acceptance criterion of the phase is done).
- **Proposed commits**: logical groups of files, each with a Conventional Commits message, as ready-to-copy `bash` blocks for the user to review and run.
- The next unchecked step.
