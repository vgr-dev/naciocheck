import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSite, loadConfig, type SiteConfig } from '../scripts/build-site.mjs';
import { pageProblems } from '../scripts/check-site.mjs';

/**
 * The site build, run on fixture source directories in a temporary directory: each marker, the repository
 * block in both states, both install states, the failures, and the files that are and are not copied. The
 * real pages are built and gated by `npm run check:site`.
 */

const STRINGS = {
  es: {
    comingSoon: 'Próximamente',
    installChrome: 'Instalar en Chrome',
    installFirefox: 'Instalar en Firefox',
    homeLabel: 'Inicio',
    logoAlt: 'NacioCheck',
    languageLabel: 'Idioma',
    languageNames: { es: 'Español', en: 'English', ca: 'Català' },
    changelog: { noReleases: 'Sin versiones.', githubRelease: 'GitHub', englishNote: 'En inglés.' },
  },
  en: {
    comingSoon: 'Coming soon',
    installChrome: 'Install on Chrome',
    installFirefox: 'Install on Firefox',
    homeLabel: 'Home',
    logoAlt: 'NacioCheck',
    languageLabel: 'Language',
    languageNames: { es: 'Español', en: 'English', ca: 'Català' },
    changelog: {
      noReleases: 'No releases yet.',
      githubRelease: 'View on GitHub',
      englishNote: 'In English.',
    },
  },
  ca: {
    comingSoon: 'Properament',
    installChrome: 'Instal·la a Chrome',
    installFirefox: 'Instal·la a Firefox',
    homeLabel: 'Inici',
    logoAlt: 'NacioCheck',
    languageLabel: 'Idioma',
    languageNames: { es: 'Español', en: 'English', ca: 'Català' },
    changelog: { noReleases: 'Cap versió.', githubRelease: 'GitHub', englishNote: 'En anglès.' },
  },
};

const CHROME = 'https://chromewebstore.google.com/detail/naciocheck/abc';
const FIREFOX = 'https://addons.mozilla.org/firefox/addon/naciocheck/';
const CONFIG: SiteConfig = { chromeStoreUrl: null, firefoxStoreUrl: null, repositoryPublic: false };
const CHANGELOG =
  '## [Unreleased]\n\n### Added\n\n- Pending.\n\n## [1.2.3] - 2026-01-02\n\n### Fixed\n\n- A **bug**.\n';

const PAGE = (body: string, lang = 'es') => `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NacioCheck page</title>
    <meta name="description" content="A page &amp; its text." />
    <!-- @head -->
    <!-- @style -->
  </head>
  <body>
    ${body}
  </body>
</html>
`;

let root = '';
let source = '';
let out = '';

function write(base: string, file: string, text: string): void {
  const path = join(base, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'naciocheck-build-site-'));
  source = join(root, 'site');
  out = join(root, 'out');
  write(source, '_build/strings.json', JSON.stringify(STRINGS));
  write(source, '_build/config.json', JSON.stringify(CONFIG));
  write(source, '_build/partials/base.css', 'body { color: #111; }');
  write(source, '_build/partials/landing.css', '.hero { margin: 0; }');
  for (const lang of ['es', 'en', 'ca']) {
    write(
      source,
      `_build/partials/footer.${lang}.html`,
      `<footer>footer ${lang}<!-- @if repository --><a href="https://github.com/vgr-dev/naciocheck">src</a><!-- @endif --></footer>`,
    );
  }
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

async function build(config: SiteConfig = CONFIG, changelog = CHANGELOG) {
  return buildSite({ sourceDir: source, outDir: out, config, changelog, writeAssets: false });
}

const read = (file: string): string => readFileSync(join(out, file), 'utf8');

