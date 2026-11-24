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

# After phases 7 and 8 (step 16)

Captured 2026-11-24 from `af8ca40` plus the regenerated baselines (working tree otherwise clean apart from `plan.md`),
with `npx wrangler dev` on `http://localhost:8787/` (inspector port 9230) in the visible Chrome 158 (MCP-controlled via
`chrome-agent`), the same profiles as the Before protocol (desktop 1365 x 900 DPR 1 unthrottled; phone 390 x 844
mobile/touch, Fast 4G, 4x CPU; dark scheme emulated; Spanish landing page). As in step 11, `666b6d9` was built in a
temporary git worktree outside the repository and served on port 8788, and both sites were measured in the same session
with the same settings. Its HTML (10,608 encoded bytes) and images match the Before section. The worktree, both Workers
and a scratch static server were removed afterwards.

## Deviations from the Before protocol

- **Same-session reference, again.** The recorded Before medians come from another machine state, so the table compares
  today's `666b6d9` run with today's run of the finished site. The step 11 "After" figures are shown as recorded.
- **Plain reloads are the main series.** `navigate_page` reloads (cache bypassed for cold, cache enabled for warm) with
  FCP, LCP and CLS read in the page from the Paint Timing and buffered observers. Traced samples are listed separately:
  traced loads read about 180 ms slower than plain ones on this profile. Plain samples: phone 3 to 5 per cell, desktop 3.
  Traced samples: phone cold 1 and warm 4 per site; none on desktop (it is not the profile the threshold uses).
- **Extra warm series.** Because the plain and traced warm results disagreed (see the threshold section), I also loaded
  the page nine times in a same-origin `iframe` 390 px wide under the same throttling (cache default, the first load
  counted) and read each frame's own `first-contentful-paint`. This is a measurement aid, not part of the protocol.
- INP was not measured; no CrUX data exists for localhost. `/favicon.svg` (548 bytes) is listed apart from the totals,
  as in step 11.

## Performance samples

Times in milliseconds, CLS unitless. "Step 11 after" is the figure recorded in the section above.

### Phone (390 x 844, Fast 4G, 4x CPU)

| Load                     | Method   | Before (`666b6d9`, today)                             | Step 11 after (recorded) | Now (finished site)                                   | LCP element (now) |
| ------------------------ | -------- | ----------------------------------------------------- | ------------------------ | ----------------------------------------------------- | ----------------- |
| Cold FCP (= LCP)         | plain    | 252, 252, 260, 252, 256 (**252**)                     | 432, 428 (**430**)       | 356, 260, 384, 328, 252 (**328**)                     | `p.hero-value`    |
| Cold FCP / LCP           | traced   | 508 / 507                                             | 612 / 611                | 472 / 468                                             | `p.hero-value`    |
| Warm FCP (= LCP)         | plain    | 260, 240, 268 (**260**)                               | 496, 488, 428 (**488**)  | 256, 252, 264, 316 (**260**)                          | `p.hero-value`    |
| Warm FCP, in-page frames | 9 frames | 232, 252, 240, 236, 316, 244, 252, 328, 248 (**248**) | n/a                      | 308, 284, 308, 248, 296, 236, 256, 236, 240 (**256**) | n/a               |
| Warm FCP                 | traced   | 496, 456, 452*, 475* (**466**)                        | 624, 620 (**622**)       | 536, 496, 576, 471* (**516**)                         | `p.hero-value`    |
| CLS                      | all      | 0.00                                                  | 0.00                     | 0.00 (every load)                                     |                   |

\* LCP stands in for FCP in the samples where only the trace summary was read (FCP equalled LCP in every plain sample
and every traced sample where both were read, within 3 ms).

The traced warm loads split as TTFB plus render delay (ms). TTFB: before 166, 166, 166, 166; now 192, 178, 224, 166.
Render delay: before 329, 289, 286, 309 (median 299); now 344, 315, 352, 305 (median 330).

### Desktop (1365 x 900, unthrottled), plain

