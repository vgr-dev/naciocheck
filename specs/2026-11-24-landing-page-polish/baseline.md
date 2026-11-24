# Landing page baseline

Captured 2026-11-24, before site changes, from commit `666b6d9` using the built local site at
`http://localhost:8787/` (`npm run dev:site`). The site build completed with 15 pages and 20
generated files. Browser: Chrome 158.0.0.0 (Windows 10 x64 user agent, MCP-controlled Chrome).
The measured page was the Spanish landing page.

## Protocol

| Profile | Viewport                              | Network     | CPU         | Samples                     |
| ------- | ------------------------------------- | ----------- | ----------- | --------------------------- |
| Desktop | 1365 × 900 CSS px, DPR 1              | Unthrottled | 1×          | 3 cold, then 3 warm reloads |
| Phone   | 390 × 844 CSS px, DPR 1, mobile/touch | Fast 4G     | 4× slowdown | 3 cold, then 3 warm reloads |

Cold traces used Chrome Performance MCP reload with cache bypassed. Warm traces reloaded with the
browser cache enabled. The server's `max-age=0, must-revalidate` policy meant warm assets were
revalidated (304); this is a cached repeat visit, not a memory-cache-only navigation. Traces were
captured with Chrome Performance MCP. FCP was read from the Paint Timing API immediately after each
trace because the MCP trace summary did not print FCP. LCP and CLS came from the trace summary.
Samples are lab observations from this browser and local Worker, not field Core Web Vitals.

## Performance samples

Times are milliseconds. CLS is unitless. Each triple is in capture order; medians are shown in bold.

| Profile / cache | FCP samples (median)    | LCP samples (median)    | CLS samples (median)        | LCP element                                     |
| --------------- | ----------------------- | ----------------------- | --------------------------- | ----------------------------------------------- |
| Desktop cold    | 340, 268, 268 (**268**) | 671, 453, 453 (**453**) | 0.00, 0.00, 0.00 (**0.00**) | `img` `/img/screens/es/result-changed-640.webp` |
| Desktop warm    | 500, 284, 276 (**284**) | 631, 408, 424 (**424**) | 0.00, 0.00, 0.00 (**0.00**) | `img` `/img/screens/es/result-changed-640.webp` |
| Phone cold      | 740, 584, 780 (**740**) | 738, 581, 780 (**738**) | 0.00, 0.00, 0.00 (**0.00**) | `p.hero-value` (hero description)               |
| Phone warm      | 468, 480, 552 (**480**) | 521, 815, 665 (**665**) | 0.00, 0.00, 0.00 (**0.00**) | `p.hero-value` (hero description)               |

LCP elements were identified with a buffered `PerformanceObserver` on a separate navigation after
the traces. Desktop LCP is the hero still image; on phone that image is visually hidden and the
hero description is LCP. CLS stayed at 0 in all 12 trace summaries. INP was not measured: there
was no interaction in this navigation-only protocol. No CrUX field data is available for localhost.

## First-load requests and sizes

