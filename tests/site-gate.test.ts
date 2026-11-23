import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LANGUAGES,
  REQUIRED_PAGES,
  assetProblems,
  binaryProblems,
  pageProblems,
  parityProblems,
  siteProblems,
} from '../scripts/check-site.mjs';

/**
 * Negative fixtures for the static-site gate. The real pages are checked by `npm run check:site`; these
 * cases keep the protocol-relative and CSS holes closed without starting a Worker or a browser.
 */

const VALID = `<!doctype html>
<html lang="es">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NacioCheck</title>
    <style>body { color: #0f172a; }</style>
  </head>
  <body><a href="/privacy/">Privacidad</a></body>
</html>`;

describe('site page gate', () => {
  it('accepts a plain page with an internal link', () => {
    expect(pageProblems('index.html', VALID)).toEqual([]);
  });

  it('rejects a protocol-relative href', () => {
    expect(pageProblems('index.html', VALID.replace('/privacy/', '//evil.example/'))).not.toEqual(
      [],
    );
  });

  it('rejects an absolute external href', () => {
    expect(
      pageProblems('index.html', VALID.replace('/privacy/', 'https://evil.example/')),
    ).not.toEqual([]);
  });

  it('rejects a remote CSS import or url()', () => {
    expect(
      pageProblems(
        'index.html',
        VALID.replace('body { color: #0f172a; }', '@import "https://evil.example/x.css";'),
      ),
    ).not.toEqual([]);
    expect(
      pageProblems(
        'index.html',
        VALID.replace('body { color: #0f172a; }', 'body{background:url(//evil.example/x.png)}'),
      ),
    ).not.toEqual([]);
  });

  it('rejects scripts and stylesheet links', () => {
    expect(pageProblems('index.html', `${VALID}<script src="/x.js"></script>`)).not.toEqual([]);
    expect(
      pageProblems('index.html', `${VALID}<link rel="stylesheet" href="/x.css" />`),
    ).not.toEqual([]);
  });

  it('still requires a viewport, a title and inline CSS', () => {
    expect(pageProblems('index.html', '<html lang="es"><body></body></html>')).toEqual(
      expect.arrayContaining([
        'site/index.html: no viewport meta',
        'site/index.html: no <title>',
        'site/index.html: no inline <style>',
      ]),
    );
  });
});

const OWN_SCRIPT = '<script src="/feedback/feedback.js" defer></script>';
const TURNSTILE_SCRIPT =
  '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
const ADDENDUM_LINK =
  '<a href="https://www.cloudflare.com/turnstile-privacy-policy/">Cloudflare</a>';

const FEEDBACK_PAGES = ['feedback/index.html', 'en/feedback/index.html', 'ca/feedback/index.html'];
const ADDENDUM_PAGES = [
  ...FEEDBACK_PAGES,
  'privacy/index.html',
  'en/privacy/index.html',
  'ca/privacy/index.html',
];
const PLAIN_PAGES = ['index.html', 'en/index.html', 'ca/index.html'];

/** A valid page with `extra` added before the end of the body. */
function withBody(extra: string): string {
  return VALID.replace('</body>', `${extra}</body>`);
}

const SITEKEY = '0x4AAAAAAGPHi96wZq5N-xcv';
const WIDGET = `<div id="feedback-widget" data-sitekey="${SITEKEY}"></div>`;

const FEEDBACK = withBody(`${WIDGET}${TURNSTILE_SCRIPT}${OWN_SCRIPT}`);

