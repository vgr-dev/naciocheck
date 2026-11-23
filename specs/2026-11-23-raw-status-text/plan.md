# Plan: Show the status exactly as the site printed it

Spec: `spec.md`

**Sign-off:** Approved by Victor Gonzalez on 2026-11-23

## Status

<!-- One line per step, in step order. The only part of this file that changes after sign-off.
[ ] todo | [~] in progress | [x] done | [-] deferred | [!] blocked
After the title: `uncommitted`, a short commit hash, or the reason (deferred/blocked).
Never [x] for partial work. Details live in progress.md. -->

**Phase 1: Switch every status name to the raw text**

- [x] 1. Name the status by its raw text in the result view f6ad217
- [x] 2. Name the states by their raw texts in the anomaly note f6ad217
- [x] 3. Show the raw text in the popup and the options history f6ad217
- [x] 4. Lead each guide entry with the Spanish name and an English gloss 19cf22b

**Phase 2: Remove displayStatus**

- [x] 5. Delete displayStatus and its unit tests uncommitted

**Phase 3: End-to-end assertions and the manual checklist**

- [ ] 6. Update the E2E assertions to the raw names
- [ ] 7. Rewrite Firefox checklist row 12

**Phase 4: Visual baselines**

- [ ] 8. Rewrite the Chrome baselines and review them

## Phase 1: Switch every status name to the raw text

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck`; all unit
  tests pass, no lint errors, Prettier reports no changes, both tsconfigs typecheck. The E2E suite is
  expected to fail on status-name assertions and on visual baselines until phases 3 and 4; do not run it here.

### 1. Name the status by its raw text in the result view

- **Goal:** In `src/core/alerts.ts`:
  - `buildResultView`: `status.title` is `current.raw` for every status, catalogued or not, in every
    locale (drop the `entry[locale].title` lookup). `explanation`, `whatYouCanDo` and `observedMeaning`
    are unchanged (still `entry[locale]`, still in the UI language).
  - `previousSummary` uses `previous.raw` directly; the "Antes:/Before:" label stays in `locale`.
  - Remove the `displayStatus` import. `versionLine`, `anomaly`, `sources`, `buildErrorView` and
    `decideAlert` are unchanged.
  - Update the `ResultView` doc comment: `status.title` is the site's text as read.
  - In `tests/alerts.test.ts`, rewrite the affected cases: the title is `'Abierto - Registrado.'` (with
    the period); in `locale: 'en'` the title is `'Abierto - En tramitación.'` and `previous.text` is
    `'Before: Abierto - Registrado.'`. Rename tests whose names say "catalogue title". Keep the
    unknown-status, observed-meaning (both locales) and error-view cases as they are.
- **Files:** `src/core/alerts.ts`, `tests/alerts.test.ts`
- **Verify:** `npx vitest run tests/alerts.test.ts`; all pass. `npm run typecheck`; no errors.
- **Out of scope:** `displayStatus` itself (step 5), the anomaly note (step 2), the result page DOM
  (`src/entrypoints/result/main.ts` needs no change), explanations and their locale.

### 2. Name the states by their raw texts in the anomaly note

- **Goal:** In `src/core/anomaly.ts`, `describe()` names a state by the check's `raw` text instead of
  the catalogue title, in both the `es` and the `en` note. With a sub-status, it is `` `${raw} ${subStatus}` ``
  (one space; both already end with the site's period), replacing the current `title, subStatus` form.
  `describe` takes the `Check` (or its `raw` and `subStatus`) instead of the resolved state and locale;
  `statusTitle()` and, if then unused, the `STATUS_CATALOG` import are removed. `detectAnomaly`'s
  detection logic, `kind`, `source` and the rest of both sentences are unchanged.
  - In `tests/anomaly.test.ts`, update the assertions on names: the Spanish cases expect the fixtures'
    raw texts (e.g. `'Abierto - En calificación.'`, `'Abierto - En tramitación.'`), and the English case
    ("writes the note in English…") expects `'The file moves from'` plus the same raw Spanish texts,
    with an assertion that `'Open - In progress'` and `'Open - Under assessment'` do not appear.
    Use whatever raw texts the fixtures at the top of the file hold; do not change the fixtures.
- **Files:** `src/core/anomaly.ts`, `tests/anomaly.test.ts`
- **Verify:** `npx vitest run tests/anomaly.test.ts`; all pass. `npx eslint src/core/anomaly.ts`; no
  errors (no unused imports).
- **Out of scope:** `classifyTransition`, `resolvePathState`, the source link, the result page markup.
  The note is built at check time, so notes already cached in `storage.session` keep their old wording
  until the next check; no migration.

### 3. Show the raw text in the popup and the options history

- **Goal:** The popup card (`src/entrypoints/popup/main.ts:138`) and the options history
  (`src/entrypoints/options/main.ts:323`) print `latest.raw` / `check.raw` for a status outcome. Remove
  the `displayStatus` imports, and `currentLocale` imports only if nothing else in the file uses them
  (popup imports it alongside `setLocale`; check before removing).
- **Files:** `src/entrypoints/popup/main.ts`, `src/entrypoints/options/main.ts`
- **Verify:** `npm run typecheck`; no errors.
  `npx eslint src/entrypoints/popup/main.ts src/entrypoints/options/main.ts`; no errors (no unused imports).
- **Out of scope:** error lines (`common.errorPrefix`, `popup.lastError`), the "changed" marker, any
  other wording.

### 4. Lead each guide entry with the Spanish name and an English gloss

- **Goal:** In `card()` of `src/entrypoints/statuses/main.ts`, the `h3` shows `entry.es.title`. When
  `locale === 'en'`, the `h3` gets `lang="es"` and is followed by a `p.gloss` with `entry.en.title`
  (no `lang` needed: it is the page language). When `locale === 'es'` (Spanish and the `qps`
  pseudo-locale) there is no gloss. Explanations, steps, what-you-can-do and sources stay in `locale`.
  Add a `.card p.gloss` rule to `src/entrypoints/shared/pages.css` that reads as a secondary line
  under the heading (smaller, `var(--gray-600)`, tight top margin), using only existing tokens.
- **Files:** `src/entrypoints/statuses/main.ts`, `src/entrypoints/shared/pages.css`
- **Verify:** `npm run typecheck`; no errors. `npx eslint src/entrypoints/statuses/main.ts`; no errors.
  `npx prettier --check src/entrypoints/statuses/main.ts src/entrypoints/shared/pages.css`; clean.
- **Out of scope:** the catalogue's titles or explanations, section order, `.card h3` styling for
  other pages.

## Phase 2: Remove displayStatus

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck`; all green.

