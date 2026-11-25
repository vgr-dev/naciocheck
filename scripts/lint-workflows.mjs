#!/usr/bin/env node
/**
 * Lints and audits the GitHub workflows with two pinned, checksum-verified release binaries:
 * `actionlint` (syntax and expression checks) and `zizmor` (security audit, run offline).
 * Neither tool is a third-party action and neither is installed from a package registry.
 *
 * Pinned releases (linux x64 only), both at least two weeks old when pinned on 2026-11-25:
 *  - actionlint v1.7.12, published 2026-03-30. The SHA-256 of `actionlint_1.7.12_linux_amd64.tar.gz`
 *    comes from the release's `actionlint_1.7.12_checksums.txt` and matches the asset `digest` shown by
 *    `gh release view v1.7.12 -R rhysd/actionlint --json assets`.
 *  - zizmor v1.32.0, published 2026-11-02 (v1.33.0 and v1.33.1 were still under two weeks old). The
 *    SHA-256 of `zizmor-x86_64-unknown-linux-gnu.tar.gz` comes from that asset's `digest` in
 *    `gh release view v1.32.0 -R zizmorcore/zizmor --json assets`, and matches the hash of the download.
 *
 * Each archive is downloaded into `.cache/workflow-tools/<tool>-<version>/` (git-ignored), its SHA-256 is
 * checked against the constants below before anything is extracted, and a verified copy is reused on the
 * next run. A mismatch deletes nothing and fails the run. To bump a pin, change the version and the hash
 * together, from the sources above, and update this comment.
 *
 * actionlint runs with `-shellcheck= -pyflakes=` so results do not depend on whether shellcheck or pyflakes
 * happen to be installed (they are on `ubuntu-latest`, not necessarily locally); zizmor covers template
 * injection. zizmor runs with `--offline`, so it makes no network request after the download. There is no
 * zizmor config file and no ignore list: a finding is fixed in the workflow.
 *
 * Usage: `npm run lint:workflows [-- <workflow file or directory>...]`. With no arguments it checks
 * `.github/` (actionlint gets its `workflows/*.yml` and `*.yaml` files); with no `.github/` it only
 * downloads and verifies the tools, then exits 0 with a note.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = join(ROOT, '.cache', 'workflow-tools');

const TOOLS = [
  {
    name: 'actionlint',
    version: '1.7.12',
    url: 'https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz',
    sha256: '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
  },
  {
    name: 'zizmor',
    version: '1.32.0',
    url: 'https://github.com/zizmorcore/zizmor/releases/download/v1.32.0/zizmor-x86_64-unknown-linux-gnu.tar.gz',
    sha256: 'bb110cc765eca9cd7efb2e284a956be5974c60027b0970f16397d86208a9957b',
  },
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function fail(message) {
  console.error(`lint-workflows: ${message}`);
  process.exit(1);
}

async function readIfExists(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Returns the path of a verified binary for `tool`, downloading and extracting it when needed. */
async function ensureTool(tool) {
  const dir = join(CACHE_DIR, `${tool.name}-${tool.version}`);
  const archivePath = join(dir, 'archive.tar.gz');
  const binaryPath = join(dir, tool.name);

  const cached = await readIfExists(archivePath);
  if (cached !== null && sha256(cached) === tool.sha256 && existsSync(binaryPath)) {
    return binaryPath;
  }

  console.log(`Downloading ${tool.name} ${tool.version}...`);
  const response = await fetch(tool.url);
  if (!response.ok) {
    fail(`could not download ${tool.url}: HTTP ${response.status}`);
  }
  const archive = Buffer.from(await response.arrayBuffer());
  const actual = sha256(archive);
  if (actual !== tool.sha256) {
    fail(
      `checksum mismatch for ${tool.name} ${tool.version}: expected ${tool.sha256}, got ${actual}. ` +
        'Nothing was extracted.',
    );
  }

  await mkdir(dir, { recursive: true });
  await writeFile(archivePath, archive);
  // Only the binary is extracted; the archive is verified, but its other members are not needed.
  await execFileAsync('tar', ['-xzf', archivePath, '-C', dir, tool.name]);
  await chmod(binaryPath, 0o755);
  return binaryPath;
}

/** Runs a tool from the repository root and prints its output; returns whether it exited 0. */
async function run(binary, args) {
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      cwd: ROOT,
      maxBuffer: 16 * 1024 * 1024,
    });
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    return true;
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    process.stdout.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    return false;
  }
}

/** The workflow files under `target`, a file or a directory (recursively, `.yml` and `.yaml`). */
async function workflowFiles(target) {
  const info = await stat(target);
  if (info.isFile()) return /\.ya?ml$/.test(target) ? [target] : [];
  const found = [];
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const path = join(target, entry.name);
    if (entry.isDirectory()) found.push(...(await workflowFiles(path)));
    else if (/\.ya?ml$/.test(entry.name)) found.push(path);
  }
  return found;
}

async function main() {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    fail(
      `only linux x64 is supported (this is ${process.platform} ${process.arch}). ` +
        'Run it in WSL or in CI.',
    );
  }

  const [actionlint, zizmor] = await Promise.all(TOOLS.map(ensureTool));

  const args = process.argv.slice(2).map((arg) => resolve(arg));
  const githubDir = join(ROOT, '.github');
  if (args.length === 0 && !existsSync(githubDir)) {
    console.log(
      'No .github/ directory, so there is nothing to lint. The tools are downloaded and verified.',
    );
    return;
  }

  const zizmorTargets = args.length > 0 ? args : [githubDir];
  const workflowsDir = join(githubDir, 'workflows');
  const actionlintTargets =
    args.length > 0
      ? (await Promise.all(args.map(workflowFiles))).flat()
      : existsSync(workflowsDir)
        ? await workflowFiles(workflowsDir)
        : [];

  let ok = true;
  if (actionlintTargets.length > 0) {
    console.log(`actionlint ${TOOLS[0].version}: ${actionlintTargets.length} file(s)`);
    ok = (await run(actionlint, ['-shellcheck=', '-pyflakes=', ...actionlintTargets])) && ok;
  } else {
    console.log('actionlint: no workflow files, skipped.');
  }
  console.log(`zizmor ${TOOLS[1].version}: ${zizmorTargets.length} target(s)`);
  ok = (await run(zizmor, ['--offline', ...zizmorTargets])) && ok;

  if (!ok) fail('findings reported above.');
  console.log('lint-workflows: no findings.');
}

await main();
