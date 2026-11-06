#!/usr/bin/env node
/**
 * Machine-checks the hard boundary "no tracking, no network" over the built extension.
 *
 * Fails when a built manifest asks for more than the agreed permissions/hosts, when built code
 * contains a network API or `storage.sync`, or when it mentions a URL that is not in
 * `scripts/allowed-urls.json`.
 *
 * Usage: build first (`npm run build:chrome && npm run build:firefox`), then `npm run check:privacy`.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT_DIR = join(ROOT, '.output');
const ALLOWED_URLS_FILE = join(ROOT, 'scripts', 'allowed-urls.json');

/** Exactly what the extension is allowed to ask for. Anything else fails the check. */
const EXPECTED_PERMISSIONS = ['storage', 'alarms', 'notifications'];
const EXPECTED_HOST_PERMISSIONS = ['https://sede.mjusticia.gob.es/eConsultas/*'];

/** APIs that would let code leave the device, plus the storage area that syncs to the vendor. */
const FORBIDDEN_APIS = [
  { label: 'fetch(', re: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { label: 'sendBeacon', re: /\bsendBeacon\b/ },
  { label: 'WebSocket', re: /\bWebSocket\b/ },
  { label: 'storage.sync', re: /\bstorage\s*\.\s*sync\b/ },
];

/** Files whose text is scanned. Sourcemaps are build artefacts, not shipped code. */
const SCANNED_EXTENSIONS = ['.js', '.mjs', '.html', '.json'];
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

  const permissions = manifest.permissions ?? [];
  const { unexpected, missing } = firstDifference(permissions, EXPECTED_PERMISSIONS);
  if (unexpected.length > 0 || missing.length > 0) {
    fail(
      `${name}/manifest.json permissions are [${permissions.join(', ')}]; expected exactly [${EXPECTED_PERMISSIONS.join(', ')}]${unexpected.length ? ` (unexpected: ${unexpected.join(', ')})` : ''}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`,
    );
  }

  const hosts = manifest.host_permissions ?? [];
  const hostDiff = firstDifference(hosts, EXPECTED_HOST_PERMISSIONS);
  if (hostDiff.unexpected.length > 0 || hostDiff.missing.length > 0) {
    fail(
      `${name}/manifest.json host_permissions are [${hosts.join(', ')}]; expected exactly [${EXPECTED_HOST_PERMISSIONS.join(', ')}]`,
    );
  }

  for (const key of ['optional_permissions', 'optional_host_permissions']) {
    if (manifest[key] !== undefined)
      fail(`${name}/manifest.json declares ${key}; least privilege forbids it`);
  }

  const csp = manifest.content_security_policy;
  if (csp !== undefined && /\bhttps?:\/\//.test(JSON.stringify(csp))) {
    fail(
      `${name}/manifest.json has a content_security_policy with remote sources: ${JSON.stringify(csp)}`,
    );
  }
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
      const where = relative(ROOT, file);

      for (const { label, re } of FORBIDDEN_APIS) {
        if (re.test(text)) fail(`${where} uses ${label}, which the privacy model forbids`);
      }

      for (const match of text.matchAll(/\bhttps?:\/\/[^\s"'`<>()\\)]+/g)) {
        const url = match[0];
        if (!allowedPrefixes.some((prefix) => url.startsWith(prefix))) {
          fail(`${where} mentions ${url}, which is not in scripts/allowed-urls.json`);
        }
      }
    }
  }

  return scannedCount;
}

async function main() {
  const directories = await findBuildDirectories();
  for (const directory of directories) await checkManifest(directory);
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
  console.log(`  forbidden APIs: none`);
  console.log(`  URLs: all in scripts/allowed-urls.json`);
}

await main();
