---
status: active # draft | active | done | abandoned
created: 2026-11-25
status-date: 2026-11-25
---

# GitHub CI, release artifacts and public-repo hardening

## Goal

Every push and pull request to `vgr-dev/naciocheck` runs the project's fast checks on GitHub Actions, and a
version tag produces the browser packages as a draft GitHub Release, so the owner uploads to the stores from
a reproducible, checksummed build instead of a local one. Because the repository is about to become public,
workflows must be safe to run on pull requests from strangers: no secrets in reach, least-privilege tokens,
pinned actions, and repository settings that require approval before outside code runs. The settings are
documented as a checklist and checked by a read-only script, so drift is visible.

## Scope

- **CI workflow** on `pull_request` and `push` to `main`, on `ubuntu-latest` with Node from `.nvmrc`
  and `npm ci`: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build:chrome`, `npm run build:firefox`, `npm run check:privacy`, `npm run check:site`.
  No E2E (Chrome or visual) in CI; those stay local.
- **Release workflow**, started only by hand (`workflow_dispatch`, accepted only on `main`): it reads `version`
  from `package.json`, fails if tag `v<version>` or a release for it already exists, runs the same checks,
  then `npm run zip` and `npm run zip:sources`, writes a SHA-256 checksum file and creates a **draft** GitHub
  Release `v<version>` targeting the checked-out commit, with the three zips and the checksums attached, using
  the preinstalled `gh` CLI. The tag is created when the owner publishes the draft. No tag-push trigger.
- **Workflow hardening:**
  - top-level `permissions: {}`, granting each job only what it needs (`contents: read` for CI,
    `contents: write` only for the release job);
  - `pull_request` only, never `pull_request_target` or `workflow_run` acting on PR code;
  - every action pinned to a full commit SHA, with the version in a comment, and only GitHub-owned actions
    (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact` if needed);
  - `persist-credentials: false` on checkout;
  - no untrusted `${{ github.event.* }}` interpolated into `run:` scripts;
  - a `concurrency` group that cancels superseded runs;
  - job `timeout-minutes`;
  - no repository or environment secrets;
  - workflows linted with `actionlint` and audited with `zizmor`, both in CI and runnable locally. Each tool is
    a pinned, checksum-verified release or a digest-pinned image, not a third-party action.
- **Dependabot** for `github-actions` only (weekly; keeps the SHA pins current). No npm update PRs.
- **Public-repo settings checklist** in `docs/github-settings.md`, applied by the owner in the GitHub UI after
  the visibility change:
  - Actions:
    - allow only GitHub-owned actions;
    - require SHA pinning;
    - default `GITHUB_TOKEN` read-only;
    - Actions may not create or approve PRs;
    - fork PR workflows need approval for all outside contributors.
  - A `main` ruleset with no bypass actors, applying to the owner too:
    - every change goes through a pull request; 0 required approvals, since the owner is the only maintainer
      and only people with write access can merge;
    - the CI checks must pass and the branch must be up to date;
    - squash merges only, linear history;
    - no force push, no deletion;
    - conversations resolved before merging.
  - A tag ruleset for `v*`: only the release flow creates tags; no update or deletion.
  - Security: private vulnerability reporting (`SECURITY.md` already points to it), secret scanning, push
    protection, Dependabot alerts.
  - General: wiki off, delete branch on merge, allowed merge methods.
- **Read-only verification script** (`scripts/check-github-settings.mjs` or similar) that reads the settings
  through `gh api` and reports each one that differs from the checklist. It never writes to GitHub.
- **Contribution flow:** `CONTRIBUTING.md` (branch, PR, CI, squash merge, fake data only, contributions
  under GPL-3.0-or-later) and a PR template that asks for the checks and confirms no personal data. AGENTS.md
  `Workflow` changes from "the user commits" on `main` to "agents propose the message, the user commits on a
  branch and opens the PR". The commit format applies to the squash-merge title.
- README and AGENTS.md mention CI, the release workflow and the settings checklist. `SECURITY.md` updated only
  if its wording no longer matches.

## Non-goals

- Deploying the site (`npm run deploy:site`), uploading to AMO or the Chrome Web Store, or publishing the
  draft release. All stay the owner's.
- Releases triggered by a tag push or on a schedule.
- Changing repository visibility or applying the settings; the owner does both.
- Running E2E or visual baselines in CI.
- Dependabot npm update PRs, auto-merge, or any bot write access.
- Third-party (non-GitHub-owned) actions, self-hosted runners, caches shared with PR runs that could poison
  the release build.
- Signing the packages, provenance attestations or SBOMs (possible later spec).

## Relevant files

- `package.json`: the npm scripts the workflows call; `version` the tag must match.
- `.nvmrc`: Node version for `actions/setup-node`.
- `scripts/check-privacy.mjs`, `scripts/check-site.mjs`: offline gates CI runs.
- `wxt.config.ts`: zip output names under `.output/`.
- `SECURITY.md`: refers to private vulnerability reporting.
- `README.md`, `AGENTS.md`: documentation of commands and boundaries.
- `docs/adr/0005-distribution-and-public-pages.md`, `docs/adr/0007-testing-strategy.md`: distribution and
  testing decisions the workflows must respect.
- `docs/pre-release-audit-2026-11-18.md`: AUD-04 (history exposure accepted) and the release sign-off.

## Constraints (do not touch)

- No workflow reaches the live sede, reCAPTCHA or any personal data; CI network use is limited to GitHub, the
  npm registry and what `npm ci` fetches.
- No new manifest permission, host pattern or `scripts/allowed-urls.json` entry; no test-only build flags.
- No change to `package.json` dependencies. The workflow actions and Dependabot config need explicit
  approval, as for a dependency.
- No secrets are added to the repository or its environments.
- Agents never run a workflow-dispatch, push a tag, change repository settings or visibility, or publish a
  release.
- `tests/fixtures/` stays byte-for-byte; fake identities only.

## Acceptance criteria

- [ ] A PR from a branch runs the CI workflow; every listed check passes on the current `main`.
- [ ] Introducing a format, lint, type, test or privacy failure on a branch makes CI fail at that step.
- [ ] The CI job's token has only `contents: read`; no workflow uses `pull_request_target` or reads a secret.
- [ ] Every `uses:` is a GitHub-owned action pinned to a 40-character SHA; a local check (test or script)
      fails if one is not.
- [ ] Running the release workflow by hand in a throwaway repo produces a draft release `v<version>` with the
      Chrome, Firefox and sources zips and a checksum file whose hashes match the files. A second run for an
      existing tag or release fails before building, and so does a run on any ref other than `main`.
- [ ] `actionlint` and `zizmor` report no findings on the workflows, locally and in CI.
- [ ] Dependabot config covers `github-actions` only.
- [ ] `docs/github-settings.md` lists each setting with where to set it and why, including the `main` and `v*`
      rulesets.
- [ ] `CONTRIBUTING.md`, the PR template and the AGENTS.md workflow describe the branch-and-PR flow.
- [ ] The verification script runs against the private repo, reports which settings are unavailable until
      public, and exits non-zero on drift; it makes only GET requests.
- [ ] `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm test` pass locally.

## Open questions

- None. Settled 2026-11-25: PRs required for everyone on `main` without bypass; `actionlint` and `zizmor`
  approved; releases only through the manual button.
