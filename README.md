# NacioCheck

A personal browser extension for Chrome and Firefox (desktop and Firefox for Android) that makes checking a
Spanish nationality-by-residence application a **reminder → captcha → result** task. It autofills the official
form, shows you only the captcha, submits once you have solved it, reads the status, keeps every check on
your device and tells you loudly when the status changes.

**Not an official tool.** NacioCheck is not affiliated with the Ministerio de Justicia. The official
resolution of an application arrives through [DEHú](https://sede.mjusticia.gob.es/), not through this
extension.

**Privacy by construction.** The extension has no server and makes no network requests of its own: data lives
in `storage.local` / `storage.session` only, never in `storage.sync`, and no analytics, fonts or config are
loaded remotely. The only traffic is the page you open and submit yourself. `npm run check:privacy` enforces
this over the built extension.

The project is at the start of its MVP; the implementation plan lives in `.ai/plans/` (local only).

## Requirements

- Node LTS — pinned in `.nvmrc` (currently 24)
- One of the supported browsers

## Install and build

```sh
npm ci                  # installs dependencies and generates the WXT types
npm run build:chrome    # → .output/chrome-mv3
npm run build:firefox   # → .output/firefox-mv3
```

Checks:

```sh
npm run lint
npm run typecheck
npm test
npm run check:privacy   # after a build: scans manifests and bundles for network APIs and hosts
```

## Load a development build in Chrome

With the dev server (it launches a browser with the extension loaded and hot-reloads):

```sh
npm run dev
```

From a production build:

1. `npm run build:chrome`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select `.output/chrome-mv3`

## Load a development build in Firefox

With the dev server:

```sh
npm run dev:firefox
```

From a production build:

1. `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on…** → select `.output/firefox-mv3/manifest.json`

Temporary add-ons disappear when Firefox closes. On **Firefox for Android**, enable _Remote debugging via
USB_ in the browser's settings, connect the device to your computer, open
`about:debugging#/runtime/this-firefox` on the desktop and install the temporary add-on on the phone the same
way.

## Brand

The name, icon, logo and colours are documented in [`brand/README.md`](brand/README.md), which is the single
source of truth. `brand/icon.svg` is rasterised into `public/icon/*.png` during the build; those PNGs are
generated files and are not tracked.

## Licence

Not decided yet.
