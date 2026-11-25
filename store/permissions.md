# Permissions and privacy answers

Every permission the two manifests declare, why it is there and where it is used, plus the answers the Chrome
Web Store and addons.mozilla.org ask for in their privacy and data-use forms. Taken from the built manifests
(`.output/chrome-mv3/manifest.json`, `.output/firefox-mv3/manifest.json`) on 2026-11-16; re-read against `wxt.config.ts` and the shipped features on 2026-11-25 (1.0.0), no change to the
permissions.

## What the manifests declare

Both builds declare the same API permissions, the same one host permission, the `action` popup, the options page
and a `content_scripts` entry. Chrome uses `background.service_worker`; Firefox uses `background.scripts` (an event
page, which is what Firefox for Android supports) and the gecko settings.

| Declaration                                                             | Type                           | Why the extension needs it                                                                                                                                                                                                                                                       | Where it is used                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                                               | permission                     | Keeps the applications, the history of checks and the settings on the device, and the passphrase only in session storage. It is the whole database of the extension.                                                                                                             | `src/core/storage.ts` (`storage.local`, key `naciocheck`), `src/entrypoints/background.ts` (`storage.session`, key `naciocheck:unlock`)                                            |
| `alarms`                                                                | permission                     | Schedules the one reminder the user sets; nothing else is scheduled and no timer runs while the browser is closed.                                                                                                                                                               | `src/entrypoints/background.ts` (`rescheduleReminder`, `handleAlarm`), `src/core/schedule.ts` (`nextRunWhen`)                                                                      |
| `notifications`                                                         | permission                     | Tells the user when a status has changed, and when a reminder is due. The notification is created locally; nothing is sent.                                                                                                                                                      | `src/entrypoints/background.ts` (`applyAlert`, `handleAlarm`)                                                                                                                      |
| `https://sede.mjusticia.gob.es/eConsultas/*`                            | host permission                | The settled host scope is the official `eConsultas` subtree used by the nationality procedure. On the nationality form it fills the saved application, hides everything but the captcha, submits when the human has solved it, and reads the result. No other host is requested. | `src/entrypoints/content.ts` (`matches`, autofill, parser), `src/entrypoints/background.ts` (the check window opens `https://sede.mjusticia.gob.es/eConsultas/inicioNacionalidad`) |
| `browser_specific_settings.gecko.data_collection_permissions` (Firefox) | manifest key, not a permission | States, in the form Firefox shows at install time, that the extension collects and transmits no data.                                                                                                                                                                            | `wxt.config.ts`                                                                                                                                                                    |

No `tabs`, no `cookies`, no `<all_urls>`, no `scripting`, no `webRequest` and no web-accessible resources:
none of them is needed. `npm run check:privacy` compares the built manifests against exactly `storage`, `alarms`,
`notifications`, the one host pattern and the single content-script match, and rejects external-connect and
web-resource keys.

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
- **Host permission `https://sede.mjusticia.gob.es/eConsultas/*`** — The extension injects only into the official
  `eConsultas` pages of the nationality procedure (the settled host scope). On the nationality form it fills the
  form, leaves only the captcha, submits the query after the user solves it, and reads the result. No other site
  is requested, and no data is sent to the extension's own or third-party servers.

### Remote code

> No, I am not using remote code.

There is no `eval`, no injected script from a server and no remote import; the standalone privacy gate fails if
`fetch(`, `XMLHttpRequest`, another network API, a remote URL or an eval-like CSP appears. It is run after both
browser builds as a release requirement.

### Data usage

- Data collected: **none of the categories** (personally identifiable information, health, financial, personal
  communications, location, web history, user activity, website content — all unchecked).
- Certifications: the extension does not sell or transfer user data to third parties, does not use or transfer
  data for purposes unrelated to its single purpose, and does not use or transfer data to determine
  creditworthiness or for lending purposes.
- Privacy policy URL: `https://naciocheck.vgr.cat/privacy/` (the policy is in `site/privacy/`). The deployed site
  must show the 1.0.0 policy before the Chrome submission: the owner runs `npm run deploy:site` after the bump
  PR merges (`docs/release.md`), and the form cannot be submitted before that.
- Feedback channel: the extension sends nothing by itself. "Report a problem" shows the text first and only opens
  `https://naciocheck.vgr.cat/feedback/` with the text in the address fragment, which browsers do not send to the
  server; the extension makes no request and needs no extra permission or host. The feedback page loads Cloudflare
  Turnstile, and a report the person sends there goes through Cloudflare to the maintainer by email
  (`naciocheck@vgr.cat`); it is not stored and the Worker keeps no logs. The person's own result (status text and
  sub-status) and identifiers are never included, and anything shaped like an identifier is masked. That is
  user-initiated and happens on the website, not in the extension, so the data-usage answers stay "none".

## addons.mozilla.org — submission answers

- **Data collection**: `"required": ["none"]` in `browser_specific_settings.gecko.data_collection_permissions`
  (both builds). Nothing is collected, so no optional data types are declared and no consent experience is
  needed.
- **Privacy policy**: AMO asks for one when data is transmitted. The extension transmits nothing itself; when the
  user checks, the official form goes to the sede. "Report a problem" only opens the website with the shown text
  in the address fragment; a report sent from the feedback page (Cloudflare Turnstile, then email to the
  maintainer, not stored) is the person's own action on the website. The field is left empty or pointed at
  `https://naciocheck.vgr.cat/privacy/` once it exists, whichever the reviewer prefers.
- **Source code**: yes. WXT bundles and minifies, so the source package (`npm run zip:sources`, with
  `package-lock.json`) goes with the build.
- **Notes for reviewers**: the extension injects only into `https://sede.mjusticia.gob.es/eConsultas/*`. The
  captcha is reCAPTCHA's, solved by the person using it; the extension never solves it and never calls a solving
  service.
  A check needs a real application, so nothing has to be tested against a live account — the review can be
  static. The source-build steps (Node version, `npm ci`, the build command and where the output lands) are in
  `docs/release.md`, section "AMO reviewer notes", to be pasted into this field as written there.
  `npm run check:privacy` shows that the built manifests request only `storage`, `alarms`, `notifications` and
  the one host.
- **Licence**: `GPL-3.0-or-later` (the AMO form takes the SPDX identifier or the licence's name; the full text is
  `LICENSE`, copied to the root of both browser packages by the build and included in the source package).
  `THIRD-PARTY-NOTICES.txt` carries the MIT notice for the WXT and `@wxt-dev/browser` runtime code in the bundles.
  Decided 2026-11-18 (D8).

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
