# Plan: User feedback without telemetry

Spec: `spec.md`

**Sign-off:** Approved by Victor Gonzalez on 2026-11-23

## Status

<!-- One line per step, in step order. The only part of this file that changes after sign-off.
[ ] todo | [~] in progress | [x] done | [-] deferred | [!] blocked
After the title: `uncommitted`, a short commit hash, or the reason (deferred/blocked).
Never [x] for partial work. Details live in progress.md.
Group the lines by phase with a bold `**Phase N: <title>**` line, blank line between phases; step
numbers are global across phases. -->

**Phase 1: Pure pieces**

- [x] 1. Build and redact the report 0e519be
- [x] 2. Add the panel and guide texts 0c51155
- [x] 3. Let the site gate admit the feedback pages b965bbf
- [x] 4. Write the Worker's request checks as pure functions 5c27198

**Phase 2: Report input and panel**

- [x] 5. Carry the report input in the result payload 02efc26
- [x] 6. Build the report panel c7ff5ac

**Phase 3: Panel on the pages**

- [x] 7. Offer the panel on the result page d6a24bf
- [x] 8. Offer "this explanation looks wrong" in the guide 2b1a9b1
- [x] 8a. Share one tested browser label helper d947750

**Phase 4: Worker harness**

- [x] 9. Add the Worker, its bindings and its test harness 847ea92

**Phase 5: Endpoint and feedback pages**

- [x] 10. Handle POST /api/feedback uncommitted
- [x] 10a. Give redact a module of its own uncommitted
- [x] 11. Add the feedback pages uncommitted

**Phase 6: End-to-end checks and wording**

- [ ] 12. Cover the panel in the Chrome E2E suite
- [ ] 13. State the feedback channel in the policy and docs

**Phase 7: Visual baselines**

- [ ] 14. Capture the panel and rewrite the Chrome baselines

## Before building (gates)

The builders must not start until each gate below is closed. Answers go into `spec.md` (F1–F8) or into
the "Risks / open questions" list at the end of this plan.

- **G1.** Closed 2026-11-23: the ADR 0005 amendment is accepted and `spec.md` is `status: active`.
- **G2.** Closed 2026-11-23: Q1–Q5 answered (see the end of this plan).
- **G3.** Closed 2026-11-23: the dependency change (F7) is approved: `@cloudflare/vitest-plugin` and
  `@cloudflare/workers-types` as dev dependencies, exact versions recorded in `progress.md`.
- **G4.** Closed 2026-11-23: Q6 answered, and the Turnstile sitekey (Q7) is recorded in step 11.

## Contracts shared by several steps

Fixed here so that parallel builders agree; change them only by amending this plan.

- **Report input (step 1).** `src/core/report.ts` exports
  `type ReportCheck = Pick<Check, 'outcome' | 'statusKey'>` (Q2: the person's own result, `raw` and
  `subStatus`, never enters a report) and
  `interface ReportContext { version: string; browser: string; locale: 'es' | 'en'; errorMessages: readonly string[]; anomaly: string | null }`.
  `buildReport(check: ReportCheck, context: ReportContext): string`,
  `buildGuideReport(statusKey: StatusKey, explanation: string, context: Omit<ReportContext, 'errorMessages' | 'anomaly'>): string`,
  `redact(text: string): string`, `feedbackUrl(report: string, locale: 'es' | 'en'): string`, and
  `REPORT_MAX_CHARS` (proposed 4000). `report.ts` imports types only (`Check`, `StatusKey`): no `wxt`, no
  `i18n`, no `browser`, so the Worker can import `redact` from it.
- **Feedback URL.** `https://naciocheck.vgr.cat/feedback/#<encodeURIComponent(report)>` for `es` (and the
  `qps` pseudo-locale), `https://naciocheck.vgr.cat/en/feedback/#…` for `en`.
- **Result payload (step 5).** `ResultPayload` gains `report: ReportCheck | null`: the check's two fields
  for an `error` or `status` outcome, `{ outcome: 'unknown', statusKey: 'unknown' }` for an unrecognised
  page, `null` for a deleted application. The result page decides from it and the view
  whether to show the panel (step 7).
- **Endpoint (steps 4, 10, 11).** `POST /api/feedback`, `Content-Type: application/json`, body
  `{"text": string, "token": string}`, at most `MAX_BODY_BYTES` (proposed 8192). Responses, no body other
  than a short JSON `{"error": "<code>"}`: `204` sent; `400 bad-body`; `403 origin` / `403 turnstile`;
  `405 method`; `413 too-large`; `415 content-type`; `429 rate-limited`; `502 upstream` (siteverify outage or
  the mail binding threw). Every other `/api/*` path is `404`. The page maps each code to a message.

