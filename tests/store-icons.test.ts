import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

/**
 * The tracked store icons (`npm run store:images`) against the sizes in `store/REQUIREMENTS.md`: the Chrome Web
 * Store icon keeps its artwork inside 96×96 with 16 px of transparent padding on every side (C3), and AMO's
 * listing icons (A4) are the plain square sizes.
 */

const STORE = join(dirname(fileURLToPath(import.meta.url)), '..', 'store');

interface Bounds {
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The box around every pixel that is not fully transparent. */
async function artwork(file: string): Promise<Bounds> {
  const { data, info } = await sharp(join(STORE, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if ((data[(y * info.width + x) * 4 + 3] ?? 0) > 0) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return { width: info.width, height: info.height, left, top, right, bottom };
}

describe('store icons', () => {
  it('keeps the Chrome Web Store icon inside 96×96 with 16 px of transparent padding', async () => {
    const icon = await artwork('icon-128.png');
    expect([icon.width, icon.height]).toEqual([128, 128]);
    expect(icon.left).toBeGreaterThanOrEqual(16);
    expect(icon.top).toBeGreaterThanOrEqual(16);
    expect(icon.right).toBeLessThanOrEqual(111);
    expect(icon.bottom).toBeLessThanOrEqual(111);
    // The artwork fills its box: no more than a couple of anti-aliased pixels short of 96.
    expect(icon.right - icon.left + 1).toBeGreaterThanOrEqual(92);
    expect(icon.bottom - icon.top + 1).toBeGreaterThanOrEqual(92);
  });

  it.each([
    ['icon-32.png', 32],
    ['icon-64.png', 64],
  ])('renders the AMO listing icon %s at %i px', async (file, size) => {
    const icon = await artwork(file);
    expect([icon.width, icon.height]).toEqual([size, size]);
  });
});
