#!/usr/bin/env node
/**
 * Read-only check of the GitHub repository settings against `docs/github-settings.md`.
 *
 * It reads the settings through `gh api --method GET` and prints one line per setting: ok, drift
 * (the setting differs from the checklist), unavailable (HTTP 403/404 or plan-gated, for example
 * rulesets, secret scanning and private vulnerability reporting on a private Free-plan repository),
 * or error (anything else, such as a bad login or a network failure). It never writes to GitHub: only
 * GET requests, no request body, no fields.
 *
 * Usage: `node scripts/check-github-settings.mjs [owner/repo]` (defaults to the `origin` remote).
 * Exit 1 when any setting drifts or could not be read; exit 0 otherwise. Unavailable settings do not
 * fail the run by themselves: once the repository is public every setting is available.
 *
 * Endpoints and response shapes, from the GitHub REST docs:
 * - Actions permissions, selected actions, workflow permissions and fork PR contributor approval:
 *   https://docs.github.com/en/rest/actions/permissions
 * - Repository rulesets (list and get one):
 *   https://docs.github.com/en/rest/repos/rules
 * - Get a repository (merge methods, wiki, `security_and_analysis`):
 *   https://docs.github.com/en/rest/repos/repos#get-a-repository
 * - Private vulnerability reporting and vulnerability alerts (204 enabled, 404 disabled):
 *   https://docs.github.com/en/rest/repos/repos
 *
 * The `actor_id` of the Repository admin role is not documented on those pages. `5` is the value
 * GitHub's own UI and API use for it; step 10 of the spec confirms it against the real ruleset.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

/** The CI job ids that the `main` ruleset must require. */
export const REQUIRED_CHECKS = ['checks', 'workflow-lint'];
/** `actor_id` of the Repository admin role in a ruleset's `bypass_actors` (see the header). */
export const ADMIN_ROLE_ACTOR_ID = 5;

const REPO_ENDPOINT = 'repository';
const SELECTED_ACTIONS_ENDPOINT = 'actions/permissions/selected-actions';
const RULESETS_ENDPOINT = 'rulesets';

const isOk = (response) =>
  response !== undefined && response.status >= 200 && response.status < 300;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A check result helper: `undefined` means the setting matches. */
const drift = (actual) => ({ drift: actual });
const unavailable = (reason) => ({ unavailable: reason });
const error = (reason) => ({ error: reason });

/** Compares one boolean-like field. */
function expectField(body, field, expected) {
  if (!isRecord(body) || body[field] === undefined) {
    return unavailable(`"${field}" not returned`);
  }
  return body[field] === expected ? undefined : drift(`${field} is ${JSON.stringify(body[field])}`);
}

/** Does `include` target the default branch? */
function includesMain(ruleset) {
  const include = ruleset?.conditions?.ref_name?.include;
  return (
    Array.isArray(include) &&
    (include.includes('~DEFAULT_BRANCH') || include.includes('refs/heads/main'))
  );
}

function includesVTags(ruleset) {
  const include = ruleset?.conditions?.ref_name?.include;
  return Array.isArray(include) && include.includes('refs/tags/v*');
}

/**
 * The full rulesets (detail response when collected, otherwise the list item) for one target.
 * Returns `{ error }` when a ruleset has no `rules` array to read.
 */
function rulesetsFor(list, responses, target, matches, { activeOnly }) {
  if (!Array.isArray(list)) return { error: 'the rulesets list is not an array' };
  const found = [];
  for (const summary of list) {
    if (!isRecord(summary)) continue;
    const detail = responses[`${RULESETS_ENDPOINT}/${summary.id}`];
    const ruleset = isOk(detail) && isRecord(detail.body) ? detail.body : summary;
    if (ruleset.target !== target || !matches(ruleset)) continue;
    if (!Array.isArray(ruleset.rules)) {
      return { error: `ruleset ${String(summary.id)} has no rules in the response` };
    }
    if (activeOnly && ruleset.enforcement !== 'active') continue;
    found.push(ruleset);
  }
  return { rulesets: found };
}

const rulesOfType = (rulesets, type) =>
  rulesets.flatMap((ruleset) => ruleset.rules.filter((rule) => rule?.type === type));

const hasBypass = (ruleset) =>
  Array.isArray(ruleset.bypass_actors) && ruleset.bypass_actors.length > 0;

const isAdminOnlyBypass = (ruleset) =>
  Array.isArray(ruleset.bypass_actors) &&
  ruleset.bypass_actors.length === 1 &&
  ruleset.bypass_actors[0]?.actor_type === 'RepositoryRole' &&
  ruleset.bypass_actors[0]?.actor_id === ADMIN_ROLE_ACTOR_ID;

