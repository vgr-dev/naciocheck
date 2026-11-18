# 0004. All data stays local; encryption is optional but consistent

- **Status:** accepted
- **Date:** 2026-11-06, amended 2026-11-13 (recorded 2026-11-18)

## Context

The tool handles a NIE, an application number and a birth date. `storage.sync` uploads to Google or Mozilla.
Encryption of identifying fields trades privacy at rest against friction on every check.

## Decision

- Data lives in `storage.local` and `storage.session` only. The extension makes no network request and has
  no telemetry. `npm run check:privacy` enforces it: forbidden network APIs, exactly one host permission
  (`https://sede.mjusticia.gob.es/eConsultas/*`), every URL in the bundle listed in `scripts/allowed-urls.json`.
- Encrypting identifying fields is optional and the user's choice.
- When encryption is on, identities are always encrypted at rest. The add and edit forms ask for the
  passphrase, verify it by decrypting an existing encrypted identity, and never keep it: not in
  `storage.session`, not in memory after the save. The unlock page's passphrase, used to run checks, lives in
  `storage.session` only.
- Editing an identity keeps its history, with an "edited on" marker.

## Consequences

- A form that stored a new application as plain while the options page said the store was encrypted was a
  privacy defect; this decision closes it.
- Any feedback or error-report channel must be user-initiated and user-reviewed; the extension sends nothing
  by itself (see `specs/2026-11-18-user-feedback/`).
