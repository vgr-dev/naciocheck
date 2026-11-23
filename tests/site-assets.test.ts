import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeSiteAssets } from '../scripts/site-assets.mjs';

/** Renders the site images into a temporary directory and checks what the build and the pages rely on. */

const SCREENS = [
  'onboarding-empty',
  'options-encrypted',
  'options-several',
  'result-changed',
  'statuses-guide',
];

let dir = '';
let written: string[] = [];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'naciocheck-site-assets-'));
  written = await writeSiteAssets(dir);
}, 60_000);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function size(file: string): Promise<{ width: number; height: number; format: string }> {
  const meta = await sharp(join(dir, file)).metadata();
  return { width: meta.width, height: meta.height, format: meta.format };
}

describe('site assets', () => {
  it('writes every file it reports, and the contract files among them', () => {
    for (const file of written) expect(existsSync(join(dir, file)), file).toBe(true);
    for (const file of [
      'social-card.png',
      'favicon.ico',
      'favicon.svg',
      'apple-touch-icon.png',
      'img/icon-animated.svg',
      'img/logo-light.svg',
      'img/logo-dark.svg',
    ]) {
      expect(written).toContain(file);
    }
  });

  it('renders the social card at 1200x630', async () => {
    expect(await size('social-card.png')).toMatchObject({
      width: 1200,
      height: 630,
      format: 'png',
    });
  });

  it('renders the touch icon at 180', async () => {
    expect(await size('apple-touch-icon.png')).toMatchObject({
      width: 180,
      height: 180,
      format: 'png',
    });
  });

  it('writes favicon.ico as an ICO header around a 32 px PNG', async () => {
    const ico = readFileSync(join(dir, 'favicon.ico'));
    expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
    expect(ico[6]).toBe(32);
    expect(ico[7]).toBe(32);
    const length = ico.readUInt32LE(14);
    const offset = ico.readUInt32LE(18);
    expect(offset).toBe(22);
    expect(ico.length).toBe(offset + length);
    const png = ico.subarray(offset);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const meta = await sharp(png).metadata();
    expect(meta).toMatchObject({ width: 32, height: 32, format: 'png' });
  });

  it('copies the brand SVGs unchanged', () => {
    const pairs: [string, string][] = [
      ['favicon.svg', 'brand/icon.svg'],
      ['img/icon-animated.svg', 'brand/icon-animated.svg'],
      ['img/logo-light.svg', 'brand/logo-horizontal-outlined-light.svg'],
      ['img/logo-dark.svg', 'brand/logo-horizontal-outlined-dark.svg'],
    ];
    for (const [copy, source] of pairs) {
      expect(readFileSync(join(dir, copy)).equals(readFileSync(source)), copy).toBe(true);
    }
  });

  it('keeps the logotype as paths, never a font', () => {
    for (const file of ['img/logo-light.svg', 'img/logo-dark.svg']) {
      const svg = readFileSync(join(dir, file), 'utf8');
      expect(svg).not.toMatch(/<text|font-family|@font-face|@import|url\(/);
    }
  });

  it('renders every screenshot as WebP at 640 and 1280 in es and en', async () => {
    for (const lang of ['es', 'en']) {
      for (const name of SCREENS) {
        for (const width of [640, 1280]) {
          const file = `img/screens/${lang}/${name}-${String(width)}.webp`;
          expect(written).toContain(file);
          const meta = await size(file);
          expect(meta.format, file).toBe('webp');
          expect(meta.width, file).toBe(width);
          expect(meta.height, file).toBe(width / 1.6);
        }
      }
    }
  });
});