/** Wraps a check on the active rulesets that target `main`. */
function onMain(check) {
  return (list, responses) => {
    const result = rulesetsFor(list, responses, 'branch', includesMain, { activeOnly: true });
    if (result.error) return error(result.error);
    if (result.rulesets.length === 0) return drift('no active ruleset targets main');
    return check(result.rulesets);
  };
}

/** Wraps a check on the active rulesets that target `v*` tags. */
function onTags(check) {
  return (list, responses) => {
    const result = rulesetsFor(list, responses, 'tag', includesVTags, { activeOnly: true });
    if (result.error) return error(result.error);
    if (result.rulesets.length === 0) return drift('no active ruleset targets refs/tags/v*');
    return check(result.rulesets);
  };
}

/** A rule of this type must exist in some active ruleset on `main`. */
const mainHasRule = (type) =>
  onMain((rulesets) =>
    rulesOfType(rulesets, type).length > 0 ? undefined : drift(`no ${type} rule`),
  );

function pullRequestParameters(rulesets) {
  return rulesOfType(rulesets, 'pull_request').map((rule) => rule.parameters ?? {});
}

/**
 * Tag rulesets: the creation rule may be bypassed by Repository admin only (the owner publishes the
 * draft release in the UI, which creates the tag); update and deletion must have no bypass at all.
 * A bypass list applies to a whole ruleset, so these live in separate rulesets.
 */
function tagRuleCheck(type, bypassOk) {
  return onTags((rulesets) => {
    const withRule = rulesets.filter((ruleset) =>
      ruleset.rules.some((rule) => rule?.type === type),
    );
    if (withRule.length === 0) return drift(`no ${type} rule`);
    return withRule.some(bypassOk) ? undefined : drift(`${type} rule has the wrong bypass actors`);
  });
}

/**
 * Every setting the checklist covers. `check(body, responses)` runs on a successful response of
 * `endpoint` and returns `undefined` (ok), `{ drift }`, `{ unavailable }` or `{ error }`.
 * `extraEndpoints` are also collected for the check. `missingIsDrift` turns a 404 into drift.
 * Endpoints are relative to `repos/{owner}/{repo}/`; `repository` is the repository itself.
 */
