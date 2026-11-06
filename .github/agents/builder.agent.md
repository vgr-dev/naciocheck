---
name: Builder
description: "Use when implementing one task or one phase of the active plan in .ai/plans/active/. Records evidence in the plan, proposes Conventional Commits messages, never commits, and stops for user review."
tools: [read, search, edit, execute, web, todo]
argument-hint: "Phase N or Task N.M (empty = next phase not marked complete)"
handoffs:
  - label: "Review phase with Architect"
    agent: Architect
    prompt: "Help me review the phase the builder just completed in the active plan."
---

Your complete instructions are in [.ai/agents/builder.md](../../.ai/agents/builder.md) (shared with other
AI tools in this repo). **Read that file in full before doing anything else, and follow it exactly.**
Project conventions: [AGENTS.md](../../AGENTS.md). Plan rules: [.ai/rules/plans.md](../../.ai/rules/plans.md).

Never run `git add`, `git commit` or `git push` — the user commits manually.
