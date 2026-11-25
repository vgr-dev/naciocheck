import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLE_ACTOR_ID,
  EXPECTED_SETTINGS,
  GITHUB_ACTIONS_APP_ID,
  compareSettings,
  endpointsToCollect,
  parseHttpResponse,
  parseRemote,
  type SettingResponses,
} from '../scripts/check-github-settings.mjs';

/**
 * Offline tests for the read-only settings check. The CLI collects the same shape of responses with
 * `gh api --method GET`; nothing here reaches GitHub.
 */

const ok = (body: unknown) => ({ status: 200, body });

function mainRuleset(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'main',
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 0,
          required_review_thread_resolution: true,
          allowed_merge_methods: ['squash'],
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [
            { context: 'checks', integration_id: GITHUB_ACTIONS_APP_ID },
            { context: 'workflow-lint', integration_id: GITHUB_ACTIONS_APP_ID },
          ],
        },
      },
      { type: 'required_linear_history' },
      { type: 'non_fast_forward' },
      { type: 'deletion' },
    ],
    ...overrides,
  };
}

function creationRuleset(overrides: Record<string, unknown> = {}) {
  return {
    id: 2,
    name: 'tags create',
    target: 'tag',
    enforcement: 'active',
    bypass_actors: [
      { actor_id: ADMIN_ROLE_ACTOR_ID, actor_type: 'RepositoryRole', bypass_mode: 'always' },
    ],
    conditions: { ref_name: { include: ['refs/tags/v*'], exclude: [] } },
    rules: [{ type: 'creation' }],
    ...overrides,
  };
}

function lockRuleset(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    name: 'tags lock',
    target: 'tag',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['refs/tags/v*'], exclude: [] } },
    rules: [
      { type: 'update', parameters: { update_allows_fetch_and_merge: false } },
      { type: 'deletion' },
    ],
    ...overrides,
  };
}

/** A snapshot in which every setting matches the checklist. */
function compliant(): SettingResponses {
  const rulesets = [mainRuleset(), creationRuleset(), lockRuleset()];
  const responses: SettingResponses = {
    'actions/permissions': ok({
      enabled: true,
      allowed_actions: 'selected',
      sha_pinning_required: true,
    }),
    'actions/permissions/selected-actions': ok({
      github_owned_allowed: true,
      verified_allowed: false,
      patterns_allowed: [],
    }),
    'actions/permissions/workflow': ok({
      default_workflow_permissions: 'read',
      can_approve_pull_request_reviews: false,
    }),
    'actions/permissions/fork-pr-contributor-approval': ok({
      approval_policy: 'all_external_contributors',
    }),
    rulesets: ok(
      rulesets.map(({ id, name, target, enforcement }) => ({ id, name, target, enforcement })),
    ),
    'private-vulnerability-reporting': ok({ enabled: true }),
    'vulnerability-alerts': { status: 204, body: null },
    repository: ok({
      default_branch: 'main',
      has_wiki: false,
      delete_branch_on_merge: true,
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      security_and_analysis: {
        secret_scanning: { status: 'enabled' },
        secret_scanning_push_protection: { status: 'enabled' },
      },
    }),
  };
  for (const ruleset of rulesets) responses[`rulesets/${ruleset.id}`] = ok(ruleset);
  return responses;
}

/** Applies `change` to a deep copy of the compliant snapshot. */
function drifted(change: (responses: SettingResponses) => void): SettingResponses {
  const responses = structuredClone(compliant());
  change(responses);
  return responses;
}

const body = (responses: SettingResponses, endpoint: string) =>
  responses[endpoint]!.body as Record<string, unknown>;

/** Adds a ruleset to the list and to the per-ruleset detail responses of a snapshot. */
function addRuleset(responses: SettingResponses, ruleset: ReturnType<typeof creationRuleset>) {
  const list = responses.rulesets!.body as Record<string, unknown>[];
  const { id, name, target, enforcement } = ruleset;
  list.push({ id, name, target, enforcement });
  responses[`rulesets/${ruleset.id}`] = ok(ruleset);
}

/** A second tag ruleset layered over the release tags, with no bypass unless overridden. */
const layeredRuleset = (overrides: Record<string, unknown> = {}) =>
  creationRuleset({
    id: 4,
    name: 'tags layered',
    bypass_actors: [],
    rules: [{ type: 'creation' }, { type: 'update' }, { type: 'deletion' }],
    ...overrides,
  });

const driftIds = (responses: SettingResponses) => compareSettings(responses).drift.map((d) => d.id);

