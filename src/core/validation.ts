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

/** Today as `AAAA-MM-DD` in the reader's own time zone: the day the person filling the form is on. */
function today(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * What is wrong with a birth date, or `null` when nothing is.
 *
 * `Date.parse` rolls impossible dates over instead of rejecting them — `2023-02-31` becomes 3 March — so the
 * date is parsed and compared back field by field. A birth date after today is not a date anybody was born on.
 */
function birthDateError(value: string): string | null {
  const trimmed = value.trim();
  if (!DATE.test(trimmed)) return t('validation.birthDate');

  const [year = NaN, month = NaN, day = NaN] = trimmed.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const exists =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!exists) return t('validation.birthDate');

  // `AAAA-MM-DD` sorts as text, so a plain comparison is enough.
  return trimmed > today() ? t('validation.birthDateFuture') : null;
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
