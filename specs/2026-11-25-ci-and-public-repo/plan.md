# Plan: GitHub CI, release artifacts and public-repo hardening

Spec: `spec.md`

**Sign-off:** Approved by Victor Gonzalez on 2026-11-25.

## Status

<!-- One line per step. Only this section changes after sign-off. Details and verification evidence go in progress.md. -->

**Phase 1: Local policy and settings checkers**

- [x] 1. Add the workflow policy check be9e4c9
- [x] 2. Add the read-only GitHub settings check a54020f

**Phase 2: Settings checklist and workflow linters**

- [x] 3. Write the public-repo settings checklist 0e5c968
- [x] 4. Add the pinned actionlint and zizmor runner 46e9a7e

**Phase 3: Workflows**

- [x] 5. Add the CI workflow and Dependabot config uncommitted
- [x] 6. Add the manual release workflow uncommitted

**Phase 4: Tie the workflows together**

- [ ] 7. Test the real workflows against the spec

**Phase 5: Contribution flow and documentation**

- [ ] 8. Add CONTRIBUTING.md and the PR template
- [ ] 9. Document CI, releases and the PR flow

**Phase 6: Acceptance**

- [ ] 10. Run the acceptance checks

## Fixed names (all steps use these)

- Workflow files: `.github/workflows/ci.yml` (`name: CI`) and `.github/workflows/release.yml`
  (`name: Release`); `.github/dependabot.yml`.
- CI job ids, which are also the required status check names in the `main` ruleset: `checks` and
  `workflow-lint`. Neither job sets a `name:` that differs from its id.
- The check list, in this order, run as separate steps in both `checks` (CI) and the release job:
  `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:chrome`,
  `npm run build:firefox`, `npm run check:privacy`, `npm run check:site`.
- npm scripts added: `check:workflows` (step 1) and `lint:workflows` (step 4). No dependency changes.
- Settings check: `node scripts/check-github-settings.mjs [owner/repo]` (no npm script; defaults to the
  `origin` remote).
- Release assets (confirm the zip names with a local `npm run zip:sources` in step 6):
  `naciocheck-<version>-chrome.zip`, `naciocheck-<version>-firefox.zip`, `naciocheck-<version>-sources.zip`,
  `naciocheck-<version>-SHA256SUMS.txt`.

## Running steps in parallel

- Steps in one phase share a working tree. `npm run build:*`, `zip*`, `check:privacy` and `check:site` all
  write `.output/`, so only Phase verify runs them, except step 6, which is alone in touching `.output/`
  in its phase (step 5 must not build).
- `package.json` is touched by steps 1 and 4 only, in different phases.
- Builders never write `plan.md` or `progress.md` (`/implement-phase` owns them).
- No step pushes, opens a PR, dispatches a workflow, creates a tag or release, or changes a repository
  setting. GitHub-side runs in step 10 are the owner's.

