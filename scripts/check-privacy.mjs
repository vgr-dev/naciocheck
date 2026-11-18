#!/usr/bin/env node
/**
 * Machine-checks the hard boundary "no tracking, no network" over the built extension.
 *
 * Fails when a built manifest asks for more than the agreed permissions/hosts, when built code
 * contains a network API or `storage.sync`, when a stylesheet or SVG loads something remotely, or when
 * it mentions a URL that is not in `scripts/allowed-urls.json`. It also checks that every build carries
 * the canonical `LICENSE` and `THIRD-PARTY-NOTICES.txt` at its root.
 *
 * Usage: build first (`npm run build:chrome && npm run build:firefox`), then `npm run check:privacy`.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(SCRIPT_PATH));
const OUTPUT_DIR = join(ROOT, '.output');
const ALLOWED_URLS_FILE = join(ROOT, 'scripts', 'allowed-urls.json');

/** Exactly what the extension is allowed to ask for. Anything else fails the check. */
export const EXPECTED_PERMISSIONS = ['storage', 'alarms', 'notifications'];
export const EXPECTED_HOST_PERMISSIONS = ['https://sede.mjusticia.gob.es/eConsultas/*'];
export const EXPECTED_CONTENT_SCRIPT_MATCHES = ['https://sede.mjusticia.gob.es/eConsultas/*'];

/** Manifest keys that would broaden access or fetch code/resources. None may appear. */
const FORBIDDEN_MANIFEST_KEYS = [
  'web_accessible_resources',
  'externally_connectable',
  'update_url',
  'declarative_net_request',
  'sandbox',
];