## Phase 1: Pure pieces

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`;
  all tests pass, no lint errors, Prettier reports no changes, both tsconfigs typecheck, the site check passes
  on the four existing pages.

### 1. Build and redact the report

- **Goal:** `src/core/report.ts` implements the contract above, pure and deterministic.
  - `buildReport` copies the two `ReportCheck` fields by name (never a spread), so an object that also
    carries `raw`, `subStatus`, `applicationId`, `label` or identity values contributes nothing else. The
    text is labelled fields, one per line, in the person's language (Q3): a small `es`/`en` label table
    inside `report.ts` (no i18n import), keyed by `REPORT_FIELDS` = `title`, `version`, `browser`,
    `locale`, `outcome`, `statusKey`, `errors`, `anomaly`, `comment`. es example: `Informe de NacioCheck`,
    `versión`, `navegador`, …, `comentario:`; en: `NacioCheck report`, `version`, `browser`, …,
    `comment:`. The `comment` line is empty, for the person. Empty fields are omitted. No other language
    is produced; a `ca` table arrives only with a `ca` locale.
  - Every site-supplied value (error messages, anomaly) goes through `redact`, then the whole text is
    capped at `REPORT_MAX_CHARS` with a visible `[truncated]` marker.
  - `redact` masks, in this order, with visible masks: NIE-shaped (`[XYZ]?\d{7,8}[A-Z]`, case-insensitive)
    → `[NIE]`; application-number-shaped (`[A-Z]\d{4,9}` as a word) → `[REF]`; dates (`d/m/yyyy`,
    `d-m-yyyy`, `yyyy-mm-dd`, two- or four-digit years) → `[DATE]`; any run of 4+ digits → `[NUMBER]`.
    It is idempotent.
  - `tests/report.test.ts`: the report holds the outcome and status key of a fake check; a fake check
    object carrying a fake `raw`, `subStatus`, identity, label and application id yields a text containing
    none of those values; a key-level test over `REPORT_FIELDS` fails if any key matches
    `/nie|numero|n[uú]mero|birth|year|label|identity|passphrase|application|raw|substatus/i`;
    `expectTypeOf<keyof ReportCheck>()` equals the two keys; es and en labels have the same keys; redaction cases for each mask, mixed text,
    idempotence, and text that must not be masked (`Abierto - En tramitación.`); the cap; `feedbackUrl`
    for `es`, `en` and a report with `#`, `&`, spaces and non-ASCII.
- **Files:** `src/core/report.ts`, `tests/report.test.ts`
- **Verify:** `npx vitest run tests/report.test.ts`; all pass. `npx eslint src/core/report.ts tests/report.test.ts`; clean.
- **Out of scope:** UI, the result payload, the Worker, i18n strings.

### 2. Add the panel and guide texts

- **Goal:** `es.ts` and `en.ts` gain the keys the panel and guide use, same keys and placeholders in both:
  `report.summary` ("Informar de un problema" / "Report a problem"), `report.intro` (what is shared, that
  their own result and identifiers are never included, that nothing leaves until they send it from the
  website, and that they may describe what they saw in their own words in Catalan, Spanish or English), `report.textLabel`,
  `report.copy`, `report.copied`, `report.copyFailed` (select the text and copy it by hand),
  `report.continue` ("Continuar en la web" / "Continue on the website"), `report.continueHint` (opens
  naciocheck.vgr.cat in a new tab; the text travels in the address and is not sent until Send there),
  `statuses.explanationWrong` ("¿Esta explicación parece incorrecta?" / "Does this explanation look wrong?").
  Wording may be polished; keys and placeholders are fixed. Nothing claims to be official.
- **Files:** `src/core/locales/es.ts`, `src/core/locales/en.ts`
- **Verify:** `npx vitest run tests/i18n.test.ts`; key and placeholder parity pass. `npm run typecheck`; clean.
- **Out of scope:** `public/_locales` (manifest strings only), the site pages' texts (step 11).

### 3. Let the site gate admit the feedback pages

- **Goal:** `scripts/check-site.mjs` keeps every rule for every page, plus one scoped exception for
  `feedback/index.html` and `en/feedback/index.html` only:
  - exactly one `<script src="/feedback/feedback.js" defer></script>` (same-origin, absolute path) and exactly
    one `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;
    no inline script, no other `<script>`, no other remote address (the catch-all `https?://` rule ignores
    only that exact Turnstile URL on these two pages);
  - on the feedback pages and `privacy/index.html`, `en/privacy/index.html` only: a plain
    `<a href="https://www.cloudflare.com/turnstile-privacy-policy/">` link (Cloudflare's Turnstile Privacy
    Addendum, checked 2026-11-23; required for invisible mode) is allowed, and nothing else remote;
  - the one non-HTML file allowed under `site/` is `feedback/feedback.js`, which must contain no
    `http://` or `https://` address at all (it posts to the relative `/api/feedback`), no `eval`, no
    `new Function` and no `import(`.
  - `REQUIRED_PAGES` is unchanged here (step 11 adds the two pages once they exist).
  - The `.d.mts` declares any newly exported function. `tests/site-gate.test.ts` adds: the two feedback
    pages with both scripts pass; the Turnstile script on `index.html` fails; a second remote script, a
    Turnstile URL with another path or a query, an inline script, or a third script on a feedback page fail;
    the privacy-addendum link passes on the four allowed pages and fails on `index.html` and `en/index.html`;
    another `cloudflare.com` address fails everywhere;
    a `.js` file other than `feedback/feedback.js` fails; `feedback.js` with an absolute URL fails.
