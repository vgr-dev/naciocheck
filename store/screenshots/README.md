# Store screenshots

Five images per language, taken from the visual matrix in `e2e/baselines/chrome/` (Phase 6) and copied unchanged:
they are already `1280×800` PNG, the size both stores ask for, so nothing is resampled and no quality is lost.

| Order | File (`es/` and `en/`)                    | What it shows                                    | Baseline                                  |
| ----- | ----------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| 1     | `onboarding-empty-<locale>-1280x800.png`  | first run: what it does and what it does not do  | `onboarding-empty-<locale>-1280x800.png`  |
| 2     | `options-several-<locale>-1280x800.png`   | two applications, their history and the reminder | `options-several-<locale>-1280x800.png`   |
| 3     | `result-changed-<locale>-1280x800.png`    | the alert when a status changes                  | `result-changed-<locale>-1280x800.png`    |
| 4     | `options-encrypted-<locale>-1280x800.png` | the optional encryption of the stored data       | `options-encrypted-<locale>-1280x800.png` |
| 5     | `statuses-guide-<locale>-1280x800.png`    | what each status means, with its sources         | `statuses-guide-<locale>-1280x800.png`    |

- **Chrome Web Store** takes the five `es` images for the Spanish listing and the five `en` ones for the English
  listing (screenshots can be localized); the maximum is 5 per locale.
- **addons.mozilla.org** takes one set of screenshots for all locales and asks for them in 1280×800 (1.6:1). Both
  sets are kept so the listing can be switched per language.
- **Every value in them is invented**: the labels are «Solicitud uno» and «Solicitud dos», the NIE is
  `X0000000X`, and the dates are frozen at February 2026 by `freezeStoredDates()` in the visual spec. Nothing in
  these files identifies a person.
- **The popup is deliberately not here.** Its page is built for the 380×600 popup window, so at 1280×800 it is a
  small card in a large empty frame. If a popup image is wanted for the listing it has to be composed — a device
  or window mockup — which is a promo asset (10.3), not a screenshot.
- **No image is of the official site.** The visual matrix has three (`form-captcha`, `form-hint`, `form-picker`),
  and they are excluded on purpose: they are somebody else's page, they carry the test captcha stub, and a store
  listing should not look as if that page were ours.

## Dimensions and sizes

```sh
node -e '
const sharp = require("sharp"); const fs = require("fs"); const { join } = require("path");
(async () => {
  for (const locale of ["es", "en"]) {
    const dir = join("store", "screenshots", locale);
    for (const file of fs.readdirSync(dir).sort()) {
      const m = await sharp(join(dir, file)).metadata();
      console.log(`${locale}/${file}: ${m.width}x${m.height} ${m.format}`);
    }
  }
})();'
```

All ten are `1280x800 png` (43–135 KB each; the directory is 780 KB).
