# 0007. Chrome E2E against a fake sede; Firefox by manual checklist

- **Status:** accepted
- **Date:** 2026-11-13 (recorded 2026-11-18)

## Context

A test that touched the live sede would put personal-data traffic and the captcha in an automated path.
BiDi interception of the document request of a window the extension opens itself proved unreliable in
Chrome 157: the request is reported but not paused, so an unpaused request bypasses the guard. Firefox's
Marionette refuses to navigate to `moz-extension://` pages, so extension pages cannot be driven there.

## Decision

- Automated E2E runs in Chrome only, against a fake sede served at the real URLs. Chrome for Testing starts
  with `--host-resolver-rules` mapping the sede, reCAPTCHA and font hosts to a local HTTPS server (throwaway
  certificate) and every other host to nothing, so the suite cannot reach a real server by construction.
  URLs, manifest and content-script matches stay exactly as shipped, and the tests run the production build.
- The stub captcha and token injection exist only on fake pages. No automated request ever reaches the live
  sede. Test data is fake identities only (the repo and store listings are public).
- Visual baselines are tracked in `e2e/baselines/` (fake data only); actual and diff images stay in the
  ignored `e2e/.artifacts/`.
- Firefox desktop is verified by the user with `docs/manual-firefox-checklist.md` against the store-bound
  package before each release. `npm run test:e2e:firefox` runs only a smoke spec and fails on purpose. No
  Nightly or Developer Edition workaround is built.

## Consequences

- The Chrome suite is reproducible and safe; Firefox regressions are caught only by the manual run.
- The matrix of screenshots feeds the `/review-ui` command.
- Rejected: close-and-retry as a known-flaky suite; pinning an older Chrome for Testing.

## Amendment 2026-11-25: an agent runs the Firefox checklist

- **Amendment status:** accepted 2026-11-25 by the owner (`specs/2026-11-25-v1-release/`, question Q3).

### Context

The decision above has the owner run `docs/manual-firefox-checklist.md` by hand before each release. A
`firefox` MCP server now exists (`firefox-agent`) that drives a visible Firefox over Marionette. Marionette
still cannot open `moz-extension://` pages in a normal session, but the owner can start the agent browser
with system access, which allows it. Running 17 rows by hand each release is slow, and most of them need no
real sede and no phone.

### Decision

- Before each release an agent runs the checklist with the `firefox` MCP tools against the store-bound
  Firefox zip (the same package AMO receives, loaded as a temporary add-on).
- The owner starts `firefox-agent --system` when `moz-extension://` pages need system access. An agent never
  runs `--system` itself; when a tool reports that system access is required, it stops and asks.
- The owner keeps, by hand: the rows that reach the real sede (row 7 and the real check in row 8), the
  captcha, and anything on Firefox for Android. No agent or tool reaches the live sede or reCAPTCHA
  (AGENTS.md). A row or part of a row the agent cannot observe, such as a native notification, is recorded as
  not observed and handed to the owner, never marked PASS.
- The checks themselves, the 0.1.0 result block and its sign-off stay as written, as the historical record.
  Each release run adds its own result block, naming who ran which rows.
- The original decision text above stays, and so does the title. `npm run test:e2e:firefox` stays a smoke
  spec that fails on purpose, and `e2e/` is unchanged: no Firefox automation is added to the suite, and no
  Nightly or Developer Edition workaround is built.

### Consequences

- Firefox desktop is checked on every release without the owner repeating the whole list; the owner's manual
  work shrinks to the live-sede rows and Android.
- The run depends on the agent's tools and on the owner starting `firefox-agent --system`. If either is
  unavailable, the owner runs the whole checklist by hand as before.
- The checklist stays the single source of what is checked. Only who runs it changes.