| Load | Before (today) FCP / LCP                    | Step 11 after (recorded, FCP / LCP) | Now FCP / LCP                               | LCP element now                      |
| ---- | ------------------------------------------- | ----------------------------------- | ------------------------------------------- | ------------------------------------ |
| Cold | 28, 32, 40 (**32**) / 32, 32, 40 (**32**)   | 76 / 76 (traced)                    | 28, 128, 32 (**32**) / 28, 128, 32 (**32**) | `img` `result-changed-hero-448.webp` |
| Warm | 28, 28, 128 (**28**) / 28, 36, 128 (**36**) | 92 / 192                            | 32, 64, 32 (**32**) / 40, 64, 32 (**40**)   | `img` `result-changed-hero-448.webp` |
| CLS  | 0.00                                        | 0.00                                | 0.00                                        |                                      |

Desktop numbers fall into two clusters (about 30 ms and about 130 ms) on both sites, so they swing between the clusters;
three samples cannot separate any difference from that noise. Before's LCP element is `result-changed-640.webp`.

## Theme-script threshold (phone, warm FCP, 50 ms)

| Comparison                                    | Before |    Now | Change                                   |
| --------------------------------------------- | -----: | -----: | ---------------------------------------- |
| Plain reloads, median (3 and 4 samples)       | 260 ms | 260 ms | 0 ms                                     |
| In-page frames, median (9 and 9 loads)        | 248 ms | 256 ms | +8 ms                                    |
| Traced, median (4 and 4 samples)              | 466 ms | 516 ms | **+50 ms**                               |
| Step 11 after against the same-session before | 252 ms | 488 ms | +236 ms (the regression phase 7 removed) |
| Now against step 11 after, plain              | 488 ms | 260 ms | -228 ms                                  |

**Not tripped on two of three measures, reached on the traced one.** Plain and in-page loads show no warm regression at
the phone profile; the traced median reaches exactly 50 ms, from samples that spread over 44 ms (before) and 105 ms
(now) and a server TTFB that varies by 58 ms between loads. The warm traced render delay is about 30 ms higher on the
finished site (more HTML: 12,392 encoded bytes against 10,608, an inline script, two logo images). Whichever way
this is read, the cause is not the one the threshold was written for: the page no longer requests a script, there is
nothing to revalidate before first paint (every warm request is a 300-byte 304 for an image or the document, none for
CSS or script), and the cold traced load is 36 ms faster than before's. I changed nothing and propose no `_headers`
follow-up; if the owner reads the traced figure as a trip, the hashed-name rule would not apply, as there is no served
script left. The decision is the owner's.

Cold plain loads: the finished site's median (328 ms) is 76 ms above before's (252 ms), but the five samples range from
252 to 384 against 252 to 260 for before, and the traced cold load is the other way round (472 against 508). The
cold threshold in the plan is for warm loads; I record this spread as a point to watch, not a trip.

## First-load requests and sizes (cold)

Transfer bytes from Resource Timing, 300-byte per-response accounting included, as in Before.

| Item                                    | Before phone | Step 11 phone |   Now phone | Before desktop | Step 11 desktop | Now desktop | Notes                                                                               |
| --------------------------------------- | -----------: | ------------: | ----------: | -------------: | --------------: | ----------: | ----------------------------------------------------------------------------------- |
| HTML (document)                         |       10,908 |        10,884 |      12,692 |         10,908 |          10,884 |      12,692 | 12,392 encoded body; includes the 2,196 byte inline theme script                    |
| Script (external)                       |            0 |         1,068 |           0 |              0 |           1,068 |           0 | the bootstrap is inline now                                                         |
| Logos and badge (SVG)                   |        4,637 |         8,199 |       8,199 |          4,637 |           8,199 |       8,199 | `logo-light` and `logo-dark` both load (3,562 + 3,563) plus the badge (1,074)       |
| Hero screenshot                         |       20,806 |        11,192 |       7,552 |         20,806 |          11,192 |       9,966 | phone `result-changed-hero-342.webp` (7,252 body); desktop `-448.webp` (9,666 body) |
| Step and status screenshots             |       34,914 |         7,862 |       7,862 |         34,914 |          28,668 |      28,668 | lazy; phone loads only the first step image                                         |
| **HTML + script + images (no favicon)** |   **71,265** |    **39,205** |  **36,305** |     **71,265** |      **60,011** |  **59,525** |                                                                                     |
| Change against Before                   |              |       -32,060 | **-34,960** |                |         -11,254 | **-11,740** | budget was at most +45 KiB                                                          |
| Favicon                                 |          548 |           548 |         548 |            548 |             548 |         548 | not in the totals                                                                   |
| Requests (no favicon)                   |            6 |             7 |           6 |              6 |               8 |           7 |                                                                                     |

