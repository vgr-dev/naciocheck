import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_CHECKS } from '../scripts/check-github-settings.mjs';
import { dependabotProblems, workflowProblems } from '../scripts/check-workflows.mjs';

/**
 * The committed workflows, checked against the spec in `specs/2026-11-25-ci-and-public-repo/`.
 * `check-workflows.test.ts` covers the policy rules on fixtures; this file reads the real files and
 * pins their triggers, job ids and the order of the checks. Offline, line-based, no YAML parser.
 */

const ROOT = join(__dirname, '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const CI_PATH = '.github/workflows/ci.yml';
const RELEASE_PATH = '.github/workflows/release.yml';
const DEPENDABOT_PATH = '.github/dependabot.yml';

const CI = read(CI_PATH);
const RELEASE = read(RELEASE_PATH);
const DEPENDABOT = read(DEPENDABOT_PATH);
const SETTINGS_DOC = read('docs/github-settings.md');

/** The checks, in order, that CI and the release job both run as separate steps. */
const CHECKS = [
  'npm run format:check',
  'npm run lint',
  'npm run typecheck',
  'npm test',
  'npm run build:chrome',
  'npm run build:firefox',
  'npm run check:privacy',
  'npm run check:site',
];

interface Line {
  indent: number;
  text: string;
}

/** The code lines (no blanks, no comments) with their indentation. */
function codeLines(text: string): Line[] {
  return text
    .split(/\r?\n/)
    .map((raw) => ({ indent: raw.length - raw.trimStart().length, text: raw.trim() }))
    .filter((line) => line.text !== '' && !line.text.startsWith('#'));
}

/** The trimmed lines nested under a top-level key such as `on:` or `jobs:`. */
function block(text: string, key: string): Line[] {
  const lines = codeLines(text);
  const start = lines.findIndex((line) => line.indent === 0 && line.text === `${key}:`);
  if (start < 0) throw new Error(`no top-level ${key}: block`);
  const nested: Line[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.indent === 0) break;
    nested.push(line);
  }
  return nested;
}

/** The job ids, in file order. */
function jobIds(text: string): string[] {
  const jobs = block(text, 'jobs');
  const indent = jobs[0]?.indent ?? 0;
  return jobs
    .filter((line) => line.indent === indent && /^[\w-]+:$/.test(line.text))
    .map((line) => line.text.slice(0, -1));
}

/** The lines of one job, without the job id line. */
function job(text: string, id: string): Line[] {
  const jobs = block(text, 'jobs');
  const indent = jobs[0]?.indent ?? 0;
  const start = jobs.findIndex((line) => line.indent === indent && line.text === `${id}:`);
  if (start < 0) throw new Error(`no job ${id}`);
  const lines: Line[] = [];
  for (const line of jobs.slice(start + 1)) {
    if (line.indent <= indent) break;
    lines.push(line);
  }
  return lines;
}

/** The single-line `run:` commands of a job, in order. Multi-line scripts (`run: |`) are skipped. */
function runCommands(lines: Line[]): string[] {
  return lines
    .map((line) => /^(?:-\s+)?run:\s+(\S.*)$/.exec(line.text)?.[1] ?? '')
    .filter((command) => command !== '' && !/^[|>][+-]?$/.test(command));
}

describe('check-workflows policy on the committed files', () => {
  it.each([
    [CI_PATH, CI],
    [RELEASE_PATH, RELEASE],
  ])('reports no problems for %s', (path, text) => {
    expect(workflowProblems(path, text)).toEqual([]);
  });

  it('reports no problems for dependabot.yml', () => {
    expect(dependabotProblems(DEPENDABOT_PATH, DEPENDABOT)).toEqual([]);
  });
});

