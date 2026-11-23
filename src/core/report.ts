import type { Check } from './storage';
import type { StatusKey } from './statuses';

/**
 * The problem report: an editable text built from non-identifying fields only.
 *
 * Pure and deterministic, with no `wxt`, `i18n` or `browser` import, so the Worker can reuse `redact`.
 * The report never carries the person's own result (`raw`, `subStatus`) nor anything from `Identity`:
 * `ReportCheck` names the only two fields of a check that may enter, and `buildReport` copies them by name.
 */

/** The only two fields of a check a report may hold. */
export type ReportCheck = Pick<Check, 'outcome' | 'statusKey'>;

export interface ReportContext {
  version: string;
  /** Browser name and major version, for example `Chrome 130`. */
  browser: string;
  /** Catalan is not produced: a `ca` report comes with a `ca` locale. */
  locale: 'es' | 'en';
  /** The page's error messages, as the site printed them. Redacted before they enter the text. */
  errorMessages: readonly string[];
  /** The calm anomaly note, when there is one. Redacted before it enters the text. */
  anomaly: string | null;
}

/** The labelled fields of a report, in the order they appear. */
export const REPORT_FIELDS = [
  'title',
  'version',
  'browser',
  'locale',
  'outcome',
  'statusKey',
  'explanation',
  'errors',
  'anomaly',
  'comment',
] as const;

export type ReportField = (typeof REPORT_FIELDS)[number];

export type ReportLocale = ReportContext['locale'];

export const REPORT_LABELS: Readonly<Record<ReportLocale, Readonly<Record<ReportField, string>>>> =
  {
    es: {
      title: 'Informe de NacioCheck',
      version: 'versión',
      browser: 'navegador',
      locale: 'idioma',
      outcome: 'resultado',
      statusKey: 'clave de estado',
      explanation: 'explicación',
      errors: 'errores',
      anomaly: 'nota',
      comment: 'comentario',
    },
    en: {
      title: 'NacioCheck report',
      version: 'version',
      browser: 'browser',
      locale: 'locale',
      outcome: 'outcome',
      statusKey: 'status key',
      explanation: 'explanation',
      errors: 'errors',
      anomaly: 'anomaly note',
      comment: 'comment',
    },
  };

/** The longest report text; the rest is cut with a visible marker. */
export const REPORT_MAX_CHARS = 4000;

export const TRUNCATED_MARKER = '[truncated]';

const FEEDBACK_BASE = 'https://naciocheck.vgr.cat/';

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

/** One line, single spaces: a value never adds a line of its own to the report. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Cuts `text` to `max` characters including the visible marker; leaves shorter text alone. */
function cap(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  let end = Math.max(0, max - TRUNCATED_MARKER.length);
  // Never leave half of a surrogate pair at the cut.
  const last = text.charCodeAt(end - 1);
  if (end > 0 && last >= 0xd800 && last <= 0xdbff) {
    end -= 1;
  }
  return `${text.slice(0, end)}${TRUNCATED_MARKER}`;
}

/** `label: value` lines for the fields that have a value, then the empty comment line for the person. */
function compose(
  locale: ReportLocale,
  entries: readonly (readonly [ReportField, string | null])[],
): string {
  const labels = REPORT_LABELS[locale];
  const lines = [labels.title];
  for (const [field, value] of entries) {
    if (value !== null && value !== '') {
      lines.push(`${labels[field]}: ${value}`);
    }
  }
  const commentLine = `\n${labels.comment}:`;
  return `${cap(lines.join('\n'), REPORT_MAX_CHARS - commentLine.length)}${commentLine}`;
}

function redactedLine(value: string): string {
  return redact(oneLine(value));
}

export function buildReport(check: ReportCheck, context: ReportContext): string {
  // Copied by name, never spread: whatever else the object carries contributes nothing.
  const outcome = check.outcome;
  const statusKey = check.statusKey;

  const errors = context.errorMessages
    .map(redactedLine)
    .filter((message) => message !== '')
    .join(' | ');

  return compose(context.locale, [
    ['version', oneLine(context.version)],
    ['browser', oneLine(context.browser)],
    ['locale', context.locale],
    ['outcome', outcome],
    ['statusKey', statusKey],
    ['errors', errors],
    ['anomaly', context.anomaly === null ? null : redactedLine(context.anomaly)],
  ]);
}

/** The report for "this explanation looks wrong": the key and the explanation the guide showed. */
export function buildGuideReport(
  statusKey: StatusKey,
  explanation: string,
  context: Omit<ReportContext, 'errorMessages' | 'anomaly'>,
): string {
  return compose(context.locale, [
    ['version', oneLine(context.version)],
    ['browser', oneLine(context.browser)],
    ['locale', context.locale],
    ['statusKey', statusKey],
    ['explanation', redactedLine(explanation)],
  ]);
}

/** The feedback page for the locale, with the report in the fragment, which browsers never send. */
export function feedbackUrl(report: string, locale: ReportLocale): string {
  const path = locale === 'en' ? 'en/feedback/' : 'feedback/';
  return `${FEEDBACK_BASE}${path}#${encodeURIComponent(report)}`;
}