describe('site build', () => {
  it('copies pages and other files unchanged when they carry no markers', async () => {
    const page = '<!doctype html><html lang="es"><title>x</title></html>\n';
    write(source, 'index.html', page);
    write(source, 'feedback/feedback.js', 'const x = 1;\n');
    const result = await build();
    expect(read('index.html')).toBe(page);
    expect(read('feedback/feedback.js')).toBe('const x = 1;\n');
    expect(result.pages).toEqual(['index.html']);
  });

  it('does not copy _build/ and wipes what the output directory held', async () => {
    write(source, 'index.html', PAGE('<p>hi</p>'));
    write(out, 'stale.html', 'old');
    await build();
    expect(existsSync(join(out, '_build'))).toBe(false);
    expect(existsSync(join(out, 'stale.html'))).toBe(false);
    expect(existsSync(join(out, 'index.html'))).toBe(true);
  });

  it('refuses an output directory that would wipe the sources', async () => {
    await expect(
      buildSite({
        sourceDir: source,
        outDir: root,
        config: CONFIG,
        changelog: '',
        writeAssets: false,
      }),
    ).rejects.toThrow(/wipe the sources/);
  });

  it('writes the generated files when asked to', async () => {
    write(source, 'index.html', PAGE(''));
    const result = await buildSite({
      sourceDir: source,
      outDir: out,
      config: CONFIG,
      changelog: '',
    });
    expect(result.assets).toContain('social-card.png');
    expect(existsSync(join(out, 'favicon.ico'))).toBe(true);
    expect(existsSync(join(out, 'img/screens/es/result-changed-640.webp'))).toBe(true);
  }, 60_000);

  describe('@head', () => {
    it('writes icons, canonical, every alternate, Open Graph and Twitter tags for the root page', async () => {
      write(source, 'index.html', PAGE(''));
      await build();
      const html = read('index.html');
      expect(html).not.toContain('@head');
      expect(html).toContain('<link rel="icon" href="/favicon.ico"');
      expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml"');
      expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png"');
      expect(html).toContain('<link rel="canonical" href="https://naciocheck.vgr.cat/" />');
      expect(html).toContain('hreflang="es" href="https://naciocheck.vgr.cat/"');
      expect(html).toContain('hreflang="en" href="https://naciocheck.vgr.cat/en/"');
      expect(html).toContain('hreflang="ca" href="https://naciocheck.vgr.cat/ca/"');
      expect(html).toContain('hreflang="x-default" href="https://naciocheck.vgr.cat/"');
      expect(html).toContain('<meta property="og:title" content="NacioCheck page" />');
      expect(html).toContain('<meta property="og:description" content="A page &amp; its text." />');
      expect(html).toContain('<meta property="og:url" content="https://naciocheck.vgr.cat/" />');
      expect(html).toContain('content="https://naciocheck.vgr.cat/social-card.png"');
      expect(html).toContain('<meta property="og:locale" content="es_ES" />');
      expect(html).toContain('<meta property="og:locale:alternate" content="en_GB" />');
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(html).toContain('<meta name="twitter:title" content="NacioCheck page" />');
      expect(html).toContain('<meta name="author" content="Victor Gonzalez" />');
      expect(html).toContain('<link rel="me" href="https://vgr.cat/" />');
    });

    it('points canonical and hreflang at the nested path of a page in another language', async () => {
      write(source, 'en/privacy/index.html', PAGE('', 'en'));
      await build();
      const html = read('en/privacy/index.html');
      expect(html).toContain(
        '<link rel="canonical" href="https://naciocheck.vgr.cat/en/privacy/" />',
      );
      expect(html).toContain('hreflang="es" href="https://naciocheck.vgr.cat/privacy/"');
      expect(html).toContain('hreflang="en" href="https://naciocheck.vgr.cat/en/privacy/"');
      expect(html).toContain('hreflang="ca" href="https://naciocheck.vgr.cat/ca/privacy/"');
      expect(html).toContain('hreflang="x-default" href="https://naciocheck.vgr.cat/privacy/"');
      expect(html).toContain('<meta property="og:locale" content="en_GB" />');
      expect(html).toContain('<meta property="og:locale:alternate" content="ca_ES" />');
    });

    it('handles a Catalan page and gives a 404 only the icons, author and rel=me', async () => {
      write(source, 'ca/index.html', PAGE('', 'ca'));
      write(source, 'ca/404.html', PAGE('', 'ca'));
      await build();
      expect(read('ca/index.html')).toContain('<meta property="og:locale" content="ca_ES" />');
      const notFound = read('ca/404.html');
      expect(notFound).toContain('<link rel="apple-touch-icon"');
      expect(notFound).toContain('<link rel="me"');
      expect(notFound).not.toContain('canonical');
      expect(notFound).not.toContain('hreflang');
      expect(notFound).not.toContain('og:');
    });

    it('fails when the page has no title or description', async () => {
      write(source, 'index.html', '<html lang="es"><head><!-- @head --></head></html>');
      await expect(build()).rejects.toThrow(/@head needs a <title>/);
    });

    it('produces output the site gate accepts', async () => {
      write(source, 'index.html', PAGE(''));
      write(source, 'en/privacy/index.html', PAGE('', 'en'));
      await build();
      expect(pageProblems('index.html', read('index.html'))).toEqual([]);
      expect(pageProblems('en/privacy/index.html', read('en/privacy/index.html'))).toEqual([]);
    });
  });

  describe('@style', () => {
    it('inlines base.css, and landing.css only for the landing form', async () => {
      write(source, 'index.html', PAGE(''));
      write(
        source,
        'en/index.html',
        PAGE('', 'en').replace('<!-- @style -->', '<!-- @style landing -->'),
      );
      await build();
      expect(read('index.html')).toContain('<style>\nbody { color: #111; }\n    </style>');
      expect(read('index.html')).not.toContain('.hero');
      expect(read('en/index.html')).toContain('body { color: #111; }\n.hero { margin: 0; }');
    });

    it('fails on an unknown form', async () => {
      write(source, 'index.html', PAGE('<!-- @style fancy -->'));
      await expect(build()).rejects.toThrow(/unknown marker <!-- @style fancy -->/);
    });
  });

  describe('@header', () => {
    it('writes the logo, a home link and a switcher to the same page in each language', async () => {
      write(source, 'privacy/index.html', PAGE('<!-- @header -->'));
      write(source, 'en/privacy/index.html', PAGE('<!-- @header -->', 'en'));
      await build();
      const es = read('privacy/index.html');
      expect(es).toContain('<a class="site-logo" href="/" aria-label="Inicio">');
      expect(es).toContain('srcset="/img/logo-dark.svg" media="(prefers-color-scheme: dark)"');
      expect(es).toContain('src="/img/logo-light.svg" alt="NacioCheck"');
      expect(es).toContain('<nav class="lang-switch" aria-label="Idioma">');
      expect(es).toContain(
        '<a href="/privacy/" hreflang="es" lang="es" aria-current="page">Español</a>',
      );
      expect(es).toContain('<a href="/en/privacy/" hreflang="en" lang="en">English</a>');
      expect(es).toContain('<a href="/ca/privacy/" hreflang="ca" lang="ca">Català</a>');
      const en = read('en/privacy/index.html');
      expect(en).toContain('<a class="site-logo" href="/en/" aria-label="Home">');
      expect(en).toContain(
        '<a href="/en/privacy/" hreflang="en" lang="en" aria-current="page">English</a>',
      );
      expect(en).not.toContain('aria-current="page">Español');
    });

    it('links the home of the landing page itself', async () => {
      write(source, 'ca/index.html', PAGE('<!-- @header -->', 'ca'));
      await build();
      const html = read('ca/index.html');
      expect(html).toContain('<a href="/" hreflang="es" lang="es">Español</a>');
      expect(html).toContain(
        '<a href="/ca/" hreflang="ca" lang="ca" aria-current="page">Català</a>',
      );
    });
  });

  describe('@footer', () => {
    it('inserts the footer of the page language', async () => {
      write(source, 'index.html', PAGE('<!-- @footer -->'));
      write(source, 'ca/index.html', PAGE('<!-- @footer -->', 'ca'));
      await build();
      expect(read('index.html')).toContain('<footer>footer es</footer>');
      expect(read('ca/index.html')).toContain('<footer>footer ca</footer>');
    });

    it('fails when the partial is missing', async () => {
      rmSync(join(source, '_build/partials/footer.ca.html'));
      write(source, 'ca/index.html', PAGE('<!-- @footer -->', 'ca'));
      await expect(build()).rejects.toThrow(/footer\.ca\.html: missing/);
    });
  });

  describe('@if repository', () => {
    const BODY =
      'a<!-- @if repository --> <a href="https://github.com/vgr-dev/naciocheck">src</a> <!-- @endif -->b';

    it('drops the block while the repository is private, in the page and in a partial', async () => {
      write(source, 'index.html', PAGE(`${BODY}<!-- @footer -->`));
      await build();
      const html = read('index.html');
      expect(html).toContain('ab');
      expect(html).not.toContain('github.com');
      expect(html).not.toContain('@if');
      expect(html).not.toContain('@endif');
    });

    it('keeps the block, without the markers, once the repository is public', async () => {
      write(source, 'index.html', PAGE(`${BODY}<!-- @footer -->`));
      await build({ ...CONFIG, repositoryPublic: true });
      const html = read('index.html');
      expect(html).toContain('a <a href="https://github.com/vgr-dev/naciocheck">src</a> b');
      expect(html).toContain('footer es<a href="https://github.com/vgr-dev/naciocheck">src</a>');
      expect(html).not.toContain('@if');
      expect(html).not.toContain('@endif');
    });

    it.each([
      ['an unclosed block', '<!-- @if repository -->x', /without <!-- @endif -->/],
      ['an @endif alone', 'x<!-- @endif -->', /without <!-- @if -->/],
      [
        'a nested block',
        '<!-- @if repository --><!-- @if repository --><!-- @endif --><!-- @endif -->',
        /do not nest/,
      ],
      ['an unknown condition', '<!-- @if public -->x<!-- @endif -->', /unknown condition/],
    ])('fails on %s', async (_name, body, message) => {
      write(source, 'index.html', PAGE(body));
      await expect(build()).rejects.toThrow(message);
    });
  });

  describe('@install', () => {
    it('shows two non-link "coming soon" labels while the store URLs are null', async () => {
      write(source, 'index.html', PAGE('<!-- @install -->'));
      write(source, 'en/index.html', PAGE('<!-- @install -->', 'en'));
      write(source, 'ca/index.html', PAGE('<!-- @install -->', 'ca'));
      await build();
      const es = read('index.html');
      expect(es.match(/<span class="install is-soon">/g)).toHaveLength(2);
      expect(es).toContain(
        'Instalar en Chrome</span> <span class="install-note">Próximamente</span>',
      );
      expect(es).not.toMatch(/<a class="install/);
      expect(read('en/index.html')).toContain('Coming soon');
      expect(read('ca/index.html')).toContain('Properament');
    });

    it('links each button once its store URL is set', async () => {
      write(source, 'en/index.html', PAGE('<!-- @install -->', 'en'));
      await build({ ...CONFIG, chromeStoreUrl: CHROME, firefoxStoreUrl: FIREFOX });
      const html = read('en/index.html');
      expect(html).toContain(`<a class="install install-chrome" href="${CHROME}">`);
      expect(html).toContain(`<a class="install install-firefox" href="${FIREFOX}">`);
      expect(html).not.toContain('is-soon');
      expect(pageProblems('en/index.html', html)).toEqual([]);
    });

    it('mixes the states when only one store has a listing', async () => {
      write(source, 'index.html', PAGE('<!-- @install -->'));
      await build({ ...CONFIG, firefoxStoreUrl: FIREFOX });
      const html = read('index.html');
      expect(html).toContain(
        '<span class="install is-soon"><span class="install-name">Instalar en Chrome',
      );
      expect(html).toContain(`<a class="install install-firefox" href="${FIREFOX}">`);
    });

    it('fails when a store URL is outside its prefix', async () => {
      write(source, 'index.html', PAGE('<!-- @install -->'));
      await expect(build({ ...CONFIG, chromeStoreUrl: 'https://example.com/x' })).rejects.toThrow(
        /chromeStoreUrl must be null or start with https:\/\/chromewebstore\.google\.com\//,
      );
      await expect(build({ ...CONFIG, firefoxStoreUrl: CHROME })).rejects.toThrow(
        /firefoxStoreUrl/,
      );
    });
  });

  describe('@changelog', () => {
    it('renders the dated releases with the English note, in the page language', async () => {
      write(source, 'changelog/index.html', PAGE('<!-- @changelog -->'));
      write(source, 'en/changelog/index.html', PAGE('<!-- @changelog -->', 'en'));
      await build();
      const es = read('changelog/index.html');
      expect(es).toContain('<p class="changelog-note">En inglés.</p>');
      expect(es).toContain('1.2.3');
      expect(es).toContain('2026-01-02');
      expect(es).toContain('<strong>bug</strong>');
      expect(es).not.toContain('Pending.');
      expect(es).not.toContain('github.com');
    });

    it('does not tell the English page that its entries are in English', async () => {
      write(source, 'changelog/index.html', PAGE('<!-- @changelog -->'));
      write(source, 'en/changelog/index.html', PAGE('<!-- @changelog -->', 'en'));
      write(source, 'ca/changelog/index.html', PAGE('<!-- @changelog -->', 'ca'));
      await build();
      const en = read('en/changelog/index.html');
      expect(en).not.toContain('changelog-note');
      expect(en).not.toContain('In English.');
      expect(en).toContain('1.2.3');
      expect(read('changelog/index.html')).toContain('class="changelog-note"');
      expect(read('ca/changelog/index.html')).toContain('<p class="changelog-note">En anglès.</p>');
    });

    it('links each release to GitHub once the repository is public', async () => {
      write(source, 'en/changelog/index.html', PAGE('<!-- @changelog -->', 'en'));
      await build({ ...CONFIG, repositoryPublic: true });
      const html = read('en/changelog/index.html');
      expect(html).toContain('https://github.com/vgr-dev/naciocheck/releases/tag/v1.2.3');
      expect(html).toContain('View on GitHub');
    });

    it('shows the localised "no releases" line when nothing is dated', async () => {
      write(source, 'ca/changelog/index.html', PAGE('<!-- @changelog -->', 'ca'));
      await build(CONFIG, '## [Unreleased]\n\n### Added\n\n- x.\n');
      expect(read('ca/changelog/index.html')).toContain('Cap versió.');
    });

    it('fails on a changelog the parser rejects', async () => {
      write(source, 'index.html', PAGE(''));
      await expect(build(CONFIG, '## nonsense\n')).rejects.toThrow(/CHANGELOG\.md line/);
    });
  });

  describe('unknown markers', () => {
    it.each(['<!-- @sidebar -->', '<!-- @ -->', '<!--@head extra-->'])(
      'fails on %s',
      async (marker) => {
        write(source, 'index.html', PAGE(marker));
        await expect(build()).rejects.toThrow(/unknown marker|takes no argument/);
      },
    );

    it('fails on an insertion marker inside a partial', async () => {
      write(source, '_build/partials/footer.es.html', '<footer><!-- @install --></footer>');
      write(source, 'index.html', PAGE('<!-- @footer -->'));
      await expect(build()).rejects.toThrow(/marker <!-- @install --> is not allowed here/);
    });

    it('names the page in the error', async () => {
      write(source, 'en/privacy/index.html', PAGE('<!-- @nope -->', 'en'));
      await expect(build()).rejects.toThrow(/site\/en\/privacy\/index\.html: unknown marker/);
    });

    it('leaves ordinary comments alone', async () => {
      write(source, 'index.html', PAGE('<!-- a note, not @a marker -->'));
      await build();
      expect(read('index.html')).toContain('<!-- a note, not @a marker -->');
    });
  });

  describe('config', () => {
    it('is read from _build/config.json when not passed', async () => {
      write(source, '_build/config.json', JSON.stringify({ ...CONFIG, firefoxStoreUrl: FIREFOX }));
      write(source, 'index.html', PAGE('<!-- @install -->'));
      await buildSite({ sourceDir: source, outDir: out, changelog: '', writeAssets: false });
      expect(read('index.html')).toContain(`href="${FIREFOX}"`);
    });

    it('is checked when it is loaded', async () => {
      write(source, '_build/config.json', JSON.stringify({ ...CONFIG, repositoryPublic: 'yes' }));
      await expect(loadConfig(source)).rejects.toThrow(/repositoryPublic must be true or false/);
    });

    it('requires every language to have every string', async () => {
      write(
        source,
        '_build/strings.json',
        JSON.stringify({ ...STRINGS, ca: { ...STRINGS.ca, comingSoon: undefined } }),
      );
      write(source, 'index.html', PAGE(''));
      await expect(build()).rejects.toThrow(/ca lacks comingSoon/);
    });
  });
});

describe('the real build inputs', () => {
  it('ship a valid config, every string and every partial', async () => {
    const real = join(import.meta.dirname, '..', 'site');
    const config = await loadConfig(real);
    expect(config).toEqual({
      chromeStoreUrl: null,
      firefoxStoreUrl: null,
      repositoryPublic: false,
    });
    const outDir = mkdtempSync(join(tmpdir(), 'naciocheck-real-build-'));
    try {
      const result = await buildSite({ sourceDir: real, outDir, writeAssets: false });
      expect(result.pages).toEqual(
        expect.arrayContaining(['index.html', 'en/index.html', 'privacy/index.html']),
      );
      expect(existsSync(join(outDir, '_build'))).toBe(false);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
