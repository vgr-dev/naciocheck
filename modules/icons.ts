import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { WxtModule, WxtModuleOptions } from 'wxt';

/** Manifest icon sizes required by Chrome and Firefox. */
export const ICON_SIZES = [16, 32, 48, 128] as const;

/**
 * Rasterises `brand/icon.svg` — the single source of truth, used unchanged — into the PNGs the
 * manifest needs. Runs locally with `sharp`; nothing is downloaded.
 */
async function generateIcons(rootDir: string): Promise<void> {
  const source = join(rootDir, 'brand', 'icon.svg');
  const targetDir = join(rootDir, 'public', 'icon');
  await mkdir(targetDir, { recursive: true });
  await Promise.all(
    ICON_SIZES.map(async (size) => {
      const png = await sharp(source).resize(size, size, { fit: 'contain' }).png().toBuffer();
      await writeFile(join(targetDir, `${size}.png`), png);
    }),
  );
  // The animated icon is used by the status-changed view and onboarding; it ships as SVG, untouched.
  await copyFile(join(rootDir, 'brand', 'icon-animated.svg'), join(targetDir, 'icon-animated.svg'));
}

/** WXT local module: keeps `public/icon/*.png` in sync with `brand/icon.svg`. */
const iconsModule: WxtModule<WxtModuleOptions> = {
  name: 'naciocheck-icons',
  hooks: {
    'build:before': async (wxt) => {
      await generateIcons(wxt.config.root);
    },
    'server:started': async (wxt) => {
      await generateIcons(wxt.config.root);
    },
  },
};

export default iconsModule;
