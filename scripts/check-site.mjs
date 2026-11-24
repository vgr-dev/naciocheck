#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The site's gate: the pages state that nothing is loaded from anywhere, so the files have to prove it.
 *
 * Every rule below is a thing the pages must not contain. The last one is the catch-all: a page may not mention
 * any `http://` or `https://` address at all, except in the exceptions below. The one host the site names
 * without linking it is written as plain text (`sede.mjusticia.gob.es`).
 *
 * Exceptions, each matched exactly:
 * - every page carries one inline classic `<script>` in the head whose text is, byte for byte, `site/theme.js`
 *   (the theme bootstrap, which is not served as a file); it gets the dynamic-code and network-API checks of
 *   the other scripts. Feedback pages additionally carry the site's own `feedback.js` and Cloudflare's
 *   Turnstile, and those pages plus the privacy pages
 *   (`TURNSTILE_LINK_PAGES`) may link Turnstile's privacy addendum;
 * - any page may carry an outbound `<a href>` that starts with one of `OUTBOUND_LINKS`, and the site's own
 *   origin in `<link rel="canonical|alternate">` and `og:`/`twitter:` `<meta content>`, and `https://vgr.cat/`
 *   in `<link rel="me">`. Nothing absolute is ever allowed in `src`, `srcset`, `poster`, `data`, `action`,
 *   CSS `url()` or `@import`;
 * - the files served besides pages are `feedback/feedback.js`, images (`.png`, `.webp`, `.svg`,
 *   `.ico`) and one text file, `img/OFL.txt` (the Nunito licence, which must sit
 *   next to the outlined logos whenever `img/logo-light.svg` or `img/logo-dark.svg` ships); an SVG may not
 *   script, embed or reach anything outside itself.
 * - no element carries an event-handler attribute (`on<name>`, any case, quoted, unquoted or empty), on any
 *   page, including the feedback pages: only the approved script tags are allowed.
 *
 * Normalisation: a browser reads a URL attribute more generously than a regex does, so the gate reads it the
 * same way before it judges it: character references are decoded, tabs and newlines are removed, the
 * whitespace around it is trimmed and `\` counts as `/` (`normaliseUrl`). Every `srcset` candidate is judged,
 * and a CSS `url()` or `image-set()` is judged after its escapes are resolved (`unescapeCss`). A URL that still
 * starts with a scheme (`https:evil.example` included) or with `//` reaches another origin. `<meta
 * http-equiv="refresh">` is refused outright.
 *
 * Languages: `LANGUAGES`. Spanish lives at the root, the others in their own directory, every language must
 * have every page in `PAGES` (`REQUIRED_PAGES`), and every language that exists must have the same set of
 * pages as Spanish. A page's `<html lang>` is its directory's language.
 *
 * Links: every same-origin `href` (starting with `/`, or relative) must reach a page or file in the site.
 */

const SCRIPT_PATH = fileURLToPath(import.meta.url);
/** The theme bootstrap's source: the build inlines it into every page, and the gate compares it byte for byte. */
const THEME_SOURCE_FILE = resolve(import.meta.dirname, '../site/theme.js');
const SITE_DIR = resolve(import.meta.dirname, '../.output/site');

/** The site's languages. Spanish is served at `/`, the others at `/<lang>/`. */
export const LANGUAGES = ['es', 'en', 'ca'];

/** The path prefix of a language's pages: none for Spanish, `en/` and `ca/` for the others. */
const languagePrefix = (language) => (language === 'es' ? '' : `${language}/`);

/** The pages that post a report and carry the feedback scripts. */
const FEEDBACK_PAGES = LANGUAGES.map(
  (language) => `${languagePrefix(language)}feedback/index.html`,
);

/** The pages every language has, relative to its directory. */
export const PAGES = [
  'index.html',
  'privacy/index.html',
  'feedback/index.html',
  'changelog/index.html',
  '404.html',
];

/** The pages the Worker has to serve: every page in every language. */
export const REQUIRED_PAGES = LANGUAGES.flatMap((language) =>
  PAGES.map((page) => `${languagePrefix(language)}${page}`),
);

/** The language a page belongs to, from its directory: `en/…` and `ca/…` are theirs, anything else Spanish. */
function languageOf(name) {
  return LANGUAGES.find((language) => language !== 'es' && name.startsWith(`${language}/`)) ?? 'es';
}

/** The pages that may link Cloudflare's Turnstile Privacy Addendum (checked 2026-11-23). */
const TURNSTILE_LINK_PAGES = [
  ...FEEDBACK_PAGES,
  ...LANGUAGES.map((language) => `${languagePrefix(language)}privacy/index.html`),
];

/** The one same-origin script file served. The theme bootstrap is inline, never a file. */
const FEEDBACK_SCRIPT = 'feedback/feedback.js';
/** The image types served besides pages. */
const IMAGE_TYPES = ['.png', '.webp', '.svg', '.ico'];

/** The one text file served: the Nunito licence that travels with the outlined logos (a copy of `brand/OFL.txt`). */
const LICENCE_FILE = 'img/OFL.txt';

/** The outlined wordmarks: whenever one is served, `LICENCE_FILE` has to be served too. */
const OUTLINED_LOGOS = ['img/logo-light.svg', 'img/logo-dark.svg'];

/** The site's own origin: metadata only, never a link or a resource. */
const OWN_ORIGIN = 'https://naciocheck.vgr.cat/';

/** `<link rel="me">` points here and nowhere else. */
const REL_ME_URL = 'https://vgr.cat/';

/** The outbound `<a href>` values: a prefix (ending in `/`), an exact address, or an address and its subpaths. */
const OUTBOUND_PREFIXES = [
  'https://vgr.cat/',
  'https://chromewebstore.google.com/',
  'https://addons.mozilla.org/',
];
const OUTBOUND_EXACT = ['https://www.linkedin.com/in/vagonzal/'];
const REPOSITORY_URL = 'https://github.com/vgr-dev/naciocheck';

/** A production sitekey: `0x` and then letters, digits, `_` or `-`. Cloudflare's test keys start `1x`, `2x`, `3x`. */
const PRODUCTION_SITEKEY = /^0x[A-Za-z0-9_-]+$/;

/** Anything shaped like a Turnstile test sitekey or test secret (`1x…`, `2x…`, `3x…`). */
const TEST_KEY_SHAPE = /\b[123]x[0-9A-Za-z_-]{10,}/g;

/** The one test key `feedback.js` may carry: the always-pass sitekey, for hands-on checks on localhost. */
const ALLOWED_TEST_KEY = '1x00000000000000000000AA';

const OWN_SCRIPT_TAG = /<script\s+src="\/feedback\/feedback\.js"\s+defer\s*><\/script>/gi;
/** A bare classic inline script element: its attributes would make it something else. */
const INLINE_SCRIPT = /<script>([\s\S]*?)<\/script\s*>/g;
const TURNSTILE_SCRIPT_TAG =
  /<script\s+src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js"\s+async\s+defer\s*><\/script>/gi;
const TURNSTILE_LINK_TAG =
  /<a\s+href="https:\/\/www\.cloudflare\.com\/turnstile-privacy-policy\/"\s*>/gi;

const FORBIDDEN = [
  { pattern: /<script\b/i, why: 'has an unapproved <script> element' },
  { pattern: /<link\b[^>]*rel=["']?stylesheet/i, why: 'links a stylesheet: the CSS is inline' },
  { pattern: /@import/i, why: 'imports a stylesheet from CSS (@import)' },
  { pattern: /url\(\s*['"]?\s*(?:https?:)?\/\//i, why: 'loads a remote url() from CSS' },
  { pattern: /<iframe\b/i, why: 'has an <iframe>' },
  { pattern: /<video\b/i, why: 'has a <video> element: the site uses static images' },
  {
    pattern:
      /\b(?:src|srcset|poster|data|action|href|formaction|cite)\s*=\s*["']?(?:https?:)?\/\//i,
    why: 'loads a resource from another origin',
  },
  {
    pattern: /https?:\/\//i,
    why: 'names an http(s) address: the site must not link or reference anything outside itself',
  },
];

/** Every file under `site/`, as paths relative to it. */
function filesIn(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...filesIn(full));
    else found.push(full);
  }
  return found;
}

/** Whether `url` is one of the outbound links an `<a href>` may carry. */
function isOutboundLink(url) {
  if (OUTBOUND_PREFIXES.some((prefix) => url.startsWith(prefix))) return true;
  if (OUTBOUND_EXACT.includes(url)) return true;
  // The repository and anything below it, but not a sibling such as `naciocheck-evil`.
  if (!url.startsWith(REPOSITORY_URL)) return false;
  const next = url.charAt(REPOSITORY_URL.length);
  return next === '' || next === '/' || next === '?' || next === '#';
}

/** A start tag: its name and everything up to the closing `>`, quoted values included. */
const START_TAG = /<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/** The first value of attribute `name` in a tag's attributes, or null. */
function attributeValue(attributes, name) {
  const match = new RegExp(
    `(?:^|[\\s"'/])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    'i',
  ).exec(attributes);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

/** The named character references that can spell a URL character; anything else cannot hide an address. */
const NAMED_REFERENCES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  sol: '/',
  bsol: '\\',
  colon: ':',
  period: '.',
  Tab: '\t',
  NewLine: '\n',
  num: '#',
  quest: '?',
  commat: '@',
  lpar: '(',
  rpar: ')',
  semi: ';',
};

