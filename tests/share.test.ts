import { describe, expect, it } from 'vitest';
import { buildShareSummary, SHARE_ATTRIBUTION } from '../src/core/share';
import type { Check } from '../src/core/storage';

function at(day: number, hour = 12, month = 0): string {
  return new Date(2026, month, day, hour).toISOString();
}

function check(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check',
    applicationId: 'app-private',
    at: at(15),
    outcome: 'status',
    statusKey: 'unknown',
    raw: 'Abierto - Registrado.',
    subStatus: null,
    acknowledged: false,
    ...overrides,
  };
}

function lines(summary: string | null): string[] {
  return (summary ?? '').split('\n').slice(0, -1);
}

describe('buildShareSummary', () => {
  it('orders checks chronologically and formats raw status, sub-status, and attribution', () => {
    const result = buildShareSummary(
      [
        check({
          id: 'c3',
          at: at(22, 12, 4),
          raw: 'Abierto - En tramitación.',
          subStatus: 'Su expediente se encuentra en calificación.',
        }),
        check({ id: 'c1', at: at(15) }),
        check({
          id: 'c2',
          at: at(10, 12, 2),
          raw: 'Abierto - En tramitación.',
          subStatus: 'Su expediente se encuentra en tramitación.',
        }),
      ],
      null,
    );

    expect(result).toBe(
      `1. 15/01/2026 - Abierto - Registrado.\n2. 10/03/2026 - Abierto - En tramitación. Su expediente se encuentra en tramitación.\n3. 22/05/2026 - Abierto - En tramitación. Su expediente se encuentra en calificación.\n${SHARE_ATTRIBUTION}`,
    );
  });

  it('sorts offset-bearing timestamps by their actual instant', () => {
    const result = buildShareSummary(
      [
        check({ id: 'later', at: '2026-01-01T23:00:00Z', raw: 'Estado posterior' }),
        check({ id: 'earlier', at: '2026-01-02T00:30:00+02:00', raw: 'Estado anterior' }),
      ],
      null,
    );

    expect(lines(result).map((line) => line.slice(line.indexOf(' - ') + 3))).toEqual([
      'Estado anterior',
      'Estado posterior',
    ]);
    expect(lines(result).every((line) => /^\d+\. \d{2}\/\d{2}\/\d{4} - /.test(line))).toBe(true);
  });

  it('collapses repeats across failed and unrecognized checks and starts a new run on return', () => {
    const result = buildShareSummary(
      [
        check({ at: at(1) }),
        check({ id: 'error', at: at(2), outcome: 'error', raw: 'private error text' }),
        check({ id: 'repeat', at: at(3) }),
        check({ id: 'unknown', at: at(4), outcome: 'unknown' }),
        check({ id: 'b', at: at(5), raw: 'Estado raro' }),
        check({ id: 'a-again', at: at(6) }),
      ],
      null,
    );

    expect(lines(result)).toEqual([
      '1. 01/01/2026 - Abierto - Registrado.',
      '2. 05/01/2026 - Estado raro',
      '3. 06/01/2026 - Abierto - Registrado.',
    ]);
    expect(result).not.toContain('private error text');
  });

  it.each(['Abierto - En tramitación.', 'Abierto - En calificación.', 'Estado fuera del catálogo'])(
    'treats sub-status appearing, changing, and disappearing as changes for %s',
    (raw) => {
      const result = buildShareSummary(
        [
          check({ at: at(1), raw, subStatus: null }),
          check({ at: at(2), raw, subStatus: 'Uno' }),
          check({ at: at(3), raw, subStatus: 'Dos' }),
          check({ at: at(4), raw, subStatus: null }),
        ],
        null,
      );

      expect(lines(result)).toEqual([
        `1. 01/01/2026 - ${raw}`,
        `2. 02/01/2026 - ${raw} Uno`,
        `3. 03/01/2026 - ${raw} Dos`,
        `4. 04/01/2026 - ${raw}`,
      ]);
    },
  );

  it('uses normalized comparisons but preserves the first raw wording', () => {
    const result = buildShareSummary(
      [
        check({ at: at(1), raw: 'Abierto - Registrado.' }),
        check({ at: at(2), raw: 'ABIERTO – REGISTRADO' }),
      ],
      null,
    );
    expect(lines(result)).toEqual(['1. 01/01/2026 - Abierto - Registrado.']);
  });

  it('replaces the observed registration date, or inserts it when it was missed', () => {
    expect(
      lines(
        buildShareSummary(
          [
            check({ at: at(2) }),
            check({ id: 'later', at: at(4), raw: 'Abierto - En tramitación.' }),
          ],
          '2025-12-20',
        ),
      ),
    ).toEqual([
      '1. 20/12/2025 - Abierto - Registrado.',
      '2. 04/01/2026 - Abierto - En tramitación.',
    ]);

    expect(
      lines(
        buildShareSummary([check({ at: at(4), raw: 'Abierto - En tramitación.' })], '2026-01-02'),
      ),
    ).toEqual([
      '1. 02/01/2026 - Abierto - Registrado.',
      '2. 04/01/2026 - Abierto - En tramitación.',
    ]);
  });

  it('keeps filing dates as calendar dates and sorts ties stably', () => {
    const result = buildShareSummary(
      [
        check({ at: at(3), raw: 'Estado A' }),
        check({ id: 'registered', at: at(4), raw: 'Abierto - Registrado.' }),
        check({ id: 'state-b', at: at(5), raw: 'Estado B' }),
      ],
      '2026-01-03',
    );

    expect(lines(result)).toEqual([
      '1. 03/01/2026 - Estado A',
      '2. 03/01/2026 - Abierto - Registrado.',
      '3. 05/01/2026 - Estado B',
    ]);
  });

  it('returns null without checks or filing date and permits filing-only summaries', () => {
    expect(buildShareSummary([], null)).toBeNull();
    expect(buildShareSummary([], '2026-01-15')).toBe(
      `1. 15/01/2026 - Abierto - Registrado.\n${SHARE_ATTRIBUTION}`,
    );
    expect(buildShareSummary([check()], '')).toContain('15/01/2026');
    expect(buildShareSummary([check()], '  ')).toContain('15/01/2026');
  });

  it('uses the browser-local date and excludes identifiers and failure details', () => {
    const result = buildShareSummary(
      [
        check({ at: new Date(2026, 0, 15, 0, 30).toISOString() }),
        check({ id: 'check-private', outcome: 'error', raw: 'NIE, número, birth date and error' }),
      ],
      null,
    );
    expect(lines(result)).toEqual(['1. 15/01/2026 - Abierto - Registrado.']);
    expect(result).not.toMatch(/app-private|check-private|NIE|número|birth date|error/i);
  });
});
