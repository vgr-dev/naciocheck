# Visual review of the regenerated site baselines

Date: 2026-11-24. Step 9 of `plan.md`. Reviewer: builder, following `.claude/commands/review-ui.md` (read-only).

## Run record

- **Helper change:** `openSitePage` in `e2e/specs/visual.e2e.ts` now sets every `document.images` entry to
  `loading = 'eager'` in the page before it waits for `complete` and decodes the images. Lazy images below the
  fold never complete in a page that has not scrolled to them, so the first run failed with
  `/ did not finish loading in the light theme`. Only the test changes; the built site keeps `loading="lazy"`.
- **Writer procedure:** `E2E_UPDATE_BASELINES=1 E2E_SPEC=visual npm run test:e2e` keeps the baseline directory, but
  `autoSaveBaseline` only writes an image that has no baseline. A second run against the old `site-*` images failed
  with mismatches of 5.343 % and 17.539 % (and left the baselines untouched), so the 48 old `site-*` files were deleted
  first and the writer then recreated them. The plan's one-line procedure should say this.
- **Writer run:** 22 passing, 0 failing. 48 `site-*` baselines recreated, all 48 differ from `HEAD`.
- **Non-site baselines:** none changed. `git status --short e2e/baselines` lists 48 `M` entries, all `site-*`.
  `git diff --stat 546835f -- e2e/baselines` lists only those 48 `site-*` files, so the 104 extension
  baselines equal commit 546835f. Nothing was restored with `git checkout`.
- **Compare run:** `E2E_SPEC=visual npm run test:e2e` passed, 22 passing, 0 failing. `index.md`:
  152 images, above tolerance 0 (tolerance 0.01 %). Every row reads `0 %`.
- **Network guard:** `seen 1087, answered by the fake site 1087, outside it 0`. No unexpected requests.
- **Fonts:** headless Chrome for Testing 158.0.8127.88, reduced motion forced, system font DejaVu Sans Book
  (`index.md` line, recorded 2026-11-16: `fc-match system-ui` and `sans-serif` both give DejaVu Sans Book). A visitor's
  system font will render other pixels; that is a limit, not a finding. The logotype ships as outlined paths, so
  it is the same everywhere.
- **Sizes:** landing 1280 px wide is 4906 to 4955 px tall, 412 px wide is 6437 to 6491 px tall; privacy 3903 to
  4063 and 6126 to 6315. Changelog and 404 are 1280x800 and 412x915.

## Coverage

All 48 images were opened, but not at the same resolution:

- Full size, in 1300 px (1280 wide) or 1650 px (412 wide) slices: `site-landing` es light and dark, at both widths
  (16 slices).
- Reduced, side by side: `site-landing` en and ca, light and dark, at 1280 (0.6 scale, two halves) and at 412
  (1.0 scale in three columns); `site-landing-dark-es-full412` the same way.
- Reduced: `site-privacy` all three languages, light beside dark, at 1280 (0.5 scale) and 412 (0.75 scale in three
  columns).
- Thumbnails: `site-changelog` and `site-404`, all 24, in contact sheets (0.4 scale at 1280, 0.6 at 412).

Small print was therefore read in es light and dark on the landing page and in the privacy sheets, and judged
from layout in the thumbnails. The step screenshots inside the landing page are store images scaled to the column;
their text is small by nature, so it was not judged.

## Findings

No High and no Medium findings. Nothing in the images looks official or uses real-looking personal data.

