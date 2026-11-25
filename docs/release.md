# Releasing NacioCheck

The owner's runbook for putting a version into the Chrome Web Store and addons.mozilla.org (AMO), from 1.0.0
on. The decisions behind it are ADR 0005 (store-only distribution, public pages) and ADR 0008 (branches, fixes
and releases). Every step names who acts and the evidence to keep. Evidence never contains personal data: the
repository is public, so a real NIE, name or birth date goes nowhere near a log, a note or a screenshot.

Agents prepare text and run offline checks. They never dispatch the workflow, upload to a store, publish the
draft release, change repository settings or run `npm run deploy:site`. Those are the owner's.

Below, `<version>` is the number in `package.json` (for example `1.0.0`) and the tag is `v<version>`.

## Before you start

- The release pull request (`release/v<version>`) has the version bump in `package.json` and
  `package-lock.json`, the dated `## [<version>]` section in `CHANGELOG.md`, the privacy pages' "last
  reviewed" date, the refreshed `store/` files and baselines that match. Its checks are green.
- You can sign in to the Chrome Web Store developer dashboard and to the AMO developer hub, and you have the
  `gh` CLI signed in with access to `vgr-dev/naciocheck` (for the settings check in step 9).
- Node from `.nvmrc` (24.22.1) is active: `nvm use`.

## The steps

### 1. Merge the release pull request

- **Who:** owner.
- **Do:** merge the `release/v<version>` pull request into `main` through the normal flow described in
  [`CONTRIBUTING.md`](../CONTRIBUTING.md) (squash merge, required checks green). Then update your checkout:
  `git switch main && git pull`.
- **Evidence:** the pull request URL and the merge commit hash on `main`.

### 2. Deploy the site

- **Who:** owner.
- **Do:** from `main`, run `npm ci && npm run deploy:site` (it runs `npm run check:site` first). The store forms
  ask for the privacy policy, so `https://naciocheck.vgr.cat/privacy/` must already show the policy for this
  version before step 6 or 7.
- **Expect:** the changelog on the site links this version's "GitHub release" to `releases/tag/v<version>`. That
  link returns 404 until step 8 publishes the draft. This short, visible gap is accepted.
- **Evidence:** the command output, and a look at `/privacy/`, `/en/privacy/` and `/ca/privacy/` in a browser.

### 3. Dispatch the Release workflow

- **Who:** owner.
- **Do:** on GitHub, Actions tab, **Release**, **Run workflow** on `main`. The workflow runs the same gates as
  CI, builds both browsers, writes the zips and the checksums, and creates a draft GitHub release `v<version>`
  built from the commit it ran on. It refuses to run off `main` and fails if a release or tag for this version
  already exists. It does not create the tag; publishing the draft does (step 8).
- **Check:** the run's commit is the merge commit from step 1.
- **Evidence:** the run URL.

### 4. Verify the draft's files