export const EXPECTED_SETTINGS = [
  {
    id: 'actions-allowed-github-owned',
    endpoint: 'actions/permissions',
    extraEndpoints: [SELECTED_ACTIONS_ENDPOINT],
    describe: 'Actions may run only GitHub-owned actions (no verified creators, no patterns)',
    check(body, responses) {
      if (!isRecord(body) || body.allowed_actions === undefined) {
        return unavailable('"allowed_actions" not returned');
      }
      if (body.allowed_actions !== 'selected')
        return drift(`allowed_actions is "${String(body.allowed_actions)}"`);
      const selected = responses[SELECTED_ACTIONS_ENDPOINT];
      if (!isOk(selected) || !isRecord(selected.body)) {
        return error(`${SELECTED_ACTIONS_ENDPOINT} returned HTTP ${String(selected?.status)}`);
      }
      const { github_owned_allowed, verified_allowed, patterns_allowed } = selected.body;
      const problems = [];
      if (github_owned_allowed !== true) problems.push('github_owned_allowed is not true');
      if (verified_allowed !== false) problems.push('verified_allowed is not false');
      if (!Array.isArray(patterns_allowed) || patterns_allowed.length > 0) {
        problems.push('patterns_allowed is not empty');
      }
      return problems.length > 0 ? drift(problems.join('; ')) : undefined;
    },
  },
  {
    id: 'actions-sha-pinning',
    endpoint: 'actions/permissions',
    describe: 'Actions must be pinned to a full commit SHA',
    check: (body) => expectField(body, 'sha_pinning_required', true),
  },
  {
    id: 'workflow-token-read',
    endpoint: 'actions/permissions/workflow',
    describe: 'The default GITHUB_TOKEN is read-only',
    check: (body) => expectField(body, 'default_workflow_permissions', 'read'),
  },
  {
    id: 'actions-no-pr-approval',
    endpoint: 'actions/permissions/workflow',
    describe: 'Actions may not create or approve pull requests',
    check: (body) => expectField(body, 'can_approve_pull_request_reviews', false),
  },
  {
    id: 'fork-pr-approval-all-outside',
    endpoint: 'actions/permissions/fork-pr-contributor-approval',
    describe: 'Fork pull request workflows need approval for all outside contributors',
    check: (body) => expectField(body, 'approval_policy', 'all_external_contributors'),
  },
  {
    id: 'main-ruleset-active',
    endpoint: RULESETS_ENDPOINT,
    describe: 'A ruleset on the default branch (main) is active',
    check(list, responses) {
      const result = rulesetsFor(list, responses, 'branch', includesMain, { activeOnly: false });
      if (result.error) return error(result.error);
      if (result.rulesets.length === 0) return drift('no ruleset targets main');
      const active = result.rulesets.filter((ruleset) => ruleset.enforcement === 'active');
      if (active.length === 0) {
        return drift(`enforcement is "${String(result.rulesets[0].enforcement)}"`);
      }
      const excluding = active.some(
        (ruleset) => (ruleset.conditions?.ref_name?.exclude ?? []).length > 0,
      );
      return excluding ? drift('the ruleset excludes some refs') : undefined;
    },
  },
  {
    id: 'main-ruleset-no-bypass',
    endpoint: RULESETS_ENDPOINT,
    describe: 'The main ruleset has no bypass actors, so it applies to the owner too',
    check: onMain((rulesets) => {
      const bypassing = rulesets.filter(hasBypass);
      return bypassing.length > 0
        ? drift(`${bypassing.length} ruleset(s) list bypass actors`)
        : undefined;
    }),
  },
  {
    id: 'main-ruleset-pull-request',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Every change to main goes through a pull request',
    check: mainHasRule('pull_request'),
  },
  {
    id: 'main-ruleset-zero-approvals',
    endpoint: RULESETS_ENDPOINT,
    describe: 'The pull request rule requires 0 approvals (the owner is the only maintainer)',
    check: onMain((rulesets) => {
      const rules = pullRequestParameters(rulesets);
      if (rules.length === 0) return drift('no pull_request rule');
      const counts = rules.map((rule) => rule.required_approving_review_count);
      return counts.every((count) => count === 0)
        ? undefined
        : drift(`required_approving_review_count is ${JSON.stringify(counts)}`);
    }),
  },
  {
    id: 'main-ruleset-conversation-resolution',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Conversations must be resolved before merging',
    check: onMain((rulesets) => {
      const rules = pullRequestParameters(rulesets);
      if (rules.length === 0) return drift('no pull_request rule');
      return rules.some((rule) => rule.required_review_thread_resolution === true)
        ? undefined
        : drift('required_review_thread_resolution is not true');
    }),
  },
  {
    id: 'main-ruleset-squash-only',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Squash is the only allowed merge method',
    check: onMain((rulesets) => {
      const rules = pullRequestParameters(rulesets);
      if (rules.length === 0) return drift('no pull_request rule');
      const squashOnly = rules.some(
        (rule) =>
          Array.isArray(rule.allowed_merge_methods) &&
          rule.allowed_merge_methods.length === 1 &&
          rule.allowed_merge_methods[0] === 'squash',
      );
      return squashOnly
        ? undefined
        : drift(
            `allowed_merge_methods is ${JSON.stringify(rules.map((rule) => rule.allowed_merge_methods))}`,
          );
    }),
  },
  {
    id: 'main-ruleset-required-checks',
    endpoint: RULESETS_ENDPOINT,
    describe: `The checks ${REQUIRED_CHECKS.join(' and ')} must pass`,
    check: onMain((rulesets) => {
      const rules = rulesOfType(rulesets, 'required_status_checks');
      if (rules.length === 0) return drift('no required_status_checks rule');
      const contexts = new Set(
        rules.flatMap((rule) =>
          (rule.parameters?.required_status_checks ?? []).map((check) => check?.context),
        ),
      );
      const missing = REQUIRED_CHECKS.filter((name) => !contexts.has(name));
      return missing.length > 0
        ? drift(`missing required checks: ${missing.join(', ')}`)
        : undefined;
    }),
  },
  {
    id: 'main-ruleset-strict-checks',
    endpoint: RULESETS_ENDPOINT,
    describe: 'The branch must be up to date before merging',
    check: onMain((rulesets) => {
      const rules = rulesOfType(rulesets, 'required_status_checks');
      if (rules.length === 0) return drift('no required_status_checks rule');
      return rules.some((rule) => rule.parameters?.strict_required_status_checks_policy === true)
        ? undefined
        : drift('strict_required_status_checks_policy is not true');
    }),
  },
  {
    id: 'main-ruleset-linear-history',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Linear history is required',
    check: mainHasRule('required_linear_history'),
  },
  {
    id: 'main-ruleset-no-force-push',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Force pushes to main are blocked',
    check: mainHasRule('non_fast_forward'),
  },
  {
    id: 'main-ruleset-no-deletion',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Deleting main is blocked',
    check: mainHasRule('deletion'),
  },
  {
    id: 'tag-ruleset-creation-restricted',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Creating v* tags is restricted',
    check: onTags((rulesets) =>
      rulesOfType(rulesets, 'creation').length > 0 ? undefined : drift('no creation rule'),
    ),
  },
  {
    id: 'tag-ruleset-creation-admin-bypass',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Only Repository admin may create v* tags (publishing the draft release)',
    check: tagRuleCheck('creation', isAdminOnlyBypass),
  },
  {
    id: 'tag-ruleset-no-update',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Updating v* tags is blocked, with no bypass actors',
    check: tagRuleCheck('update', (ruleset) => !hasBypass(ruleset)),
  },
  {
    id: 'tag-ruleset-no-deletion',
    endpoint: RULESETS_ENDPOINT,
    describe: 'Deleting v* tags is blocked, with no bypass actors',
    check: tagRuleCheck('deletion', (ruleset) => !hasBypass(ruleset)),
  },
  {
    id: 'private-vulnerability-reporting',
    endpoint: 'private-vulnerability-reporting',
    describe: 'Private vulnerability reporting is on',
    check: (body) => expectField(body, 'enabled', true),
  },
  {
    id: 'secret-scanning',
    endpoint: REPO_ENDPOINT,
    describe: 'Secret scanning is on',
    check: (body) => securityStatus(body, 'secret_scanning'),
  },
  {
    id: 'secret-scanning-push-protection',
    endpoint: REPO_ENDPOINT,
    describe: 'Secret scanning push protection is on',
    check: (body) => securityStatus(body, 'secret_scanning_push_protection'),
  },
  {
    id: 'dependabot-alerts',
    endpoint: 'vulnerability-alerts',
    describe: 'Dependabot alerts are on',
    // 204 means enabled; 404 means disabled.
    missingIsDrift: true,
    check: () => undefined,
  },
  {
    id: 'wiki-off',
    endpoint: REPO_ENDPOINT,
    describe: 'The wiki is off',
    check: (body) => expectField(body, 'has_wiki', false),
  },
  {
    id: 'delete-branch-on-merge',
    endpoint: REPO_ENDPOINT,
    describe: 'Head branches are deleted after a pull request merges',
    check: (body) => expectField(body, 'delete_branch_on_merge', true),
  },
  {
    id: 'merge-squash-only',
    endpoint: REPO_ENDPOINT,
    describe: 'Squash merge is the only allowed merge method',
    check(body) {
      const fields = {
        allow_squash_merge: true,
        allow_merge_commit: false,
        allow_rebase_merge: false,
      };
      for (const [field, expected] of Object.entries(fields)) {
        const result = expectField(body, field, expected);
        if (result) return result;
      }
      return undefined;
    },
  },
];

