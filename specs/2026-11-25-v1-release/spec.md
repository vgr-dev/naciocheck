---
status: active # draft | active | done | abandoned
created: 2026-11-25
status-date: 2026-11-25
---

# Prepare the v1.0.0 release

## Goal

Make `main` ready for the owner to cut NacioCheck 1.0.0, the first public release, and leave the owner a
single ordered runbook for the steps only they may take (dispatching the release workflow, store uploads,
publishing the draft, deploying the site). After the stores accept the
extension, finish the post-release work so the README, the landing site and the changelog point at the real
store listings and the public repository. The pre-release audit (`docs/pre-release-audit-2026-11-18.md`)
already records the owner's release approval; this spec does not reopen it.

## Scope

### Phase 0: branch and release rules (owner decision, 2026-11-25; own PR, merged first)

- The repository is already public and `main` is protected. A new ADR 0008 records the branch names, the
  agent rule (never edit on `main`), the changelog rule, semantic versioning, the release PR and the fix
  flow after a release. `AGENTS.md` and `CONTRIBUTING.md` link it. ADR 0005 gets an amendment: the
  repository went public before the first release.

### Phase 1: pre-release (before the owner dispatches the release workflow)

- **Version bump:** `package.json` (and `package-lock.json`'s root entries) from `0.1.0` to `1.0.0`. The built
  manifests of both browsers carry `1.0.0`.
- **Changelog:** cut `## [Unreleased]` into `## [1.0.0] - <date +%F on the day of the bump>`, keep an empty
  `## [Unreleased]` above it, and keep the format `tests/changelog.test.ts` expects. The rendered site
  changelog shows 1.0.0 in all three languages.
- **Version references:** update or deliberately keep each remaining `0.1.0` mention outside the audit and
  past specs (README byte-for-byte note, `docs/manual-firefox-checklist.md` result block). Historical records
  stay as written. The README status line stays "pre-release" until Phase 2.
- **Privacy pages:** the "applies to" line in es, en and ca says `1.0.0 and later` (0.1.0 was never public),
  and the "last reviewed" date on all three moves to the day of the change, each in its language's date
  format. No other wording changes.
- **Listing refresh:** re-check `store/listing.en.md`, `store/listing.es.md`, `store/permissions.md` and
  `store/REQUIREMENTS.md` against the current feature set (raw status text, share panel, report a problem)
  and the store field limits; fix drift. Screenshots and promo images stay as approved unless a listing claim
  no longer matches them, in which case it is raised, not regenerated.
- **AMO reviewer notes:** a section of `docs/release.md` with the source-build note for the AMO "sources"
  upload (Node version from `.nvmrc`, `npm ci`, the exact build command, where the output lands, and that it
  matches the uploaded Firefox zip), written so it can be pasted into the AMO form as is.
- **Release runbook:** `docs/release.md`, the ordered owner steps for 1.0.0 and later releases: merge the
  bump PR; dispatch `Release` on `main`; download and verify the draft's assets against SHA256SUMS; upload
  the Chrome zip to the Chrome Web Store with the listing, permission justifications and data-usage answers
  (pointing at the `store/` files); upload the Firefox zip and the sources zip to AMO with the reviewer
  notes; publish the GitHub draft (creates the tag); then Phase 2. Each step says who does it and what
  evidence to keep. It links to, rather than repeats, `docs/github-settings.md` and the manual Firefox
  checklist.
- **Firefox checklist by an agent (owner decision, 2026-11-25):** `docs/manual-firefox-checklist.md` is no
  longer run by hand. Before each release an agent runs it on the store-bound Firefox zip with the `firefox`
  MCP tools; the owner keeps the rows that reach the real sede or need Android. Recorded as an amendment to
  ADR 0007 and in `AGENTS.md` and the checklist's intro.
- **Repository public on the site:** `site/_build/config.json` sets `repositoryPublic: true` now (owner
  decision, 2026-11-25); the store URLs stay `null` until Phase 2.
- **Repository brand preview image:** `brand/social-preview.png` (1280×640) joins the brand kit as the
  GitHub social preview, listed in `brand/README.md`, with an owner step in `docs/github-settings.md` to
  upload it when the repository goes public.
- **Site deploy before the store uploads:** the runbook has the owner run `npm run deploy:site` right after
  the bump PR merges, so the 1.0.0 privacy policy is live before the store forms ask for it.
- **Clean-checkout rehearsal:** from a fresh clone of the bump commit, run `npm ci`, `npm run format:check`,
  `npm run lint`, `npm run typecheck`, `npm test`, both builds, `npm run check:privacy`,
  `npm run check:site`, `npm run zip`, `npm run zip:sources` and `npm run test:e2e`; then rebuild the Firefox
  package from the extracted sources zip and compare byte for byte. Results recorded in `progress.md`.

### Phase 2: post-release (after both stores have accepted 1.0.0)

Phase 2 is a separate PR on this spec. The spec stays `active` between the two PRs and becomes `done` when
Phase 2 merges.

- `site/_build/config.json`: the real `chromeStoreUrl` and `firefoxStoreUrl` (given by the owner);
  `repositoryPublic` is already true from Phase 1.
- README: store badges and install section point at the listings; the "not in the stores yet" warnings go.
  The status line stays, rewritten to say 1.0.0 is released in both stores.
- The site changelog links 1.0.0 to its GitHub release (existing behaviour once `repositoryPublic` is true).
- `npm run check:site` and the site tests pass with the new config; the owner then runs
  `npm run deploy:site` and the post-release site checks already listed in the audit's "Landing site" and
  "Landing polish" gates.
- Close the audit's "Landing site: after release" row only with the owner's own sign-off.

## Non-goals

- Any action reserved to the owner (AGENTS.md boundaries): dispatching a workflow, publishing the draft,
  pushing a tag, uploading to a store, changing repository visibility or settings, `npm run deploy:site`.
- Re-running the pre-release audit or reopening its owner gates.
- New features, UI changes, new permissions or host patterns, dependency changes, or a new workflow.
- Regenerating store screenshots or promo images.
- The `vgr.cat` tie-in (`vgr-dev/vgr.cat` `specs/2026-11-23-naciocheck-tie-in/`) and the non-blocking Low
  findings from the landing-polish review.
- A Catalan extension locale.

## Relevant files

- `package.json`, `package-lock.json`: the version the release workflow tags as `v<version>`.
- `CHANGELOG.md`, `tests/changelog.test.ts`: release notes and their format check; source of the site
  changelog.
- `.github/workflows/release.yml`: builds the draft release; read-only reference for the runbook.
- `store/listing.en.md`, `store/listing.es.md`, `store/permissions.md`, `store/REQUIREMENTS.md`,
  `store/screenshots/`: store submission material.
- `site/_build/config.json`: `repositoryPublic` (Phase 1) and the store URLs (Phase 2).
- `site/privacy/index.html`, `site/en/privacy/index.html`, `site/ca/privacy/index.html`: "applies to 0.1.0"
  line.
- `README.md`: status line, install section, store badges, reproducibility note.
- `docs/manual-firefox-checklist.md`, `docs/github-settings.md`: linked from the runbook.
- `docs/pre-release-audit-2026-11-18.md`: release approval and the remaining post-release gates.
- `docs/adr/0005-distribution-and-public-pages.md`: store-only distribution, public repo after first release.

## Constraints (do not touch)

- No commit, push, tag, workflow dispatch, release publication, store upload, visibility or settings change,
  or site deploy by an agent. Agents propose commit messages only.
- No new permission, host pattern, allowed URL, dependency or workflow action. `npm run check:privacy` keeps
  allowing exactly one host; the E2E network guard stays at 0 unexpected requests.
- `tests/fixtures/` stays byte-for-byte; only fake identities anywhere.
- Historical records (the audit, past specs, past checklist results) are not rewritten to say 1.0.0.
- The gecko id `naciocheck@vgr.cat` and the release workflow stay unchanged.
- Settled decisions in `docs/adr/` stay as they are, except the ADR 0007 amendment the owner decided on
  2026-11-25 (agent-run Firefox checklist); any other conflict is raised with the owner.

## Acceptance criteria

### Phase 1

- [ ] `package.json` and `package-lock.json` say `1.0.0`; both built manifests say `1.0.0`; `npm run zip`
      produces `naciocheck-1.0.0-chrome.zip` and `naciocheck-1.0.0-firefox.zip`, and `zip:sources` the
      sources zip.
- [ ] `CHANGELOG.md` has an empty `[Unreleased]` and a dated `[1.0.0]` with the current entries;
      `tests/changelog.test.ts` covers the new section and passes; the built site changelog shows 1.0.0 in
      es, en and ca.
- [ ] Every remaining `0.1.0` outside historical records is updated or listed in `progress.md` with the reason
      it stays.
- [ ] The built privacy pages in es, en and ca say they apply to `1.0.0 and later` and show the new
      "last reviewed" date; `npm run check:site` passes.
- [ ] The listings and `store/permissions.md` match the shipped features and the manifest permissions, and
      every listing field is within the limits in `store/REQUIREMENTS.md`; the licence test still passes.
- [ ] The AMO reviewer notes section in `docs/release.md` gives commands that, run in a fresh clone, rebuild a Firefox package identical to
      the release zip.
- [ ] `docs/release.md` lists every owner step from merge to Phase 2 in order, with who acts and what evidence
      to keep, and references the `store/` files for each store form.
- [ ] ADR 0007 has a 2026-11-25 amendment, and `AGENTS.md` and the checklist intro say an agent runs the
      Firefox checklist with the `firefox` tools while the owner keeps the live-sede and Android rows.
- [ ] `brand/social-preview.png` is tracked, 1280×640, free of text/EXIF/XMP metadata and personal data, and
      named in `brand/README.md` and in an owner step of `docs/github-settings.md`.
- [ ] The clean-checkout rehearsal passes every gate listed in Scope, including `test:e2e` with 0 unexpected
      requests and a byte-identical Firefox rebuild from the sources zip, recorded in `progress.md`.
- [ ] A proposed commit message (Conventional Commits, one line, at most 72 characters).

### Phase 2

- [ ] `site/_build/config.json` holds the owner-supplied store URLs (and `repositoryPublic: true` from Phase 1);
      `npm run check:site` and the site tests pass; the landing install buttons and the README link to the
      listings; the 1.0.0 changelog entry links to its GitHub release.
- [ ] No "coming soon" or "not in the stores yet" text remains in the README or the built site; the README
      status line says 1.0.0 is released.
- [ ] Phase 2 lands as its own PR, and the spec's status moves to `done` with it.
- [ ] The owner's post-release site checks are listed for them, not marked done by an agent.

## Open questions

None.
