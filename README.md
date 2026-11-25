<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-horizontal-tagline-outlined-dark-en.svg">
    <img src="brand/logo-horizontal-tagline-outlined-light-en.svg" alt="NacioCheck — Your nationality application, up to date." width="480">
  </picture>
</h1>

<p align="center">
  <a href="https://github.com/vgr-dev/naciocheck/actions/workflows/ci.yml"><img src="https://github.com/vgr-dev/naciocheck/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
  <img src="https://img.shields.io/badge/status-pre--release%200.x-orange" alt="Status: pre-release 0.x">
  <img src="https://img.shields.io/badge/Chrome-coming%20soon-lightgrey?logo=googlechrome&logoColor=white" alt="Chrome Web Store: coming soon">
  <img src="https://img.shields.io/badge/Firefox-coming%20soon-lightgrey?logo=firefoxbrowser&logoColor=white" alt="Firefox Add-ons: coming soon">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-GPL--3.0--or--later-blue" alt="Licence: GPL-3.0-or-later"></a>
  <img src="https://img.shields.io/badge/telemetry-none-brightgreen" alt="Telemetry: none">
</p>

<p align="center">
  <a href="https://naciocheck.vgr.cat/en/">Website</a> ·
  <a href="#install">Install</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

NacioCheck is a browser extension for Chrome and Firefox that makes checking the status of a Spanish
nationality-by-residence application a **reminder → captcha → result** task. It fills in the official query form
for you, leaves you only the captcha, sends the query once you have solved it, reads the status, keeps every
check on your device and tells you loudly when the status changes.

