# 0008. Branches, fixes and releases

- **Status:** accepted (owner decision, 2026-11-25)
- **Date:** 2026-11-25

## Context

The repository is public and `main` is protected by a ruleset: every change goes through a pull request, the
only merge method is squash, the required checks must pass and nobody can bypass the rules
(`docs/github-settings.md`). The `v*` tags are created only when the owner publishes a draft release, and
cannot be moved or deleted. NacioCheck ships only through the Chrome Web Store and AMO (ADR 0005), which
serve one version: the latest. Agents and contributors need one written rule for branch names, the
changelog, version numbers, releases and fixes after a release, so that each pull request is reviewable on
its own and a release is a deliberate step.

## Decision

- `main` is the only long-lived branch. It changes only through squash-merged pull requests, one concern
  per pull request. The pull request title is the Conventional Commit subject of the squashed commit.
- Branch names follow the commit type: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `ci/<slug>`,
  `chore/<slug>`, `test/<slug>`, `refactor/<slug>`, and `release/v<version>` for a release. A spec's pull
  requests use the spec's slug. A spec shipped in several pull requests uses one branch per pull request,
  each created from an up-to-date `main`.
- Agents run `git branch --show-current` before editing. On `main` they stop and propose a branch, or create
  it with `git switch -c <branch>` and say so. They never commit, push, rebase or reset.
- Every user-visible pull request adds a line under `## [Unreleased]` in `CHANGELOG.md`. Docs, CI and
  test-only pull requests do not.
- Versions follow semantic versioning:
  - patch for fixes;
  - minor for features; a new manifest permission is at least minor and still needs the owner's approval
    first;
  - major when stored data or backups from an earlier version can no longer be read, or a supported browser
    is dropped.
- A release is a `release/v<version>` pull request with the version bump, the dated changelog section and
  whatever else that release needs. After it merges, `docs/release.md` applies: the owner dispatches the
  release workflow, uploads to the stores and publishes the draft release, which creates the tag.
- A fix after a release goes to `main` as a `fix/<slug>` pull request, followed by a patch release
  `release/v<x.y.z+1>`. There are no long-lived release branches and no backports, since the stores serve
  only the latest version.
- The only exception: if unreleased work on `main` must not ship with an urgent fix, the owner may approve a
  branch from the release tag for that fix. Agents never create one without that approval.

## Consequences

- `main` has a linear history in which each commit is one reviewed pull request, and the tags mark exactly
  what reached the stores.
- `AGENTS.md` carries the agent rule and links here; `CONTRIBUTING.md` gives contributors the branch names
  and the changelog rule and points maintainers to `docs/release.md`.
- Anything on `main` ships with the next release. Work that is not ready stays on its branch until it is.
- Dispatching the release workflow, uploading to the stores and publishing the draft release stay the
  owner's actions (ADR 0005).
