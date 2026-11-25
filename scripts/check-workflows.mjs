#!/usr/bin/env node
/**
 * Machine-checks the repository's GitHub workflow policy over `.github/workflows/*.y{a,}ml` and
 * `.github/dependabot.yml`, offline and without a YAML parser.
 *
 * The checks are line-based and written for plain block-style YAML (no flow style, no anchors).
 * `actionlint` validates the syntax and `zizmor` audits the workflows; this gate only pins the
 * repository's own rules so a regression fails `npm test` and CI without downloading anything.
 *
 * Rules for every workflow:
 *  - every `uses:` is a local `./` path, or `actions/checkout`, `actions/setup-node` or
 *    `actions/upload-artifact` at a 40-character lowercase SHA followed by a `# v...` comment;
 *  - a top-level `permissions: {}` line exists;
 *  - no `pull_request_target` or `workflow_run` trigger (comments are ignored);
 *  - no `secrets.` reference (use `github.token`); this one reads comments too;
 *  - no `${{ github.event.*`, `github.head_ref` or `inputs.` expression; this one reads comments too,
 *    because a shell comment inside a `run:` script is still expanded;
 *  - every `actions/checkout` step has `persist-credentials: false` in its own `with:` block;
 *  - a top-level `concurrency:` exists and every job has its own `timeout-minutes:`;
 *  - no `cache:` key on `actions/setup-node` and no `actions/cache`.
 * Rule for `dependabot.yml`: only `github-actions` update entries.
 *
 * Usage: `npm run check:workflows`.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(SCRIPT_PATH));

/** The only actions a workflow may use besides local `./` paths. All are GitHub-owned. */
export const ALLOWED_ACTIONS = [
  'actions/checkout',
  'actions/setup-node',
  'actions/upload-artifact',
];

const FULL_SHA = /^[0-9a-f]{40}$/;
const USES_LINE = /^\s*(?:-\s+)?uses:\s*(.*?)\s*$/;
const FORBIDDEN_EXPRESSION =
  /\$\{\{(?:(?!\}\}).)*?\b(?:github\.event\.|github\.head_ref\b|inputs\.)/;

function parseLines(text) {
  return text.split(/\r?\n/).map((raw, index) => {
    const trimmed = raw.trim();
    return {
      raw,
      no: index + 1,
      trimmed,
      indent: raw.length - raw.trimStart().length,
      code: trimmed !== '' && !trimmed.startsWith('#'),
    };
  });
}

/** The lines of the step that contains `lines[index]` (a `uses:` line), as `[start, end)`. */
function stepRange(lines, index) {
  const keyIndent = lines[index].raw.indexOf('uses:');
  let start = index;
  if (!/^\s*-\s+uses:/.test(lines[index].raw)) {
    while (start > 0) {
      start -= 1;
      const line = lines[start];
      if (line.code && /^\s*-\s/.test(line.raw) && line.indent < keyIndent) break;
    }
  }
  const itemIndent = lines[start].indent;
  let end = index + 1;
  while (end < lines.length && (!lines[end].code || lines[end].indent > itemIndent)) end += 1;
  return { start, end, keyIndent };
}