**Not an official tool.** NacioCheck is not affiliated with, endorsed by or connected to the Ministerio de
Justicia or any Spanish administration. The official resolution of an application arrives through
[DEHú](https://sede.mjusticia.gob.es/), never through this extension. The explanations it shows for each status
are an unofficial reading, with their sources, and are labelled as such.

> [!NOTE]
> **Status: pre-release (0.x).** It has not been published to the stores yet. See [Install](#install).

## What it does

- Fills in the official form on the electronic site with the details you saved once (NIE and date of birth).
- Shows you only the captcha. You solve it; the extension never does.
- Submits the query after the captcha is solved, reads the status the site returns and stores the check.
- Shows a full-screen alert, a notification and a badge when the status changes from the last check.
- Keeps the full history of every application you add. You can add, edit and delete applications, and export or
  import everything as a file.
- Reminds you on the days and at the time you choose, while the browser is open.
- Explains what each status seems to mean, with the sources, and says plainly what is only observed on real files.
- Offers to encrypt your identifying details with a passphrase (optional, your choice).
- Speaks Spanish and English, following the browser's language unless you change it.

## What it does not do

- It **does not solve, bypass or outsource the captcha.** Solving services send your details to third parties and
  break the site's terms; here the human always ticks the box.
- It **does not send your data to any server of its own.** There is no account, no analytics and no remote font
  or configuration. When you start a check, the official form is submitted to the sede electrónica exactly as if
  you had filled it in yourself.
- It does not give legal advice and does not predict when your application will be resolved.
- It does not replace DEHú: a notification from the administration is the only official communication.

## Privacy

Everything lives in the browser's `storage.local` and `storage.session`; `storage.sync` is never used, because it
uploads data to Google or Mozilla. The extension makes **no network requests of its own**: the only traffic is the
official page you open and submit yourself, and the captcha that page loads. It asks for three permissions
(`storage`, `alarms`, `notifications`) and one host, `https://sede.mjusticia.gob.es/eConsultas/*`.

This is enforced by the standalone `npm run check:privacy` gate: it scans the built manifests, scripts, HTML,
CSS and SVG for network APIs, extra hosts, remote assets and unlisted URLs, and fails on any of them. Run it
after both browser builds, and treat it as a release requirement. The reasons for each permission are in
[`store/permissions.md`](store/permissions.md), and the privacy policy is in [`site/`](site/)
([English](site/en/privacy/index.html), [Spanish](site/privacy/index.html), [Catalan](site/ca/privacy/index.html)).

**Reporting a problem.** The extension sends nothing by itself. "Report a problem" shows you the text first and
only opens the website with that text in the address fragment (after the `#`), which browsers do not send to the
server. The feedback page loads Cloudflare Turnstile; a report you send there goes through Cloudflare to the
maintainer by email (`naciocheck@vgr.cat`) and is not stored, and the Worker keeps no logs. Your own result (the
status text and sub-status the site printed) and your identifiers are never included, and anything shaped like
an identifier is masked. The website (not the extension) counts visits with Cloudflare Web Analytics, which sets
no cookies; the feedback page also loads Turnstile.

If you turn encryption on, every identity is stored encrypted, including applications added afterwards. The add and
edit forms ask for the passphrase each time and do not keep it. To run a check, you unlock the data once; that
passphrase stays in `storage.session` only, which the browser clears when it closes. **A forgotten passphrase
cannot be recovered.**

## Install

### Not a developer? Start here

You do not need to download anything from this page, and you never need the files on it.

> [!IMPORTANT]
> NacioCheck is **not in the stores yet**. Until it is, there is nothing to install for everyday use: please check
> back here or on [the website](https://naciocheck.vgr.cat/en/), where the install buttons will appear. Do not
> install a copy from anywhere else, and never give your NIE to a site or app that claims to be NacioCheck.

Once it is published, installing takes about a minute:

1. On a computer, open **Chrome** or **Firefox** and follow the store link (it will be at the top of this page and
   on the website).
2. Click **Add to Chrome** or **Add to Firefox**, then confirm.
3. Click the puzzle-piece icon next to the address bar and pin **NacioCheck**, so its icon stays visible.
4. A welcome page opens. Type your NIE and date of birth once, and choose the days and time for your reminder.
5. When the reminder comes, click it, solve the "I'm not a robot" check on the official page, and NacioCheck shows
   you the status. If it changes, you will know.

Your details stay in your browser. To remove NacioCheck, right-click its icon and choose **Remove**.

### For developers

NacioCheck will be published on the **Chrome Web Store** and on **addons.mozilla.org** (Firefox desktop), and
only there: the store versions are the supported way to install it. Store links will be
added here when the listings are live. Until then, [build it from source](#build-from-source) and load it as a
development build. The files attached to a GitHub Release are for verifying a build, not for installing it
([see below](#continuous-integration-and-releases)).

Supported browsers: Chrome (Manifest V3), Firefox 128 or newer on desktop, and Firefox for Android.

## Build from source

You need Node.js **24.22.1**, pinned in [`.nvmrc`](.nvmrc), and npm. The end-to-end tooling
(WebdriverIO) requires that patch level; select it with `nvm use` before installing dependencies.

```sh
npm ci                  # installs the dependencies and generates the WXT types
npm run build:chrome    # → .output/chrome-mv3
npm run build:firefox   # → .output/firefox-mv3
```

Packages, as the stores receive them:

```sh
npm run zip             # Chrome and Firefox zips in .output/
npm run zip:sources     # the source archive Mozilla's reviewers rebuild from
```

Rebuilding the source archive reproduces the Firefox package byte for byte (checked for 0.1.0).

The source archive is for rebuilding the extension, not a full test checkout: WXT excludes unit-test
files. Use the repository checkout for the complete test suite. The archive includes `.nvmrc` so its
build uses the same pinned Node runtime.

### Load a development build

**Chrome**

1. `npm run build:chrome`
2. Open `chrome://extensions` and enable **Developer mode**
3. **Load unpacked** → select `.output/chrome-mv3`

**Firefox**

1. `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on…** → select `.output/firefox-mv3/manifest.json`

Temporary add-ons disappear when Firefox closes. On **Firefox for Android**, enable _Remote debugging via USB_ in
the browser's settings, connect the device to your computer, open `about:debugging#/runtime/this-firefox` on the
desktop and install the temporary add-on on the phone the same way.

With the dev server, which launches a browser with the extension loaded and hot-reloads it:

```sh
npm run dev             # Chrome
npm run dev:firefox     # Firefox
```

## Develop

The code is TypeScript on [WXT](https://wxt.dev) (one Manifest V3 source tree for both browsers), tested with
Vitest and WebdriverIO, and checked with ESLint (typed) and Prettier.

```
src/core/          storage, validation, parsing the result page, status catalogue, change detection, crypto
src/entrypoints/   background, content script, and the popup, options, onboarding, result, statuses, unlock pages
tests/             unit tests (tests/fixtures: copies of the official pages, never reformatted)
e2e/               Chrome end-to-end specs, the fake official site, visual baselines
store/ site/       store listing texts and images; the sources of the static website (es, en, ca)
brand/             name, icon, logo and colours: the single source of truth (brand/README.md)
```

[`AGENTS.md`](AGENTS.md) holds the repository's conventions; the decisions that are not up for silent change are in [`docs/adr/`](docs/adr).
It is the file to read before changing anything.

### Checks

```sh
npm run lint
npm run typecheck
npm test                # unit tests (Vitest)
npm run format:check    # `npm run format` fixes
npm run check:privacy   # needs a build first
npm run check:site      # builds the site first; scripts only on the feedback pages, no other third-party URLs
```

### Continuous integration and releases

GitHub Actions runs the fast checks on every pull request and every push to `main` ([`ci.yml`](.github/workflows/ci.yml)).
The `checks` job runs `format:check`, `lint`, `typecheck`, `test`, both browser builds, `check:privacy` and
`check:site`; the `workflow-lint` job runs the two workflow commands below. Both must be green before a pull
request merges. The E2E and visual suites are not part of CI: they stay local. Workflows from any outside
contributor's pull request wait for the owner's approval, and none of them can reach a secret.

```sh
npm run check:workflows   # policy check of .github/: pinned actions, no secrets, read-only tokens, no risky triggers
npm run lint:workflows    # actionlint and zizmor, pinned and checksum-verified; downloads them once (Linux x64 only)
```

A release is started by hand: the owner runs the **Release** workflow
([`release.yml`](.github/workflows/release.yml)) from `main` in the Actions tab. It reads the version from
`package.json`, fails if a release or tag `v<version>` already exists, runs the same eight checks as the CI
`checks` job (not `workflow-lint`), builds the packages and creates a **draft** GitHub Release with
`naciocheck-<version>-chrome.zip`, `naciocheck-<version>-firefox.zip`, `naciocheck-<version>-sources.zip` and
`naciocheck-<version>-SHA256SUMS.txt`.
The owner downloads the files, checks them with `sha256sum -c`, uploads to the stores and publishes the draft,
which creates the tag. The release assets exist so a build can be reproduced and verified; they are not an
install channel, and the supported way to install NacioCheck is from the stores (see [Install](#install)).

The repository settings that make this safe (Actions permissions, the `main` and `v*` rulesets, security
features) are listed in [`docs/github-settings.md`](docs/github-settings.md). The owner applies them in the
GitHub UI; this reads them back and reports every difference, with only `GET` requests (it needs the `gh`
CLI, signed in as an admin):

```sh
node scripts/check-github-settings.mjs [owner/repo]   # defaults to the origin remote
```

To contribute, see [`CONTRIBUTING.md`](CONTRIBUTING.md): changes go through a pull request from a branch, with a
Conventional Commits title that becomes the squash-merge commit.

### The website

`naciocheck.vgr.cat` is a static site in three languages: Spanish at `/`, English at `/en/` and Catalan at `/ca/`.
Each has a landing page, the privacy policy, the feedback page, the changelog and a 404 page, and every page links
to the others in the other languages. The pages and their shared parts are the **sources** in [`site/`](site/);
the deployable site is **generated** into `.output/site/` (git-ignored) by:

```sh
npm run build:site      # site/ and CHANGELOG.md -> .output/site/, no network access
```

What the build does:

- Fills the shared head (title, description, canonical, `hreflang` alternates, Open Graph and Twitter tags), the
  header with the language switcher, the footer and the install buttons into every page from markers in the
  sources. The shared strings and styles are in `site/_build/` (`strings.json`, `partials/`).
- Turns [`CHANGELOG.md`](CHANGELOG.md), the single source of release notes (in English), into the `/changelog/`
  pages. Until a release is dated, they say there are no releases yet.
- Renders the social card, the favicons and the optimised screenshots from `brand/` and `store/screenshots/`.
- Takes the store URLs and whether the repository is public from `site/_build/config.json`. While the store URLs
  are `null` the install buttons read "Próximamente" / "Coming soon" / "Properament" and link nowhere; the source
  code link appears once `repositoryPublic` is `true`.

`check:site`, `dev:site` and `deploy:site` build first, and `wrangler.jsonc` serves `.output/site/`. The site loads
nothing from other origins except Cloudflare Web Analytics (which counts website visits only, never the extension)
and, on the feedback pages only, Turnstile; `npm run check:site` fails on anything else.

### Test the feedback page locally

The feedback page posts to the site's Worker. To try it by hand, copy `.dev.vars.example` to `.dev.vars` (it is
git-ignored and holds only Cloudflare's published Turnstile test values), run `npm run dev:site` and open
`http://localhost:8787/feedback/` (or `/en/feedback/`, `/ca/feedback/`). Turnstile's test keys still contact Cloudflare, so this is a hands-on check
and never part of `npm test`.

### End-to-end tests (Chrome)

```sh
npm run test:e2e              # headless, the whole suite
npm run test:e2e:headed       # real browser windows, to watch or debug
E2E_SPEC=pages npm run test:e2e   # one spec: check-flow, pages, visual, site or smoke
```

What a run does:

1. Builds the extension for **both** browsers (and the Firefox zip), unchanged: the tests run the production build,
   with no test-only permissions or flags.
2. Generates a throwaway TLS certificate with `openssl` (valid two days, never committed).
3. Starts a **fake official site** inside the test process: pages captured from the real one, served from a local
   HTTPS server **at the real URLs**. Chrome is started with host-resolver rules that map the official host, the
   reCAPTCHA host and the font host to that server and every other host to nothing, so the suite cannot reach the
   real site or any other server, even by mistake. A network guard reports what each spec requested; the summary
   line must read `outside it 0`.
4. Runs the specs in Chrome for Testing, driven by WebdriverIO: `check-flow` (the check run against the fake site),
   `pages` (onboarding, popup, options, encryption, backup, result, status guide, language), `visual` (the
   screenshots below), `site` (the built website, served from a local server under a made-up host name, in
   Spanish, English and Catalan, light and dark, with an accessibility audit by axe-core) and `smoke`.

A full run takes a few minutes. The captcha on the fake site is a stub that exists **only** on those fake pages.

**Requirements.** The Node version above, `openssl` on the `PATH`, and network access the first time: WebdriverIO
downloads Chrome for Testing and its driver (Chrome 137 and later ignores `--load-extension`, which is why the
suite does not use the browser you have installed). Nothing else leaves your machine, and the suite never makes a
request to the real site.

The suite currently follows WebdriverIO's `stable` Chrome for Testing instead of pinning a browser version. A
Chrome update can change text rendering or layout and fail the visual baselines without a source change; record
the downloaded browser version when comparing a baseline failure.

**On WSL.** The suite is developed on Ubuntu in WSL2. Headless runs need no display. `npm run test:e2e:headed`
opens windows through WSLg, which current WSL on Windows 11 includes. If Chrome for Testing fails to start with a
missing shared library, install the library the error names.

**Where things land.** Everything a run produces is under `e2e/.artifacts/`, which git ignores: the screenshots it
took and their diffs (`screenshots/`), `screenshots/index.md` (every image with its size and mismatch), the throwaway
certificate (`tls/`) and the files the backup spec exports (`backup/`).

#### Visual baselines

The `visual` spec photographs every extension page in its main states, in Spanish and English, at desktop
(1280×800), phone (412×915) and popup (380×600) sizes, and three long pages, onboarding, options and the changed-status alert, whole at
both widths: 104 images. It photographs the website too, served locally: the landing and privacy pages whole at
both widths, and the changelog and 404 pages at 1280×800 and 412×915, each in Spanish, English and Catalan and in the
light and dark themes: 48 images, 152 in all. The approved ones are **tracked** in [`e2e/baselines/`](e2e/baselines), because an image
that changes is a change to review. A run fails when more than 0.01 % of an image's pixels differ. Chrome runs with
reduced motion forced, so the animated logo is at rest and two runs on one machine agree to the pixel.

Fonts decide pixels. The baselines were taken on Ubuntu 22.04 in WSL2, where `fc-match system-ui` answers DejaVu
Sans (package `fonts-dejavu-core`). On a machine that answers another font the visual spec fails for reasons that
have nothing to do with the code; check with `fc-match system-ui` before trusting a failure.

After a deliberate UI change:

```sh
npm run test:e2e:update-baselines   # deletes e2e/baselines/ and writes all 100 again
git diff --stat e2e/baselines       # review what changed, then commit it with the code that caused it
```

Baselines and screenshots contain invented data only (the NIE `X0000000X`, labels such as "Solicitud uno"). Keep it
that way: the repository is public. In Claude Code or Copilot Chat, `/review-ui` reviews the screenshots against the
brand and layout rules.

#### Firefox

Automated Firefox runs are not possible today: Marionette refuses to navigate to `moz-extension://` pages, so
`npm run test:e2e:firefox` runs only a smoke spec and fails on purpose. Firefox desktop is verified by hand before
each release with [`docs/manual-firefox-checklist.md`](docs/manual-firefox-checklist.md), run against the same
package that goes to the store.

### Maintainer tasks

```sh
npm run logo:outline    # outlines brand/ text; needs the pinned Nunito and system UI font (see brand/README.md)
npm run store:images    # renders the store icons and promotional tiles into store/
npm run deploy:site     # builds the site, then publishes .output/site/ to Cloudflare Workers (needs a Cloudflare login)
```

## Security

Please report a vulnerability privately, as [`SECURITY.md`](SECURITY.md) describes, and use invented identities in
anything you attach.

## Brand

The name, icon, logo and colours are documented in [`brand/README.md`](brand/README.md), which is the single source
of truth. `brand/icon.svg` is rasterised into `public/icon/*.png` during the build; those PNGs are generated and
not tracked.

## Licence

NacioCheck is free software under the **GNU General Public License, version 3 or (at your option) any later
version** (SPDX `GPL-3.0-or-later`); the text of version 3 is in [`LICENSE`](LICENSE). The build copies that
canonical file and [`THIRD-PARTY-NOTICES.txt`](THIRD-PARTY-NOTICES.txt) to the root of both browser packages, so
the store artefacts carry the same licence and WXT runtime notices as the source archive.
Copyleft is deliberate: anyone who distributes a fork, including one that adds telemetry, has to publish its
source. The Nunito typeface in the logo keeps its own licence, the SIL Open Font License 1.1
([`brand/OFL.txt`](brand/OFL.txt)).

NacioCheck is not affiliated with the Ministerio de Justicia.
