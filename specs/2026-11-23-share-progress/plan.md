# Plan: Share expediente progress

Spec: `spec.md`

**Sign-off:** Approved by Victor Gonzalez on 2026-11-23 for Phases 1 through 4.

## Status

<!-- One line per step, in step order. The only part of this file that changes after sign-off.
[ ] todo | [~] in progress | [x] done | [-] deferred | [!] blocked
After the title: `uncommitted`, a short commit hash, or the reason (deferred/blocked).
Never [x] for partial work. Details live in progress.md. -->

**Phase 1: Summary builder and stored filing date**

- [x] 1. Build the share summary from the checks `f80f784`
- [x] 2. Store and validate the optional filing date `34ae4a2`

**Phase 2: Share panel in Options**

- [x] 3. Add the share panel to each History card `affeac4`

**Phase 3: End-to-end check and manual checklist**

- [x] 4. Cover the share panel in the Chrome E2E suite `07424b5`
- [x] 5. Add a share row to the Firefox manual checklist `c22cf6a`

**Phase 4: Visual baselines**

- [x] 6. Rewrite the Chrome baselines and review them `uncommitted`

## Phase 1: Summary builder and stored filing date

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck`; all unit and worker
  tests pass, no lint errors, Prettier reports no changes, all three tsconfigs typecheck. Nothing in the UI uses
  the new code yet, so the E2E suite is unaffected and is not run here.

### 1. Build the share summary from the checks

- **Goal:** A new pure module `src/core/share.ts` turns one application's checks and an optional filing date into
  the shared text, or `null` when there is nothing to share. No DOM, no storage, no `t()`: the summary text is the
  same in every UI language.
  - `export const SHARE_ATTRIBUTION = 'Generado con naciocheck.vgr.cat';` (a bare host, not a URL, so
    `check:privacy` and `scripts/allowed-urls.json` are unaffected).
  - `export function buildShareSummary(checks: readonly Check[], filingDate: string | null): string | null`
    (`Check` is a type-only import from `./storage`; `filingDate` is `AAAA-MM-DD`, and `null`, `''` or blank
    means no date).
  - Keep only `outcome === 'status'` checks (drop `error` and `unknown`), ordered by `at` with a stable sort.
    Walk them with the previous kept check and start a new entry whenever
    `evaluateChange(previous, current).kind !== 'unchanged'` (reuse `src/core/changes.ts`; do not reimplement
    the comparison). Because failed checks are filtered out first, repeats across failures collapse, a return
    to an earlier status starts a new entry, and unknown-to-the-catalogue text and sub-status changes count.
  - Entry text: the check's `raw` as stored, then, when `subStatus` is non-null and not blank, one space and the
    `subStatus` as stored (trim outer whitespace of each part only; no other rewriting, no catalogue title).
  - Entry date: the first observation's `at`, as `DD/MM/YYYY` in the local time zone (`getDate`, `getMonth`,
    `getFullYear`; not `Intl`, so both UI languages print the same digits).
  - Filing date: the registration entry is the first entry whose `normaliseText(raw)` equals
    `normaliseText('Abierto - Registrado')` (whatever its sub-status). With a filing date, that entry's date
    becomes the filing date, reformatted from `AAAA-MM-DD` to `DD/MM/YYYY` by string split (never through
    `Date`, so no time-zone shift), and its text is unchanged. With no registration entry, prepend an entry
    `Abierto - Registrado.` dated with the filing date. Then order the entries by calendar date, oldest first,
    with a stable sort (ties keep check order).
  - Output: `` `${n}. ${date} - ${text}` `` per entry, numbered from 1, joined with `\n`, then `\n` and
    `SHARE_ATTRIBUTION`. No trailing newline. Return `null` when there are no entries.
  - `tests/share.test.ts`: build `at` values from local `new Date(y, m, d, h, min).toISOString()` so the tests
    pass in any time zone. Cover: the exact three-line example from the spec plus attribution; repeated checks
    collapse to the first observation; error and unknown checks between repeats do not split a run; A → B → A
    yields three entries; sub-status appearing, changing and disappearing under `Abierto - En tramitación.`,
    under another catalogued status and under an unknown status each produce a new entry and print the
    sub-status; normalisation-only differences (dash type, accents, trailing period) do not; filing date
    replaces the observed registration date without adding a line, also when later statuses exist and when the
    observed registration is not the first entry; missed registration adds `Abierto - Registrado.` as line 1;
    filing date with no status checks yields one line plus attribution; blank, `''` and `null` filing dates
    yield observed statuses only; no status checks and no date returns `null`; a check at 00:30 local time is
    dated that local day; the output never contains the application label, `applicationId`, check ids or error
    text.
- **Files:** `src/core/share.ts`, `tests/share.test.ts`
- **Verify:** `npx vitest run tests/share.test.ts`; all pass. `npx eslint src/core/share.ts tests/share.test.ts`;
  no errors.
- **Out of scope:** storage, validation, locales, any UI. `changes.ts` and `normalise.ts` stay unchanged.

### 2. Store and validate the optional filing date

- **Goal:** An application can carry an optional filing date that survives reloads and backups, and nothing else
  changes for applications and backups without one.
  - `src/core/storage.ts`: `Application` gains `filingDate?: string` (`AAAA-MM-DD`, the calendar date as typed;
    absent means none, so no schema bump, same reasoning as `editedAt`). `validateApplication` rejects a
    present `filingDate` that is not a string or not a real calendar date (use `isCalendarDate` below); it does
    not check today or the checks, so a backup is not rejected for the time zone it is imported in.
  - `export function firstStatusCheckAt(checks: readonly Check[]): string | null`: the earliest `at` among
    `outcome === 'status'` checks.
  - `export async function setFilingDate(applicationId: string, filingDate: string | null): Promise<void>`:
    inside `mutateStore`, an unknown id changes nothing (like `updateApplication`); `null` or blank removes the
    key from that application (destructure it out, do not write `undefined`); otherwise it trims, runs
    `filingDateError` against that application's `firstStatusCheckAt` and throws `new Error(message)` when it
    fails, then sets the field. It never sets `editedAt` and never touches checks or other applications.
  - `src/core/validation.ts`: extract the existing field-by-field real-date check from `birthDateError` into
    `export function isCalendarDate(value: string): boolean` (behaviour of `birthDateError` unchanged). Add
    `export function localCalendarDate(iso: string): string` (`AAAA-MM-DD` in the local time zone, reusing
    the `today()` formatting) and
    `export function filingDateError(value: string, earliestCheckAt: string | null, now = new Date()): string | null`:
    not a calendar date → `t('validation.filingDate')`; after today → `t('validation.filingDateFuture')`;
    after `localCalendarDate(earliestCheckAt)` → `t('validation.filingDateAfterCheck')`; the same day as the
    earliest check is allowed.
  - `src/core/locales/es.ts` and `src/core/locales/en.ts`: the three `validation.filingDate*` messages, in the
    tone of the `validation.birthDate*` ones.
  - Tests: `tests/validation.test.ts` (real/impossible dates such as `2026-02-30`, wrong format, today allowed,
    tomorrow rejected with a fixed `now`, equal to and after the earliest check's local day, no checks);
    `tests/storage.test.ts` (set, change, clear removes the key, unknown id is a no-op, invalid date throws and
    writes nothing, `editedAt` and checks untouched, the other application untouched, `migrateStore` accepts a
    store without `filingDate` and rejects a malformed one); `tests/backup.test.ts` (export then `parseBackup`
    keeps `filingDate` on the right application; a backup without it still parses; `mergeStores` keeps the
    current application's date on an id collision, as it does for every other field).
- **Files:** `src/core/storage.ts`, `src/core/validation.ts`, `src/core/locales/es.ts`, `src/core/locales/en.ts`,
  `tests/storage.test.ts`, `tests/validation.test.ts`, `tests/backup.test.ts`
- **Verify:** `npx vitest run tests/storage.test.ts tests/validation.test.ts tests/backup.test.ts tests/i18n.test.ts`;
  all pass. `npm run typecheck`; no errors.
- **Out of scope:** `src/core/backup.ts` (export and merge need no code change; if a test shows otherwise, stop
  and report), the share summary (step 1), any UI. `tests/fixtures/` stays byte-for-byte.

## Phase 2: Share panel in Options

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run build:chrome && npm run build:firefox && npm run check:privacy`;
  all unit tests pass, no lint errors, Prettier reports no changes, typecheck clean, both builds succeed and the
  privacy gate passes with the manifest unchanged. The E2E visual baselines for options are expected to differ
  until phase 4; do not run the E2E suite here.

