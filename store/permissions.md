# Permissions and privacy answers

Every permission the two manifests declare, why it is there and where it is used, plus the answers the Chrome
Web Store and addons.mozilla.org ask for in their privacy and data-use forms. Taken from the built manifests
(`.output/chrome-mv3/manifest.json`, `.output/firefox-mv3/manifest.json`) on 2026-11-16.

## What the manifests declare

Both builds declare the same API permissions and the same one host permission. Chrome additionally has
`action.default_popup`, `background.service_worker`, `options_ui` and a `content_scripts` entry; Firefox has
`background.scripts` (an event page, which is what Firefox for Android supports) and the gecko settings.

| Declaration                                                             | Type                           | Why the extension needs it                                                                                                                                                                                  | Where it is used                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                                               | permission                     | Keeps the applications, the history of checks and the settings on the device, and the passphrase only in session storage. It is the whole database of the extension.                                        | `src/core/storage.ts` (`storage.local`, key `naciocheck`), `src/entrypoints/background.ts` (`storage.session`, key `naciocheck:unlock`)                                            |
| `alarms`                                                                | permission                     | Schedules the one reminder the user sets; nothing else is scheduled and no timer runs while the browser is closed.                                                                                          | `src/entrypoints/background.ts` (`rescheduleReminder`, `handleAlarm`), `src/core/schedule.ts` (`nextRunWhen`)                                                                      |
| `notifications`                                                         | permission                     | Tells the user when a status has changed, and when a reminder is due. The notification is created locally; nothing is sent.                                                                                 | `src/entrypoints/background.ts` (`applyAlert`, `handleAlarm`)                                                                                                                      |
| `https://sede.mjusticia.gob.es/eConsultas/*`                            | host permission                | The official check page is the only site the extension touches: it fills the saved application into the form, hides everything but the captcha, submits when the human has solved it, and reads the result. | `src/entrypoints/content.ts` (`matches`, autofill, parser), `src/entrypoints/background.ts` (the check window opens `https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad`) |
| `browser_specific_settings.gecko.data_collection_permissions` (Firefox) | manifest key, not a permission | States, in the form Firefox shows at install time, that no data is collected or transmitted.                                                                                                                | `wxt.config.ts`                                                                                                                                                                    |

No `tabs`, no `cookies`, no `<all_urls>`, no `scripting`, no `webRequest`: none of them is needed, and
`npm run check:privacy` compares the built manifests against exactly `storage`, `alarms`, `notifications` and the
one host pattern.

## Chrome Web Store — Privacy practices tab

### Single purpose

> NacioCheck checks the status of a Spanish nationality-by-residence application: it fills the official form
> with the details the user saved, leaves the captcha for the user to solve, submits the query, reads the status
> and keeps the history of checks on the user's device, warning when the status changes.

### Permission justifications

- **storage** — Saves the user's applications, the history of checks, the settings and (in session storage only)
  the encryption passphrase. Without it the extension has nothing to check and no history to show.
- **alarms** — Schedules the single reminder the user configures, so the check runs at the chosen time on the
  chosen days.
- **notifications** — Informs the user when a status has changed and when a reminder fires. Both are created
  locally.
- **Host permission `https://sede.mjusticia.gob.es/eConsultas/*`** — The extension only works on the official
  nationality check page: it fills that form, leaves only the captcha, submits the query after the user solves
  the captcha, and reads the result. No other site is requested and no data is sent anywhere else.

### Remote code

> No, I am not using remote code.

There is no `eval`, no injected script from a server and no remote import; the privacy gate fails the build if
`fetch(`, `XMLHttpRequest` or a remote URL appears.

### Data usage

- Data collected: **none of the categories** (personally identifiable information, health, financial, personal
  communications, location, web history, user activity, website content — all unchecked).
- Certifications: the extension does not sell or transfer user data to third parties, does not use or transfer
  data for purposes unrelated to its single purpose, and does not use or transfer data to determine
  creditworthiness or for lending purposes.
- Privacy policy URL: `https://naciocheck.vgr.cat/privacy/` (Phase 9; the listing cannot be submitted before it
  exists).

## addons.mozilla.org — submission answers

- **Data collection**: `"required": ["none"]` in `browser_specific_settings.gecko.data_collection_permissions`
  (both builds). Nothing is collected, so no optional data types are declared and no consent experience is
  needed.
- **Privacy policy**: AMO asks for one when data is transmitted. Nothing is transmitted; the field is left empty
  or pointed at `https://naciocheck.vgr.cat/privacy/` once it exists, whichever the reviewer prefers.
- **Source code**: yes. WXT bundles and minifies, so the source package (`npm run zip:sources`, with
  `package-lock.json`) goes with the build.
- **Notes for reviewers**: the extension only runs on `https://sede.mjusticia.gob.es/eConsultas/*`. The captcha
  is reCAPTCHA's, solved by the person using it; the extension never solves it and never calls a solving service.
  A check needs a real application, so nothing has to be tested against a live account — the review can be
  static: `npm ci && npm run test && npm run build:firefox` reproduce the package, and `npm run check:privacy`
  shows that the built manifests request only `storage`, `alarms`, `notifications` and the one host.
- **Licence**: `TODO(D8)` — the choice between `GPL-3.0-only` and `GPL-3.0-or-later` is the user's, and the field
  stays empty until then.

## Cross-check

```sh
# Every permission in both built manifests, and whether this file justifies it.
node -e '
const fs = require("fs");
const doc = fs.readFileSync("store/permissions.md", "utf8");
for (const build of ["chrome-mv3", "firefox-mv3"]) {
  const manifest = JSON.parse(fs.readFileSync(`.output/${build}/manifest.json`, "utf8"));
  const wanted = [...(manifest.permissions ?? []), ...(manifest.host_permissions ?? [])];
  for (const permission of wanted) {
    const where = doc.includes(`\`${permission}\``) ? "justified" : "MISSING";
    console.log(`${build}: ${permission} → ${where}`);
  }
}'
```
