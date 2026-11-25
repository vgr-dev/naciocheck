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

## 2026-11-25 - Step 5: Add the CI workflow and Dependabot config

- **Status:** done (the builder reported partial; it was completed after the step 4 follow-up fix below)
- **Changed:** `.github/workflows/ci.yml`, `.github/dependabot.yml`
- **Verified:** `npm run check:workflows` -> pass; `npx prettier --check` on both files -> pass;
  `npm run lint:workflows -- .github/workflows/ci.yml .github/dependabot.yml` -> fail at first (actionlint
  parsed `dependabot.yml` as a workflow and reported 4 false errors), then pass after the fix (actionlint
  checked 1 file, zizmor 2 targets, no findings).
- **Commit:** uncommitted, proposed "ci: add the CI workflow and Dependabot config for actions"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
ci: add the CI workflow and Dependabot config for actions
```

- **Open issues:** Pins: `actions/checkout` v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1` and
  `actions/setup-node` v7.1.0 `949feb2413d6458794dcd2491c4babbbce0c15c1`. Both are the latest
  releases, both tags are lightweight, and both were cross-checked with the commits API. zizmor asked for a
  Dependabot cooldown, so `cooldown: default-days: 7` was added. Where `setup-node` gets Node from (the
  toolcache, or a nodejs.org fallback) is observed in step 10.

## 2026-11-25 - Step 4 follow-up: Give actionlint only workflow files

