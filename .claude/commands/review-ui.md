---
description: Review the screenshot matrix against the brand and layout rules, reporting findings by severity.
---

Act as a reviewer of the user interface **as it looks**, from the screenshot
matrix the Chrome E2E suite produces. This is a read-only review: report findings, never change code, baselines or
specs, and never stage, commit or push.

# What the matrix is

`e2e/specs/visual.e2e.ts` photographs every extension page in its main states, in Spanish (`es`) and English (`en`),
at three viewports, against the production build and invented data only. It also photographs the built product site
(`.output/site/`, served locally as `site.naciocheck.test`) in Spanish, English and Catalan (`ca`), in the light and
the dark theme. Image names are `<page>-<state>-<locale>-<viewport>.png`; for a site page the state is the theme:

| Part     | Values                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| page     | `onboarding`, `popup`, `options`, `statuses`, `result`, `unlock`, `form` (the fake official form + overlays) |
|          | site: `site-landing`, `site-privacy`, `site-changelog`, `site-404`                                           |
| state    | the extension page's state (`empty`, `saved`, `several`, `changed`, …); for a site page the theme, `light` or `dark` |
| viewport | `1280x800` desktop, `412x915` phone, `380x600` popup (popup only)                                            |
|          | `full1280`, `full412`: the whole page, scrolled and stitched (long extension pages, `site-landing`, `site-privacy`) |
| locale   | `es`, `en`; the site pages also `ca` (its screenshots of the extension stay in Spanish until it has `ca`)     |

The site matrix is 4 pages × 3 languages × 2 themes × 2 widths = 48 images.

Two folders matter:

- `e2e/baselines/chrome/` — the tracked, approved images. **These are what a release would show; review these.**
- `e2e/.artifacts/screenshots/index.md` — written by the last run: every image with its dimensions and mismatch, the
  tolerance, the font setup and the browser. It is git-ignored and can be missing or stale.

# Workflow

1. Read `AGENTS.md` and `brand/README.md`. Check `specs/` for a spec with `status: active`, so findings can name the
   plan step they belong to.
2. Read `e2e/.artifacts/screenshots/index.md`.
   - If it is missing, say so, list `e2e/baselines/chrome/` instead and tell the user that `npm run test:e2e`
     regenerates the index. Do not run the suite yourself: it takes minutes and writes artefacts.
   - If it lists rows **above tolerance**, those are visual regressions: open the baseline, the matching image in
     `e2e/.artifacts/screenshots/actual/chrome/` and the diff in `…/diff/chrome/`, and report each as a finding.
   - Note the font line. Pixels from a machine with other fonts are not comparable, so a font difference is a
     limitation to state, not a finding.
3. Open the images with the file-reading tool, so you see them. Aim for every image. If you cannot, open at least
   one image per **page × state × viewport** in both locales, and list what you did not open under "Not reviewed".
   Never describe an image you did not open.
4. Review each image against the checks below. Judge what you see; do not infer a defect from the file name.
5. Run the one code-level check that images cannot show (RTL readiness, below).
6. Write the report in the format below, in the language the user wrote to you in.

# Checks

**Brand** (`brand/README.md` is the source of truth)

- Colours stay within the brand tokens: teal `#0F766E` / `#0D9488` / `#14B8A6` / `#5EEAD4` with white and grey. No red
  together with yellow, no flag colours, crests or anything that makes the extension look official.
- The icon and logo are used as the brand fixes them: not stretched, recoloured or placed on a busy background; clear
  space of at least ¼ of the icon's diameter. Text uses the system UI font, never a decorative one.
- The product is never presented as the Ministerio de Justicia's or as endorsed by it, and status explanations are
  never presented as official. The non-affiliation wording is present where the page promises it.
- Contrast: body text and controls must be clearly legible against their background. Say "looks low" for what you
  judge by eye; give a ratio only if you computed it, and say how.

**Layout, per viewport**

- Nothing is clipped, overlapped, cut off at an edge or pushed outside its card; no horizontal scrolling at `412x915`
  or in the `380x600` popup; the popup's content fits its frame or scrolls on purpose.
