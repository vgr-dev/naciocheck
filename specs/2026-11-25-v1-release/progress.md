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
- **Commit:** 88ebfd3 (squash-merged as #8)
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

## 2026-11-25 - Step 1: Bump the version to 1.0.0 and cut the changelog

- **Status:** done
- **Branch:** `release/v1.0.0` (from `main` at `88ebfd3`)
- **Changed:** `package.json`, `package-lock.json` (root `version` and `packages[""].version` only, no
  install), `CHANGELOG.md` (empty `[Unreleased]`, entries under `[1.0.0] - 2026-11-25`), `tests/changelog.test.ts`
  (real file: Unreleased empty, 1.0.0 dated 2026-11-25, newest dated version equals `package.json`; empty-state test
  uses inline text; new render test of the real file)
- **Verified:** numstat 1/1 and 2/2; `npx vitest run tests/changelog.test.ts` -> pass (17); eslint and prettier
  -> clean; both builds -> pass; manifests -> `[ '1.0.0', '1.0.0' ]`.
- **Commit:** a54780b
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
chore: release 1.0.0 and cut the changelog
```

- **Open issues:** none.

## 2026-11-25 - Step 2: Point the privacy pages at 1.0.0 and mark the repository public

- **Status:** done
- **Changed:** `site/privacy/index.html`, `site/en/privacy/index.html`, `site/ca/privacy/index.html` (lead line
  only: "1.0.0 and later", last reviewed 25 November 2026 in each language's format), `site/_build/config.json`
  (`repositoryPublic: true`, store URLs `null`), `tests/build-site.test.ts` (real build inputs expectation)
- **Verified:** prettier and eslint -> clean; `npx vitest run tests/build-site.test.ts tests/site-gate.test.ts
tests/changelog.test.ts` -> pass (610); diff stat shows the five files (plus step 1's test file).
- **Commit:** b286a91
- **Run by:** implement-phase (builder subagent, model Haiku)
- **Proposed commit (builder):**

```
docs: point privacy pages at 1.0.0 and mark repo public
```

- **Open issues:** none.

## 2026-11-25 - Step 3: Refresh the store listings and permission notes

- **Status:** done
- **Changed:** `store/listing.en.md`, `store/listing.es.md` (two bullets: the status as the sede printed it; the
  share timeline), `store/permissions.md` (re-checked against `wxt.config.ts`; privacy policy must be live
  before the Chrome submission; AMO build line points to `docs/release.md` "AMO reviewer notes"),
  `store/REQUIREMENTS.md` (Read dates 2026-11-25 on C1–C10 and A1–A7, A6 wording, four notes)
- **Verified:** `npx vitest run tests/licence.test.ts tests/brand.test.ts` -> pass (39); prettier -> clean;
  measurements: short description en 103 / es 125 (limit 132), AMO summary en 246 / es 250 (limit 250),
  short description equals `extensionDescription` in both locales; C6 topical keywords at most 5.
- **Store-rule re-read:** all 13 listed URLs read OK on 2026-11-25; no limit changed. Four pages were not read to the
  end (A3/A4 last 158 characters, A5 last 2912, A6 last 1332, A7 last 6662).
- **Commit:** 86d886d
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
docs: refresh store listings and permission notes for 1.0.0
```

- **Open issues:** The ES AMO summary is exactly 250 characters (no slack). Mozilla announces Add-on Policies
  changes for 2026-12-01: re-read A7 if a submission is still pending then. AMO's default reviewer
  environment is Node 24.14.0 / npm 11.9.0 on Ubuntu 24.04, while `.nvmrc` pins 24.22.1. A8 (gecko id
  permanent) is not stated on the AMO page; it keeps its 2026-11-16 source. Screenshots were not compared
  with the new bullets (no claim conflicts).

## 2026-11-25 - Step 4: Write the release runbook and the AMO reviewer notes

- **Status:** done
- **Changed:** `docs/release.md` (new: before you start, ten owner steps with who acts and evidence, "If
  something goes wrong", "Patch release" per ADR 0008, "AMO reviewer notes", "Related")
- **Verified:** prettier -> clean; `## AMO reviewer notes` at line 183; 14 `store/` references; licence test
  -> pass (13).
- **Commit:** ab0293c, then f7fb0c7 (support email)
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
docs: add the release runbook and the AMO reviewer notes
```

- **Open issues:** AMO notes are 2029 characters; `store/REQUIREMENTS.md` records no limit for that field.
  The notes name Node 24.22.1 but no build OS. The AMO form wording about minified
  code is from memory, to be read against the live form. Draft assets are downloaded in the browser (no
  `gh release download` for drafts). The 1.0.0 checklist result block is kept with the release evidence and
  added to the checklist in the post-release PR.
- **Fix (orchestrator, owner request):** runbook step 7 now names the support email `naciocheck@vgr.cat`
  (ADR 0005) instead of "a support email of your choice".

## 2026-11-25 - Step 5: Update the remaining version references

- **Status:** done
- **Changed:** `README.md` (badge `status: pre-release`; note "Version 1.0.0 is being prepared for the stores
  and is not published yet."; "checked for 1.0.0", to be proven by step 7; link to `docs/release.md`; Firefox
  paragraph matches step 12), `SECURITY.md` ("The project is pre-release.")
- **Verified:** prettier -> clean; licence and brand tests -> pass (39). The plan's grep is too broad (matches
  `10.1.0` in `package-lock.json` and bytes in two PNG baselines); the orchestrator re-ran it as
  `git grep -InE '(^|[^0-9.])(0\.1\.0|0\.x)' -- . ':!specs' ':!docs/pre-release-audit-2026-11-18.md' ':!package-lock.json'`
  -> only kept lines.
- **Kept:** `docs/manual-firefox-checklist.md` 0.1.0 result block and its notes, `docs/adr/0007-testing-strategy.md:55`
  (historical record), `docs/github-settings.md:156`, `tests/check-github-settings.test.ts` (example tag
  `v0.1.0`), `tests/feedback-page.test.ts:310` (sample report), `tests/site-gate.test.ts:838` (sample URL), the
  audit and past specs.
- **Commit:** 08c343b
- **Run by:** implement-phase (builder subagent, model Haiku)
- **Proposed commit (builder):**

```
docs: drop the 0.x wording from README and SECURITY
```

- **Open issues:** The "checked for 1.0.0" line is reverted if step 7 fails.

## 2026-11-25 - Step 12: Let an agent run the Firefox checklist (amend ADR 0007)

- **Status:** done
- **Changed:** `docs/adr/0007-testing-strategy.md` (amendment "an agent runs the Firefox checklist"; what an
  agent cannot observe is recorded as not observed, never PASS; fallback to a manual run), `AGENTS.md`
  (Standards line), `docs/manual-firefox-checklist.md` ("Who runs what", "Before you start" step 3 with
  `install_extension` under `firefox-agent --system`, "Data", closing note; checks and 0.1.0 record unchanged)
- **Verified:** prettier -> clean; amendment at line 33; "verified by hand" gone from `AGENTS.md`.
- **Commit:** 504ece5
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
docs: let an agent run the Firefox checklist (ADR 0007 amendment)
```

- **Open issues:** Row 15 (an actual failed check) may need a real sede request and is not assigned to the
  owner yet; the 1.0.0 result block should say who ran it.

## 2026-11-25 - Step 13: Create the repository brand preview image

- **Status:** done
- **Changed:** `brand/README.md` ("GitHub social preview" section), `docs/github-settings.md` (plain note in
  "General" to upload the image; not an id entry), `brand/social-preview.png` unchanged and still untracked
- **Verified:** size `(1280, 640)`; chunks `IHDR`, `pHYs`, `IDAT`, `IEND` only; prettier -> clean;
  `tests/check-github-settings.test.ts`, `tests/brand.test.ts` -> pass (130); `tests/github-settings-doc.test.ts`
  -> pass (10).
- **Commit:** c2f8e2b
- **Run by:** implement-phase (builder subagent, model Haiku)
- **Proposed commit (builder):**

```
docs: add the GitHub social preview image and upload step
```

- **Open issues:** The upload is the owner's.

## 2026-11-25 - Phase 1: Version, changelog, privacy pages, store texts and runbook

- **Status:** done
- **Steps:** 1 done, 2 done, 3 done, 4 done, 5 done, 12 done, 13 done
- **File check:** pass (every changed file is in the Files of the step that reported it; `plan.md` and
  `progress.md` are the orchestrator's)
- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:chrome && npm run build:firefox && npm run check:privacy && npm run check:site && npm run zip && npm run zip:sources && ls .output/naciocheck-1.0.0-*.zip && grep -rl '1\.0\.0' <six built pages>`
  -> pass (unit 42 files / 1697 tests, worker 2 / 31; privacy gate 56 files; site gate 15 pages; the three
  1.0.0 zips; six pages list 1.0.0)
- **Commit proposal:** seven commits, one per step (see the reply), then the spec log.
- **Open issues:** `test:e2e` fails on the visual baselines until Phase 2 (expected). Row 15 of the checklist, AMO notes build OS (see steps 3, 4, 12).

## 2026-11-25 - Step 6: Update the visual baselines that show the new text

- **Status:** done
- **Changed:** 51 images in `e2e/baselines/chrome/`: all 48 `site-*` (12 each of `site-404`, `site-changelog`,
  `site-landing`, `site-privacy`) and 3 `result-error-report-*` (`en-1280x800`, `en-412x915`, `es-1280x800`;
  `es-412x915` unchanged). None added, deleted or restored; every other image unchanged.
- **What changed:** changelog shows `1.0.0 2026-11-25` with its Added list; privacy lead line says 1.0.0 and
  25 November 2026; every site footer gains "Source code (GPL-3.0)" (repository block); the error report text
  says `version: 1.0.0`. In `site-404-*-es-1280x800` the longer "Código fuente (GPL-3.0)" moves the theme
  switcher to its own line under the credit (checked by the orchestrator: aligned and readable).
- **Verified:** `npm run test:e2e:update-baselines` -> pass (Chrome for Testing 158.0.8127.88, `system-ui` =
  DejaVu Sans); `git status --porcelain e2e/baselines` -> 51 modified, all expected; `npm run test:e2e` -> 6/6
  specs, 170 tests, `outside it 0`.
- **Commit:** a5b2ecb
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
test: update visual baselines for the 1.0.0 site and report text
```

- **Open issues:** Run `/review-ui` on the changed images, especially the es and ca footers at 1280 where
  the new link wraps the row. Local Node is v24.22.0, while `.nvmrc` pins 24.22.1 (step 7 must use 24.22.1).

## 2026-11-25 - Phase 2: Visual baselines for the 1.0.0 text

- **Status:** done
- **Steps:** 6 done
- **File check:** pass (51 baselines in step 6's Files; `plan.md` and `progress.md` are the orchestrator's,
  with the Phase 1 commit hashes recorded)
- **Phase verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e`
  -> pass (unit 1697, worker 31; E2E 6/6 specs, 170 tests, no visual mismatch; every network guard line
  `outside it 0`; `check-flow` reads seen 621 / answered 620 / outside 0, one request neither answered nor
  outside, not a gate failure)
- **Commit proposal:** (1) `test: update visual baselines for the 1.0.0 site and report text`; (2) spec log.
- **Open issues:** `/review-ui` on the 51 images; Node 24.22.1 for step 7.

## 2026-11-25 - Step 7: Rehearse the release from a fresh clone

- **Status:** done
- **Cloned:** `8cafbedab3cee1bb3d661f361dcfc9ecdaa10e80` (HEAD of `release/v1.0.0`) with `git clone --no-hardlinks`
  into the session scratchpad; clone clean after the run. Node `v24.22.1` (installed with nvm for this step),
  npm `11.19.1`, in the clone and in the sources directory.
- **Changed:** nothing in the repository.
- **Verified (clone):** `npm ci`, `format:check`, `lint`, `typecheck`, `npm test`, `build:chrome`,
  `build:firefox`, `check:privacy`, `check:site`, `zip`, `zip:sources`, `test:e2e` -> all exit 0. Unit 42 files
  / 1697 tests, worker 2 / 31, E2E 6/6 specs / 170 tests. Network guard: 622/621/0, 523/523/0, 376/376/0,
  346/346/0, 0/0/0, 1063/1063/0 (seen / answered / outside). Privacy gate: storage, alarms, notifications;
  one host; notices in every build. Site gate: 15 pages.
- **Manifests in the zips:** chrome `1.0.0`; firefox `1.0.0`, gecko id `naciocheck@vgr.cat`, `strict_min_version`
  128.0, `data_collection_permissions` required `none`. Sources zip: 374 files, `package.json` 1.0.0, `.nvmrc`
  24.22.1.
- **Rebuild from the sources zip** (commands in `docs/release.md` "AMO reviewer notes"): `npm ci`,
  `build:chrome`, `build:firefox`, `check:privacy`, `npx wxt zip -b firefox` -> all exit 0; `cmp` with the
  clone's Firefox zip -> exit 0 (byte-identical). The README line "checked for 1.0.0" is proven.
- **sha256** (identical in the clone and the sources rebuild; re-checked by the orchestrator):
  - `naciocheck-1.0.0-chrome.zip` `8194d37ad1735f4ff6e336c732b127e0dc236821cebe5c8ca4cdb62d30d38d29` (106014 bytes)
  - `naciocheck-1.0.0-firefox.zip` `54402e0aa821274fc8453064fc7459e7074378c68a41034997cc2ef52a8cd9c0` (106095 bytes)
  - `naciocheck-1.0.0-sources.zip` `5da2f1ef41ad8edcce7599e3c13913f10fc87e25b728da7bb1e6280b3513d325` (25650815 bytes)
- **Commit:** none (no repository change)
- **Run by:** implement-phase (builder subagent, model Sonnet)
- **Proposed commit (builder):**

```
none (no repository change)
```

- **Open issues:** `npm ci` warns about install scripts not covered by `allowScripts` (workerd x2, edgedriver,
  esbuild, geckodriver) and a deprecated `whatwg-encoding@3.1.1`; an AMO reviewer will see the same output.
  WebdriverIO warns that root-level compare options are deprecated. `check-flow` again shows one request seen
  but neither answered nor outside (622/621/0; Phase 2 had 621/620/0): consistent, not a gate failure, worth a
  look later. The draft's CI-built zips may differ from these checksums (different machine); the gate is the
  draft's own SHA256SUMS plus the rebuild in runbook step 4.

## 2026-11-25 - Phase 3: Clean-checkout rehearsal

- **Status:** done
- **Steps:** 7 done
- **File check:** pass (no repository file changed by the builder; `plan.md` and `progress.md` are the
  orchestrator's)
- **Phase verify:** `git status --porcelain` -> pass (only `plan.md` and `progress.md`, the orchestrator's log)
- **Commit proposal:** one commit, the spec log.
- **Open issues:** PR 1 (Phases 1 to 3) is ready for review and merge; Phases 4 and 5 wait for the store URLs.