- **Files:** `scripts/check-site.mjs`, `scripts/check-site.d.mts`, `tests/site-gate.test.ts`
- **Verify:** `npx vitest run tests/site-gate.test.ts`; all pass. `npm run check:site`; passes on the four
  existing pages. `npx eslint scripts/check-site.mjs tests/site-gate.test.ts`; clean.
- **Out of scope:** the pages themselves, the success message's page count (step 11).

### 4. Write the Worker's request checks as pure functions

- **Goal:** `worker/checks.ts` holds the decisions of the endpoint as pure functions with no Workers-runtime
  import, so they run under the existing Vitest project:
  - `EXPECTED_ORIGIN = 'https://naciocheck.vgr.cat'`, `EXPECTED_HOSTNAME = 'naciocheck.vgr.cat'`,
    `MAX_BODY_BYTES`.
  - `checkRequest({ method, contentType, origin, secFetchSite, contentLength })` → `null` or one of the
    error codes in the contract (`method`, `content-type`, `origin`, `too-large`). Missing `Origin` is
    rejected; `Sec-Fetch-Site` other than `same-origin`, when present, is rejected.
  - `parseBody(text)` → `{ text, token }` or `bad-body` / `too-large` (byte length measured with
    `TextEncoder`; non-string or empty fields, extra nesting rejected).
  - `readSiteverify(json, expectedHostname)` → `ok` or `turnstile` (requires `success === true` and
    `hostname === expectedHostname`; `error-codes` such as `timeout-or-duplicate` are `turnstile`).
  - `tests/feedback-checks.test.ts` covers each branch.
- **Files:** `worker/checks.ts`, `tests/feedback-checks.test.ts`
- **Verify:** `npx vitest run tests/feedback-checks.test.ts`; all pass. `npx eslint worker/checks.ts tests/feedback-checks.test.ts`; clean.
- **Out of scope:** `fetch`, bindings, `wrangler.jsonc`, tsconfig changes (step 9 moves `worker/` to its own
  tsconfig; this file must stay free of DOM- or Workers-only types so it typechecks under both).

## Phase 2: Report input and panel

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck`; all green.

### 5. Carry the report input in the result payload

- **Goal:** in `src/entrypoints/background.ts`, `ResultPayload` gains `report: ReportCheck | null` per the
  contract, filled in every place a payload is built: the status, error and unknown branches of the check
  flow, the deleted-application branch (`null`), and `resultForCheck` (history reopen). `isResultPayload`
  accepts payloads cached before this change (missing `report` is read as `null`). No identity, label or
  application id enters `report`. `tests/background.test.ts` asserts the field for status, error, unknown,
  deleted and history-reopen payloads, and that it has exactly the two keys (no `raw`, no `subStatus`).
- **Files:** `src/entrypoints/background.ts`, `tests/background.test.ts`
- **Verify:** `npx vitest run tests/background.test.ts`; all pass. `npm run typecheck`; clean.
- **Out of scope:** the result page (step 7), the view model in `src/core/alerts.ts`.

### 6. Build the report panel

- **Goal:** `src/entrypoints/shared/report-panel.ts` exports
  `reportPanel(report: string, locale: 'es' | 'en', summary: MessageKey = 'report.summary'): HTMLElement`:
  a `<details class="report-panel">` closed by default, `<summary>` with `t(summary)`, then `report.intro`, a labelled `<textarea>` prefilled
  with the report (editable, `spellcheck="false"`), and two buttons:
  - Copy: `navigator.clipboard.writeText(textarea.value)`; on success `announceAfter(… 'report.copied')`;
    on failure it selects the textarea and announces `report.copyFailed`. No new permission.
  - Continue on the website: `browser.tabs.create({ url: feedbackUrl(textarea.value, locale) })` (the
    edited text, not the original) and nothing else. One click, one tab.
  - `report-panel.css` styles it with the existing tokens of `pages.css` / `brand.css`, keyboard focus
    visible, tap-sized buttons, works in RTL (`qps`).
  - `tests/report-panel.test.ts` (jsdom, `wxt/testing` fake browser as the other page tests do): closed by
    default; the textarea holds the report; editing then Continue calls `tabs.create` once with the edited
    text in the fragment and the `naciocheck.vgr.cat` host; Copy writes the edited text; Copy failure path.
- **Files:** `src/entrypoints/shared/report-panel.ts`, `src/entrypoints/shared/report-panel.css`,
  `tests/report-panel.test.ts`
- **Verify:** `npx vitest run tests/report-panel.test.ts`; all pass.
  `npx eslint src/entrypoints/shared/report-panel.ts tests/report-panel.test.ts`; clean.
- **Out of scope:** where the panel appears (steps 7 and 8), building the report text.

## Phase 3: Panel on the pages

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck`; all green.
  The E2E visual comparison of the result error view and the guide is expected to fail until Phase 7; do not
  run `npm run test:e2e` here.

