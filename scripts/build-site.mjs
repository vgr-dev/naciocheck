#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChangelog, renderChangelog } from './changelog.mjs';
import { LANGUAGES } from './check-site.mjs';
import { writeSiteAssets } from './site-assets.mjs';

/**
 * Builds the deployable site: copies the hand-written pages from `site/` (everything but `_build/`) into
 * `.output/site/`, expands the build markers in every page, and writes the generated files (`writeSiteAssets`).
 * It makes no network request. `_build/` holds the inputs: `config.json`, `strings.json` and `partials/`.
 *
 * Markers are HTML comments in a source page, each replaced by the build; an unknown one fails the build:
 *
 * - `<!-- @head -->`: favicon links, canonical, `hreflang` alternates, Open Graph and Twitter tags, `og:locale`,
 *   author and `rel="me"`. The title and description come from the page's own `<title>` and
 *   `<meta name="description">`. A `404.html` gets the icons, author and `rel="me"` only: it has no address.
 * - `<!-- @style -->` / `<!-- @style landing -->`: an inline `<style>` with `partials/base.css`, plus
 *   `partials/landing.css` for the second form.
 * - `<!-- @header -->`: the logo (light and dark) linking to the language's home, and the language switcher.
 * - `<!-- @footer -->`: `partials/footer.<lang>.html`.
 * - `<!-- @install -->`: the Chrome and Firefox buttons, or a "coming soon" label where the URL is null.
 * - `<!-- @changelog -->`: the releases of `CHANGELOG.md`, rendered in the page's language.
 * - `<!-- @if repository -->` ... `<!-- @endif -->`: kept only when `repositoryPublic` is true. Blocks do not
 *   nest, and may appear in the partials too.
 */

const ROOT = resolve(import.meta.dirname, '..');
export const SOURCE_DIR = join(ROOT, 'site');
export const OUT_DIR = join(ROOT, '.output', 'site');
const CHANGELOG_FILE = join(ROOT, 'CHANGELOG.md');

/** The site's own origin: used in metadata only, never loaded. */
export const SITE_ORIGIN = 'https://naciocheck.vgr.cat';
const REL_ME_URL = 'https://vgr.cat/';
const AUTHOR = 'Victor Gonzalez';
const SOCIAL_CARD = `${SITE_ORIGIN}/social-card.png`;
const LOGO_SIZE = { width: 260, height: 64 };

const STORE_PREFIXES = {
  chromeStoreUrl: 'https://chromewebstore.google.com/',
  firefoxStoreUrl: 'https://addons.mozilla.org/',
};

const OG_LOCALES = { es: 'es_ES', en: 'en_GB', ca: 'ca_ES' };

