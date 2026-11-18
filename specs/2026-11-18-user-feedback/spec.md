---
status: draft # draft | active | done | abandoned
created: 2026-11-18
status-date: 2026-11-18
---

# User feedback without telemetry: a report the person reviews and sends themselves

## Goal

A person who meets a result NacioCheck cannot read (an unrecognised status, a failed check, an explanation
that looks wrong) can tell the maintainer in two clicks, with exactly the text that would be shared shown on
screen first. Nothing leaves the browser unless they send it themselves. This replaces the dropped site
canary: the maintainer needs to learn about errors, unrecognised states and wrong explanations from the
people using the extension (ADR 0004 forbids telemetry).

## Scope

- A "Report a problem" panel on the result page for an error, an unknown page or an anomaly note, and a
  "this explanation looks wrong" entry in the status guide.
- The report is an editable text built from non-identifying fields only (outcome, `statusKey`, the status
  text as the site printed it, the sub-status sentence, the page's error messages, the anomaly note), passed
  through a redaction pass that masks anything shaped like a NIE, an application number, a date or a long
  number, with the masks visible.
- Two buttons: Copy (works offline) and Open the issue form (a new tab on the project's issue tracker with
  the text prefilled, or a short body asking to paste when the text is too long for a URL).
- A pure report builder and redactor in `src/core/` whose signature takes a check, never an application or
  identity, so "no identifier" is a property of the types.
- es and en texts, keyboard and screen-reader friendly; Chrome E2E and visual baselines; privacy policy
  (es + en), README, store texts and the Firefox checklist say what the panel does.

## Non-goals

- Any automatic or background sending, crash reporting, analytics, counters or a feedback server.
- Attaching a screenshot, the history, a store export, or anything that identifies the person.
- A general feature-request form (the issue tracker serves that without the extension).
- Firefox for Android on a device.
- `mailto:` links (need a public address and the person's mail client).

## Relevant files

- `src/core/report.ts` (new): `buildReport(check, context)` and `redact(text)`, pure.
- `tests/report.test.ts` (new): what a report contains, that no identity field can reach it, redaction cases.
- `src/entrypoints/shared/report-panel.ts` and `.css` (new): editable preview, Copy and Open buttons.
- `src/entrypoints/result/main.ts`, `src/entrypoints/statuses/main.ts`: the entry points.
- `src/core/locales/es.ts`, `en.ts`: the panel's texts (a key-parity test covers `qps`).
- `scripts/allowed-urls.json`: the issue-tracker prefix. It lists addresses the person opens themselves;
  opening a tab via `browser.tabs.create({ url })` needs no permission.
- `site/privacy/index.html`, `site/en/privacy/index.html`, `README.md`, `store/permissions.md`,
  `docs/manual-firefox-checklist.md`: wording.
- `e2e/specs/pages.e2e.ts`, `e2e/specs/visual.e2e.ts`, `e2e/baselines/`: specs and images.

## Constraints (do not touch)

- ADRs 0003, 0004 and 0007 stand: no network request from the extension, no telemetry, the human solves
  the captcha, nothing official-looking, tests never reach a real host.
- No identifier ever enters a report: not the NIE, application number, year, birth date, label or
  passphrase, nor any value read from `Identity`.
- The person sees and can edit the full text before anything leaves; Copy and Open are separate, explicit
  clicks.
- No new manifest permission and no new host pattern; `npm run check:privacy` passes on the same build.
- The "open the issue form" click is asserted through the call to `tabs.create`, not by loading the page.
- Fake identities only in tests and baselines.

## Acceptance criteria

- [ ] `npm test` passes with the new file; a test fails if a field named like an identity field is added to
      the report.
- [ ] The panel is absent on a normal status and present on an error and an unknown page; the text contains
      the status and none of the fake identity's values; editing it changes what Copy would hold; the Open
      click calls `tabs.create` with the issue-tracker prefix and no other host.
- [ ] `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run check:site && npm run check:privacy`
      pass, with the E2E guard at 0 unexpected requests.
- [ ] Privacy policy, README, store data-usage answers and the Firefox checklist state that the extension
      sends nothing by itself.
- [ ] The user opens the panel on the real extension with a real error and reads the text that would be sent.

## Open questions

- **F1. Where reports go.** GitHub issues on `vgr-dev/naciocheck` (public text, needs an account, works only
  once the repo is public), an email address (private, but a public address), or both. Draft assumes issues,
  with Copy as the channel-neutral fallback.
- **F2. Which states offer the panel.** Proposed: error, unknown page, anomaly note, and the guide. Add "any
  result"?
- **F3. What the report may contain.** Proposed: extension version, browser name and version, locale,
  outcome, the status text and sub-status sentence as the site printed them, the page's error messages, the
  anomaly note. Should the site's own sentences be left out?
- **F4. Issue template.** One generic body in the person's language, or a labelled English template so
  reports are triaged alike?
- **F5. Timing.** The tracker link only works once the repo is public: build now behind Copy, or wait for
  the release?