### 7. Offer the panel on the result page

- **Goal:** `src/entrypoints/result/main.ts` mirrors `report: ReportCheck | null` in its `ResultPayload`
  and appends `reportPanel(buildReport(payload.report, context), locale)` after the disclaimer and before the
  bottom actions when `payload.report !== null` and either `view.view === 'error'` or `view.anomaly !== null`
  (Q1: no "any result"). `context`: `version` from `browser.runtime.getManifest()`,
  `browser` per Q2, `locale` from `currentLocale().content`, `errorMessages` and `anomaly` from the view.
  A normal status or change without an anomaly shows no panel. Any layout rule specific to the result page
  goes in `result/style.css`.
- **Files:** `src/entrypoints/result/main.ts`, `src/entrypoints/result/style.css`
- **Verify:** `npm run typecheck`; clean. `npx eslint src/entrypoints/result/main.ts`; clean.
- **Out of scope:** `background.ts`, the panel internals, E2E (step 12).

### 8. Offer "this explanation looks wrong" in the guide

- **Goal:** in `src/entrypoints/statuses/main.ts`, each `card()` ends with a `reportPanel` whose summary is
  `statuses.explanationWrong` (the `summary` parameter from step 6) and whose report is
  `buildGuideReport(entry.key, entry[locale].explanation, context)`. Closed by default, so the guide reads
  as before.
- **Files:** `src/entrypoints/statuses/main.ts`
- **Verify:** `npm run typecheck`; clean. `npx eslint src/entrypoints/statuses/main.ts`; clean.
- **Out of scope:** the catalogue texts, the sub-status steps list, the store screenshot of the guide (Q8).

### 8a. Share one tested browser label helper

Added 2026-11-23 after Phase 3: steps 7 and 8 each wrote a local helper (`browserLabel` in
`result/main.ts`, `browserName` in `statuses/main.ts`), and they disagree on Edge for Android.

- **Goal:** `src/core/report.ts` exports `browserLabel(userAgent: string): string`, pure (takes the
  string, never reads `navigator`), returning the browser name and major version only, with no OS (Q2):
  `Edge` (`Edg/`, `EdgA/`), `Opera` (`OPR/`), `Firefox` (`Firefox/`), `Chrome` (`Chrome/`), checked in
  that order, else `unknown`. Both pages call it with `navigator.userAgent` and drop their local helper;
  nothing else in either page changes.
  - `tests/report.test.ts` adds fixed, made-up user-agent strings for desktop Chrome, Chrome on Android,
    desktop Edge, Edge on Android, Opera, desktop Firefox, Firefox for Android and an unknown agent, and
    asserts that no result contains an OS or platform token (`Windows`, `Linux`, `Android`, `Mac`, `X11`).
- **Files:** `src/core/report.ts`, `tests/report.test.ts`, `src/entrypoints/result/main.ts`,
  `src/entrypoints/statuses/main.ts`
- **Verify:** `npx vitest run tests/report.test.ts`; all pass. `npm run typecheck`; clean.
  `npx eslint src/core/report.ts tests/report.test.ts src/entrypoints/result/main.ts src/entrypoints/statuses/main.ts`;
  clean. `grep -rn "function browser" src/entrypoints`; no match.
- **Out of scope:** the report format, the panel, CSS, E2E and baselines.

## Phase 4: Worker harness

Needs G3 (dependency approval).

- **Phase verify:** `npm ci && npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`;
  both Vitest projects pass, no lint errors, Prettier clean, every tsconfig typechecks, site check passes.

### 9. Add the Worker, its bindings and its test harness

