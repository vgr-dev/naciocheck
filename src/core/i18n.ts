import { en } from './locales/en';
import { type MessageKey, es } from './locales/es';

/**
 * Locale resolution and the one function every page prints text through.
 *
 * Three locales ship: Spanish, English, and `qps`, a pseudo-RTL locale that exists only to prove the layout
 * survives a right-to-left direction. It reuses the Spanish text on purpose — what is being tested is the
 * direction and the wrapping, not the translation.
 *
 * `_locales` (see `public/`) keeps the manifest strings, because those are read by the browser before any of
 * our code runs and cannot honour the override in options.
 */

export type { MessageKey };

export type Messages = Record<MessageKey, string>;

export type LocaleCode = 'es' | 'en' | 'qps';

/** What the user chose in options. `auto` follows the browser. */
export type LanguageSetting = 'auto' | LocaleCode;

export interface Locale {
  readonly code: LocaleCode;
  /** The locale's own name, as the language selector shows it. */
  readonly name: string;
  /** Value for `document.documentElement.lang`. */
  readonly tag: string;
  readonly dir: 'ltr' | 'rtl';
  /** BCP 47 tag for `Intl`. */
  readonly intl: string;
  /** Which catalogue text — status explanations, alert lines — this locale reads. */
  readonly content: 'es' | 'en';
  readonly messages: Messages;
}

/** The extension targets Spain, so anything we do not translate falls back to Spanish, not to English. */
export const DEFAULT_LANGUAGE: LanguageSetting = 'auto';

export const DEFAULT_LOCALE: LocaleCode = 'es';

/** Locales a user can pick; the development-only `qps` locale is set by hand from devtools. */
export const SELECTABLE_LOCALES: readonly LocaleCode[] = ['es', 'en'];

const PSEUDO_MARK = '⟦';

/** Wraps every string so a label that never went through the catalogue is obvious on screen. */
function pseudo(messages: Messages): Messages {
  const wrapped = Object.entries(messages).map(([key, value]) => [key, `⟦${value}⟧`]);
  return Object.fromEntries(wrapped) as Messages;
}

export const LOCALES: Record<LocaleCode, Locale> = {
  es: {
    code: 'es',
    name: 'Español',
    tag: 'es',
    dir: 'ltr',
    intl: 'es-ES',
    content: 'es',
    messages: es,
  },
  en: {
    code: 'en',
    name: 'English',
    tag: 'en',
    dir: 'ltr',
    intl: 'en-GB',
    content: 'en',
    messages: en,
  },
  qps: {
    code: 'qps',
    name: 'Pseudo-RTL',
    tag: 'qps',
    dir: 'rtl',
    intl: 'es-ES',
    content: 'es',
    messages: pseudo(es),
  },
};

export const PSEUDO_MARKER = PSEUDO_MARK;

/** True for anything that can be stored as a language setting, so storage can stay defensive. */
export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return value === 'auto' || value === 'es' || value === 'en' || value === 'qps';
}

/** The locale a setting resolves to: the chosen one, or the browser language, or Spanish. */
export function resolveLocaleCode(setting: LanguageSetting, uiLanguage: string): LocaleCode {
  if (setting !== 'auto') return setting;
  const base = uiLanguage.toLowerCase().split('-')[0];
  if (base === 'en') return 'en';
  if (base === 'es') return 'es';
  return DEFAULT_LOCALE;
}

let active: Locale = LOCALES[DEFAULT_LOCALE];

/** Points `t()` at a locale and returns it, so callers can set `lang` and `dir` from the same value. */
export function setLocale(code: LocaleCode): Locale {
  active = LOCALES[code];
  return active;
}

export function currentLocale(): Locale {
  return active;
}

/** Fills the `{name}` placeholders of one template. */
function fill(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder: string, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

/**
 * The string for a key in a locale given explicitly — for the core modules that receive a locale instead of
 * reading the global one, so they stay pure and testable.
 */
export function translate(
  code: LocaleCode,
  key: MessageKey,
  params: Readonly<Record<string, string | number>> = {},
): string {
  return fill(LOCALES[code].messages[key], params);
}

/**
 * The string for a key in the active locale, with its placeholders filled.
 *
 * A placeholder with no value is left visible in the output rather than silently dropped: a wrong label can be
 * fixed, an invisible gap cannot.
 */
export function t(key: MessageKey, params: Readonly<Record<string, string | number>> = {}): string {
  return translate(active.code, key, params);
}

/** A stored timestamp in the active locale, or the word for "never". */
export function formatDate(iso: string | null): string {
  if (iso === null) return t('common.never');
  return new Intl.DateTimeFormat(active.intl, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/**
 * The single-letter name of a weekday, 1 = Monday …. Taken from `Intl` instead of a table so every locale,
 * including ones added later, gets its own letters.
 */
export function weekdayNarrow(day: number): string {
  return weekdayName(day, 'narrow');
}

/**
 * The full name of a weekday, 1 = Monday …. The single letters are ambiguous (two Ts and two Ss in English), so
 * the reminder days also carry this name, for screen readers and as a tooltip.
 */
export function weekdayLong(day: number): string {
  return weekdayName(day, 'long');
}

function weekdayName(day: number, style: 'narrow' | 'long'): string {
  // 2024-01-01 was a Monday, so the anchor keeps the ISO numbering in any locale.
  const anchor = new Date(Date.UTC(2024, 0, 1 + (day - 1)));
  return new Intl.DateTimeFormat(active.intl, { weekday: style, timeZone: 'UTC' }).format(anchor);
}