describe('ci.yml', () => {
  it('is named CI', () => {
    expect(CI).toMatch(/^name: CI$/m);
  });

  it('triggers on pull_request and on push to main, and nothing else', () => {
    expect(block(CI, 'on').map((line) => line.text)).toEqual([
      'pull_request:',
      'push:',
      'branches: [main]',
    ]);
  });

  it('has the jobs checks and workflow-lint, in that order', () => {
    expect(jobIds(CI)).toEqual(['checks', 'workflow-lint']);
  });

  it('gives neither job a name that differs from its id', () => {
    for (const id of jobIds(CI)) {
      const lines = job(CI, id);
      const own = lines.filter((line) => line.indent === (lines[0]?.indent ?? 0));
      expect(own.some((line) => line.text.startsWith('name:'))).toBe(false);
    }
  });

  it('grants each job contents: read only', () => {
    for (const id of jobIds(CI)) {
      const lines = job(CI, id).map((line) => line.text);
      const at = lines.indexOf('permissions:');
      expect(at).toBeGreaterThanOrEqual(0);
      expect(lines[at + 1]).toBe('contents: read');
      expect(lines[at + 2]).not.toMatch(/^[\w-]+: (read|write)$/);
    }
  });

  it('runs install, then the fixed check list in order in the checks job', () => {
    expect(runCommands(job(CI, 'checks'))).toEqual(['npm ci', ...CHECKS]);
  });

  it('runs the workflow policy check and the workflow lint in the workflow-lint job', () => {
    expect(runCommands(job(CI, 'workflow-lint'))).toEqual([
      'npm ci',
      'npm run check:workflows',
      'npm run lint:workflows',
    ]);
  });

  it('runs no end-to-end script', () => {
    expect(CI).not.toMatch(/e2e|wdio|webdriver/i);
  });
});

describe('release.yml', () => {
  it('is named Release', () => {
    expect(RELEASE).toMatch(/^name: Release$/m);
  });

  it('triggers on workflow_dispatch only', () => {
    expect(block(RELEASE, 'on').map((line) => line.text)).toEqual(['workflow_dispatch:']);
  });

  it('has a single release job', () => {
    expect(jobIds(RELEASE)).toEqual(['release']);
  });

  it('is the only place with contents: write', () => {
    expect(CI).not.toMatch(/: write\b/);
    const lines = job(RELEASE, 'release').map((line) => line.text);
    const at = lines.indexOf('permissions:');
    expect(lines.slice(at, at + 2)).toEqual(['permissions:', 'contents: write']);
  });

  it('runs install, the fixed check list in order, then the two zip scripts', () => {
    expect(runCommands(job(RELEASE, 'release'))).toEqual([
      'npm ci',
      ...CHECKS,
      'npm run zip',
      'npm run zip:sources',
    ]);
  });

  it('creates a draft release and runs no end-to-end script', () => {
    expect(RELEASE).toMatch(/gh release create/);
    expect(RELEASE).toMatch(/--draft\b/);
    expect(RELEASE).not.toMatch(/e2e|wdio|webdriver/i);
  });

  it('attaches the three zips and the checksums that the packaging step writes', () => {
    for (const name of ['chrome.zip', 'firefox.zip', 'sources.zip', 'SHA256SUMS.txt']) {
      const mentions = RELEASE.split(/\r?\n/).filter(
        (line) => line.includes(`naciocheck-$VERSION-${name}`) && !line.trim().startsWith('#'),
      );
      // once where the packaging step writes or lists it, once in the release assets
      expect(mentions.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('required status checks', () => {
  it('are exactly the CI job ids, in the settings script', () => {
    expect([...REQUIRED_CHECKS]).toEqual(jobIds(CI));
  });

  it('are named in docs/github-settings.md next to the required-checks setting', () => {
    const start = SETTINGS_DOC.indexOf('- **`main-ruleset-required-checks`**');
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = SETTINGS_DOC.slice(start + 1);
    const end = rest.search(/^- \*\*`/m);
    const entry = end < 0 ? rest : rest.slice(0, end);
    for (const id of jobIds(CI)) expect(entry).toContain(`\`${id}\``);
  });
});

describe('dependabot.yml', () => {
  it('has only github-actions update entries, weekly', () => {
    const ecosystems = [...DEPENDABOT.matchAll(/package-ecosystem:\s*(\S+)/g)].map(
      (match) => match[1],
    );
    expect(ecosystems).toEqual(['github-actions']);
    expect(DEPENDABOT).toMatch(/interval:\s*weekly/);
    expect(DEPENDABOT).not.toMatch(/\bnpm\b/);
  });
});
