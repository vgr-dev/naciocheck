# NacioCheck

_Your nationality application, up to date._

NacioCheck is a browser extension for Chrome and Firefox that makes checking the status of a Spanish
nationality-by-residence application a **reminder → captcha → result** task. It fills in the official query form
for you, leaves you only the captcha, sends the query once you have solved it, reads the status, keeps every
check on your device and tells you loudly when the status changes.

**Not an official tool.** NacioCheck is not affiliated with, endorsed by or connected to the Ministerio de
Justicia or any Spanish administration. The official resolution of an application arrives through
[DEHú](https://sede.mjusticia.gob.es/), never through this extension. The explanations it shows for each status
are an unofficial reading, with their sources, and are labelled as such.

> **Status: pre-release (0.x).** It has not been published to the stores yet, and Firefox for Android has not been
> tested on a device. See [Install](#install).

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
- It **does not send your data anywhere.** There is no server, no account, no analytics and no remote font or
  configuration.
- It does not give legal advice and does not predict when your application will be resolved.
- It does not replace DEHú: a notification from the administration is the only official communication.

## Privacy

Everything lives in the browser's `storage.local` and `storage.session`; `storage.sync` is never used, because it
uploads data to Google or Mozilla. The extension makes **no network requests of its own**: the only traffic is the
official page you open and submit yourself, and the captcha that page loads. It asks for three permissions
(`storage`, `alarms`, `notifications`) and one host, `https://sede.mjusticia.gob.es/eConsultas/*`.

This is enforced, not just promised: `npm run check:privacy` scans the built manifests and bundles for network
APIs, extra hosts and unlisted URLs and fails the build on any of them. The reasons for each permission are in
[`store/permissions.md`](store/permissions.md), and the privacy policy is in [`site/`](site/)
([English](site/en/privacy/index.html), [Spanish](site/privacy/index.html)).

If you turn encryption on, every identity is stored encrypted, including applications added afterwards. The add and
edit forms ask for the passphrase each time and do not keep it. To run a check, you unlock the data once; that
passphrase stays in `storage.session` only, which the browser clears when it closes. **A forgotten passphrase
cannot be recovered.**

## Install

NacioCheck will be published on the **Chrome Web Store** and on **addons.mozilla.org** (Firefox desktop and
Firefox for Android), and only there: the store versions are the supported way to install it. Store links will be
added here when the listings are live. Until then, [build it from source](#build-from-source) and load it as a
development build.

Supported browsers: Chrome (Manifest V3) and Firefox 128 or newer on desktop. Firefox for Android is a target and
is not verified on a device yet.

## Build from source

You need Node.js — the version in [`.nvmrc`](.nvmrc) (currently 24) — and npm.

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
store/ site/       store listing texts and images; the static privacy-policy site
brand/             name, icon, logo and colours: the single source of truth (brand/README.md)
```

[`AGENTS.md`](AGENTS.md) holds the repository's conventions and the decisions that are not up for silent change.
It is the file to read before changing anything.

### Checks

```sh
npm run lint
npm run typecheck
npm test                # unit tests (Vitest)
npm run format:check    # `npm run format` fixes
npm run check:privacy   # needs a build first
npm run check:site      # the privacy site has no scripts and no third-party URLs
```

### End-to-end tests (Chrome)

```sh
npm run test:e2e              # headless, the whole suite
npm run test:e2e:headed       # real browser windows, to watch or debug
E2E_SPEC=pages npm run test:e2e   # one spec: check-flow, pages, visual or smoke
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
   screenshots below) and `smoke`.

A full run takes a few minutes. The captcha on the fake site is a stub that exists **only** on those fake pages.

**Requirements.** The Node version above, `openssl` on the `PATH`, and network access the first time: WebdriverIO
downloads Chrome for Testing and its driver (Chrome 137 and later ignores `--load-extension`, which is why the
suite does not use the browser you have installed). Nothing else leaves your machine, and the suite never makes a
request to the real site.

**On WSL.** The suite is developed on Ubuntu in WSL2. Headless runs need no display. `npm run test:e2e:headed`
opens windows through WSLg, which current WSL on Windows 11 includes. If Chrome for Testing fails to start with a
missing shared library, install the library the error names.

**Where things land.** Everything a run produces is under `e2e/.artifacts/`, which git ignores: the screenshots it
took and their diffs (`screenshots/`), `screenshots/index.md` (every image with its size and mismatch), the throwaway
certificate (`tls/`) and the files the backup spec exports (`backup/`).

#### Visual baselines

The `visual` spec photographs every extension page in its main states, in Spanish and English, at desktop
(1280×800), phone (412×915) and popup (380×600) sizes, and three long pages, onboarding, options and the changed-status alert, whole at
both widths: 92 images. The approved ones are **tracked** in [`e2e/baselines/`](e2e/baselines), because an image
that changes is a change to review. A run fails when more than 0.01 % of an image's pixels differ. Chrome runs with
reduced motion forced, so the animated logo is at rest and two runs on one machine agree to the pixel.

Fonts decide pixels. The baselines were taken on Ubuntu 22.04 in WSL2, where `fc-match system-ui` answers DejaVu
Sans (package `fonts-dejavu-core`). On a machine that answers another font the visual spec fails for reasons that
have nothing to do with the code; check with `fc-match system-ui` before trusting a failure.

After a deliberate UI change:

```sh
npm run test:e2e:update-baselines   # deletes e2e/baselines/ and writes all 92 again
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
npm run logo:outline    # outlines the logo text into brand/ (downloads Nunito once, checks its SHA-256)
npm run store:images    # renders the store icons and promotional tiles into store/
npm run deploy:site     # publishes site/ to Cloudflare Workers (needs a Cloudflare login)
```

## Security

Please report a vulnerability privately, as [`SECURITY.md`](SECURITY.md) describes, and use invented identities in
anything you attach.

## Brand

The name, icon, logo and colours are documented in [`brand/README.md`](brand/README.md), which is the single source
of truth. `brand/icon.svg` is rasterised into `public/icon/*.png` during the build; those PNGs are generated and
not tracked.

## Licence

NacioCheck is free software under the **GNU General Public License v3.0**; the text is in [`LICENSE`](LICENSE).
Copyleft is deliberate: anyone who distributes a fork, including one that adds telemetry, has to publish its
source. The Nunito typeface in the logo keeps its own licence, the SIL Open Font License 1.1
([`brand/OFL.txt`](brand/OFL.txt)).

NacioCheck is not affiliated with the Ministerio de Justicia.
