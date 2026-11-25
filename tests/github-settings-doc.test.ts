import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLE_ACTOR_ID,
  EXPECTED_SETTINGS,
  REQUIRED_CHECKS,
} from '../scripts/check-github-settings.mjs';

/**
 * `docs/github-settings.md` is the checklist the owner applies in the GitHub UI, and
 * `scripts/check-github-settings.mjs` checks the same settings. The two must name the same ids, so a
 * setting added to one cannot be forgotten in the other.
 */

const DOC = readFileSync(join(__dirname, '..', 'docs', 'github-settings.md'), 'utf8');

/** Entries are list items that start with the setting id in bold code: `- **`id`**`. */
const ENTRY = /^- \*\*`([a-z0-9-]+)`\*\*$/;

interface Entry {
  id: string;
  section: string;
  body: string;
}

function parseEntries(markdown: string): Entry[] {
  const entries: Entry[] = [];
  let section = '';
  let current: Entry | undefined;
  for (const line of markdown.split('\n')) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      section = heading[1] ?? '';
      current = undefined;
      continue;
    }
    const entry = ENTRY.exec(line);
    if (entry) {
      current = { id: entry[1] ?? '', section, body: '' };
      entries.push(current);
    } else if (current && line.startsWith('  ')) {
      current.body += `${line.trim()}\n`;
    } else {
      current = undefined;
    }
  }
  return entries;
}

/** The section of the document each group of ids belongs to. */
function expectedSection(id: string): string {
  if (id.startsWith('main-ruleset-')) return '`main` ruleset';
  if (id.startsWith('tag-ruleset-')) return '`v*` tag rulesets';
  if (id === 'wiki-off' || id === 'delete-branch-on-merge' || id === 'merge-squash-only') {
    return 'General';
  }
  if (/^(private-vulnerability|secret-scanning|dependabot-)/.test(id)) return 'Security';
  return 'Actions';
}

const entries = parseEntries(DOC);
const documented = entries.map((entry) => entry.id);
const scripted = EXPECTED_SETTINGS.map((setting) => setting.id);

describe('docs/github-settings.md', () => {
  it('documents every setting id the script checks', () => {
    expect(scripted.filter((id) => !documented.includes(id))).toEqual([]);
  });

  it('names no setting id the script lacks', () => {
    expect(documented.filter((id) => !scripted.includes(id))).toEqual([]);
  });

  it('documents each id once, in the script order', () => {
    expect(documented).toEqual(scripted);
  });

  it('puts each setting in its section', () => {
    for (const entry of entries) {
      expect(entry.section, entry.id).toBe(expectedSection(entry.id));
    }
  });

  it('gives each setting a place, an expected value and a reason', () => {
    for (const entry of entries) {
      expect(entry.body, entry.id).toMatch(/^- Where: \S/m);
      expect(entry.body, entry.id).toMatch(/^- Expected: \S/m);
      expect(entry.body, entry.id).toMatch(/^- Why: \S/m);
    }
  });

  it('names the required status checks the script expects', () => {
    expect(REQUIRED_CHECKS).toEqual(['checks', 'workflow-lint']);
    const required = entries.find((entry) => entry.id === 'main-ruleset-required-checks');
    for (const name of REQUIRED_CHECKS) {
      expect(required?.body, name).toContain(`\`${name}\``);
    }
  });

  it('documents the tag rule as two rulesets, with admin-only bypass for creation', () => {
    expect(DOC).toContain('two rulesets');
    expect(DOC).toContain('`refs/tags/v*`');
    expect(DOC).toContain('Repository admin');
    expect(DOC).toContain(`\`actor_id\` ${ADMIN_ROLE_ACTOR_ID}`);
    const create = entries.find((entry) => entry.id === 'tag-ruleset-creation-admin-bypass');
    expect(create?.body).toContain('Repository admin');
    for (const id of ['tag-ruleset-no-update', 'tag-ruleset-no-deletion']) {
      expect(entries.find((entry) => entry.id === id)?.body, id).toContain('no bypass actors');
    }
  });

  it('says the owner applies it, what needs a public repository, and how to run the check', () => {
    expect(DOC).toContain('The owner applies them');
    expect(DOC).toContain('public');
    expect(DOC).toContain('node scripts/check-github-settings.mjs');
    expect(DOC).toContain('`unavailable`');
  });
});