### 5. Delete displayStatus and its unit tests

- **Goal:** `displayStatus` (and its doc comment) is gone from `src/core/statuses.ts`; the
  `describe('displayStatus', …)` block and its import are gone from `tests/statuses.test.ts`.
  `grep -rn displayStatus src tests e2e` returns nothing.
- **Files:** `src/core/statuses.ts`, `tests/statuses.test.ts`
- **Verify:** `npx vitest run tests/statuses.test.ts`; passes. `npm run typecheck`; no errors.
  `grep -rn displayStatus src tests e2e`; no output.
- **Out of scope:** `findStatus`, `statusKeyOf`, the catalogue's `en` texts (the guide still uses them).

## Phase 3: End-to-end assertions and the manual checklist

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck`; all green.
  `E2E_SPEC=check-flow npm run test:e2e` and `E2E_SPEC=pages npm run test:e2e`; both pass. The visual
  spec still fails on baselines until phase 4.

### 6. Update the E2E assertions to the raw names

- **Goal:**
  - `h1.status` expectations become the raw text with its period: `check-flow.e2e.ts` lines ~155, 200,
    472 and `pages.e2e.ts` lines ~1053, 1136, 1247 (`'Abierto - Registrado.'`,
    `'Abierto - En tramitación.'`).
  - Replace the test at `pages.e2e.ts:705` ("names the statuses in English…") with one asserting that in
    the English UI the options history and the popup card show `Abierto - Registrado.` exactly, and
    rewrite its doc comment for the new rule (the site's text everywhere).
  - In the English-UI part of "labels the site's own sentence…" (`pages.e2e.ts` ~1091), also assert
    `h1.status` is the raw text; fix the "status name is translated" comment above it.
  - The anomaly assertion in `check-flow.e2e.ts` (~237, `/no se había observado hasta ahora/`) should
    still pass; if it checks a state name, use the raw text.
  - In the status-guide describe (`pages.e2e.ts` ~945), add a case: with `setStoredLanguage('en')`,
    the first `.card h3` has `lang="es"` and a Spanish title, followed by a `p.gloss` with its English
    title; in Spanish no `p.gloss` exists.
  - Fake data only; `tests/fixtures/` untouched.
- **Files:** `e2e/specs/check-flow.e2e.ts`, `e2e/specs/pages.e2e.ts`
- **Verify:** `npm run typecheck`; no errors. `E2E_SPEC=check-flow npm run test:e2e`;
  `E2E_SPEC=pages npm run test:e2e`; both pass with 0 unexpected network requests.
- **Out of scope:** `e2e/specs/visual.e2e.ts` and `e2e/baselines/` (step 8), the network guard,
  helpers in `e2e/support/` unless an assertion truly needs a new one.

### 7. Rewrite Firefox checklist row 12

- **Goal:** Row 12 of `docs/manual-firefox-checklist.md` expects: in English, options, popup and guide
  switch to English with `lang=en` / `dir=ltr`; status names in the popup, the history and the result
  heading read exactly as the site printed them (for example "Abierto - Registrado."); explanations
  stay in English; the guide leads each entry
  with the Spanish name and an English gloss; the site's sentence stays after "As the site printed
  it:"; switching back restores Spanish. The **Observed** cell is reset to empty (or `Not run`) so the
  old PASS is not carried over. Keep the table aligned for Prettier.
- **Files:** `docs/manual-firefox-checklist.md`
- **Verify:** `npx prettier --check docs/manual-firefox-checklist.md`; clean.
- **Out of scope:** other rows; running the manual check (the user's, before release).

## Phase 4: Visual baselines

- **Phase verify:** `npm test && npm run lint && npm run format:check && npm run typecheck`;
  `npm run test:e2e`; `npm run build:chrome && npm run build:firefox && npm run check:privacy`; all
  pass, E2E with 0 unexpected requests, privacy gate unchanged.

### 8. Rewrite the Chrome baselines and review them

- **Goal:** `npm run test:e2e:update-baselines` rewrites `e2e/baselines/chrome/`. Expected to change:
  `result-*` (es and en: the heading is the full raw text with its period; any with an anomaly note),
  `popup-{one,several,changed}-en-*`, `options-several-en-*`, `statuses-guide-en-*`. Any other changed
  image is a finding: stop and report it. Then run `/review-ui` (read-only) on the matrix and record
  its findings in `progress.md`; fix nothing here.
- **Files:** `e2e/baselines/chrome/*.png`
- **Verify:** `npm run test:e2e:update-baselines` then `npm run test:e2e`; passes against the new
  baselines. `git status --short e2e/baselines` lists only the expected families.
- **Out of scope:** changing `visual.e2e.ts`, styles or copy in response to the review (raise
  findings for a follow-up instead).

## Risks / open questions

Resolved with the user on 2026-11-23: explanations stay in the UI language (old step 2 removed);
`lang="es"` on raw names is deferred (spec non-goal); the anomaly note is in scope (step 2); E2E red
between phases 1 and 3/4 is accepted.

1. **E2E is red between phases 1 and 4.** Unit tests, lint, format and typecheck stay green after every
   phase; the E2E suite is only green after phase 3 (non-visual specs) and phase 4 (all).
2. **Longer headings.** The result heading becomes the full raw text (e.g. "Abierto - En tramitación:
   Requerido."), and the popup card in a narrow width may wrap. Step 8's `/review-ui` should check
   wrapping at 380 px and mobile width; any problem is a finding, not fixed in this spec.
3. Scoped verifies use `npx eslint <file>`, `npx prettier --check <file>` and `E2E_SPEC=<spec> npm run
test:e2e` (the filter `e2e/wdio.conf.ts` documents); they are narrower forms of the AGENTS.md commands.
