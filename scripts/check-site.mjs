#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The site's gate: the pages state that nothing is loaded from anywhere, so the files have to prove it.
 *
 * Every rule below is a thing the pages must not contain. The last one is the catch-all: a page may not mention
 * any `http://` or `https://` address at all, except in the exceptions below. The one host the site names
 * without linking it is written as plain text (`sede.mjusticia.gob.es`).
 *
 * Exceptions, each matched exactly:
 * - the feedback pages (`FEEDBACK_PAGES`) carry two scripts, the site's own `feedback.js` and Cloudflare's
 *   Turnstile; those pages and the privacy pages (`TURNSTILE_LINK_PAGES`) may link Turnstile's privacy addendum;
 * - any page may carry an outbound `<a href>` that starts with one of `OUTBOUND_LINKS`, and the site's own
 *   origin in `<link rel="canonical|alternate">` and `og:`/`twitter:` `<meta content>`, and `https://vgr.cat/`
 *   in `<link rel="me">`. Nothing absolute is ever allowed in `src`, `srcset`, `poster`, `data`, `action`,
 *   CSS `url()` or `@import`;
 * - the files served besides pages are `feedback/feedback.js` and images (`.png`, `.webp`, `.svg`, `.ico`);
 *   an SVG may not script, embed or reach anything outside itself.
 *
 * Languages: `LANGUAGES`. Spanish lives at the root, the others in their own directory, and every language
 * that exists must have the same set of pages as Spanish.
 */

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SITE_DIR = resolve(import.meta.dirname, '../.output/site');

/** The site's languages. Spanish is served at `/`, the others at `/<lang>/`. */
export const LANGUAGES = ['es', 'en', 'ca'];

/** The path prefix of a language's pages: none for Spanish, `en/` and `ca/` for the others. */
const languagePrefix = (language) => (language === 'es' ? '' : `${language}/`);

/** The pages that post a report: the only ones that may carry scripts. */
const FEEDBACK_PAGES = LANGUAGES.map(
  (language) => `${languagePrefix(language)}feedback/index.html`,
);

/**
 * The pages the Worker has to serve: `/`, `/privacy/`, `/feedback/` and their `/en/` twins.
 */
export const REQUIRED_PAGES = [
  'index.html',
  'privacy/index.html',
  'feedback/index.html',
  'en/index.html',
  'en/privacy/index.html',
  'en/feedback/index.html',
];

/** The pages that may link Cloudflare's Turnstile Privacy Addendum (checked 2026-11-23). */
const TURNSTILE_LINK_PAGES = [
  ...FEEDBACK_PAGES,
  ...LANGUAGES.map((language) => `${languagePrefix(language)}privacy/index.html`),
];

/** The one script file served. */
const FEEDBACK_SCRIPT = 'feedback/feedback.js';

/** The image types served besides pages. */
const IMAGE_TYPES = ['.png', '.webp', '.svg', '.ico'];

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
const TURNSTILE_SCRIPT_TAG =
  /<script\s+src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js"\s+async\s+defer\s*><\/script>/gi;
const TURNSTILE_LINK_TAG =
  /<a\s+href="https:\/\/www\.cloudflare\.com\/turnstile-privacy-policy\/"\s*>/gi;

