/**
 * Masks anything shaped like an identifier. A module of its own with no import, so the Worker can reuse it
 * without pulling the extension's storage or crypto code into its typecheck.
 */

const NOT_LETTER_OR_DIGIT_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const NOT_LETTER_OR_DIGIT_AFTER = String.raw`(?![\p{L}\p{N}])`;

const NIE_PATTERN = new RegExp(
  `${NOT_LETTER_OR_DIGIT_BEFORE}[XYZ]?\\d{7,8}[A-Z]${NOT_LETTER_OR_DIGIT_AFTER}`,
  'giu',
);
const REF_PATTERN = new RegExp(
  `${NOT_LETTER_OR_DIGIT_BEFORE}[A-Z]\\d{4,9}${NOT_LETTER_OR_DIGIT_AFTER}`,
  'giu',
);
const DAY_FIRST_DATE_PATTERN = /(?<!\d)\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2})(?!\d)/g;
const YEAR_FIRST_DATE_PATTERN = /(?<!\d)\d{4}-\d{1,2}-\d{1,2}(?!\d)/g;
const NUMBER_PATTERN = /\d{4,}/g;

/**
 * Masks anything shaped like an identifier, with visible masks, in this order: a NIE → `[NIE]`, an
 * application number → `[REF]`, a date → `[DATE]`, any run of four or more digits → `[NUMBER]`.
 * Idempotent: no mask contains a digit, so a second pass finds nothing new.
 */
export function redact(text: string): string {
  return text
    .replace(NIE_PATTERN, '[NIE]')
    .replace(REF_PATTERN, '[REF]')
    .replace(DAY_FIRST_DATE_PATTERN, '[DATE]')
    .replace(YEAR_FIRST_DATE_PATTERN, '[DATE]')
    .replace(NUMBER_PATTERN, '[NUMBER]');
}
