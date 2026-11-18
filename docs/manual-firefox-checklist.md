# Manual Firefox checklist (desktop)

The automated end-to-end suite runs in Chrome only (D1, see the plan's Run and Evidence). This list is what
replaces it on Firefox desktop: run it before every release against the same package that goes to AMO.

Out of scope here: Chrome (automated in `e2e/`), Firefox for Android (device, see the README), the deployed
privacy site, the store review, and anything the user must do by hand in the store dashboards. Only check 7
touches the real sede, and only because a person runs it; nothing in `npm run test:e2e` leaves the fake site.

## Before you start

1. `npm ci`
2. `npm run build:firefox && npm run zip` → `.output/naciocheck-<version>-firefox.zip`, the Firefox package the
   store receives (the source archive `npm run zip:sources` is separate).
3. In Firefox desktop 128 or newer, pin NacioCheck to the toolbar, open
   `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…** and select that zip. If the
   picker only accepts a manifest, select `.output/firefox-mv3/manifest.json` from the same build; it is the
   same code as the zip.
4. To repeat the first-install checks, **remove** the temporary add-on in `about:debugging` and load it again.
   Reloading counts as an update, not an install, and does not reopen onboarding.
5. `npm run test:e2e:firefox` is not a signal: that spec fails on purpose because Marionette cannot open
   `moz-extension://` pages, which is exactly why this list exists.

**Data.** Check 7 needs your own application and the captcha is yours to solve. Everything else works with
any application you can delete afterwards. This file is tracked and the repository becomes public: write only
`PASS`, `FAIL` or a short note in the **Observed** column, never a NIE, a name, a birth date, a passphrase or a
screenshot of real data.

## The checks

| #   | Check                                | Expected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Observed |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | First install                        | Loading the temporary add-on opens the onboarding page by itself. It shows "Qué hace" and "Qué no hace", the application form, the optional encryption line, the reminder presets and **Terminar** / **Cambiar todo en Opciones**.                                                                                                                                                                                                                                                                                                      |          |
| 2   | Onboarding: application and reminder | Saving the form clears it, shows "Solicitud «…» guardada." directly under **Guardar solicitud** and adds the application to a "Solicitudes guardadas" list below it, tinted and marked "Recién añadida"; a second save adds a second card and moves the mark. A preset ("Laborables a las 10:00", …) shows "Recordatorio guardado para los laborables a las …" directly under the presets, not at the bottom of the page.                                                                                                               |          |
| 3   | Options: add and validation          | Toolbar → **Opciones** → **Añadir otra**: a valid application appears at once, without reloading, as a tinted card marked "Recién añadida" at the end of "Solicitudes" (the page scrolls to it if it was off screen), with "Solicitud «…» guardada." under the form. An empty label, an invalid NIE, or a missing, impossible or future birth date are each reported and nothing is saved.                                                                                                                                              |          |
| 4   | Options: edit and cancel             | **Editar** opens the same form prefilled; renaming and saving puts the new label on the card with "Editada el …", the earlier checks stay in "Historial", and **Cancelar** restores the card unchanged. On an encrypted application the fields start locked: **Mostrar los datos** with the passphrase reveals them, and saving re-encrypts.                                                                                                                                                                                            |          |
| 5   | Options: delete                      | **Borrar** removes the card and its history.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |          |
| 6   | Encryption on, and at rest           | **Cifrar los datos** with a passphrase of 8+ characters (twice) says "Datos cifrados…"; the add form then asks for **Contraseña del cifrado** and a new application is stored encrypted too. The console check below lists `encrypted` for every application. A new application with a wrong passphrase says "Esa no es la contraseña: no se ha guardado nada." and stores nothing; **Quitar el cifrado** with a wrong passphrase says "No se ha podido descifrar…" and changes nothing, and with the right one turns them plain again. |          |
| 7   | Unlock and a real check              | **Comprobar ahora** on an encrypted application → the Desbloquear page → passphrase → **Desbloquear y empezar**. A 700×760 window opens on the real sede: the form is prefilled, only the captcha is usable, and solving it submits the query once → the result page shows "NacioCheck" with its icon at the top, the status, the site's own sentence after "Tal como la muestra la sede:", and "Historial" holds the new check.                                                                                                        |          |
| 8   | Status-change alert and badge        | After seeding a different previous check with the helper below, the next real check shows the full-screen "EL ESTADO HA CAMBIADO", a Firefox notification (`NacioCheck · <label>` / "Nuevo estado: …") and a red `!` badge on the toolbar button. **Entendido** is directly under the red banner, visible without scrolling, and clears the badge and the notification.                                                                                                                                                                 |          |
| 9   | Reminders                            | In Opciones → "Recordatorios", enable it for today at a time 1–2 minutes ahead and save: at that time the reminder notification arrives while Firefox is open (alarms do not fire while it is closed). Unchecking **Avisarme** saves "Recordatorio desactivado.".                                                                                                                                                                                                                                                                       |          |
| 10  | Popup                                | The toolbar popup is about 380 px wide, with no scrollbar and no wrapped dates. It lists every application with its latest status and "Comprobado el …" and **Comprobar ahora** per card; **Comprobar todo** appears only from two applications up; the **Opciones** and **Qué significa cada estado** links sit on a row of their own, apart, and open their pages.                                                                                                                                                                    |          |
| 11  | Status guide                         | "Qué significa cada estado" renders its sections; documented sources are plain links with `rel=noreferrer`, sources observed on real files are labelled and not linked, and the non-affiliation disclaimer is visible.                                                                                                                                                                                                                                                                                                                  |          |
| 12  | Language es ↔ en                     | Opciones → **Idioma** → English: options, popup and the guide switch to English with `lang=en` / `dir=ltr`, and status names read in English ("Open - Registered") in the popup, the history and the alert; the site's own sentence stays Spanish after "As the site printed it:"; choosing Spanish again (or "El del navegador (…)") restores Spanish.                                                                                                                                                                                 |          |
| 13  | Reminder days                        | In Opciones → "Recordatorios" the seven day boxes sit on one row, each box is at least 20 px with a label you can tap (44 px), and hovering a day shows its full name ("lunes", …); the boxes line up with the fields' left edge.                                                                                                                                                                                                                                                                                                       |          |
| 14  | Result pages                         | On a first check and on an error the result page starts with "NacioCheck" and its icon; the page's own messages after an error are introduced by "Tal como la muestra la sede:". The status-change alert has no second header: its banner carries the icon.                                                                                                                                                                                                                                                                             |          |

## Console check: identities are encrypted at rest

Open the options page in a tab (popup → Opciones), press F12 or **Inspect**, and run this in the page console:

```js
const { naciocheck } = await browser.storage.local.get('naciocheck');
naciocheck.applications.map((application) => application.identity.kind);
// ["encrypted", "encrypted"] — one entry per application, no "plain"
```

Every value must be `encrypted` while encryption is on. (Searching the stored JSON for your own NIE is a
stronger check but writes your identifier into the console; do not record the output anywhere.)

## Dev helper: seed a previous check for the change alert

The background only answers this message while `naciocheck:dev:enabled` is set by hand, and it seeds a check
for the given application. Run it in the options page console, then run a real check. The seeded check becomes
the latest one, so the real check is compared against it:

```js
const { naciocheck } = await browser.storage.local.get('naciocheck');
const applicationId = naciocheck.applications[0].id; // or pick one by label
await browser.storage.local.set({ 'naciocheck:dev:enabled': true });
await browser.runtime.sendMessage({
  type: 'naciocheck:dev:seed-check',
  applicationId,
  raw: 'Abierto - Registrado.',
  subStatus: null,
});
await browser.storage.local.remove('naciocheck:dev:enabled');
```

Choose a `raw` that differs from the status the real check returns, or there is no change to announce. Known
catalogue values include `Abierto - Registrado.`, `Abierto - En tramitación.`, `Abierto - En calificación.`
and `Finalizado - Concedido. Notificado.`. The flag is removed again by the last line; leaving it set does not
enable anything on its own, but do not ship a profile with it.

## Sign-off

| Field            | Value |
| ---------------- | ----- |
| Release version  |       |
| Firefox version  |       |
| Operating system |       |
| Date             |       |
| Result           |       |
| Checked by       |       |

Record the version, platform and result in the release notes; keep personal data out of this file.
