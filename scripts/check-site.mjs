#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The privacy site's gate: the pages state that nothing is loaded from anywhere, so the files have to prove it.
 *
 * Every rule below is a thing the pages must not contain. The last one is the catch-all: a page may not mention
 * any `http://` or `https://` address at all, not even as a link, because the site links to nothing outside
 * itself — the one host it would ever name is written as plain text (`sede.mjusticia.gob.es`).
 *
 * Exceptions, each scoped to named pages and matched exactly (see `FEEDBACK_PAGES` and
 * `TURNSTILE_LINK_PAGES`): the feedback pages carry two scripts, the site's own `feedback.js` and
 * Cloudflare's Turnstile; those pages and the privacy pages may link Turnstile's privacy addendum; and
 * `feedback/feedback.js` is the only file served that is not HTML.
 */

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SITE_DIR = resolve(import.meta.dirname, '../site');

/** The pages that post a report: the only ones that may carry scripts. */
const FEEDBACK_PAGES = ['feedback/index.html', 'en/feedback/index.html'];

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
const TURNSTILE_LINK_PAGES = [...FEEDBACK_PAGES, 'privacy/index.html', 'en/privacy/index.html'];

/** The only file under `site/` that is not HTML. */
const FEEDBACK_SCRIPT = 'feedback/feedback.js';

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

  for (const { pattern, why } of FORBIDDEN) {
    if (pattern.test(checked)) problems.push(`site/${name}: ${why}`);
  }

  // The other half of "plain HTML with inline CSS": a page declares its language, scales on a phone, has a
  // title and carries its own styles.
  if (!/<html[^>]+lang=["'](?:es|en)["']/i.test(text)) {
    problems.push(`site/${name}: no <html lang="es|en">`);
  }
  if (!/<meta[^>]+name=["']viewport["']/i.test(text)) {
    problems.push(`site/${name}: no viewport meta`);
  }
  if (!/<title>[^<]+<\/title>/i.test(text)) problems.push(`site/${name}: no <title>`);
  if (!/<style>/i.test(text)) problems.push(`site/${name}: no inline <style>`);
  return problems;
}

/**
 * Checks a file that is not a page. Only `feedback/feedback.js` is allowed, and it may reach nothing but
 * the relative `/api/feedback`: no address, no dynamic code, no test key but the always-pass sitekey.
 * @param {string} name
 * @param {string} text
 * @returns {string[]}
 */
export function assetProblems(name, text) {
  if (name !== FEEDBACK_SCRIPT) {
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

  for (const file of files) {
    const name = relative(siteDir, file).split(sep).join('/');
    const text = readFileSync(file, 'utf8');
    problems.push(
      ...(name.endsWith('.html') ? pageProblems(name, text) : assetProblems(name, text)),
    );
  }
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
