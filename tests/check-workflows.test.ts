import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkRepository,
  dependabotProblems,
  workflowProblems,
} from '../scripts/check-workflows.mjs';

/**
 * Accept and reject fixtures for the workflow policy gate. Offline: inline YAML strings and temporary
 * directories only. The CLI applies the same functions to `.github/` in the repository.
 */

const SHA = 'a'.repeat(40);
const CHECKOUT = `actions/checkout@${SHA} # v6.0.0`;
const SETUP_NODE = `actions/setup-node@${SHA} # v6.0.0`;

const VALID = `name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions: {}

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - name: Checkout
        uses: ${CHECKOUT}
        with:
          persist-credentials: false
      - uses: ${SETUP_NODE}
        with:
          node-version-file: .nvmrc
      - run: npm ci
  second:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: ./.github/actions/local
      - run: echo "\${{ github.event_name }}"
`;

function replace(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`fixture does not contain: ${from}`);
  return text.replace(from, to);
}

function problems(text: string): string[] {
  return workflowProblems('w.yml', text);
}

describe('a compliant workflow', () => {
  it('has no problems', () => {
    expect(problems(VALID)).toEqual([]);
  });

  it('ignores commented-out triggers and actions', () => {
    const text = `# pull_request_target would be wrong\n# uses: actions/cache@v4\n${VALID}`;
    expect(problems(text)).toEqual([]);
  });
});

describe('uses: pinning and owners', () => {
  it('accepts a local path and the three GitHub-owned actions', () => {
    const text = replace(
      VALID,
      '      - run: npm ci\n',
      `      - uses: actions/upload-artifact@${SHA} # v5.0.0\n        with:\n          name: x\n`,
    );
    expect(problems(text)).toEqual([]);
  });

  it('accepts a quoted reference', () => {
    expect(
      problems(replace(VALID, `uses: ${SETUP_NODE}`, `uses: "actions/setup-node@${SHA}" # v6.0.0`)),
    ).toEqual([]);
  });

  it.each([
    ['a tag', 'actions/setup-node@v4 # v4.0.0'],
    ['a branch', 'actions/setup-node@main # v4.0.0'],
    ['a short SHA', 'actions/setup-node@aaaaaaa # v4.0.0'],
    ['an uppercase SHA', `actions/setup-node@${'A'.repeat(40)} # v4.0.0`],
    ['a 39-character SHA', `actions/setup-node@${'a'.repeat(39)} # v4.0.0`],
    ['no ref', 'actions/setup-node # v4.0.0'],
    ['another owner', `third-party/thing@${SHA} # v1.0.0`],
    ['a docker image', 'docker://alpine:3.20'],
    ['a parent path', '../outside'],
    ['a subpath of an allowed action', `actions/setup-node/sub@${SHA} # v1.0.0`],
  ])('rejects %s', (_label, uses) => {
    const result = problems(replace(VALID, `uses: ${SETUP_NODE}`, `uses: ${uses}`));
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('w.yml:');
  });

  it('rejects a pinned action without a version comment', () => {
    const result = problems(
      replace(VALID, `uses: ${SETUP_NODE}`, `uses: actions/setup-node@${SHA}`),
    );
    expect(result).toEqual([expect.stringContaining('# v')]);
  });

  it('rejects a version comment that is not a version', () => {
    const result = problems(
      replace(VALID, `uses: ${SETUP_NODE}`, `uses: actions/setup-node@${SHA} # main`),
    );
    expect(result).toEqual([expect.stringContaining('# v')]);
  });

  it('rejects actions/cache even when pinned', () => {
    const text = replace(
      VALID,
      '      - run: npm ci\n',
      `      - uses: actions/cache@${SHA} # v4.0.0\n`,
    );
    expect(problems(text)).toEqual([expect.stringContaining('actions/cache')]);
  });
});

describe('permissions', () => {
  it('rejects a workflow without a top-level permissions: {}', () => {
    expect(problems(replace(VALID, 'permissions: {}\n', ''))).toEqual([
      expect.stringContaining('permissions: {}'),
    ]);
  });

  it('rejects broad top-level permissions', () => {
    expect(problems(replace(VALID, 'permissions: {}', 'permissions: write-all'))).toEqual([
      expect.stringContaining('permissions: {}'),
    ]);
  });

  it('does not count a job-level permissions: {}', () => {
    const text = replace(VALID, 'permissions: {}\n', '').replace(
      '    permissions:\n      contents: read\n',
      '    permissions: {}\n',
    );
    expect(problems(text)).toEqual([expect.stringContaining('permissions: {}')]);
  });
});

