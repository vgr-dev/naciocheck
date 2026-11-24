# Audit: landing page polish (step 10)

Read-only review of the files changed since `546835f`
(`git diff --name-only 546835f HEAD -- site scripts/build-site.mjs`):
`scripts/build-site.mjs`, `site/_build/partials/base.css`, `site/_build/partials/landing.css`,
`site/_build/strings.json`, `site/theme.js`, `site/index.html`, `site/en/index.html`, `site/ca/index.html`.

Method: every rule in the bundled `web-design-guidelines` `references/command.md` was applied to the
source, then the result was critiqued against the plan's design direction with `frontend-design`.
Nothing was built and no browser was opened (step 9 owns `.output/`), so everything below is
from source. Items that need a rendered check are marked "unverified" and are candidates for step 11.
Contrast ratios were computed from the token values in `base.css:10-41` with the WCAG formula the
existing tests use (`tests/site-contrast.test.ts:30-41`, `tests/site-landing.test.ts:267-316`).

Owner of a fix: 6 = theme/header/`base.css`/`build-site.mjs`; 7 = landing sections, `landing.css`,
landing HTML; 8 = hero screenshot.

## Summary

| Severity | Count |
| -------- | ----- |
| high     | 0     |
| medium   | 4     |
| low      | 17    |
| nit      | 8     |

No high findings. The guideline anti-patterns are absent: no `transition: all`, no `outline: none`, no
`user-scalable=no`, no paste blocking, no icon-only control without a name, no autoplay media, all
images carry `width`, `height` and `alt`. Motion is limited to a single-play badge and a skip-link
transition, both reduced-motion safe.

## Medium

- `site/_build/partials/base.css:88-119` - medium - Forced colours: the wordmark variant follows
  `data-theme` and `prefers-color-scheme`, not the forced palette. A visitor on a Windows high-contrast
  theme who picked Light in the theme control gets the light (dark-ink) logo, and may get it on a black
  canvas, which makes the wordmark in the header (`build-site.mjs:197-198`) and in the hero
  (`site/index.html:24-37`) disappear. The hero `h1` keeps its accessible name, so this is visual
  only. Fix: add an `@media (forced-colors: active)` block that chooses the variant from
  `prefers-color-scheme` and ignores `data-theme`, or hide the theme control there because the
  choice has no effect. Unverified in a browser. Owner: 6 (header logo) and 7 (hero wordmark uses the
  same classes).
- `site/_build/partials/base.css:332-335` - medium - The current language is shown only by a tint:
  `--accent-soft` on `--bg` is 1.13:1 in light and 1.87:1 in dark (computed), and its text colour `--accent-soft-fg` differs from the neighbours' `--muted` by hue and
  a small luminance step at the same weight (550). `aria-current` covers assistive technology, and
  forced colours get an outline (`base.css:662-664`), but sighted users in normal mode have a weak
  non-colour cue (WCAG 1.4.1). Fix: add a non-colour cue such as heavier weight, an underline or an inset
  ring using `--control-border`. Owner: 6.
- `site/index.html:55-66`, `site/en/index.html:55-66`, `site/ca/index.html:55-66` - medium - Design
  direction vs hero: the plan makes "reminder, human captcha step and changed result the main story".
  The hero shows the saved-applications list, and step 1 repeats the same screen
  (`site/index.html:89-101`, the same `options-several` capture, alt text that names the same two
  applications, `site/index.html:65` and `:100`). Visitors see one screen twice and the hero does not
  show a captcha or a result. The crop satisfies "distinct from the changed-result shot" but not
  "distinct capability". Consider the captcha or alert capture for the hero and the list for step 1.
  Owner: 8 (the choice), 7 (step 1 if swapped).
- `site/index.html:55-66` (all three locales) and `landing.css:151-156` - medium - Phone legibility of
  the screenshots, by arithmetic and unverified in a browser. The hero crop is 832 px wide and renders at
  about 343 px on a phone (progress.md, step 8), a scale of 0.41. The 1280 px step and status captures render at
  about 358 px, a scale of 0.28. Extension text of 13 to 14 px becomes 4 to 6 px. The images then work
  as illustrations, and the alt text and captions carry the meaning, which is acceptable, but the plan says
  "preserve screenshot legibility". Consider a tighter crop or a `<picture>` art-direction source for
  narrow widths. Owner: 8 (hero), 7 (steps and status).

