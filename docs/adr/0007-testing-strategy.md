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
