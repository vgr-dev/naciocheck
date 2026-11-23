import { t } from './i18n';
import type { PlainIdentity } from './storage';

/**
 * Field validation for the options form, matching the formats the official page accepts: a NIE, a número
 * that starts with a letter, a four-digit year and a birth date that exists and has already happened. Kept
 * separate from the UI so it is tested.
 */

export type IdentityField = keyof Omit<PlainIdentity, 'kind'>;

export type IdentityErrors = Partial<Record<IdentityField, string>>;

const NIE = /^[XYZ]?\d{7,8}[A-Z]$/;
const NUMERO = /^[A-Z]\d{1,9}$/;
const YEAR = /^\d{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Formats today or a supplied timestamp as `AAAA-MM-DD` in the reader's own time zone. */
export function localCalendarDate(now: Date | string = new Date()): string {
  const date = typeof now === 'string' ? new Date(now) : now;
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Validates a filing date against today and the first successful check's local calendar day. */
export function filingDateError(
  value: string,
  earliestCheckAt: string | null,
  now: Date = new Date(),
): string | null {
  const date = value.trim();
  if (!isCalendarDate(date)) return t('validation.filingDate');
  if (date > localCalendarDate(now)) return t('validation.filingDateFuture');
  if (earliestCheckAt !== null && date > localCalendarDate(earliestCheckAt)) {
    return t('validation.filingDateAfterCheck');
  }
  return null;
}

/** True only for a real date in the `YYYY-MM-DD` calendar-date form. */
export function isCalendarDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [year = NaN, month = NaN, day = NaN] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * What is wrong with a birth date, or `null` when nothing is.
 *
 * `Date.parse` rolls impossible dates over instead of rejecting them — `2023-02-31` becomes 3 March — so the
 * date is parsed and compared back field by field. A birth date after today is not a date anybody was born on.
 */
function birthDateError(value: string): string | null {
  const trimmed = value.trim();
  if (!isCalendarDate(trimmed)) return t('validation.birthDate');

  // `AAAA-MM-DD` sorts as text, so a plain comparison is enough.
  return trimmed > localCalendarDate() ? t('validation.birthDateFuture') : null;
}

export function validateIdentity(identity: Omit<PlainIdentity, 'kind'>): IdentityErrors {
  const errors: IdentityErrors = {};

  if (!NIE.test(identity.nie.trim().toUpperCase())) {
    errors.nie = t('validation.nie');
  }
  if (!NUMERO.test(identity.numero.trim().toUpperCase())) {
    errors.numero = t('validation.numero');
  }
  if (!YEAR.test(identity.year.trim())) {
    errors.year = t('validation.year');
  }
  const birthDate = birthDateError(identity.birthDate);
  if (birthDate !== null) {
    errors.birthDate = birthDate;
  }

  return errors;
}

export function isValidIdentity(identity: Omit<PlainIdentity, 'kind'>): boolean {
  return Object.keys(validateIdentity(identity)).length === 0;
}