## Low

### `scripts/build-site.mjs`

- `build-site.mjs:138` - low - `<script src="/theme.js"></script>` is parser and render blocking by design
  (plan Risks). With no `_headers`, repeat visits may pay a revalidation round trip before first paint.
  Already assigned to the step 11 warm-load measurement; no action here.
- `build-site.mjs:197-198` - low - Both logo variants are emitted as plain `<img>`, so both SVGs download
  in every theme (the hidden one is `display: none`, which does not stop loading). The same happens for
  the hero wordmark (`site/index.html:24-37`). Cost is small but is four requests; step 11 should record
  it in the waterfall. Owner: 6.
- `build-site.mjs:136-137` - low - Add `<meta name="color-scheme" content="light dark">` next to the
  `theme-color` metas. Without it the canvas is white until the inline stylesheet applies, and the
  blocking script at `:138` sits before the inline style (`@head` is above `@style` in every page), so
  a dark-OS visitor in Auto can see a white flash while `/theme.js` loads. The guideline asks for
  `color-scheme` on the root; the CSS does it (`base.css:11`), the meta only covers the pre-style
  window. Owner: 6.

### `site/theme.js`

- `theme.js:9`, `theme.js:18-24` - low - When `light-dark()` is unsupported, `data-theme="dark"` is still
  set and the select still shows "Dark", but the page renders the light fallback palette and the light
  logo (`base.css:62-91`). The control misreports in Safari before 17.5. Fix: in the unsupported case
  keep the select on its saved value but disable it, or coerce `mode` to `auto`. Owner: 6.
- `theme.js:37-63` - low - The control reveals only after `DOMContentLoaded`. On a slow parse the
  reserved gap is visible and empty, and without script it never appears (see `base.css:345-347`). The
  reservation is the right trade-off; noted so step 11 checks the no-script header looks intentional.

### `site/_build/partials/base.css`

- `base.css:345-347` - low - Without JavaScript the `.theme-picker` stays `visibility: hidden`
  permanently, leaving a blank slot beside the language links. Fix: scope the hiding to
  `html.js`-style marking, or collapse the slot under `@media (scripting: none)`. Owner: 6.
- `base.css:231-235` - low - `:focus-visible { border-radius: 4px }` beats the bare `button` rule
  (`base.css:487-503`, specificity 0,0,1 against 0,1,0), so keyboard focus changes a button's corners from
  8px to 4px. Classed controls (`.install`, `.button`, `.theme-picker select`) are unaffected. Drop
  the radius from the global rule or raise the button rule. Owner: 6.
- `base.css:315-325`, `base.css:377-380` - low - Language links are 36 px high (`min-block-size: 2.25rem`),
  with 0.875rem text, and 0.8125rem text with 0.5rem inline padding at 26rem and below. They pass WCAG
  2.5.8 (24 px), but sit under the 44 px used for the select and buttons and under the plan's 0.9375rem
  "small" floor. They are controls, not running text, so the floor strictly does not apply. Owner: 6.
- `base.css:487-503`, `base.css:542-555`, `base.css:315-325` - low - `touch-action: manipulation` is set on
  the select and on FAQ summaries but not on buttons, `.button`, `.install` or the language links.
  Add it to the shared control selectors. `-webkit-tap-highlight-color` is not set anywhere (nit).
  Owner: 6 (shared) and 7.
- `base.css:657-671` - low - Forced colours: the block covers the header strip, the current-language
  outline, install buttons, link boxes and cards, but not `a.button` (`base.css:487-503`, used by the agency
  CTA and 404). Its border uses `--button-bg`, which the browser replaces; this is likely fine but is
  unverified. Add `.button` to the border list for parity with `.install`. Owner: 6.

### `site/_build/partials/landing.css`

- `landing.css:280-287`, `landing.css:310-312` - low - Forced colours: the timeline connector is drawn
  with `background: var(--card-border)` and the final dot with `background: var(--accent)`. Forced
  colours replace non-system backgrounds with `Canvas`, so the connector line disappears and the last
  dot looks hollow like the rest. The dots (borders) survive. The existing forced-colours block
  (`landing.css:491-503`) covers only notes, callouts and the FAQ icon. Fix: in
  `@media (forced-colors: active)` set the connector to a `CanvasText` border and the last dot to
  `CanvasText`. Owner: 7.
