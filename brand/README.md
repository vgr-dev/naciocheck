# NacioCheck — brand

The single source of truth for the product's name, icon, logo and logotype. Implementation plans are local-only,
so this folder is the permanent record. Decided 2026-11-06.

## Name

**NacioCheck** — written as one word, capital N and capital C.

- *Nacio* reads as *nacionalidad* in Spanish and is close to "nation" in English (*nació* in Catalan).
- *Check* is a common anglicism in Spain, so the name works in Spanish and English and says what the tool does.
- It must never suggest an official tool: no "Ministerio", "Gobierno", "Oficial", "Sede", crests or flags, in
  the name or anywhere in the branding. NacioCheck is **not affiliated with the Ministerio de Justicia**.

| Identifier | Value | Changeable? |
| --- | --- | --- |
| Firefox add-on (gecko) id | `naciocheck@vgr.cat` | **Never** after the first AMO upload |
| Store slug | `naciocheck` | Avoid |
| Website | `naciocheck.vgr.cat` | Avoid |
| Repository | `vgr-dev/naciocheck` | Possible (GitHub redirects) |

**Tagline:** *Tu expediente de nacionalidad, al día.* English: to be confirmed in the store-readiness phase
(proposal: *Your nationality file, kept in check*).

## Icon

![NacioCheck icon](icon.svg)

[`icon.svg`](icon.svg) — a white badge with a teal ring; inside, a capital **N** whose last strokes form a
**check mark**.

Construction (128 × 128 grid), kept exact on purpose:

- Glyph box x 36–92, y 38–90, centred on (64, 64).
- The N's diagonal and the check's long stroke mirror each other at **28.3°** from vertical; the stem's top and
  the check's tip share one height, and the bottom points share one baseline.
- The accent starts at the **midpoint of the diagonal**, so the check's short arm is exactly **half** its long
  arm (1 : 2).
- Strokes 13 units with round caps and joins; badge ring 4 units.

The icon is used unchanged at every size. The extension's PNGs (16, 32, 48, 128 px) are generated from this file at
build time.

### Animated icon

[`icon-animated.svg`](icon-animated.svg) — the check **pops** in first (scale with a small overshoot, 0.28 s);
at the pop, the badge fades in and the ring and the N **draw themselves**. About 0.65 s in total. Pure SVG + CSS,
no JavaScript; with *reduce motion* enabled it shows the static icon at once.

Use it for moments, not chrome: the status-changed screen, onboarding and the website hero. Never in the browser
toolbar or as a store icon (both static).

## Logo

| File | Use |
| --- | --- |
| [`logo-horizontal-tagline.svg`](logo-horizontal-tagline.svg) | Light backgrounds: website header, store promo images |
| [`logo-horizontal-tagline-dark.svg`](logo-horizontal-tagline-dark.svg) | Dark backgrounds |

These are **source files with live text**: they render correctly only where Nunito is installed. The files that
ship (website, stores) have the text **converted to paths**, plus variants without the tagline. That is done when
the store assets are produced. The extension and website never load fonts remotely.

## Logotype

- Typeface: **Nunito ExtraBold (800)**. Its rounded letter ends match the icon's round caps. Licence: SIL Open
  Font License 1.1. Keep its licence file next to any bundled or outlined copy.
- The wordmark repeats the icon's split: **"Nacio"** like the N, **"Check"** like the check.
- Tagline: the system UI font, weight 500.

## Colours

| Token | Hex | Used for |
| --- | --- | --- |
| `teal-700` | `#0F766E` | Badge ring, the N, "Nacio" on light backgrounds |
| `teal-600` | `#0D9488` | "Check" on light backgrounds |
| `teal-500` | `#14B8A6` | The icon's check stroke |
| `teal-300` | `#5EEAD4` | "Check" on dark backgrounds |
| `white` | `#FFFFFF` | Badge fill, "Nacio" on dark backgrounds |
| `gray-600` | `#4B5563` | Tagline on light backgrounds |
| `gray-400` | `#9CA3AF` | Tagline on dark backgrounds |

Measured contrast (WCAG):

```
#0F766E on #FFFFFF: 5.47:1   "Nacio", the N
#0D9488 on #FFFFFF: 3.74:1   "Check" (large text: passes 3:1)
#14B8A6 on #FFFFFF: 2.49:1   icon check stroke — below 3:1, see open points
#4B5563 on #FFFFFF: 7.56:1   tagline
#FFFFFF on #111827: 17.74:1  "Nacio" on dark
#5EEAD4 on #111827: 11.99:1  "Check" on dark
#9CA3AF on #111827: 6.99:1   tagline on dark
```

No red together with yellow, and no flag colours or crests: the brand must not look official.

## Rules

- Do not redraw, rotate, recolour or stretch the icon; do not put it on busy backgrounds.
- Keep clear space around the icon of at least ¼ of its diameter.
- Never use the logo in a way that implies a partnership with, or endorsement by, the Spanish administration.

## Open points

- **Icon check stroke contrast.** `#14B8A6` on the white badge is 2.49:1, below the 3:1 WCAG asks for in
  graphical elements. The N in `teal-700` carries the shape, so the icon stays recognisable, but swapping the
  check stroke to `teal-600` `#0D9488` (3.74:1) would pass. Not changed: the approved icon stays as chosen until
  the owner decides.
- **English tagline** to be confirmed.