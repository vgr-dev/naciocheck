# Review of GitHub CI, release artifacts and public-repo hardening

## 2026-11-25 — FAIL

### Findings

1. **P1 · The settings checker can certify an unprotected release tag.** [`includesVTags`](../../scripts/check-github-settings.mjs#L70) checks the include list alone. In an offline API snapshot, both tag rulesets included `refs/tags/v*` and excluded `refs/tags/v0.1.0`. All four tag checks reported `ok` even though those rules would leave that release tag unprotected. The creation check also [accepts the Repository admin role without checking its bypass mode](../../scripts/check-github-settings.mjs#L102). A snapshot using `exempt` passed, although the checklist specifies “Always allow.” Check coverage for all release tags and verify the configured bypass mode. [GitHub rulesets API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset)
2. **P1 · The settings checker can report PR and push protection for the wrong branch.** [`includesMain`](../../scripts/check-github-settings.mjs#L61) treats `~DEFAULT_BRANCH` as `main` without reading the repository's `default_branch`. With `default_branch: develop` in an offline snapshot, a ruleset scoped to the default branch passed the checks for an active `main` ruleset, required PRs, no force pushes and no deletion. Confirm the actual default branch before counting those rules toward `main` protection. [GitHub rulesets API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset) · [GitHub repository API](https://docs.github.com/en/rest/repos/repos#get-a-repository)
3. **P2 · The release preflight can proceed when it failed to verify draft releases.** The [duplicate guard](../../.github/workflows/release.yml#L44) treats `release not found` from `gh release view` as proof that neither a published release nor a draft exists. GitHub CLI v2.105.0 checks both, using GraphQL for drafts. If the published lookup returns not found and the draft lookup errors, the CLI can report not found. With no tag for an existing draft, the tag check can also pass and the job then starts building. Use a release lookup that distinguishes an absent draft from a failed request. The REST release list includes drafts for a caller with push access. [GitHub CLI lookup source](https://github.com/cli/cli/blob/v2.105.0/pkg/cmd/release/shared/fetch.go#L170-L249) · [GitHub REST release list](https://docs.github.com/en/rest/releases/releases#list-releases)

### Scope and follow-ups

- Review covered `be9e4c9^` through `2725659`. The hashes for steps 1–9 match the commits. Step 10 remains partial. The dated builder entries in `progress.md` still say `uncommitted` from when they were written. The later plan checklist contains the committed hashes.
- The README commit also changes the header, adds badges, and rewrites the end-user install section. Step 9 calls for CI, release and contribution documentation. The README says Release runs the same checks as CI, but Release runs the eight checks from the `checks` job and omits `workflow-lint`. README and CONTRIBUTING describe approval for first-time contributors, while the settings checklist requires approval for all outside contributors.
- The workflow lint runner checks the cached archive's hash and then executes the already-extracted binary if it exists. Consider extracting from the verified archive again or checking the executable against it. [Cache reuse](../../scripts/lint-workflows.mjs#L76)
- The required check ruleset looks for job names. Consider also setting GitHub Actions as the required source for both checks in GitHub and verifying that source in the script. [GitHub rulesets API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset)
- The spec diff leaves dependencies, fixtures, manifest permissions, allowed URLs and extension source untouched. The ADR 0005 amendment matches Q1. No mechanical fixes applied.

### Verification

| Command or acceptance check                                                                    | Result                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`, `npm run lint`, `npm run typecheck`                                    | Passed                                                                                                                                                                                                                                                                    |
| `npm test`                                                                                     | Passed 1,641 extension and 31 Worker tests. The sandbox initially blocked WXT's loopback bind. The retry with loopback access passed.                                                                                                                                     |
| `npm run check:workflows`, `npm run lint:workflows`                                            | Passed. actionlint reported zero findings. Zizmor's default persona reported zero findings and four suppressed advisories. The auditor persona showed three informational findings for unnamed jobs and one low-severity finding for the undocumented release permission. |
| `npm run build:chrome`, `npm run build:firefox`, `npm run check:privacy`, `npm run check:site` | Passed                                                                                                                                                                                                                                                                    |
| `npm run zip`, `npm run zip:sources`, `sha256sum -c`, `unzip -tq`                              | Passed for the three local archives. The filenames match the upload step.                                                                                                                                                                                                 |
| `node scripts/check-github-settings.mjs vgr-dev/naciocheck`                                    | Read-only live check returned exit 1 with 1 matching setting, 7 drift, 19 unavailable and 0 errors.                                                                                                                                                                       |
| `git diff --check be9e4c9^`                                                                    | Passed                                                                                                                                                                                                                                                                    |

Local checks used existing dependencies and Node 24.22.0. The workflows pin Node 24.22.1. Browser E2E was outside the CI acceptance suite. The owner-side checks still pending are a green branch PR, all five intentional CI failures, the runner's Node setup, the settings UI and real ruleset verification, and the three throwaway-repository release runs for the first draft, a duplicate and a non-`main` ref.

### Next action

Return the findings to the builder and keep the spec active. Repeat the review after the rule and release guards are corrected and the owner has recorded the GitHub-side acceptance results.

**Manual smoke test** — In the throwaway repository, go to **Actions → Release → Run workflow** and select `main`. Confirm that the draft targets the checked-out commit and has four assets, then download them together and run `sha256sum -c naciocheck-0.1.0-SHA256SUMS.txt`. Run Release again from `main` and confirm it stops at the duplicate check before installing dependencies.

## 2026-11-25 — Re-review — FAIL

### Findings

1. **P2 · The tag checker misses overlapping creation rules that block release publication.** [`tagRuleCheck`](../../scripts/check-github-settings.mjs#L241) accepts the admin bypass if any covering creation ruleset has it. An offline snapshot with the expected admin-only creation ruleset and a second covering ruleset with creation, update and deletion restrictions and no bypass reported `ok` on all four tag checks. GitHub layers the rules, so the second creation rule would still block the owner's publication. Account for the other active creation rules when checking whether the admin can create a release tag. [GitHub ruleset layering](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets#about-rule-layering)
2. **P2 · Parallel lint runs can fail while extracting a verified binary.** [`extractBinary`](../../scripts/lint-workflows.mjs#L78) removes, extracts and changes permissions at a path shared by every invocation. In a temporary copy, I controlled the timing of two runs so the second removed the binary after the first extracted it. The first exited with `ENOENT` at `chmod`. Extract and execute from a directory unique to each run. The archive cache can still be shared.

### Previous findings and scope

- The original excluded-tag and non-`main` default-branch cases are fixed and have regression tests. The admin bypass check now enforces “Always allow.” The required check source is checked against the GitHub Actions app ID, confirmed as 15368 via a live GET.
- The release preflight now stops on a failed list request and rejects matching releases and tags before dependency installation. I ran the actual shell block with stubbed responses for a draft, published release, API failure, existing tag, tag lookup failure, and neither release nor tag. Only the last case passed. The actual `gh --jq` expression also matched a published release through a read-only public API request. GitHub includes drafts in the list for callers with push access. The release job token still needs the owner-run test. [GitHub REST release list](https://docs.github.com/en/rest/releases/releases#list-releases)
- Checked the fix round against `2725659`. The docs clarify the eight release checks and outside contributor approval. Dependencies, extension code, permissions and fixtures remain outside the diff. No mechanical code fixes applied. Step 10 remains partial.

### Verification

- `npm test` passed 1,675 extension and 31 Worker tests. Format, ESLint and TypeScript passed.
- `npm run check:workflows` and `npm run lint:workflows` passed. Zizmor's default persona reported three suppressed advisories.
- Both browser builds, privacy and site gates, both packaging commands, and local SHA-256 verification passed on Node 24.22.0. The workflow pins 24.22.1. Browser E2E is outside the CI acceptance scope.
- The read-only private-repo check exited 1 with 2 matching settings, 7 with drift, 20 unavailable and 0 errors. The owner-side PR, negative CI checks, live ruleset checks and throwaway release runs remain pending.

### Next action

Return the two remaining findings to the builder. Keep the spec active through the owner-side acceptance runs and confirmation.

**Manual smoke test** — In a throwaway repo, run **Actions → Release → Run workflow** from `main`. Download the four draft assets and run `sha256sum -c naciocheck-0.1.0-SHA256SUMS.txt`. Run Release again and confirm the duplicate guard stops it before dependency installation.