- `landing.css:185-197` - low - Forced colours: the step number badge is a filled circle
  (`background: var(--button-bg)`). The fill is lost and the number stays on Canvas without a circle,
  legible but plainer. Add `border: 2px solid CanvasText` in the forced-colours block. Owner: 7.
- `landing.css:285`, `landing.css:204-215` - low - Hairline contrast. `--card-border` is 1.21:1 on
  `--band` in light (1.79:1 dark); `--border` is 1.23:1 on `--bg` (1.37:1 dark) and 1.18:1 on `--band`
  (1.30:1 dark). `base.css:28` states these are decorative. They carry the timeline connector and the
  screenshot frame, which are structural. The frame is weak where a screenshot has a white edge on a white
  section in light mode, so the "one restrained frame" can read as unframed. Not a WCAG failure
  (decorative; the dots and the image content carry the information). Consider `--control-border` at
  reduced width, or a faint shadow, for the image frame. Owner: 7.
- `landing.css:151-156` with `site/index.html:61` - low - The hero `sizes` value says `29.5rem` from 52rem
  upward. The column is `1fr` of `1.35fr 1fr` and equals 29.4rem only at the widest layout. At a 52rem
  viewport it is about 19rem, so the browser fetches a larger candidate than needed. It never
  under-fetches, so it is a small byte cost. Owner: 8.
- `landing.css:129`, `landing.css:165`, `landing.css:269` (the `ul.hero-facts`, `ol.steps` and `ol.timeline`
  rules) - low - `list-style: none` drops list semantics in Safari and VoiceOver unless `role="list"` is
  added. `.promises` already does (`site/index.html:239`); the other three lists do not
  (`site/index.html:47`, `:79`, `:158`). For `.steps` and `.timeline` the order matters. Owner: 7.

### Landing HTML

- `site/index.html:55-66`, `site/en/index.html:55-66`, `site/ca/index.html:55-66` - low - The hero image has
  no `fetchpriority="high"`. It is eager and above the fold and likely the phone LCP element, and the
  guideline asks for it. Owner: 8.
- `site/index.html:22-39` - low - Design: the hero lockup repeats the header logo directly above it
  (`build-site.mjs:197-198`). The first screen shows the wordmark twice; the second one does the work of
  an `h1` but adds no information. Weigh dropping the header logo on the landing page, or making the hero
  lockup smaller. Owner: 7 (and 6 if the header changes).

## Nit

- `base.css:137` - nit - `min-block-size: 100vh` on mobile includes the browser chrome, which leaves a
  small scroll on short pages (404, feedback). Use `100dvh` after the `100vh` fallback. Owner: 6.
- `base.css:161` - nit - The `h1` size is a literal `clamp(1.85rem, 1.45rem + 1.6vw, 2.5rem)` while the
  hero tagline uses `--font-size-hero` (`base.css:46`). Several other sizes are also literals outside the
  scale: `base.css:395`, `base.css:401`, `landing.css:113`, `landing.css:191`, `landing.css:226`. Same
  scale, two sources. Owner: 6.
- `base.css:454-458`, `base.css:337-358` - nit - The `.theme-picker` label inherits `label`'s
  `font-weight: 650` and `select { font: inherit }` repeats it, so the closed select text is semi-bold.
  Set `font-weight: 400` on the picker or its select. Owner: 6.
- `base.css:180-183` - nit - Paragraphs have no `text-wrap: pretty`; headings are balanced
  (`base.css:156`, `landing.css:108`). Optional.
- `landing.css:30-36` - nit - Section separation is doubled: a 1 px border (`.section + .section`)
  and a band colour change. It is quiet, but the forced-colours rendering shows only the borders; there is
  no border between the FAQ band and the agency band (`.agency` is not `.section`, `landing.css:468`).
  Owner: 7.
- `landing.css:402-414`, `landing.css:421-430` - nit - With a wrapped question the icon is vertically centred
  against the text block (`align-items: center`). Top alignment to the first line is the more common
  pattern; both are acceptable. The icon geometry itself is exact: both strokes are grid-centred in the
  26 px content box with integer offsets (8 px and 12 px), matching the plan.
