# Progress: Prepare the v1.0.0 release

## 2026-11-25 - Step 14: Record the branch, fix and release rules (ADR 0008, amend ADR 0005)

- **Status:** done
- **Branch:** `docs/branching-rules` (from `main` at `ca2d8fc`)
- **Changed:** `docs/adr/0008-branches-fixes-and-releases.md` (new), `docs/adr/0005-distribution-and-public-pages.md`
  (amendment "the repository is public before the first release"), `AGENTS.md` (Rules index range
  `0002`…`0008`; new "Branches and releases" section), `CONTRIBUTING.md` ("Make a change": branch names,
  changelog rule, a maintainers paragraph linking `docs/release.md`)
- **Verified:** `npx prettier --check` on the four files -> pass; `npx vitest run tests/licence.test.ts` -> pass
  (13 tests); `grep -n '0008' AGENTS.md` -> lines 60 and 67; the ADR 0005 amendment heading -> line 217.
- **Commit:** uncommitted, proposed "docs: record branch, fix and release rules in ADR 0008"
- **Run by:** implement-phase (builder subagent, model Opus 5.5)
- **Proposed commit (builder):**

```
docs: record branch, fix and release rules in ADR 0008
```

- **Open issues:** The `docs/release.md` link in `CONTRIBUTING.md` is broken until Phase 1 step 4 creates
  the file (allowed by the plan). `release/v<version>` is named only in the maintainers paragraph of
  `CONTRIBUTING.md`, not in the contributor branch list.

## 2026-11-25 - Phase 0: Branch and release rules

- **Status:** done
- **Steps:** 14 done
- **File check:** pass (changed: `AGENTS.md`, `CONTRIBUTING.md`, `docs/adr/0005-distribution-and-public-pages.md`,
  new `docs/adr/0008-branches-fixes-and-releases.md`; all in step 14's Files; baseline untracked
  `brand/social-preview.png` and the spec folder unchanged by the builder)
- **Phase verify:** `npm run format:check && npm run lint && npm test && git branch --show-current` -> pass
  (format and lint exit 0; unit 42 files / 1696 tests and worker 2 files / 31 tests pass; branch
  `docs/branching-rules`)
- **Commit proposal:** (1) `docs: record branch, fix and release rules in ADR 0008`; (2) `docs: add the v1.0.0
release spec and plan` (spec folder; `brand/social-preview.png` stays untracked until step 13 on
  `release/v1.0.0`)
- **Open issues:** PR 0 must be merged before `release/v1.0.0` is created from `main` for Phase 1.
