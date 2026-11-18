import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
