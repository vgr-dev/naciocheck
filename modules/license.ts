import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WxtModule, WxtModuleOptions } from 'wxt';

/** The canonical licence file, copied into every built package at its root. */
export const LICENSE_DEST = 'LICENSE';
/** Third-party notices for code compiled into the extension (WXT and @wxt-dev/browser, both MIT). */
export const THIRD_PARTY_NOTICES_DEST = 'THIRD-PARTY-NOTICES.txt';

/** Reads the single source of the licence text; the build never keeps a second copy under `public/`. */
export async function readCanonicalLicense(rootDir: string): Promise<string> {
  return readFile(join(rootDir, LICENSE_DEST), 'utf8');
}

/** Reads the third-party notices that must accompany the WXT runtime code in the package. */
export async function readThirdPartyNotices(rootDir: string): Promise<string> {
  return readFile(join(rootDir, THIRD_PARTY_NOTICES_DEST), 'utf8');
}

/**
 * WXT local module: puts the canonical `LICENSE` and `THIRD-PARTY-NOTICES.txt` at the root of every
 * extension build, so the Chrome and Firefox packages carry the same texts as the source archive.
 * `wxt zip` builds first, so the files are in the archives too.
 */
const licenseModule: WxtModule<WxtModuleOptions> = {
  name: 'naciocheck-license',
  hooks: {
    'build:publicAssets': async (wxt, files) => {
      files.push(
        {
          relativeDest: LICENSE_DEST,
          contents: await readCanonicalLicense(wxt.config.root),
        },
        {
          relativeDest: THIRD_PARTY_NOTICES_DEST,
          contents: await readThirdPartyNotices(wxt.config.root),
        },
      );
    },
  },
};

export default licenseModule;
