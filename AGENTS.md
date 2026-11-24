# NacioCheck

A personal browser extension for Chrome and Firefox (desktop and Firefox for Android) that turns checking a
Spanish nationality-by-residence application into _reminder → captcha → result_: it autofills the official
form, shows only the captcha, submits once the human has solved it, reads the status, stores every check
locally and alerts loudly when the status changes. Not affiliated with the Ministerio de Justicia.

## Stack

- TypeScript on WXT (Manifest V3, one source tree for Chrome and Firefox), Node 24 (`.nvmrc`)
- Vitest (unit), WebdriverIO (Chrome E2E), ESLint (typed), Prettier, Sharp (icons at build time)
- Developed from WSL2; E2E runs the Linux Chrome for Testing, the Windows browsers are for hands-on checks

## Commands

- Install: `npm ci` (runs `wxt prepare`)
- Test (all): `npm test`; filtered: `npx vitest run tests/<file>.test.ts`
- Lint / format: `npm run lint`; `npm run format` (check: `npm run format:check`)
- Typecheck: `npm run typecheck`
- Privacy gate: `npm run check:privacy` (needs a build first)
- Build: `npm run build:chrome` / `npm run build:firefox`
- Dev: `npm run dev` (Chrome) / `npm run dev:firefox`
- E2E (Chrome only): `npm run test:e2e` (headless, builds both browsers); `npm run test:e2e:headed`
- E2E baselines: `npm run test:e2e:update-baselines` (rewrites `e2e/baselines/`)
- Site: `npm run build:site` (`site/` + `CHANGELOG.md` -> `.output/site/`); `npm run check:site` builds first, offline
- Packages: `npm run zip`, `npm run zip:sources`

## Standards

- Licence is GPL-3.0-or-later; the identifier appears in `README.md`, this file and `store/permissions.md`
  (`tests/licence.test.ts` checks it). Browser archives must carry the licence notices.
- Identity: the product is NacioCheck, slug `naciocheck`, gecko id `naciocheck@vgr.cat`. The gecko id can
  never change after the first AMO upload. Brand rules (colours, icon, logo, tagline) are in `brand/README.md`;
  the logotype ships as outlined paths, never a remote font.
- Fake identities only in tests, fixtures, baselines, screenshots, store images and logs: the repo and the
  store listings become public. `tests/fixtures/` stays byte-for-byte.
- Tests run the production build unchanged: no test-only permissions, host patterns, manifest `key` or build
  flags. The E2E network guard must stay at 0 unexpected requests.
- When encryption is on, no identity is ever written to storage in plain form, and no form keeps the
  passphrase.
- Status explanations are never presented as official.
- Firefox desktop is verified by hand with `docs/manual-firefox-checklist.md` before each release.

## Boundaries

- Never: bypass, solve or outsource the captcha; make a network request from the extension; add telemetry;
  use `storage.sync`; send personal data anywhere; strip response headers; reach the live sede or reCAPTCHA
  from a test or a tool; commit personal data (the git history becomes public).
- Never: run `npm run deploy:site`, upload to a store, or change repository visibility. Those are the user's.
- Ask first: any new manifest permission or host pattern (`npm run check:privacy` allows exactly one host),
  new URLs in `scripts/allowed-urls.json`, dependency changes, anything that touches a settled decision in
  `docs/adr/`.

## Rules index

- UI review of the screenshot matrix: `.claude/commands/review-ui.md` (read-only; run it after visual changes)
- Decisions: `docs/adr/0002`…`0007` (stack, captcha, local data and encryption, distribution, brand and
  licence, testing). If you think one is wrong, raise it with the user rather than silently reverting it.
- Open release gates and the audit trail: `docs/pre-release-audit-2026-11-18.md`

## Workflow

- Spec-driven: see `docs/adr/0001-agent-workflow.md`. Work lives in `specs/<date>-<slug>/`.
- stale-after-days: 14
- Commit format: Conventional Commits, one line, imperative, at most 72 characters, no `"` characters.
  Agents propose the message; the user commits.
