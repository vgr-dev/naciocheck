import { evaluateChange } from './changes';
import { normaliseText } from './normalise';
import type { Check } from './storage';

export const SHARE_ATTRIBUTION = 'Generado con naciocheck.vgr.cat';

interface ShareEntry {
  dateKey: string;
  text: string;
  raw: string;
}

function localDateKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

export function buildShareSummary(
  checks: readonly Check[],
  filingDate: string | null,
): string | null {
  const ordered = checks
    .map((check, index) => ({ check, index }))
    .filter(({ check }) => check.outcome === 'status')
    .sort((a, b) => Date.parse(a.check.at) - Date.parse(b.check.at) || a.index - b.index);

  const entries: ShareEntry[] = [];
  let previous: Check | null = null;
  for (const { check } of ordered) {
    if (evaluateChange(previous, check).kind !== 'unchanged') {
      const main = check.raw.trim();
      const sub = check.subStatus?.trim();
      entries.push({
        dateKey: localDateKey(check.at),
        text: sub ? `${main} ${sub}` : main,
        raw: main,
      });
    }
    previous = check;
  }

  const date = filingDate?.trim();
  if (date) {
    const registrationEntry = entries.find(
      (entry) => normaliseText(entry.raw) === normaliseText('Abierto - Registrado'),
    );
    if (registrationEntry) registrationEntry.dateKey = date;
    else
      entries.unshift({
        dateKey: date,
        text: 'Abierto - Registrado.',
        raw: 'Abierto - Registrado.',
      });
  }

  if (entries.length === 0) return null;

  entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return `${entries.map(({ dateKey, text }, index) => `${index + 1}. ${displayDate(dateKey)} - ${text}`).join('\n')}\n${SHARE_ATTRIBUTION}`;
}