describe('EXPECTED_SETTINGS', () => {
  it('has unique kebab-case ids', () => {
    const ids = EXPECTED_SETTINGS.map((setting) => setting.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('covers every group of the checklist', () => {
    const ids = EXPECTED_SETTINGS.map((setting) => setting.id);
    for (const id of [
      'actions-allowed-github-owned',
      'actions-sha-pinning',
      'workflow-token-read',
      'actions-no-pr-approval',
      'fork-pr-approval-all-outside',
      'private-vulnerability-reporting',
      'secret-scanning',
      'secret-scanning-push-protection',
      'dependabot-alerts',
      'default-branch-main',
      'wiki-off',
      'delete-branch-on-merge',
      'merge-squash-only',
    ]) {
      expect(ids).toContain(id);
    }
    expect(ids.some((id) => id.startsWith('main-ruleset-'))).toBe(true);
    expect(ids.some((id) => id.startsWith('tag-ruleset-'))).toBe(true);
    expect(ids).toContain('main-ruleset-checks-from-actions');
  });

  it('collects every endpoint a setting reads, once', () => {
    const endpoints = endpointsToCollect();
    expect(new Set(endpoints).size).toBe(endpoints.length);
    for (const setting of EXPECTED_SETTINGS) {
      expect(endpoints).toContain(setting.endpoint);
      for (const extra of setting.extraEndpoints ?? []) expect(endpoints).toContain(extra);
    }
  });
});

describe('compareSettings', () => {
  it('accepts a fully compliant snapshot', () => {
    const result = compareSettings(compliant());
    expect(result.drift).toEqual([]);
    expect(result.unavailable).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.ok.sort()).toEqual(EXPECTED_SETTINGS.map((setting) => setting.id).sort());
  });

  it('works from the list alone when it already carries the rules', () => {
    const responses = compliant();
    responses.rulesets = ok([mainRuleset(), creationRuleset(), lockRuleset()]);
    for (const key of Object.keys(responses)) {
      if (key.startsWith('rulesets/')) delete responses[key];
    }
    expect(compareSettings(responses).drift).toEqual([]);
  });

  describe('Actions', () => {
    it('flags actions that are not limited to selected ones', () => {
      const responses = drifted((r) => {
        body(r, 'actions/permissions').allowed_actions = 'all';
      });
      expect(driftIds(responses)).toEqual(['actions-allowed-github-owned']);
    });

    it('flags verified creators and patterns', () => {
      const responses = drifted((r) => {
        body(r, 'actions/permissions/selected-actions').verified_allowed = true;
        body(r, 'actions/permissions/selected-actions').patterns_allowed = ['owner/*'];
      });
      expect(driftIds(responses)).toEqual(['actions-allowed-github-owned']);
    });

    it('flags missing SHA pinning', () => {
      const responses = drifted((r) => {
        body(r, 'actions/permissions').sha_pinning_required = false;
      });
      expect(driftIds(responses)).toEqual(['actions-sha-pinning']);
    });

    it('flags a writable default token', () => {
      const responses = drifted((r) => {
        body(r, 'actions/permissions/workflow').default_workflow_permissions = 'write';
      });
      expect(driftIds(responses)).toEqual(['workflow-token-read']);
    });

    it('flags Actions that may approve pull requests', () => {
      const responses = drifted((r) => {
        body(r, 'actions/permissions/workflow').can_approve_pull_request_reviews = true;
      });
      expect(driftIds(responses)).toEqual(['actions-no-pr-approval']);
    });

    it('flags a weaker fork approval policy', () => {
      const responses = drifted((r) => {
        body(r, 'actions/permissions/fork-pr-contributor-approval').approval_policy =
          'first_time_contributors';
      });
      expect(driftIds(responses)).toEqual(['fork-pr-approval-all-outside']);
    });
  });

  describe('main ruleset', () => {
    const mainRules = (responses: SettingResponses) =>
      body(responses, 'rulesets/1').rules as {
        type: string;
        parameters?: Record<string, unknown>;
      }[];
    const removeRule = (type: string) => (r: SettingResponses) => {
      body(r, 'rulesets/1').rules = mainRules(r).filter((rule) => rule.type !== type);
    };

    it('reports every main setting when no ruleset targets main', () => {
      const responses = drifted((r) => {
        r.rulesets = ok([]);
      });
      const ids = driftIds(responses);
      expect(ids.filter((id) => id.startsWith('main-ruleset-')).length).toBeGreaterThanOrEqual(10);
      expect(ids.filter((id) => id.startsWith('tag-ruleset-')).length).toBe(4);
    });

    it('accepts the literal refs/heads/main as the target', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/1').conditions = {
          ref_name: { include: ['refs/heads/main'], exclude: [] },
        };
      });
      expect(driftIds(responses)).toEqual([]);
    });

    it('flags a ruleset that is not active', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/1').enforcement = 'evaluate';
      });
      expect(driftIds(responses)).toContain('main-ruleset-active');
    });

    it('flags excluded refs that are not main', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/1').conditions = {
          ref_name: { include: ['~DEFAULT_BRANCH'], exclude: ['refs/heads/x'] },
        };
      });
      expect(driftIds(responses)).toEqual(['main-ruleset-active']);
    });

    it.each([['refs/heads/main'], ['~DEFAULT_BRANCH'], ['~ALL']])(
      'does not count a ruleset that excludes main as %s',
      (excluded) => {
        const responses = drifted((r) => {
          body(r, 'rulesets/1').conditions = {
            ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [excluded] },
          };
        });
        const result = compareSettings(responses);
        const ids = result.drift.map((d) => d.id);
        expect(ids.filter((id) => id.startsWith('main-ruleset-')).length).toBeGreaterThanOrEqual(
          10,
        );
        expect(ids).toContain('main-ruleset-active');
        expect(result.ok.filter((id) => id.startsWith('main-ruleset-'))).toEqual([]);
        const active = result.drift.find((d) => d.id === 'main-ruleset-active')!;
        expect(active.actual).toContain(`excludes ${excluded}`);
      },
    );

    it('does not let ~DEFAULT_BRANCH in exclude remove main when the default is another branch', () => {
      const responses = drifted((r) => {
        body(r, 'repository').default_branch = 'develop';
        body(r, 'rulesets/1').conditions = {
          ref_name: { include: ['refs/heads/main'], exclude: ['~DEFAULT_BRANCH'] },
        };
      });
      expect(driftIds(responses)).toEqual(['main-ruleset-active', 'default-branch-main']);
    });

    it('accepts ~ALL as the target of main', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/1').conditions = { ref_name: { include: ['~ALL'], exclude: [] } };
      });
      expect(driftIds(responses)).toEqual([]);
    });

    describe('default branch', () => {
      const develop = (r: SettingResponses) => {
        body(r, 'repository').default_branch = 'develop';
      };

      it('does not count a ~DEFAULT_BRANCH ruleset when the default branch is not main', () => {
        const result = compareSettings(drifted(develop));
        const ids = result.drift.map((d) => d.id);
        expect(ids).toContain('default-branch-main');
        for (const id of [
          'main-ruleset-active',
          'main-ruleset-no-bypass',
          'main-ruleset-pull-request',
          'main-ruleset-no-force-push',
          'main-ruleset-no-deletion',
        ]) {
          expect(ids, id).toContain(id);
        }
        expect(result.ok.filter((id) => id.startsWith('main-ruleset-'))).toEqual([]);
        const active = result.drift.find((d) => d.id === 'main-ruleset-active')!;
        expect(active.actual).toContain('the default branch is "develop"');
      });

      it('still counts a ruleset that names refs/heads/main', () => {
        const responses = drifted((r) => {
          develop(r);
          body(r, 'rulesets/1').conditions = {
            ref_name: { include: ['refs/heads/main'], exclude: [] },
          };
        });
        expect(driftIds(responses)).toEqual(['default-branch-main']);
      });

      it('accepts main as the default branch', () => {
        expect(driftIds(compliant())).toEqual([]);
      });

      it('reports a missing default_branch as an error for the main settings', () => {
        const responses = drifted((r) => {
          delete body(r, 'repository').default_branch;
        });
        const result = compareSettings(responses);
        expect(result.errors.map((e) => e.id)).toContain('main-ruleset-active');
        expect(result.unavailable.map((u) => u.id)).toContain('default-branch-main');
        expect(result.ok.filter((id) => id.startsWith('main-ruleset-'))).toEqual([]);
      });

      it('reports an unreadable repository as an error for the main settings', () => {
        const responses = drifted((r) => {
          r.repository = { status: 500, body: null };
        });
        const result = compareSettings(responses);
        expect(result.errors.map((e) => e.id)).toContain('main-ruleset-no-deletion');
        expect(result.ok.filter((id) => id.startsWith('main-ruleset-'))).toEqual([]);
      });
    });

    it('flags bypass actors', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/1').bypass_actors = [
          { actor_id: ADMIN_ROLE_ACTOR_ID, actor_type: 'RepositoryRole', bypass_mode: 'always' },
        ];
      });
      expect(driftIds(responses)).toEqual(['main-ruleset-no-bypass']);
    });

    it('flags a missing pull request rule', () => {
      const responses = drifted(removeRule('pull_request'));
      expect(driftIds(responses)).toEqual([
        'main-ruleset-pull-request',
        'main-ruleset-zero-approvals',
        'main-ruleset-conversation-resolution',
        'main-ruleset-squash-only',
      ]);
    });

    it('flags required approvals', () => {
      const responses = drifted((r) => {
        mainRules(r)[0]!.parameters!.required_approving_review_count = 1;
      });
      expect(driftIds(responses)).toEqual(['main-ruleset-zero-approvals']);
    });

    it('flags unresolved conversations being allowed', () => {
      const responses = drifted((r) => {
        mainRules(r)[0]!.parameters!.required_review_thread_resolution = false;
      });
      expect(driftIds(responses)).toEqual(['main-ruleset-conversation-resolution']);
    });

    it('flags merge methods other than squash', () => {
      const responses = drifted((r) => {
        mainRules(r)[0]!.parameters!.allowed_merge_methods = ['squash', 'merge'];
      });
      expect(driftIds(responses)).toEqual(['main-ruleset-squash-only']);
    });

    it('flags a missing required check', () => {
      const responses = drifted((r) => {
        mainRules(r)[1]!.parameters!.required_status_checks = [
          { context: 'checks', integration_id: GITHUB_ACTIONS_APP_ID },
        ];
      });
      const result = compareSettings(responses);
      expect(result.drift.map((d) => d.id)).toEqual(['main-ruleset-required-checks']);
      expect(result.drift[0]!.actual).toContain('workflow-lint');
    });

    describe('required check source', () => {
      const checks = (r: SettingResponses) =>
        mainRules(r)[1]!.parameters!.required_status_checks as Record<string, unknown>[];

      it('flags a required check without an integration_id', () => {
        const responses = drifted((r) => {
          delete checks(r)[1]!.integration_id;
        });
        const result = compareSettings(responses);
        expect(result.drift.map((d) => d.id)).toEqual(['main-ruleset-checks-from-actions']);
        expect(result.drift[0]!.actual).toContain('workflow-lint (null)');
      });

      it('flags a required check from another integration', () => {
        const responses = drifted((r) => {
          checks(r)[0]!.integration_id = 12345;
        });
        const result = compareSettings(responses);
        expect(result.drift.map((d) => d.id)).toEqual(['main-ruleset-checks-from-actions']);
        expect(result.drift[0]!.actual).toContain('checks (12345)');
        expect(result.drift[0]!.actual).not.toContain('workflow-lint');
      });

      it('flags a second entry for a required check from another source', () => {
        const responses = drifted((r) => {
          checks(r).push({ context: 'checks', integration_id: 1 });
        });
        expect(driftIds(responses)).toEqual(['main-ruleset-checks-from-actions']);
      });

      it('names the required checks and the Actions app id', () => {
        expect(GITHUB_ACTIONS_APP_ID).toBe(15368);
      });

      it('flags a missing rule, and leaves a missing name to the required-checks setting', () => {
        expect(driftIds(drifted(removeRule('required_status_checks')))).toEqual([
          'main-ruleset-required-checks',
          'main-ruleset-checks-from-actions',
          'main-ruleset-strict-checks',
        ]);
        const responses = drifted((r) => {
          mainRules(r)[1]!.parameters!.required_status_checks = [];
        });
        expect(driftIds(responses)).toEqual([
          'main-ruleset-required-checks',
          'main-ruleset-checks-from-actions',
        ]);
      });
    });

    it('flags a branch that need not be up to date', () => {
      const responses = drifted((r) => {
        mainRules(r)[1]!.parameters!.strict_required_status_checks_policy = false;
      });
      expect(driftIds(responses)).toEqual(['main-ruleset-strict-checks']);
    });

    it('flags missing status checks entirely', () => {
      const responses = drifted(removeRule('required_status_checks'));
      expect(driftIds(responses)).toEqual([
        'main-ruleset-required-checks',
        'main-ruleset-checks-from-actions',
        'main-ruleset-strict-checks',
      ]);
    });

    it.each([
      ['required_linear_history', 'main-ruleset-linear-history'],
      ['non_fast_forward', 'main-ruleset-no-force-push'],
      ['deletion', 'main-ruleset-no-deletion'],
    ])('flags a missing %s rule', (type, id) => {
      expect(driftIds(drifted(removeRule(type)))).toEqual([id]);
    });

    it('reports a ruleset without rules as an error, not as ok', () => {
      const responses = drifted((r) => {
        r['rulesets/1'] = { status: 500, body: null };
        const withoutRules: Record<string, unknown> = mainRuleset();
        delete withoutRules.rules;
        r.rulesets = ok([withoutRules]);
      });
      const result = compareSettings(responses);
      expect(result.errors.map((e) => e.id)).toContain('main-ruleset-no-bypass');
      expect(result.ok).not.toContain('main-ruleset-no-bypass');
    });
  });

  describe('v* tag ruleset', () => {
    it('flags tag creation that is not restricted', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/2').rules = [];
      });
      expect(driftIds(responses)).toEqual([
        'tag-ruleset-creation-restricted',
        'tag-ruleset-creation-admin-bypass',
      ]);
    });

    it('flags a creation bypass that is not Repository admin only', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/2').bypass_actors = [];
      });
      expect(driftIds(responses)).toEqual(['tag-ruleset-creation-admin-bypass']);
      const other = drifted((r) => {
        body(r, 'rulesets/2').bypass_actors = [
          { actor_id: 4, actor_type: 'RepositoryRole', bypass_mode: 'always' },
        ];
      });
      expect(driftIds(other)).toEqual(['tag-ruleset-creation-admin-bypass']);
    });

    it.each(['exempt', 'pull_request', undefined])(
      'flags a Repository admin bypass whose mode is %s',
      (mode) => {
        const responses = drifted((r) => {
          body(r, 'rulesets/2').bypass_actors = [
            { actor_id: ADMIN_ROLE_ACTOR_ID, actor_type: 'RepositoryRole', bypass_mode: mode },
          ];
        });
        const result = compareSettings(responses);
        expect(result.drift.map((d) => d.id)).toEqual(['tag-ruleset-creation-admin-bypass']);
        expect(result.drift[0]!.actual).toContain(`RepositoryRole ${ADMIN_ROLE_ACTOR_ID}`);
        expect(result.drift[0]!.actual).toContain(`(${String(mode)})`);
      },
    );

    it('flags a second bypass actor next to Repository admin', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/2').bypass_actors = [
          { actor_id: ADMIN_ROLE_ACTOR_ID, actor_type: 'RepositoryRole', bypass_mode: 'always' },
          { actor_id: 1, actor_type: 'Team', bypass_mode: 'always' },
        ];
      });
      expect(driftIds(responses)).toEqual(['tag-ruleset-creation-admin-bypass']);
    });

    it('flags update and deletion locks that have a bypass', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/3').bypass_actors = [
          { actor_id: ADMIN_ROLE_ACTOR_ID, actor_type: 'RepositoryRole', bypass_mode: 'always' },
        ];
      });
      expect(driftIds(responses)).toEqual(['tag-ruleset-no-update', 'tag-ruleset-no-deletion']);
    });

    it('flags missing update and deletion rules', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/3').rules = [];
      });
      expect(driftIds(responses)).toEqual(['tag-ruleset-no-update', 'tag-ruleset-no-deletion']);
    });

    it('flags an inactive tag ruleset', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/3').enforcement = 'disabled';
      });
      expect(driftIds(responses)).toEqual(['tag-ruleset-no-update', 'tag-ruleset-no-deletion']);
    });

    describe('coverage of every release tag', () => {
      it.each([
        [
          'creation ruleset',
          'rulesets/2',
          ['tag-ruleset-creation-restricted', 'tag-ruleset-creation-admin-bypass'],
        ],
        ['lock ruleset', 'rulesets/3', ['tag-ruleset-no-update', 'tag-ruleset-no-deletion']],
      ])('does not count the %s when it excludes refs/tags/v0.1.0', (_name, endpoint, ids) => {
        const responses = drifted((r) => {
          body(r, endpoint).conditions = {
            ref_name: { include: ['refs/tags/v*'], exclude: ['refs/tags/v0.1.0'] },
          };
        });
        const result = compareSettings(responses);
        expect(result.drift.map((d) => d.id)).toEqual(ids);
        for (const item of result.drift) {
          expect(item.actual).toContain('excludes refs/tags/v0.1.0');
        }
      });

      it('reports all four tag settings when both rulesets exclude a release tag', () => {
        const responses = drifted((r) => {
          for (const endpoint of ['rulesets/2', 'rulesets/3']) {
            body(r, endpoint).conditions = {
              ref_name: { include: ['refs/tags/v*'], exclude: ['refs/tags/v0.1.0'] },
            };
          }
        });
        expect(driftIds(responses).filter((id) => id.startsWith('tag-ruleset-'))).toHaveLength(4);
      });

      it('names the excluded refs when a covering ruleset lacks the rule', () => {
        const responses = drifted((r) => {
          body(r, 'rulesets/3').conditions = {
            ref_name: { include: ['refs/tags/v*'], exclude: ['refs/tags/v1.*'] },
          };
        });
        const result = compareSettings(responses);
        expect(result.drift.map((d) => d.id)).toEqual([
          'tag-ruleset-no-update',
          'tag-ruleset-no-deletion',
        ]);
        expect(result.drift[0]!.actual).toContain(
          'no update rule; ruleset 3 excludes refs/tags/v1.*',
        );
      });

      it('accepts ~ALL as a target that covers the release tags', () => {
        const responses = drifted((r) => {
          body(r, 'rulesets/3').conditions = { ref_name: { include: ['~ALL'], exclude: [] } };
        });
        expect(driftIds(responses)).toEqual([]);
      });

      it('accepts a ruleset without an exclude list', () => {
        const responses = drifted((r) => {
          body(r, 'rulesets/3').conditions = { ref_name: { include: ['refs/tags/v*'] } };
        });
        expect(driftIds(responses)).toEqual([]);
      });

      it('does not count a narrower pattern such as refs/tags/v1*', () => {
        const responses = drifted((r) => {
          body(r, 'rulesets/3').conditions = {
            ref_name: { include: ['refs/tags/v1*'], exclude: [] },
          };
        });
        expect(driftIds(responses)).toEqual(['tag-ruleset-no-update', 'tag-ruleset-no-deletion']);
      });
    });

    describe('rule layering over the release tags', () => {
      it('flags a second covering ruleset with creation and no bypass', () => {
        const responses = drifted((r) => addRuleset(r, layeredRuleset()));
        const result = compareSettings(responses);
        expect(result.drift.map((d) => d.id)).toEqual(['tag-ruleset-creation-admin-bypass']);
        expect(result.drift[0]!.actual).toContain('ruleset 4 "tags layered"');
        expect(result.drift[0]!.actual).not.toContain('ruleset 2');
      });

      it('names every offending ruleset', () => {
        const responses = drifted((r) => {
          addRuleset(r, layeredRuleset());
          addRuleset(r, layeredRuleset({ id: 5, name: 'tags other' }));
        });
        const actual = compareSettings(responses).drift[0]!.actual;
        expect(actual).toContain('ruleset 4 "tags layered"');
        expect(actual).toContain('ruleset 5 "tags other"');
      });

      it.each(['evaluate', 'disabled'])('ignores the second ruleset in %s mode', (mode) => {
        const responses = drifted((r) => addRuleset(r, layeredRuleset({ enforcement: mode })));
        expect(driftIds(responses)).toEqual([]);
      });

      it.each([
        ['refs/tags/*'],
        ['refs/tags/v1*'],
        ['refs/tags/v1.0.0'],
        ['~ALL'],
        ['refs/tags/**/v*'],
      ])('flags a second ruleset that may apply through %s', (pattern) => {
        const responses = drifted((r) =>
          addRuleset(
            r,
            layeredRuleset({ conditions: { ref_name: { include: [pattern], exclude: [] } } }),
          ),
        );
        expect(driftIds(responses)).toEqual(['tag-ruleset-creation-admin-bypass']);
      });

      it.each([['refs/tags/x*'], ['refs/tags/1.0'], ['refs/heads/main'], ['~DEFAULT_BRANCH']])(
        'ignores a second ruleset that cannot apply through %s',
        (pattern) => {
          const responses = drifted((r) =>
            addRuleset(
              r,
              layeredRuleset({ conditions: { ref_name: { include: [pattern], exclude: [] } } }),
            ),
          );
          expect(driftIds(responses)).toEqual([]);
        },
      );

      it('flags a second ruleset that excludes a tag but may still apply', () => {
        const responses = drifted((r) =>
          addRuleset(
            r,
            layeredRuleset({
              conditions: {
                ref_name: { include: ['refs/tags/v*'], exclude: ['refs/tags/v0.1.0'] },
              },
            }),
          ),
        );
        expect(driftIds(responses)).toEqual(['tag-ruleset-creation-admin-bypass']);
      });

      it('accepts a second covering ruleset with only update and deletion', () => {
        const responses = drifted((r) =>
          addRuleset(r, layeredRuleset({ rules: [{ type: 'update' }, { type: 'deletion' }] })),
        );
        expect(driftIds(responses)).toEqual([]);
      });

      it('accepts a second creation ruleset with the admin Always-allow bypass', () => {
        const responses = drifted((r) =>
          addRuleset(
            r,
            layeredRuleset({
              bypass_actors: [
                {
                  actor_id: ADMIN_ROLE_ACTOR_ID,
                  actor_type: 'RepositoryRole',
                  bypass_mode: 'always',
                },
              ],
            }),
          ),
        );
        expect(driftIds(responses)).toEqual([]);
      });

      it('flags a second creation ruleset whose admin bypass is not Always allow', () => {
        const responses = drifted((r) =>
          addRuleset(
            r,
            layeredRuleset({
              bypass_actors: [
                {
                  actor_id: ADMIN_ROLE_ACTOR_ID,
                  actor_type: 'RepositoryRole',
                  bypass_mode: 'pull_request',
                },
              ],
            }),
          ),
        );
        expect(driftIds(responses)).toEqual(['tag-ruleset-creation-admin-bypass']);
      });

      it('reports an error when an applying ruleset has no rules to read', () => {
        const responses = drifted((r) => {
          addRuleset(r, layeredRuleset());
          delete body(r, 'rulesets/4').rules;
        });
        expect(compareSettings(responses).errors.map((e) => e.id)).toContain(
          'tag-ruleset-creation-admin-bypass',
        );
      });
    });

    it('ignores rulesets for other tag patterns', () => {
      const responses = drifted((r) => {
        body(r, 'rulesets/3').conditions = { ref_name: { include: ['refs/tags/x*'], exclude: [] } };
      });
      expect(driftIds(responses)).toEqual(['tag-ruleset-no-update', 'tag-ruleset-no-deletion']);
    });
  });

  describe('security', () => {
    it('flags private vulnerability reporting being off', () => {
      const responses = drifted((r) => {
        body(r, 'private-vulnerability-reporting').enabled = false;
      });
      expect(driftIds(responses)).toEqual(['private-vulnerability-reporting']);
    });

    it('flags secret scanning and push protection being off', () => {
      const responses = drifted((r) => {
        body(r, 'repository').security_and_analysis = {
          secret_scanning: { status: 'disabled' },
          secret_scanning_push_protection: { status: 'disabled' },
        };
      });
      expect(driftIds(responses)).toEqual(['secret-scanning', 'secret-scanning-push-protection']);
    });

    it('flags Dependabot alerts being off (404 on this endpoint means disabled)', () => {
      const responses = drifted((r) => {
        r['vulnerability-alerts'] = { status: 404, body: { message: 'Not Found' } };
      });
      expect(driftIds(responses)).toEqual(['dependabot-alerts']);
    });
  });

  describe('General', () => {
    it('flags an enabled wiki', () => {
      expect(driftIds(drifted((r) => void (body(r, 'repository').has_wiki = true)))).toEqual([
        'wiki-off',
      ]);
    });

    it('flags branches that stay after merging', () => {
      expect(
        driftIds(drifted((r) => void (body(r, 'repository').delete_branch_on_merge = false))),
      ).toEqual(['delete-branch-on-merge']);
    });

    it.each(['allow_merge_commit', 'allow_rebase_merge'])('flags %s being on', (field) => {
      expect(driftIds(drifted((r) => void (body(r, 'repository')[field] = true)))).toEqual([
        'merge-squash-only',
      ]);
    });

    it('flags squash merge being off', () => {
      expect(
        driftIds(drifted((r) => void (body(r, 'repository').allow_squash_merge = false))),
      ).toEqual(['merge-squash-only']);
    });
  });

  describe('unavailable settings', () => {
    const forbidden = {
      status: 403,
      body: { message: 'Upgrade to GitHub Pro or make this repository public' },
    };

    it('lists plan-gated settings separately and reports no drift for them', () => {
      const responses = drifted((r) => {
        r.rulesets = forbidden;
        r['private-vulnerability-reporting'] = { status: 404, body: { message: 'Not Found' } };
        r['actions/permissions/fork-pr-contributor-approval'] = forbidden;
        delete body(r, 'repository').security_and_analysis;
      });
      const result = compareSettings(responses);
      expect(result.drift).toEqual([]);
      expect(result.errors).toEqual([]);
      const ids = result.unavailable.map((item) => item.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          'main-ruleset-no-bypass',
          'tag-ruleset-no-deletion',
          'private-vulnerability-reporting',
          'fork-pr-approval-all-outside',
          'secret-scanning',
          'secret-scanning-push-protection',
        ]),
      );
      expect(
        result.unavailable.find((item) => item.id === 'main-ruleset-no-bypass')!.reason,
      ).toContain('403');
      expect(result.ok).toContain('wiki-off');
    });

    it('still reports drift on the settings that are available', () => {
      const responses = drifted((r) => {
        r.rulesets = forbidden;
        body(r, 'repository').has_wiki = true;
      });
      expect(driftIds(responses)).toEqual(['wiki-off']);
    });

    it('lists the real private-repository 422 (text in errors) as unavailable', () => {
      const text = 'Fork PR approval is not allowed for private repositories.';
      const responses = drifted((r) => {
        r['actions/permissions/fork-pr-contributor-approval'] = {
          status: 422,
          body: { message: 'Validation Failed', errors: text, status: '422' },
        };
      });
      const result = compareSettings(responses);
      expect(result.errors).toEqual([]);
      expect(result.drift).toEqual([]);
      expect(result.unavailable.map((item) => item.id)).toEqual(['fork-pr-approval-all-outside']);
      expect(result.unavailable[0]!.reason).toBe(`HTTP 422: ${text}`);
    });

    it('also reads the private-repository text from message or a list, ignoring case', () => {
      for (const body of [
        { message: 'NOT ALLOWED FOR PRIVATE REPOSITORIES' },
        { message: 'Validation Failed', errors: ['x', 'Not allowed for private repositories'] },
      ]) {
        const responses = drifted((r) => {
          r['actions/permissions/fork-pr-contributor-approval'] = { status: 422, body };
        });
        const result = compareSettings(responses);
        expect(result.errors).toEqual([]);
        expect(result.unavailable.map((item) => item.id)).toEqual(['fork-pr-approval-all-outside']);
      }
    });

    it('keeps any other 422 as an error', () => {
      const responses = drifted((r) => {
        r['actions/permissions/fork-pr-contributor-approval'] = {
          status: 422,
          body: { message: 'Validation Failed', errors: 'approval_policy is invalid' },
        };
        r['actions/permissions/workflow'] = { status: 422, body: null };
      });
      const result = compareSettings(responses);
      expect(result.unavailable).toEqual([]);
      expect(result.errors.map((e) => e.id)).toEqual([
        'workflow-token-read',
        'actions-no-pr-approval',
        'fork-pr-approval-all-outside',
      ]);
    });

    it('does not treat the private-repository text on other statuses as unavailable', () => {
      const responses = drifted((r) => {
        r['actions/permissions/fork-pr-contributor-approval'] = {
          status: 500,
          body: { message: 'not allowed for private repositories' },
        };
      });
      expect(compareSettings(responses).errors.map((e) => e.id)).toEqual([
        'fork-pr-approval-all-outside',
      ]);
    });

    it('treats other failures as errors, not as unavailable', () => {
      const responses = drifted((r) => {
        r['actions/permissions/workflow'] = { status: 401, body: { message: 'Bad credentials' } };
        r['actions/permissions'] = { status: 0, body: { message: 'gh: not found' } };
      });
      const result = compareSettings(responses);
      expect(result.errors.map((e) => e.id)).toEqual(
        expect.arrayContaining([
          'workflow-token-read',
          'actions-no-pr-approval',
          'actions-sha-pinning',
        ]),
      );
      expect(result.unavailable).toEqual([]);
    });

    it('reports an endpoint that was never collected as an error', () => {
      const responses = drifted((r) => {
        delete r['actions/permissions/workflow'];
      });
      const result = compareSettings(responses);
      expect(result.errors.map((e) => e.id)).toEqual([
        'workflow-token-read',
        'actions-no-pr-approval',
      ]);
    });
  });
});