/** The markers a page may carry. `@if` and `@endif` are handled apart from the insertions. */
export const MARKERS = ['head', 'style', 'header', 'footer', 'install', 'changelog', 'if', 'endif'];
const INSERTIONS = MARKERS.filter((name) => name !== 'if' && name !== 'endif');
const MARKER = /<!--\s*@([\s\S]*?)-->/g;

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** An attribute value taken from the page's own source: its entities are already written, only quotes need care. */
const attributeText = (text) => text.replace(/"/g, '&quot;');

const posix = (path) => path.split(sep).join('/');

/** @returns {import('./build-site.d.mts').SiteConfig} */
function validateConfig(config, where) {
  if (typeof config !== 'object' || config === null) throw new Error(`${where}: not an object`);
  for (const [key, prefix] of Object.entries(STORE_PREFIXES)) {
    const value = config[key];
    if (value === null) continue;
    if (typeof value !== 'string' || !value.startsWith(prefix)) {
      throw new Error(`${where}: ${key} must be null or start with ${prefix}`);
    }
  }
  if (typeof config.repositoryPublic !== 'boolean') {
    throw new Error(`${where}: repositoryPublic must be true or false`);
  }
  return config;
}

/**
 * Reads and checks `<sourceDir>/_build/config.json`.
 * @param {string} sourceDir
 * @returns {Promise<import('./build-site.d.mts').SiteConfig>}
 */
export async function loadConfig(sourceDir) {
  const file = join(sourceDir, '_build', 'config.json');
  return validateConfig(JSON.parse(await readFile(file, 'utf8')), file);
}

async function loadStrings(sourceDir) {
  const file = join(sourceDir, '_build', 'strings.json');
  const strings = JSON.parse(await readFile(file, 'utf8'));
  for (const language of LANGUAGES) {
    const own = strings[language];
    const missing = [
      'comingSoon',
      'installChrome',
      'installFirefox',
      'homeLabel',
      'logoAlt',
      'languageLabel',
    ].filter((key) => typeof own?.[key] !== 'string');
    for (const key of ['noReleases', 'githubRelease', 'englishNote']) {
      if (typeof own?.changelog?.[key] !== 'string') missing.push(`changelog.${key}`);
    }
    for (const target of LANGUAGES) {
      if (typeof own?.languageNames?.[target] !== 'string') missing.push(`languageNames.${target}`);
    }
    if (missing.length > 0) throw new Error(`${file}: ${language} lacks ${missing.join(', ')}`);
  }
  return strings;
}

/** The language of a page and its path below the language root: `en/privacy/index.html` is `en` and `privacy/index.html`. */
function splitPage(page) {
  for (const language of LANGUAGES) {
    if (language !== 'es' && page.startsWith(`${language}/`)) {
      return { language, subpath: page.slice(language.length + 1) };
    }
  }
  return { language: 'es', subpath: page };
}

/** The URL path of a page: `index.html` is the directory, `privacy/index.html` is `/privacy/`, `404.html` stays. */
function urlPath(language, subpath) {
  const prefix = language === 'es' ? '/' : `/${language}/`;
  if (subpath === 'index.html') return prefix;
  if (subpath.endsWith('/index.html')) return `${prefix}${subpath.slice(0, -'index.html'.length)}`;
  return `${prefix}${subpath}`;
}

function head(page, text) {
  const { language, subpath } = splitPage(page);
  const lines = [
    '<link rel="icon" href="/favicon.ico" sizes="32x32" />',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    `<meta name="author" content="${AUTHOR}" />`,
    `<link rel="me" href="${REL_ME_URL}" />`,
  ];
  if (subpath === '404.html') return lines.join('\n    ');

  const title = /<title>([^<]*)<\/title>/i.exec(text)?.[1]?.trim();
  const description = /<meta\s+name=["']description["']\s+content="([^"]*)"/i.exec(text)?.[1];
  if (!title) throw new Error(`site/${page}: @head needs a <title>`);
  if (description === undefined) {
    throw new Error(`site/${page}: @head needs a <meta name="description" content="...">`);
  }

  const canonical = `${SITE_ORIGIN}${urlPath(language, subpath)}`;
  lines.push(`<link rel="canonical" href="${canonical}" />`);
  for (const alternate of LANGUAGES) {
    const href = `${SITE_ORIGIN}${urlPath(alternate, subpath)}`;
    lines.push(`<link rel="alternate" hreflang="${alternate}" href="${href}" />`);
  }
  lines.push(
    `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${urlPath('es', subpath)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="NacioCheck" />',
    `<meta property="og:title" content="${attributeText(title)}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${SOCIAL_CARD}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:locale" content="${OG_LOCALES[language]}" />`,
    ...LANGUAGES.filter((other) => other !== language).map(
      (other) => `<meta property="og:locale:alternate" content="${OG_LOCALES[other]}" />`,
    ),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${attributeText(title)}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${SOCIAL_CARD}" />`,
  );
  return lines.join('\n    ');
}

function header(page, strings) {
  const { language, subpath } = splitPage(page);
  const own = strings[language];
  const home = urlPath(language, 'index.html');
  // A 404 has no counterpart in the other languages worth linking: each switches to that language's home.
  const target = subpath === '404.html' ? 'index.html' : subpath;
  const links = LANGUAGES.map((other) => {
    const current = other === language ? ' aria-current="page"' : '';
    const href = urlPath(other, target);
    return `<a href="${href}" hreflang="${other}" lang="${other}"${current}>${escapeHtml(own.languageNames[other])}</a>`;
  });
  const size = `width="${String(LOGO_SIZE.width)}" height="${String(LOGO_SIZE.height)}"`;
  return [
    '<header class="site-header">',
    `  <a class="site-logo" href="${home}" aria-label="${escapeHtml(own.homeLabel)}">`,
    '    <picture>',
    '      <source srcset="/img/logo-dark.svg" media="(prefers-color-scheme: dark)" />',
    `      <img src="/img/logo-light.svg" alt="${escapeHtml(own.logoAlt)}" ${size} />`,
    '    </picture>',
    '  </a>',
    `  <nav class="lang-switch" aria-label="${escapeHtml(own.languageLabel)}">`,
    ...links.map((link) => `    ${link}`),
    '  </nav>',
    '</header>',
  ].join('\n    ');
}

function install(language, strings, config) {
  const own = strings[language];
  const button = (url, label, name) =>
    url === null
      ? `<span class="install is-soon"><span class="install-name">${escapeHtml(label)}</span> <span class="install-note">${escapeHtml(own.comingSoon)}</span></span>`
      : `<a class="install install-${name}" href="${escapeHtml(url)}"><span class="install-name">${escapeHtml(label)}</span></a>`;
  return [
    '<div class="install-buttons">',
    `  ${button(config.chromeStoreUrl, own.installChrome, 'chrome')}`,
    `  ${button(config.firefoxStoreUrl, own.installFirefox, 'firefox')}`,
    '</div>',
  ].join('\n    ');
}

/**
 * @param {import('./build-site.d.mts').BuildOptions} options
 * @returns {Promise<import('./build-site.d.mts').BuildResult>}
 */
export async function buildSite(options) {
  const sourceDir = resolve(options.sourceDir);
  const outDir = resolve(options.outDir);
  if (sourceDir === outDir || sourceDir.startsWith(`${outDir}${sep}`)) {
    throw new Error(`The output directory ${outDir} would wipe the sources in ${sourceDir}`);
  }
  const config = options.config
    ? validateConfig(options.config, 'config')
    : await loadConfig(sourceDir);
  const strings = await loadStrings(sourceDir);
  const changelogText =
    options.changelog ?? (existsSync(CHANGELOG_FILE) ? await readFile(CHANGELOG_FILE, 'utf8') : '');
  const releases = parseChangelog(changelogText);

  const partials = new Map();
  const partial = async (name) => {
    if (!partials.has(name)) {
      const file = join(sourceDir, '_build', 'partials', name);
      if (!existsSync(file)) throw new Error(`site/_build/partials/${name}: missing`);
      partials.set(name, (await readFile(file, 'utf8')).trim());
    }
    return partials.get(name);
  };

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const buildDir = join(sourceDir, '_build');
  await cp(sourceDir, outDir, { recursive: true, filter: (path) => path !== buildDir });

  const pages = (await readdir(outDir, { recursive: true }))
    .map(posix)
    .filter((file) => file.endsWith('.html'))
    .sort();

  for (const page of pages) {
    const file = join(outDir, page);
    const { language } = splitPage(page);
    let text = await readFile(file, 'utf8');

    // Pass 1: the insertions. A partial may carry `@if` blocks and nothing else.
    const replacements = [];
    for (const match of text.matchAll(MARKER)) {
      const [name = '', ...args] = (match[1] ?? '').trim().split(/\s+/);
      if (!INSERTIONS.includes(name) && name !== 'if' && name !== 'endif') {
        throw new Error(`site/${page}: unknown marker <!-- @${(match[1] ?? '').trim()} -->`);
      }
      if (name === 'if' || name === 'endif') continue;
      let value;
      if (name === 'style') {
        const form = args.join(' ');
        if (form !== '' && form !== 'landing') {
          throw new Error(`site/${page}: unknown marker <!-- @style ${form} -->`);
        }
        const css = [
          await partial('base.css'),
          ...(form === 'landing' ? [await partial('landing.css')] : []),
        ];
        value = `<style>\n${css.join('\n')}\n    </style>`;
      } else if (args.length > 0) {
        throw new Error(`site/${page}: <!-- @${name} --> takes no argument`);
      } else if (name === 'head') value = head(page, text);
      else if (name === 'header') value = header(page, strings);
      else if (name === 'footer') value = await partial(`footer.${language}.html`);
      else if (name === 'install') value = install(language, strings, config);
      else {
        const own = strings[language].changelog;
        // The changelog is written in English: only the other languages are told so.
        const note =
          language === 'en' ? '' : `<p class="changelog-note">${escapeHtml(own.englishNote)}</p>\n`;
        value = `${note}${renderChangelog(releases, {
          lang: language,
          strings: { noReleases: own.noReleases, githubRelease: own.githubRelease },
          repositoryPublic: config.repositoryPublic,
        })}`;
      }
      replacements.push({ at: match.index, length: match[0].length, value });
    }
    for (const { at, length, value } of replacements.reverse()) {
      text = text.slice(0, at) + value + text.slice(at + length);
    }

    // Pass 2: `@if repository` blocks, in the page and in what the partials brought.
    let output = '';
    let last = 0;
    let open = null;
    for (const match of text.matchAll(MARKER)) {
      const body = (match[1] ?? '').trim();
      if (!/^(?:if|endif)(?:\s|$)/.test(body)) {
        throw new Error(`site/${page}: marker <!-- @${body} --> is not allowed here`);
      }
      const [name = '', ...args] = body.split(/\s+/);
      if (name === 'if') {
        if (args.join(' ') !== 'repository') {
          throw new Error(`site/${page}: unknown condition <!-- @${body} -->`);
        }
        if (open !== null) throw new Error(`site/${page}: <!-- @if --> blocks do not nest`);
        output += text.slice(last, match.index);
        open = match.index + match[0].length;
      } else {
        if (args.length > 0) throw new Error(`site/${page}: <!-- @endif --> takes no argument`);
        if (open === null) throw new Error(`site/${page}: <!-- @endif --> without <!-- @if -->`);
        if (config.repositoryPublic) output += text.slice(open, match.index);
        open = null;
      }
      last = match.index + match[0].length;
    }
    if (open !== null) throw new Error(`site/${page}: <!-- @if --> without <!-- @endif -->`);
    output += text.slice(last);
    await writeFile(file, output);
  }

  const assets = options.writeAssets === false ? [] : await writeSiteAssets(outDir);
  return { pages, assets };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildSite({ sourceDir: SOURCE_DIR, outDir: OUT_DIR });
    console.log(
      `Site built into ${relative(ROOT, OUT_DIR)}: ${String(result.pages.length)} pages, ${String(result.assets.length)} generated files.`,
    );
  } catch (error) {
    console.error(`Site build failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
