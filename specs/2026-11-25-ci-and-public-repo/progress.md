# Progress: GitHub CI, release artifacts and public-repo hardening

## 2026-11-25 - Step 1: Add the workflow policy check

- **Status:** done
- **Changed:** `scripts/check-workflows.mjs`, `scripts/check-workflows.d.mts`,
  `tests/check-workflows.test.ts`, `package.json` (scripts only: `check:workflows`)
- **Verified:** `npx vitest run tests/check-workflows.test.ts` -> pass (53 tests, an accept and a reject
  case per rule); targeted eslint and prettier -> pass; `npm run check:workflows` -> exit 0 ("no .github/
  directory, nothing to check").
- **Commit:** uncommitted, proposed "feat: add an offline workflow policy check"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
feat: add an offline workflow policy check
```

- **Open issues:** The `secrets.` and untrusted-expression rules also match comments, so the comments in steps
  5 and 6 must not mention those strings (`github.event_name` is allowed). Stricter than the plan: a
  workflow with no `jobs:` fails, `secrets: inherit` fails, and `dependabot.yml` must contain at least one
  `github-actions` entry.

## 2026-11-25 - Step 2: Add the read-only GitHub settings check

- **Status:** done
- **Changed:** `scripts/check-github-settings.mjs`, `scripts/check-github-settings.d.mts`,
  `tests/check-github-settings.test.ts`
- **Verified:** `npx vitest run tests/check-github-settings.test.ts` -> pass (56 tests, including the
  source guard against write flags and methods); targeted eslint and prettier -> pass. No `gh` call made.
- **Commit:** uncommitted, proposed "feat: add read-only GitHub settings check script"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
feat: add read-only GitHub settings check script
```

- **Open issues:** 27 setting ids in `EXPECTED_SETTINGS`; step 3 must use them exactly. Q2 needs two
  `refs/tags/v*` rulesets, since one ruleset has a single bypass list: creation restricted with Repository
  admin as the only bypass, and update and deletion restricted with no bypass. Step 3 documents both. To
  confirm in step 10: the admin role `actor_id` 5, the rulesets list shape, and whether `gh api --include`
  prints the status on non-2xx. `compareSettings` returns an extra `errors` list (non-403/404 failures),
  which exits 1, so a bad login cannot pass as unavailable. A 404 on `dependabot-alerts` counts as drift.

## 2026-11-25 - Phase 1: Local policy and settings checkers

- **Status:** done
- **Steps:** 1 done; 2 done
- **File check:** pass
- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows`
  -> pass (39 files, 1608 tests; `check:workflows` exit 0 with no workflows)
- **Commit proposal:** `feat: add an offline workflow policy check`;
  `feat: add a read-only GitHub settings check`; `docs: start the CI spec and log phase 1`
- **Open issues:** Q2 now needs two tag rulesets (see step 2); step 10 confirms the admin role id and the
  behaviour of `gh api --include` on errors.

## 2026-11-25 - Step 3: Write the public-repo settings checklist

- **Status:** done
- **Changed:** `docs/github-settings.md`, `tests/github-settings-doc.test.ts`
- **Verified:** `npx vitest run tests/github-settings-doc.test.ts` -> pass (8 tests: every script id
  documented once, in order and in the right section, no extra id, Where/Expected/Why per entry, required
  checks `checks` and `workflow-lint`, the two tag rulesets); targeted eslint and prettier -> pass.
- **Commit:** uncommitted, proposed "docs: add the public-repo GitHub settings checklist"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
docs: add the public-repo GitHub settings checklist
```

- **Open issues:** The GitHub UI paths and labels (for example Settings > Advanced Security) come from the
  builder's knowledge, not a live check; step 10 confirms them. The tag rule is two `refs/tags/v*`
  rulesets: `v-tags-create` (creation, Repository admin bypass, `actor_id` 5 to confirm in step 10) and
  `v-tags-protect` (update and deletion, no bypass). The apply order puts the `main` ruleset last, after CI
  has run once so its checks can be picked.

## 2026-11-25 - Step 4: Add the pinned actionlint and zizmor runner

- **Status:** done
- **Changed:** `scripts/lint-workflows.mjs`, `package.json` (scripts only: `lint:workflows`)
- **Verified:** targeted eslint and prettier -> pass; `npm run lint:workflows` -> exit 0 (downloaded and
  verified both tools, then "nothing to lint"; the rerun reused the cache). Changing the actionlint hash
  constant -> exit 1 with a checksum mismatch and nothing extracted; the file was restored byte-for-byte.
  A sample workflow outside the repo with `pull_request_target`, an unpinned action and an injection ->
  zizmor reported 9 findings and the run failed.
- **Commit:** uncommitted, proposed "feat: add a pinned actionlint and zizmor workflow lint runner"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
feat: add a pinned actionlint and zizmor workflow lint runner
```

- **Open issues:** Pins: actionlint v1.7.12 (`8aca8db9…a3d8`, from its checksums file, matched to the
  asset digest and the download) and zizmor v1.32.0 (`bb110cc7…957b`, from the asset digest, matched to
  the download). zizmor v1.33.x was under two weeks old. The tools download even when there is nothing to
  lint, and CI downloads them from github.com on every run because caching is banned. zizmor prints
  "(2 suppressed)" on a clean file without any config, which is its default.

## 2026-11-25 - Phase 2: Settings checklist and workflow linters

- **Status:** done
- **Steps:** 3 done; 4 done
- **File check:** pass
- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows`
  -> pass (both workflow commands exit 0 with nothing to check)
- **Commit proposal:** `docs: add the public-repo GitHub settings checklist`;
  `feat: add a pinned actionlint and zizmor workflow lint runner`;
  `docs: log phase 2 of the CI plan`
- **Open issues:** Step 10 confirms the UI paths in the checklist and the admin `actor_id`.
