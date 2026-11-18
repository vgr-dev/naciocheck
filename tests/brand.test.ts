import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The shipped logos are generated (`npm run logo:outline`) and the brand decisions are written down in text files;
 * these checks keep the generated files honest and the text in step with the decisions.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = join(ROOT, 'brand');

const OUTLINED = readdirSync(BRAND).filter((file) =>
  /^logo-.*-outlined-.*\.svg$|^logo-.*-outlined\.svg$/.test(file),
);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('outlined logos', () => {
  it('finds the six shipped files', () => {
    expect(OUTLINED).toHaveLength(6);
  });

  it.each(OUTLINED)('%s records which fonts produced its glyphs', (file) => {
    const svg = read(join(BRAND, file));
    const comment = /<!--([\s\S]*?)-->/.exec(svg)?.[1] ?? '';

    expect(comment).not.toContain('undefined');
    expect(comment).not.toContain('[object');
    // The wordmark's font is always named; the tagline's only where the file has a tagline.
    expect(comment).toMatch(/Nunito ExtraBold[^\n]*sha256 [0-9a-f]{64}\./);
    if (file.includes('tagline')) expect(comment).toMatch(/Tagline: [^\n]*sha256 [0-9a-f]{64}\./);
    else expect(comment).toContain('No tagline in this variant.');
  });

  it.each(OUTLINED)('%s is outlined: no live text and no font reference', (file) => {
    const svg = read(join(BRAND, file));

    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('font-family');
  });

  it.each(OUTLINED.filter((file) => file.includes('tagline')))(
    '%s is wide enough for its tagline',
    (file) => {
      const svg = read(join(BRAND, file));
      const width = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]);
      const paths = [...svg.matchAll(/<path fill="[^"]*" d="([^"]*)"\/>/g)];
      const tagline = paths.at(-1)?.[1] ?? '';
      // Path data is `M x y L x y Q x y x y …`: every even number is an x.
      const numbers = (tagline.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      const rightEdge = Math.max(...numbers.filter((_, index) => index % 2 === 0));

      expect(Number.isFinite(width)).toBe(true);
      expect(rightEdge).toBeLessThanOrEqual(width);
    },
  );
});

describe('the brand tagline', () => {
  const DECIDED = 'Your nationality application, up to date.';

  it('is the decided English line in the brand guide', () => {
    expect(read(join(BRAND, 'README.md'))).toContain(DECIDED);
  });

  // `brand/README.md` names the dropped line on purpose, as history; nothing a store reader sees may.
  it.each(['store/listing.en.md', 'store/listing.es.md', 'README.md'])(
    '%s no longer names the dropped proposal',
    (file) => {
      expect(read(join(ROOT, file))).not.toContain('kept in check');
    },
  );

  it('is the line the English store listing states', () => {
    expect(read(join(ROOT, 'store/listing.en.md'))).toContain(DECIDED);
  });
});