| #   | Severity | Image(s)                                                                                                                                                                         | What is wrong                                                                                                                                                                                                                                       | Why it matters                                                                                                      | Direction for the fix                                                                                                                                       |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Low      | `e2e/baselines/chrome/site-landing-light-ca-full1280.png`, `-dark-ca-full1280`, `-light-ca-full412`, `-dark-ca-full412`                                                          | The Catalan landing shows Spanish extension screenshots (hero, step 1, step 2, step 3, status guide). The note "L'extensió encara no està en català: les captures són en castellà." appears only under step 1, not under the hero or the others.    | A visitor may read the other Spanish screenshots as a missing translation.                                          | Show the note once, near the hero screenshot, or repeat it where the first Spanish screenshot appears. Owner of the landing partials and strings.           |
| 2   | Low      | `site-landing-light-es-full1280.png`, `site-landing-dark-es-full1280.png` (and the en, ca versions)                                                                              | The hero screenshot (options page with two saved applications) is the same image as the step 1 screenshot just below, and the hero shows neither the captcha nor the changed result, which the design direction calls the main story.               | The first screen repeats instead of selling; the strongest image (the changed-status alert) sits third in the page. | Consider using the changed-status or the captcha-only view in the hero. Content decision, not a defect of layout.                                           |
| 3   | Low      | `site-landing-*-es-full412.png`, `site-landing-*-ca-full412.png`, `site-privacy-*-es-full412.png`, `site-changelog-*-es-412x915.png`, `site-404-*-ca-412x915.png`, same for `ca` | At 412 px the header is two rows tall in es and ca (the "Tema" select drops under the language pills) and one row plus a select in en ("Theme" fits beside the pills). The header is about 172 px tall in es and ca against about 130 px in en.     | Inconsistent header height between languages; on a 915 px screen it pushes the first heading down.                  | Shorten the label or let the select sit on the pills' row (smaller gap or font) so all three languages wrap the same way. Owner of the header partial.      |
| 4   | Low      | `site-privacy-*-full1280.png`, `site-changelog-*-1280x800.png`, `site-404-*-1280x800.png` against `site-landing-*-full1280.png`                                                  | The text pages sit in a centred column of about 740 px starting near x = 272, while the header, the footer and the landing content start at x = 64. The left edge jumps between pages.                                                              | Small inconsistency of alignment from one page to the next.                                                         | Decide whether the text pages should share the landing's left edge (a wider container with a narrower measure) or whether the centred column is on purpose. |
| 5   | Low      | `site-landing-light-en-full1280.png`, `site-landing-dark-en-full1280.png`, `site-landing-*-en-full412.png`, `site-privacy-*-en-*`, `site-changelog-*-en-*`, `site-404-*-en-*`    | The footer link is "Changelog" in English while the page it opens is titled "What's new in NacioCheck". Spanish and Catalan use one word ("Novedades", "Novetats").                                                                                 | A visitor sees two names for one page.                                                                              | Use one name in strings (footer link and page title), in en.                                                                                                |
| 6   | Low      | `site-landing-dark-es-full1280.png`, `site-landing-dark-en-full1280.png`, `site-landing-dark-ca-full1280.png` and the 412 versions                                               | In the dark theme the store screenshots are white or near-white slabs on a dark page (hero, three steps, status guide). The brand allows them (they are product images), but they are the brightest areas of the page.                              | Glare in dark mode; the eye goes to the images before the headline.                                                 | Optional: a small brightness filter or a slightly darker frame in the dark theme. Not a defect.                                                             |
| 7   | Low      | `site-landing-light-es-full412.png` and the other seven landing 412 images                                                                                                       | On the phone the hero and step screenshots are the 1280 px screens scaled to about 380 px; their text is not readable.                                                                                                                              | The images show the idea but not the content on a phone; the text around them carries the meaning.                  | Optional: crop to the part that matters (the changed-status alert) for narrow widths, with a `picture` source. Step 8 or later, not for this step.          |
| 8   | Low      | `site-landing-light-es-full1280.png` (FAQ and "gestoría" sections, and the data section)                                                                                         | At 1280 the FAQ and the "gestoría" block use a column of about 735 px and leave the right third empty, while the sections above use the full width.                                                                                                 | Slightly unbalanced rhythm.                                                                                         | Optional: keep, as a reading measure, or place the FAQ in two columns.                                                                                      |
| 9   | Low      | source: `site/_build/partials/landing.css` line 147 (`.hero-facts li::before`)                                                                                                   | RTL source check. The check mark is drawn with logical borders (`border-block-end`, `border-inline-end`) and a fixed `transform: rotate(45deg)`. In a right-to-left page the border flips and the rotation does not, so the mark would be mirrored. | No RTL locale is shipped, so there is no effect today. This is readiness only.                                      | If RTL is ever added, flip the rotation with `[dir=rtl]` or draw the mark as an inline SVG.                                                                 |

