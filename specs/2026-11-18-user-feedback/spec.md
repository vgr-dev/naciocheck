---
status: active # draft | active | done | abandoned
created: 2026-11-18
status-date: 2026-11-23
---

# User feedback without telemetry: a report the person reviews and sends themselves

## Goal

A person who meets a result NacioCheck cannot read (an unrecognised status, a failed check, an explanation
that looks wrong) can tell the maintainer in a few clicks, with exactly the text that would be shared shown on
screen first. Nothing leaves the browser unless they send it themselves, and they need no account. This
replaces the dropped site canary: the maintainer needs to learn about errors, unrecognised states and wrong
explanations from the people using the extension (ADR 0004 forbids telemetry).

## Approach

The extension never sends anything. Its "Send" action opens `https://naciocheck.vgr.cat/feedback/#<report>`
(or `/en/feedback/`) in a new tab. The report travels in the URL fragment, which browsers do not send to the
server. The feedback page shows the text, the person edits it, passes a Turnstile check and presses Send,
and the page posts the text and the Turnstile token to `POST /api/feedback` on the same Worker that serves
the site. The Worker validates the token with Turnstile's siteverify, applies its own checks, and mails the
text to `naciocheck@vgr.cat` through the Cloudflare `send_email` binding, restricted to that one
destination address. Nothing is stored. Because the channel lives on the site, it can change later (GitHub
issues once the repo is public, another channel) without an extension release. See the 2026-11-23
amendment to ADR 0005.

## Scope

- Extension: a "Report a problem" panel on the result page for an error, an unknown page or an anomaly note,
  and a "this explanation looks wrong" entry in the status guide.
- The report is an editable text built from non-identifying fields only (extension version, browser name
  and major version, locale, outcome, `statusKey`, the page's error messages, the anomaly note), passed
  through a redaction pass that masks anything shaped like a NIE, an application number, a date or a long
  number, with the masks visible. The person's own result (the status text and sub-status sentence the site
  printed for them) is never included (F3). Labels and the body are in the person's language: Catalan,
  Spanish or English only (F4).
- Two buttons in the panel: Copy (works offline) and Continue on the website (a new tab on the feedback page
  with the report in the fragment).
- A pure report builder and redactor in `src/core/` whose signature takes a check, never an application or
  identity, so "no identifier" is a property of the types. The Worker reuses the same `redact`.
- Site: `/feedback/` and `/en/feedback/` pages that read the fragment into a textarea, show what will be sent,
  render a Turnstile widget (Invisible as the target, Managed accepted; the mode is set in the dashboard), and post the text with the token on an explicit Send click. Copy stays available
  on the page and works without Turnstile. The pages carry one same-origin script and Turnstile's
  `https://challenges.cloudflare.com/turnstile/v0/api.js`, loaded from that exact URL (Cloudflare forbids
  proxying it); no other page gains a script. The feedback and privacy pages link to Cloudflare's Turnstile
  privacy policy.
- Worker: `POST /api/feedback` that accepts only a same-origin JSON body under a size cap, rate-limits per
  client, and rejects the request unless siteverify returns `success` for the token with the expected
  hostname. Only then does it re-run `redact` and send one plain-text email to `naciocheck@vgr.cat`. No KV,
  D1, R2 or logging of the body; Workers Logs stay off (Q5).
- The Turnstile secret is a Worker secret set by the user (`wrangler secret put`), never in the repo or the
  Wrangler config; the sitekey is public and lives in the page.
- es and en texts, keyboard and screen-reader friendly; Chrome E2E and visual baselines for the panel; offline
  tests for the page and the Worker; privacy policy (es + en), README, store texts and the Firefox checklist
  say what the panel and the page do.

## Non-goals