- Primary actions are visible without hunting. On the phone, tap targets look large enough (about 44 px) and are not
  crowded.
- Spacing, alignment and the heading hierarchy are consistent from one page to the next; the same control looks the
  same everywhere.
- In a stitched whole-page image (`full1280`, `full412`), a sticky element may appear where the scroll left it; judge
  it against what a visitor would see, not as a duplicate.
- State screens say what happened: the changed-status alert is unmistakable, an error shows the page's message, and
  an empty state tells the person what to do next.

**es / en / ca text fit**

- Compare the `es` and `en` image (and `ca` for the site) of the same page, state and viewport side by side. Spanish
  and Catalan are usually the longer: look for wrapped, truncated or overflowing labels, buttons that grew past their
  container, and lines that now collide.
- Every language must be complete: no untranslated string, no raw key, no `⟦…⟧` pseudo-locale marker. The official
  status names on the site stay in Spanish in every language, on purpose.

**Site themes**

- Compare the `light` and `dark` image of the same site page: both must keep the brand (teal on white or on the dark
  background, never a recoloured icon), legible text, visible borders and links that look like links.
- The site is a product page, not an official one: the non-affiliation line is in every footer, and the status guide
  teaser says it is orientative and not official.

**Data in the images**

- Only invented data may appear: the NIE `X0000000X`, labels such as `Solicitud uno`, dates frozen in February 2026,
  the `TEST CAPTCHA STUB` box. Anything that looks like a real NIE, name or birth date is a **High** finding, whatever
  else is fine. The site's how-it-works images are store screenshots with the same invented data.
- The `form-*` images contain a capture of somebody else's page plus the test stub. Review only what the extension
  adds to it (the captcha-only view, the hint, the picker). The stub and the captured page are never defects of ours,
  and they must never reach a store image.

**RTL readiness (code, not pixels)**

The matrix has no right-to-left image. Check the readiness in the stylesheets instead: search `src/` and `site/_build/partials/` for physical
properties — `margin-left`, `margin-right`, `padding-left`, `padding-right`, `border-left`, `border-right`, `left:`,
`right:`, `float:`, and `text-align: left|right` — and for sizes or transforms that assume a reading direction. Each
hit is a finding unless the property is deliberately physical (say why). The logical equivalents
(`margin-inline-start`, `inset-inline-end`, `text-align: start`, …) are the rule. State plainly that this is a source
check and that no RTL rendering was seen.

# Report

Reply with this structure; do not write files.

```
## UI review — <date from `date +%F`>
Reviewed: <n> of <total> images (<how chosen>). Index: <found / missing>, above tolerance: <n>. Fonts: <line from index>.

### Findings
| # | Severity | Image(s) | What is wrong | Why it matters | Direction for the fix |

### Checked and fine
<one line per area: brand, layout, text fit, data, RTL source>

### Not reviewed / limits
<images not opened; states the matrix does not contain (hover, focus, the extension's dark theme, RTL rendering, real data);
contrast judged by eye>
```

Severity:

- **High** — breaks use or a hard rule: unreadable or unreachable content, real-looking personal data, an official
  look, a changed-status alert that is not unmistakable, a Spanish, English or Catalan screen that is not usable.
- **Medium** — visibly wrong but usable: overflow that keeps the text readable, inconsistent spacing or controls,
  low contrast on secondary text, a physical CSS property that would break in RTL.
- **Low** — polish: alignment, wording that nearly overflows, small inconsistencies.

# Rules

- Cite the image path of every finding (`e2e/baselines/chrome/<name>.png`); a finding without an image or a source
  line is not a finding. Several images with the same defect are one finding listing all of them.
- "Direction for the fix" says what to change and where, in words. Do not write code or patch files.
- Do not repeat what is fine at length, and do not pad the list: no findings is a valid result, stated plainly.
- If a finding concerns a settled decision in `AGENTS.md`, report it as a question for the user, not as a defect.
- Write no files. Reply in chat; if the user asks to save the report, put it in the active spec's `review.md`.
