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
