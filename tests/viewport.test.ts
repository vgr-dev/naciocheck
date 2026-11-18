import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Every extension page opens in a tab or popup on Firefox for Android; each must opt into mobile width. */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['onboarding', 'options', 'popup', 'result', 'statuses', 'unlock'];

describe('extension page viewports', () => {
  it.each(PAGES)('%s/index.html declares a mobile viewport', (page) => {
    const html = readFileSync(join(ROOT, 'src', 'entrypoints', page, 'index.html'), 'utf8');
    expect(html).toMatch(
      /<meta[^>]+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i,
    );
  });
});