### 3. Add the share panel to each History card

- **Goal:** Every History card in Options ends with a closed disclosure "Compartir el progreso" / "Share
  progress" (see Q2) built by a new `src/entrypoints/shared/share-panel.ts`, following the patterns of
  `report-panel.ts`:
  - `export function sharePanel(application: Application, checks: readonly Check[]): HTMLElement` returns a
    `details.share-panel` with a `summary`, a short intro hint (the text holds only dates and statuses), and:
  - A filing-date field: a labelled `input type="date"` with a unique id, prefilled with
    `application.filingDate ?? ''`, `max` set to the earlier of today and `localCalendarDate` of
    `firstStatusCheckAt(checks)`; a hint that it is optional and replaces the registration date; **Guardar la
    fecha / Save date** and **Quitar la fecha / Clear date** buttons. Save runs `filingDateError` first and shows
    the message without writing on failure; a blank field saves as `null`. Both call `setFilingDate`, show the
    outcome with `announceAfter` (or a storage error message), and redraw only the preview with the new date,
    keeping the panel open.
  - A preview: a labelled `textarea` that is `readOnly`, `spellcheck = false`, `rows` fitted to the line count,
    with `buildShareSummary(checks, filingDate)` as its value; and a **Copiar / Copy** button that writes the
    textarea value with `navigator.clipboard.writeText` on click only, announces success, and on failure
    focuses and selects the text and announces the manual-copy hint (as `report-panel.ts` does). When the summary
    is `null`, the preview and Copy are not shown and a hint says there is nothing to share yet.
  - Styling in a new `share-panel.css` imported by the module, following `report-panel.css` and the brand rules
    in `brand/README.md`; reuse the existing `field`, `row`, `hint` and `button` classes.
  - `src/entrypoints/options/main.ts` `renderHistory`: append `sharePanel(application, checks)` to each card,
    after the list or the "no checks" line, using the checks already loaded. The last-5 list is unchanged.
  - Locales: new `share.*` keys in both `es.ts` and `en.ts` for the summary, intro, field label and hint, the two
    date buttons and their confirmations, the preview label, Copy, copied, copy failed and nothing-to-share.
  - `tests/share-panel.test.ts` (jsdom, store seeded through `storage.ts` as `tests/storage.test.ts` does,
    clipboard stubbed as `tests/report-panel.test.ts` does): the preview equals `buildShareSummary` output and
    contains no label, NIE, número, birth date or error text; Copy writes exactly the preview; a rejected
    clipboard leaves the text selected and shows the failure hint; saving a valid date updates the preview and the
    stored application only; a future date, a date after the first check and an impossible date are refused with
    the message and nothing stored; clearing restores observed-only lines; no checks and no date shows the
    nothing-to-share hint and no Copy; a date with no checks shows one registration line; labels in `es` and `en`
    via `setLocale`, while the summary text stays identical in both.
