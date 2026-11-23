# Progress for sharing expediente progress

This log records implementation and verification. Step status is tracked in `plan.md`.

## 2026-11-23 - Filing-date storage

- **Status** — Partial against the current plan. The user approved the earlier plan in chat, and the builder
  completed its filing-date storage step. The plan changed during the run and the current sign-off is blank.
- **Changed** — `src/core/storage.ts`, `src/core/validation.ts`, `tests/storage.test.ts`, `tests/backup.test.ts`
- **Run by** — implement-phase using a GPT-6 Luna builder (`gpt-6-luna`)
- **File check** — The builder changed only the four files assigned to it.
- **Verified** — `npx vitest run tests/storage.test.ts tests/backup.test.ts tests/validation.test.ts` passed all
  84 tests. `npm test` passed 715 unit tests and 31 Worker tests. `npm run lint`, `npm run format:check` and
  `npm run typecheck` also passed. The first Vitest run could not bind localhost. Both test reruns passed with
  local port binding. Verification used Node 24.22.0. The repository specifies 24.22.1.
- **Commit** — uncommitted, proposed `feat(storage): save optional filing dates`
- **Open issues** — The current plan also calls for the share formatter and additional storage behavior,
  localized validation and tests. The current checklist remains pending.
- **Proposed commit (builder)**

```
feat(storage): save optional filing dates
```

## 2026-11-23 - Step 1: Build the share summary from the checks

- **Status** — Done
- **Run by** — implement-phase using a GPT-6 Luna builder (`gpt-6-luna`)
- **Changed** — `src/core/share.ts`, `tests/share.test.ts`
- **Verified** — `npx eslint src/core/share.ts tests/share.test.ts` passed. `npx vitest run tests/share.test.ts`
  passed all 11 tests with local port binding after the builder corrected the assertion that matched the required
  attribution.
- **Commit** — uncommitted, proposed `feat(share): build expediente progress summary`
- **Open issues** — None
- **Proposed commit (builder)**

```
feat(share): build expediente progress summary
```

## 2026-11-23 - Step 2: Store and validate the optional filing date

- **Status** — Done
- **Run by** — implement-phase using a GPT-6 Luna builder (`gpt-6-luna`)
- **Changed** — `src/core/storage.ts`, `src/core/validation.ts`, `src/core/locales/es.ts`,
  `src/core/locales/en.ts`, `tests/storage.test.ts`, `tests/validation.test.ts`, `tests/backup.test.ts`
- **Verified** — `npx vitest run tests/storage.test.ts tests/validation.test.ts tests/backup.test.ts tests/i18n.test.ts`
  passed all 109 tests with local port binding after the builder updated the storage assertions for translated
  errors. `npm run typecheck` passed.
- **Commit** — uncommitted, proposed `feat(storage): store optional filing date`
- **Open issues** — None
- **Proposed commit (builder)**

```
feat(storage): store optional filing date
```

## 2026-11-23 - Phase 1: Summary builder and stored filing date

- **Status** — Done
- **Steps** — Step 1 done. Step 2 done.
- **File check** — Passed for both builders. A separate untracked landing-page plan appeared during this run
  and was excluded from the phase's files.
- **Phase verify** — `npm test`, `npm run lint`, `npm run format:check` and `npm run typecheck` passed. The
  full suite passed 730 unit tests and 31 Worker tests with local port binding. Verification used available
  Node 24.22.0. The repository specifies 24.22.1.
- **Commit proposal** — `feat(share): build expediente progress summary` for the formatter and its tests.
  `feat(storage): store optional filing date` for storage, validation, locales, tests and the spec records.
- **Open issues** — Phase 2 is next. Its approval remains pending.

## 2026-11-23 - Step 3: Add the share panel to each History card

- **Status** — Done
- **Run by** — implement-phase using a GPT-6 Luna builder (`gpt-6-luna`)
- **Changed** — `src/entrypoints/shared/share-panel.ts`, `src/entrypoints/shared/share-panel.css`,
  `src/entrypoints/options/main.ts`, `src/core/locales/es.ts`, `src/core/locales/en.ts`,
  `tests/share-panel.test.ts`
