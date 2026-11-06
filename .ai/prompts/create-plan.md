# Prompt: create-plan

Canonical, tool-neutral prompt. Wrapped by `.claude/commands/create-plan.md` and `.github/prompts/create-plan.prompt.md`.
Edit **this** file, not the wrappers.

Act as the architect (`.ai/agents/architect.md`). Analyse the requirement given by the user and write a step-by-step implementation plan. Do not write production code.

# Workflow

1. Determine today's date (`YYYY-MM-DD`) and read `AGENTS.md`, `.ai/rules/plans.md` and any `.ai/rules/` files relevant to the areas the plan will touch.
2. List `.ai/plans/active/`, `.ai/plans/pending/` and `.ai/plans/finished/` so the plan does not duplicate or contradict existing work or settled decisions.
3. Inspect the existing code and note the patterns the plan must follow. Research external facts when needed and cite the source in the plan.
4. If scope, constraints or non-goals are unclear, ask the user before writing. Record anything still unresolved under "Open decisions" — never guess.
5. Write the plan to `.ai/plans/pending/YYYY-MM-DD-<short-name>.md`, following `.ai/templates/plan.md` exactly (`Status: Draft`).
   - Phases small enough to review in one sitting; each independently verifiable.
   - Tasks numbered `N.M`, each with the reason it exists.
   - Acceptance criteria phrased as commands or observable checks with the expected result.
6. Report the plan path, a one-paragraph summary, and the open decisions that need the user.

# Rules

- Only write inside `.ai/`. Never stage, commit or push.
- Do not promote the plan to `active/`; that happens only when the user approves and asks.
- Plans are git-ignored, so a new plan needs no commit. Only if you also changed a tracked file (`AGENTS.md`, `.ai/rules/`, `.ai/templates/`), end with a **Proposed commits** section: message text only in a plain fenced block, no `git` commands, no `"` characters.