describe('site gate: feedback pages', () => {
  it.each(FEEDBACK_PAGES)('accepts both scripts on %s', (name) => {
    expect(pageProblems(name, FEEDBACK)).toEqual([]);
  });

  it.each([...PLAIN_PAGES, 'privacy/index.html', 'en/privacy/index.html', 'ca/privacy/index.html'])(
    'rejects the Turnstile script and the own script on %s',
    (name) => {
      expect(pageProblems(name, withBody(TURNSTILE_SCRIPT))).not.toEqual([]);
      expect(pageProblems(name, withBody(OWN_SCRIPT))).not.toEqual([]);
    },
  );

  it.each(FEEDBACK_PAGES)('rejects a feedback page missing either script on %s', (name) => {
    expect(pageProblems(name, withBody(OWN_SCRIPT))).not.toEqual([]);
    expect(pageProblems(name, withBody(TURNSTILE_SCRIPT))).not.toEqual([]);
    expect(pageProblems(name, VALID)).not.toEqual([]);
  });

  it.each(FEEDBACK_PAGES)('rejects a second remote script on %s', (name) => {
    const other = '<script src="https://evil.example/x.js" async defer></script>';
    expect(pageProblems(name, `${FEEDBACK}${other}`)).not.toEqual([]);
  });

  it.each(FEEDBACK_PAGES)('rejects a Turnstile URL with another path or a query on %s', (name) => {
    const otherPath = TURNSTILE_SCRIPT.replace('v0/api.js', 'v1/api.js');
    const query = TURNSTILE_SCRIPT.replace('api.js"', 'api.js?render=explicit"');
    const subdomain = TURNSTILE_SCRIPT.replace('challenges.', 'evil.');
    for (const bad of [otherPath, query, subdomain]) {
      expect(pageProblems(name, withBody(`${bad}${OWN_SCRIPT}`))).not.toEqual([]);
    }
  });

  it.each(FEEDBACK_PAGES)('rejects an inline script or a third script on %s', (name) => {
    expect(pageProblems(name, `${FEEDBACK}<script>alert(1)</script>`)).not.toEqual([]);
    expect(pageProblems(name, `${FEEDBACK}<script src="/other.js" defer></script>`)).not.toEqual(
      [],
    );
  });

  it.each(FEEDBACK_PAGES)('rejects a relative own-script look-alike on %s', (name) => {
    const lookalike = OWN_SCRIPT.replace('/feedback/feedback.js', '//evil.example/feedback.js');
    expect(pageProblems(name, withBody(`${TURNSTILE_SCRIPT}${lookalike}`))).not.toEqual([]);
  });

  it.each(FEEDBACK_PAGES)('still rejects other remote references on %s', (name) => {
    expect(pageProblems(name, `${FEEDBACK}<a href="https://evil.example/">x</a>`)).not.toEqual([]);
    expect(pageProblems(name, `${FEEDBACK}<iframe src="/x"></iframe>`)).not.toEqual([]);
  });
});

describe('site gate: sitekey on the feedback pages', () => {
  const withKey = (key: string) => FEEDBACK.replace(SITEKEY, key);

  it.each(FEEDBACK_PAGES)('accepts a production-shaped key on %s', (name) => {
    expect(pageProblems(name, withKey('0xAbC_123-xyz'))).toEqual([]);
  });

  it.each(FEEDBACK_PAGES)('rejects each Cloudflare test-key prefix on %s', (name) => {
    for (const key of [
      '1x00000000000000000000AA',
      '2x00000000000000000000AB',
      '3x00000000000000000000FF',
    ]) {
      expect(pageProblems(name, withKey(key))).not.toEqual([]);
    }
  });

  it.each(FEEDBACK_PAGES)('rejects an empty or odd key on %s', (name) => {
    expect(pageProblems(name, withKey(''))).not.toEqual([]);
    expect(pageProblems(name, withKey('0x'))).not.toEqual([]);
    expect(pageProblems(name, withKey('0x bad'))).not.toEqual([]);
  });

  it.each(FEEDBACK_PAGES)('rejects a missing key on %s', (name) => {
    expect(
      pageProblems(name, FEEDBACK.replace(WIDGET, '<div id="feedback-widget"></div>')),
    ).not.toEqual([]);
  });

  it.each(FEEDBACK_PAGES)('rejects a doubled key on %s', (name) => {
    expect(
      pageProblems(name, withBody(`${WIDGET}${WIDGET}${TURNSTILE_SCRIPT}${OWN_SCRIPT}`)),
    ).not.toEqual([]);
  });

  it.each(FEEDBACK_PAGES)('rejects an unquoted key attribute on %s', (name) => {
    expect(
      pageProblems(name, FEEDBACK.replace(`data-sitekey="${SITEKEY}"`, `data-sitekey=${SITEKEY}`)),
    ).not.toEqual([]);
  });
});

