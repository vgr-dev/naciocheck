import { redact } from './redact';
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
  /** The page's error messages, reduced to recognised categories before they enter the text. */
  errorMessages: readonly string[];
  /**
   * The anomaly as its kind and the catalogue's state ids, when there is one. Never the note text: that
   * quotes the status the site printed, which is the person's own result.
   */
  anomaly: { kind: string; from: string; to: string } | null;
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

export { redact };

const FEEDBACK_BASE = 'https://naciocheck.vgr.cat/';
// Match the feedback Worker's request cap and reserve its longest ASCII Turnstile token.
const MAX_REQUEST_BYTES = 8192;
const MAX_ASCII_TOKEN = 'x'.repeat(2048);
const UTF8 = new TextEncoder();

/** One line, single spaces: a value never adds a line of its own to the report. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Moves a UTF-16 cut point left when it would leave the high half of a surrogate pair. */
function beforeSurrogatePair(text: string, end: number): number {
  const last = text.charCodeAt(end - 1);
  return end > 0 && last >= 0xd800 && last <= 0xdbff ? end - 1 : end;
}

function fitsRequest(text: string): boolean {
  const body = JSON.stringify({ text, token: MAX_ASCII_TOKEN });
  return UTF8.encode(body).byteLength <= MAX_REQUEST_BYTES;
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
  const body = lines.join('\n');
  const candidate = `${body}${commentLine}`;
  if (candidate.length <= REPORT_MAX_CHARS && fitsRequest(candidate)) return candidate;

  // Find the longest prefix that fits both limits, leaving room for the marker and comment.
  const suffix = `${TRUNCATED_MARKER}${commentLine}`;
  let low = 0;
  let high = Math.min(body.length, REPORT_MAX_CHARS - suffix.length);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const end = beforeSurrogatePair(body, middle);
    if (fitsRequest(`${body.slice(0, end)}${suffix}`)) low = middle;
    else high = middle - 1;
  }
  const end = beforeSurrogatePair(body, low);
  return `${body.slice(0, end)}${suffix}`;
}

function errorCategory(value: string, locale: ReportLocale): string {
  const text = oneLine(value).toLocaleLowerCase();
  // Never copy sede text, even after redaction. Keep only broad categories that are useful
  // for diagnosis and cannot contain user supplied content.
  if (/\bcaptcha\b|código de seguridad|security code/.test(text)) {
    return 'captcha';
  }
  if (
    /\bnie\b|n[uú]mero de (?:expediente|solicitud)|application number|\b(?:año|year)\b/.test(text)
  ) {
    return locale === 'es' ? 'datos de la solicitud' : 'application details';
  }
  return locale === 'es' ? 'error no reconocido' : 'unrecognised error';
}

function redactedLine(value: string): string {
  return redact(oneLine(value));
}

export function buildReport(check: ReportCheck, context: ReportContext): string {
  // Copied by name, never spread: whatever else the object carries contributes nothing.
  const outcome = check.outcome;
  const statusKey = check.statusKey;

  const errors = [
    ...new Set(
      context.errorMessages
        .filter((message) => oneLine(message) !== '')
        .map((message) => errorCategory(message, context.locale)),
    ),
  ].join(' | ');

  return compose(context.locale, [
    ['version', oneLine(context.version)],
    ['browser', oneLine(context.browser)],
    ['locale', context.locale],
    ['outcome', outcome],
    ['statusKey', statusKey],
    ['errors', errors],
    [
      'anomaly',
      context.anomaly === null
        ? null
        : redactedLine(`${context.anomaly.kind}, ${context.anomaly.from} → ${context.anomaly.to}`),
    ],
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

/** Known browsers, checked in order: Edge and Opera also say Chrome, and Chrome also says Safari. */
const BROWSERS: readonly (readonly [string, RegExp])[] = [
  ['Edge', /\bEdgA?\/(\d+)/],
  ['Opera', /\bOPR\/(\d+)/],
  ['Firefox', /\bFirefox\/(\d+)/],
  ['Chrome', /\bChrome\/(\d+)/],
];

/** The browser's name and major version from a user agent, and nothing else: no operating system. */
export function browserLabel(userAgent: string): string {
  for (const [name, pattern] of BROWSERS) {
    const major = pattern.exec(userAgent)?.[1];
    if (major !== undefined) return `${name} ${major}`;
  }
  return 'unknown';
}
