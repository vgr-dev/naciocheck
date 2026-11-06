---
description: Generate one Conventional Commits message for the staged changes.
disable-model-invocation: true
---

Create one Conventional Commits message for the currently staged changes.

Run `git diff --cached --stat` and `git diff --cached` to inspect what is staged. If nothing is staged, say so and stop.

# Rules

- Format: `type(scope): subject`
- Allowed types: feat, fix, docs, chore, refactor, test, perf, ci, build, style, revert.
- Imperative mood, lowercase subject, no trailing period, full line <= 100 characters.
- If several unrelated changes are staged, summarise the most impactful one.
- Return only the commit message line — no quotes, no markdown, no extra text.

Do not commit. The user commits manually.
