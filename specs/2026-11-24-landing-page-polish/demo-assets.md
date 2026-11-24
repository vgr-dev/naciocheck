# Offline walkthrough media

Archived evidence. The owner withdrew these assets on 2026-11-24 in favour of static product
screenshots. The files were moved outside the repository.

## Sources and composition

- Spanish reminder and changed-result screens: `store/screenshots/es/options-several-es-1280x800.png` and `store/screenshots/es/result-changed-es-1280x800.png`.
- English reminder and changed-result screens: `store/screenshots/en/options-several-en-1280x800.png` and `store/screenshots/en/result-changed-en-1280x800.png`.
- The human step is an original neutral SVG illustration of a person at a laptop with a generic verification card. It contains no third-party captcha branding or real verification UI.
- The three 1280×720 scenes use the locale’s genuine extension captures inside a simple browser frame for the first and last scenes. The middle scene uses the neutral illustration. The step labels and short explanatory captions are localized. The first capture shows saved applications; its caption provides the reminder cue because the source screenshot does not show the scheduling controls. The decorative browser dots use teal and neutral colors.
- The English result capture retains Spanish status wording from the source screenshot alongside English extension labels; it is unchanged so the example status remains faithful to the captured product UI.
- All six scene frames (three per locale), plus both posters, were visually reviewed. Text is legible at 1280×720; the screenshots contain only the repository’s fake example data. No official page, official symbol, live service, test stub or real personal data appears.

## Exports

| Locale  | Clip                                | Duration | Video                         |      Size | Poster                                   |     Size |
| ------- | ----------------------------------- | -------: | ----------------------------- | --------: | ---------------------------------------- | -------: |
| Spanish | `site/img/demo/es/walkthrough.webm` | 12.625 s | VP9, 1280×720, 24 fps, silent | 170,730 B | `site/img/demo/es/poster.webp` (960×540) | 10,094 B |
| English | `site/img/demo/en/walkthrough.webm` | 12.625 s | VP9, 1280×720, 24 fps, silent | 162,178 B | `site/img/demo/en/poster.webp` (960×540) |  9,874 B |

Both clips are below the 1 MiB limit and both posters are below the 35 KiB limit. Independent container inspection reports one VP9 video stream per clip and no audio stream. Firefox also reported `mozHasAudio=false` for each clip.

## Export recipe

1. Build one 1280×720 scene per stage and locale with the existing local Sharp package: system UI text and teal/neutral palette on a light background; place the locale’s unmodified 1280×800 extension screenshot inside an 820×437 crop for stages one and three. Draw the neutral human-at-laptop illustration for stage two. Keep intermediate PNGs in a scratch directory outside the repository.
2. Concatenate three still scenes at 4.2 seconds each (24 fps, 303 frames total), with no audio input. Encode with the locally available Cypress-bundled FFmpeg (`N-47683-g0e8eb07980-static`, libvpx and libwebp enabled): `libvpx-vp9 -deadline good -cpu-used 4 -crf 34 -b:v 0 -row-mt 1 -threads 4 -pix_fmt yuv420p`.
3. Scale the first scene to 960×540 and encode the poster as WebP with `libwebp -quality 60 -compression_level 6`.

## Playback verification

Opened the two files in a scratch HTML page served from an offline temporary localhost server, without building the site. Chrome and Firefox each loaded both clips, decoded them and played them through to `ended=true` at 12.625 seconds, with no media errors. Firefox’s `mozHasAudio` value was false for both. The scratch page, copied media and generated scene PNGs stayed under `/tmp`; the Firefox MCP session and temporary servers were closed after verification.

## Local Wrangler responses

After the phase verification rebuilt the assets, GET requests through `npm run dev:site` served
both clips as `video/webm`. With and without `Range: bytes=0-15`, the Spanish and English clips
returned HTTP 200 with their full content lengths (170,730 and 162,178 bytes). The range responses
had no `Content-Range` header. The English request also asked to revalidate the cache and still
received the full file. This records local Wrangler behaviour. Check seek and replay through
Wrangler when the hero player is wired up, and retain the deployed-site smoke check.