/** `security_and_analysis` is only returned to admins, and only for features the plan offers. */
function securityStatus(body, feature) {
  const analysis = isRecord(body) ? body.security_and_analysis : undefined;
  if (!isRecord(analysis)) return unavailable('security_and_analysis not returned');
  const status = analysis[feature]?.status;
  if (status === undefined) return unavailable(`${feature} not returned`);
  return status === 'enabled' ? undefined : drift(`${feature} is "${String(status)}"`);
}

/** Every endpoint the check reads, without the per-ruleset detail requests the CLI adds. */
export function endpointsToCollect() {
  const endpoints = new Set();
  for (const setting of EXPECTED_SETTINGS) {
    endpoints.add(setting.endpoint);
    for (const extra of setting.extraEndpoints ?? []) endpoints.add(extra);
  }
  return [...endpoints];
}

/**
 * Compares collected responses with the checklist. `responses` maps an endpoint (as in
 * `EXPECTED_SETTINGS`, plus `rulesets/<id>` for each ruleset) to `{ status, body }`.
 * Returns `{ ok, drift, unavailable, errors }`: `ok` lists ids; the others list
 * `{ id, describe, ... }` with the actual value or the reason.
 */
export function compareSettings(responses) {
  const result = { ok: [], drift: [], unavailable: [], errors: [] };
  for (const setting of EXPECTED_SETTINGS) {
    const { id, describe } = setting;
    const response = responses[setting.endpoint];
    if (response === undefined) {
      result.errors.push({ id, describe, reason: `${setting.endpoint} was not collected` });
      continue;
    }
    if (!isOk(response)) {
      const message =
        isRecord(response.body) && typeof response.body.message === 'string'
          ? `: ${response.body.message}`
          : '';
      if (response.status === 404 && setting.missingIsDrift) {
        result.drift.push({ id, describe, actual: 'not enabled (HTTP 404)' });
      } else if (response.status === 403 || response.status === 404) {
        result.unavailable.push({ id, describe, reason: `HTTP ${response.status}${message}` });
      } else {
        result.errors.push({ id, describe, reason: `HTTP ${response.status}${message}` });
      }
      continue;
    }
    const outcome = setting.check(response.body, responses);
    if (outcome === undefined) result.ok.push(id);
    else if ('drift' in outcome) result.drift.push({ id, describe, actual: outcome.drift });
    else if ('unavailable' in outcome)
      result.unavailable.push({ id, describe, reason: outcome.unavailable });
    else result.errors.push({ id, describe, reason: outcome.error });
  }
  return result;
}

