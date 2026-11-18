# NacioCheck — English listing

Copy-paste text for the Chrome Web Store and addons.mozilla.org. The limits and where they come from are in
`REQUIREMENTS.md`; the measurements of this file are at the end.

## Name

`NacioCheck` — 9 characters (the manifest limit is 75).

## Short description (Chrome Web Store, taken from the manifest — max 132)

```
Check the status of your Spanish nationality-by-residence application. All data stays on your device.
```

This is the same string as `public/_locales/en/messages.json` (`extensionDescription`). Change one, change the
other.

## Summary (AMO — max 250)

```
Tells you when your Spanish nationality-by-residence application changes: it fills in the official form for you, leaves you only the captcha, and keeps every check in your browser. No accounts, no servers, no data sent anywhere.
```

## Detailed description (Chrome Web Store) and AMO description — no practical limit

```
NacioCheck turns checking your Spanish nationality-by-residence application into three steps: a reminder, the captcha, and the result.

What it does
- Fills in the official form on the electronic site with the details you saved once.
- Leaves only the captcha on screen: you tick it, as the site asks.
- Sends the query once the captcha is solved and reads the status the site returns.
- Keeps every check in your browser and tells you when the status changes.
- Explains what each status means, with its sources, and flags what only law firms document.
- Can remind you at the hour and on the days you choose.

What it does not do
- It does not solve the captcha or send it to any service: you tick it.
- It does not create accounts and does not send your data to any server. Everything stays in this browser.
- It is not an official tool and has no relationship with the Ministerio de Justicia.

Your data
- The NIE, the application number, the year and the date of birth are stored only in this browser, in the extension's local storage.
- You can encrypt them with a passphrase of your own, whenever you want, from Options. If you forget it they cannot be recovered: the history stays, but you will have to type the applications again.
- You can export a copy to a file, import it in another browser, and delete everything from Options.
- There is no analytics, no advertising, no tracking and no telemetry. The extension only talks to the official site, and only when you start a check.

Languages
Spanish and English, including Firefox for Android.

Notice
NacioCheck is not affiliated with the Ministerio de Justicia or any public body. The statuses and their explanations come from the official site and from what has been observed in real files; they do not replace the official resolution.
```

## Categories and tags

- Chrome Web Store: category **Productivity**, primary language English.
- AMO: desktop categories **Alerts & Updates** and **Other** (max 2); Android categories **Alerts & Updates**
  and **Other**; tags `nationality`, `residence`, `application status`, `reminder`, `privacy`.

## Privacy summary (for the listing and for the site's policy)

Nothing leaves the device. The personal details you type (NIE, application number, year and date of birth) are
stored only in the extension's local storage, and the encryption passphrase, if you use one, only in session
storage, which the browser clears when it closes. There are no accounts, no servers of our own, no analytics and
no advertising. The extension only contacts `https://sede.mjusticia.gob.es/eConsultas/*`, the official site, to
fill in the form and read the result. The backup is a file you choose where to keep.

## The brand tagline

Spanish: _Tu expediente de nacionalidad, al día._ — English: _Your nationality application, up to date._
(decided on 2026-11-13; `brand/README.md` is the source of truth).

## How it is measured

```sh
wc -m store/listing.en.md            # the whole file
node -e "const t=require('fs').readFileSync('store/listing.en.md','utf8').split('\`\`\`');console.log(t[1].trim().length, t[3].trim().length, t[5].trim().length)"
```
