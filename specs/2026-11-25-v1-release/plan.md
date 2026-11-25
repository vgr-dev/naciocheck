# Plan: Prepare the v1.0.0 release

Spec: `spec.md`

**Sign-off:** Approved by Victor Gonzalez on 2026-11-25.

## Status

<!-- One line per step. Only this section changes after sign-off. Details and verification evidence go in progress.md. -->

**Phase 0: Branch and release rules (own PR, branch `docs/branching-rules`)**

- [x] 14. Record the branch, fix and release rules (ADR 0008, amend ADR 0005) (88ebfd3)

**Phase 1: Version, changelog, privacy pages, store texts and runbook**

- [x] 1. Bump the version to 1.0.0 and cut the changelog (uncommitted)
- [x] 2. Point the privacy pages at 1.0.0 and mark the repository public (uncommitted)
- [x] 3. Refresh the store listings and permission notes (uncommitted)
- [x] 4. Write the release runbook and the AMO reviewer notes (uncommitted)
- [x] 5. Update the remaining version references (uncommitted)
- [x] 12. Let an agent run the Firefox checklist (amend ADR 0007) (uncommitted)
- [x] 13. Create the repository brand preview image (uncommitted)

**Phase 2: Visual baselines for the 1.0.0 text**

- [ ] 6. Update the visual baselines that show the new text

**Phase 3: Clean-checkout rehearsal**

- [ ] 7. Rehearse the release from a fresh clone

**Phase 4: Post-release site and README (second PR, blocked until the owner says go)**

- [ ] 8. Set the store URLs in the site config
- [ ] 9. Point the README and SECURITY.md at the released 1.0.0

**Phase 5: Post-release baselines and close-out**

- [ ] 10. Update the site baselines for the store links
- [ ] 11. Close the spec and list the owner's post-release checks

## Fixed names (all steps use these)

- Version: `1.0.0`; tag `v1.0.0`; assets `naciocheck-1.0.0-chrome.zip`, `naciocheck-1.0.0-firefox.zip`,
  `naciocheck-1.0.0-sources.zip`, `naciocheck-1.0.0-SHA256SUMS.txt` (names from `.github/workflows/release.yml`).
- Release day: `date +%F` on the day Phase 1 is built (2026-11-25 if built today). The changelog heading
  (step 1) and the three privacy "last reviewed" dates (step 2) use the same day. If Phase 1 is rebuilt on a
  later day, both move together.
- Privacy date formats (the current ones, unchanged): es `25 de noviembre de 2026`, en `25 November 2026`,
  ca `25 de novembre de 2026`.
- Runbook: `docs/release.md`, with the section heading `## AMO reviewer notes` (step 3 refers to it by that
  name, step 7 runs the commands in it).
- Rehearsal workspace: a new directory under the session scratchpad, never inside the repository.

## Branches

- The repository is public and `main` takes squash-merged pull requests only (ruleset in
  `docs/github-settings.md`). No step runs on `main`: the orchestrator checks `git branch --show-current`
  before starting a phase.
- Phase 0: `docs/branching-rules` (PR 0, merged first; it carries this spec folder and
  `brand/social-preview.png` untouched).
- Phases 1 to 3: `release/v1.0.0`, created from `main` after PR 0 is merged (PR 1).
- Phases 4 and 5: `docs/v1.0.0-store-links`, created from `main` after PR 1 is merged and both listings are
  live (PR 2). Names follow ADR 0008 (step 14).

## Running steps in parallel

- Phase 1 steps share one working tree. Only step 1 writes `.output/` (it builds both browsers to read the
  manifest versions); steps 2 to 5 never build, zip or run `check:site`. Phase verify does the rest.
- `package.json` and `package-lock.json` are touched by step 1 only. `README.md` and `SECURITY.md` by step 5
  (Phase 1) and step 9 (Phase 4) only. `AGENTS.md`, ADR 0007 and the Firefox checklist by step 12 only (step 14 edits `AGENTS.md` in Phase 0, before
  it). `site/_build/config.json` and `tests/build-site.test.ts` by step 2 (Phase 1) and step 8 (Phase 4) only. `brand/README.md` and `docs/github-settings.md` by step 13 only. `e2e/baselines/` by steps 6 and 10 only, each alone in its phase.