describe('site gate: Turnstile privacy addendum link', () => {
  it.each(ADDENDUM_PAGES)('accepts the plain link on %s', (name) => {
    const page = FEEDBACK_PAGES.includes(name) ? FEEDBACK : VALID;
    expect(pageProblems(name, page.replace('</body>', `${ADDENDUM_LINK}</body>`))).toEqual([]);
  });

  it.each(PLAIN_PAGES)('rejects the link on %s', (name) => {
    expect(pageProblems(name, withBody(ADDENDUM_LINK))).not.toEqual([]);
  });

  it.each(['index.html', ...ADDENDUM_PAGES])(
    'rejects another cloudflare.com address on %s',
    (name) => {
      const page = FEEDBACK_PAGES.includes(name) ? FEEDBACK : VALID;
      const other = [
        'https://www.cloudflare.com/',
        'https://www.cloudflare.com/turnstile/',
        'https://challenges.cloudflare.com/x',
      ];
      for (const url of other) {
        expect(
          pageProblems(name, page.replace('</body>', `<a href="${url}">x</a></body>`)),
        ).not.toEqual([]);
      }
    },
  );

  it.each(ADDENDUM_PAGES)('rejects a link with extra attributes or a query on %s', (name) => {
    const page = FEEDBACK_PAGES.includes(name) ? FEEDBACK : VALID;
    const withQuery = ADDENDUM_LINK.replace('policy/"', 'policy/?x=1"');
    const withTarget = ADDENDUM_LINK.replace('policy/"', 'policy/" target="_blank"');
    for (const link of [withQuery, withTarget]) {
      expect(pageProblems(name, page.replace('</body>', `${link}</body>`))).not.toEqual([]);
    }
  });
});