/** The code lines nested under the step's own `with:` key. Empty when there is none. */
function withLines(lines, { start, end, keyIndent }) {
  let withIndex = -1;
  for (let i = start; i < end; i += 1) {
    const line = lines[i];
    if (line.code && line.indent === keyIndent && /^with:\s*(#.*)?$/.test(line.trimmed)) {
      withIndex = i;
      break;
    }
  }
  if (withIndex < 0) return [];
  const nested = [];
  for (let i = withIndex + 1; i < end; i += 1) {
    if (!lines[i].code) continue;
    if (lines[i].indent <= keyIndent) break;
    nested.push(lines[i]);
  }
  return nested;
}

function usesProblems(name, lines) {
  const problems = [];
  lines.forEach((line, index) => {
    if (!line.code) return;
    const match = USES_LINE.exec(line.raw);
    if (!match) return;
    const where = `${name}:${line.no}`;
    const parts = /^(\S+)(?:\s+(#.*))?$/.exec(match[1]);
    if (!parts) {
      problems.push(`${where}: cannot read the uses: value "${match[1]}"`);
      return;
    }
    const ref = parts[1].replace(/^(['"])(.*)\1$/, '$2');
    const comment = parts[2] ?? '';
    if (ref.startsWith('./')) return;
    const at = ref.lastIndexOf('@');
    const action = at < 0 ? ref : ref.slice(0, at);
    const version = at < 0 ? '' : ref.slice(at + 1);
    if (action === 'actions/cache' || action.startsWith('actions/cache/')) {
      problems.push(`${where}: actions/cache is not allowed (no caches shared with PR runs)`);
      return;
    }
    if (!ALLOWED_ACTIONS.includes(action)) {
      problems.push(
        `${where}: action "${ref}" is not allowed (only ${ALLOWED_ACTIONS.join(', ')} or a local ./ path)`,
      );
      return;
    }
    if (!FULL_SHA.test(version)) {
      problems.push(`${where}: "${ref}" must be pinned to a 40-character lowercase commit SHA`);
      return;
    }
    if (!/^#\s*v\d/.test(comment)) {
      problems.push(`${where}: "${ref}" needs a trailing "# v..." comment with the version`);
    }
    if (action === 'actions/checkout') {
      const persists = withLines(lines, stepRange(lines, index)).some((nested) =>
        /^persist-credentials:\s*(['"]?)false\1\s*(#.*)?$/.test(nested.trimmed),
      );
      if (!persists) {
        problems.push(`${where}: actions/checkout needs "persist-credentials: false" in its with:`);
      }
    }
    if (action === 'actions/setup-node') {
      const cached = withLines(lines, stepRange(lines, index)).some((nested) =>
        /^cache\s*:/.test(nested.trimmed),
      );
      if (cached) problems.push(`${where}: actions/setup-node must not set cache:`);
    }
  });
  return problems;
}

function jobProblems(name, lines) {
  const jobsIndex = lines.findIndex((line) => line.code && /^jobs:\s*(#.*)?$/.test(line.raw));
  if (jobsIndex < 0) return [`${name}: no top-level jobs: block`];
  let end = jobsIndex + 1;
  while (end < lines.length && (!lines[end].code || lines[end].indent > 0)) end += 1;
  const body = lines.slice(jobsIndex + 1, end).filter((line) => line.code);
  if (body.length === 0) return [`${name}: jobs: has no jobs`];
  const jobIndent = body[0].indent;
  const starts = body.filter((line) => line.indent === jobIndent && /^[\w-]+:/.test(line.trimmed));
  const problems = [];
  starts.forEach((job, position) => {
    const next = starts[position + 1];
    const block = body.filter(
      (line) => line.no > job.no && (next === undefined || line.no < next.no),
    );
    const childIndent = block.length > 0 ? block[0].indent : -1;
    const hasTimeout = block.some(
      (line) => line.indent === childIndent && /^timeout-minutes:\s*\S/.test(line.trimmed),
    );
    if (!hasTimeout) {
      problems.push(
        `${name}:${job.no}: job "${job.trimmed.replace(/:.*$/, '')}" has no timeout-minutes:`,
      );
    }
  });
  return problems;
}

/**
 * Policy problems of one workflow file, as `file:line: message` strings. `name` is only used in the
 * messages; `text` is the whole file.
 */
export function workflowProblems(name, text) {
  const lines = parseLines(text);
  const code = lines.filter((line) => line.code);
  const problems = usesProblems(name, lines);

  if (
    !code.some((line) => line.indent === 0 && /^permissions:\s*\{\s*\}\s*(#.*)?$/.test(line.raw))
  ) {
    problems.push(`${name}: no top-level "permissions: {}"`);
  }
  if (!code.some((line) => line.indent === 0 && /^concurrency:/.test(line.raw))) {
    problems.push(`${name}: no top-level concurrency: block`);
  }
  problems.push(...jobProblems(name, lines));

  for (const line of code) {
    if (/\b(?:pull_request_target|workflow_run)\b/.test(line.raw)) {
      problems.push(
        `${name}:${line.no}: pull_request_target and workflow_run triggers are not allowed`,
      );
    }
  }
  for (const line of lines) {
    if (/\bsecrets\s*[.[]/.test(line.raw) || /^\s*secrets\s*:/.test(line.raw)) {
      problems.push(`${name}:${line.no}: no secrets (use github.token)`);
    }
    if (FORBIDDEN_EXPRESSION.test(line.raw)) {
      problems.push(
        `${name}:${line.no}: no github.event.*, github.head_ref or inputs.* expression (pass values through env:)`,
      );
    }
  }
  return problems;
}

/** Policy problems of `dependabot.yml`: only `github-actions` entries, and at least one. */
export function dependabotProblems(name, text) {
  const problems = [];
  let entries = 0;
  for (const line of parseLines(text)) {
    if (!line.code) continue;
    const match = /^(?:-\s+)?package-ecosystem:\s*(.*?)\s*(?:#.*)?$/.exec(line.trimmed);
    if (!match) continue;
    entries += 1;
    const ecosystem = match[1].replace(/^(['"])(.*)\1$/, '$2');
    if (ecosystem !== 'github-actions') {
      problems.push(
        `${name}:${line.no}: package-ecosystem "${ecosystem}" is not allowed (github-actions only)`,
      );
    }
  }
  if (entries === 0) problems.push(`${name}: no github-actions update entry`);
  return problems;
}

async function exists(path) {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies the policy to a repository root. Returns the checked file names, the problems and a note
 * when there was nothing to check.
 */
export async function checkRepository(root) {
  const github = join(root, '.github');
  if (!(await exists(github))) {
    return { files: [], problems: [], note: 'no .github/ directory, nothing to check' };
  }
  const workflowDir = join(github, 'workflows');
  const workflowNames = (await exists(workflowDir)) ? await readdir(workflowDir) : [];
  const targets = workflowNames
    .filter((file) => /\.ya?ml$/.test(file))
    .sort()
    .map((file) => ({ path: join(workflowDir, file), check: workflowProblems }));
  for (const file of ['dependabot.yml', 'dependabot.yaml']) {
    const path = join(github, file);
    try {
      await readFile(path, 'utf8');
      targets.push({ path, check: dependabotProblems });
    } catch {
      // not present
    }
  }
  if (targets.length === 0) {
    return { files: [], problems: [], note: 'no workflows or dependabot config, nothing to check' };
  }
  const files = [];
  const problems = [];
  for (const { path, check } of targets) {
    const name = relative(root, path);
    files.push(name);
    problems.push(...check(name, await readFile(path, 'utf8')));
  }
  return { files, problems, note: '' };
}

async function main() {
  const { files, problems, note } = await checkRepository(ROOT);
  if (problems.length > 0) {
    console.error('Workflow policy check FAILED');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  if (note) {
    console.log(`Workflow policy check passed: ${note}`);
    return;
  }
  console.log('Workflow policy check passed');
  for (const file of files) console.log(`  checked: ${file}`);
}

if (resolve(process.argv[1] ?? '') === SCRIPT_PATH) await main();
