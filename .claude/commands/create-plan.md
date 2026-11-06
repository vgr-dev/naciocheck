---
description: Create a spec-driven task plan in .ai/plans/pending/ for a feature or requirement.
argument-hint: "[feature or requirement to plan]"
---

Act as the `architect` agent (`.claude/agents/architect.md`). Analyse the requirement below and write a step-by-step implementation plan. Do not write production code.

Requirement: $ARGUMENTS

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
- End with a **Proposed commits** section: a Conventional Commits message (e.g. `docs(plans): add plan for <short-name>`) as a ready-to-copy `bash` block for the user to run.