- **Files:** `src/entrypoints/shared/share-panel.ts`, `src/entrypoints/shared/share-panel.css`,
  `src/entrypoints/options/main.ts`, `src/core/locales/es.ts`, `src/core/locales/en.ts`,
  `tests/share-panel.test.ts`
- **Verify:** `npx vitest run tests/share-panel.test.ts tests/i18n.test.ts tests/viewport.test.ts`; all pass.
  `npx eslint src/entrypoints/shared/share-panel.ts src/entrypoints/options/main.ts tests/share-panel.test.ts`;
  no errors. `npm run typecheck`; no errors.
- **Out of scope:** the popup, the result page, the application cards, editing other dates or status text, share
  links or any request. No new permission (`clipboardWrite` is not needed for a click-triggered `writeText`; if a
  build or test suggests otherwise, stop and ask). E2E specs and baselines (phases 3 and 4).

## Phase 3: End-to-end check and manual checklist

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck`; all green. The
  functional E2E run is in step 4's Verify; the visual spec still differs until phase 4.

### 4. Cover the share panel in the Chrome E2E suite

- **Goal:** In `e2e/specs/pages.e2e.ts`, under `describe('options')`, one test on the shipped build: add
  `FIRST_APPLICATION` through the UI, seed two different status checks with `seedPreviousCheck` (for example
  `Abierto - Registrado.` then `Abierto - En tramitación.` with a sub-status), open Options, open the share panel,
  and assert the preview lines match `^1\. \d{2}/\d{2}/\d{4} - Abierto - Registrado\.$`, the second line
  carries the raw status and sub-status, and the last line is `Generado con naciocheck.vgr.cat`. Then set a
  filing date earlier than the seeded checks (a fixed fake date such as `2026-01-15`, adjusted if it is after
  the seeded `at`), save, assert line 1 reads `15/01/2026`, reload Options and assert the field and line 1 still
  hold it; clear it and assert the observed date is back. Repeat the line-format assertion with the language set
  to English (`setStoredLanguage('en')`). Fake identities only; the network guard stays at 0 unexpected requests.
  Do not assert on the clipboard.
- **Files:** `e2e/specs/pages.e2e.ts`
- **Verify:** `E2E_SPEC=pages npm run test:e2e`; the pages spec passes, including the new test, with 0
  unexpected requests.
- **Out of scope:** `e2e/specs/visual.e2e.ts` and `e2e/baselines/` (step 6), the seed helpers in
  `e2e/support/` (if a helper is missing, stop and report rather than adding a test-only path to the extension).

### 5. Add a share row to the Firefox manual checklist

- **Goal:** `docs/manual-firefox-checklist.md` gains a row "Options: share progress" for Firefox desktop and
  Firefox for Android: open the panel on a History card, save, change and clear a filing date, check the preview
  format, press Copy and paste into a text field, and confirm the hint and selection when copying is refused.
  Result column `Not run`. Keep the table's numbering and Prettier formatting consistent.
- **Files:** `docs/manual-firefox-checklist.md`
- **Verify:** `npx prettier --check docs/manual-firefox-checklist.md`; no changes reported.
- **Out of scope:** running the checklist (the user does it before release), other rows.

## Phase 4: Visual baselines

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run test:e2e && npm run check:privacy`;
  everything green, E2E with 0 unexpected requests and every visual comparison passing against the new
  baselines.