- **Goal:**
  - Dev dependencies (approved versions): `@cloudflare/vitest-plugin`, `@cloudflare/workers-types`, with
    caret ranges like the rest of `package.json` (`npm install -D`).
  - `wrangler.jsonc`: `"main": "./worker/index.ts"`; `assets.run_worker_first: ["/api/*"]`; a `ratelimits`
    binding `FEEDBACK_LIMIT` (`namespace_id` an arbitrary integer string, `simple: { limit: 2, period: 60 }`);
    a `send_email` binding `FEEDBACK_MAIL` with `destination_address: "naciocheck@vgr.cat"` (Q6);
    `vars.TURNSTILE_EXPECTED_HOSTNAME` if useful; no secret and no other address;
    `"observability": { "enabled": false }` (Q5).
  - `worker/index.ts`: a skeleton `export default { fetch }` returning `404` for every request (it only ever
    sees `/api/*`); `worker/tsconfig.json` with `@cloudflare/workers-types`, no DOM lib, including `worker/`
    and `tests/worker/`; `tests/worker/tsconfig.json` extending it so ESLint's project service finds it.
  - Root `tsconfig.json` excludes `worker` and `tests/worker` (`worker/checks.ts` is still checked through
    its import from `tests/feedback-checks.test.ts`). `npm run typecheck` adds `tsc --noEmit -p worker/tsconfig.json`.
  - `vitest.config.ts` excludes `tests/worker/**`. `vitest.worker.config.ts` uses the plugin with
    `configPath: './wrangler.jsonc'`, `include: ['tests/worker/**/*.test.ts']`, a dummy
    `TURNSTILE_SECRET` binding value that is clearly not a credential. `npm test` becomes
    `vitest run && vitest run -c vitest.worker.config.ts`; add `test:worker` for the second half.
    Check the plugin's README in `node_modules` for the exact API (`cloudflareTest` vs. `defineWorkersConfig`,
    how to call `exports.default.fetch`, how to stub outbound `fetch`) rather than guessing.
  - `tests/worker/smoke.test.ts`: `GET /api/anything` returns `404`; no outbound request is made.
  - `npm run check:site` still passes (`worker/` is outside `site/`).
- **Files:** `package.json`, `package-lock.json`, `wrangler.jsonc`, `worker/index.ts`, `worker/tsconfig.json`,
  `tests/worker/tsconfig.json`, `tests/worker/smoke.test.ts`, `tsconfig.json`, `vitest.config.ts`,
  `vitest.worker.config.ts`, `eslint.config.js` (only if the worker files need a globals block)
- **Verify:** `npx vitest run -c vitest.worker.config.ts`; smoke passes offline. `npm run typecheck`; all
  three projects clean. `npx eslint worker tests/worker vitest.worker.config.ts`; clean.
- **Out of scope:** the endpoint logic (step 10), deploying, `wrangler secret put`, Email Routing setup.

## Phase 5: Endpoint and feedback pages

Needs G4 (Q6 and Q7).

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site`;
  all green; the site check now lists six pages.

### 10. Handle POST /api/feedback

- **Goal:** `worker/index.ts` routes `/api/feedback` to a handler and everything else under `/api/` to `404`.
  The handler, in order: `checkRequest` → rate limit (`env.FEEDBACK_LIMIT.limit({ key })`, key from
  `CF-Connecting-IP`, `429` when not allowed) → read the body with the size cap → `parseBody` → siteverify
  (`POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response`, `remoteip`;
  network error or non-2xx is `502 upstream`) → `readSiteverify` → `redact(text)` (imported from
  `src/core/report.ts`) → one plain-text email through `env.FEEDBACK_MAIL` from and to
  `naciocheck@vgr.cat` (Q6; if the binding or Email Routing rejects that sender, stop and ask) (subject `NacioCheck feedback`,
  UTF-8 body; build the MIME by hand, no new dependency; if the installed workers-types expose a structured
  `send({ from, to, subject, text })`, use it instead and note it in `progress.md`) → `204`. A thrown send is
  `502 upstream`. No `console.*` call receives the body or the token. Nothing is written anywhere.
  - Local hands-on testing (added 2026-11-23): the expected origin and hostname come from the
    environment, so `wrangler dev` with Cloudflare's test keys works on localhost.
    - `worker/checks.ts`: `checkRequest` takes the expected origin as a parameter instead of reading
      `EXPECTED_ORIGIN`; the constants stay as the production defaults. `tests/feedback-checks.test.ts`
      covers a non-default origin passing and the production origin failing against it.
    - `wrangler.jsonc`: `vars.FEEDBACK_ORIGIN = "https://naciocheck.vgr.cat"` beside
      `TURNSTILE_EXPECTED_HOSTNAME`; `worker/index.ts` types it in `Cloudflare.Env`. The handler passes
      `env.FEEDBACK_ORIGIN` and `env.TURNSTILE_EXPECTED_HOSTNAME` to the checks.
    - `.dev.vars.example` (committed): Cloudflare's public always-pass test secret
      (`1x0000000000000000000000000000000AA`), `TURNSTILE_EXPECTED_HOSTNAME=example.com` (test mode always
      answers `example.com`) and `FEEDBACK_ORIGIN=http://localhost:8787`, each with a one-line comment that
      it is for `wrangler dev` only. `.gitignore` gains `.dev.vars`.
    - `package.json`: `dev:site` runs `wrangler dev` (local; `send_email` is simulated and logs instead of
      sending). Nothing in `npm test` uses it or reaches Cloudflare.
  - `tests/worker/feedback.test.ts` (Workers runtime, offline): stub `FEEDBACK_MAIL` and `FEEDBACK_LIMIT`,
    intercept siteverify (any other outbound `fetch` fails the test). Cases from the spec: a valid post sends
    exactly one email whose body is the redacted text (a fake NIE in the input appears as `[NIE]`); missing
    token, `success: false`, `timeout-or-duplicate`, wrong hostname, siteverify outage, oversized body,
    `GET`, `text/plain`, cross-origin `Origin`, missing `Origin`, rate-limited client: each gets its code and
    sends nothing; `console` spies record nothing containing the text.
