# Review of share expediente progress

## 2026-11-23 — PASS

All six plan steps and acceptance criteria passed review. The user authorized closure on a pass, so the spec is
marked `done`. The review covered the feature commits from `f80f784` through `43a3c42` and excluded the unrelated
landing-page work.

## Scope and acceptance

- The formatter keeps the first successful observation of each status and sub-status run, skips failures and
  unrecognized pages, and preserves the site's wording for both known and unknown statuses. The output uses the
  browser's local day and stays identical in Spanish and English. [Formatter tests](../../tests/share.test.ts)
- The optional filing date adjusts the first observed registration or supplies one when registration was missed.
  Date validation, clearing, isolation between expedientes, compatibility with older stores, and backup round
  trips are covered. The update runs under the existing store lock and preserves checks and identity fields.
  [Storage tests](../../tests/storage.test.ts) · [Backup tests](../../tests/backup.test.ts)
- The Options flow covers the preview, saving and reopening the date, restoring the original preview after
  clearing, and matching the output in English. Clipboard write and manual selection are covered with a mocked
  clipboard. The empty history state offers a filing date field and adds a registration row only after save.
  [Chrome Pages spec](../../e2e/specs/pages.e2e.ts) · [Panel tests](../../tests/share-panel.test.ts)
- The feature uses local storage and an explicit clipboard action. The production privacy gate passed. The diff
  preserves the manifest configuration, host and URL allowlists, dependencies, change detection and official
  fixtures.
- The four changed full-page Options screenshots show legible disclosure controls at desktop and phone widths
  in both languages. The screenshots cover the closed panel. The stylesheet uses logical properties, and the
  visual matrix has no RTL capture.

## Verification

- `npm test` passed 738 unit tests and 31 Worker tests. `npm run lint`, `npm run format:check`,
  `npm run typecheck`, and `git diff --check` passed. Verification used Node 24.22.0. `.nvmrc` specifies 24.22.1.
- The share, panel and validation tests passed in `Pacific/Kiritimati` and `America/Los_Angeles` with 31 tests
  in each run.
- The first `npm run test:e2e` attempt passed Pages, smoke, and visuals. Check-flow stopped at startup when
  DNS resolution for the Chrome for Testing metadata host failed. `E2E_SPEC=check-flow npm run test:e2e`
  then passed all 13 check-flow tests. Across the two runs, all 76 Chrome tests passed with zero unexpected
  requests. All 104 screenshot comparisons were within tolerance on Chrome for Testing 158.0.8127.88.
- The E2E preparation built both browser targets. `npm run check:privacy` passed on both builds.

## Closure and release follow-ups

- Reconciled the final plan step with its commit `43a3c42` and checked off the spec's acceptance criteria.
- Firefox desktop and Android device verification remains `Not run`. The approved implementation plan also
  leaves open whether to mention the locally stored optional filing date in the public privacy copy.
  [Firefox checklist](../../docs/manual-firefox-checklist.md#the-checks) · [Plan](plan.md#risks--open-questions)
- For the Firefox smoke test, open **Options → History → Share progress** on a fake expediente. Save and edit
  the filing date, copy the preview into a local text field, and clear the date to confirm the original timeline
  comes back. If clipboard access is refused, check that the preview is selected and the manual-copy hint appears.
