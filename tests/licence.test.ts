import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import licenseModule, {
  readCanonicalLicense,
  readThirdPartyNotices,
  THIRD_PARTY_NOTICES_DEST,
} from '../modules/license';

/**
 * The licence is a decision (D8: GPL-3.0-or-later) written in several places that have to agree: the package manifest,
 * the licence text, the README, the settled-decisions table and the store notes. A store form asks for this
 * identifier, so it must not be left as a placeholder.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IDENTIFIER = 'GPL-3.0-or-later';

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('licence', () => {
  it('is declared in package.json', () => {
    const manifest = JSON.parse(read('package.json')) as { license?: string };
    expect(manifest.license).toBe(IDENTIFIER);
  });

  it('ships the GPL version 3 text', () => {
    const text = read('LICENSE');
    expect(text).toContain('GNU GENERAL PUBLIC LICENSE');
    expect(text).toContain('Version 3, 29 June 2007');
  });

  it('is the exact text the build copies into both packages', async () => {
    await expect(readCanonicalLicense(ROOT)).resolves.toBe(read('LICENSE'));
  });

  it('is added to the public assets by the build hook', async () => {
    const files: { relativeDest: string; contents: string }[] = [];
    const hooks = licenseModule.hooks as {
      'build:publicAssets': (
        wxt: { config: { root: string } },
        assets: { relativeDest: string; contents: string }[],
      ) => Promise<void>;
    };

    await hooks['build:publicAssets']({ config: { root: ROOT } }, files);

    expect(files).toContainEqual({ relativeDest: 'LICENSE', contents: read('LICENSE') });
    expect(files).toContainEqual({
      relativeDest: THIRD_PARTY_NOTICES_DEST,
      contents: read(THIRD_PARTY_NOTICES_DEST),
    });
  });

  it('records the WXT runtime code the bundles contain', async () => {
    const notices = await readThirdPartyNotices(ROOT);
    expect(notices).toContain('wxt-v0.21.5');
    expect(notices).toContain('Copyright (c) 2023 Aaron');
    expect(notices).toContain('MIT License');
    expect(notices).toContain(
      'The above copyright notice and this permission notice shall be included',
    );
  });

  it('names the installed WXT versions whose code is bundled', async () => {
    const wxt = JSON.parse(read('node_modules/wxt/package.json')) as {
      version: string;
      license?: string;
    };
    const browser = JSON.parse(read('node_modules/@wxt-dev/browser/package.json')) as {
      version: string;
      license?: string;
    };
    const notices = await readThirdPartyNotices(ROOT);

    expect(wxt.license).toBe('MIT');
    expect(browser.license).toBe('MIT');
    expect(notices).toContain(`WXT ${wxt.version}`);
    expect(notices).toContain(`@wxt-dev/browser ${browser.version}`);
  });

  it.each(['README.md', 'AGENTS.md', 'store/permissions.md'])('%s names the identifier', (file) => {
    expect(read(file)).toContain(IDENTIFIER);
  });

  it.each(['README.md', 'AGENTS.md', 'store/permissions.md', 'store/REQUIREMENTS.md'])(
    '%s has no placeholder left for the decision',
    (file) => {
      expect(read(file)).not.toContain('TODO(D8)');
    },
  );
});