Warm reloads: 300 bytes per revalidated request, 1,800 without the favicon for 6 requests (phone).

### Budgets

| Budget                                  | Limit            | Measured                                                      | Result |
| --------------------------------------- | ---------------- | ------------------------------------------------------------- | ------ |
| Theme script, raw                       | 3 KiB (3,072 B)  | 2,196 B inline (`site/theme.js`)                              | Met    |
| Hero image at the measured viewport     | aim up to 35 KiB | 7,252 B body (342w at 390 px), 9,666 B body (448w at 1365 px) | Met    |
| Extra first-load transfer at each width | at most 45 KiB   | negative: -34,960 B phone, -11,740 B desktop                  | Met    |
| LCP / CLS lab reference                 | 2.5 s / 0.1      | worst phone LCP 576 ms traced; CLS 0.00 throughout            | Met    |

### Request waterfall (phone cold, plain, ms from navigation start, representative load)

| Request                                                      | Sent |      Done |
| ------------------------------------------------------------ | ---: | --------: |
| `/` (document)                                               |    0 | about 200 |
| `logo-light.svg`, `logo-dark.svg`, `icon-animated.svg`       |  206 |       404 |
| `result-changed-hero-342.webp`                               |  207 |       418 |
| `options-several-640.webp` (step 1, lazy, near the viewport) |  247 |       431 |
| first paint (FCP and LCP)                                    |      |       260 |
| `/favicon.svg`                                               |  430 |       620 |

No script and no stylesheet request exists, so nothing but the document can block first paint. Both logo variants
still download in every theme (one request more than Before). Not requested on the phone: `result-changed-640.webp`
and `statuses-guide-640.webp` (lazy, below the fold). Rendered hero image: 343 x 244 CSS px at 390 wide, 364 x 259 at
412 wide, 470 x 294 at 1365.

## Manual states

Driven in the visible Chrome with the `chrome` MCP tools; "same-origin" means only requests to `localhost` were made.

| State                                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Footer switcher, keyboard            | `Tab` from the last footer link lands on the checked radio (Auto) with `:focus-visible` and a 2.67 px solid ring on its 36 x 36 px segment. `ArrowRight` moves to Light and selects it (`data-theme="light"`, `naciocheck-theme` = `light`, `theme-color` pair `all                                                                                                                                                                                                                                                                                                                                                                                 | #ffffff`, `not all | #111827`), a second `ArrowRight`selects Dark (canvas`rgb(17,24,39)`, dark logo, `theme-color`pair swaps). Six real`Tab` presses from the page start reach the skip link, logo, es, en, ca and the privacy link in that order. Pass. |
| Footer switcher, pointer             | A real click on the Light radio selects it and stores `light`; no focus ring after a pointer click. A script click on Auto stores `auto`. Pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Opposite-OS theme                    | OS dark with Light stored: white canvas and `logo-light.svg`, kept across a language switch and a page type (`/ca/privacy/`); the switcher there shows Tema, Automàtic, Clar, Fosc. Auto then follows the emulated scheme live (dark `rgb(17,24,39)` to white when the OS goes light). Pass.                                                                                                                                                                                                                                                                                                                                                        |
| Forced colours                       | `forced-colors: active`, light system scheme with Dark stored: canvas white, header and hero show `logo-light.svg` (this is the case that hid "Nacio" in step 11). Dark system scheme with Light stored and with Dark stored: canvas black, `logo-dark.svg` in header and hero. The current language is weight 700 with a 2 px underline against weight 550 and none for the other links (the colour is the forced one for all), so it is not colour alone. The checked segment shows a cyan `Highlight` outline (screenshot) and the group keeps its border. Pass.                                                                                 |
| Tab order                            | 20 controls in DOM order, 18 tab stops: skip link, logo, es, en, ca, privacy link, five FAQ summaries, agency link, the two credit links, three footer links and the switcher (one stop for three radios). Matches step 11's 18 with the select replaced by the radio group. Pass.                                                                                                                                                                                                                                                                                                                                                                  |
| Header at 390 and 412 px, es, en, ca | 76 px tall in all six cases (one row), no theme control in the header, 0 elements past the edge, no horizontal scroll, switcher fully inside the viewport. At 320 px it is 120 px in all three languages with no overflow either. Pass.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Reflow                               | Landing (es, en, ca), `/ca/privacy/`, `/en/changelog/` and a missing path (404) at 320 px and 390 px: no horizontal scroll and no element past the viewport. The 320 px width stands for 400% zoom (not a browser zoom). Pass.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Reduced motion                       | `prefers-reduced-motion: reduce`: the switcher segment transition is 0.00001 s, scroll behaviour `auto`, no running animation, no element with motion above 20 ms. Pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Feedback theme control, offline      | The three feedback pages load `challenges.cloudflare.com` unconditionally. To avoid contacting it I served a copy of the built site from the scratchpad on `localhost:8790` with Python's static server, the Turnstile `<script>` tag removed from the three feedback pages only. The built header, inline theme script and `feedback.js` are untouched. The header has no theme control, the footer switcher has Auto checked on first load, and a real click on Light stores `light` and gives the white canvas under an OS dark scheme. Resource hosts: `localhost:8790` only. Pass. The Turnstile widget and the submission were not exercised. |
| Responsive image selection           | At 390 the hero file is `result-changed-hero-342.webp`, at 412 and 1365 it is `-448.webp`; no hero image equals a step image at 360, 390 or 412 px (es, en, ca). Catalan uses the Spanish capture. Pass.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Hero legibility                      | The status lines are 16 px in the 448 px source, so they render at 12.3 px at 390 px (343 px wide), 13.0 px at 412 px and 11.2 px at 360 px. A screenshot at 390 px shows the notice, "Abierto - En tramitación" and "Antes: Abierto - Registrado." legibly. The 12 px target holds from about 336 px of image width (a 388 px viewport) up. Pass at 390, below the target at 360 (known from step 14).                                                                                                                                                                                                                                             |

