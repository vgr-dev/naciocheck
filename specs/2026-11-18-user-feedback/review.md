# Spec review — 2026-11-23

**FAIL.** The report preview can include personal data from the sede's error text. The deployed
report and inbox check also remains open. The spec stays active.

## Findings

1. **High — A prefilled report can contain personal data.** The parser reads free-form error list
   items and, as a fallback, an entire error block. The result page passes those strings into the
   report. Redaction masks several numeric formats, but a plain-text name, email address, or status
   sentence in an error message survives. A local check with an invented name and status confirmed
   that both survive the redactor. The Worker uses the same redactor. The current tests prove that
   dedicated identity and result fields are excluded, but the README, store answers and preview
   promise that those values are never included. Prefill known error categories and leave other
   details to the person's editable comment, with a regression test using a synthetic error that
   contains private text. [Parser](../../src/core/parser.ts#L61) ·
   [Report input](../../src/entrypoints/result/main.ts#L159) ·
   [Report builder](../../src/core/report.ts#L125) · [Redactor](../../src/core/redact.ts#L23)
2. **Medium — The character cap can produce a report the Worker refuses.** The builder limits the
   preview to 4,000 UTF-16 code units, while the Worker limits the whole JSON request to 8,192 bytes.
   A 4,000-character accented draft plus a token at the allowed length occupies 10,070 bytes even
   before considering three-byte characters or JSON escapes. The feedback page only reports this
   after Send. Check the encoded JSON byte length before posting and use the same budget for the
   generated report. [Report cap](../../src/core/report.ts#L78) ·
   [Worker limits](../../worker/checks.ts#L10) · [Send handler](../../site/feedback/feedback.js#L197)
3. **Low — Firefox row 15 points to a helper that cannot produce an error result.** The helper seeds
   a previous status for the change alert. Row 15 also stops at Continue, so it omits the Turnstile,
   email and retention wording called for by the spec's acceptance checklist. Correct the recipe and
   point readers to the privacy policy. [Firefox checklist](../../docs/manual-firefox-checklist.md#L47)

## Scope and acceptance

- Reviewed the feedback commits from `c47059e` through `a14a948`, excluding the unrelated raw-status
  closeout in `bb06ee0`. The manifest configuration, fixtures, URL allowlist and store screenshots
  are outside the diff. The extension opens a tab with a fragment and the site posts only on Send.
- Worker tests cover valid mail, rejection paths and zero unstubbed requests. The binding restricts the
  recipient, and Worker observability is disabled as agreed. The runtime tests stub mail. Cloudflare
  documents the structured send call and sender-domain setup, but the account configuration and actual
  delivery from and to the project address still need verification. The configured localhost check
  expects `example.com`, which matches the documented hostname for dummy tokens.
  [Cloudflare send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)
  · [Cloudflare Turnstile test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- Background tests exercise the unrecognised-page payload. Chrome E2E exercises the panel on errors,
  anomalies and the guide, plus its absence on a normal status. It does not render the unrecognised-page
  result or test the live Turnstile widget. Cloudflare documents programmatic rendering with
  `?render=explicit`, while the signed-off plan requires the exact base URL. The mock tests cannot
  establish that the real widget runs with that combination.
  [Cloudflare widget rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- Step 14 added or changed 12 expected Chrome baselines. I spot-checked the open error panel and the
  guide across Spanish, English, desktop and phone. The phone error capture ends before the textarea
  and actions. The CSS search found no physical direction properties in the reviewed styles. Focus,
  RTL rendering and the feedback website were outside this spot check.
- Corrected the stale step 14 status to reference `900f720`. Product code and tests were left for
  the builder.

## Verification

- `npm test` passed 701 extension tests and 31 Worker tests with local sockets enabled. The initial
  sandboxed run could not allocate a loopback port.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run check:site` and
  `npm run check:privacy` passed. The privacy check covered both browser builds and retained the
  existing permissions and host.
- `npm run test:e2e` passed all 75 Chrome tests after the sandboxed run could not resolve Chrome for
  Testing metadata. The suite rebuilt Chrome and Firefox, recorded zero unexpected requests in all
  four specs and compared 104 screenshots with zero above tolerance. `git diff --check` passed.

## Manual smoke test

After the findings are addressed, run `npm run dev:site` with the test settings from `.dev.vars.example`.
In Firefox, open `http://localhost:8787/feedback/` with a synthetic draft, edit it, use **Copy**, then
use **Send** and confirm the local mail simulation receives the redacted text. After deploying, open
**Report a problem** on a real extension error result, confirm the preview excludes private text, use
**Continue on the website**, then send the report and confirm it arrives in the project inbox.

## Follow-up — 2026-11-23

The three findings have local fixes. The report now uses fixed error categories, the draft and request
are checked against the Worker's byte limit, and the Firefox checklist starts from a failed check.
The manual Firefox and deployed delivery checks remain open. [Verification](progress.md#2026-11-23---review-follow-up)

## Second review — 2026-11-23

**PASS WITH CHANGES.** The three findings above are fixed and covered by tests. Nothing blocks the
build; the spec stays active until the manual Firefox check, the deployment and a real report reaching
the inbox are done.

### Fixes checked

- **High (sede error text):** `buildReport` no longer copies error messages. `errorCategory` maps each
  to `captcha`, `datos de la solicitud` / `application details`, or `error no reconocido` /
  `unrecognised error`, deduplicated. Free text cannot reach the draft. The E2E error case asserts
  `errores: datos de la solicitud | captcha` and the absence of the sede's sentence.
- **Medium (byte limit):** the builder trims the draft until `{text, token}` with a 2,048-character
  token fits 8,192 bytes, never splitting a surrogate pair, and a test ties that budget to the Worker's
  `MAX_BODY_BYTES` and `MAX_TOKEN_CHARS`. `feedback.js` measures the encoded JSON before posting, shows
  `too-large` and keeps the draft editable.
- **Low (Firefox row 15):** the row now starts from a real failed check, goes through Turnstile and
  Send, and asks for the email to be confirmed; a note covers delivery and retention.
- `plan.md` Status matches `git log` (every hash exists; step 14 is `900f720`). `progress.md` records
  the follow-up.

### Findings

1. **Low: the page's byte limit is a separate literal.** `site/feedback/feedback.js` hardcodes
   `MAX_BODY_BYTES = 8192`, while the report test imports the Worker's constant. A later change to the
   Worker cap would leave the page out of step. Add a test in `tests/feedback-page.test.ts` that reads
   the literal from `feedback.js` and compares it with `MAX_BODY_BYTES` from `worker/checks.ts`.
2. **Low: explicit rendering is unverified against the real widget.** The page calls
   `turnstile.render` while loading `api.js` without `?render=explicit` (the site gate requires the
   exact URL). It is unlikely to break, because the container has no `cf-turnstile` class, so
   implicit rendering finds nothing. The mocks cannot prove it, though, so the manual smoke test below
   must show the widget and a token.
3. **Process: commit footers.** The four review-fix commits carry `Signed-off-by:` trailers. The
   commit rules in use allow no footers. If the trailer comes from a `git commit -s` habit or a hook,
   keep it out of later commits; rewriting history is not needed.
4. **Carried over, unchanged:** the three Low UI findings from step 14, the options-editing E2E flake,
   `navegador: unknown` in headless runs, and no E2E fixture for an unknown-page result.

### Acceptance criteria

All automated criteria are met. Still open, and the user's: a real report sent from the deployed site
reaching the inbox, and Firefox checklist row 15.

### Commands

- `npm test` -> pass (extension 30 files, 707 tests; Worker 2 files, 31 tests)
- `npm run lint`, `npm run format:check`, `npm run typecheck` -> pass
- `npm run check:site` -> pass (6 pages)
- `npm run build:chrome && npm run build:firefox && npm run check:privacy` -> pass (no forbidden APIs,
  every URL allowed, licence notices present)
- `npm run test:e2e` -> pass (13 + 40 + 2 + 20; network guard 0 outside the fake site in all four
  workers)
- `git diff --check HEAD~5` -> clean

### Manual smoke test

1. `cp .dev.vars.example .dev.vars && npm run dev:site`, then open `http://localhost:8787/feedback/#hola`
   in Firefox: the box shows `hola`, the address loses the fragment, the Turnstile widget renders (test
   key), Send answers "sent" and the terminal shows the simulated email with the text.
2. Paste more than 8 KB of text: Send shows the "too long" message and posts nothing (no request in
   the network panel).
3. After deploying: Firefox checklist row 15 end to end, and the report arrives at the project inbox.