- **Who:** owner.
- **Do:** open the draft release and download its four assets into an empty directory outside the repository:
  `naciocheck-<version>-chrome.zip`, `naciocheck-<version>-firefox.zip`, `naciocheck-<version>-sources.zip`
  and `naciocheck-<version>-SHA256SUMS.txt`. Then, in that directory:

  ```sh
  sha256sum -c naciocheck-<version>-SHA256SUMS.txt
  ```

  Rebuild the Firefox package from the downloaded sources zip with the commands in the "AMO reviewer notes"
  section below (unzip into a new empty directory, `nvm use` there, run the notes' commands), then compare:

  ```sh
  cmp naciocheck-<version>-firefox.zip <rebuild directory>/.output/naciocheck-<version>-firefox.zip
  ```

- **Expect:** every line `OK`; `cmp` prints nothing and exits 0. If either fails, stop: do not upload
  anything. Delete the draft (no tag exists yet), find the cause through a pull request and dispatch again.
- **Evidence:** the output of both commands, and the Node version used.

### 5. Run the Firefox checklist on the downloaded zip

- **Who:** an agent runs the checklist with the `firefox` MCP tools; the owner starts `firefox-agent --system`
  first (the add-on's `moz-extension://` pages need system access; agents never start it themselves). The
  owner does by hand the rows that reach the real sede (row 7 and the real check in row 8) and anything on
  Firefox for Android: no agent or tool reaches the live sede (ADR 0007, amendment 2026-11-25).
- **Do:** follow [`docs/manual-firefox-checklist.md`](manual-firefox-checklist.md) against the downloaded
  `naciocheck-<version>-firefox.zip` (the file that goes to AMO), not against a fresh local build. Row 17, the
  deployed site, is checked after step 2 and again after step 10.
- **Expect:** every row passes, or a failure is recorded and fixed through a pull request (then back to step 3
  with a patch version, see "Patch release").
- **Evidence:** the checklist's result block for this version: version, Firefox version, operating system,
  date, result, who checked. Write only `PASS`, `FAIL` or a short note, never personal data. Put it in the
  published release's notes (step 8) and add it to the checklist file in the post-release pull request.

### 6. Chrome Web Store

- **Who:** owner (an agent may prepare text from `store/`, never submit it).
- **Do:** in the developer dashboard, upload `naciocheck-<version>-chrome.zip` and fill the listing from the
  `store/` files:
  - Texts: `store/listing.en.md` (primary language English) and `store/listing.es.md` (Spanish): name, detailed
    description, category and tags. The short description comes from the manifest and equals
    `extensionDescription` in `public/_locales/{en,es}/messages.json`.
  - Images: the icon `store/icon-128.png`, the five screenshots per language in `store/screenshots/en/` and
    `store/screenshots/es/` (1280x800), and the promo tiles `store/promo-small-440x280.png` and
    `store/promo-marquee-1400x560.png`.
  - Privacy practices tab: the single purpose, the permission justifications, the remote-code answer and the
    data-usage answers from "Chrome Web Store, Privacy practices tab" in `store/permissions.md`, with the
    privacy policy URL `https://naciocheck.vgr.cat/privacy/` (live after step 2).
  - Re-read `store/REQUIREMENTS.md` (C1 to C9) if a form field or limit differs from it, and record the
    difference there.
- **Evidence:** the submission confirmation (a screenshot without personal data) and, once accepted, the
  listing URL.

### 7. addons.mozilla.org

- **Who:** owner (an agent may prepare text from `store/`, never submit it).
- **Do:** in the developer hub, upload `naciocheck-<version>-firefox.zip`, answer **yes** to "does your add-on
  use minified, bundled or generated code", and upload `naciocheck-<version>-sources.zip`. Then fill the
  listing:
  - Texts: the summary and the detailed description from `store/listing.en.md` and `store/listing.es.md`; the
    slug `naciocheck`; categories and tags as they say; licence `GPL-3.0-or-later`; support site
    `https://naciocheck.vgr.cat/` and the support email `naciocheck@vgr.cat` (the project's public contact,
    ADR 0005); Firefox for Android enabled.
  - Images: `store/icon-32.png` and `store/icon-64.png`, and the screenshots in `store/screenshots/`.
  - Data collection and privacy: the answers under "addons.mozilla.org, submission answers" in
    `store/permissions.md` (nothing collected, `"required": ["none"]`), and the privacy policy URL.
  - Notes for reviewers: paste the text of the "AMO reviewer notes" section below, exactly as it stands in the
    fenced block (without the fence lines).
- **Evidence:** the version page URL and its status, and later the listing URL.

### 8. Publish the draft release

- **Who:** owner, only after both stores have accepted the version.
- **Do:** edit the draft on GitHub, add the checklist result block from step 5 to its notes if you want it
  there, and **Publish release**. Publishing creates the tag `v<version>`; the `v*` tag rules then forbid
  moving or deleting it.
- **Evidence:** the release URL. The site's changelog link for this version now resolves.

### 9. Check the repository settings

- **Who:** owner.
- **Do:** run `node scripts/check-github-settings.mjs` and read [`docs/github-settings.md`](github-settings.md)
  for anything it cannot check (the first release also has the social preview upload listed there). The
  repository is already public (ADR 0005, amendment 2026-11-25), so there is no go-public step.
- **Expect:** no `DRIFT`, no `ERROR` and nothing `unavailable`.
- **Evidence:** the command output.

### 10. After the release: store links and site

- **Who:** owner gives the two listing URLs to an agent; the agent prepares the pull request; the owner reviews,
  merges and deploys.
- **Do:**
  1. Give the agent the Chrome listing URL and the AMO listing URL (AMO without a locale segment:
     `https://addons.mozilla.org/firefox/addon/naciocheck/`). The agent puts them in the site config, the
     README and `SECURITY.md` and refreshes the site baselines, on a `docs/v<version>-store-links` branch.
  2. Merge that pull request (step 1's flow).
  3. From `main`, run `npm run deploy:site` again.
  4. Run the post-release site checks from `docs/pre-release-audit-2026-11-18.md` ("Landing site" and
     "Landing polish"), including row 17 of the Firefox checklist.
- **Evidence:** the pull request URL, the deploy output, and each check marked done only by you.

## If something goes wrong

- **Before step 8:** no tag exists. Delete the draft release on GitHub, fix the cause through a normal pull
  request to `main`, and dispatch again (step 3). If the fix is user-visible, it needs a changelog line, and
  if the version had already been uploaded to a store, it needs a new version number (a store never accepts
  the same version twice).
- **After step 8:** the tag is permanent. Fix forward with a patch release.
- **A store rejects the version:** read the reviewer's message, fix through a pull request, and release the
  next patch version.

## Patch release

A fix after a release follows ADR 0008: there are no long-lived release branches and no backports, because the
stores serve only the latest version.

1. The fix goes to `main` as a `fix/<slug>` pull request, with a line under `## [Unreleased]` in
   `CHANGELOG.md` if people can see it.
2. A `release/v<x.y.z+1>` pull request then bumps `package.json` and `package-lock.json` to the patch version
   (`npm version <x.y.z+1> --no-git-tag-version` changes only those files), moves the `[Unreleased]` entries
   under a new `## [<x.y.z+1>] - <date>` heading (`date +%F`) and leaves an empty `## [Unreleased]` above it,
   and updates what that version needs (the privacy pages' "last reviewed" date if the policy applies from
   this version, the store texts and screenshots if they changed). `tests/changelog.test.ts` fails if the
   newest dated changelog section is not the `package.json` version.
3. After that pull request merges, run steps 2 to 10 above for the new version. Skip step 2 and the privacy
   parts of steps 6 and 7 if the site and the policy did not change.
4. Only if unreleased work on `main` must not ship with an urgent fix may the owner approve a branch from the
   release tag for that fix. Agents never create one without that approval.

## AMO reviewer notes

Plain text for the "Notes for reviewers" field of the AMO submission. Paste the block below as it stands,
without the fence lines. It has no placeholder to fill in and no Markdown. The same command sequence rebuilds
the package in the rehearsal and in step 4.

```text
NacioCheck is written in TypeScript and built with WXT, a build tool for browser extensions. WXT bundles and minifies the code, so the full sources are attached as a second file. Nothing is obfuscated and no code is downloaded at run time.

To rebuild the Firefox package from the attached sources:

1. Use Node.js 24.22.1 (the version in the file .nvmrc in the root of the sources) with the npm that comes with it.
2. Unzip the sources archive into an empty directory and open a terminal in it.
3. Run: npm ci
4. Run: npm run build:chrome
5. Run: npm run build:firefox
6. Run: npm run check:privacy
7. Run: npx wxt zip -b firefox

The unpacked Firefox build is in .output/firefox-mv3/ and the package is .output/naciocheck-X.Y.Z-firefox.zip, where X.Y.Z is the version in package.json. That zip is byte-identical to the one uploaded here (compare them with cmp). Steps 4 and 6 are only for the privacy check: npm run check:privacy needs both builds, and it prints that the built manifests request only the permissions storage, alarms and notifications and one host permission, https://sede.mjusticia.gob.es/eConsultas/*. No account, API key or environment variable is needed.

Where the extension runs: the content script is injected only into https://sede.mjusticia.gob.es/eConsultas/*, the official page of the Spanish nationality status query. On the query form it fills in the details the person saved, hides everything except the captcha, submits the form after the person has solved the captcha, and reads the status the page returns. It makes no network request of its own, uses no remote code and collects no data (data_collection_permissions is set to none).

The captcha is Google reCAPTCHA, loaded by the official page. The person solves it. The extension never solves it, never bypasses it and never sends it to a solving service.

A real check needs the person's own nationality application, so there is nothing to test against a live account. The review can be static: rebuild, compare the zip, and read the code.
```

## Related

- [`docs/github-settings.md`](github-settings.md): the repository settings and how to check them.
- [`docs/manual-firefox-checklist.md`](manual-firefox-checklist.md): the Firefox checks of step 5.
- [`store/`](../store/): listings, permission answers, store requirements, images and screenshots.
- [`docs/adr/0005-distribution-and-public-pages.md`](adr/0005-distribution-and-public-pages.md) and
  [`docs/adr/0008-branches-fixes-and-releases.md`](adr/0008-branches-fixes-and-releases.md): the decisions.
