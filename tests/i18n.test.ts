import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALES,
  type MessageKey,
  SELECTABLE_LOCALES,
  formatDate,
  isLanguageSetting,
  resolveLocaleCode,
  setLocale,
  t,
  translate,
  weekdayNarrow,
} from '../src/core/i18n';
import { en } from '../src/core/locales/en';
import { es } from '../src/core/locales/es';
import { applyDocumentLocale } from '../src/entrypoints/shared/locale';

/**
 * The catalogue's safety net: every locale has the same keys *and* the same placeholders, the override picks the
 * right locale, and nothing on screen can be reached without going through `t()`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const esKeys = Object.keys(es).sort();
const enKeys = Object.keys(en).sort();

/** One key per area of the UI: if any of these stopped differing, a page would be half-translated. */
const ONE_PER_AREA: readonly MessageKey[] = [
  'options.title',
  'options.disclaimer',
  'onboarding.subtitle',
  'onboarding.does1',
  'popup.checkAll',
  'unlock.title',
  'result.changedTitle',
  'statuses.title',
  'encryption.title',
  'backup.title',
  'form.submit',
  'validation.nie',
  'content.captchaHint',
  'alert.firstCheck',
  'notify.reminderMessage',
];

beforeEach(() => {
  setLocale(DEFAULT_LOCALE);
});

describe('locale catalogues', () => {
  it('ship the same keys in es and en', () => {
    expect(enKeys).toEqual(esKeys);
  });

  it('has no blank string in any locale', () => {
    for (const [code, locale] of Object.entries(LOCALES)) {
      for (const key of esKeys as MessageKey[]) {
        expect(locale.messages[key], `${code} ${key}`).toMatch(/\S/);
      }
    }
  });

  it('uses the same placeholders in every locale', () => {
    const placeholders = (value: string): string[] => (value.match(/\{\w+\}/g) ?? []).sort();

    for (const key of esKeys as MessageKey[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]));
    }
  });

  it('really translates every area of the UI', () => {
    for (const key of ONE_PER_AREA) {
      expect(en[key], key).not.toBe(es[key]);
    }
  });
});

describe('resolving the language setting', () => {
  it('follows the browser when the setting is auto', () => {
    expect(resolveLocaleCode('auto', 'es-ES')).toBe('es');
    expect(resolveLocaleCode('auto', 'en-GB')).toBe('en');
    expect(resolveLocaleCode('auto', 'es')).toBe('es');
  });

  it('falls back to Spanish for a language it does not ship', () => {
    expect(resolveLocaleCode('auto', 'fr-FR')).toBe('es');
    expect(resolveLocaleCode('auto', '')).toBe('es');
    expect(DEFAULT_LOCALE).toBe('es');
  });

  it('obeys an explicit override', () => {
    expect(resolveLocaleCode('en', 'es-ES')).toBe('en');
    expect(resolveLocaleCode('es', 'en-US')).toBe('es');
    expect(resolveLocaleCode('qps', 'en-US')).toBe('qps');
  });

  it('accepts only the values it ships', () => {
    expect(isLanguageSetting('auto')).toBe(true);
    expect(isLanguageSetting('en')).toBe(true);
    expect(isLanguageSetting('qps')).toBe(true);
    expect(isLanguageSetting('fr')).toBe(false);
    expect(isLanguageSetting(undefined)).toBe(false);
    expect(isLanguageSetting(3)).toBe(false);
  });

  it('lists only real languages in the selector', () => {
    expect(SELECTABLE_LOCALES).toEqual(['es', 'en']);
  });
});

describe('t', () => {
  it('fills the placeholders it is given', () => {
    expect(translate('es', 'options.saved', { label: 'Mía' })).toBe('Solicitud «Mía» guardada.');
    expect(translate('en', 'options.saved', { label: 'Mine' })).toBe('Application “Mine” saved.');
  });

  it('leaves an unfilled placeholder visible instead of dropping it', () => {
    expect(t('options.saved')).toContain('{label}');
  });

  it('answers in the active locale', () => {
    setLocale('en');
    expect(t('result.acknowledge')).toBe('Got it');

    setLocale('es');
    expect(t('result.acknowledge')).toBe('Entendido');
  });

  it('spells the weekdays the way each locale does', () => {
    setLocale('es');
    expect([1, 2, 3, 4, 5, 6, 7].map(weekdayNarrow)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);

    setLocale('en');
    expect(weekdayNarrow(1)).toBe('M');
  });

  it('formats a stored timestamp in the active locale', () => {
    setLocale('es');
    expect(formatDate('2026-11-06T10:05:00.000Z')).toMatch(/2026/);
    expect(formatDate(null)).toBe('nunca');

    setLocale('en');
    expect(formatDate(null)).toBe('never');
  });
});

describe('the pseudo-RTL locale', () => {
  it('reads right to left and reuses the Spanish content', () => {
    const pseudo = LOCALES.qps;

    expect(pseudo.dir).toBe('rtl');
    expect(pseudo.content).toBe('es');
    expect(Object.keys(pseudo.messages).sort()).toEqual(esKeys);
  });

  it('wraps every string so a hardcoded label stands out', () => {
    setLocale('qps');

    expect(t('options.delete')).toBe(`⟦${es['options.delete']}⟧`);
  });

  it('turns the document round', () => {
    applyDocumentLocale(LOCALES.qps);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('qps');

    applyDocumentLocale(LOCALES.en);
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('the layout survives a right-to-left direction', () => {
  it('uses logical properties everywhere', () => {
    const physical =
      /(?:margin|padding|border)-(?:left|right)\s*:|\b(?:left|right)\s*:|\bfloat\s*:/;
    const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
      .filter((name) => name.endsWith('.css') || name.endsWith('.ts'))
      .map((name) => join(ROOT, 'src', name));

    const offenders = files
      .map((file) => ({
        file,
        lines: readFileSync(file, 'utf8')
          .split('\n')
          .map((line, index) => ({ line, index: index + 1 }))
          .filter(({ line }) => physical.test(line)),
      }))
      .filter(({ lines }) => lines.length > 0);

    expect(offenders).toEqual([]);
  });
});

describe('the manifest locales', () => {
  const manifestLocales = (code: string): Record<string, { message: string }> =>
    JSON.parse(
      readFileSync(join(ROOT, 'public', '_locales', code, 'messages.json'), 'utf8'),
    ) as Record<string, { message: string }>;

  it('define the same keys', () => {
    expect(Object.keys(manifestLocales('en')).sort()).toEqual(
      Object.keys(manifestLocales('es')).sort(),
    );
  });

  it('define every __MSG_ placeholder the manifest asks for', () => {
    const config = readFileSync(join(ROOT, 'wxt.config.ts'), 'utf8');
    const requested = [...config.matchAll(/__MSG_(\w+)__/g)].flatMap((match) => match[1] ?? []);
    expect(requested.length).toBeGreaterThan(0);

    for (const code of ['es', 'en']) {
      const messages = manifestLocales(code);
      for (const name of requested) {
        expect(messages[name], `${code} ${name}`).toBeDefined();
      }
    }
  });
});