- `site/ca/index.html:65` and `:100`, `:144`, `:227` - nit - Catalan alt text says the screens are in
  Spanish ("pantalla en castellà", "en castellà"), which is right for AT users, but the visible
  captions (`site/ca/index.html:67`) do not, so sighted users get no cue. Owner: 8 (hero) and 7.
- `site/index.html:285-286` (and the other `summary` rows) - nit - Expanded FAQ panels are not
  deep-linkable (the guideline asks for URL state on expanded panels). Native `details` is the settled
  choice (spec); optional `id` on each `details` plus a `:target` rule would add it. Skip unless wanted.

## Per-area results

### Forced colours

Covered: header strip (`base.css:658-660`), current language (`:662-664`), install and cards
(`:666-670`), status note and callout (`landing.css:492-495`), FAQ icon, its strokes via `currentColor`
and its hover and open states (`landing.css:497-502`). Gaps are listed above: logo variant (medium),
timeline connector and final dot, step badge, `.button` border. `.install.is-soon` keeps its dashed
border in forced colours because its rule (0,2,0) outranks the forced block (0,1,0), which is wanted.
The `.hero-facts` check marks and the timeline dots use borders and survive.

### Theme control

Pass: native `<select>` with a visible `<label for>` (`build-site.mjs:204-206`), localized labels
(`strings.json` `theme.*`, validated at `build-site.mjs:107-109`), `autocomplete="off"`, explicit
`background-color` and `color` (`base.css:353-354`), 44 px height (`base.css:350`), `touch-action`
(`base.css:357`), reserved space until ready (`base.css:345-347`), storage reads and writes guarded
(`theme.js:29-33`, `:48-54`), storage values restricted to three modes (`theme.js:14`), `pageshow` and
`storage` resync (`theme.js:56-59`), `theme-color` metas switched per scheme (`theme.js:19-24`,
`build-site.mjs:136-137`), single script on 404 too (`build-site.mjs:138,145`). Gaps: the findings under
`theme.js`, `base.css:345-347` and the missing `color-scheme` meta. No `name` on the select; nothing is
submitted, so not needed.

### Screenshot text alternatives and layout

Pass: all seven landing images have a non-empty, localized `alt` and intrinsic `width` and `height`
(`site/index.html:55-66`, `:89-101`, `:130-142`, `:209-221`; the same in `en` and `ca`), the three images below the
hero are `loading="lazy"` with `decoding="async"`, `sizes` match the CSS columns for the step and status
images at wide widths (`40rem` is 40.3rem at 1152 px, `34rem` is 34.5rem), the hero is eager, appears
after the install actions on phones (`landing.css:55-60`), and no layout reads exist. The brand badge is
`alt=""` with the name in the wordmark's `alt` (`site/index.html:22-35`); the hidden variant leaves the
accessibility tree. English imagery on `en`, Spanish on `ca` with a note in the alt. Findings: duplicate
screen (medium), phone legibility (medium), `fetchpriority`, `sizes`.

### Contrast evidence (focus, icons, overlays)

Tokens from `base.css:10-41`; ratios computed; "tested" cites the test that holds the pair.

| Pair                                  | Light | Dark  | Where                                          | Tested                                                 |
| ------------------------------------- | ----- | ----- | ---------------------------------------------- | ------------------------------------------------------ |
| `--focus` on `--bg`                   | 5.47  | 11.99 | focus ring, 3:1                                | `site-contrast.test.ts:66`                             |
| `--focus` on `--band`                 | 5.25  | 11.41 | hero, FAQ, footer                              | `site-contrast.test.ts:67`, `site-landing.test.ts:296` |
| `--focus` on `--surface`              | 5.47  | 10.95 | cards, select                                  | `site-contrast.test.ts:68`                             |
| `--focus` on `--accent-soft`          | 4.86  | 6.41  | agency band                                    | `site-landing.test.ts:294`                             |
| `--control-border` on `--bg`          | 4.76  | 3.67  | select, secondary buttons                      | `site-contrast.test.ts:69`                             |
| `--control-border` on `--band`        | 4.56  | 3.49  | FAQ icon outline                               | `site-landing.test.ts:305`                             |
| `--control-border` on `--surface`     | 4.76  | 3.35  | select fill, textarea                          | `site-contrast.test.ts:70`                             |
| `--accent` on `--band`                | 5.25  | 11.41 | FAQ plus and minus, timeline dots, hero checks | `site-landing.test.ts:303`                             |
| `--accent-hover` on `--band`          | 7.27  | 13.39 | FAQ hover and open strokes                     | `site-landing.test.ts:304`                             |
| `--button-bg` on `--accent-soft`      | 4.86  | 6.41  | agency button against its band                 | `site-landing.test.ts:292`                             |
| `--accent-soft-fg` on `--accent-soft` | 8.41  | 9.09  | agency text, callout, selection                | `site-landing.test.ts:291`                             |