describe('site gate: non-HTML files', () => {
  const GOOD_JS = `const response = await fetch('/api/feedback', { method: 'POST' });\nexport {};\n`;

  it('accepts feedback/feedback.js without any address', () => {
    expect(assetProblems('feedback/feedback.js', GOOD_JS)).toEqual([]);
  });

  it('rejects any other file', () => {
    expect(assetProblems('other.js', GOOD_JS)).not.toEqual([]);
    expect(assetProblems('feedback/other.js', GOOD_JS)).not.toEqual([]);
    expect(assetProblems('en/feedback/feedback.js', GOOD_JS)).not.toEqual([]);
    expect(assetProblems('data.json', '{}')).not.toEqual([]);
  });

  it.each([
    ["fetch('https://naciocheck.vgr.cat/api/feedback')", 'absolute https'],
    ["fetch('http://example.com/')", 'absolute http'],
    ["fetch('//evil.example/api')", 'protocol-relative'],
    ['eval("1")', 'eval'],
    ['new Function("return 1")', 'new Function'],
    ["await import('/x.js')", 'dynamic import'],
  ])('rejects feedback.js with %s (%s)', (code) => {
    expect(assetProblems('feedback/feedback.js', `${GOOD_JS}${code};\n`)).not.toEqual([]);
  });

  it('accepts exactly one always-pass test sitekey in feedback.js', () => {
    const one = `${GOOD_JS}const key = '1x00000000000000000000AA';\n`;
    expect(assetProblems('feedback/feedback.js', one)).toEqual([]);
  });

  it.each([
    [
      'a second always-pass key',
      `const a = '1x00000000000000000000AA'; const b = '1x00000000000000000000AA';`,
    ],
    ['the always-fail sitekey', `const a = '2x00000000000000000000AB';`],
    ['the forced-challenge sitekey', `const a = '3x00000000000000000000FF';`],
    ['a test secret', `const a = '1x0000000000000000000000000000000AA';`],
    [
      'the always-pass key plus another',
      `const a = '1x00000000000000000000AA'; const b = '2x00000000000000000000AB';`,
    ],
  ])('rejects feedback.js with %s', (_label, code) => {
    expect(assetProblems('feedback/feedback.js', `${GOOD_JS}${code}\n`)).not.toEqual([]);
  });

  it('walks the directory: only feedback/feedback.js passes among files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'site-gate-'));
    try {
      const write = (name: string, text: string) => {
        const path = join(dir, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text);
      };
      write('feedback/feedback.js', GOOD_JS);
      expect(siteProblems(dir).filter((problem) => problem.includes('feedback.js'))).toEqual([]);
      write('stray.js', GOOD_JS);
      write('feedback/feedback.js', "fetch('https://evil.example/')");
      const problems = siteProblems(dir);
      expect(problems).toContain('site/stray.js: only HTML is served, this file is not a page');
      expect(problems.some((problem) => problem.startsWith('site/feedback/feedback.js'))).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

const ALL_PAGES = [...PLAIN_PAGES, ...ADDENDUM_PAGES];

/** The page a case is run against: the feedback pages need their scripts and sitekey to be otherwise valid. */
function baseFor(name: string): string {
  return FEEDBACK_PAGES.includes(name) ? FEEDBACK : VALID;
}

describe('site gate: languages', () => {
  it('knows es, en and ca', () => {
    expect(LANGUAGES).toEqual(['es', 'en', 'ca']);
  });

  it.each(['es', 'en', 'ca'])('accepts lang="%s"', (lang) => {
    expect(pageProblems('index.html', VALID.replace('lang="es"', `lang="${lang}"`))).toEqual([]);
  });

  it.each(['fr', 'ca-ES', ''])('rejects lang="%s"', (lang) => {
    expect(pageProblems('index.html', VALID.replace('lang="es"', `lang="${lang}"`))).not.toEqual(
      [],
    );
  });

  it('accepts both scripts on the Catalan feedback page and nowhere else in ca/', () => {
    expect(pageProblems('ca/feedback/index.html', FEEDBACK)).toEqual([]);
    expect(pageProblems('ca/index.html', FEEDBACK)).not.toEqual([]);
    expect(pageProblems('ca/privacy/index.html', withBody(OWN_SCRIPT))).not.toEqual([]);
    expect(pageProblems('ca/changelog/index.html', withBody(TURNSTILE_SCRIPT))).not.toEqual([]);
  });
});

describe('site gate: outbound links', () => {
  const ALLOWED = [
    'https://vgr.cat/',
    'https://vgr.cat/es/',
    'https://vgr.cat/ca/#contacte',
    'https://www.linkedin.com/in/vagonzal/',
    'https://github.com/vgr-dev/naciocheck',
    'https://github.com/vgr-dev/naciocheck/',
    'https://github.com/vgr-dev/naciocheck/releases/tag/v0.1.0',
    'https://chromewebstore.google.com/detail/naciocheck/abcdef',
    'https://addons.mozilla.org/firefox/addon/naciocheck/',
  ];
  const link = (url: string, extra = '') => `<a ${extra}href="${url}">x</a>`;

  it.each(ALL_PAGES)('accepts every allowed address on %s', (name) => {
    for (const url of ALLOWED) {
      expect(pageProblems(name, baseFor(name).replace('</body>', `${link(url)}</body>`))).toEqual(
        [],
      );
    }
  });

  it('accepts other attributes on an allowed link, and single quotes', () => {
    const page = withBody(
      `<a class="button" rel="noopener" href='https://vgr.cat/es/' hreflang="es">x</a>`,
    );
    expect(pageProblems('index.html', page)).toEqual([]);
  });

  it.each([
    ['http, not https', 'http://vgr.cat/'],
    ['a longer host', 'https://vgr.cat.evil.example/'],
    ['userinfo', 'https://vgr.cat@evil.example/'],
    ['a sibling host', 'https://www.vgr.cat/'],
    ['a subdomain', 'https://naciocheck.vgr.cat/'],
    ['no path slash', 'https://vgr.cat'],
    ['upper-case scheme', 'HTTPS://vgr.cat/'],
    ['protocol-relative', '//vgr.cat/'],
    ['another LinkedIn profile', 'https://www.linkedin.com/in/someone/'],
    ['LinkedIn with a query', 'https://www.linkedin.com/in/vagonzal/?x=1'],
    ['LinkedIn without www', 'https://linkedin.com/in/vagonzal/'],
    ['a sibling repository', 'https://github.com/vgr-dev/naciocheck-evil'],
    ['another repository', 'https://github.com/vgr-dev/other'],
    ['the organisation only', 'https://github.com/vgr-dev/'],
    ['another GitHub account', 'https://github.com/evil/naciocheck'],
    ['a longer store host', 'https://chromewebstore.google.com.evil.example/'],
    ['the old Chrome store', 'https://chrome.google.com/webstore/detail/x'],
    ['a longer add-ons host', 'https://addons.mozilla.org.evil.example/'],
    ['Cloudflare', 'https://www.cloudflare.com/'],
    ['an unrelated site', 'https://evil.example/'],
  ])('rejects an <a href> to %s on every page', (_label, url) => {
    for (const name of ALL_PAGES) {
      expect(
        pageProblems(name, baseFor(name).replace('</body>', `${link(url)}</body>`)),
      ).not.toEqual([]);
    }
  });

  it('rejects an unquoted allowed href, which the gate cannot read', () => {
    expect(pageProblems('index.html', withBody('<a href=https://vgr.cat/>x</a>'))).not.toEqual([]);
  });

  it('rejects an allowed address anywhere but an <a href>', () => {
    const url = 'https://vgr.cat/';
    for (const html of [
      `<img src="${url}x.png" alt="" />`,
      `<img srcset="/a.webp 640w, ${url}b.webp 1280w" alt="" />`,
      `<video poster="${url}p.png"></video>`,
      `<object data="${url}x"></object>`,
      `<form action="${url}"></form>`,
      `<button formaction="${url}">x</button>`,
      `<a href="/privacy/" ping="${url}">x</a>`,
      `<a data-href="${url}" href="/">x</a>`,
      `<a href="/privacy/" title="${url}">x</a>`,
      `<link rel="stylesheet" href="${url}x.css" />`,
      `<link rel="icon" href="${url}favicon.ico" />`,
      `<link rel="preload" href="${url}x" as="image" />`,
      `<meta name="description" content="${url}" />`,
      `<p>${url}</p>`,
      `<!-- ${url} -->`,
    ]) {
      expect(pageProblems('index.html', withBody(html)), html).not.toEqual([]);
    }
    expect(
      pageProblems('index.html', VALID.replace('color: #0f172a;', `background: url(${url}x.png);`)),
    ).not.toEqual([]);
  });

  it('rejects an allowed href next to a bad second href in the same tag', () => {
    expect(
      pageProblems(
        'index.html',
        withBody('<a href="https://vgr.cat/" href="https://evil.example/">x</a>'),
      ),
    ).not.toEqual([]);
  });
});

describe('site gate: own origin and rel="me" metadata', () => {
  const ORIGIN = 'https://naciocheck.vgr.cat/';

  it.each(ALL_PAGES)('accepts canonical, alternate, og: and twitter: metadata on %s', (name) => {
    const head = [
      `<link rel="canonical" href="${ORIGIN}en/" />`,
      `<link rel="alternate" hreflang="es" href="${ORIGIN}" />`,
      `<link rel="alternate" hreflang="x-default" href='${ORIGIN}' />`,
      `<meta property="og:url" content="${ORIGIN}en/" />`,
      `<meta property="og:image" content="${ORIGIN}social-card.png" />`,
      `<meta content="${ORIGIN}social-card.png" name="twitter:image" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta property="og:locale" content="en_GB" />`,
      `<link rel="me" href="https://vgr.cat/" />`,
      `<link rel="icon" href="/favicon.svg" />`,
    ].join('\n');
    expect(pageProblems(name, baseFor(name).replace('</head>', `${head}</head>`))).toEqual([]);
  });

  it.each([
    ['an <a href>', `<a href="${ORIGIN}">x</a>`],
    ['an <img src>', `<img src="${ORIGIN}social-card.png" alt="" />`],
    ['a link rel="icon"', `<link rel="icon" href="${ORIGIN}favicon.ico" />`],
    ['a link rel="stylesheet"', `<link rel="stylesheet" href="${ORIGIN}x.css" />`],
    ['a combined rel with stylesheet', `<link rel="alternate stylesheet" href="${ORIGIN}x.css" />`],
    ['a link with no rel', `<link href="${ORIGIN}x" />`],
    ['a meta refresh', `<meta http-equiv="refresh" content="0;url=${ORIGIN}" />`],
    ['a description', `<meta name="description" content="${ORIGIN}" />`],
    [
      'a meta refresh with an og: name',
      `<meta http-equiv="refresh" name="og:x" content="${ORIGIN}" />`,
    ],
    [
      'a canonical on a longer host',
      `<link rel="canonical" href="https://naciocheck.vgr.cat.evil.example/" />`,
    ],
    [
      'a canonical on a sibling host',
      `<link rel="canonical" href="https://www.naciocheck.vgr.cat/" />`,
    ],
    ['a canonical on http', `<link rel="canonical" href="http://naciocheck.vgr.cat/" />`],
    ['a canonical elsewhere', `<link rel="canonical" href="https://evil.example/" />`],
    ['an og:image elsewhere', `<meta property="og:image" content="https://evil.example/x.png" />`],
    ['an og:image on vgr.cat', `<meta property="og:image" content="https://vgr.cat/x.png" />`],
    ['rel="me" to a vgr.cat page', `<link rel="me" href="https://vgr.cat/es/" />`],
    ['rel="me" to the own origin', `<link rel="me" href="${ORIGIN}" />`],
    ['rel="me" elsewhere', `<link rel="me" href="https://evil.example/" />`],
    ['a canonical with an unquoted href', `<link rel="canonical" href=${ORIGIN} />`],
  ])('rejects the own origin or vgr.cat in %s', (_label, html) => {
    expect(pageProblems('index.html', withBody(html))).not.toEqual([]);
  });

  it('rejects the own origin in the body text, a comment or CSS', () => {
    expect(pageProblems('index.html', withBody(`<p>${ORIGIN}</p>`))).not.toEqual([]);
    expect(pageProblems('index.html', withBody(`<!-- ${ORIGIN} -->`))).not.toEqual([]);
    expect(
      pageProblems(
        'index.html',
        VALID.replace('color: #0f172a;', `background:url(${ORIGIN}x.png)`),
      ),
    ).not.toEqual([]);
  });
});

/** A fake image file: a few real header bytes. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
const ICO = Buffer.from([0, 0, 1, 0, 1, 0, 32, 32]);

const GOOD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient><path id="p" d="M0 0h10v10z"/></defs>
  <style>.a { fill: url(#g); } @keyframes spin { to { opacity: 0.5; } }</style>
  <use href="#p" class="a"/><use xlink:href="#p"/><rect width="10" height="10" fill="url('#g')" style="clip-path: url( #g )"/>
</svg>`;

describe('site gate: images', () => {
  it('accepts a plain SVG with only fragment references', () => {
    expect(assetProblems('img/logo.svg', GOOD_SVG)).toEqual([]);
  });

  it('accepts the real brand SVGs', () => {
    for (const file of readdirSync('brand').filter((name) => name.endsWith('.svg'))) {
      expect(assetProblems(`img/${file}`, readFileSync(`brand/${file}`, 'utf8')), file).toEqual([]);
    }
  });

  it.each([
    ['a script element', '<script>alert(1)</script>'],
    ['a prefixed script element', '<svg:script xmlns:svg="x">1</svg:script>'],
    ['an onload attribute', '<rect onload="x()" width="1" height="1"/>'],
    ['an onclick attribute after a slash', '<rect/onclick="x()"/>'],
    ['a foreignObject', '<foreignObject><div>x</div></foreignObject>'],
    ['an external href', '<a href="https://evil.example/">x</a>'],
    ['a relative href', '<image href="/x.png"/>'],
    ['an external xlink:href', '<use xlink:href="https://evil.example/x.svg#a"/>'],
    ['an empty href', '<use href=""/>'],
    ['a data: href', '<image href="data:image/png;base64,AAAA"/>'],
    ['a remote url()', '<rect fill="url(https://evil.example/x)"/>'],
    ['a protocol-relative url()', '<style>a{fill:url(//evil.example/x)}</style>'],
    ['a relative url()', '<style>a{background:url(/x.png)}</style>'],
    ['a quoted remote url()', `<style>a{background:url('https://evil.example/x')}</style>`],
    ['a data: url()', '<style>a{background:url(data:image/png;base64,AAAA)}</style>'],
    ['an @import', '<style>@import "x.css";</style>'],
    ['an image-set()', '<style>a{background:image-set("x.png" 1x)}</style>'],
    ['a SMIL href', '<a><set attributeName="href" to="https://evil.example/"/></a>'],
    ['a character reference', '<rect style="fill:&#117;rl(https://evil.example/x)"/>'],
    ['a CSS escape', '<style>a{fill:\\75rl(https://evil.example/x)}</style>'],
    ['an entity', '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>'],
  ])('rejects an SVG with %s', (_label, body) => {
    expect(assetProblems('img/x.svg', GOOD_SVG.replace('</svg>', `${body}</svg>`))).not.toEqual([]);
  });

  it('accepts .png, .webp and .ico by name and checks their bytes', () => {
    expect(assetProblems('social-card.png', '')).toEqual([]);
    expect(assetProblems('img/screens/es/a-640.webp', '')).toEqual([]);
    expect(assetProblems('favicon.ico', '')).toEqual([]);
    expect(binaryProblems('social-card.png', PNG)).toEqual([]);
    expect(binaryProblems('a-640.webp', WEBP)).toEqual([]);
    expect(binaryProblems('favicon.ico', ICO)).toEqual([]);
    expect(binaryProblems('x.png', Buffer.from('<script>alert(1)</script>'))).not.toEqual([]);
    expect(binaryProblems('x.png', WEBP)).not.toEqual([]);
    expect(binaryProblems('x.webp', PNG)).not.toEqual([]);
    expect(binaryProblems('x.ico', PNG)).not.toEqual([]);
    expect(binaryProblems('x.png', Buffer.alloc(0))).not.toEqual([]);
    expect(binaryProblems('x.jpg', PNG)).not.toEqual([]);
  });

  it.each([
    'stray.js',
    'feedback/other.js',
    'data.json',
    'style.css',
    'photo.jpg',
    'photo.jpeg',
    'anim.gif',
    'font.woff2',
    'icon.avif',
    'page.htm',
    'doc.pdf',
    'notes.txt',
    'feedback.js.map',
    'noextension',
    'img.png/other',
    'favicon.ICO',
  ])('rejects the file type of %s', (name) => {
    expect(assetProblems(name, '')).toEqual([
      `site/${name}: only HTML is served, this file is not a page`,
    ]);
  });
});

describe('site gate: language parity', () => {
  const ES = ['index.html', 'privacy/index.html', '404.html'];
  const copy = (prefix: string, pages = ES) => pages.map((page) => `${prefix}${page}`);

  it('passes when every language has the same pages', () => {
    expect(parityProblems([...ES, ...copy('en/'), ...copy('ca/')])).toEqual([]);
    expect(parityProblems([...ES, ...copy('en/')])).toEqual([]);
  });

  it('does not compare a language that does not exist', () => {
    expect(parityProblems(ES)).toEqual([]);
    expect(parityProblems([...ES, ...copy('en/')], ['en'])).toEqual([]);
  });

  it('names a page a language lacks', () => {
    expect(parityProblems([...ES, ...copy('en/'), ...copy('ca/', ES.slice(0, 2))])).toEqual([
      'site/ca/404.html: missing, es has 404.html',
    ]);
  });

  it('names a page es lacks', () => {
    expect(parityProblems([...ES, ...copy('en/', [...ES, 'extra/index.html'])])).toEqual([
      'site/en/extra/index.html: es has no extra/index.html',
    ]);
  });

  it('flags a language directory that exists but has no pages', () => {
    expect(parityProblems(ES, ['ca'])).toHaveLength(ES.length);
  });

  it('runs on a directory: a missing and an extra Catalan page fail, a complete one passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'site-gate-parity-'));
    try {
      const write = (name: string, text: string) => {
        const path = join(dir, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text);
      };
      for (const prefix of ['', 'en/']) {
        write(`${prefix}index.html`, VALID.replace('lang="es"', 'lang="en"'));
        write(`${prefix}privacy/index.html`, VALID);
      }
      const parity = () => siteProblems(dir).filter((problem) => /ca\//.test(problem));
      expect(parity()).toEqual([]);
      write('ca/index.html', VALID.replace('lang="es"', 'lang="ca"'));
      expect(parity()).toEqual(['site/ca/privacy/index.html: missing, es has privacy/index.html']);
      write('ca/privacy/index.html', VALID);
      write('ca/extra/index.html', VALID);
      expect(parity()).toEqual(['site/ca/extra/index.html: es has no extra/index.html']);
      rmSync(join(dir, 'ca/extra'), { recursive: true });
      expect(parity()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('still lists the six required pages until a later step widens them', () => {
    expect(REQUIRED_PAGES).toHaveLength(6);
  });
});

describe('site gate: a directory with images', () => {
  it('accepts real-looking images, refuses a fake one and an unknown type', () => {
    const dir = mkdtempSync(join(tmpdir(), 'site-gate-images-'));
    try {
      const write = (name: string, data: string | Buffer) => {
        const path = join(dir, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, data);
      };
      write('social-card.png', PNG);
      write('img/screens/es/a-640.webp', WEBP);
      write('favicon.ico', ICO);
      write('favicon.svg', GOOD_SVG);
      const imageProblems = () =>
        siteProblems(dir).filter(
          (problem) => !problem.endsWith(': missing') && problem !== 'site/: no files',
        );
      expect(imageProblems()).toEqual([]);
      write('fake.png', '<script>alert(1)</script>');
      write('evil.svg', '<svg><script>1</script></svg>');
      write('font.woff2', 'x');
      expect(imageProblems().sort()).toEqual(
        [
          'site/evil.svg: has a <script> element: an SVG may not script or embed',
          'site/fake.png: is not a real .png file',
          'site/font.woff2: only HTML is served, this file is not a page',
        ].sort(),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