/** One code point from a number, or U+FFFD when it is not one. */
function fromCodePoint(code) {
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�';
}

/** Decodes HTML character references (numeric with or without `;`, and the named ones above), once. */
function decodeReferences(value) {
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([A-Za-z]+));?/gi, (whole, decimal, hex, name) => {
    if (decimal !== undefined) return fromCodePoint(Number.parseInt(decimal, 10));
    if (hex !== undefined) return fromCodePoint(Number.parseInt(hex, 16));
    return Object.hasOwn(NAMED_REFERENCES, name) ? NAMED_REFERENCES[name] : whole;
  });
}

/**
 * A URL attribute value as a browser reads it: references decoded, tabs and newlines removed, the control
 * characters and spaces around it trimmed, and `\` read as `/`.
 * @param {string} value
 * @returns {string}
 */
function normaliseUrl(value) {
  const text = decodeReferences(value).replace(/[\t\n\r]/g, '');
  let start = 0;
  let end = text.length;
  while (start < end && text.charCodeAt(start) <= 0x20) start += 1;
  while (end > start && text.charCodeAt(end - 1) <= 0x20) end -= 1;
  return text.slice(start, end).replaceAll('\\', '/');
}

/** Whether a normalised URL leaves the site: it starts with a scheme (`https:`, `mailto:`) or with `//`. */
function reachesAnotherOrigin(url) {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
}