describe('parseRemote', () => {
  it.each([
    ['git@github.com:vgr-dev/naciocheck.git', 'vgr-dev/naciocheck'],
    ['https://github.com/vgr-dev/naciocheck.git', 'vgr-dev/naciocheck'],
    ['https://github.com/vgr-dev/naciocheck\n', 'vgr-dev/naciocheck'],
  ])('reads %s', (url, expected) => {
    expect(parseRemote(url)).toBe(expected);
  });

  it('returns undefined for a non-GitHub remote', () => {
    expect(parseRemote('git@example.com:a/b.git')).toBeUndefined();
  });
});

describe('parseHttpResponse', () => {
  it('reads status and JSON body from gh api --include output', () => {
    const text = 'HTTP/2.0 200 OK\r\nContent-Type: application/json\r\n\r\n{"enabled":true}\n';
    expect(parseHttpResponse(text)).toEqual({ status: 200, body: { enabled: true } });
  });

  it('reads an empty 204', () => {
    expect(parseHttpResponse('HTTP/2.0 204 No Content\r\nX-A: b\r\n\r\n')).toEqual({
      status: 204,
      body: null,
    });
  });

  it('reads a 404 with a message', () => {
    const text = 'HTTP/2.0 404 Not Found\r\n\r\n{"message":"Not Found"}';
    expect(parseHttpResponse(text)).toEqual({ status: 404, body: { message: 'Not Found' } });
  });

  it('gives status 0 when there is no status line', () => {
    expect(parseHttpResponse('').status).toBe(0);
  });
});