- **Files:** `worker/index.ts`, `worker/feedback.ts`, `tests/worker/feedback.test.ts`, `worker/checks.ts`,
  `tests/feedback-checks.test.ts`, `wrangler.jsonc`, `.dev.vars.example`, `.gitignore`, `package.json`
- **Verify:** `npx vitest run -c vitest.worker.config.ts`; all pass offline. `npx vitest run tests/feedback-checks.test.ts`;
  all pass. `npx eslint worker tests/worker tests/feedback-checks.test.ts`; clean. `git check-ignore .dev.vars`;
  prints `.dev.vars`.
- **Out of scope:** the pages, deploying, any real Turnstile secret, running `wrangler dev` against
  Cloudflare (a hands-on check for the user).

### 10a. Give redact a module of its own

Added 2026-11-23 during Phase 5: `worker/feedback.ts` imports `redact` from `src/core/report.ts`, whose
type imports (`Check` from `storage.ts`) pull `storage.ts` and `crypto.ts` into the Worker typecheck, which
has no DOM lib (`crypto`, `navigator`, `LockManager` errors). The user chose to split `redact` out.

- **Goal:** `src/core/redact.ts` holds `redact` and the patterns it uses, moved verbatim, with no imports.
  `src/core/report.ts` imports `redact` from it and re-exports it, so every existing caller and test keeps
  working unchanged. `worker/feedback.ts` imports from `../src/core/redact`. No behaviour change: the
  existing `redact` cases in `tests/report.test.ts` still pass, and a small `tests/redact.test.ts` asserts
  the module has no `import` statements (read its source) and that `report.ts`'s `redact` is the same
  function.
- **Files:** `src/core/redact.ts` (new), `src/core/report.ts`, `worker/feedback.ts`, `tests/redact.test.ts`
  (new)
- **Verify:** `npm run typecheck`; all three projects clean. `npx vitest run tests/report.test.ts tests/redact.test.ts`;
  all pass. `npx vitest run -c vitest.worker.config.ts`; all pass offline.
  `npx eslint src/core/redact.ts src/core/report.ts worker/feedback.ts tests/redact.test.ts`; clean.
- **Out of scope:** the worker tsconfig (stays without DOM), the report format, any other module.

### 11. Add the feedback pages