/** The attributes that hold a URL, or a list of them (`srcset`, `ping`). */
const URL_ATTRIBUTES = new Set([
  'src',
  'srcset',
  'poster',
  'data',
  'action',
  'href',
  'formaction',
  'cite',
  'background',
  'longdesc',
  'ping',
  'manifest',
  'imagesrcset',
]);

/** An attribute, quoted or not, or one with no value. */
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** The URLs in an attribute value: one, or every candidate of a list, which is split on commas and spaces. */
function urlsIn(name, value) {
  if (name !== 'srcset' && name !== 'imagesrcset' && name !== 'ping') return [normaliseUrl(value)];
  return decodeReferences(value)
    .split(/[\s,]+/)
    .filter((token) => token !== '' && !/^\d+(?:\.\d+)?[wx]$/i.test(token))
    .map(normaliseUrl);
}

/** CSS with its escapes resolved (`\2f ` is `/`, `\u` is `u`), so a spelling cannot hide `url(` or an address. */
function unescapeCss(css) {
  return css.replace(/\\(?:([0-9a-f]{1,6})[ \t\n\r\f]?|([^\n\r\f]))/gi, (whole, hex, character) =>
    hex === undefined ? character : fromCodePoint(Number.parseInt(hex, 16)),
  );
}

/** The ways CSS (after its escapes) may reach another origin: `@import`, a remote `url()` or `image-set()`. */
function cssProblems(raw) {
  const css = unescapeCss(raw);
  const problems = [];
  if (/@import/i.test(css)) problems.push('imports a stylesheet from CSS (@import)');
  for (const [, , argument = ''] of css.matchAll(/url\(\s*(["']?)([^)]*)/gi)) {
    if (reachesAnotherOrigin(normaliseUrl(argument))) {
      problems.push('loads a remote url() from CSS');
      break;
    }
  }
  for (const [, list = ''] of css.matchAll(/image-set\(([^)]*)\)/gi)) {
    if (
      [...list.matchAll(/["']([^"']*)["']/g)].some(([, url = '']) =>
        reachesAnotherOrigin(normaliseUrl(url)),
      )
    ) {
      problems.push('loads a remote image from CSS (image-set())');
      break;
    }
  }
  return problems;
}

/**
 * The problems found after normalising: a URL attribute (every `srcset` candidate included) that reaches
 * another origin, a `style` attribute or `<style>` block whose CSS does, `http-equiv="refresh"`, and any
 * event-handler attribute (`on<name>`). The
 * addresses the gate allows must already be neutralised.
 * @param {string} text
 * @returns {string[]}
 */
function normalisedProblems(text) {
  const found = new Set();
  for (const [, tag = '', attributes = ''] of text.matchAll(START_TAG)) {
    for (const [, rawName = '', double, single, bare] of attributes.matchAll(ATTRIBUTE)) {
      const name = rawName.toLowerCase().replace(/^xlink:/, '');
      const value = double ?? single ?? bare;
      // An event handler, with a value or without one: the site carries no inline script of any kind.
      if (/^on[a-z]/.test(name)) {
        found.add(`has an on*= event attribute (${name}): the site carries no inline script`);
        continue;
      }
      if (value === undefined) continue;
      if (URL_ATTRIBUTES.has(name)) {
        if (urlsIn(name, value).some(reachesAnotherOrigin)) {
          found.add(
            `reaches another origin through ${name}: a scheme, //, a backslash, a character reference or leading space does not hide it`,
          );
        }
      } else if (name === 'style') {
        for (const why of cssProblems(decodeReferences(value))) found.add(why);
      } else if (
        name === 'http-equiv' &&
        tag.toLowerCase() === 'meta' &&
        normaliseUrl(value).toLowerCase() === 'refresh'
      ) {
        found.add('has <meta http-equiv="refresh">: a redirect can leave the site');
      }
    }
  }
  for (const [, css = ''] of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    for (const why of cssProblems(css)) found.add(why);
  }
  return [...found];
}

/** Replaces each quoted `attribute` value `accepts` approves with `"#"`, so the catch-all no longer sees it. */
function neutralise(tag, attribute, accepts) {
  const pattern = new RegExp(`(\\s${attribute}\\s*=\\s*)(?:"([^"]*)"|'([^']*)')`, 'gi');
  return tag.replace(pattern, (whole, lead, double, single) =>
    accepts(normaliseUrl(double ?? single ?? '')) ? `${lead}"#"` : whole,
  );
}

/**
 * Removes the absolute addresses the gate allows, in the one place each is allowed, and leaves everything
 * else for the catch-all rules: an outbound `<a href>`, the own origin in canonical and alternate links and
 * `og:`/`twitter:` metadata, and `https://vgr.cat/` in `rel="me"`.
 * @param {string} text
 * @returns {string}
 */
function withoutAllowedAddresses(text) {
  return text.replace(START_TAG, (tag, name, attributes) => {
    switch (name.toLowerCase()) {
      case 'a':
        return neutralise(tag, 'href', isOutboundLink);
      case 'link': {
        const rel = (attributeValue(attributes, 'rel') ?? '').trim().toLowerCase();
        if (rel === 'canonical' || rel === 'alternate') {
          return neutralise(tag, 'href', (url) => url.startsWith(OWN_ORIGIN));
        }
        if (rel === 'me') return neutralise(tag, 'href', (url) => url === REL_ME_URL);
        return tag;
      }
      case 'meta': {
        if (attributeValue(attributes, 'http-equiv') !== null) return tag;
        const label = (
          attributeValue(attributes, 'property') ??
          attributeValue(attributes, 'name') ??
          ''
        ).toLowerCase();
        if (!label.startsWith('og:') && !label.startsWith('twitter:')) return tag;
        return neutralise(tag, 'content', (url) => url.startsWith(OWN_ORIGIN));
      }
      default:
        return tag;
    }
  });
}

let themeSourceText;
/** The text of `site/theme.js`, or null when it cannot be read. Read once. */
function themeSource() {
  if (themeSourceText === undefined) {
    themeSourceText = existsSync(THEME_SOURCE_FILE)
      ? readFileSync(THEME_SOURCE_FILE, 'utf8')
      : null;
  }
  return themeSourceText;
}

/**
 * Checks one page's text. The only file it reads is `site/theme.js`, the source of the inline theme script.
 * @param {string} name
 * @param {string} text
 * @returns {string[]}
 */
export function pageProblems(name, text) {
  const problems = [];
  let checked = text;

  const source = themeSource();
  if (source === null) problems.push('site/theme.js: missing, the pages inline it');
  const inline = (html) => [...html.matchAll(INLINE_SCRIPT)];
  const themeMatches = inline(text).filter((match) => match[1] === source);
  const markup = text.replace(/<!--[\s\S]*?-->/g, '');
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(markup)?.[1] ?? '';
  const themeInHead = inline(head).filter((match) => match[1] === source);
  if (themeMatches.length !== 1 || themeInHead.length !== 1) {
    problems.push(
      `site/${name}: needs exactly one inline <script> in <head> whose text is site/theme.js`,
    );
  }
  // Every bare inline script gets the dynamic-code and network-API checks. One that is not the theme source
  // is refused below as unapproved as well.
  for (const match of inline(text)) problems.push(...scriptProblems(name, match[1] ?? '', true));
  if (source !== null) checked = checked.replaceAll(`<script>${source}</script>`, '');
  if (checked.includes('/theme.js')) {
    problems.push(`site/${name}: references /theme.js: the bootstrap is inline, not a file`);
  }

  if (FEEDBACK_PAGES.includes(name)) {
    // Alongside the inline theme bootstrap, only the two exact feedback tags are allowed.
    const own = text.match(OWN_SCRIPT_TAG)?.length ?? 0;
    const turnstile = text.match(TURNSTILE_SCRIPT_TAG)?.length ?? 0;
    const tags = text.match(/<script\b/gi)?.length ?? 0;
    if (own !== 1)
      problems.push(`site/${name}: needs exactly one <script src="/feedback/feedback.js" defer>`);
    if (turnstile !== 1) {
      problems.push(`site/${name}: needs exactly one Turnstile <script ... async defer>`);
    }
    if (tags !== 2 + themeMatches.length) {
      problems.push(`site/${name}: has ${String(tags)} <script> elements, exactly 3 are allowed`);
    }
    checked = checked.replace(OWN_SCRIPT_TAG, '').replace(TURNSTILE_SCRIPT_TAG, '');

    // Exactly one sitekey, shaped like a production key: a test key in production fails closed (a
    // production secret rejects its tokens) and would silently break the page.
    const attributes = text.match(/data-sitekey/gi)?.length ?? 0;
    const keys = [...text.matchAll(/\bdata-sitekey\s*=\s*"([^"]*)"/gi)].map((match) => match[1]);
    if (attributes !== 1 || keys.length !== 1) {
      problems.push(
        `site/${name}: needs exactly one data-sitekey="..." (found ${String(attributes)})`,
      );
    } else if (!PRODUCTION_SITEKEY.test(keys[0] ?? '')) {
      problems.push(`site/${name}: data-sitekey is not shaped like a production key (0x...)`);
    }
  } else if ((text.match(/<script\b/gi)?.length ?? 0) !== themeMatches.length) {
    problems.push(`site/${name}: only the exact theme script is allowed`);
  }

  if (TURNSTILE_LINK_PAGES.includes(name)) {
    checked = checked.replace(TURNSTILE_LINK_TAG, '<a>');
  }
  checked = withoutAllowedAddresses(checked);

  for (const { pattern, why } of FORBIDDEN) {
    if (pattern.test(checked)) problems.push(`site/${name}: ${why}`);
  }
  for (const why of normalisedProblems(checked)) problems.push(`site/${name}: ${why}`);

  // The other half of "plain HTML with inline CSS": a page declares its language, scales on a phone, has a
  // title and carries its own styles.
  const lang = /<html\b[^>]*\slang=["']([^"']*)["']/i.exec(text)?.[1]?.toLowerCase();
  if (lang === undefined || !LANGUAGES.includes(lang)) {
    problems.push(`site/${name}: no <html lang="${LANGUAGES.join('|')}">`);
  } else if (lang !== languageOf(name)) {
    problems.push(`site/${name}: <html lang="${lang}"> but the page is in ${languageOf(name)}`);
  }
  if (!/<meta[^>]+name=["']viewport["']/i.test(text)) {
    problems.push(`site/${name}: no viewport meta`);
  }
  if (!/<title>[^<]+<\/title>/i.test(text)) problems.push(`site/${name}: no <title>`);
  if (!/<style>/i.test(text)) problems.push(`site/${name}: no inline <style>`);
  return problems;
}

/** A URL that starts with a scheme (`https:`, `mailto:`): not a same-origin link. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Where a same-origin `href` on page `name` points, as a path relative to the site root, or null when the link
 * is not a same-origin link to check (empty, a `#fragment` only, a scheme, protocol-relative). A path that
 * ends in `/` or has no last segment means that directory's `index.html`; a path that climbs above the root
 * resolves to `../…`, which no file matches.
 * @param {string} name the page the link is on, relative to the site root
 * @param {string} href
 * @returns {string | null}
 */
function linkTarget(name, href) {
  const url = href.trim();
  if (url === '' || url.startsWith('#') || url.startsWith('//') || HAS_SCHEME.test(url))
    return null;
  const path = url.split(/[?#]/, 1)[0] ?? '';
  if (path === '') return null;
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch {
    // keep the raw path: it will not match a file, and is reported
  }
  // Relative to the site root, so a climb above it stays visible as a leading `../`.
  const joined = path.startsWith('/')
    ? decoded.replace(/^\/+/, '')
    : posix.join(posix.dirname(name), decoded);
  const target = posix.normalize(joined === '' ? '.' : joined);
  return decoded.endsWith('/') || target === '.' ? posix.join(target, 'index.html') : target;
}

/**
 * Checks that every same-origin `href` on a page reaches a file of the site: a page, or an image or the script.
 * A directory path (`/privacy`, `/privacy/`) reaches its `index.html`; `#fragment` and `?query` are ignored.
 * External links are governed by `pageProblems`. Offline: `files` is the set of site paths.
 * @param {string} name the page, relative to the site root
 * @param {string} text
 * @param {ReadonlySet<string>} files every file in the site, relative to its root
 * @returns {string[]}
 */
export function linkProblems(name, text, files) {
  const problems = [];
  const seen = new Set();
  for (const [, , attributes] of text.matchAll(START_TAG)) {
    const href = attributeValue(attributes ?? '', 'href');
    if (href === null) continue;
    const target = linkTarget(name, href);
    if (target === null || seen.has(href)) continue;
    seen.add(href);
    const bare =
      target.endsWith('/index.html') || files.has(target) ? target : `${target}/index.html`;
    if (!files.has(bare)) problems.push(`site/${name}: link to ${href} reaches no page or file`);
  }
  return problems;
}

/**
 * The rules for an SVG, which is served as an image but is a document: it may not script, embed or load
 * anything, and may refer only to its own `#fragments` (gradients, `<use>`, clip paths).
 * @param {string} name
 * @param {string} text
 * @returns {string[]}
 */
function svgProblems(name, text) {
  const problems = [];
  const rules = [
    [/<(?:[\w.-]+:)?script\b/i, 'has a <script> element'],
    [/[\s"'/]on[a-z]+\s*=/i, 'has an on*= event attribute'],
    [/<(?:[\w.-]+:)?foreignObject\b/i, 'has a <foreignObject>'],
    [/@import/i, 'imports a stylesheet (@import)'],
    [/image-set\s*\(/i, 'uses image-set()'],
    [/attributeName\s*=\s*["']?(?:xlink:)?href/i, 'animates an href'],
    // Escapes can spell `url(` or `href` without writing it, so the text has none.
    [/&#|\\/, 'has a character reference or a CSS escape'],
    [/<!ENTITY|<!DOCTYPE[^>]*\[/i, 'declares an entity'],
  ];
  for (const [pattern, why] of rules) {
    if (pattern.test(text)) problems.push(`site/${name}: ${why}: an SVG may not script or embed`);
  }
  for (const match of text.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]*))/gi)) {
    if (!(match[1] ?? match[2] ?? match[3] ?? '').trim().startsWith('#')) {
      problems.push(`site/${name}: has an href that is not a #fragment`);
      break;
    }
  }
  for (const match of text.matchAll(/url\(\s*(["']?)\s*([^)]*)\)?/gi)) {
    if (!(match[2] ?? '').startsWith('#')) {
      problems.push(`site/${name}: has a url() that is not a #fragment`);
      break;
    }
  }
  return problems;
}

/** The first bytes of each binary image type, to catch a file that only wears the extension. */
const MAGIC = {
  '.png': (bytes) =>
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b),
  '.webp': (bytes) =>
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP',
  '.ico': (bytes) => bytes.length >= 6 && [0, 0, 1, 0].every((b, i) => bytes[i] === b),
};

/**
 * Checks a binary image (`.png`, `.webp`, `.ico`) by its first bytes. Nothing else can be read from it.
 * @param {string} name
 * @param {Uint8Array} bytes
 * @returns {string[]}
 */
export function binaryProblems(name, bytes) {
  const extension = extensionOf(name);
  const matches = MAGIC[extension];
  if (!matches) return [`site/${name}: not a binary image type`];
  return matches(Buffer.from(bytes)) ? [] : [`site/${name}: is not a real ${extension} file`];
}

/** The lower-case extension of a path, with its dot, or the empty string. */
function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  return dot > name.lastIndexOf('/') ? name.slice(dot) : '';
}

/**
 * Checks a file that is not a page. Allowed: an SVG (see `svgProblems`); a `.png`, `.webp` or `.ico`, which
 * `binaryProblems` checks from its bytes; `img/OFL.txt`, the licence text (that exact name only); and
 * `feedback/feedback.js`, which may reach nothing but the relative `/api/feedback`: no address, no dynamic
 * code, no test key but the always-pass sitekey. Any other type is refused.
 * @param {string} name
 * @param {string} text
 * @returns {string[]}
 */
export function assetProblems(name, text) {
  if (name === LICENCE_FILE) return [];
  if (name !== FEEDBACK_SCRIPT) {
    if (IMAGE_TYPES.includes(extensionOf(name))) {
      return extensionOf(name) === '.svg' ? svgProblems(name, text) : [];
    }
    return [`site/${name}: only HTML is served, this file is not a page`];
  }
  return scriptProblems(name, text, false);
}

/** Shared source checks for the narrowly approved scripts: `feedback.js` and the inline theme bootstrap. */
function scriptProblems(name, text, theme) {
  const problems = [];
  const rules = [
    [/https?:\/\//i, 'names an http(s) address: it posts to the relative /api/feedback only'],
    [/["'`]\/\/[^\s"'`]/, 'has a protocol-relative address'],
    [/\beval\b/, 'uses eval'],
    [/\bnew\s+Function\b/, 'uses new Function'],
    [/\bimport\s*\(/, 'uses a dynamic import()'],
  ];
  if (theme) {
    rules.push([
      /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/,
      'references a network API',
    ]);
  }
  for (const [pattern, why] of rules) {
    if (pattern.test(text)) problems.push(`site/${name}: ${why}`);
  }
  // Cloudflare's published test keys are not credentials, but only the always-pass sitekey belongs here,
  // once. Any other key-shaped string (a secret, a second key) fails.
  const keys = text.match(TEST_KEY_SHAPE) ?? [];
  if (keys.length > 1 || keys.some((key) => key !== ALLOWED_TEST_KEY)) {
    problems.push(
      `site/${name}: may carry only the always-pass test sitekey ${ALLOWED_TEST_KEY}, once`,
    );
  }
  return problems;
}

/**
 * Every language that has a directory (or pages) must offer the same `.html` paths as Spanish.
 * @param {string[]} pages `.html` paths relative to the site root
 * @param {readonly string[]} [present] the languages to compare; by default those that have a page
 * @returns {string[]}
 */
export function parityProblems(pages, present) {
  const owner = (page) =>
    LANGUAGES.find((language) => language !== 'es' && page.startsWith(`${language}/`)) ?? 'es';
  /** @type {Map<string, Set<string>>} */
  const byLanguage = new Map(LANGUAGES.map((language) => [language, new Set()]));
  for (const page of pages) {
    const language = owner(page);
    byLanguage.get(language)?.add(page.slice(languagePrefix(language).length));
  }
  const spanish = byLanguage.get('es') ?? new Set();
  const problems = [];
  const compared = present ?? LANGUAGES.filter((language) => byLanguage.get(language)?.size);
  for (const language of compared) {
    if (language === 'es') continue;
    const own = byLanguage.get(language) ?? new Set();
    const prefix = languagePrefix(language);
    for (const page of [...spanish].sort()) {
      if (!own.has(page)) problems.push(`site/${prefix}${page}: missing, es has ${page}`);
    }
    for (const page of [...own].sort()) {
      if (!spanish.has(page)) problems.push(`site/${prefix}${page}: es has no ${page}`);
    }
  }
  return problems;
}

/**
 * Checks the site directory and returns every problem. `siteDir` is injectable for tests.
 * @param {string} [siteDir]
 * @returns {string[]}
 */
export function siteProblems(siteDir = SITE_DIR) {
  const problems = [];
  for (const page of REQUIRED_PAGES) {
    if (!existsSync(join(siteDir, page))) problems.push(`site/${page}: missing`);
  }

  const files = existsSync(siteDir) ? filesIn(siteDir) : [];
  if (files.length === 0) problems.push('site/: no files');

  const pages = [];
  const names = new Set(files.map((file) => relative(siteDir, file).split(sep).join('/')));
  for (const file of files) {
    const name = relative(siteDir, file).split(sep).join('/');
    if (name.endsWith('.html')) {
      pages.push(name);
      const text = readFileSync(file, 'utf8');
      problems.push(...pageProblems(name, text), ...linkProblems(name, text, names));
    } else if (MAGIC[extensionOf(name)]) {
      problems.push(...binaryProblems(name, readFileSync(file)));
    } else {
      problems.push(...assetProblems(name, readFileSync(file, 'utf8')));
    }
  }
  // The Nunito licence travels with the outlined wordmarks (brand/README.md).
  if (OUTLINED_LOGOS.some((logo) => names.has(logo)) && !names.has(LICENCE_FILE)) {
    problems.push(`site/${LICENCE_FILE}: missing, the outlined logos ship with the Nunito licence`);
  }
  const present = LANGUAGES.filter(
    (language) => language !== 'es' && existsSync(join(siteDir, language)),
  );
  problems.push(...parityProblems(pages, present));
  return problems;
}

if (resolve(process.argv[1] ?? '') === SCRIPT_PATH) {
  const problems = siteProblems();
  if (problems.length > 0) {
    console.error(`Privacy site check failed: ${String(problems.length)} problem(s)`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(
    `Privacy site check passed: ${String(REQUIRED_PAGES.length)} pages (${REQUIRED_PAGES.join(', ')}), every internal link resolves, only approved scripts and static images, no other external references.`,
  );
}
