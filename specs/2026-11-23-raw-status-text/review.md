# Spec review — 2026-11-23

**PASS.** The review found no acceptance blockers. The spec stays active pending confirmation.

Reviewed all eight plan steps against the changes from `f6ad217^` through `15a98c9`, with three parallel
Luna reviews covering core behavior, UI and localization, and tests and documentation.

## Scope and acceptance

- Popup, history, and result names use the stored site text for catalogued and unknown statuses. The result's
  previous-status line and both versions of the anomaly note also use the recorded text. The anomaly note
  appends a recorded sub-status with one space.
- Explanations, next steps, and observed meanings still follow the UI language and keep their informational
  framing. The guide leads with Spanish headings and adds the English gloss in English. The `displayStatus`
  helper and its application and test references are gone.
- Parser, catalogue matching, storage, backups, manifest configuration, and network guard are outside the diff.
  The fixtures are byte-for-byte unchanged. Firefox checklist row 12 describes the new behavior and reads
  **Not run**.
- Corrected the stale step 8 status in [plan.md](plan.md#status) to reference the baseline commit
  `f9ccd2a`.

## Coverage limits

- The popup and history E2E test directly asserts one catalogued name in English. The Spanish and unknown-status
  cases use the same rendering paths. The guide test samples the first card from a shared renderer.
  [Page E2E tests](../../e2e/specs/pages.e2e.ts#L704)
- Inspected the relevant regions of all 25 changed Chrome baselines across desktop, phone, and narrow popup
  widths. The recorded labels and guide gloss fit in the reviewed images. The visual fixtures use short statuses,
  so wrapping for a longer example such as `Abierto - En tramitación: Requerido.` remains unverified. The other
  75 baselines were outside the manual spot check. The stylesheet search found no left or right declarations
  requiring an RTL fix. RTL rendering was outside the screenshot matrix.

## Verification

- `npm test` passed all 458 tests.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, and `git diff --check f6ad217^` passed.
- `npm run test:e2e` passed all 70 Chrome tests across four specs in Chrome for Testing 158.0.8127.36.
  The network guard reported zero unexpected requests and all 100 screenshots were within tolerance.
- The E2E preparation ran `npm run build:chrome` and `npm run build:firefox` successfully.
  `npm run check:privacy` passed on both builds.

## Manual smoke test

In Firefox, use a profile with saved history and a saved changed result. Set **Options → Language → English**.
Compare the status and punctuation in the popup, history, and **View change** result. Confirm that the
explanation is English and the guide pairs its Spanish heading with the English gloss. Switch back to
Spanish and confirm the gloss disappears. [Firefox checklist row 12](../../docs/manual-firefox-checklist.md#the-checks)
