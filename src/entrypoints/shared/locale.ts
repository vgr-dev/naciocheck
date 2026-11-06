import { browser } from 'wxt/browser';
import { type Locale, resolveLocaleCode, setLocale } from '../../core/i18n';
import { getSettings } from '../../core/storage';

/**
 * Which language and direction a page is in.
 *
 * It lives outside `ui.ts` on purpose: that module imports the shared stylesheet, and the result page has a
 * stylesheet of its own that must not meet it.
 */

/**
 * Reads the language override, points `t()` at the resulting locale and tells the document which language and
 * direction it is in, so `dir="rtl"` reaches every page from one place.
 *
 * Pages call this before they render: `t()` would otherwise answer in the default locale.
 */
export async function initPageLocale(): Promise<Locale> {
  const { language } = await getSettings();
  const locale = setLocale(resolveLocaleCode(language, browser.i18n.getUILanguage()));
  applyDocumentLocale(locale);
  return locale;
}

/** Sets `lang` and `dir` on `<html>`. Split out so it can be tested without storage. */
export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale.tag;
  document.documentElement.dir = locale.dir;
}
