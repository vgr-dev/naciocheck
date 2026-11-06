# AGENTS.md — repository conventions

Read this before changing anything.

## The project in one paragraph

_TODO (architect, first session): what nationality-status is, who it is for, and what it must never do._

## Stack and commands

_TODO: language, framework, how to install, run, test, lint and build._

| Task | Command |
| --- | --- |
| Install | _TODO_ |
| Test | _TODO_ |
| Lint | _TODO_ |
| Build | _TODO_ |

## How work happens here: spec-driven, two agents

No change to application code happens without an **active plan**.

| Role | How to start it | Writes |
| --- | --- | --- |
| **architect** — plans with the user, reviews, signs off | `claude --agent architect` | only `.ai/`, `AGENTS.md`, `README.md` |
| **builder** — executes one phase of the active plan, commits, stops | `claude --agent builder`, or delegated by the architect | code + its plan's progress sections |

Agent definitions: `.claude/agents/`. Plan lifecycle and the evidence standard: `.ai/rules/plans.md`.
Plan template: `.ai/templates/plan.md`.

```
.ai/plans/pending/   → drafts and approved plans in the queue
.ai/plans/active/    → the one plan being built (at most one)
.ai/plans/finished/  → signed-off plans with an Archive Metadata footer
```

A plain session (no `--agent`) follows the same rules: check `.ai/plans/active/` before starting work,
and if a request is not covered by the active plan, say so and propose drafting a plan instead.

## Settled decisions — do not undo these

Each was decided deliberately and is documented in `.ai/plans/finished/`. If you think one is wrong,
raise it with the user rather than silently reverting it.

| Decision | Rationale | Plan |
| --- | --- | --- |
| _none yet_ | | |

## Verification culture

Evidence is recorded, not asserted. Capture the exact command and its output in the plan, state what you
did _not_ verify, and never tick a checkbox for partial work.
