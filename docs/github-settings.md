# GitHub repository settings

The settings `vgr-dev/naciocheck` needs before and after it becomes public. The owner applies them in the
GitHub UI; no agent or script changes them. `scripts/check-github-settings.mjs` reads them back and reports
every one that differs from this page, so drift is visible.

Why they matter: once the repository is public, anyone can open a pull request, and the workflows run on that
code. These settings keep outside code away from secrets and write access, keep every change to `main` behind
a pull request and a green CI, and keep release tags from being moved or deleted.

## Applying the checklist

1. Merge the workflows (`.github/workflows/ci.yml`, `release.yml`) and `.github/dependabot.yml` first. Every
   `uses:` in them is pinned to a full commit SHA, so the SHA-pinning setting will not break them. The status
   check names `checks` and `workflow-lint` only appear in the ruleset's check picker after CI has run once.
2. Apply the Actions and General settings, except `fork-pr-approval-all-outside`. They are available on a
   private repository.
3. Make the repository public (the owner's decision; see `docs/pre-release-audit-2026-11-18.md`).
4. Apply `fork-pr-approval-all-outside`, the rulesets and the Security settings. On a private repository with
   the Free plan, fork pull request approval, rulesets, secret scanning and private vulnerability reporting are
   not available (fork pull request approval answers HTTP 422 "not allowed for private repositories"), so the
   script lists them as `unavailable`. Once the repository is public they are available for free, and a
   missing one is drift.
5. Run `node scripts/check-github-settings.mjs` and confirm there is no `DRIFT`, no `ERROR` and nothing
   `unavailable`.

After the `main` ruleset is active, even the owner changes `main` through a pull request. Create the ruleset
last, once the other settings and the first CI run are in place.

## Checking the settings

```sh
node scripts/check-github-settings.mjs [owner/repo]
```

Without an argument it uses the `origin` remote. It needs the `gh` CLI, signed in with access to the
repository's settings (an admin). It makes only `GET` requests. Each setting prints one line:

- `ok`: matches this page.
- `DRIFT`: differs from this page; the line says how. Exit code 1.
- `unavailable`: GitHub answered 403 or 404 (plan-gated or not enabled for this repository). Does not fail the
  run by itself.
- `ERROR`: anything else, such as a bad login or a network failure. Exit code 1.

The bold id of each entry below is the id the script prints. `tests/github-settings-doc.test.ts` keeps this page
and the script's ids in step.

## Actions

Settings > Actions > General.

- **`actions-allowed-github-owned`**
  - Where: Actions permissions, "Allow OWNER, and select non-OWNER, actions and reusable workflows".
  - Expected: "Allow actions created by GitHub" ticked; "Allow Marketplace actions by verified creators"
    unticked; the list of allowed actions empty.
  - Why: A third-party action runs with the workflow's token. The workflows use GitHub-owned actions only, so
    nothing else is allowed.
- **`actions-sha-pinning`**
  - Where: Actions permissions, "Require actions to be pinned to a full-length commit SHA".
  - Expected: ticked.
  - Why: A tag or branch can be moved to different code; a commit SHA cannot. A workflow that uses an unpinned
    action fails instead of running it.
- **`workflow-token-read`**
  - Where: Workflow permissions, "Read repository contents and packages permissions".
  - Expected: selected.
  - Why: The default `GITHUB_TOKEN` is read-only. A job that needs more asks for it in its own `permissions`
    block (only the release job has `contents: write`).
- **`actions-no-pr-approval`**
  - Where: Workflow permissions, "Allow GitHub Actions to create and approve pull requests".
  - Expected: unticked.
  - Why: A workflow must not approve or open pull requests, so automation cannot satisfy a review on its own.
- **`fork-pr-approval-all-outside`**
  - Where: Fork pull request workflows from outside collaborators, "Require approval for all outside
    collaborators".
  - Expected: selected.
  - Why: A first-time or returning outside contributor's pull request runs no workflow until the owner has
    read the change and approved the run.

## `main` ruleset

Settings > Rules > Rulesets > New ruleset > New branch ruleset. One ruleset, named for example `main`, with
Enforcement status "Active", the target branch "Include default branch" (no Exclude target entries), and
**an empty bypass list**. The default branch must be `main` (see `default-branch-main`): the script counts
"Include default branch" as `main` only then, and a ruleset that excludes `main` (by name, as the default
branch or as all branches) does not count. Needs the repository to be public on the Free plan.

- **`main-ruleset-active`**
  - Where: the ruleset's Enforcement status and Target branches.
  - Expected: Active; targets the default branch (`main`); excludes nothing (no Exclude target entry).
  - Why: A ruleset in "Evaluate" or "Disabled" mode blocks nothing.
- **`main-ruleset-no-bypass`**
  - Where: the ruleset's Bypass list.
  - Expected: empty.
  - Why: The rules apply to the owner too, so a mistaken push or a stolen token cannot skip them.
- **`main-ruleset-pull-request`**
  - Where: Rules, "Require a pull request before merging".
  - Expected: ticked.
  - Why: Every change to `main` is reviewed as a diff and goes through CI first.
- **`main-ruleset-zero-approvals`**
  - Where: "Require a pull request before merging", "Required approvals".
  - Expected: 0.
  - Why: The owner is the only maintainer and cannot approve their own pull request. Only people with write
    access can merge, and the required checks still gate the merge.
- **`main-ruleset-conversation-resolution`**
  - Where: "Require a pull request before merging", "Require conversation resolution before merging".
  - Expected: ticked.
  - Why: A review comment is answered before the change lands.
- **`main-ruleset-squash-only`**
  - Where: "Require a pull request before merging", "Allowed merge methods".
  - Expected: only "Squash".
  - Why: One commit per pull request, and its title is the Conventional Commits message.
- **`main-ruleset-required-checks`**
  - Where: Rules, "Require status checks to pass", "Add checks".
  - Expected: `checks` and `workflow-lint` (the job ids in `.github/workflows/ci.yml`).
  - Why: A change that fails formatting, lint, types, tests, the builds, the privacy gate, the site check or
    the workflow linters cannot be merged. The names appear in the picker after CI has run once.
- **`main-ruleset-checks-from-actions`**
  - Where: "Require status checks to pass", the source selector next to each check (the integration that
    must provide it).
  - Expected: GitHub Actions for both `checks` and `workflow-lint`. The script reads this as
    `integration_id` 15368, the id of the GitHub Actions app.
  - Why: A required check with no source ("any source") is satisfied by a commit status from any
    integration or token that can write statuses. Pinning the source to GitHub Actions means only the
    workflow's own jobs can satisfy it.
- **`main-ruleset-strict-checks`**
  - Where: "Require status checks to pass", "Require branches to be up to date before merging".
  - Expected: ticked.
  - Why: The checks ran on the code that will actually land, not on an older base.
- **`main-ruleset-linear-history`**
  - Where: Rules, "Require linear history".
  - Expected: ticked.
  - Why: No merge commits on `main`; with squash-only the history stays one line.
- **`main-ruleset-no-force-push`**
  - Where: Rules, "Block force pushes".
  - Expected: ticked.
  - Why: Published history is never rewritten.
- **`main-ruleset-no-deletion`**
  - Where: Rules, "Restrict deletions".
  - Expected: ticked.
  - Why: `main` cannot be deleted.

## `v*` tag rulesets

Settings > Rules > Rulesets > New ruleset > New tag ruleset. The release workflow creates a draft release and
no tag; the tag `v<version>` is created when the owner publishes the draft in the GitHub UI. A ruleset has a
single bypass list, so the tag rules are **two rulesets**, both Active and both targeting the pattern
`refs/tags/v*` (enter `v*` as the tag name pattern):

1. A ruleset named for example `v-tags-create`, with the rule "Restrict creations" and a bypass list holding
   exactly one entry: the role **Repository admin**, with the mode "Always allow" ("For pull requests only"
   or "Exempt" is not accepted).
2. A ruleset named for example `v-tags-protect`, with the rules "Restrict updates" and "Restrict deletions"
   and **an empty bypass list**.

Both rulesets target exactly `refs/tags/v*` (or all tags) with **no Exclude target entry**: an excluded tag,
for example `v0.1.0`, would be left unprotected, so a tag ruleset with any exclusion does not count.

Rules layer: no other active ruleset that could apply to `v*` tags may restrict creation without the same
Repository admin "Always allow" bypass, or it blocks the owner's publication of the draft release (a ruleset
in Evaluate or Disabled mode enforces nothing and is ignored).

