# Plan: <Feature title>

Spec: `spec.md`

**Sign-off:** <!-- Human fills this in: "Approved by <name> on YYYY-MM-DD". Builders must not start while blank. -->

## Status

<!-- One line per step, in step order. The only part of this file that changes after sign-off.
[ ] todo | [~] in progress | [x] done | [-] deferred | [!] blocked
After the title: `uncommitted`, a short commit hash, or the reason (deferred/blocked).
Never [x] for partial work. Details live in progress.md.
Group the lines by phase with a bold `**Phase N: <title>**` line, blank line between phases; step
numbers are global across phases.
No phase headings means every step is its own phase (`## Steps` as before). -->

**Phase 1: <Title of the first phase>**

- [ ] 1. <Short imperative title>
- [ ] 2. <Next step>

**Phase 2: <Title of the next phase>**

- [ ] 3. <Step that needs phase 1 done>

## Phase 1: <Title of the first phase>

- **Phase verify:** `<full test suite, lint, format check from AGENTS.md Commands>`; <what a pass looks like>

<!-- Steps in one phase are built in parallel: their Files must not overlap, neither may need the
other's output, and neither may touch shared generated files (lockfiles, migration numbering,
snapshots, route or barrel indexes). When in doubt, use separate phases. A step's Verify is scoped
to its own files or tests; the full suite runs in Phase verify. -->

### 1. <Short imperative title>

- **Goal:** <What is true after this step.>
- **Files:** `<path>`, `<path>`
- **Verify:** `<exact command from AGENTS.md Commands>`; <what a pass looks like>
- **Out of scope:** <What not to do here.>

### 2. <Next step>

- **Goal:**
- **Files:**
- **Verify:**
- **Out of scope:**

## Phase 2: <Title of the next phase>

- **Phase verify:** `<command>`; <what a pass looks like>

### 3. <Step that needs phase 1 done>

- **Goal:**
- **Files:**
- **Verify:**
- **Out of scope:**

## Risks / open questions

- <Anything the builder must stop and ask about.>
