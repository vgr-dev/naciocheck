# NacioCheck — English listing

Copy-paste text for the Chrome Web Store and addons.mozilla.org. The limits and where they come from are in
`REQUIREMENTS.md`; the measurements of this file are at the end.

## Name

`NacioCheck` — 9 characters (the manifest limit is 75).

## Short description (Chrome Web Store, taken from the manifest — max 132)

```
Check the status of your Spanish nationality-by-residence application. Saved data stays on your device.
```

This is the same string as `public/_locales/en/messages.json` (`extensionDescription`). Change one, change the
other.

## Summary (AMO — max 250)

```
Tells you when your Spanish nationality-by-residence application changes: it fills in the official form, leaves you the captcha, and keeps every check in your browser. No accounts or servers of ours; only the official site is used when you check.
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
- Shows the status exactly as the sede electrónica printed it, whichever language the extension is in.
- Builds a short numbered timeline of an application that you can copy, with an optional filing date; it contains dates and statuses, nothing else.
- Can remind you at the hour and on the days you choose.

What it does not do
- It does not solve the captcha or send it to any service: you tick it.
- It does not create accounts and has no server of its own. Your saved data stays in this browser; when you start a check, the official form is submitted to the sede electrónica, as if you had filled it in yourself.
- It is not an official tool and has no relationship with the Ministerio de Justicia.

Your data
- The NIE, the application number, the year and the date of birth are stored only in this browser, in the extension's local storage.
- You can encrypt them with a passphrase of your own, whenever you want, from Options. If you forget it they cannot be recovered: the history stays, but you will have to type the applications again.
- You can export a copy to a file, import it in another browser, and delete everything from Options.
- There is no analytics, no advertising, no tracking and no telemetry. The extension only talks to the official site, and only when you start a check.
- "Report a problem" shows you the text first and sends nothing: it only opens our website with that text in the address, which browsers do not send to the server. If you press Send there, the text goes through Cloudflare Turnstile to the maintainer by email and is not stored. Your own result and your identifiers are never included.

Languages
Spanish and English. Works on Firefox for Android too.

Notice
NacioCheck is not affiliated with the Ministerio de Justicia or any public body. The statuses and their explanations come from the official site and from what has been observed in real files; they do not replace the official resolution.
```

## Categories and tags

- Chrome Web Store: category **Productivity**, primary language English.
- AMO: desktop categories **Alerts & Updates** and **Other** (max 2); Android categories **Alerts & Updates**
  and **Other**; tags `nationality`, `residence`, `application status`, `reminder`, `privacy`.

## Privacy summary (for the listing and for the site's policy)

Your saved data stays on the device. The personal details you type (NIE, application number, year and date of
birth) are stored only in the extension's local storage, and the encryption passphrase, if you use one, only in
session storage, which the browser clears when it closes. There are no accounts, no servers of our own, no
analytics and no advertising. The extension sends nothing to us; the only request is the official form you submit
to `https://sede.mjusticia.gob.es/eConsultas/*` when you start a check, plus the captcha that page loads. "Report
a problem" shows the text first and only opens the website with it in the address fragment, which is not sent to
the server; a report you send from the feedback page (Cloudflare Turnstile) reaches the maintainer by email and is
not stored, and it never includes your own result or your identifiers. The backup is a file you choose where to
keep.

## The brand tagline

Spanish: _Tu expediente de nacionalidad, al día._ — English: _Your nationality application, up to date._
(decided on 2026-11-13; `brand/README.md` is the source of truth).

## How it is measured

```sh
wc -m store/listing.en.md            # the whole file
node -e "const t=require('fs').readFileSync('store/listing.en.md','utf8').split('\`\`\`');console.log(t[1].trim().length, t[3].trim().length, t[5].trim().length)"
```