Needs the repository to be public on the Free plan. The script identifies the Repository admin role by
`actor_type` `RepositoryRole`, `actor_id` 5 and `bypass_mode` `always`, which step 10 of the spec confirms
against the real ruleset.

- **`tag-ruleset-creation-restricted`**
  - Where: the `v-tags-create` ruleset, Rules, "Restrict creations".
  - Expected: ticked.
  - Why: A `v*` tag marks a release, so a pull request, a workflow or a collaborator cannot create one.
- **`tag-ruleset-creation-admin-bypass`**
  - Where: the `v-tags-create` ruleset, Bypass list.
  - Expected: only the Repository admin role, with "Always allow".
  - Why: Publishing the draft release creates the tag as the owner, who is an admin. Nobody else may.
- **`tag-ruleset-no-update`**
  - Where: the `v-tags-protect` ruleset, Rules, "Restrict updates", with an empty bypass list.
  - Expected: ticked, no bypass actors.
  - Why: A published tag is never moved to other code. The checksums attached to the release stay valid.
- **`tag-ruleset-no-deletion`**
  - Where: the `v-tags-protect` ruleset, Rules, "Restrict deletions", with an empty bypass list.
  - Expected: ticked, no bypass actors.
  - Why: A published tag is never deleted and re-created. Removing a mistaken tag means disabling this
    ruleset first, deliberately and in the open.