const FORBIDDEN = [
  { pattern: /<script\b/i, why: 'has a <script> element: the site carries no JavaScript' },
  { pattern: /<link\b[^>]*rel=["']?stylesheet/i, why: 'links a stylesheet: the CSS is inline' },
  { pattern: /@import/i, why: 'imports a stylesheet from CSS (@import)' },
  { pattern: /url\(\s*['"]?\s*(?:https?:)?\/\//i, why: 'loads a remote url() from CSS' },
  { pattern: /<iframe\b/i, why: 'has an <iframe>' },
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

/** Replaces each quoted `attribute` value `accepts` approves with `"#"`, so the catch-all no longer sees it. */
function neutralise(tag, attribute, accepts) {
  const pattern = new RegExp(`(\\s${attribute}\\s*=\\s*)(?:"([^"]*)"|'([^']*)')`, 'gi');
  return tag.replace(pattern, (whole, lead, double, single) =>
    accepts(double ?? single ?? '') ? `${lead}"#"` : whole,
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

/**
 * Checks one page's text without touching the filesystem, so the rules can be tested offline.
 * @param {string} name
 * @param {string} text
 * @returns {string[]}
 */
export function pageProblems(name, text) {
  const problems = [];
  let checked = text;

  if (FEEDBACK_PAGES.includes(name)) {
    // Exactly the two scripts and nothing else with a <script> tag: an inline script, a third script or a
    // variant of either URL leaves a tag behind and is caught below.
    const own = text.match(OWN_SCRIPT_TAG)?.length ?? 0;
    const turnstile = text.match(TURNSTILE_SCRIPT_TAG)?.length ?? 0;
    const tags = text.match(/<script\b/gi)?.length ?? 0;
    if (own !== 1)
      problems.push(`site/${name}: needs exactly one <script src="/feedback/feedback.js" defer>`);
    if (turnstile !== 1) {
      problems.push(`site/${name}: needs exactly one Turnstile <script ... async defer>`);
    }
    if (tags !== 2) {
      problems.push(`site/${name}: has ${String(tags)} <script> elements, exactly 2 are allowed`);
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
  }

  if (TURNSTILE_LINK_PAGES.includes(name)) {
    checked = checked.replace(TURNSTILE_LINK_TAG, '<a>');
  }
  checked = withoutAllowedAddresses(checked);

  for (const { pattern, why } of FORBIDDEN) {
    if (pattern.test(checked)) problems.push(`site/${name}: ${why}`);
  }

  // The other half of "plain HTML with inline CSS": a page declares its language, scales on a phone, has a
  // title and carries its own styles.
  if (!new RegExp(`<html[^>]+lang=["'](?:${LANGUAGES.join('|')})["']`, 'i').test(text)) {
    problems.push(`site/${name}: no <html lang="${LANGUAGES.join('|')}">`);
  }
  if (!/<meta[^>]+name=["']viewport["']/i.test(text)) {
    problems.push(`site/${name}: no viewport meta`);
  }
  if (!/<title>[^<]+<\/title>/i.test(text)) problems.push(`site/${name}: no <title>`);
  if (!/<style>/i.test(text)) problems.push(`site/${name}: no inline <style>`);
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
 * `binaryProblems` checks from its bytes; and `feedback/feedback.js`, which may reach nothing but the
 * relative `/api/feedback`: no address, no dynamic code, no test key but the always-pass sitekey.
 * Any other type is refused.
 * @param {string} name
 * @param {string} text
 * @returns {string[]}
 */
export function assetProblems(name, text) {
  if (name !== FEEDBACK_SCRIPT) {
    if (IMAGE_TYPES.includes(extensionOf(name))) {
      return extensionOf(name) === '.svg' ? svgProblems(name, text) : [];
    }
    return [`site/${name}: only HTML is served, this file is not a page`];
  }
  const problems = [];
  const rules = [
    [/https?:\/\//i, 'names an http(s) address: it posts to the relative /api/feedback only'],
    [/["'`]\/\/[^\s"'`]/, 'has a protocol-relative address'],
    [/\beval\b/, 'uses eval'],
    [/\bnew\s+Function\b/, 'uses new Function'],
    [/\bimport\s*\(/, 'uses a dynamic import()'],
  ];
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
  for (const file of files) {
    const name = relative(siteDir, file).split(sep).join('/');
    if (name.endsWith('.html')) {
      pages.push(name);
      problems.push(...pageProblems(name, readFileSync(file, 'utf8')));
    } else if (MAGIC[extensionOf(name)]) {
      problems.push(...binaryProblems(name, readFileSync(file)));
    } else {
      problems.push(...assetProblems(name, readFileSync(file, 'utf8')));
    }
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
    `Privacy site check passed: ${String(REQUIRED_PAGES.length)} pages (${REQUIRED_PAGES.join(', ')}), scripts only on the feedback pages, no other external references.`,
  );
}