- **Goal:** `site/feedback/index.html` (es) and `site/en/feedback/index.html` (en): same look as the other
  site pages (inline `<style>`, viewport, title, `lang`), the two scripts allowed by step 3, a labelled
  `<textarea>`, a "this is exactly what will be sent; check it, and remove anything you do not want to share"
  note, a line saying comments are welcome in Catalan, Spanish or English, a Copy button that works without
  Turnstile, a `<div class="cf-turnstile" data-sitekey="0x4AAAAAAGPHi96wZq5N-xcv">` (Q7; public by
  design, so it is committed), a Send button, and an `aria-live` status line. The widget mode is a property
  of the widget in the dashboard, not a page attribute (confirm with the `turnstile-spin` skill): the
  widget is Managed today and may move to Invisible, so the page must work in both, leaving room for a
  visible challenge without depending on it. A sentence that the page uses
  Cloudflare Turnstile, with the privacy-addendum link allowed by step 3. Link back to the site home and to
  the privacy page.
  - `site/feedback/feedback.js` (plain ES2022, no build step): on load reads `location.hash`, decodes it
    into the textarea, then removes the fragment with `history.replaceState`; Send (explicit click only)
    disables itself, reads the Turnstile token, posts `{ text, token }` to the relative `/api/feedback`
    with `Content-Type: application/json`, and shows a message per response code from the contract (es or en
    from `document.documentElement.lang`); resets the widget after a failure. No other request.
  - Local test key (added 2026-11-23): the widget is rendered explicitly by `feedback.js` with
    `turnstile.render`, never implicitly, so the script URL stays exactly as step 3 allows (no `?render=`
    query): the container has no `cf-turnstile` class and carries the real key in `data-sitekey`.
    `feedback.js` uses that real key only when `location.hostname === 'naciocheck.vgr.cat'`, and
    Cloudflare's always-pass test sitekey (`1x00000000000000000000AA`) on any other host. A test key in
    production would fail closed (a production secret rejects test tokens). Handle `api.js` loading before
    or after `feedback.js` (both are deferred, `api.js` also async); confirm the API with the
    `turnstile-spin` skill.
  - `scripts/check-site.mjs`: `REQUIRED_PAGES` gains both pages; the success message stays accurate. Each
    feedback page carries exactly one `data-sitekey`, shaped like a production key (`0x` followed by
    letters, digits, `_` or `-`); Cloudflare's test keys (`1x…`, `2x…`, `3x…`) fail. `tests/site-gate.test.ts`
    covers a real-shaped key passing, each test-key prefix failing, and a missing or doubled key failing.
    `feedback/feedback.js` may contain exactly one Turnstile test key, the always-pass
    `1x00000000000000000000AA`; any other test key or a second one fails.
  - `eslint.config.js`: a block giving `site/**/*.js` browser globals (and `turnstile` as a readonly global).
  - `tests/feedback-page.test.ts` (jsdom): load each page's HTML and run `feedback.js` with a fake
    `turnstile` and a stubbed `fetch`; the fragment fills the textarea and is cleared from the address; Send
    posts the edited text and the token to `/api/feedback` once; nothing is posted without a click; each
    error code shows its message; Copy works without a token; `turnstile.render` gets the real key on
    `naciocheck.vgr.cat` and the test key on `localhost`; rendering happens once whether `turnstile`
    exists before or after `feedback.js` runs.
- **Files:** `site/feedback/index.html`, `site/en/feedback/index.html`, `site/feedback/feedback.js`,
  `scripts/check-site.mjs`, `tests/site-gate.test.ts`, `eslint.config.js`, `tests/feedback-page.test.ts`
- **Verify:** `npm run check:site`; six pages, passes. `npx vitest run tests/feedback-page.test.ts`; all pass.
  `npx vitest run tests/site-gate.test.ts`; all pass.
  `npx eslint site scripts/check-site.mjs tests/feedback-page.test.ts tests/site-gate.test.ts`; clean.
- **Out of scope:** linking the feedback page from the home pages (not in the spec), the privacy wording
  (step 13), the Worker.

## Phase 6: End-to-end checks and wording

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && npm run test:e2e`;
  all green except the visual comparisons of the result error view and the guide, which are rewritten in
  Phase 7; the network guard reports 0 unexpected requests.

### 12. Cover the panel in the Chrome E2E suite

- **Goal:** in `e2e/specs/pages.e2e.ts`, under "result page": after a captured error result
  (`result-error-captcha.htm`), the panel exists, is closed, opens with the keyboard, its text contains the
  outcome and status key, not the status text or sub-status sentence printed on the fixture, and none of
  the seeded fake identity's values (NIE, número, year, birth date, label);
  after editing the text, Continue calls `tabs.create` with `https://naciocheck.vgr.cat/` + `feedback/#`
  and the edited text, asserted by replacing `chrome.tabs.create` in the page with a recorder before the
  click (the tab is never opened, so no request reaches the guard). A normal status result has no panel.
  Under "status guide": each card has a closed "explanation looks wrong" panel. If an unknown-page fixture
  exists (`e2e/fixtures/synthetic-unknown-form.html` or similar), assert the panel there too.
- **Files:** `e2e/specs/pages.e2e.ts`
- **Verify:** `npm run typecheck`; clean. `npm run test:e2e`; the new cases pass and the guard reports 0
  unexpected requests (visual mismatches in `visual.e2e.ts` are expected until step 14).
- **Out of scope:** `visual.e2e.ts`, baselines, the website pages (no E2E loads them).

### 13. State the feedback channel in the policy and docs