## Audit findings that a rendered check confirms or refutes

1. **Logo under forced colours: fixed.** All three combinations that were wrong or dim in step 11 now follow the forced
   palette (see the table). `tests/site-contrast.test.ts` and `e2e/specs/site-theme.e2e.ts` cover it as well.
2. **Current-language tint: fixed.** Weight 700 plus a 2 px underline, in light, dark and forced colours; `aria-current`
   stays; `touch-action: manipulation` is on the links.
3. **Hero duplicates step 1: fixed.** The hero is the changed-result banner; step 1 shows the saved applications.
4. **Phone screenshot legibility: fixed for the hero** (12.3 px at 390 px); the step 1, step 3 and status guide images
   remain illustrations on a phone, with the text beside them carrying the meaning, as designed.
5. **Theme script on repeat visits: fixed** (see the threshold section for the reading of the traced figure).

## Unchanged scope checks

- `git diff --stat 666b6d9 -- tests/fixtures` is empty (0 lines).
- Against `666b6d9`, `src/`, `public/`, `store/`, `wxt.config.ts`, `package.json`, `package-lock.json` and
  `scripts/allowed-urls.json` have no changes (0 lines of `--stat`).
- `git diff --name-only 546835f -- e2e/baselines` lists 48 files, all `site-*`; the 104 extension baselines are
  unchanged against 546835f and against `666b6d9`.
- No dependency, manifest permission, host pattern or `allowed-urls.json` change in this step. I edited no source and
  added nothing outside `e2e/baselines/chrome/site-*`, `visual-review.md` and this file.

## Uncovered cases

- Firefox (desktop and Android) and Safari: not run. The Firefox checklist and release gates stay as they are.
  `:has()` support for the segment focus ring in Firefox is therefore unverified.
- Real operating-system high-contrast mode: only Chrome's `forced-colors` emulation, with its own palette.
- Browser zoom and text-only zoom: emulated by narrowing the viewport.
- A browser without `light-dark()`: not rendered. Missing images and the 320 px FAQ wrapping were not repeated here;
  the files they depend on were not changed in phases 7 and 8 except the hero image, whose footprint the E2E suite
  checks.
- Screen readers: not run; the accessibility tree was read through a Chrome snapshot only.
- Turnstile and the live feedback submission: not exercised, by design.
- Performance: Spanish landing page only; three to five plain samples per cell and four traced warm ones; no field
  data; INP not measured; Fast 4G and 4x CPU are Chrome's emulation. Desktop timings are dominated by two clusters.
- The traced warm comparison is at the 50 ms threshold with noisy samples; more samples on a quieter machine would
  settle it.