describe('read-only guarantee', () => {
  const source = readFileSync(
    join(import.meta.dirname, '../scripts/check-github-settings.mjs'),
    'utf8',
  );
  // Quoted string literals only, so comments may mention flags by name.
  const literals = [...source.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2]!);

  it('uses no write flag, body or field option', () => {
    for (const flag of ['-f', '-F', '--field', '--raw-field', '--input', '-X', '--method=POST']) {
      expect(literals).not.toContain(flag);
    }
    expect(literals.filter((text) => /^--?(field|raw-field|input)\b/.test(text))).toEqual([]);
    expect(literals.filter((text) => /^(POST|PUT|PATCH|DELETE)$/i.test(text))).toEqual([]);
  });

  it('gives gh api exactly --method GET', () => {
    const args = source.match(/const args = \[([\s\S]*?)\];/)?.[1] ?? '';
    const items = [...args.matchAll(/'([^']*)'/g)].map((match) => match[1]);
    expect(items.slice(0, 3)).toEqual(['api', '--method', 'GET']);
    expect(items.filter((item) => item === '--method')).toHaveLength(1);
    expect(source.match(/'--method'/g)).toHaveLength(1);
    expect(source.match(/'GET'/g)).toHaveLength(1);
  });

  it('runs only gh api (GET) and git remote get-url', () => {
    const commands = [...source.matchAll(/execFileSync\(\s*'([^']+)'\s*,\s*(\[[^\]]*\]|\w+)/g)].map(
      (match) => [match[1], match[2]],
    );
    expect(commands).toEqual([
      ['gh', 'args'],
      ['git', "['remote', 'get-url', 'origin']"],
    ]);
    expect(source.match(/execFileSync\(/g)).toHaveLength(2);
    expect(source).not.toMatch(/(?<![.\w])(spawn|spawnSync|exec|execSync|writeFile|fetch)\s*\(/);
  });
});
