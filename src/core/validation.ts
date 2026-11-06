import type { PlainIdentity } from './storage';

/**
 * Field validation for the options form, matching the formats the official page accepts: a NIE, a número
 * that starts with a letter, a four-digit year and a real date. Kept separate from the UI so it is tested.
 */

export type IdentityField = keyof Omit<PlainIdentity, 'kind'>;

export type IdentityErrors = Partial<Record<IdentityField, string>>;

const NIE = /^[XYZ]?\d{7,8}[A-Z]$/;
const NUMERO = /^[A-Z]\d{1,9}$/;
const YEAR = /^\d{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateIdentity(identity: Omit<PlainIdentity, 'kind'>): IdentityErrors {
  const errors: IdentityErrors = {};

  if (!NIE.test(identity.nie.trim().toUpperCase())) {
    errors.nie = 'Escribe el NIE con letra final, por ejemplo X1234567L.';
  }
  if (!NUMERO.test(identity.numero.trim().toUpperCase())) {
    errors.numero = 'El número empieza por una letra y sigue con dígitos, por ejemplo R500001.';
  }
  if (!YEAR.test(identity.year.trim())) {
    errors.year = 'El año son cuatro dígitos, por ejemplo 2015.';
  }
  if (!DATE.test(identity.birthDate.trim()) || Number.isNaN(Date.parse(identity.birthDate))) {
    errors.birthDate = 'La fecha de nacimiento va como AAAA-MM-DD.';
  }

  return errors;
}

export function isValidIdentity(identity: Omit<PlainIdentity, 'kind'>): boolean {
  return Object.keys(validateIdentity(identity)).length === 0;
}