/** APIs that would let code leave the device, plus the storage area that syncs to the vendor. */
const FORBIDDEN_APIS = [
  { label: 'fetch(', re: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { label: 'sendBeacon', re: /\bsendBeacon\b/ },
  { label: 'WebSocket', re: /\bWebSocket\b/ },
  { label: 'EventSource', re: /\bEventSource\b/ },
  { label: 'WebTransport', re: /\bWebTransport\b/ },
  { label: 'RTCPeerConnection', re: /\bRTCPeerConnection\b/ },
  { label: 'serviceWorker.register', re: /\bserviceWorker\s*\.\s*register\b/ },
  { label: 'importScripts(', re: /\bimportScripts\s*\(/ },
  { label: 'SharedWorker', re: /\bSharedWorker\b/ },
  { label: 'new Worker', re: /\bnew\s+Worker\b/ },
  { label: 'eval(', re: /\beval\s*\(/ },
  { label: 'new Function', re: /\bnew\s+Function\s*\(/ },
  { label: 'storage.sync', re: /\bstorage\s*\.\s*sync\b/ },
];

/** Absolute URLs in code, HTML and JSON. CSS/SVG use the more specific checks below. */
const ABSOLUTE_URL = /\b(?:https?|wss?|ftp):\/\/[^\s"'`<>()\\)]+/gi;

/** A quoted protocol-relative URL, e.g. `"//example.com/x"`; avoids matching line comments. */
const QUOTED_PROTOCOL_RELATIVE = /(["'`])\/\/(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?[^"'`]*\1/gi;

/** CSS can fetch a stylesheet or asset; a built bundle should contain neither. */
const CSS_IMPORT = /@import\b/i;
const CSS_REMOTE_URL = /url\(\s*['"]?\s*(?:https?:)?\/\//i;

/** HTML/SVG attributes can use a protocol-relative URL even without quotes around the value. */
const ATTRIBUTE_PROTOCOL_RELATIVE =
  /\b(?:src|srcset|poster|data|action|href|formaction|cite|xlink:href)\s*=\s*["']?\s*\/\//i;

/** SVG may embed external resources or executable content; `xmlns` is not an external reference. */
const SVG_EXTERNAL_REF = /\b(?:href|xlink:href|src)\s*=\s*["'](?:https?:)?\/\//i;
const SVG_SCRIPT = /<script\b/i;
const SVG_EVENT_HANDLER = /(?:^|\s)on[a-z]+\s*=/i;

/** Canonical files the build must place at the root of every package. */
export const PACKAGE_NOTICE_FILES = ['LICENSE', 'THIRD-PARTY-NOTICES.txt'];

/** Files whose text is scanned. Sourcemaps are build artefacts, not shipped code. */
const SCANNED_EXTENSIONS = ['.js', '.mjs', '.html', '.json', '.css', '.svg'];
const SKIPPED_EXTENSIONS = ['.map'];

const failures = [];

function fail(message) {
  failures.push(message);
}

function sorted(values) {
  return [...values].sort();
}

function firstDifference(actual, expected) {
  return {
    unexpected: sorted(actual.filter((value) => !expected.includes(value))),
    missing: sorted(expected.filter((value) => !actual.includes(value))),
  };
}

/**
 * Checks a manifest object without touching the filesystem, so the rules can be tested offline.
 * @param {Record<string, unknown>} manifest
 * @param {string} name
 * @returns {string[]}
 */
export function manifestProblems(manifest, name = 'manifest.json') {
  const problems = [];

  if (manifest.manifest_version !== 3) {
    problems.push(
      `${name} declares manifest_version ${String(manifest.manifest_version)}, expected 3`,
    );
  }

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  const permissionDiff = firstDifference(permissions, EXPECTED_PERMISSIONS);
  if (permissionDiff.unexpected.length > 0 || permissionDiff.missing.length > 0) {
    problems.push(
      `${name} permissions are [${permissions.join(', ')}]; expected exactly [${EXPECTED_PERMISSIONS.join(', ')}]${permissionDiff.unexpected.length ? ` (unexpected: ${permissionDiff.unexpected.join(', ')})` : ''}${permissionDiff.missing.length ? ` (missing: ${permissionDiff.missing.join(', ')})` : ''}`,
    );
  }

  const hosts = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  const hostDiff = firstDifference(hosts, EXPECTED_HOST_PERMISSIONS);
  if (hostDiff.unexpected.length > 0 || hostDiff.missing.length > 0) {
    problems.push(
      `${name} host_permissions are [${hosts.join(', ')}]; expected exactly [${EXPECTED_HOST_PERMISSIONS.join(', ')}]`,
    );
  }

  for (const key of [
    'optional_permissions',
    'optional_host_permissions',
    ...FORBIDDEN_MANIFEST_KEYS,
  ]) {
    if (manifest[key] !== undefined) {
      problems.push(`${name} declares ${key}; least privilege forbids it`);
    }
  }

  const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  if (contentScripts.length !== 1) {
    problems.push(
      `${name} declares ${String(contentScripts.length)} content_scripts entries; expected exactly one`,
    );
  } else {
    const matches = Array.isArray(contentScripts[0]?.matches) ? contentScripts[0].matches : [];
    const matchDiff = firstDifference(matches, EXPECTED_CONTENT_SCRIPT_MATCHES);
    if (matchDiff.unexpected.length > 0 || matchDiff.missing.length > 0) {
      problems.push(
        `${name} content_scripts matches are [${matches.join(', ')}]; expected exactly [${EXPECTED_CONTENT_SCRIPT_MATCHES.join(', ')}]`,
      );
    }
  }

  const csp = manifest.content_security_policy;
  if (csp !== undefined) {
    const serialized = JSON.stringify(csp);
    if (/\b(?:https?|wss?):\/\//i.test(serialized)) {
      problems.push(`${name} has a content_security_policy with remote sources: ${serialized}`);
    }
    if (/\b(?:unsafe-eval|wasm-unsafe-eval)\b/i.test(serialized)) {
      problems.push(
        `${name} has a content_security_policy that allows eval-like code: ${serialized}`,
      );
    }
  }

  return problems;
}

/**
 * Checks one built text file without touching the filesystem, so the rules can be tested offline.
 * @param {string} file
 * @param {string} text
 * @param {readonly string[]} allowedPrefixes
 * @returns {string[]}
 */
export function textProblems(file, text, allowedPrefixes) {
  const problems = [];
  const extension = extname(file).toLowerCase();

  if (['.js', '.mjs', '.html'].includes(extension)) {
    for (const { label, re } of FORBIDDEN_APIS) {
      if (re.test(text)) problems.push(`${file} uses ${label}, which the privacy model forbids`);
    }
  }

  if (['.css', '.html', '.svg'].includes(extension)) {
    if (CSS_IMPORT.test(text)) {
      problems.push(`${file} uses @import, which the privacy model forbids in the built bundle`);
    }
    if (CSS_REMOTE_URL.test(text)) {
      problems.push(`${file} loads a remote url() from CSS`);
    }
  }

  if (['.html', '.svg'].includes(extension) && ATTRIBUTE_PROTOCOL_RELATIVE.test(text)) {
    problems.push(`${file} has a protocol-relative resource attribute`);
  }

  if (extension === '.svg') {
    if (SVG_SCRIPT.test(text)) problems.push(`${file} contains an SVG <script>`);
    if (SVG_EXTERNAL_REF.test(text)) problems.push(`${file} references an external resource`);
    if (SVG_EVENT_HANDLER.test(text)) problems.push(`${file} contains an SVG event handler`);
  }

  if (['.js', '.mjs', '.html', '.json'].includes(extension)) {
    for (const match of text.matchAll(ABSOLUTE_URL)) {
      const url = match[0];
      if (!allowedPrefixes.some((prefix) => url.toLowerCase().startsWith(prefix.toLowerCase()))) {
        problems.push(`${file} mentions ${url}, which is not in scripts/allowed-urls.json`);
      }
    }

    for (const match of text.matchAll(QUOTED_PROTOCOL_RELATIVE)) {
      const url = match[0].slice(1, -1);
      problems.push(`${file} mentions the protocol-relative URL ${url}`);
    }
  }

  return problems;
}

/**
 * Checks that a build directory carries the canonical licence and third-party notices exactly.
 * @param {string} directory
 * @param {Record<string, string>} canonicalFiles
 * @param {string} [name]
 * @returns {Promise<string[]>}
 */
export async function packageNoticeProblems(directory, canonicalFiles, name = directory) {
  const problems = [];
  for (const fileName of PACKAGE_NOTICE_FILES) {
    const expected = canonicalFiles[fileName];
    try {
      const text = await readFile(join(directory, fileName), 'utf8');
      if (text !== expected) {
        problems.push(`${name}/${fileName} does not match the canonical ${fileName}`);
      }
    } catch {
      problems.push(
        `${name}/${fileName} is missing; the build must copy the canonical ${fileName} into every package`,
      );
    }
  }
  return problems;
}

/**
 * Resolves the built extension directories, e.g. `.output/chrome-mv3`.
 * @returns {Promise<string[]>}
 */
async function findBuildDirectories() {
  let entries;
  try {
    entries = await readdir(OUTPUT_DIR, { withFileTypes: true });
  } catch {
    throw new Error(
      `No build output found in ${relative(ROOT, OUTPUT_DIR)}. Run npm run build:chrome and npm run build:firefox first.`,
    );
  }
  const directories = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = join(OUTPUT_DIR, entry.name);
    const manifestPath = join(directory, 'manifest.json');
    try {
      await readFile(manifestPath, 'utf8');
      directories.push(directory);
    } catch {
      // Not a built extension directory (WXT keeps other folders here).
    }
  }
  if (directories.length === 0) {
    throw new Error(
      'No manifest.json found under .output. Run npm run build:chrome and npm run build:firefox first.',
    );
  }
  return directories;
}

/**
 * Lists every file under `directory` whose extension is scanned.
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function listScannedFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listScannedFiles(path)));
      continue;
    }
    if (SKIPPED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;
    if (SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) files.push(path);
  }
  return files;
}

/**
 * @param {string} directory
 */
async function checkManifest(directory) {
  const manifestPath = join(directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const name = relative(ROOT, directory);
  for (const problem of manifestProblems(manifest, `${name}/manifest.json`)) fail(problem);
}

/**
 * @param {string[]} directories
 */
async function checkCode(directories) {
  const allowedPrefixes = JSON.parse(await readFile(ALLOWED_URLS_FILE, 'utf8')).urlPrefixes;
  const scannedCount = { files: 0, bytes: 0 };

  for (const directory of directories) {
    const name = relative(ROOT, directory);
    const files = await listScannedFiles(directory);
    if (files.length === 0) fail(`${name} contains no scanned files; was it built?`);
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      scannedCount.files += 1;
      scannedCount.bytes += text.length;
      for (const problem of textProblems(relative(ROOT, file), text, allowedPrefixes)) {
        fail(problem);
      }
    }
  }

  return scannedCount;
}

async function main() {
  const directories = await findBuildDirectories();
  const canonicalFiles = Object.fromEntries(
    await Promise.all(
      PACKAGE_NOTICE_FILES.map(async (fileName) => [
        fileName,
        await readFile(join(ROOT, fileName), 'utf8'),
      ]),
    ),
  );
  for (const directory of directories) {
    await checkManifest(directory);
    for (const problem of await packageNoticeProblems(
      directory,
      canonicalFiles,
      relative(ROOT, directory),
    )) {
      fail(problem);
    }
  }
  const scanned = await checkCode(directories);

  const summary = directories.map((directory) => relative(ROOT, directory)).join(', ');
  if (failures.length > 0) {
    console.error('Privacy check FAILED');
    console.error(`  scanned: ${summary}`);
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log('Privacy check passed');
  console.log(`  scanned: ${summary}`);
  console.log(`  files: ${scanned.files} (${scanned.bytes} bytes)`);
  console.log(`  permissions: exactly [${EXPECTED_PERMISSIONS.join(', ')}]`);
  console.log(`  hosts: exactly [${EXPECTED_HOST_PERMISSIONS.join(', ')}]`);
  console.log(`  content script matches: exactly [${EXPECTED_CONTENT_SCRIPT_MATCHES.join(', ')}]`);
  console.log(`  notices: canonical LICENSE and THIRD-PARTY-NOTICES.txt present in every build`);
  console.log(`  forbidden APIs: none`);
  console.log(`  URLs: all in scripts/allowed-urls.json`);
}

if (resolve(process.argv[1] ?? '') === SCRIPT_PATH) await main();