describe('triggers', () => {
  it.each(['pull_request_target', 'workflow_run'])('rejects %s', (trigger) => {
    const result = problems(replace(VALID, '  pull_request:\n', `  ${trigger}:\n`));
    expect(result).toEqual([expect.stringContaining(trigger)]);
  });

  it('accepts pull_request and workflow_dispatch', () => {
    expect(problems(replace(VALID, '  pull_request:\n', '  workflow_dispatch:\n'))).toEqual([]);
  });
});

describe('secrets', () => {
  it('accepts github.token', () => {
    const text = replace(
      VALID,
      '      - run: npm ci\n',
      '      - run: gh api x\n        env:\n          GH_TOKEN: ${{ github.token }}\n',
    );
    expect(problems(text)).toEqual([]);
  });

  it.each([
    ['a secrets context', 'GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}'],
    ['an indexed secrets context', "GH_TOKEN: ${{ secrets['X'] }}"],
    ['secrets: inherit', 'secrets: inherit'],
  ])('rejects %s', (_label, line) => {
    const text = replace(
      VALID,
      '      - run: npm ci\n',
      `      - run: gh api x\n        env:\n          ${line}\n`,
    );
    expect(problems(text)).toEqual([expect.stringContaining('secrets')]);
  });
});

describe('untrusted expressions', () => {
  it('accepts github.event_name and step outputs', () => {
    const text = replace(
      VALID,
      '      - run: npm ci\n',
      '      - run: echo "$V"\n        env:\n          V: ${{ steps.version.outputs.value }}\n',
    );
    expect(problems(text)).toEqual([]);
  });

  it.each([
    ['github.event.*', '${{ github.event.pull_request.title }}'],
    ['github.head_ref', '${{ github.head_ref }}'],
    ['inputs.*', '${{ inputs.version }}'],
    ['inputs.* in a larger expression', "${{ format('{0}', inputs.version) }}"],
  ])('rejects %s', (_label, expression) => {
    const text = replace(VALID, '      - run: npm ci\n', `      - run: echo "${expression}"\n`);
    expect(problems(text)).toEqual([expect.stringContaining('expression')]);
  });

  it('rejects an expression in a shell comment, which is still expanded', () => {
    const text = replace(
      VALID,
      '      - run: npm ci\n',
      '      - run: |\n          # ${{ github.event.head_commit.message }}\n          npm ci\n',
    );
    expect(problems(text)).toEqual([expect.stringContaining('expression')]);
  });
});

describe('checkout credentials', () => {
  it('accepts persist-credentials: false when checkout is not the first key', () => {
    const text = replace(
      VALID,
      `      - name: Checkout\n        uses: ${CHECKOUT}\n`,
      `      - name: Checkout\n        id: checkout\n        uses: ${CHECKOUT}\n`,
    );
    expect(problems(text)).toEqual([]);
  });

  it('accepts a quoted false', () => {
    const text = replace(VALID, 'persist-credentials: false', 'persist-credentials: "false"');
    expect(problems(text)).toEqual([]);
  });

  it('rejects a checkout without with:', () => {
    const text = replace(VALID, '        with:\n          persist-credentials: false\n', '');
    expect(problems(text)).toEqual([expect.stringContaining('persist-credentials')]);
  });

  it('rejects persist-credentials: true', () => {
    const text = replace(VALID, 'persist-credentials: false', 'persist-credentials: true');
    expect(problems(text)).toEqual([expect.stringContaining('persist-credentials')]);
  });

  it('does not take persist-credentials from another step', () => {
    const text = replace(
      VALID,
      `      - name: Checkout\n        uses: ${CHECKOUT}\n        with:\n          persist-credentials: false\n`,
      `      - name: Checkout\n        uses: ${CHECKOUT}\n      - uses: ${SETUP_NODE}\n        with:\n          persist-credentials: false\n`,
    ).replace(
      `      - uses: ${SETUP_NODE}\n        with:\n          node-version-file: .nvmrc\n`,
      '',
    );
    expect(problems(text)).toEqual([expect.stringContaining('persist-credentials')]);
  });

  it('checks every checkout step', () => {
    const text = replace(
      VALID,
      '      - uses: ./.github/actions/local\n',
      `      - uses: ${CHECKOUT}\n`,
    );
    expect(problems(text)).toEqual([expect.stringContaining('persist-credentials')]);
  });
});