- Any automatic or background sending from the extension, crash reporting, analytics or counters.
- Storing reports anywhere but the maintainer's inbox; a reply channel or ticket system.
- Asking for the person's email address. If a reply option is ever wanted, it is a separate change.
- Attaching a screenshot, the history, a store export, or anything that identifies the person.
- A general feature-request form (the issue tracker serves that once the repo is public).
- Firefox for Android on a device.
- `mailto:` links (need a public address and the person's mail client).

## Relevant files

- `src/core/report.ts` (new): `buildReport(check, context)` and `redact(text)`, pure.
- `tests/report.test.ts` (new): what a report contains, that no identity field can reach it, redaction cases.
- `src/entrypoints/shared/report-panel.ts` and `.css` (new): editable preview, Copy and Continue buttons.
- `src/entrypoints/result/main.ts`, `src/entrypoints/statuses/main.ts`: the entry points.
- `src/core/locales/es.ts`, `en.ts`: the panel's texts (a key-parity test covers `qps`).
- `site/feedback/index.html`, `site/en/feedback/index.html`, `site/feedback/feedback.js` (new): the page.
- `worker/index.ts` (new): the `/api/feedback` handler; static assets as before for every other path.
- `wrangler.jsonc`: `main`, the `send_email` binding with `destination_address`, the `ratelimits` binding
  (`simple`, period 10 or 60), `assets.run_worker_first` limited to `/api/*`.
- `tests/worker/` (new), `vitest.worker.config.ts` (new): Worker tests under `@cloudflare/vitest-plugin`
  (`cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })`), a separate Vitest project so the
  extension tests keep their environment; `npm test` runs both.
- `package.json`: `@cloudflare/vitest-plugin` and `@cloudflare/workers-types` as dev dependencies
  (approved 2026-11-23, see F7).
- `scripts/check-site.mjs` and its test: scoped exceptions allowing, on the feedback pages only, one
  same-origin script and the exact Turnstile script URL, and on the feedback and privacy pages, a plain link
  to the exact Turnstile privacy policy URL; every other rule unchanged.
- `scripts/allowed-urls.json`: no change (`https://naciocheck.vgr.cat/` is already listed).
- `site/privacy/index.html`, `site/en/privacy/index.html`, `README.md`, `store/permissions.md`,
  `docs/manual-firefox-checklist.md`: wording.
- `e2e/specs/pages.e2e.ts`, `e2e/specs/visual.e2e.ts`, `e2e/baselines/`: specs and images.
- `docs/adr/0005-distribution-and-public-pages.md`: the amendment, accepted 2026-11-23.

## Constraints (do not touch)

- ADRs 0003, 0004 and 0007 stand: no network request from the extension, no telemetry, the human solves
  the sede's captcha, nothing official-looking, tests never reach a real host.
- ADR 0005 changes only through its amendment: the site gains one endpoint and one script, nothing else.
- No identifier ever enters a report: not the NIE, application number, year, birth date, label or
  passphrase, nor any value read from `Identity`. Nor does the person's result: not the status text or
  sub-status sentence the site printed for them.
- The person sees and can edit the full text before anything leaves; Continue and Send are separate,
  explicit clicks, and the fragment never reaches the server.
- No new manifest permission and no new host pattern; `npm run check:privacy` passes on the same build.
- The Continue click is asserted through the call to `tabs.create`, not by loading the page.
- The Worker is tested offline only; no test sends a real email or reaches Cloudflare. Tests replace the
  `send_email` and rate-limit bindings with stubs and intercept the siteverify call, so Turnstile's test
  keys are used only for hands-on checks, never in automated tests.
- No Turnstile secret or other credential in the repo, a fixture, a log or a test. Cloudflare's published
  Turnstile test keys are not credentials: they may appear in `.dev.vars.example` and, the always-pass
  sitekey only, in `feedback.js` for hands-on local checks. The only email address
  in the repo is the project's public `naciocheck@vgr.cat` (F1).
- Deploying the site, configuring Email Routing, creating the Turnstile widget and setting its secret are
  the user's actions.
- Fake identities only in tests and baselines.

## Acceptance criteria

- [ ] `npm test` passes with the new files; a test fails if a field named like an identity field is added to
      the report.
- [ ] The panel is absent on a normal status and present on an error and an unknown page; the text contains
      the outcome and status key, and neither the status text nor the sub-status sentence the site printed,
      nor any of the fake identity's values; editing it changes what Copy would hold; the
      Continue click calls `tabs.create` with `https://naciocheck.vgr.cat/` plus `feedback/#` and no other
      host.
- [ ] Worker tests: a valid post with a passing token sends one email whose body is the redacted text; a
      missing token, a failed or spent token (`timeout-or-duplicate`), a wrong hostname, a siteverify
      outage, an oversized body, a wrong method or content type, a cross-origin post and a rate-limited
      client are rejected and send nothing; nothing is written to storage or logged; no test reaches a real
      host.
- [ ] `npm run check:site` passes and still fails on a script on any other page, on any remote address
      other than the exact Turnstile script on the feedback pages and the exact Turnstile privacy link on
      the feedback and privacy pages, and on either of those anywhere else.
- [ ] `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run check:site && npm run check:privacy`
      pass, with the E2E guard at 0 unexpected requests.
- [ ] Privacy policy, README, store data-usage answers and the Firefox checklist state that the extension
      sends nothing by itself, that the feedback page loads Cloudflare Turnstile (with a link to its privacy
      policy), and that a report the person sends from the website goes through Cloudflare to the maintainer
      by email and is not stored. Every other page still states that it loads nothing from elsewhere.
- [ ] After the user deploys: the user sends one report from the real extension with a real error and
      receives it.

## Open questions

- **F1. Where reports go.** Decided 2026-11-23: an email to `naciocheck@vgr.cat`, the project's official
  public address, sent by the site's Worker through Cloudflare Email Routing. Being public, it may appear
  in `wrangler.jsonc` as the binding's `destination_address`. The sender is also `naciocheck@vgr.cat`
  unless Email Routing rejects sending to itself; then the builder stops and asks.
- **F2. Which states offer the panel.** Decided 2026-11-23: error, unknown page, anomaly note, and the guide.
- **F3. What the report may contain.** Decided 2026-11-23: extension version, browser name and major
  version, locale, outcome, `statusKey`, the page's error messages and the anomaly note. Not the person's
  own result: the status text and sub-status sentence the site printed are left out. Consequence: for an
  unrecognised status the report says only `unknown`; the panel's intro invites the person to describe
  what they saw in their own words if they wish.
- **F4. Report format.** Decided 2026-11-23: labels and body in the person's language, limited to Catalan,
  Spanish or English. The extension has `es` and `en` today, so reports are `es` or `en` (`qps` maps to
  `es`); a `ca` report comes with a `ca` locale, never by itself. The feedback pages say comments are
  welcome in Catalan, Spanish or English.
- **F5. Timing.** Resolved by the website channel: it does not depend on the repo being public. Which
  release ships it is still open (not blocking).
- **F6. Spam protection.** Decided 2026-11-23: Turnstile is required, on top of the size cap, the
  same-origin check and per-client rate limiting. Widget mode: Invisible is the target; the widget was
  created as Managed on 2026-11-23, and switching is a dashboard change with no code change, so the page
  works in both. The feedback and privacy pages (es + en) link to Cloudflare's Turnstile privacy policy.
  The public sitekey is recorded in the plan (step 11); the secret stays in 1Password.
- **F7. Testing the Worker.** Decided 2026-11-23, dependencies approved: `@cloudflare/vitest-plugin`
  (1.9.0 supports Vitest `^4.1.0 || ^5.0.0`; the repo is on 5.1.0), which runs the Worker in the Workers
  runtime locally through Miniflare and replaces the older `@cloudflare/vitest-pool-workers`. Tests call
  the handler with `exports.default.fetch` from `cloudflare:workers`, with stubbed `send_email` and
  rate-limit bindings and an intercepted siteverify. The handler keeps its checks in pure functions so they
  are also covered by plain unit tests.
- **F8. Cloudflare skills.** Decided 2026-11-23: the official `cloudflare/skills` plugin is installed at
  user scope (`cloudflare@cloudflare` 1.0.4). Builders use its `turnstile-spin`, `cloudflare-email-service`,
  `workers-best-practices` and `wrangler` skills. Its remote MCP server reaches the user's Cloudflare
  account: builders may read docs through it but never change account state (deploy, secrets, routing).