Overlays: the site has none. No text over images, no scrims, no modals. The layered elements are the
skip link (`--button-fg` on `--button-bg` 5.47:1 light, 11.99:1 dark, `site-contrast.test.ts:64`), the
3 px header strip (decorative; `--edge-end` on white is 2.49:1 and carries no text, `base.css:39`), `::selection`,
and the browser-drawn select popup (styled by `color-scheme`). The sticky status screenshot
(`landing.css:340-343`) holds no focusable content, so it cannot cover a focused element, and the header is
not sticky, so `scroll-margin-block-start: 1.5rem` (`base.css:440-442`) is enough.
Untested decorative values: `--border` and `--card-border` (1.18 to 1.88:1) and the current-language
tint (`--accent-soft` on `--bg`, 1.13:1 light); the current-language tint is the one finding (medium) because
it conveys state. Contrast tests cannot see forced-colours output; that is a step 11 manual check.

### Design direction critique

Delivered as planned: tagline is the largest landing text (2.5rem against `h2` at 1.75rem,
`base.css:46-47`), `--measure: 68ch` (`base.css:56`), labels above headings gone, privacy as a
divided two-column list (`landing.css:348-382`), flat hero band (`landing.css:50-53`), a quiet agency band with no
rings or motion (`landing.css:468-489`), native FAQ with CSS-drawn centred strokes, numbered steps kept
because they are a sequence, badge plays once (<1 s, `brand/icon-animated.svg`, `prefers-reduced-motion`
disables it, no `infinite`). No gradient decoration, no all-caps tracking, no repeated card kit.

Critique: the page is disciplined but spends no boldness in one place. The one element that could be
memorable, the "a person solves the captcha" promise, is a tinted callout (`landing.css:224-232`) and the hero shows the
settings list instead. Suggested single bold move (one of): make the captcha callout the page's visual
anchor, or put the captcha/alert capture in the hero (owner 8). Smaller: the doubled logo (low), banding
with borders (nit), repeated first screen (medium). The type scale matches the plan; literals that bypass it
are listed as nits.

### Typography, i18n and copy

No `...`, straight quotes or hard-coded dates or numbers in the changed markup. Spanish and Catalan use
`«»` and `'`; English uses curly quotes (`site/en/index.html:100`). Brand name carries `translate="no"` in the
hero wordmark and body prose (`site/index.html:23`, `:108`, and the rest), but not in the header link's
`aria-label` (`build-site.mjs:196`, "NacioCheck, inicio"), which is spoken text and fine as is.
Sentence-case headings and buttons follow the project's voice; the guidelines' Title Case rule was not applied to a site written in
Spanish and Catalan and kept in sentence case in English. Skip links, `lang` and `hreflang` on every language link are present.

### Passes (checked, no finding)

Skip link first in `body` with target `#main` on all page types; one `h1`, no skipped level
(`tests/site-landing.test.ts:149`); `section`s labelled by their headings; `[id]` scroll margin;
`prefers-reduced-motion` global switch (`base.css:644-653`); no `transition: all`; no hover-only
information; hover states exist for links, buttons, language links and FAQ rows; `text-wrap: balance` on
headings; no `user-scalable`; no layout reads in script; `<img>` dimensions everywhere; `min-width: 0`
not needed because every flex text child can wrap at spaces (`landing.css:402-414`; `overflow-wrap:
break-word` does not shrink min-content, so a very long unbreakable word in a future question would push
the icon, no current case).
