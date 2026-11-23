---
status: done # draft | active | done | abandoned
created: 2026-11-23
status-date: 2026-11-23
---

# Show the status exactly as the site printed it

## Goal

Wherever NacioCheck names an application's status, it shows the text it last read from the official site,
unchanged, in every UI language. Today the extension swaps that text for a catalogue title: an English title
in the English UI and a short Spanish title in the result heading (for example "Requerido" for
"Abierto - En tramitación: Requerido"). A substituted name can differ from what the person sees on the sede,
and it hides the site's real wording behind the catalogue's. The person must always be able to match the name
NacioCheck shows to the one on the official page. This is a last change before v1.0.0.

## Scope

- Show `check.raw` exactly as stored (site casing, accents, trailing period) as the status name in:
  - the popup cards (`src/entrypoints/popup/main.ts:138`);
  - the options history (`src/entrypoints/options/main.ts:323`);
  - the "Antes: … / Before: …" line on the result page (`src/core/alerts.ts:175`);
  - the result-page status heading (`src/core/alerts.ts:135`).
- Anomaly note (`src/core/anomaly.ts`): names the two states by the raw texts of the previous and current
  checks instead of catalogue titles, in both the Spanish and the English note. When a sub-status exists it
  follows the raw status after a space (both already end with a period as the site prints them).
- The explanation, "what you can do" text and observed-meaning note stay in the UI language, as today:
  only the status name changes, so the site's text is the single source for it.
- Status guide page (`src/entrypoints/statuses/main.ts`): each entry leads with its Spanish name (`es.title`).
  In the English UI, the English title follows as a gloss so the reader can match the site's wording to its
  meaning. The guide's explanations stay in the UI language.
- Remove `displayStatus()` from `src/core/statuses.ts` once it has no callers.
- Update unit tests, E2E assertions, the Chrome visual baselines and row 12 of
  `docs/manual-firefox-checklist.md` ("status names read in English") to the new behaviour.

## Non-goals

- A setting to choose between raw and translated names (decided against: more storage, UI and test surface
  for less benefit).
- Changing the parser, `statusKeyOf`, the catalogue's matching, tones, sources or stored data.
- Tidying the raw text for display (trimming the period, recasing).
- Translating explanations differently from today (they stay in the UI language).
- `lang="es"` on the raw Spanish names in the popup, history and result page (screen-reader voice).
  Possible follow-up. The guide's Spanish headings do get it, as they are new markup.
- Changing the sub-status line ("Tal como la muestra la sede: / As the site printed it:"), which already
  shows the site's sentence as it printed it.
- Removing the catalogue's English texts (the guide still uses them).

## Relevant files

- `src/core/statuses.ts`: `displayStatus()`, `findStatus()`, catalogue `es`/`en` titles and explanations.
- `src/core/alerts.ts`: `buildResultView` (heading, explanation, what-you-can-do, observed meaning) and
  `previousSummary` ("Before:" line).
- `src/entrypoints/popup/main.ts`, `src/entrypoints/options/main.ts`: status name in cards and history.
- `src/core/anomaly.ts`, `tests/anomaly.test.ts`: the anomaly note's state names.
- `src/entrypoints/statuses/main.ts`: guide entry headings.
- `tests/statuses.test.ts`, `tests/alerts.test.ts`: `displayStatus` and title assertions.
- `e2e/specs/pages.e2e.ts:711-715`: expects "Open - Registered" in history and popup.
- `e2e/baselines/`: English-locale screenshots will change.
- `docs/manual-firefox-checklist.md`: row 12.

## Constraints (do not touch)

- Status explanations are never presented as official (AGENTS.md); their existing framing stays.
- No change to storage format, backup format, manifest, permissions or network behaviour.
- `tests/fixtures/` stays byte-for-byte; fake identities only.
- The notification text already uses `raw` (`alert.notificationMessage`); keep it that way.

## Acceptance criteria

- [x] In the English and Spanish UI, the popup card, the options history and the result heading show
      `check.raw` exactly (for example "Abierto - Registrado."), for both catalogued and unknown statuses.
- [x] The result page's "Before:" line shows the previous check's `raw` text in both languages.
- [x] The anomaly note names both states by their raw texts (plus the raw sub-status when present) in the
      Spanish and the English note; no catalogue title appears in it.
- [x] Explanations, what-you-can-do and observed-meaning texts are unchanged: in the UI language and framed
      as non-official.
- [x] In the English UI, each guide entry shows the Spanish name with the English title as a gloss; in the
      Spanish UI it shows the Spanish name only.
- [x] `displayStatus` no longer exists and nothing references it.
- [x] `npm test`, `npm run lint`, `npm run typecheck`, `npm run test:e2e` pass, with the affected baselines
      rewritten via `npm run test:e2e:update-baselines` and reviewed with `/review-ui`.
- [x] `npm run build:chrome`, `npm run build:firefox` and `npm run check:privacy` pass unchanged.
- [x] Firefox checklist row 12 describes the new behaviour; its old PASS is not carried over.

## Open questions

- None.