/** `owner/repo` from a git remote URL (ssh or https), or `undefined`. */
export function parseRemote(url) {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : undefined;
}

/** Parses the output of `gh api --include`: a status line, headers, a blank line, then the body. */
export function parseHttpResponse(text) {
  const separator = /\r?\n\r?\n/.exec(text);
  const head = separator ? text.slice(0, separator.index) : text;
  const rest = separator ? text.slice(separator.index + separator[0].length) : '';
  const status = Number(/^HTTP\/\S+\s+(\d{3})/.exec(head)?.[1] ?? 0);
  const raw = rest.trim();
  if (raw === '') return { status, body: null };
  try {
    return { status, body: JSON.parse(raw) };
  } catch {
    return { status, body: raw };
  }
}

/** The only place that talks to GitHub: a GET through `gh api`, with the status kept on failure. */
function ghGet(path) {
  const args = [
    'api',
    '--method',
    'GET',
    '--include',
    '-H',
    'Accept: application/vnd.github+json',
    '-H',
    'X-GitHub-Api-Version: 2022-11-28',
    path,
  ];
  let output;
  try {
    output = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (failure) {
    output = typeof failure?.stdout === 'string' ? failure.stdout : '';
    if (output === '') return { status: 0, body: { message: String(failure?.message ?? failure) } };
  }
  return parseHttpResponse(output);
}

function defaultRepo() {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return parseRemote(url);
}

function collect(repo) {
  const responses = {};
  for (const endpoint of endpointsToCollect()) {
    const path = endpoint === REPO_ENDPOINT ? `repos/${repo}` : `repos/${repo}/${endpoint}`;
    responses[endpoint] = ghGet(path);
  }
  const list = responses[RULESETS_ENDPOINT];
  if (isOk(list) && Array.isArray(list.body)) {
    for (const ruleset of list.body) {
      if (!Number.isInteger(ruleset?.id)) continue;
      const endpoint = `${RULESETS_ENDPOINT}/${ruleset.id}`;
      responses[endpoint] = ghGet(`repos/${repo}/${endpoint}`);
    }
  }
  return responses;
}

function main() {
  const repo = process.argv[2] ?? defaultRepo();
  if (repo === undefined || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    console.error('Usage: node scripts/check-github-settings.mjs [owner/repo]');
    process.exit(2);
  }
  const result = compareSettings(collect(repo));
  const byId = new Map(EXPECTED_SETTINGS.map((setting) => [setting.id, setting]));
  const lines = new Map();
  for (const id of result.ok) lines.set(id, `ok           ${id}: ${byId.get(id).describe}`);
  for (const item of result.drift)
    lines.set(item.id, `DRIFT        ${item.id}: ${item.describe} (${item.actual})`);
  for (const item of result.unavailable)
    lines.set(item.id, `unavailable  ${item.id}: ${item.reason}`);
  for (const item of result.errors) lines.set(item.id, `ERROR        ${item.id}: ${item.reason}`);
  console.log(`GitHub settings for ${repo} (GET requests only)`);
  for (const setting of EXPECTED_SETTINGS) console.log(`  ${lines.get(setting.id)}`);
  console.log(
    `  ${result.ok.length} ok, ${result.drift.length} drift, ${result.unavailable.length} unavailable, ${result.errors.length} error`,
  );
  if (result.drift.length > 0 || result.errors.length > 0) process.exit(1);
}

if (resolve(process.argv[1] ?? '') === SCRIPT_PATH) main();
