# 0002. Browser extension on WXT and TypeScript, Chrome and Firefox

- **Status:** accepted
- **Date:** 2026-11-06 (recorded 2026-11-18)

## Context

NacioCheck must run on desktop and on a phone, with no server of its own.

## Decision

Build a browser extension in TypeScript with WXT: one Manifest V3 source tree for Chrome and Firefox,
desktop and Firefox for Android. Tests use Vitest; the Chrome end-to-end suite uses WebdriverIO.

## Consequences

- One codebase covers PC and mobile, since Firefox for Android supports extensions.
- No backend to run, secure or pay for.
- Firefox for Android was verified on a device on 2026-11-24 (see `docs/pre-release-audit-2026-11-18.md`).
