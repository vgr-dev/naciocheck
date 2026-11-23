#!/usr/bin/env node
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

/**
 * The raster and vector files the site needs but the repository does not keep, rendered with Sharp from
 * `brand/` and `store/screenshots/` only (both are read, never written):
 *
 * - `social-card.png` (1200x630): the outlined logo without a tagline on `teal-50`. One card for every
 *   language, so it carries no text that would need translating.
 * - `favicon.ico` (a 32 px PNG in an ICO container), `favicon.svg` (the icon) and `apple-touch-icon.png` (180).
 * - `img/icon-animated.svg`, `img/logo-light.svg` and `img/logo-dark.svg`: copies of the brand sources. The
 *   logos are the outlined ones, so the logotype is paths and no font is ever loaded.
 * - `img/screens/<es|en>/<name>-<640|1280>.webp`: the store screenshots, resized.
 *
 * `writeSiteAssets(outDir)` is called by the site build; the module never runs on import.
 */

const ROOT = resolve(import.meta.dirname, '..');
const BRAND = join(ROOT, 'brand');
const SCREENSHOTS = join(ROOT, 'store', 'screenshots');

const ICON = join(BRAND, 'icon.svg');
const ICON_ANIMATED = join(BRAND, 'icon-animated.svg');
const LOGO_LIGHT = join(BRAND, 'logo-horizontal-outlined-light.svg');
const LOGO_DARK = join(BRAND, 'logo-horizontal-outlined-dark.svg');

/** The social card's background: `teal-50`, the same shelf colour the store tiles use. */
const CARD_BACKGROUND = '#F0FDFA';
const CARD = { width: 1200, height: 630, logoWidth: 840 };
const TOUCH_ICON = 180;
const FAVICON = 32;

/** The screenshot languages the site has images for (Catalan uses `es`) and the two widths of each image. */
const SCREEN_LANGUAGES = ['es', 'en'];
const SCREEN_WIDTHS = [640, 1280];

/** `<name>-<lang>-1280x800.png` in `store/screenshots/<lang>/`. */
const SCREENSHOT_NAME = /^(?<name>.+)-(?<lang>[a-z]{2})-1280x800\.png$/;

/**
 * Wraps a PNG in an ICO container: a 6-byte header, one 16-byte directory entry and the PNG itself. Every
 * browser that still asks for `/favicon.ico` reads PNG-in-ICO.
 */
function icoFromPng(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6); // width
  header.writeUInt8(size, 7); // height
  header.writeUInt8(0, 8); // palette colours
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14); // image size
  header.writeUInt32LE(header.length, 18); // image offset
  return Buffer.concat([header, png]);
}

async function writeSocialCard(outDir) {
  const art = await sharp(LOGO_LIGHT, { density: 288 })
    .resize({ width: CARD.logoWidth })
    .png()
    .toBuffer();
  const file = 'social-card.png';
  await sharp({
    create: {
      width: CARD.width,
      height: CARD.height,
      channels: 4,
      background: CARD_BACKGROUND,
    },
  })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toFile(join(outDir, file));
  return [file];
}

async function writeIcons(outDir) {
  const png = await sharp(ICON, { density: 384 })
    .resize(FAVICON, FAVICON, { fit: 'contain' })
    .png()
    .toBuffer();
  await writeFile(join(outDir, 'favicon.ico'), icoFromPng(png, FAVICON));
  await copyFile(ICON, join(outDir, 'favicon.svg'));
  await sharp(ICON, { density: 384 })
    .resize(TOUCH_ICON, TOUCH_ICON, { fit: 'contain', background: '#FFFFFF' })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(join(outDir, 'apple-touch-icon.png'));
  return ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'];
}

async function copyBrandSvgs(outDir) {
  const copies = [
    [ICON_ANIMATED, 'img/icon-animated.svg'],
    [LOGO_LIGHT, 'img/logo-light.svg'],
    [LOGO_DARK, 'img/logo-dark.svg'],
  ];
  await mkdir(join(outDir, 'img'), { recursive: true });
  for (const [source, target] of copies) {
    await copyFile(source, join(outDir, target));
  }
  return copies.map(([, target]) => target);
}

async function writeScreens(outDir) {
  const written = [];
  for (const lang of SCREEN_LANGUAGES) {
    const target = join(outDir, 'img', 'screens', lang);
    await mkdir(target, { recursive: true });
    const names = (await readdir(join(SCREENSHOTS, lang)))
      .map((file) => SCREENSHOT_NAME.exec(file)?.groups)
      .filter((groups) => groups?.lang === lang)
      .map((groups) => groups.name)
      .sort();
    for (const name of names) {
      const source = join(SCREENSHOTS, lang, `${name}-${lang}-1280x800.png`);
      for (const width of SCREEN_WIDTHS) {
        const file = `img/screens/${lang}/${name}-${String(width)}.webp`;
        await sharp(source).resize({ width }).webp({ quality: 82 }).toFile(join(outDir, file));
        written.push(file);
      }
    }
  }
  return written;
}

/**
 * Writes every generated site file under `outDir` (created if missing) and returns their paths relative to it.
 *
 * @param {string} outDir
 * @returns {Promise<string[]>}
 */
export async function writeSiteAssets(outDir) {
  await mkdir(outDir, { recursive: true });
  return [
    ...(await writeSocialCard(outDir)),
    ...(await writeIcons(outDir)),
    ...(await copyBrandSvgs(outDir)),
    ...(await writeScreens(outDir)),
  ];
}
