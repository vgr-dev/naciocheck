# 0001. Spec-driven AI agent workflow

- **Status:** accepted
- **Date:** 2026-11-18

## Context

AI coding agents are used in this repo. Their instructions and working memory must live in files
under version control, independent of any one tool, so sessions can be restarted and tools swapped.

## Decision

- `AGENTS.md` is the single instructions file. `CLAUDE.md` contains only `@AGENTS.md`. Tool-specific
  instruction files are merged into it.
- Features are worked through `specs/<YYYY-MM-DD>-<slug>/` with `spec.md`, `plan.md`, `progress.md`
  and, for large reviews, `review.md`. The date is the creation date. `spec.md` carries
  `status: draft | active | done | abandoned`. `plan.md` opens with a `## Status` checklist (one line
  per step: todo, in progress, done, deferred or blocked, plus `uncommitted` or the commit hash);
  it is the only part of the plan that changes after sign-off. `progress.md` holds the evidence.
- Three roles hand off through those files in fresh sessions: architect (spec to plan), builder
  (one plan step at a time, logging to `progress.md`), reviewer (adversarial check of the diff).
- Plans may group independent steps into phases, each with a `Phase verify` line (the full check
  run after the phase). `/implement-phase` is an orchestrator: it runs a phase's `builder`
  subagents in parallel in one working tree, is the only writer of `plan.md` Status and
  `progress.md`, and proposes the commits. A phase is committed before the next starts.
  `/implement-step` still builds a single step.
- A human signs off the plan before building and approves every commit.
- Architecture decisions are recorded in `docs/adr/`.
- Tool-side auto-memory is not relied upon.

## Consequences

- Any agent that reads `AGENTS.md` can take any role.
- Stalled work is visible by folder date and `status`; `/spec-status` reports specs older than the
  configured threshold.
- Role definitions and commands are global (dotfiles), not per repo.