## Checked and fine

- **Brand:** teal on white and teal on the dark navy; the wordmark and badge are not stretched or recoloured. The
  badge keeps its white disc in the dark theme. No flags, crests, or the words "Ministerio", "Oficial" or
  "Sede" in the branding. The red banner in the result screenshot is the extension's own alert, shown inside a
  product image.
- **Not official:** the non-affiliation line is in every footer, in all three languages, in the landing and privacy
  captures and in the 1280 captures of changelog and 404 (in the 412 viewport captures of changelog and 404 the footer
  line is cut by the viewport edge, as expected). The status guide teaser starts with
  "Orientativo, no oficial." in es, "A guide, not official." in en, "Orientatiu, no oficial." in ca. The privacy page
  has a "no afiliación" section. The hero facts say "Proyecto independiente, no oficial".
- **Layout:** no clipped, overlapping or overflowing element and no horizontal scroll at 412 px in any of the 24
  phone images. Install buttons stack on the phone and are about 58 px tall. FAQ rows are about 64 px high with a
  clear plus icon. Heading hierarchy is the same on every page.
- **Text fit:** Spanish and Catalan wrap one line more than English in the hero, steps and FAQ, with no
  truncation. All three languages are complete: no raw key, no `⟦…⟧` marker. The official status names stay in
  Spanish in every language, on purpose.
- **Themes:** light and dark keep the brand, borders are visible, and links look like links (underlined, teal). Contrast:
  the muted text was measured from the rendered pixels (the darkest or lightest pixel of the
  text against the commonest colour of its box, so approximate): about 7.6 : 1 light, 7.7 : 1 dark for section
  leads and status descriptions, 7.1 : 1 for the dark install note "Próximamente", 16 : 1 or more for body text.
- **Data:** only invented data appears: "Solicitud uno" and "Solicitud dos", dates 1 and 2 January 2026 and
  1 February 2026, the placeholder `X1234567L` in the empty form fields, and the label "Mi solicitud". No real NIE,
  name or birth date. The only personal name is the maintainer's credit in the footer ("Victor Gonzalez", as
  published on the site).
- **RTL source check (code, not pixels):** `site/_build/partials/*.css` and `src/` have no `margin-left`,
  `margin-right`, `padding-left`, `padding-right`, `border-left`, `border-right`, `left:`, `right:`, `float:` or
  `text-align: left|right`. The only hit is finding 9. The site CSS uses logical properties (17 hits for
  `margin-inline`, `padding-inline`, `inset-inline`). No RTL rendering was seen.

## Not reviewed and limits

- No image was left unopened, but small print in the en and ca landing images, in the changelog and 404 sheets, and
  in the 0.5-scale privacy sheets was judged by layout, not read word by word.
- The matrix contains no hover, focus, open-FAQ, forced-colours, reduced-data or print state, and no tablet
  width between 412 and 1280. The extension's own dark theme is not in this matrix.
- The images are viewport or stitched captures in one browser (Chrome for Testing, DejaVu Sans). Firefox and real
  device fonts are not covered; Firefox desktop is checked by hand before a release.
- The animated hero mark is photographed at rest (reduced motion forced).
- Contrast outside the measured areas was judged by eye.
- Install buttons are inert "Próximamente" placeholders, so no store link was exercised.
