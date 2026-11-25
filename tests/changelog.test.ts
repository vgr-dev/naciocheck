import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChangelog, renderChangelog } from '../scripts/changelog.mjs';

const SAMPLE = `# Changelog

Some intro prose that is never rendered.

## [Unreleased]

### Added

- A thing still in progress.

## [1.1.0] - 2026-12-01

### Added

- A new **bold** option with \`code\`.
- An item that continues
  over two lines.

### Fixed

- A bug.

## [1.0.0] - 2026-11-30

### Security

- A hardening.
`;

const STRINGS = { noReleases: 'No releases yet.', githubRelease: 'GitHub release' };

function throwsWith(text: string, ...parts: string[]) {
  let message = '';
  try {
    parseChangelog(text);
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).not.toBe('');
  for (const part of parts) expect(message).toContain(part);
}

describe('parseChangelog', () => {
  it('parses releases, Unreleased and sections in order', () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ['Unreleased', null],
      ['1.1.0', '2026-12-01'],
      ['1.0.0', '2026-11-30'],
    ]);
    expect(releases[1]?.sections.map((s) => s.heading)).toEqual(['Added', 'Fixed']);
    expect(releases[1]?.sections[0]?.items).toEqual([
      'A new **bold** option with `code`.',
      'An item that continues over two lines.',
    ]);
    expect(releases[2]?.sections).toEqual([{ heading: 'Security', items: ['A hardening.'] }]);
  });

  it('accepts a file with CRLF line endings', () => {
    expect(parseChangelog(SAMPLE.replace(/\n/g, '\r\n'))).toEqual(parseChangelog(SAMPLE));
  });

  it('returns no releases for a file without any', () => {
    expect(parseChangelog('# Changelog\n\nNothing yet.\n')).toEqual([]);
  });

  it('rejects a Markdown link and names its line', () => {
    const text = SAMPLE.replace('A bug.', 'A bug, see [the issue](https://example.com/1).');
    throwsWith(text, 'line 21', 'links');
  });

  it('rejects reference links, autolinks and bare URLs', () => {
    for (const bad of [
      '[a][b]',
      '<https://example.com>',
      'see https://example.com',
      '[1.0.0]: x',
    ]) {
      throwsWith(`## [Unreleased]\n\n### Added\n\n- ${bad}\n`, 'line 5', 'links');
    }
  });

  it('rejects an unknown section heading and names its line', () => {
    throwsWith(SAMPLE.replace('### Fixed', '### Improved'), 'line 19', 'Improved');
  });

  it('rejects a malformed release heading, a bad date and a duplicate release', () => {
    throwsWith('## 1.0.0\n', 'line 1');
    throwsWith('## [1.0.0] - 2026-13-45\n', 'line 1', 'date');
    throwsWith('## [1.0.0] - 2026-11-30\n\n## [1.0.0] - 2026-11-30\n', 'line 3', 'duplicate');
  });

  it('rejects structure it does not know', () => {
    throwsWith('### Added\n', 'line 1', 'release');
    throwsWith('## [Unreleased]\n\n- orphan\n', 'line 3', 'section');
    throwsWith('## [Unreleased]\n\n### Added\n\nloose text\n', 'line 5');
    throwsWith('## [Unreleased]\n\n### Added\n\n#### Deep\n', 'line 5');
    throwsWith('## [Unreleased]\n\n### Added\n', 'line 3', 'no items');
  });

  it('rejects unbalanced inline markup', () => {
    throwsWith('## [Unreleased]\n\n### Added\n\n- a `broken item\n', 'line 5', 'inline');
    throwsWith('## [Unreleased]\n\n### Added\n\n- a **broken item\n', 'line 5', 'inline');
  });

  it('parses the real CHANGELOG.md and keeps it in step with package.json', () => {
    const releases = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
    expect(releases[0]?.version).toBe('Unreleased');
    expect(releases[0]?.sections).toEqual([]);
    expect(releases[1]?.version).toBe('1.0.0');
    expect(releases[1]?.date).toBe('2026-11-25');
    const newestDated = releases.find((r) => r.date !== null);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(newestDated?.version).toBe(pkg.version);
  });
});

describe('renderChangelog', () => {
  const releases = parseChangelog(SAMPLE);

  it('renders dated releases and leaves Unreleased out', () => {
    const html = renderChangelog(releases, {
      lang: 'en',
      strings: STRINGS,
      repositoryPublic: false,
    });
    expect(html).not.toContain('Unreleased');
    expect(html).not.toContain('still in progress');
    expect(html).toContain('<h2>1.1.0 <time datetime="2026-12-01">2026-12-01</time></h2>');
    expect(html).toContain('<h3>Fixed</h3>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html.indexOf('1.1.0')).toBeLessThan(html.indexOf('1.0.0'));
  });

  it('escapes all text', () => {
    const release = parseChangelog(
      '## [1.0.0] - 2026-11-30\n\n### Added\n\n- <script>alert("x")</script> & `<b>` and **a&b**\n',
    );
    const html = renderChangelog(release, {
      lang: 'en',
      strings: STRINGS,
      repositoryPublic: false,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; ');
    expect(html).toContain('<code>&lt;b&gt;</code>');
    expect(html).toContain('<strong>a&amp;b</strong>');
  });

  it('escapes the strings it is given', () => {
    const html = renderChangelog([], {
      lang: 'es',
      strings: { noReleases: '<b>No</b>', githubRelease: 'x' },
      repositoryPublic: false,
    });
    expect(html).toBe('<p class="changelog-empty">&lt;b&gt;No&lt;/b&gt;</p>');
  });

  it('links to the GitHub release only when the repository is public', () => {
    const closed = renderChangelog(releases, {
      lang: 'en',
      strings: STRINGS,
      repositoryPublic: false,
    });
    expect(closed).not.toContain('href=');
    expect(closed).not.toContain('github.com');
    const open = renderChangelog(releases, {
      lang: 'en',
      strings: STRINGS,
      repositoryPublic: true,
    });
    expect(open).toContain('href="https://github.com/vgr-dev/naciocheck/releases/tag/v1.1.0"');
    expect(open).toContain('href="https://github.com/vgr-dev/naciocheck/releases/tag/v1.0.0"');
    expect(open).not.toContain('tag/vUnreleased');
    expect(open).toContain('>GitHub release</a>');
  });

  it('shows the empty state with no releases, or with only Unreleased', () => {
    const empty = '<p class="changelog-empty">No releases yet.</p>';
    const options = { lang: 'en', strings: STRINGS, repositoryPublic: true };
    const onlyUnreleased = '## [Unreleased]\n\n### Added\n\n- A thing still in progress.\n';
    expect(renderChangelog([], options)).toBe(empty);
    expect(renderChangelog(parseChangelog(onlyUnreleased), options)).toBe(empty);
  });

  it('renders the real CHANGELOG.md with the 1.0.0 release', () => {
    const html = renderChangelog(parseChangelog(readFileSync('CHANGELOG.md', 'utf8')), {
      lang: 'en',
      strings: STRINGS,
      repositoryPublic: false,
    });
    expect(html).toContain('<h2>1.0.0 <time datetime="2026-11-25">');
    expect(html).not.toContain('Unreleased');
  });

  it('marks the English entries when the page is not English', () => {
    const es = renderChangelog(releases, { lang: 'es', strings: STRINGS, repositoryPublic: false });
    expect(es).toContain('<article class="release" id="v1.1.0" lang="en">');
    const en = renderChangelog(releases, { lang: 'en', strings: STRINGS, repositoryPublic: false });
    expect(en).toContain('<article class="release" id="v1.1.0">');
  });
});
