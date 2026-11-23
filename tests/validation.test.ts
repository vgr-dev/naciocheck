import { describe, expect, it } from 'vitest';
import { t } from '../src/core/i18n';
import { filingDateError, isValidIdentity, validateIdentity } from '../src/core/validation';

const VALID = {
  nie: 'X0000000X',
  numero: 'R500001',
  year: '2015',
  birthDate: '1990-01-01',
};

/** The reader's own date as `AAAA-MM-DD`, moved by `offsetDays`: what the form says today and tomorrow. */
function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${month}-${day}`;
}

describe('validateIdentity', () => {
  it('accepts a well-formed identity', () => {
    expect(validateIdentity(VALID)).toEqual({});
    expect(isValidIdentity(VALID)).toBe(true);
  });

  it('accepts a NIE with or without the leading XYZ letter, in either case', () => {
    for (const nie of ['12345678L', 'X1234567L', 'x1234567l', 'Y0000001A', 'Z9999999Z']) {
      expect(validateIdentity({ ...VALID, nie }).nie, nie).toBeUndefined();
    }
  });

  it('rejects a NIE without its letter or too short', () => {
    for (const nie of ['', '1234567', 'X123456L', '1234567-L']) {
      expect(validateIdentity({ ...VALID, nie }).nie, nie).toBeDefined();
    }
  });

  it('rejects a número without the leading letter', () => {
    expect(validateIdentity({ ...VALID, numero: '500001' }).numero).toBeDefined();
    expect(validateIdentity({ ...VALID, numero: '' }).numero).toBeDefined();
  });

  it('rejects a year that is not four digits', () => {
    expect(validateIdentity({ ...VALID, year: '15' }).year).toBeDefined();
    expect(validateIdentity({ ...VALID, year: '20150' }).year).toBeDefined();
  });

  it('rejects a date that is not a real AAAA-MM-DD', () => {
    expect(validateIdentity({ ...VALID, birthDate: '01/01/1990' }).birthDate).toBeDefined();
    expect(validateIdentity({ ...VALID, birthDate: '1990-13-01' }).birthDate).toBeDefined();
  });

  it('rejects a day that its month does not have, which Date.parse would roll over', () => {
    for (const birthDate of [
      '2023-02-30',
      '2023-02-31',
      '2023-02-29',
      '1990-04-31',
      '1990-00-10',
    ]) {
      expect(validateIdentity({ ...VALID, birthDate }).birthDate, birthDate).toBe(
        t('validation.birthDate'),
      );
    }
  });

  it('accepts the 29th of February of a leap year', () => {
    expect(validateIdentity({ ...VALID, birthDate: '2024-02-29' }).birthDate).toBeUndefined();
    expect(validateIdentity({ ...VALID, birthDate: '2000-02-29' }).birthDate).toBeUndefined();
  });

  it('accepts today and rejects anything later', () => {
    expect(validateIdentity({ ...VALID, birthDate: isoDate() }).birthDate).toBeUndefined();
    for (const birthDate of [isoDate(1), '2999-01-01']) {
      expect(validateIdentity({ ...VALID, birthDate }).birthDate, birthDate).toBe(
        t('validation.birthDateFuture'),
      );
    }
  });

  it('reports every bad field at once', () => {
    expect(
      Object.keys(validateIdentity({ nie: '', numero: '', year: '', birthDate: '' })),
    ).toHaveLength(4);
  });
});

describe('filingDateError', () => {
  const now = new Date(2026, 5, 10, 12);
  it('requires a real calendar date and accepts today', () => {
    expect(filingDateError('2026-02-30', null, now)).toBe(t('validation.filingDate'));
    expect(filingDateError('10/06/2026', null, now)).toBe(t('validation.filingDate'));
    expect(filingDateError('2026-06-10', null, now)).toBeNull();
    expect(filingDateError('2026-06-11', null, now)).toBe(t('validation.filingDateFuture'));
  });

  it('allows the earliest check day and rejects a later day in local time', () => {
    const checkAt = new Date(2026, 5, 10, 1).toISOString();
    const afterBothDates = new Date(2026, 5, 12, 12);
    expect(filingDateError('2026-06-10', checkAt, afterBothDates)).toBeNull();
    expect(filingDateError('2026-06-11', checkAt, afterBothDates)).toBe(
      t('validation.filingDateAfterCheck'),
    );
    expect(filingDateError('2026-06-09', checkAt, afterBothDates)).toBeNull();
  });
});
