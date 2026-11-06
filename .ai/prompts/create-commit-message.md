# Prompt: create-commit-message

Canonical, tool-neutral prompt. Wrapped by `.claude/commands/create-commit-message.md` and `.github/prompts/create-commit-message.prompt.md`.
Edit **this** file, not the wrappers.

Create one Conventional Commits message for the currently staged changes.

Run `git diff --cached --stat` and `git diff --cached` to inspect what is staged. If nothing is staged, say so and stop.

# Rules

- Format: `type(scope): subject`
- Allowed types: feat, fix, docs, chore, refactor, test, perf, ci, build, style, revert.
- Imperative mood, lowercase subject, no trailing period, full line <= 100 characters.
- If several unrelated changes are staged, summarise the most impactful one.
- Return only the commit message line — no quotes, no markdown, no extra text.

Do not commit. The user commits manually.
