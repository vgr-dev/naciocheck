# Copilot instructions

This repository's conventions live in [AGENTS.md](../AGENTS.md) — read it first; it applies to every model
used through Copilot Chat. The essentials, in case it is not loaded:

- **Spec-driven work.** No application code changes without an active plan in `.ai/plans/active/`. If a
  request is not covered by it, say so and propose drafting a plan (`/create-plan`, Architect agent).
- **Roles.** Architect: [.ai/agents/architect.md](../.ai/agents/architect.md). Builder:
  [.ai/agents/builder.md](../.ai/agents/builder.md). Plan rules and evidence standard:
  [.ai/rules/plans.md](../.ai/rules/plans.md).
- **Never run `git add`, `git commit` or `git push`.** The user reviews and commits everything manually.
  Propose Conventional Commits messages as message text only — no `git` commands, no `"` characters.
- **Evidence, not assertions.** Record exact commands and their output in the plan; never tick a box for
  partial work.