- **Behavior** — Options History has a closed share disclosure with an optional filing date, a read-only
  preview, and Copy with a manual selection fallback. Newly added expedientes get the disclosure immediately.
  History refreshes from one local store snapshot and ignores an older render when it overlaps a newer one.
- **Verified** — `npx vitest run tests/share-panel.test.ts tests/i18n.test.ts tests/viewport.test.ts` passed
  35 tests with local port binding. Scoped ESLint and `npm run typecheck` passed. The first scoped test run
  exposed a test that read storage before save finished. The final run passed after waiting for the UI's
  save confirmation.
- **Commit** — uncommitted, proposed `feat(options): add expediente sharing panel`
- **Open issues** — None for this step. Browser and screenshot verification remain in Phases 3 and 4.
- **Proposed commit (builder)**

```
feat(options): add expediente sharing panel
```

## 2026-11-23 - Phase 2: Share panel in Options

- **Status** — Done
- **Steps** — Step 3 done. Phase 1 was already committed as `f80f784` and `34ae4a2`.
- **File check** — Passed. The separate landing-page changes were excluded from the phase.
- **Phase verify** — `npm test` passed 738 unit and 31 Worker tests. `npm run lint`, `npm run format:check`,
  `npm run typecheck`, `npm run build:chrome`, `npm run build:firefox` and `npm run check:privacy` passed.
  Verification used Node 24.22.0. The repository specifies 24.22.1.
- **Commit proposal** — `feat(options): add expediente sharing panel` for the panel, Options integration,
  locales, tests and spec records.
- **Open issues** — Phase 3 is next. Its approval remains pending.

## 2026-11-23 - Step 4: Cover the share panel in the Chrome E2E suite

- **Status** — Done
- **Run by** — implement-phase using a GPT-6 Luna builder (`gpt-6-luna`)
- **Changed** — `e2e/specs/pages.e2e.ts`
- **Verified** — `E2E_SPEC=pages npm run test:e2e` passed all 41 Chrome Pages tests, including preview format,
  filing-date save and reload, clearing to the original preview, and identical output in the English UI.
  Chrome for Testing was 158.0.8127.88. The network guard reported 520 fake-site requests and zero outside it.
  The builder's scoped ESLint, Prettier and E2E type checks also passed.
- **Commit** — uncommitted, proposed `test(e2e): cover expediente sharing panel`
- **Open issues** — None
- **Proposed commit (builder)**

```
test(e2e): cover expediente sharing panel
```

## 2026-11-23 - Step 5: Add a share row to the Firefox manual checklist

- **Status** — Done
- **Run by** — implement-phase using a GPT-6 Luna builder (`gpt-6-luna`)
- **Changed** — `docs/manual-firefox-checklist.md`
- **Verified** — `npx prettier --check docs/manual-firefox-checklist.md` passed after formatting. The Firefox
  desktop and Android row has an observed result of `Not run`.
- **Commit** — uncommitted, proposed `docs(checklist): add Firefox share progress check`
- **Open issues** — Manual browser checks are pending for release.
- **Proposed commit (builder)**

```
docs(checklist): add Firefox share progress check
```

## 2026-11-23 - Phase 3: End-to-end check and manual checklist

- **Status** — Done
- **Steps** — Steps 4 and 5 done. Phase 2 was already committed as `affeac4`.
- **File check** — Passed. Each builder changed only its assigned file. Separate landing-page work was
  excluded from the phase.
- **Phase verify** — `npm test` passed 738 unit and 31 Worker tests. `npm run lint`, `npm run format:check`
  and `npm run typecheck` passed. Verification used Node 24.22.0. The repository specifies 24.22.1.
- **Commit proposal** — `test(e2e): cover expediente sharing panel` for the Chrome test and
  `docs(checklist): add Firefox share progress check` for the checklist and spec records.
- **Open issues** — Phase 4 visual baselines and manual Firefox release verification remain pending.