- **Status:** done (approved by the owner during Phase 3 to unblock step 5's Verify)
- **Changed:** `scripts/lint-workflows.mjs`
- **Verified:** targeted eslint and prettier -> pass; `npm run lint:workflows` with
  `ci.yml dependabot.yml`, with `dependabot.yml` alone (actionlint skipped with a note), with `release.yml`
  alone, with no arguments, and with `.github/` -> all exit 0, no findings; `npm run check:workflows` ->
  pass.
- **Commit:** uncommitted, proposed "fix: give actionlint only workflow files when paths are passed"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
fix: give actionlint only workflow files when paths are passed
```

- **Open issues:** none

## 2026-11-25 - Step 6: Add the manual release workflow

- **Status:** done
- **Changed:** `.github/workflows/release.yml` (and the git-ignored `.output/` from `npm run zip:sources`)
- **Verified:** `npm run check:workflows` -> pass; `npm run lint:workflows -- .github/workflows/release.yml`
  -> pass, no findings; prettier -> pass; `npm run zip:sources` -> pass; `ls .output/*.zip` ->
  `naciocheck-0.1.0-{chrome,firefox,sources}.zip`, the same names the workflow attaches.
- **Commit:** uncommitted, proposed "feat: add the manual draft release workflow"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
feat: add the manual draft release workflow
```

- **Open issues:** Same action SHAs as `ci.yml`. The job has `timeout-minutes: 30`. `GH_TOKEN` is set only
  on the existence-check step and the release step. The existence check treats only "release not found" or
  "HTTP 404" as absent and fails closed on any other error. Whether `gh release view` finds drafts and uses
  that wording is confirmed in step 10. The release notes say the files are for verification and store
  upload, which relies on the Q1(a) amendment to ADR 0005 that step 9 writes.

## 2026-11-25 - Phase 3: Workflows

- **Status:** done
- **Steps:** 5 done (after the follow-up fix); 6 done; follow-up to step 4 done
- **File check:** pass. `scripts/lint-workflows.mjs` is outside this phase's Files, but the owner approved
  the change as a step 4 follow-up.
- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows && npm run build:chrome && npm run build:firefox && npm run check:privacy && npm run check:site`
  -> pass (40 files, 1616 tests; zero actionlint or zizmor findings). Format, lint, typecheck,
  `check:workflows` and `lint:workflows` were rerun after the fix -> pass.
- **Commit proposal:** `fix: give actionlint only workflow files when paths are passed`;
  `ci: add the CI workflow and Dependabot config for actions`;
  `feat: add the manual draft release workflow`; `docs: record phase 2 hashes and log phase 3 of the CI plan`
- **Open issues:** Step 10 confirms how `gh release view` handles drafts and where Node is downloaded from.
  Step 9 must write the ADR 0005 amendment (Q1) before the release workflow is used.

## 2026-11-25 - Step 7: Test the real workflows against the spec

- **Status:** done
- **Changed:** `tests/workflows.test.ts`
- **Verified:** `npx vitest run tests/workflows.test.ts` -> pass (21 tests); targeted eslint and prettier ->
  pass; `npx tsc --noEmit -p .` -> pass. Negative checks: pinning `actions/checkout` to `@v7` in `ci.yml`
  -> 1 test failed; removing the privacy gate step from `release.yml` -> 1 test failed. Both files were
  restored byte-for-byte (`cmp`, `git diff --quiet .github/`).
- **Commit:** uncommitted, proposed "test: check the real workflows against the CI spec"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
test: check the real workflows against the CI spec
```

- **Open issues:** The tests reuse `workflowProblems` and `dependabotProblems`, and also check
  `REQUIRED_CHECKS` in the settings script against the CI job ids. `run:` extraction covers single-line
  commands only, and the trigger assertions depend on the current inline `branches: [main]` form. No
  workflow defect was found.

## 2026-11-25 - Phase 4: Tie the workflows together

- **Status:** done
- **Steps:** 7 done
- **File check:** pass
- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows`
  -> pass (41 files, 1637 tests; no workflow findings)
- **Commit proposal:** `test: check the real workflows against the CI spec`;
  `docs: record phase 3 hashes and log phase 4 of the CI plan`
- **Open issues:** none

## 2026-11-25 - Step 8: Add CONTRIBUTING.md and the PR template

- **Status:** done
- **Changed:** `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`
- **Verified:** `npx prettier --check CONTRIBUTING.md .github/PULL_REQUEST_TEMPLATE.md` -> pass;
  `npm run check:workflows` -> pass.
- **Commit:** uncommitted, proposed "docs: add CONTRIBUTING.md and a pull request template"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
docs: add CONTRIBUTING.md and a pull request template
```

- **Open issues:** The PR template asks for more confirmations than the plan listed: the project boundaries,
  a Conventional Commits PR title and GPL-3.0-or-later, alongside the summary, the checks and no personal
  data. Every command it cites exists in `package.json`, and it says E2E stays local.

## 2026-11-25 - Step 9: Document CI, releases and the PR flow

- **Status:** done
- **Changed:** `README.md`, `AGENTS.md`, `docs/adr/0005-distribution-and-public-pages.md`. `SECURITY.md`
  is unchanged because its wording still matches.
- **Verified:** `npx vitest run tests/licence.test.ts` -> pass (13 tests); `npx prettier --check` on the four
  files -> pass. The orchestrator confirmed that the ADR's claim about the `v*` tags matches the
  `v-tags-protect` ruleset in `docs/github-settings.md`.
- **Commit:** uncommitted, proposed "docs: document CI, releases and the PR flow"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
docs: document CI, releases and the PR flow
```

```
docs: amend ADR 0005 for release assets as verification only
```

- **Open issues:** The ADR 0005 amendment (Q1, option a) is dated 2026-11-25 and leaves the original
  decision text untouched. It says the stores remain the only install channel, and that publishing zips as
  an install channel would need a new amendment. AGENTS.md now says agents never dispatch a workflow, push
  a tag, publish a release or change repository settings, and treats a new workflow action or Dependabot
  ecosystem as a dependency change.

## 2026-11-25 - Phase 5: Contribution flow and documentation

- **Status:** done
- **Steps:** 8 done; 9 done
- **File check:** pass
- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test` -> pass (41 files,
  1637 tests, including `tests/licence.test.ts`)
- **Commit proposal:** `docs: add CONTRIBUTING.md and a pull request template`;
  `docs: amend ADR 0005 for release assets as verification only`;
  `docs: document CI, releases and the PR flow`;
  `docs: record phase 4 hashes and log phase 5 of the CI plan`
- **Open issues:** none

## 2026-11-25 - Step 10: Run the acceptance checks (local part)

- **Status:** partial (the local part is done; the GitHub-side runs are pending on the owner)
- **Changed:** none
- **Verified:** `node scripts/check-github-settings.mjs vgr-dev/naciocheck; echo "exit $?"` -> exit 1. First
  run: `1 ok, 7 drift, 18 unavailable, 1 error`. After the step 2 follow-up below:
  `1 ok, 7 drift, 19 unavailable, 0 error`.
  - Drift, expected until the owner applies the checklist: `actions-allowed-github-owned`,
    `actions-sha-pinning`, `workflow-token-read`, `actions-no-pr-approval`, `dependabot-alerts`,
    `delete-branch-on-merge`, `merge-squash-only`. `wiki-off` is ok.
  - Unavailable on the private Free repo: all 15 ruleset checks (403 "Upgrade to GitHub Pro or make this
    repository public"), `private-vulnerability-reporting` (404), `secret-scanning` and
    `secret-scanning-push-protection` (`security_and_analysis` is null), and `fork-pr-approval-all-outside`
    (422, after the fix).
  - The script made only GET requests, and so did the builder's read-only `gh api --method GET` probes.
- **Confirmed:** `gh api --include` keeps the `HTTP/2.0 <status>` line on 403, 404 and 422, so the status is
  read correctly. `gh release view` on a missing release prints `release not found`, and the missing tag ref
  prints `HTTP 404`; both match the greps in `release.yml`.
- **Acceptance criteria:**
  - **Covered locally:**
    - CI token, triggers and secrets: `tests/workflows.test.ts` and `tests/check-workflows.test.ts`.
    - SHA pinning: `check:workflows`, plus the step 7 negative check.
    - Dependabot scope: `tests/workflows.test.ts`.
    - Settings doc: `tests/github-settings-doc.test.ts`.
    - Settings script, GET-only and unavailable vs drift: the run above and the read-only source guard.
    - Local checks: the Phase 5 and Phase 6 verify runs.
    - Release workflow, statically: `tests/workflows.test.ts`, plus the zip names confirmed in step 6.
    - `CONTRIBUTING.md`, the PR template and AGENTS.md: written in steps 8 and 9, with no content test.
  - **Pending on the owner:**
    1. A PR with green `checks` and `workflow-lint`.
    2. Five throwaway branches (format, lint, type, test, privacy), each failing CI at the matching step.
    3. In a throwaway repo: a release run that creates a draft `v<version>` with four assets, then
       `sha256sum -c` on the downloads. A second run must fail on the existing release before the build. A
       run from a non-`main` branch must fail before the build.
    4. Whether `gh release view` finds an existing draft.
    5. The UI paths in `docs/github-settings.md`, and the admin `actor_id` 5 against a real ruleset.
    6. Whether `setup-node` downloads Node from nodejs.org.
- **Commit:** uncommitted, proposed "docs: log the local acceptance checks for step 10"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
docs: log the local acceptance checks for step 10
```

- **Open issues:** If `gh release view` did not find drafts, the release check would miss an existing draft;
  the tag check would still run. The throwaway-repo run settles this. A 404 on private vulnerability reporting
  cannot tell "off" from "plan-gated" until the repo is public.

## 2026-11-25 - Step 2 follow-up: Treat the private-repo 422 as unavailable

- **Status:** done (approved by the owner during Phase 6)
- **Changed:** `scripts/check-github-settings.mjs`, `tests/check-github-settings.test.ts`
- **Verified:** `npx vitest run` on the settings, settings-doc and workflows test files -> pass (89 tests);
  targeted eslint and prettier -> pass; `npm run typecheck` -> pass. The real check now shows
  `fork-pr-approval-all-outside` as unavailable: `1 ok, 7 drift, 19 unavailable, 0 error`, exit 1 on the
  real drift.
- **Commit:** uncommitted, proposed "fix: treat the private-repo 422 as unavailable in the settings check"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
fix: treat the private-repo 422 as unavailable in the settings check
```

- **Open issues:** The real 422 body puts the reason in `errors`, not `message`, so the script matches
  `/private repositor/i` in either, and only on status 422. Any other 422 still counts as an error.

## 2026-11-25 - Phase 6: Acceptance

- **Status:** partial (the local part is done; step 10 waits on the owner's GitHub-side runs)
- **Steps:** 10 partial (pending on owner); step 2 follow-up done
- **File check:** pass. The two changed files are the owner-approved step 2 follow-up; step 10 changed none.
- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows`
  -> pass (41 files, 1641 tests). Every acceptance criterion either has evidence above or is listed as
  pending on the owner.
- **Commit proposal:** `fix: treat the private-repo 422 as unavailable in the settings check`;
  `docs: record phase 5 hashes and log the local acceptance checks`
- **Open issues:** The six owner actions listed under step 10. Then the agent records the results, and step 10
  and the spec can close.

## 2026-11-25 - Review fix round 1 (review.md, FAIL)

The owner approved fixing all three findings and all four suggested follow-ups. Three builders ran in
parallel, one per group of files.

### Part A: Settings checker (findings 1 and 2, required-check source)

- **Status:** done
- **Changed:** `scripts/check-github-settings.mjs`, `scripts/check-github-settings.d.mts`,
  `tests/check-github-settings.test.ts`, `docs/github-settings.md`, `tests/github-settings-doc.test.ts`
- **Verified:** `npx vitest run` on the settings and settings-doc test files -> pass (96 tests); targeted
  eslint, prettier and `tsc` -> pass. Read-only real check: `2 ok, 7 drift, 20 unavailable, 0 error`, exit 1
  on owner-side drift.
- **Commit:** uncommitted, proposed "fix: tighten the GitHub settings check for tags, branch and checks"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
fix: require full v* tag coverage and Always allow bypass in settings check
fix: count the default-branch ruleset as main only when main is default
feat: require the main status checks to come from GitHub Actions
docs: document tag exclusions, default branch and check source settings
```

- **Open issues:** The changes:
  - **Tag rulesets:** they must include exactly `refs/tags/v*` (or `~ALL`) and exclude nothing.
  - **Creation bypass:** exactly one actor, `RepositoryRole` 5, with `bypass_mode: always`.
  - **Default branch:** `~DEFAULT_BRANCH` counts as `main` only when the repository's `default_branch` is
    `main`. A `main` ruleset that excludes `main` does not count.
  - **New settings:** `default-branch-main` and `main-ruleset-checks-from-actions`, which requires
    `integration_id` 15368, taken from a read-only `GET apps/github-actions`. That makes 29 settings.

  Still open: `actor_id` 5 is not in the docs and is confirmed only on a real ruleset. An exclude glob such as
  `refs/heads/ma*` is not read as excluding `main`, but any non-empty exclude is still drift.

### Part B: Release duplicate guard (finding 3, permission note)

- **Status:** done
- **Changed:** `.github/workflows/release.yml`, `tests/workflows.test.ts`
- **Verified:** `npm run check:workflows` -> pass; `npm run lint:workflows -- .github/workflows/release.yml`
  -> no findings; prettier and eslint -> pass; `npx vitest run tests/workflows.test.ts` -> pass (27 tests).
  zizmor's auditor persona went from 2 findings to 1; the remaining one is info-level `anonymous-definition`.
- **Commit:** uncommitted, proposed "fix: list releases through the REST API in the release duplicate guard"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
fix: list releases through the REST API in the release duplicate guard
```

- **Open issues:** The guard is
  `gh api --method GET --paginate repos/$GITHUB_REPOSITORY/releases --jq '... env.VERSION ...'`. A failed
  request stops the job, a match stops it, and only an empty result passes. The tag-ref check is unchanged.
  A comment documents `contents: write`. Still to confirm in the throwaway-repo runs: that gh's `--jq`
  accepts `env.VERSION` on a real match, and that the guard finds a draft. `name: release` would clear the
  info-level finding; it was left out because job ids are fixed.

### Part C: Docs wording and lint tool cache

- **Status:** done
- **Changed:** `README.md`, `CONTRIBUTING.md`, `scripts/lint-workflows.mjs`
- **Verified:** targeted eslint and prettier -> pass; `npx vitest run tests/licence.test.ts tests/brand.test.ts`
  -> pass (39 tests); `npm run lint:workflows -- .github/workflows/ci.yml` -> no findings.
  - Tampered binary: stub binaries in `.cache/` were replaced by the real ones on the next run.
  - Negative hash test: the run failed with nothing extracted, and the script was restored byte-for-byte.
- **Commit:** uncommitted, proposed "fix: extract the lint tool binaries from the verified archive each run"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
docs: say Release runs the eight checks job, not workflow-lint
docs: require approval for all outside contributor workflows
fix: extract the lint tool binaries from the verified archive each run
```

- **Open issues:** If the cached archive fails its hash and the network is down, the run fails. The old
  binary never runs on any path.

### Round check

- **File check:** pass. Every changed file is in its part's Files list. `review.md` is the reviewer's file.
- **Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows && npm run build:chrome && npm run build:firefox && npm run check:privacy && npm run check:site`
  -> pass (41 files, 1675 tests; no workflow findings).
- **Commit proposal:**
  - `fix: tighten the GitHub settings check for tags, branch and checks`
  - `fix: list releases through the REST API in the release duplicate guard`
  - `fix: extract the lint tool binaries from the verified archive each run`
  - `docs: align release checks and outside approval wording`
  - `docs: log the first review and its fix round for the CI spec`
- **Open issues:** Repeat the review (`/spec-review`). Step 10's owner-side runs are still pending. The spec
  stays active.

## 2026-11-25 - Review fix round 2 (review.md, re-review FAIL)

The owner approved fixing both re-review findings. Two builders ran in parallel on top of the uncommitted
round 1 changes.

### Part A: Layered tag creation rulesets (re-review finding 1)

- **Status:** done
- **Changed:** `scripts/check-github-settings.mjs`, `tests/check-github-settings.test.ts`,
  `docs/github-settings.md`
- **Verified:** `npx vitest run` on the settings, settings-doc and workflows test files -> pass (141 tests);
  targeted eslint, prettier and `tsc` -> pass. Read-only real check: `2 ok, 7 drift, 20 unavailable, 0 error`,
  exit 1 on owner-side drift. The tag settings are unavailable on the private repo, so the real check does not
  exercise the new logic yet.
- **Commit:** uncommitted, proposed "fix: require admin bypass on every layered v* tag creation ruleset"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
fix: require admin bypass on every layered v* tag creation ruleset
```

- **Open issues:** `tag-ruleset-creation-admin-bypass` now requires the admin role with Always allow on every
  active tag ruleset that could apply to `v*` tags and restricts creation; it ignores Evaluate and Disabled
  rulesets. When an include pattern can't be classified, the ruleset counts as applying, so the check can
  report false drift but never a false ok. The reviewer's snapshot now reports drift. `actor_id` 5 is still
  confirmed only on a real ruleset.

### Part B: Per-run extraction of the lint tools (re-review finding 2)

- **Status:** done
- **Changed:** `scripts/lint-workflows.mjs`
- **Verified:** targeted eslint and prettier -> pass; `npm run lint:workflows`, with no arguments and with
  `ci.yml dependabot.yml` -> no findings.
  - Parallel runs: 5 rounds of two runs, plus one round from a cold cache where both runs downloaded -> 12 of
    12 exit 0, with no `.tmp` or `naciocheck-lint-*` leftovers.
  - Negative hash test: the run failed with nothing extracted and no run directory left, and the script was
    restored byte-for-byte.
  - Stub binaries planted in the cache never ran.
- **Commit:** uncommitted, proposed "fix: extract lint tool binaries into a per-run temp directory"
- **Run by:** implement-phase (builder subagent, model Sonnet 5.5)
- **Proposed commit (builder):**

```
fix: extract lint tool binaries into a per-run temp directory
```

- **Open issues:** The archive cache is written atomically with a temp file and a rename. Each run extracts
  the binaries from the verified in-memory bytes into a `mkdtemp` directory, which is removed in `finally`.
  `fail()` now throws instead of calling `process.exit`, so cleanup runs on errors. A SIGKILL can still leave
  a temp directory behind.

### Round check

- **File check:** pass. Every changed file is in its part's Files list.
- **Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows && npm run build:chrome && npm run build:firefox && npm run check:privacy && npm run check:site`
  -> pass (41 files, 1693 tests; no workflow findings; no `naciocheck-lint-*` leftovers in `/tmp`).
- **Commit proposal:** rounds 1 and 2 are combined, because both are uncommitted in the same files:
  - `fix: tighten the GitHub settings check for tags, branch and checks`
  - `fix: list releases through the REST API in the release duplicate guard`
  - `fix: extract lint tool binaries from a verified archive per run`
  - `docs: align release checks and outside approval wording`
  - `docs: log both review rounds and their fixes for the CI spec`
- **Open issues:** Repeat the review (`/spec-review`). Step 10's owner-side runs are still pending.