describe('concurrency and timeouts', () => {
  it('rejects a workflow without a top-level concurrency block', () => {
    const text = replace(
      VALID,
      'concurrency:\n  group: ${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true\n\n',
      '',
    );
    expect(problems(text)).toEqual([expect.stringContaining('concurrency')]);
  });

  it('rejects a job without timeout-minutes', () => {
    const text = replace(VALID, '    timeout-minutes: 10\n', '');
    expect(problems(text)).toEqual([expect.stringContaining('"second"')]);
  });

  it('does not take a step-level timeout for the job', () => {
    const text = replace(VALID, '    timeout-minutes: 10\n', '').replace(
      '      - run: echo "${{ github.event_name }}"\n',
      '      - run: echo hi\n        timeout-minutes: 5\n',
    );
    expect(problems(text)).toEqual([expect.stringContaining('"second"')]);
  });

  it('reports every job that lacks a timeout', () => {
    const text = replace(
      replace(VALID, '    timeout-minutes: 10\n', ''),
      '    timeout-minutes: 20\n',
      '',
    );
    expect(problems(text)).toHaveLength(2);
  });

  it('rejects a workflow without jobs', () => {
    expect(problems('permissions: {}\nconcurrency:\n  group: x\n')).toEqual([
      expect.stringContaining('jobs:'),
    ]);
  });
});

describe('caches', () => {
  it('rejects cache: on setup-node', () => {
    const text = replace(
      VALID,
      'node-version-file: .nvmrc\n',
      'node-version-file: .nvmrc\n          cache: npm\n',
    );
    expect(problems(text)).toEqual([expect.stringContaining('cache:')]);
  });

  it('accepts a cache: key on a step that is not setup-node', () => {
    const text = replace(
      VALID,
      '      - run: npm ci\n',
      '      - run: echo hi\n        env:\n          cache: none\n',
    );
    expect(problems(text)).toEqual([]);
  });
});

describe('dependabot.yml', () => {
  const valid = `version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
`;

  it('accepts a github-actions entry, quoted or not', () => {
    expect(dependabotProblems('d.yml', valid)).toEqual([]);
    expect(
      dependabotProblems('d.yml', valid.replace('"github-actions"', 'github-actions # keep pins')),
    ).toEqual([]);
  });

  it('rejects an npm entry', () => {
    const text = `${valid}  - package-ecosystem: "npm"\n    directory: "/"\n`;
    expect(dependabotProblems('d.yml', text)).toEqual([expect.stringContaining('"npm"')]);
  });

  it('rejects a config without any entry', () => {
    expect(dependabotProblems('d.yml', 'version: 2\nupdates: []\n')).toEqual([
      expect.stringContaining('no github-actions'),
    ]);
  });

  it('ignores a commented-out npm entry', () => {
    expect(dependabotProblems('d.yml', `${valid}  # - package-ecosystem: "npm"\n`)).toEqual([]);
  });
});

describe('checkRepository', () => {
  const roots: string[] = [];

  function makeRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'check-workflows-'));
    roots.push(root);
    return root;
  }

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('passes with a note when .github is absent', async () => {
    const result = await checkRepository(makeRoot());
    expect(result.problems).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.note).toContain('nothing to check');
  });

  it('passes with a note when .github has no workflows', async () => {
    const root = makeRoot();
    mkdirSync(join(root, '.github'));
    writeFileSync(join(root, '.github', 'PULL_REQUEST_TEMPLATE.md'), 'x\n');
    const result = await checkRepository(root);
    expect(result.problems).toEqual([]);
    expect(result.note).toContain('nothing to check');
  });

  it('checks workflows and dependabot.yml and names the failing file', async () => {
    const root = makeRoot();
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), VALID);
    writeFileSync(
      join(root, '.github', 'workflows', 'bad.yaml'),
      replace(VALID, 'permissions: {}\n', ''),
    );
    writeFileSync(join(root, '.github', 'workflows', 'notes.txt'), 'pull_request_target\n');
    writeFileSync(
      join(root, '.github', 'dependabot.yml'),
      'version: 2\nupdates:\n  - package-ecosystem: "npm"\n',
    );
    const result = await checkRepository(root);
    expect(result.files).toEqual([
      join('.github', 'workflows', 'bad.yaml'),
      join('.github', 'workflows', 'ci.yml'),
      join('.github', 'dependabot.yml'),
    ]);
    expect(result.problems).toHaveLength(2);
    expect(result.problems[0]).toContain('bad.yaml');
    expect(result.problems[1]).toContain('dependabot.yml');
  });
});
