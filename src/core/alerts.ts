import type { AnomalyNote } from './anomaly';
import type { Change } from './changes';
import { translate } from './i18n';
import { classifyTransition, resolvePathState, type ResolvedPathState } from './paths';
import {
  type StatusEntry,
  type StatusSource,
  displayStatus,
  findStatus,
  findSubStatus,
} from './statuses';
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
  /**
   * What the current (status, sub-status) pair usually leads to, already labelled as observed on real files.
   * Only for a move the observations place on the path (`main-path` or `known-branch`), never for `unusual`
   * or `no-judgement`.
   */
  observedMeaning: string | null;
  whatYouCanDo: string | null;
  sources: ReadonlyArray<StatusSource>;
  /** Verbatim page messages for an error outcome (D12). */
  errorMessages: string[];
  anomaly: string | null;
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    dateStyle: 'long',
  }).format(new Date(iso));
}

/** One check as the path table sees it; `null` for no previous check or a status the catalogue does not know. */
function stateOf(check: Check | null): ResolvedPathState | null {
  return check === null ? null : resolvePathState(check.raw, check.subStatus);
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
    observedMeaning: null,
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

  // The meaning of the state the file is in now, but only when the observations place the move on the path:
  // for an unusual move the note says that instead, and for no-judgement the view judges nothing at all.
  const transition = classifyTransition(stateOf(change.previous), stateOf(current));
  const observed =
    entry === null || current.subStatus === null
      ? null
      : findSubStatus(entry.key, current.subStatus);
  const observedMeaning =
    observed !== null && (transition === 'main-path' || transition === 'known-branch')
      ? translate(locale, 'result.observedMeaning', { text: observed[locale] })
      : null;

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
    observedMeaning,
    whatYouCanDo,
    sources: entry?.sources ?? [],
    errorMessages: [],
    anomaly: anomalyText,
  };
}

function previousSummary(change: Change, locale: Locale): { text: string; at: string } | null {
  const previous = change.kind === 'changed' ? change.previous : null;
  if (previous === null) return null;
  const status = displayStatus(previous.raw, locale);
  return { text: translate(locale, 'alert.before', { status }), at: previous.at };
}

function versionLine(change: Change, locale: Locale): string {
  if (change.kind === 'first') return translate(locale, 'alert.firstCheck');
  const previous: Check | null = change.previous;
  if (previous === null) return translate(locale, 'alert.firstCheck');
  return translate(locale, 'alert.unchangedSince', { date: formatDate(previous.at, locale) });
}