- Builders never write `plan.md` or `progress.md` (`/implement-phase` owns them), and never commit, push, tag,
  dispatch a workflow, publish a release, upload to a store, change repository settings or visibility, or run
  `npm run deploy:site`.
- PR 0 is Phase 0. PR 1 is Phases 1 to 3. PR 2 is Phases 4 and 5 and starts only after the owner reports
  both store listings live and gives their URLs.

## Phase 0: Branch and release rules

Added by the owner on 2026-11-25. One step, on branch `docs/branching-rules`, merged before Phase 1 starts.

- **Phase verify:** `npm run format:check && npm run lint && npm test && git branch --show-current`; all pass
  and the branch is `docs/branching-rules`.

### 14. Record the branch, fix and release rules (ADR 0008, amend ADR 0005)

Numbered 14 so the other steps keep their numbers.

- **Goal:** Write down how changes reach `main` now that the repository is public and `main` is protected.
  - `docs/adr/0008-branches-fixes-and-releases.md` (from `docs/adr/0000-template.md`, status accepted
    2026-11-25 by the owner):
    - `main` is the only long-lived branch, changed only by squash-merged pull requests; one concern per
      pull request; the title is the Conventional Commit subject.
    - Branch names follow the commit type: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `ci/<slug>`,
      `chore/<slug>`, `test/<slug>`, `refactor/<slug>`, and `release/v<version>`. A spec's pull requests use
      its slug; a spec shipped in several pull requests uses one branch per pull request, each from an
      up-to-date `main`.
    - Agents run `git branch --show-current` before editing; on `main` they stop and propose a branch, or
      create it with `git switch -c` and say so. They never commit, push, rebase or reset.
    - Every user-visible pull request adds a line under `[Unreleased]` in `CHANGELOG.md`; docs, CI and
      test-only pull requests do not.
    - Semantic versioning: patch for fixes; minor for features (a new permission is at least minor and still
      needs the owner's approval first); major when stored data or backups from an earlier version can no
      longer be read, or a supported browser is dropped.
    - A release is a `release/v<version>` pull request with the version bump, the dated changelog section
      and what that release needs; after it merges, `docs/release.md` applies (owner dispatches, uploads,
      publishes the draft, which creates the tag).
    - A fix after a release: `fix/<slug>` to `main`, then a patch `release/v<x.y.z+1>`. No long-lived release
      branches and no backports, since the stores serve only the latest version. If unreleased work on
      `main` must not ship with an urgent fix, the owner may approve a branch from the release tag; that is
      the only exception.
  - `docs/adr/0005-distribution-and-public-pages.md`: an `## Amendment 2026-11-25: the repository is public
before the first release` section. The repository went public before 1.0.0 was in the stores (to turn
    on the public-only protections from `specs/2026-11-25-ci-and-public-repo/`); the original decision text
    stays; consequences: the site's `repositoryPublic` is true from 1.0.0 (step 2), and the runbook has no
    go-public step.
  - `AGENTS.md`: a short "Branches and releases" section linking ADR 0008 with the agent rule above; add
    `0008` to the Rules index decisions range. The Workflow line about committing on a branch stays.
  - `CONTRIBUTING.md`, "Make a change": branch names per ADR 0008 and the changelog rule; a link to
    `docs/release.md` for maintainers (the file arrives in Phase 1; the link is fine until then).
- **Files:** `docs/adr/0008-branches-fixes-and-releases.md`, `docs/adr/0005-distribution-and-public-pages.md`,
  `AGENTS.md`, `CONTRIBUTING.md`
- **Verify:** `npx prettier --check docs/adr/0008-branches-fixes-and-releases.md docs/adr/0005-distribution-and-public-pages.md AGENTS.md CONTRIBUTING.md && npx vitest run tests/licence.test.ts && grep -n '0008' AGENTS.md && grep -n 'Amendment 2026-11-25: the repository is public' docs/adr/0005-distribution-and-public-pages.md`;
  format and the licence test pass, AGENTS.md links ADR 0008, and the amendment exists.
- **Out of scope:** Repository settings or rulesets; the release runbook (step 4); `README.md`; changing the
  release workflow.

## Phase 1: Version, changelog, privacy pages, store texts and runbook

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:chrome && npm run build:firefox && npm run check:privacy && npm run check:site && npm run zip && npm run zip:sources && ls .output/naciocheck-1.0.0-*.zip && grep -rl '1\.0\.0' .output/site/changelog/index.html .output/site/en/changelog/index.html .output/site/ca/changelog/index.html .output/site/privacy/index.html .output/site/en/privacy/index.html .output/site/ca/privacy/index.html`;
  every command exits 0, `ls` shows the chrome, firefox and sources zips for 1.0.0, and `grep` lists all six
  built pages. `test:e2e` is expected to fail on the visual baselines until Phase 2 and is not run here.

### 1. Bump the version to 1.0.0 and cut the changelog

- **Goal:** `package.json` `version` and the two root entries of `package-lock.json` (`version` and
  `packages[""].version`) say `1.0.0`, with no other lockfile change (edit by hand, or
  `npm version 1.0.0 --no-git-tag-version`, which neither commits nor tags). In `CHANGELOG.md`, the current
  `## [Unreleased]` entries move unchanged under `## [1.0.0] - <release day>`, and an empty `## [Unreleased]`
  (heading only) stays above it. `tests/changelog.test.ts`:
  - the real-file test asserts that the first release is `Unreleased` with no sections, the second is
    `1.0.0` with the release day's date, and that the newest dated version equals `package.json` `version`
    (so a future bump without a changelog cut fails);
  - the "empty state ... or with only Unreleased" test stops reading the real `CHANGELOG.md` and uses an inline
    Unreleased-only text instead;
  - a new test renders the real `CHANGELOG.md` and finds `<h2>1.0.0 <time datetime="<date>">`.
- **Files:** `package.json`, `package-lock.json`, `CHANGELOG.md`, `tests/changelog.test.ts`
- **Verify:** `git diff --numstat package.json package-lock.json && npx vitest run tests/changelog.test.ts && npx eslint tests/changelog.test.ts && npx prettier --check package.json CHANGELOG.md tests/changelog.test.ts && npm run build:chrome && npm run build:firefox && node -p "[require('./.output/chrome-mv3/manifest.json').version, require('./.output/firefox-mv3/manifest.json').version]"`;
  numstat shows 1 changed line in `package.json` and 2 in `package-lock.json`, the tests pass, no lint or format
  findings, and the last command prints `[ '1.0.0', '1.0.0' ]`.
- **Out of scope:** Rewording changelog entries; any other dependency or lockfile change; `npm install`;
  changing `scripts/changelog.mjs`; zipping (Phase verify does it).

### 2. Point the privacy pages at 1.0.0

- **Goal:** The lead line of the three privacy pages says the policy applies to NacioCheck `1.0.0` and later
  and was last reviewed on the release day, in each language's existing format. Nothing else on the pages
  changes (keep the line wrapping Prettier produces).
  Also (owner, 2026-11-25): the repository is public, so `site/_build/config.json` sets
  `repositoryPublic: true` (store URLs stay `null` until step 8), and the "real build inputs" test in
  `tests/build-site.test.ts` expects it. The site then shows its repository blocks (footer, landing, privacy)
  and links each dated changelog release to its GitHub release.
- **Files:** `site/privacy/index.html`, `site/en/privacy/index.html`, `site/ca/privacy/index.html`,
  `site/_build/config.json`, `tests/build-site.test.ts`
- **Verify:** `npx prettier --check site/privacy/index.html site/en/privacy/index.html site/ca/privacy/index.html site/_build/config.json tests/build-site.test.ts && npx eslint tests/build-site.test.ts && npx vitest run tests/build-site.test.ts tests/site-gate.test.ts tests/changelog.test.ts && git diff --stat site/ tests/`;
  format, lint and tests pass, and the diff touches only those five files.
- **Out of scope:** Any other wording in the policy; the Catalan review; running `check:site` (Phase verify).

### 3. Refresh the store listings and permission notes

- **Goal:** `store/listing.en.md` and `store/listing.es.md` describe the shipped feature set, using
  `CHANGELOG.md` 1.0.0 as the reference list: add the raw status text (the status exactly as the official site
  printed it) and the share panel (numbered timeline to copy, optional filing date) to the detailed
  description, in both languages with the same meaning; keep "Report a problem" accurate. Re-measure every
  field with the commands at the end of each listing and update the recorded measurements; check the detailed
  description against C6 (no keyword more than 5 times). The short description must still equal
  `extensionDescription` in `public/_locales/{en,es}/messages.json`.
  `store/permissions.md`: re-read against `wxt.config.ts` and refresh its "taken from" date; replace the AMO
  "Notes for reviewers" build line (`npm ci && npm run test && npm run build:firefox`, which does not work from
  the sources zip because WXT leaves the unit tests out) with a pointer to `docs/release.md`,
  section "AMO reviewer notes", keeping the injection and captcha sentences. Mark the privacy-policy line as
  needing the deployed site before the Chrome submission (see Q2).
  `store/REQUIREMENTS.md`: per Q4, re-read each source URL in the table (public store documentation only),
  update the "Read" dates, and report any limit that changed instead of silently adopting it.
- **Files:** `store/listing.en.md`, `store/listing.es.md`, `store/permissions.md`, `store/REQUIREMENTS.md`
- **Verify:** `npx vitest run tests/licence.test.ts tests/brand.test.ts && npx prettier --check store/listing.en.md store/listing.es.md store/permissions.md store/REQUIREMENTS.md`
  plus the measurement commands under "How it is measured" / "Cómo se comprueba" in each listing; tests and
  format pass, the AMO summary is at most 250 characters and the short description at most 132.
- **Out of scope:** Changing `public/_locales/` or any UI string (if the short description no longer fits,
  stop and ask); regenerating screenshots or promo images (if a claim no longer matches a screenshot, record
  it as a finding); categories and tags unless they are wrong.

### 4. Write the release runbook and the AMO reviewer notes

- **Goal:** `docs/release.md`, for 1.0.0 and later releases, written for the owner. Each step names who acts
  (always the owner, except where an agent may prepare text) and the evidence to keep. In order:
  1. Merge the bump PR (Phases 1 to 3) to `main` through the normal PR flow (link `CONTRIBUTING.md`).
  2. Deploy the site with `npm run deploy:site` so the 1.0.0 privacy policy is live at
     `https://naciocheck.vgr.cat/privacy/` before any store form asks for it (Q2) The changelog's "GitHub release" link for 1.0.0
     returns 404 until step 8 publishes the draft; that is expected.
  3. Dispatch **Release** on `main` (Actions tab); evidence: the run URL.
  4. Download the four assets of the draft `v<version>`; `sha256sum -c naciocheck-<version>-SHA256SUMS.txt`;
     rebuild the Firefox package from the downloaded sources zip with the commands in "AMO reviewer notes" and
     `cmp` it with the downloaded Firefox zip; evidence: the command output.
  5. Have an agent run `docs/manual-firefox-checklist.md` on the downloaded Firefox zip with the `firefox`
     MCP tools (the owner starts `firefox-agent --system` for `moz-extension://` pages); the owner does the
     rows that reach the real sede or need Android, by hand (Q3, step 12). Evidence: the checklist's
     result block for this version.
  6. Chrome Web Store: upload the Chrome zip; fill the listing from `store/listing.es.md` / `listing.en.md`,
     the images from `store/` and `store/screenshots/`, and the Privacy practices tab from
     `store/permissions.md`; evidence: the submission confirmation and later the listing URL.
  7. addons.mozilla.org: upload the Firefox zip and the sources zip, paste "AMO reviewer notes", fill the
     listing and the data answers from the `store/` files; evidence: the version page and later the listing URL.
  8. After both stores accept: publish the GitHub draft (creates the tag `v<version>`); evidence: release URL.
  9. Check the repository settings with `node scripts/check-github-settings.mjs` and `docs/github-settings.md`
     (the repository is already public, ADR 0005 amendment; no go-public step).
  10. Post-release: hand the store URLs to an agent for the Phase 2 PR (config, README), merge it, run
      `npm run deploy:site` again and the post-release site checks in `docs/pre-release-audit-2026-11-18.md`
      ("Landing site", "Landing polish").
      A section `## AMO reviewer notes`: plain text that can be pasted into the AMO form as is (no Markdown that
      would show as symbols, inside a fenced block), stating: what WXT does (bundling, minifying); Node from
      `.nvmrc` (24.22.1) and npm; unzip the sources zip into an empty directory; `npm ci`; the exact build command
      and where the output lands; that the result is byte-identical to the uploaded Firefox zip; that
      `npm run check:privacy` (after `npm run build:chrome && npm run build:firefox`) shows the permissions; the
      injection scope and that the captcha is solved by the person. Use the same command sequence the
      2026-11-18 audit rebuild used (`npm ci`, then `npx wxt zip -b firefox`, output in `.output/`) unless step 7
      shows a different one is needed. Check the AMO notes field limit in `store/REQUIREMENTS.md` (A3) and stay
      within it.
- **Files:** `docs/release.md`
- **Verify:** `npx prettier --check docs/release.md && grep -n '^## AMO reviewer notes$' docs/release.md && grep -c 'store/' docs/release.md`;
  format passes, the section exists, and the store steps reference the `store/` files. The commands
  themselves are exercised in step 7.
- **Out of scope:** Repeating `docs/github-settings.md` or the manual checklist; changing `release.yml`;
  running any of the owner's steps; linking the runbook from README (step 5).

### 5. Update the remaining version references

- **Goal:** Every `0.1.0` / `0.x` outside historical records is updated or deliberately kept:
  - `README.md`: the byte-for-byte note says "checked for 1.0.0" (proved in step 7; if step 7 fails, this
    line is reverted with the fix); the status badge and the note at the top drop `0.x` and stay
    "pre-release" (wording per Q1); the "Continuous integration and releases" section links `docs/release.md`;
    the "Firefox" testing paragraph matches the step 12 wording (step 5 owns `README.md` in this phase).
  - `SECURITY.md`: "pre-release (0.x)" becomes the Q1 wording; the support rule stays.
  - Kept, with the reason, for the progress log: `docs/manual-firefox-checklist.md` result and sign-off
    (historical record of the 0.1.0 run), `docs/pre-release-audit-2026-11-18.md` (historical),
    `docs/github-settings.md:156` and `tests/check-github-settings.test.ts` (example tag in a rule
    explanation), `tests/site-gate.test.ts:838` (sample allowed URL), `tests/feedback-page.test.ts:310`
    (sample report text), past specs.
    The builder reports the kept list in its summary so the orchestrator can log it.
- **Files:** `README.md`, `SECURITY.md`
- **Verify:** `npx prettier --check README.md SECURITY.md && npx vitest run tests/licence.test.ts tests/brand.test.ts && git grep -nE '0\.1\.0|0\.x' -- . ':!specs' ':!docs/pre-release-audit-2026-11-18.md'`;
  format and tests pass, and the grep lists only the kept lines above.
- **Out of scope:** Store badges, install section and "not in the stores yet" warnings (Phase 4); editing the
  checklist or the audit.

### 12. Let an agent run the Firefox checklist (amend ADR 0007)

Numbered 12 so steps 6 to 11 keep their numbers; it belongs to Phase 1 and runs in parallel with steps 1 to 5.

- **Goal:** Record the owner's 2026-11-25 decision (Q3): the Firefox desktop checklist is no longer run by
  hand; before each release an agent runs it against the store-bound Firefox zip with the `firefox` MCP tools.
  The owner starts `firefox-agent --system` when `moz-extension://` pages need system access (agents never run
  `--system` themselves). Rows that reach the real sede (row 7 and the real check in row 8) and anything on
  Firefox for Android stay the owner's, by hand: no agent or tool reaches the live sede (AGENTS.md).
  - `docs/adr/0007-testing-strategy.md`: an `## Amendment 2026-11-25` section (Context, Decision,
    Consequences, "accepted 2026-11-25 by the owner"), in the style of ADR 0005's amendments. The original
    Decision text stays; the title is left as is.
  - `AGENTS.md`: the Standards line "Firefox desktop is verified by hand…" says an agent runs the checklist
    with the `firefox` MCP tools before each release, and the owner does the live-sede and Android rows.
  - `docs/manual-firefox-checklist.md`: the intro and "Before you start" say who runs what (agent through the
    `firefox` tools; owner for the live-sede rows), and how to load the zip in that session. The checks, the
    0.1.0 result block and its sign-off stay as written (historical record); the 1.0.0 run adds its own block.
  - `npm run test:e2e:firefox` and `e2e/` stay unchanged.
- **Files:** `docs/adr/0007-testing-strategy.md`, `AGENTS.md`, `docs/manual-firefox-checklist.md`
- **Verify:** `npx prettier --check docs/adr/0007-testing-strategy.md AGENTS.md docs/manual-firefox-checklist.md && grep -n 'Amendment 2026-11-25' docs/adr/0007-testing-strategy.md && grep -n 'firefox' AGENTS.md`;
  format passes, the amendment exists, and AGENTS.md no longer says "verified by hand".
- **Out of scope:** Running the checklist (it runs on the draft's zip, runbook step 5); changing the checks
  themselves; any Firefox E2E automation in `e2e/`; `README.md` (step 5).

### 13. Create the repository brand preview image

Numbered 13 so steps 6 to 11 keep their numbers; it belongs to Phase 1 and runs in parallel with steps 1 to 5
and 12.

- **Goal:** The GitHub social preview for the repository is part of the brand kit and is uploaded when the
  repository goes public.
  - `brand/social-preview.png` (already in the working tree): 1280×640 PNG, the icon, the NacioCheck
    wordmark and the English tagline on the dark brand background. Keep it as is; check it has no text,
    EXIF or XMP metadata chunks and shows no personal data.
  - `brand/README.md`: a short "GitHub social preview" entry naming the file, its size, what it shows, and
    that it is uploaded by the owner, not served by the site or shipped in the extension (the site keeps its
    own generated `social-card.png`).
  - `docs/github-settings.md`, section "General": an owner step to upload `brand/social-preview.png` under
    Settings > General > Social preview. If `scripts/check-github-settings.mjs` or its tests expect every
    `**\`id\`**` entry in the file to be checked, write it as a plain note outside the ID list; the script is
    not changed.
- **Files:** `brand/social-preview.png` (unchanged, tracked), `brand/README.md`, `docs/github-settings.md`
- **Verify:** `python3 -c "import struct;d=open('brand/social-preview.png','rb').read();print(struct.unpack('>II',d[16:24]))" && npx prettier --check brand/README.md docs/github-settings.md && npx vitest run tests/check-github-settings.test.ts tests/brand.test.ts && grep -n 'social-preview.png' brand/README.md docs/github-settings.md`;
  the size prints `(1280, 640)`, format and tests pass, and both docs name the file. The builder lists the PNG
  chunk types in its summary (only `IHDR`, `pHYs`, `IDAT`, `IEND` expected).
- **Out of scope:** Uploading the image (owner, after the repository is public); changing the site's social
  card or `scripts/build-site.mjs`; regenerating the image; `docs/release.md` (step 4 already links
  `docs/github-settings.md` from the go-public step).

## Phase 2: Visual baselines for the 1.0.0 text

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e`;
  everything passes, the network guard summary reads `outside it 0`, and the visual spec has no mismatch.

### 6. Update the visual baselines that show the new text

- **Goal:** The tracked baselines match the 1.0.0 build. Run `npm run test:e2e:update-baselines`, then
  `git status --porcelain e2e/baselines`. Expected changes only: every `site-*` image (48: the footer's repository block
  from step 2 is on every site page; the changelog also shows 1.0.0 and the privacy pages the new lead line)
  and possibly `result-error-report-*` (4, if the report text shows the version). Any other changed or missing image: stop and report; do not keep it. Then
  `npm run test:e2e` passes against the new baselines. Report the changed list so the owner can run
  `/review-ui` on them.
- **Files:** `e2e/baselines/chrome/site-*.png`, `e2e/baselines/chrome/result-error-report-*.png`
- **Verify:** `npm run test:e2e:update-baselines && git status --porcelain e2e/baselines && npm run test:e2e`;
  only the expected images change, and the full E2E run passes with `outside it 0`.
- **Out of scope:** Any source, CSS or spec change to make a screenshot pass; store screenshots (they are
  copies of extension baselines that must not change).

## Phase 3: Clean-checkout rehearsal

- **Phase verify:** `git status --porcelain`; no tracked file changed by this phase (evidence goes to
  `progress.md` through `/implement-phase`).

### 7. Rehearse the release from a fresh clone

- **Goal:** Evidence for the rehearsal criterion. Needs Phases 1 and 2 committed by the owner (Q6). Under
  Node 24.22.1 (`nvm use`):
  1. `git clone --no-hardlinks /home/vagonzal/repos/nationality-status <scratchpad>/rehearsal/repo` and
     `git -C <...> checkout <bump commit>`; record the hash.
  2. In the clone: `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`,
     `npm run build:chrome`, `npm run build:firefox`, `npm run check:privacy`, `npm run check:site`,
     `npm run zip`, `npm run zip:sources`, `npm run test:e2e`; record exit codes, the test counts and the
     network guard line; check both manifests in the zips say `1.0.0`.
  3. Unzip `naciocheck-1.0.0-sources.zip` into a new empty directory and run exactly the commands in
     `docs/release.md` "AMO reviewer notes"; `cmp` the result with the clone's `naciocheck-1.0.0-firefox.zip`.
  4. `sha256sum` of the three zips, for comparison with the owner's draft later.
     On any failure: stop, record it, and do not fix anything in this step (a fix is a new step).
- **Files:** none in the repository; scratchpad only.
- **Verify:** the commands above; every gate exits 0, `test:e2e` reports `outside it 0`, and `cmp` exits 0.
- **Out of scope:** Pushing, dispatching `Release`, uploading anything, reaching the live sede.

## Phase 4: Post-release site and README (second PR, blocked until the owner says go)

Starts only when the owner reports both listings live and gives the two URLs.
The spec stays `active` until then.

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:site && grep -rL 'Próximamente\|Coming soon\|Properament' .output/site/index.html .output/site/en/index.html .output/site/ca/index.html && grep -l 'releases/tag/v1.0.0' .output/site/changelog/index.html .output/site/en/changelog/index.html .output/site/ca/changelog/index.html`;
  all pass, the three landing pages carry no "coming soon" label, and the three changelogs link the release.

### 8. Set the store URLs in the site config

- **Goal:** `site/_build/config.json` holds the owner-supplied `chromeStoreUrl` (prefix
  `https://chromewebstore.google.com/`) and `firefoxStoreUrl` (prefix `https://addons.mozilla.org/`, see Q5); `repositoryPublic` is already
  `true` (step 2). The "real build inputs" test in `tests/build-site.test.ts` expects those values.
- **Files:** `site/_build/config.json`, `tests/build-site.test.ts`
- **Verify:** `npx vitest run tests/build-site.test.ts tests/site-gate.test.ts && npx prettier --check site/_build/config.json tests/build-site.test.ts && npx eslint tests/build-site.test.ts`;
  tests, format and lint pass.
- **Out of scope:** Changing `scripts/build-site.mjs`, `check-site.mjs` or their allowed prefixes; deploying.

### 9. Point the README and SECURITY.md at the released 1.0.0

- **Goal:** README: the store badges link to the two listings (shields.io, as now); the status badge and the
  top note say 1.0.0 is released in both stores; the "not in the stores yet" warning and "will be published" /
  "will be added" wording in Install go, and the install steps link the listings; "For developers" names the
  stores as live. The README's website paragraph about `null` store URLs stays (it documents the build).
  `SECURITY.md`: drop "pre-release" from the support line.
- **Files:** `README.md`, `SECURITY.md`
- **Verify:** `npx prettier --check README.md SECURITY.md && npx vitest run tests/licence.test.ts tests/brand.test.ts && grep -niE 'coming soon|not in the stores|stores yet|pre-release \(' README.md SECURITY.md`;
  format and tests pass, and the grep finds only the documented build behaviour line (`"Coming soon"` in "The
  website").
- **Out of scope:** Store or site texts; any other README section.

## Phase 5: Post-release baselines and close-out

- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run check:site && npm run test:e2e`;
  all pass, `outside it 0`, no visual mismatch.

### 10. Update the site baselines for the store links

- **Goal:** Run `npm run test:e2e:update-baselines`; expected changes only in `site-*` images (install
  buttons, source-code links, changelog release link). Any extension-page image change: stop and report. Then
  `npm run test:e2e` passes. Report the list for `/review-ui`.
- **Files:** `e2e/baselines/chrome/site-*.png`
- **Verify:** `npm run test:e2e:update-baselines && git status --porcelain e2e/baselines && npm run test:e2e`;
  only `site-*` images change and the run passes with `outside it 0`.
- **Out of scope:** Source or style changes.

### 11. Close the spec and list the owner's post-release checks

- **Goal:** The builder's summary lists, for the orchestrator to log in `progress.md`, the owner's
  post-release checks: `npm run deploy:site`; the "Landing site" and "Landing polish" checks from the audit
  (Catalan wording, Chrome and Firefox rendering incl. checklist row 17, theme switcher in Firefox and Safari,
  high contrast, screen reader, Turnstile on the feedback page, the axe colour-contrast look). None is marked
  done. `spec.md` frontmatter: `status: done`, `status-date: <date +%F>`. The audit's "Landing site" row is
  changed only if the owner's own message gives the decision, and then written exactly as the owner would.
- **Files:** `specs/2026-11-25-v1-release/spec.md` (frontmatter only); `docs/pre-release-audit-2026-11-18.md`
  only with the owner's sign-off.
- **Verify:** `head -5 specs/2026-11-25-v1-release/spec.md && npx prettier --check specs/2026-11-25-v1-release/spec.md`;
  status reads `done` with today's date.
- **Out of scope:** Running any owner check; deploying; marking any check done on the owner's behalf.

## Risks / open questions

Resolved by the owner on 2026-11-25:

- **Q1 (step 5): README and SECURITY.md wording between the bump and the stores.** Amend the lines that say
  `0.x` or `0.1.0` by removing or rewording them, so nothing states a version that is wrong after the bump;
  the README keeps a "pre-release" status line until Phase 4. The builder picks the smallest wording that is
  true; the plan's default (badge `status: pre-release`, note "**Status: pre-release.** Version 1.0.0 is being
  prepared for the stores and is not published yet.", SECURITY.md "The project is pre-release.") is fine.
- **Q2 (step 4): deploying the site before the store uploads.** Yes: the runbook has the owner run
  `npm run deploy:site` right after the merge, before the store uploads, and again after Phase 4.
- **Q3 (steps 4 and 12): Firefox checklist.** No longer run by hand: an agent runs it with the `firefox` MCP
  tools (`firefox-agent`) on the draft's Firefox zip; the owner keeps the live-sede and Android rows. Step 12
  records this in ADR 0007, AGENTS.md and the checklist; the 0.1.0 sign-off table stays as a historical record.
- **Q4 (step 3): re-reading the store rules online.** Yes: the builder re-reads the public pages already
  listed in `store/REQUIREMENTS.md` (no new URLs), updates the "Read" dates and reports any changed limit.
- **Q5 (step 8): store URL form.** AMO without a locale segment
  (`https://addons.mozilla.org/firefox/addon/<slug>/`); Chrome as the dashboard shows it.
- **Q6 (step 7): the rehearsal needs commits.** Accepted: the owner commits Phases 1 and 2 on
  `release/v1.0.0` first; the rehearsal clones that commit; a failure blocks the PR and reverts the "checked for 1.0.0" README line.
- **GitHub release link before publication (step 2).** With `repositoryPublic: true`, the site's 1.0.0
  changelog entry links `releases/tag/v1.0.0`, which returns 404 from the first `deploy:site` (runbook step 2)
  until the owner publishes the draft (runbook step 8). Accepted as a short, visible gap; the runbook says so.
- **Changelog date vs. release day.** The `[1.0.0]` date is the bump day per the spec, not the day the draft
  is published. If store review takes days, the date stays.
- **Baselines.** Steps 6 and 10 regenerate all 152 images; the expected change sets are listed. A font or
  Chrome for Testing update can change unrelated images (README "Visual baselines"); the builder stops rather
  than accepting them.