## Phase 1: Local policy and settings checkers

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows`;
  all pass, `check:workflows` reports that there are no workflows yet and exits 0.

### 1. Add the workflow policy check

- **Goal:** `scripts/check-workflows.mjs` exports pure functions that take a file name and its text and
  return a list of problems, and a CLI that applies them to every `.github/workflows/*.y{a,}ml` and to
  `.github/dependabot.yml`, exiting non-zero on any problem (exit 0 with a note when `.github/` is absent).
  No YAML dependency: line-based checks, since actionlint validates syntax. Rules, each with a negative test:
  - every `uses:` is either a local `./` path or `actions/checkout`, `actions/setup-node` or
    `actions/upload-artifact` at `@<40 lowercase hex>` followed by a `# v…` comment; tags, branches,
    short SHAs, `docker://` and other owners fail;
  - a top-level `permissions: {}` line exists;
  - no `pull_request_target` or `workflow_run` trigger;
  - no `secrets.` reference anywhere (use `github.token`);
  - no `${{ github.event.`, `github.head_ref` or `inputs.` expression anywhere;
  - every `actions/checkout` step has `persist-credentials: false` in its own `with:` block;
  - a top-level `concurrency:` block exists, and every job has `timeout-minutes:`;
  - no `cache:` key on `setup-node` and no `actions/cache`;
  - `dependabot.yml` lists only `package-ecosystem: "github-actions"` (or unquoted) entries.
    Follow the `check-privacy.mjs` pattern: a `.d.mts` declaration file and unit tests with inline YAML strings.
    Add `"check:workflows": "node scripts/check-workflows.mjs"` to `package.json`.
- **Files:** `scripts/check-workflows.mjs`, `scripts/check-workflows.d.mts`, `tests/check-workflows.test.ts`,
  `package.json` (scripts only)
- **Verify:** `npx vitest run tests/check-workflows.test.ts && npx eslint scripts/check-workflows.mjs tests/check-workflows.test.ts && npx prettier --check scripts/check-workflows.* tests/check-workflows.test.ts package.json && npm run check:workflows`;
  tests pass (one accept case and at least one reject case per rule), no lint or format findings, the CLI
  exits 0 with no workflows present.
- **Out of scope:** Writing any workflow; running actionlint or zizmor; adding a YAML parser.

### 2. Add the read-only GitHub settings check

- **Goal:** `scripts/check-github-settings.mjs` reads the repository's settings through `gh api --method GET`
  only and reports each one that differs from the spec's checklist, plus a separate list of settings that are
  unavailable (403/404 or plan-gated, e.g. rulesets, secret scanning and private vulnerability reporting on a
  private Free-plan repo). Exit 1 on drift, 0 otherwise (see Q3). Structure:
  - `EXPECTED_SETTINGS`: an exported array of `{ id, endpoint, describe }` with stable kebab-case ids
    (e.g. `actions-allowed-github-owned`, `actions-sha-pinning`, `workflow-token-read`,
    `actions-no-pr-approval`, `fork-pr-approval-all-outside`, `main-ruleset-*`, `tag-ruleset-*`,
    `private-vulnerability-reporting`, `secret-scanning`, `secret-scanning-push-protection`,
    `dependabot-alerts`, `wiki-off`, `delete-branch-on-merge`, `merge-squash-only`);
  - a pure `compareSettings(responses)` taking `{ [endpoint]: { status, body } }` and returning
    `{ drift: [...], unavailable: [...] }`;
  - a CLI that collects the responses with `execFileSync('gh', ['api', '--method', 'GET', …])` and prints
    one line per setting.
    Endpoint names and response shapes come from the GitHub REST docs (Actions permissions, selected actions,
    workflow permissions, fork PR contributor approval, rulesets, repository, private vulnerability reporting,
    vulnerability alerts), not from memory; record the doc URLs in a header comment. The `main` ruleset check
    covers: target `~DEFAULT_BRANCH` or `refs/heads/main`, active, no bypass actors, pull request with 0
    approvals and required conversation resolution, required status checks `checks` and `workflow-lint` with
    strict (up to date) policy, squash-only allowed merge method, linear history, non-fast-forward and deletion
    blocked. The `v*` tag ruleset follows Q2.
    Tests: fixtures for a fully compliant snapshot, one drift per setting group, and a 403/404 snapshot that
    lands in `unavailable`; plus a source test that the script contains no `-f`, `-F`, `--field`,
    `--raw-field`, `--input`, `-X` or any method other than `GET`.
- **Files:** `scripts/check-github-settings.mjs`, `scripts/check-github-settings.d.mts`,
  `tests/check-github-settings.test.ts`
- **Verify:** `npx vitest run tests/check-github-settings.test.ts && npx eslint scripts/check-github-settings.mjs tests/check-github-settings.test.ts && npx prettier --check scripts/check-github-settings.* tests/check-github-settings.test.ts`;
  all pass. Do not run the CLI against GitHub in this step (step 10 does).
- **Out of scope:** Any write to GitHub; an npm script; the checklist document.

## Phase 2: Settings checklist and workflow linters

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows`;
  all pass; both workflow commands report that there is nothing to check yet and exit 0.

### 3. Write the public-repo settings checklist

- **Goal:** `docs/github-settings.md` lists every setting in the spec's checklist, grouped as in the spec
  (Actions, `main` ruleset, `v*` tag ruleset, Security, General). Each entry gives its id from
  `EXPECTED_SETTINGS`, where to set it in the GitHub UI, the expected value and why. It says the owner
  applies it after the visibility change, which settings need the repo to be public, and how to run
  `node scripts/check-github-settings.mjs`. The required checks are named `checks` and `workflow-lint`.
  A test asserts every id in `EXPECTED_SETTINGS` appears in the document and the document names no id the
  script lacks.
- **Files:** `docs/github-settings.md`, `tests/github-settings-doc.test.ts`
- **Verify:** `npx vitest run tests/github-settings-doc.test.ts && npx eslint tests/github-settings-doc.test.ts && npx prettier --check docs/github-settings.md tests/github-settings-doc.test.ts`;
  all pass.
- **Out of scope:** Changing the script's ids (if one is wrong, stop and report); applying any setting.

### 4. Add the pinned actionlint and zizmor runner

- **Goal:** `scripts/lint-workflows.mjs` downloads the pinned release binaries of actionlint and zizmor for
  linux x64 (the only supported platform; others fail with a clear message) into
  `.cache/workflow-tools/<tool>-<version>/` (already git-ignored), verifies each archive's SHA-256 against a
  constant in the script before extracting, reuses a verified copy, then runs
  `actionlint -shellcheck= -pyflakes=` (see Q4) and `zizmor --offline` over `.github/` (or the file paths given
  as arguments), exiting non-zero on any finding. With no `.github/` it exits 0 with a note. Pins: the latest
  actionlint and zizmor releases at least two weeks old; take the actionlint hash from its
  `_checksums.txt` and the zizmor hash from the release asset's `digest` in `gh release view --json assets`
  (cross-check by hashing the download). Record both versions and hashes with their sources in a header
  comment. Add `"lint:workflows": "node scripts/lint-workflows.mjs"` to `package.json`.
- **Files:** `scripts/lint-workflows.mjs`, `package.json` (scripts only)
- **Verify:** `npx eslint scripts/lint-workflows.mjs && npx prettier --check scripts/lint-workflows.mjs package.json && npm run lint:workflows`;
  no findings, the tools download and verify once and the command exits 0. Then change one hash constant
  locally, confirm the run fails on the checksum, and restore it.
- **Out of scope:** Docker images; a zizmor config file or any ignore list (ask first); running against
  workflows that do not exist yet.

## Phase 3: Workflows

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows && npm run build:chrome && npm run build:firefox && npm run check:privacy && npm run check:site`;
  all pass with zero actionlint or zizmor findings.

### 5. Add the CI workflow and Dependabot config

- **Goal:** `ci.yml` runs on `pull_request` and on `push` to `main`, with top-level `permissions: {}` and
  `concurrency` grouped by workflow and ref, cancelling in-progress runs. Job `checks` (`ubuntu-latest`,
  `permissions: contents: read`, `timeout-minutes` around 20): checkout with `persist-credentials: false`,
  `setup-node` with `node-version-file: .nvmrc` and no cache, `npm ci`, then the fixed check list as separate
  named steps. Job `workflow-lint` (same permissions, about 10 minutes): checkout, setup-node, `npm ci`,
  `npm run check:workflows`, `npm run lint:workflows`. Actions pinned to full SHAs of their latest major
  release with a `# vX.Y.Z` comment; resolve each SHA with `gh api repos/actions/<name>/git/ref/tags/<tag>`
  (dereference annotated tags). `dependabot.yml`: version 2, one `github-actions` entry for `/`, weekly, with
  a `cooldown` (default-days 7) if zizmor asks for one, and no `npm` entry.
- **Files:** `.github/workflows/ci.yml`, `.github/dependabot.yml`
- **Verify:** `npm run check:workflows && npm run lint:workflows -- .github/workflows/ci.yml .github/dependabot.yml && npx prettier --check .github/workflows/ci.yml .github/dependabot.yml`;
  no problems or findings. Do not build in this step.
- **Out of scope:** The release workflow; running E2E in CI; secrets; any third-party action.

### 6. Add the manual release workflow

- **Goal:** `release.yml` runs only on `workflow_dispatch` (no inputs), with top-level `permissions: {}`,
  `concurrency: { group: release, cancel-in-progress: false }` and one job `release` with
  `permissions: contents: write` and a `timeout-minutes`. Steps, in order, all failing before any build:
  1. fail unless `GITHUB_REF` is `refs/heads/main`;
  2. checkout (`persist-credentials: false`), read `version` from `package.json` with `node -p`, require it
     to match `^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$`, expose it as a step output and pass it to later
     steps through `env:` (never interpolated into `run:`);
  3. with `GH_TOKEN: ${{ github.token }}` on that step only, fail if `gh release view "v$VERSION"` finds a
     release (draft included) or `gh api "repos/$GITHUB_REPOSITORY/git/ref/tags/v$VERSION"` finds the tag;
     any error other than a 404 fails closed.
     Then `setup-node` (no cache), `npm ci`, the fixed check list, `npm run zip`, `npm run zip:sources`,
     `sha256sum` of the three zips (bare file names) into the checksum file in `.output/`, and, with `GH_TOKEN`
     on that step only, `gh release create "v$VERSION" --repo "$GITHUB_REPOSITORY" --draft --target "$GITHUB_SHA"`
     with a fixed title and short notes pointing to `CHANGELOG.md`, attaching the four files. Confirm the zip
     names locally with `npm run zip:sources` and adjust the fixed names above if they differ.
- **Files:** `.github/workflows/release.yml`
- **Verify:** `npm run check:workflows && npm run lint:workflows -- .github/workflows/release.yml && npx prettier --check .github/workflows/release.yml && npm run zip:sources && ls .output/*.zip`;
  no problems or findings, and the three zip names match those the workflow attaches.
- **Out of scope:** A tag-push or scheduled trigger; publishing the release; signing, attestations or SBOMs;
  running the workflow on GitHub.

## Phase 4: Tie the workflows together

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows`;
  all pass.

### 7. Test the real workflows against the spec

- **Goal:** `tests/workflows.test.ts` reads the committed files and asserts: `check-workflows` reports no
  problems for each; the `run:` lines of the `checks` job in `ci.yml` and of the `release` job in
  `release.yml` contain the fixed check list in order, and CI runs no E2E script; `ci.yml` triggers are
  exactly `pull_request` and `push` to `main`; `release.yml` triggers are exactly `workflow_dispatch`; the CI
  job ids are `checks` and `workflow-lint` and `docs/github-settings.md` names both as required checks;
  `dependabot.yml` has only `github-actions`.
- **Files:** `tests/workflows.test.ts`
- **Verify:** `npx vitest run tests/workflows.test.ts && npx eslint tests/workflows.test.ts && npx prettier --check tests/workflows.test.ts`;
  all pass. Breaking a pin or removing a step from one workflow locally makes a test fail (then restore).
- **Out of scope:** Editing the workflows (if a test reveals a defect, stop and report).

## Phase 5: Contribution flow and documentation

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test`; all pass,
  including `tests/licence.test.ts`.

### 8. Add CONTRIBUTING.md and the PR template

- **Goal:** `CONTRIBUTING.md` covers: branch from `main`, open a PR, CI must pass (`checks`,
  `workflow-lint`), squash merge with a Conventional Commits title (the AGENTS.md format), fake identities
  only (never a real NIE, name or birth date; `tests/fixtures/` byte-for-byte), the project boundaries (no
  network requests, captcha never automated), first-time contributors' workflows wait for approval, security
  reports go through `SECURITY.md`, and contributions are licensed GPL-3.0-or-later. The PR template asks for
  a summary, the checks run locally (format, lint, typecheck, test, builds, privacy and site gates), and a
  checkbox confirming no personal data is included.
- **Files:** `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`
- **Verify:** `npx prettier --check CONTRIBUTING.md .github/PULL_REQUEST_TEMPLATE.md && npm run check:workflows`;
  both pass.
- **Out of scope:** Issue templates, a code of conduct, CODEOWNERS.

### 9. Document CI, releases and the PR flow

- **Goal:** `README.md` gains a short section on CI, the manual release workflow (draft release, checksums,
  owner publishes and uploads), `npm run check:workflows`, `npm run lint:workflows`, the settings checklist
  and `node scripts/check-github-settings.mjs`, and links `CONTRIBUTING.md`. `AGENTS.md`: `Commands` lists
  the two new npm scripts and the settings check; `Workflow` changes "Agents propose the message; the user
  commits." to "Agents propose the message; the user commits on a branch and opens the PR. The format applies
  to the squash-merge title."; `Boundaries` adds that agents never dispatch a workflow, push a tag, publish a
  release or change repository settings, and that a new workflow action or Dependabot ecosystem is asked for
  like a dependency. `SECURITY.md` changes only if its wording no longer matches (it currently does; the
  fallback for a missing button can stay). If Q1 is answered (a), add the ADR 0005 amendment it describes.
- **Files:** `README.md`, `AGENTS.md`, `SECURITY.md` (only if needed),
  `docs/adr/0005-distribution-and-public-pages.md` (only per Q1)
- **Verify:** `npx vitest run tests/licence.test.ts && npx prettier --check README.md AGENTS.md SECURITY.md docs/adr/0005-distribution-and-public-pages.md`;
  all pass.
- **Out of scope:** Changing ADR 0001 (the human still approves every commit); the site or store texts.

## Phase 6: Acceptance

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:workflows && npm run lint:workflows`;
  all pass, and every spec acceptance criterion has evidence in `progress.md` or is marked as pending on the
  owner.

### 10. Run the acceptance checks

- **Goal:** Evidence for every acceptance criterion. The agent runs the local parts:
  `node scripts/check-github-settings.mjs vgr-dev/naciocheck` against the private repo (GET only; it should
  list the plan-gated settings as unavailable and exit non-zero on the current drift), and maps each criterion
  to its test. The owner runs, and the agent records what the owner reports: push a branch and open a PR so
  CI runs green; a throwaway branch per failure type (format, lint, type, test, privacy) showing CI fails at
  that step; the release workflow in a throwaway repo (draft `v<version>` with four assets, then
  `sha256sum -c` on the downloaded files), a second run failing on the existing release, and a run from a
  non-`main` branch failing before the build.
- **Files:** none in the repo (evidence goes to `progress.md` through `/implement-phase`)
- **Verify:** `node scripts/check-github-settings.mjs vgr-dev/naciocheck; echo "exit $?"`; the output lists
  each setting as ok, drift or unavailable, and the script made only GET requests.
- **Out of scope:** Pushing, opening PRs, dispatching workflows, creating repos, changing settings or
  visibility, publishing a release. All are the owner's.

## Risks / open questions

- **Q1 (blocks step 6, answer before sign-off): ADR 0005 says "No unlisted or self-hosted releases."** A
  published GitHub Release with the zips attached makes installable packages downloadable outside the stores.
  Options: (a) amend ADR 0005 in step 9: GitHub Release assets are reproducibility and verification
  artefacts, not an install channel, and the README says to install from the stores; (b) keep releases as
  drafts only and never publish them (but then the tag is never created, which contradicts the spec); (c)
  publish the release without the browser zips, keeping only sources and checksums. Plan assumes (a).
- **Q2 (step 2 and 3): the `v*` tag ruleset.** The tag is created when the owner publishes the draft, which
  is an admin action in the UI. A ruleset that restricts creation with no bypass would block that. Plan
  assumes: restrict creation with Repository admin as the only bypass, and restrict update and deletion with
  no bypass. Confirm or say otherwise.
- **Q3 (step 2): unavailable settings.** Plan assumes settings that are unavailable on the private repo are
  listed separately and do not by themselves make the script exit non-zero; only drift does. Once public,
  every setting is available, so real drift still fails.
- **Q4 (step 4): shellcheck inside actionlint.** `ubuntu-latest` ships shellcheck and WSL may not, so results
  could differ between CI and local. Plan assumes actionlint runs with `-shellcheck= -pyflakes=` for
  identical results; zizmor covers template injection. Alternative: pin and download shellcheck too.
- **Single release job:** per the spec, the release job holds `contents: write` while `npm ci` runs
  install scripts. The token is only passed (as `GH_TOKEN`) to the two `gh` steps and is not persisted by
  checkout. A stricter split (build job with `contents: read`, publish job with `contents: write`) needs
  `actions/download-artifact`, which the spec does not list; ask before adding it.
- **`npm run zip` then `npm run zip:sources`** rebuilds the Chrome and Firefox zips twice. The spec names
  both, so both run; the second set overwrites the first with identical content.
- **Node download:** `setup-node` takes Node 24.22.1 from GitHub's runner toolcache or the
  `actions/node-versions` manifest and may fall back to nodejs.org. If a run shows a nodejs.org download, the
  builder reports it rather than working around it.
- **Line-based checks** in `check-workflows.mjs` can be fooled by unusual YAML (flow style, anchors). The
  workflows are written in plain block style, and actionlint and zizmor are the second line of defence.
- If zizmor reports a finding that needs an ignore or a config file, the builder stops and asks.
