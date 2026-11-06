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
| **architect** — plans with the user, assists review, archives | `claude --agent architect` | only `.ai/`, `AGENTS.md`, `README.md` |
| **builder** — executes one phase of the active plan, proposes commits, stops | `claude --agent builder`, or delegated by the architect | code + its plan's progress sections |

**No agent ever stages, commits or pushes.** The user reviews and commits every change by hand. Each
finished phase ends with proposed Conventional Commits messages for the user to review and run.

Slash commands (`.claude/commands/`):

| Command | Does |
| --- | --- |
| `/create-plan <requirement>` | architect drafts a plan into `.ai/plans/pending/` |
| `/implement-step [Phase N \| Task N.M]` | builder implements one task or phase of the active plan |
| `/create-commit-message` | one Conventional Commits line for what you staged (user-invoked only) |

Agent definitions: `.claude/agents/`. Plan lifecycle and the evidence standard: `.ai/rules/plans.md`.
Plan template: `.ai/templates/plan.md`.

Plans are **local only**: `.ai/plans/` is git-ignored (except the `.gitkeep` placeholders).

```
.ai/plans/pending/   → drafts and approved plans in the queue
.ai/plans/active/    → the one plan being built (at most one)
.ai/plans/finished/  → signed-off plans with an Archive Metadata footer
```

A plain session (no `--agent`) follows the same rules: check `.ai/plans/active/` before starting work,
and if a request is not covered by the active plan, say so and propose drafting a plan instead.

## Settled decisions — do not undo these

Each was decided deliberately. Plans are local-only, so this table is the **tracked** record: keep the
rationale here, self-contained (the plan name is only a local pointer). If you think one is wrong,
raise it with the user rather than silently reverting it.

| Decision | Rationale | Plan |
| --- | --- | --- |
| _none yet_ | | |

## Verification culture

Evidence is recorded, not asserted. Capture the exact command and its output in the plan, state what you
did _not_ verify, and never tick a checkbox for partial work.