Resource Timing for a cold phone navigation reported the HTML as 10,608 encoded bytes (41,955
decoded bytes; `transferSize` 10,908 including the browser's 300-byte accounting overhead). The
inline `<style>` is 23,634 bytes. No script was requested. The cold phone image payloads were:

| Asset                                      | Encoded body bytes | Transfer bytes | Notes                                                     |
| ------------------------------------------ | -----------------: | -------------: | --------------------------------------------------------- |
| `/img/logo-dark.svg`                       |              3,263 |          3,563 | Used by the header and hero wordmark                      |
| `/img/icon-animated.svg`                   |                774 |          1,074 | Hero badge                                                |
| `/img/screens/es/result-changed-640.webp`  |             20,506 |         20,806 | Hidden hero still; selected at 640w despite being hidden  |
| `/img/screens/es/options-several-640.webp` |              7,562 |          7,862 | Below the fold; loaded eagerly                            |
| `/img/screens/es/statuses-guide-640.webp`  |             26,752 |         27,052 | Below the fold; loaded eagerly                            |
| **Image total**                            |         **58,857** |     **60,357** | Five requests; 1,500 bytes of browser transfer accounting |

Combined HTML and image transfer is 71,265 bytes in Resource Timing, before interaction. These
figures include no external stylesheet or script: CSS is inline. All five images were requested
before interaction on both profiles. On desktop, the same five asset paths and encoded sizes were
observed. The hero image and below-fold eager loads account for 54,820 image bytes; the two logo
and badge graphics account for the remainder. No media request or playback occurred. The phone screenshot
rendered the desktop hero still as hidden, but its 640w asset was still downloaded.

Warm reloads revalidated the same six requests (document plus five images). Each entry reported a
300-byte `transferSize` for its 304 response, or 1,800 bytes per warm navigation by Resource Timing;
the cached encoded body sizes remained those in the cold table. This is browser timing accounting
for the response headers, not a packet capture.

The initial phone request set contained six requests total: the document plus the five images
above. The desktop sample showed the same resource set. No theme script or video/poster exists in
the current page. A viewport screenshot was inspected in Chrome for both profiles; it showed the
current dark system theme, the unchanged desktop hero still, and the phone layout with the hero
still hidden. Screenshots were inspected in-browser and were not saved as extra artifacts.

## Response headers

Headers were inspected in Chrome Network MCP from the local Wrangler server. The final warm
responses were `304 Not Modified`; Chrome showed the validator and the same representation metadata
on each response. The server consistently returned `Cache-Control: public, max-age=0,
must-revalidate`. Thus repeat views require revalidation. `ETag` values and content types:

| Request path                               | Content-Type               | ETag                                 |
| ------------------------------------------ | -------------------------- | ------------------------------------ |
| `/`                                        | `text/html; charset=utf-8` | `"2770b6c64ee712ff95c454fb802b7e99"` |
| `/img/logo-dark.svg`                       | `image/svg+xml`            | `"ce313df94bf7ae2cc97c0c24b4025f66"` |
| `/img/icon-animated.svg`                   | `image/svg+xml`            | `"75bcdd09b3cc9e9b8a3c4e1cbfd219fa"` |
| `/img/screens/es/result-changed-640.webp`  | `image/webp`               | `"3449cc04dff7cb62803d4ee05206d02b"` |
| `/img/screens/es/options-several-640.webp` | `image/webp`               | `"6a69e7059241681615d93398d299356e"` |
| `/img/screens/es/statuses-guide-640.webp`  | `image/webp`               | `"a4d059565caf3845f4f87238fc1f8d35"` |

All listed paths had the cache policy above. HTML and SVG responses also reported gzip content
encoding; the WebP responses did not. The logo variant actually requested was `logo-dark.svg`; a
second variant was not fetched in this sample.

## Reading the baseline

The lab reference values are LCP ≤ 2.5 s and CLS ≤ 0.1; these samples are below both. Treat the
small sample medians as comparison points, not guarantees. Field Core Web Vitals are evaluated at
the 75th percentile. The recorded warm FCP values also establish the comparison point for the
planned theme script: a phone warm-load FCP regression of 50 ms or more at the later comparison
step triggers the owner-approved follow-up decision described in the plan.

# After (step 11)

Captured 2026-11-24 from `1fb4f60` (the finished site, working tree clean apart from `plan.md`) with
`npm run dev:site` on `http://localhost:8787/`, in the same Chrome 158 (MCP-controlled, user agent unchanged)
and with the same profiles as the Before protocol (desktop 1365 × 900 DPR 1, unthrottled; phone 390 × 844
mobile/touch, Fast 4G, 4× CPU; dark colour scheme emulated; Spanish landing page).

## Deviations from the Before protocol

- **The machine is not the one that produced the Before numbers.** The same page is now much faster in absolute
  terms (desktop warm FCP about 30 to 100 ms against 284 ms recorded), so the recorded Before medians cannot be
  compared directly. To get a fair comparison I built the Before commit `666b6d9` in a temporary git worktree
  outside the repository, served it with a second local Worker on port 8788, and measured it in the same session
  with the same settings. Its HTML (10,608 encoded / 41,955 decoded bytes) and image sizes match this file's
  Before figures exactly. The worktree and server were removed afterwards.
- **Chrome's trace adds about 180 ms on the phone profile.** The traced loads read about 180 ms slower than plain
  reloads on both sites (after: 612 ms traced against 432 ms plain, cold; before: 437 to 448 ms traced against
  244 to 252 ms plain). The recorded Before values were traced, so tables below give traced and plain loads
  separately and never mix them in one median.
- **Plain reloads replace most of the traces.** Each trace prints about 2.5k tokens of boilerplate, so I traced a
  subset and used `navigate_page` reloads (cache bypassed for cold, cache enabled for warm) for the rest, reading
  FCP, LCP and CLS from buffered `PerformanceObserver` and Paint Timing entries in the page, as in the Before
  protocol. Traced: desktop cold 3, desktop warm 1, phone cold 1, phone warm 2 (after); phone warm 2 (before).
  Everything else is plain. This gives fewer traced samples than the "3 cold + 3 warm per cell" protocol.
- INP was not measured (no interaction), and no CrUX data exists for localhost.
- The Before records count six requests; Chrome also fetches `/favicon.svg` (548 bytes transfer) in these runs. It is
  listed separately below and left out of the HTML plus image totals so they stay comparable.

## Performance samples

Times are milliseconds. "Rec." is the figure recorded in the Before section (traced, older machine state).
"Same-session before" is `666b6d9` measured today with the same method as the "After" row beside it.

### Phone (390 × 844, Fast 4G, 4× CPU)

| Load                | Method | FCP samples (median)    | LCP samples (median)    | CLS  | LCP element    |
| ------------------- | ------ | ----------------------- | ----------------------- | ---- | -------------- |
| After, cold         | plain  | 432, 428 (**430**)      | 432, 428 (**430**)      | 0.00 | `p.hero-value` |
| After, cold         | traced | 612                     | 611                     | 0.00 | `p.hero-value` |
| Before (same), cold | plain  | 240, 244, 248 (**244**) | 240, 244, 248 (**244**) | 0.00 | `p.hero-value` |
| Before (rec.), cold | traced | 740, 584, 780 (**740**) | 738, 581, 780 (**738**) | 0.00 | `p.hero-value` |
| After, warm         | plain  | 496, 488, 428 (**488**) | 496, 488, 428 (**488**) | 0.00 | `p.hero-value` |
| After, warm         | traced | 624, 620 (**622**)      | 623, 617 (**620**)      | 0.00 | `p.hero-value` |
| Before (same), warm | plain  | 248, 252, 256 (**252**) | 248, 252, 256 (**252**) | 0.00 | `p.hero-value` |
| Before (same), warm | traced | 448                     | 445, 437 (**441**)      | 0.00 | `p.hero-value` |
| Before (rec.), warm | traced | 468, 480, 552 (**480**) | 521, 815, 665 (**665**) | 0.00 | `p.hero-value` |

The "After, cold" plain row has two samples plus the traced one: the first plain cold sample was the traced load
(612), so the plain cold median uses the two plain reloads.

### Desktop (1365 × 900, unthrottled)

| Load                | Method         | FCP samples (median)    | LCP samples (median)    | CLS  | LCP element                           |
| ------------------- | -------------- | ----------------------- | ----------------------- | ---- | ------------------------------------- |
| After, cold         | traced         | 76, 136, 68 (**76**)    | 76, 136, 76 (**76**)    | 0.00 | `img` `options-several-hero-640.webp` |
| Before (same), cold | plain          | 24, 112, 124 (**112**)  | 32, 120, 124 (**120**)  | 0.00 | `img` `result-changed-640.webp`       |
| Before (rec.), cold | traced         | 340, 268, 268 (**268**) | 671, 453, 453 (**453**) | 0.00 | `img` `result-changed-640.webp`       |
| After, warm         | traced + plain | 200, 92, 28 (**92**)    | 208, 192, 32 (**192**)  | 0.00 | `img` (hero)                          |
| Before (same), warm | plain          | 28, 100, 32 (**32**)    | 36, 100, 36 (**36**)    | 0.00 | `img`                                 |
| Before (rec.), warm | traced         | 500, 284, 276 (**284**) | 631, 408, 424 (**424**) | 0.00 | `img` `result-changed-640.webp`       |

Desktop numbers fall into two clusters (about 30 ms and about 100 to 200 ms) on both sites, so the medians swing
between them. Three samples cannot separate a regression of this size from that noise. The desktop profile is not
the one the threshold uses.

## Theme-script threshold

The plan says a phone warm-load FCP regression of 50 ms or more triggers the owner-approval stop.

| Comparison (phone, warm)                          | Before |  After | Change  |
| ------------------------------------------------- | -----: | -----: | ------- |
| Same session, plain reloads, median FCP           | 252 ms | 488 ms | +236 ms |
| Same session, traced, FCP (before 448, after 622) | 448 ms | 622 ms | +174 ms |
| Against the recorded Before median (traced)       | 480 ms | 622 ms | +142 ms |

**The threshold tripped on every comparison.** Per the plan I stopped there: no `_headers` file, no hashed script
name and no source change. The decision is the owner's.

What the traces show (phone, Fast 4G, 4×):

- The render-blocking `/theme.js` request is sent at 208 ms, right after the HTML finishes (183 ms), and
  completes at 400 ms. First paint waits for it (FCP 432 ms plain, 612 ms traced). The trace's "render-blocking"
  insight estimates 187 to 189 ms of FCP and LCP savings, which is the same figure.
- The warm run revalidates `theme.js` with a conditional request on every view (the Before section recorded
  `Cache-Control: public, max-age=0, must-revalidate`), so a cached repeat visit still pays that round trip. All
  eight warm requests report a 304 with 300 bytes of transfer accounting.
- **The cost is not warm-only.** The cold phone load regresses by about the same amount (244 to 430 ms plain, +186
  ms), because a blocking external script costs one network round trip on the critical path whether or not the
  browser holds a copy. A hashed name with an `immutable` rule would remove the warm round trip, but not the
  cold one. Inlining the 2,010 byte script would remove both, and changes ADR 0005 and the site gate.
- Not measured: the same page with `theme.js` served `immutable`. I did not modify any served file or add
  `_headers`, so the size of the warm improvement from that rule is an expectation, not a measurement.

Options for the owner, none applied: (a) accept about 190 ms of first paint on a Fast 4G phone for explicit theme
choices; (b) hashed name plus `_headers` `immutable` (fixes warm only, adds a served file, changes the gate);
(c) inline the script in `@head` (fixes both, needs ADR 0005 and the gate to allow one exact inline block).

## First-load requests and sizes (cold)

Transfer bytes from Resource Timing (the browser's 300-byte per-response accounting included, as in Before).
Desktop and phone were identical in the Before section; they now differ because the below-fold screenshots are lazy.

| Item                                    | Before phone | After phone | Before desktop | After desktop | Notes                                                                         |
| --------------------------------------- | -----------: | ----------: | -------------: | ------------: | ----------------------------------------------------------------------------- |
| HTML (document)                         |       10,908 |      10,884 |         10,908 |        10,884 | 10,584 encoded body; 43,464 decoded (41,955 before)                           |
| Inline CSS (inside the HTML)            |   23,634 raw |  23,533 raw |     23,634 raw |    23,533 raw | 101 bytes smaller                                                             |
| Script (`/theme.js`)                    |            0 |       1,068 |              0 |         1,068 | 768 encoded, 2,010 raw bytes                                                  |
| Logos and badge (SVG)                   |        4,637 |       8,199 |          4,637 |         8,199 | `logo-light` and `logo-dark` both load (3,562 + 3,563) plus the badge (1,074) |
| Hero screenshot                         |       20,806 |      11,192 |         20,806 |        11,192 | Hidden 640w still before; now the visible 640w crop                           |
| Step and status screenshots             |       34,914 |       7,862 |         34,914 |        28,668 | Lazy. Phone loads only the first step image                                   |
| **HTML + script + images (no favicon)** |   **71,265** |  **39,205** |     **71,265** |    **60,011** |                                                                               |
| Change against Before                   |              |     -32,060 |                |       -11,254 | Both well inside the "45 KiB extra" budget                                    |
| Favicon (`/favicon.svg`)                |          548 |         548 |            548 |           548 | Not in the totals above                                                       |
| Requests (without favicon)              |            6 |           7 |              6 |             8 |                                                                               |

Warm reloads: 300 bytes of transfer accounting per revalidated request (phone 2,400 with the favicon, 2,100 without;
before 1,800 without).

### Budgets

| Budget                                  | Limit            | Measured                                           | Result |
| --------------------------------------- | ---------------- | -------------------------------------------------- | ------ |
| Theme script, raw                       | 3 KiB (3,072 B)  | 2,010 B (768 B encoded)                            | Met    |
| Hero image at the measured viewport     | aim up to 35 KiB | 10,892 B body (640w at 390 and 1365 wide, DPR 1)   | Met    |
| Extra first-load transfer at each width | at most 45 KiB   | negative: -32,060 B phone, -11,254 B desktop       | Met    |
| LCP / CLS lab reference                 | 2.5 s / 0.1      | worst phone traced LCP 623 ms; CLS 0.00 throughout | Met    |

### Request waterfall (phone cold, plain, ms from navigation start)

| Request                                | Sent | Done | Notes                                                                                                               |
| -------------------------------------- | ---: | ---: | ------------------------------------------------------------------------------------------------------------------- |
| `/` (document)                         |    0 |  183 |                                                                                                                     |
| `/theme.js`                            |  208 |  400 | Render-blocking; first paint waits for it                                                                           |
| `/img/logo-light.svg`, `logo-dark.svg` |  209 |  400 | Both variants download in every theme; the hero wordmark reuses the same two URLs, so there are no further requests |
| `/img/icon-animated.svg`               |  209 |  585 |                                                                                                                     |
| `options-several-hero-640.webp`        |  210 |  601 | Eager, discovered at head parse, in flight before first paint                                                       |
| first paint (FCP and LCP)              |      |  432 | LCP element is the hero description paragraph                                                                       |
| `options-several-640.webp`             |  603 |  787 | Lazy, step 1, requested once layout placed it near the viewport                                                     |
| `/favicon.svg`                         |  636 |  833 |                                                                                                                     |

Not requested on the phone: `result-changed-640.webp` and `statuses-guide-640.webp` (lazy, below the fold; the
Before page loaded both eagerly). On desktop `options-several-640.webp` and `result-changed-640.webp` start at about
64 ms (inside the lazy lookahead) and `statuses-guide-640.webp` is not requested. Rendered hero image: 358 × 224 CSS
px at 390 wide (the audit estimated 343), 470 × 294 at 1280.

## Manual states

Driven in the visible Chrome with the `chrome` MCP tools unless noted. "Same-origin" below means only requests to
`localhost` were made. No request left the machine in any check.

| State                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opposite-OS theme                        | OS light + Auto: white canvas, `logo-for-light` shown, `theme-color` pair by media. OS light + Dark chosen: `rgb(17,24,39)` canvas, light text, `logo-for-dark` shown, `theme-color` pair becomes `not all` / `all` so the dark colour applies. OS dark + Light chosen: white canvas, `logo-for-light`; the choice survives a reload (`naciocheck-theme` in `localStorage`); Auto removes `data-theme`. Control shows the localized labels. All pass.                                                                                                                                                                                                    |
| Reduced motion                           | `prefers-reduced-motion: reduce`: smooth scrolling off, transitions 0.01 ms, the badge SVG opened directly has 0 animations. No reduce: 4 animations, each one iteration, all finished after 1.5 s. **The animated badge plays once and does not loop.** No `infinite` appears in site CSS. Pass.                                                                                                                                                                                                                                                                                                                                                        |
| Tab order                                | 18 focusable controls in DOM order: skip link, header logo, three language links, theme select, privacy link, five FAQ summaries, agency link, footer links. Eight real Tab presses reached the skip link, logo, es, en, ca, theme select, privacy link and the first FAQ summary in that order, each with a 2.67 px solid outline. Enter on the focused summary opened it, and the focus ring wraps the whole row. The two "coming soon" install actions are not focusable (kept as designed). Pass.                                                                                                                                                    |
| Responsive image selection               | Fresh loads at DPR 1 choose the 640w files for the hero, the steps and the status guide at 390 and 1365 wide; at DPR 3 (390) and DPR 2 (1280) Chrome chooses `options-several-hero-832.webp` and the 1280w step and status files. English pages use `/img/screens/en/`, Catalan uses the Spanish capture. Pass. Not retested at 768 wide with a fresh load.                                                                                                                                                                                                                                                                                              |
| Missing images                           | A copy of the built site with every `img/screens/*` file removed, served separately: hero and screenshots 404, the boxes keep their 358 × 224 footprint, alt text shows, layout shift 0.00, no horizontal scroll. Pass.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| FAQ wrapping                             | At 320 CSS px (es, ca): questions wrap to two or three lines (summary 62 or 93 px tall), the indicator stays circular and centred against the whole question, the answer opens below, nothing overflows. Pass.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Reflow, 200% and 400% zoom               | Emulated as 640 px at DPR 2 and 320 px at DPR 4 (es and ca): document scroll width equals viewport minus the scrollbar, no element extends past the viewport. Status timeline, privacy list and FAQ reflow to one column. Pass. Step screenshots shrink to illustrations at 320 px (see audit finding 4).                                                                                                                                                                                                                                                                                                                                                |
| Forced colours                           | `forced-colors: active` with a dark system scheme and `Light` stored: canvas black, text white, language links yellow and the current one ringed, the theme select and install actions outlined; the wordmark renders dark teal on black (about 3.8:1 by calculation). With a light system scheme and `Dark` stored: the "Nacio" half of the wordmark is white on white and effectively vanishes in the header and the hero; "Check" stays visible. Header icon and badge survive. See the audit result below.                                                                                                                                           |
| Feedback theme control, offline          | The feedback pages load `challenges.cloudflare.com` unconditionally. To avoid contacting it I served a copy of the built site (kept in the scratchpad) with that one `<script>` tag removed from the three feedback pages, on `localhost:8790` with Python's static server. The built header, `theme.js` and `feedback.js` are untouched. The select works: OS dark and Auto gives the dark canvas and `logo-for-dark`; choosing Light gives the light canvas, `logo-for-light` and stores `light`. Scripts present: `/theme.js`, `/feedback/feedback.js`; six same-origin requests, none external. Pass. The Turnstile widget itself was not exercised. |
| Hero and theme without external services | The landing page makes only same-origin requests (HTML, `theme.js`, two logos, badge and images); the hero and the theme control work with no external host involved. Pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `light-dark()` fallback                  | Not rendered: Chrome 158 supports the function. I only read the `@supports not (color: light-dark(#000, #fff))` block in `base.css`, which sets the light palette. Not verified in a browser (see below).                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Audit findings that a rendered check confirms or refutes

The four Medium findings:

1. **Logo under forced colours: confirmed, and worse than stated.** With a light system scheme and Dark stored the
   "Nacio" half of both wordmarks disappears (white on white), not just loses contrast. In the opposite case
   (dark system, Light stored) the wordmark stays visible but dim, about 3.8:1 on black. `data-theme` overrides the
   forced palette because the logo variant is chosen by `data-theme` and `prefers-color-scheme`, as the audit said.
2. **Current-language tint: confirmed.** The current link and its neighbours have the same weight (550), no
   underline and no border. The only cue is `background: rgb(204,251,241)` and text `rgb(19,78,74)` against
   `rgb(75,85,99)`. It is visible to a sighted person on the light page in the screenshots, but it is a colour-only cue.
3. **Hero duplicates step 1: confirmed.** The hero crop and the step 1 image are the same options screen. In one
   phone scroll position the hero caption "Saved applications with their added dates." and the step 1 image show the
   same two saved applications.
4. **Phone screenshot legibility: confirmed in part.** At 390 px the hero crop (358 × 224) keeps headings, buttons and
   the application names readable; body text is about 4 to 6 px. The step 1 image at the same width is an illustration
   only (headings are small, field text is unreadable). The alt text and caption carry the meaning, as the audit said.

Low findings checked:

- **Both logo variants download: confirmed.** `logo-light.svg` and `logo-dark.svg` both load on every page. The audit
  counted four requests; the hero wordmark reuses the same two URLs, so it is two requests and one more than Before
  (the Before `<picture>` fetched one). Cost 3,562 bytes.
- **Theme script on repeat visits: confirmed, see the threshold section above.**
- **The hero image is not the phone LCP element: observed.** The hero description paragraph is the LCP element at 390 px (the
  image arrives at 601 ms, before FCP at 432 ms plain). On desktop the hero image is the LCP element. The audit's
  suggested `fetchpriority="high"` would not change the phone result; I did not test it on desktop.
- **Doubled logo: confirmed visually** (header wordmark directly above the hero lockup in every screenshot).
- **Hero `sizes`, `role="list"`, hairline contrast, `touch-action` and `color-scheme` meta:** not checked in a
  browser; code-reading findings stand as written.

## Unchanged scope checks

- `git diff --stat 666b6d9 -- tests/fixtures` is empty (0 lines).
- Against `666b6d9`, `src/`, `public/`, `store/`, `wxt.config.ts`, `package.json` and `package-lock.json` have no changes.
- `git diff --name-only 666b6d9 -- e2e/baselines` lists 48 files, all `site-*`; no extension baseline is in the list.
  `git diff --stat 546835f -- e2e/baselines` is the same 48 `site-*` files (the Step 9 record).
- The files changed since `666b6d9` outside the spec folder are the ADR 0005 edit, the site build and gate scripts,
  the site sources and partials, `site/theme.js` and the site tests and E2E specs. No `site/privacy/` source changed.
- Metadata is unchanged: the `<title>`, description, Open Graph, Twitter, canonical and `hreflang` tags and the
  link tags of the built Spanish landing page are byte-identical to the `666b6d9` build; only the two `theme-color`
  tags are new.
- No dependency, manifest permission, host pattern or `scripts/allowed-urls.json` change.

## Uncovered cases

- Firefox (desktop and Android) and Safari: not run. The Firefox checklist and release gates stay as they are.
- Real operating-system high-contrast mode: only Chrome's `forced-colors` emulation, with its own palette.
- Browser zoom and text-only zoom: emulated by narrowing the viewport and raising DPR, not by browser zoom.
- A browser without `light-dark()`: not rendered (see the table).
- Screen readers: not run; the accessibility tree was read through a Chrome snapshot only.
- Turnstile and the live feedback submission: not exercised, by design.
- Performance: Spanish landing page only; three samples per cell where noted; no field data; INP not measured; the
  phone profile's Fast 4G and 4x CPU are Chrome's emulation, not a real device or network.
- The warm regression with an `immutable` theme script was not measured (no served file was changed).
- A fresh load at 768 px wide; the Windows Chrome versus Linux Chrome for Testing difference (E2E uses the latter).
