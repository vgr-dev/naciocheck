#!/usr/bin/env node
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

/**
 * The store rasters, rendered from the brand sources with Sharp: the AMO listing icon (32 and 64, which the
 * extension package does not carry), the Chrome Web Store store icon, and the two promotional tiles.
 *
 * Everything comes from `brand/`: the icon from `icon.svg` and the tiles from the outlined logos that
 * `scripts/outline-logo.mjs` writes, so no image is edited by hand.
 *
 * Sizes are the ones recorded in `store/REQUIREMENTS.md` (C3, C5, A4). Sharp renders SVG at `density` and then
 * resizes, so a small PNG is downsampled from a large render instead of being enlarged from a tiny one.
 */

const ROOT = resolve(import.meta.dirname, '..');
const BRAND = join(ROOT, 'brand');
const STORE = join(ROOT, 'store');

const ICON = join(BRAND, 'icon.svg');
const LOGO = join(BRAND, 'logo-horizontal-outlined-light.svg');
const LOGO_TAGLINE = join(BRAND, 'logo-horizontal-tagline-outlined-light.svg');

/**
 * The tiles' background: `teal-50`, not white. The store shows every listing on a light grey shelf, so a white
 * tile would blend into it, and the mark's teal ring needs a background it can be seen against (teal-700 would
 * swallow it and a saturated teal-500 would flatten the teal-300 half of the wordmark).
 */
const TILE_BACKGROUND = '#F0FDFA';

/** The two promotional tiles: CWS asks for both, and an extension without the small one is ranked lower. */
const TILES = [
  { file: 'promo-small-440x280.png', width: 440, height: 280, logo: LOGO, logoWidth: 300 },
  {
    file: 'promo-marquee-1400x560.png',
    width: 1400,
    height: 560,
    logo: LOGO_TAGLINE,
    logoWidth: 900,
  },
];

/** The icons: AMO's listing icon wants 32 and 64; 128 is the store icon CWS shows next to the name. */
const ICONS = [32, 64, 128];

async function renderIcon(size) {
  const file = join(STORE, `icon-${String(size)}.png`);
  await sharp(ICON, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toFile(file);
  return file;
}

async function renderTile({ file, width, height, logo, logoWidth }) {
  const path = join(STORE, file);
  const art = await sharp(logo, { density: 288 }).resize({ width: logoWidth }).png().toBuffer();
  await sharp({ create: { width, height, channels: 4, background: TILE_BACKGROUND } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toFile(path);
  return path;
}

const written = [
  ...ICONS.map((size) => renderIcon(size)),
  ...TILES.map((tile) => renderTile(tile)),
];

for (const path of await Promise.all(written)) {
  const meta = await sharp(path).metadata();
  const size = statSync(path).size;
  console.log(
    `${path.replace(`${ROOT}/`, '')}: ${String(meta.width)}x${String(meta.height)} ${String(meta.format)} ${String(Math.round(size / 1024))} KB`,
  );
}
