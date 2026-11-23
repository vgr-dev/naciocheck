import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetProblems, pageProblems, siteProblems } from '../scripts/check-site.mjs';

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

const FEEDBACK_PAGES = ['feedback/index.html', 'en/feedback/index.html'];
const ADDENDUM_PAGES = [...FEEDBACK_PAGES, 'privacy/index.html', 'en/privacy/index.html'];

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

  it.each(['index.html', 'en/index.html', 'privacy/index.html', 'en/privacy/index.html'])(
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

  it.each(['index.html', 'en/index.html'])('rejects the link on %s', (name) => {
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