- **Goal:** the privacy policy (es + en), `README.md`, `store/permissions.md` and the store listings'
  data-usage text say: the extension sends nothing by itself; "Report a problem" shows the text first and
  only opens the website with it in the address fragment, which is not sent to the server; the feedback page
  loads Cloudflare Turnstile; a report the person sends there goes through Cloudflare to the maintainer by
  email and is not stored; the person's own result and identifiers are never included. The home pages and
  privacy pages keep their "loads nothing from elsewhere" statement for themselves. The privacy pages
  (es + en) link Cloudflare's Turnstile Privacy Addendum
  (`https://www.cloudflare.com/turnstile-privacy-policy/`, allowed there by step 3). The Firefox
  checklist gains a row: open the panel on an error, Copy, Continue opens the feedback page with the text.
  `README.md` also gains a short "test the feedback page locally" note: copy `.dev.vars.example` to
  `.dev.vars`, run `npm run dev:site`, open `http://localhost:8787/feedback/`; Turnstile's test keys still
  contact Cloudflare, so this is a hands-on check, never part of `npm test`.
- **Files:** `site/privacy/index.html`, `site/en/privacy/index.html`, `README.md`, `store/permissions.md`,
  `store/listing.es.md`, `store/listing.en.md`, `docs/manual-firefox-checklist.md`
- **Verify:** `npm run check:site`; passes. `npx vitest run tests/licence.test.ts`; passes (licence
  identifier untouched). `npx prettier --check README.md store docs/manual-firefox-checklist.md site`; clean.
- **Out of scope:** the feedback pages, ADR text, store screenshots.

## Phase 7: Visual baselines

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run check:site && npm run test:e2e`;
  everything green, network guard at 0 unexpected requests.

### 14. Capture the panel and rewrite the Chrome baselines

- **Goal:** `e2e/specs/visual.e2e.ts` adds one capture of the result error view with the panel open (both
  locales, the usual viewports); then `npm run test:e2e:update-baselines` rewrites `e2e/baselines/`. Review
  the changed images with `.claude/commands/review-ui.md` and record the findings in `progress.md`. Only
  the error view, the guide and the new capture may change; any other changed baseline is a regression to
  report, not to accept.
- **Files:** `e2e/specs/visual.e2e.ts`, `e2e/baselines/`
- **Verify:** `npm run test:e2e`; passes against the new baselines. `git status e2e/baselines` lists only
  the expected images.
- **Out of scope:** store screenshots (`store/screenshots/`), Firefox baselines.

## Risks / open questions

Answers recorded 2026-11-23 (also in `spec.md`):

- **Q1 (F2). Answered:** error, unknown page, a status with an anomaly note, and every guide card. Not "any
  result".
- **Q2 (F3). Answered:** version, browser name and major version (from `navigator.userAgent`, no OS),
  locale, outcome, `statusKey`, the page's error messages, the anomaly note. The person's own result (the
  status text and sub-status sentence the site printed) is left out. For an unrecognised status the report
  says only `unknown`; the person may describe it in the comment.
- **Q3 (F4). Answered:** labels and body in the person's language, Catalan, Spanish or English only; today
  `es` or `en` (`qps` → `es`).
- **Q4. Answered:** `REPORT_MAX_CHARS` 4000, Worker body cap 8192 bytes, rate limit 2 per 60 s per IP (user, 2026-11-23).
- **Q5. Answered:** Workers Logs off; the handler logs nothing about the request.
- **Q6 (F1). Answered:** `naciocheck@vgr.cat` is the project's official public address, so it is committed
  as the binding's `destination_address` and used as the sender. If Email Routing rejects sending from and
  to the same address, the builder stops and asks.
- **Q7 (F6). Answered:** the feedback and privacy pages link Cloudflare's Turnstile Privacy Addendum. The
  sitekey is `0x4AAAAAAGPHi96wZq5N-xcv` (from the user's 1Password item, 2026-11-23; public by
  design). The secret stays in 1Password and reaches the Worker only through the user's
  `wrangler secret put TURNSTILE_SECRET`. The widget was created as Managed; Invisible is still the target,
  a dashboard change with no code change. Before deploying, the user restricts the widget's hostname to
  `naciocheck.vgr.cat` (the 1Password item's hostname field is empty).
- **Q8. Answered:** no store screenshot refresh in this spec.
- **Q9 (F5, F8). Partly answered:** the `cloudflare/skills` plugin is installed (user scope); builders use
  its skills and may read docs through its MCP server, never change account state. **Open, not blocking:**
  which release ships this.
- **Risk.** `@cloudflare/vitest-plugin`'s API, Miniflare's local support for `ratelimits` and `send_email`,
  and the `send_email` call shape must be checked against the installed packages in step 9/10; if a binding
  cannot be stubbed offline, the builder stops and reports instead of reaching Cloudflare.
- **Risk.** Clipboard in extension pages needs a user gesture; Firefox for Android is out of scope. The
  manual checklist (step 13) covers Firefox desktop.
- **Deferred to the user:** ADR acceptance, Email Routing and address verification, creating the Turnstile
  widget, `wrangler secret put TURNSTILE_SECRET`, `npm run deploy:site`, and the final hands-on report from
  the real extension (last acceptance criterion).
