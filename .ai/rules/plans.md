# Plans — lifecycle and evidence standard

## Folders

| Folder | Holds | Who moves plans in |
| --- | --- | --- |
| `.ai/plans/pending/` | Drafts and approved plans waiting their turn | architect (creates) |
| `.ai/plans/active/` | **At most one** plan, being built | architect, on user request |
| `.ai/plans/finished/` | Signed-off plans with the Archive Metadata footer | architect, after review |

Each folder keeps a `.gitkeep`. **Do not delete it** — git does not track empty directories.

File names: `YYYY-MM-DD-<short-slug>.md`, dated on creation. Template: `.ai/templates/plan.md`.
Always move plans with `git mv` so history follows them.

## Status values

Plan header: `Draft` → `Approved` → `Active` → `Finished`.
Phase line: `Not started` → `Complete — awaiting review` → `Accepted` (or `Rework requested` / `Blocked`).

## The evidence standard

This repository records evidence; it does not assert it.

- Capture the **exact command and its output** (trimmed to what matters). State explicitly what was
  _not_ verified and why.
- "Recorded deviations", "Correction" and "Deferred" notes are the expected norm, not noise.
- **Never tick a checkbox for partial work.** Mark it `[~] Deferred: …` and say what is missing.
- **Never rewrite earlier recorded output** to match a new path, name or state. Add a dated
  `Correction (YYYY-MM-DD): …` note instead.
- A plan may be finished with deferred criteria only with explicit user confirmation, recorded in the footer.

## Archiving

When moving a plan to `finished/`, append:

```markdown
---

## Archive Metadata

- **Completed Date**: YYYY-MM-DD
- **Verified Commit**: <short-hash>
- **Sign-off**: Manual Review Passed
- **Deferred**: none | <list, with user confirmation date>
```

In-body paths may still read `.ai/plans/active/...` after the move — that is deliberate, because some sit
inside recorded output. Do not rewrite them.