### 6. Rewrite the Chrome baselines and review them

- **Goal:** The options screenshots now show the closed share disclosure on each History card. Run
  `npm run test:e2e:update-baselines`, confirm with `git status` that only `options-*` images changed (any other
  changed image means an unintended layout change: stop and report), then run the `review-ui` command
  (`.claude/commands/review-ui.md`) over the options images and fix only what it flags in `share-panel.css`,
  regenerating afterwards. Report the review findings in `progress.md`.
- **Files:** `e2e/baselines/chrome/options-*.png`, and `src/entrypoints/shared/share-panel.css` only if the
  review asks for a fix
- **Verify:** `npm run test:e2e`; the whole suite passes with 0 unexpected requests.
- **Out of scope:** new visual scenarios (see Q3), `store/screenshots/`, other pages.

## Risks / open questions

- **Q1. Privacy policy.** The filing date is new data kept in `storage.local`. `site/privacy/index.html` and
  `site/en/privacy/index.html` list what is stored and do not mention it. The spec does not ask for a change and
  these pages are outward-facing. Should a step add "and, if you enter one, the filing date" to both lists, with
  a new review date? If yes, it goes in Phase 3 as its own step, and the deploy stays with you.
- **Q2. Closed disclosure.** The plan puts the share control in a `<details>` that starts closed, like "Report a
  problem", so History stays compact and the screenshot change is one line per card. Confirm, or say if it
  should be open by default.
- **Q3. Visual coverage of the open panel.** The plan does not add a screenshot of the open panel to the matrix.
  Should step 6 add an `options: sharing progress` scenario (2 locales × 2 viewports)?
- Assumptions to confirm or correct at sign-off: the attribution line is `Generado con naciocheck.vgr.cat` in the
  English UI too, as the spec states. The filing date is not part of the identity, so it is stored in plain form
  even when encryption is on (ADR 0004 covers NIE, número, year and birth date only). Registration is recognised
  by the normalised main text `abierto - registrado`, not by `statusKey`, so it works the same for checks stored
  before any catalogue change.
- Stop and ask if any step seems to need a new permission, a dependency, a change to `changes.ts` or
  `normalise.ts`, a schema version bump, or a test-only path in the extension.
