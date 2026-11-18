#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The privacy site's gate: the pages state that nothing is loaded from anywhere, so the files have to prove it.
 *
 * Every rule below is a thing the pages must not contain. The last one is the catch-all: a page may not mention
 * any `http://` or `https://` address at all, not even as a link, because the site links to nothing outside
 * itself — the one host it would ever name is written as plain text (`sede.mjusticia.gob.es`).
 */

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SITE_DIR = resolve(import.meta.dirname, '../site');

/** The pages the Worker has to serve: `/`, `/privacy/`, `/en/` and `/en/privacy/`. */
export const REQUIRED_PAGES = [
  'index.html',
  'privacy/index.html',
  'en/index.html',
  'en/privacy/index.html',
];

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
  for (const { pattern, why } of FORBIDDEN) {
    if (pattern.test(text)) problems.push(`site/${name}: ${why}`);
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
    const name = relative(siteDir, file);
    const text = readFileSync(file, 'utf8');
    if (!name.endsWith('.html')) {
      problems.push(`site/${name}: only HTML is served, this file is not a page`);
      continue;
    }
    problems.push(...pageProblems(name, text));
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
    `Privacy site check passed: ${String(REQUIRED_PAGES.length)} pages (${REQUIRED_PAGES.join(', ')}), no scripts, no external references.`,
  );
}
