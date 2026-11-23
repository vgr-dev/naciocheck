---
status: active # draft | active | done | abandoned
created: 2026-11-23
status-date: 2026-11-23
---

# Share expediente progress

## Goal

Let someone copy a short timeline of one expediente from NacioCheck and paste it into a message. An optional
filing date lets them include when they actually presented the application, even if they started checking later.

## Scope

- Add a share control to each expediente's History card in Options. Show a selectable plain-text preview, a
  Copy button and an optional filing date that the user can save, change or clear for that expediente.
- Use the full history of successful status checks. Include the first status and each subsequent change,
  using NacioCheck's existing comparison of normalized main status and sub-status text. A sub-status appearing,
  changing or disappearing counts as a change under any main status, including statuses unknown to the catalogue.
  Skip failed and unrecognized checks and collapse repeats across failures.
- Saving a filing date is the user's opt-in. Use it for the first observed `Abierto - Registrado` entry in the
  shared summary. If the expediente's history has no observed registration, add an `Abierto - Registrado.` entry
  using the saved date. With the date cleared or left blank, use recorded dates and include only observed statuses.
- Number the entries from 1, oldest date first, with one `<n>. <date> - <raw status>` entry per line. Use
  the original main status text followed by a space and the original sub-status text when present. Use
  `DD/MM/YYYY` in both UI languages. Show recorded dates in the browser's local time zone and keep the filing
  date as the calendar date entered. End the summary with `Generado con naciocheck.vgr.cat` on its own line.

```text
1. 15/01/2026 - Abierto - Registrado.
2. 10/03/2026 - Abierto - En tramitación. Su expediente se encuentra en tramitación.
3. 22/05/2026 - Abierto - En tramitación. Su expediente se encuentra en calificación.
Generado con naciocheck.vgr.cat
```

## Non-goals

- Editing other dates or status text, adding other manual milestones or changing the history and alert flows.
- Share links, destination integrations or public hosting of timelines.

## Relevant files

- `src/entrypoints/options/main.ts` renders per-expediente history cards.
- `src/core/storage.ts` owns application metadata and recorded checks. `src/core/backup.ts` handles backups.
- `src/core/changes.ts` and `src/core/normalise.ts` define how NacioCheck compares status text.
- `src/core/locales/es.ts` and `src/core/locales/en.ts` contain UI labels and feedback.
- `src/entrypoints/shared/report-panel.ts` shows the existing pattern for clipboard copy and manual selection.

## Constraints (do not touch)

- Preserve recorded check timestamps, status text and alert behavior. Keep the optional filing date local to
  the expediente and preserve it in backups. Existing applications and backups work with no date set.
- The preview and clipboard text contain only the numbered dates, statuses and attribution. Exclude application
  labels, expediente numbers, NIEs, birth dates and check errors. Copy requires a user action.
- Keep manifest permissions, host patterns, dependencies, network behavior and official fixtures unchanged.

## Acceptance criteria

- [ ] Repeated checks yield one line per continuous run of the same status and sub-status, dated to its first
      observation. A return to an earlier status and sub-status gets a new line. Changes in text unknown to the
      catalogue count.
- [ ] A sub-status appearing, changing or disappearing under the same main status produces a new line. Apply
      this to `En tramitación`, other known statuses and unknown-to-the-catalogue statuses. Each line includes
      the original sub-status text when present.
- [ ] A saved filing date changes the first observed registration line without duplicating it, including when the
      current status is later. When registration was missed, saving a date adds the line even if there are no
      successful checks yet. Leaving the field blank or clearing it yields a summary of observed statuses only.
- [ ] The filing date accepts real calendar dates up to today and no later than the earliest successful check,
      when one exists. It survives reopening Options and a backup round trip without changing another expediente.
- [ ] The preview and pasted text match the requested numbering, date format, raw wording and attribution in both
      UI languages. If clipboard access fails, the preview remains selectable for manual copying.
- [ ] If there are no successful checks and no filing date, there is no summary to copy.

## Open questions

- None.
