import type { AnomalyNote } from './anomaly';
import type { Change } from './changes';
import { translate } from './i18n';
import { type StatusEntry, findStatus } from './statuses';
import type { Check } from './storage';

/**
 * What the user sees after a check: which view, whether a notification and a badge appear, and the texts.
 *
 * Everything here is a pure function of the checks, so the alert rules are unit-tested instead of being
 * observed in a browser. The locale is a parameter, never the global one, so a test can ask for both.
 */

/** The language of the catalogue text; the pseudo-RTL dev locale reads the Spanish one. */
export type Locale = 'es' | 'en';

export interface BadgeState {
  /** Empty text clears the badge. */
  text: string;
  color: string | null;
}

export interface AlertDecision {
  view: 'status' | 'changed' | 'error';
  notification: { title: string; message: string } | null;
  badge: BadgeState;
}

const RED = '#dc2626';

/** Notifications carry the label and the status only — never the NIE or the birth date. */
export function decideAlert(change: Change, label: string, locale: Locale = 'es'): AlertDecision {
  if (change.kind === 'error') {
    return { view: 'error', notification: null, badge: { text: '', color: null } };
  }
  if (change.kind === 'changed') {
    return {
      view: 'changed',
      notification: {
        title: translate(locale, 'alert.notificationTitle', { label }),
        message: translate(locale, 'alert.notificationMessage', { status: change.current.raw }),
      },
      badge: { text: '!', color: RED },
    };
  }
  return { view: 'status', notification: null, badge: { text: '', color: null } };
}

export interface ResultView {
  view: 'status' | 'changed' | 'error';
  label: string;
  /** The status as the page printed it, plus what the catalogue knows about it. */
  status: {
    title: string;
    text: string;
    subStatus: string | null;
    at: string;
    tone: StatusEntry['tone'];
  } | null;
  previous: { text: string; at: string } | null;
  /** "Primera comprobación" or "Sin cambios desde …". */
  versionLine: string;
  explanation: string | null;
  whatYouCanDo: string | null;
  sources: ReadonlyArray<{ label: string; url: string }>;
  /** Verbatim page messages for an error outcome (D12). */
  errorMessages: string[];
  anomaly: string | null;
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    dateStyle: 'long',
  }).format(new Date(iso));
}

export function buildErrorView(input: {
  label: string;
  messages: readonly string[];
  locale?: Locale;
}): ResultView {
  const locale = input.locale ?? 'es';
  return {
    view: 'error',
    label: input.label,
    status: null,
    previous: null,
    versionLine: '',
    explanation: null,
    whatYouCanDo: translate(locale, 'alert.retryHint'),
    sources: [],
    errorMessages: [...input.messages],
    anomaly: null,
  };
}

export function buildResultView(input: {
  label: string;
  change: Change;
  errorMessages?: readonly string[];
  anomaly?: AnomalyNote | null;
  locale?: Locale;
}): ResultView {
  const locale = input.locale ?? 'es';
  const { change, label } = input;
  const current = change.current;
  const anomaly = input.anomaly ?? null;
  const anomalyText = anomaly === null ? null : locale === 'es' ? anomaly.es : anomaly.en;

  if (change.kind === 'error') {
    const view = buildErrorView({ label, messages: input.errorMessages ?? [], locale });
    return { ...view, anomaly: anomalyText };
  }

  const entry = findStatus(current.raw);
  const statusTitle = entry === null ? current.raw : entry[locale].title;
  const explanation = entry === null ? null : entry[locale].explanation;
  const whatYouCanDo = entry === null ? null : entry[locale].whatYouCanDo;

  return {
    view: change.kind === 'changed' ? 'changed' : 'status',
    label,
    status: {
      title: statusTitle,
      text: current.raw,
      subStatus: current.subStatus,
      at: current.at,
      tone: entry?.tone ?? 'neutral',
    },
    previous: previousSummary(change, locale),
    versionLine: versionLine(change, locale),
    explanation,
    whatYouCanDo,
    sources: entry?.sources ?? [],
    errorMessages: [],
    anomaly: anomalyText,
  };
}

function previousSummary(change: Change, locale: Locale): { text: string; at: string } | null {
  const previous = change.kind === 'changed' ? change.previous : null;
  if (previous === null) return null;
  return { text: translate(locale, 'alert.before', { status: previous.raw }), at: previous.at };
}

function versionLine(change: Change, locale: Locale): string {
  if (change.kind === 'first') return translate(locale, 'alert.firstCheck');
  const previous: Check | null = change.previous;
  if (previous === null) return translate(locale, 'alert.firstCheck');
  return translate(locale, 'alert.unchangedSince', { date: formatDate(previous.at, locale) });
}