## Security

Settings > Advanced Security (named "Code security and analysis" in older layouts). These features are free for
public repositories; on a private Free-plan repository the script reports them as `unavailable`.

- **`private-vulnerability-reporting`**
  - Where: "Private vulnerability reporting", Enable.
  - Expected: enabled.
  - Why: `SECURITY.md` tells reporters to use it, and a NIE leak must not be disclosed in a public issue.
- **`secret-scanning`**
  - Where: "Secret Protection" (secret scanning), Enable.
  - Expected: enabled.
  - Why: A token committed by mistake is flagged. The repository history is public.
- **`secret-scanning-push-protection`**
  - Where: Secret Protection, "Push protection", Enable.
  - Expected: enabled.
  - Why: A push that contains a recognised secret is blocked before it lands in the history.
- **`dependabot-alerts`**
  - Where: "Dependabot alerts", Enable.
  - Expected: enabled. The script reads this one as a 204 (on) or 404 (off), and treats a 404 as drift.
  - Why: Known-vulnerable dependencies are reported. Dependabot version updates are limited to
    `github-actions` in `.github/dependabot.yml`, to keep the action SHA pins current.

## General

Settings > General.

- **`default-branch-main`**
  - Where: Branches, "Default branch".
  - Expected: `main`.
  - Why: The `main` ruleset targets "the default branch"; if another branch were the default, the rules
    would protect that branch and leave `main` open, so the script counts the default-branch pattern as
    `main` only when this holds.
- **`wiki-off`**
  - Where: Features, "Wikis".
  - Expected: unticked.
  - Why: Documentation lives in the repository where it is reviewed through pull requests; a wiki is a second
    place that anyone with access could edit outside that flow.
- **`delete-branch-on-merge`**
  - Where: Pull Requests, "Automatically delete head branches".
  - Expected: ticked.
  - Why: Merged branches do not pile up.
- **`merge-squash-only`**
  - Where: Pull Requests, "Allow merge commits" and "Allow rebase merging" unticked, "Allow squash merging"
    ticked.
  - Expected: squash is the only allowed merge method.
  - Why: Matches the `main` ruleset, and keeps the repository setting from allowing what the ruleset
    forbids.
