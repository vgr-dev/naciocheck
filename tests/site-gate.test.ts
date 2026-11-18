import { describe, expect, it } from 'vitest';
import { pageProblems } from '../scripts/check-site.mjs';

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
