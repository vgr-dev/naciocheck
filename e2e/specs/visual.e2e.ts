import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { browser, expect } from '@wdio/globals';
import sharp from 'sharp';
import { extensionPageUrl } from '../support/extension';
import {
  SEDE_FORM_URL,
  capturedPage,
  capturedResultPage,
  serveFakeSede,
} from '../support/fake-sede';
import { failOnLeakedRequest } from '../support/guard-hooks';
import { finishCheck, startCheckFromPopup } from '../support/run';
import {
  FIRST_APPLICATION,
  PASSPHRASE,
  SECOND_APPLICATION,
  addApplicationThroughUi,
  enableEncryptionThroughUi,
  freezeStoredDates,
  lockExtensionSession,
  resetExtensionStorage,
  seedPreviousCheck,
  setFallbackSwitch,
  setStoredLanguage,
} from '../support/seed';
import {
  BASELINE_DIR,
  MISMATCH_TOLERANCE,
  SCREENSHOT_DIR,
  VISUAL_BROWSER,
  compareScreen,
  screenTag,
} from '../support/visual';

failOnLeakedRequest();

/**
 * The screenshot matrix: every extension page in its usual states and the fake form's three overlays, in
 * Spanish and English, at a desktop and a phone width — and at its own width for the popup.
 *
 * Each image is compared with its baseline under `e2e/baselines/` and the run fails above `MISMATCH_TOLERANCE`.
 * `npm run test:e2e:update-baselines` regenerates them, and `index.md` is written after every run. Every
 * identity here is invented, and the only hosts the browser can resolve are the fake site's (D10).
 *
 * The screenshots go through `browser.*`, which acts on the session's current tab, so each state is a
 * navigation of that tab instead of a window of its own. The result page is the one that needs a real run
 * behind it: it reads the payload the background stored for the run, which this spec copies to the tab it is
 * photographing.
 */

const LOCALES = ['es', 'en'] as const;

type Locale = (typeof LOCALES)[number];

type Viewport = '1280x800' | '412x915' | '380x600' | 'full1280' | 'full412';

const VIEWPORTS: Record<Viewport, { width: number; height: number }> = {
  '1280x800': { width: 1280, height: 800 },
  '412x915': { width: 412, height: 915 },
  '380x600': { width: 380, height: 600 },
  // The window of a full-page image: the whole page is scrolled and stitched at this width.
  full1280: { width: 1280, height: 800 },
  full412: { width: 412, height: 915 },
};

/** The two viewports every page is taken at: a desktop window and a phone. */
const EVERYWHERE: readonly Viewport[] = ['1280x800', '412x915'];

/** The long pages are also photographed whole, because their second half never fits a screen. */
const WHOLE_PAGE: readonly Viewport[] = ['full1280', 'full412'];

/** The popup also gets the width Chrome opens it at. */
const WITH_POPUP_WIDTH: readonly Viewport[] = ['1280x800', '380x600', '412x915'];

/** Every image this run compared, in the order it was taken, for `index.md`. */
const comparisons: Array<{ readonly name: string; readonly mismatch: number }> = [];

/** The URL of one of the extension's own pages, which `page` names without its `.html`. */
function extensionPage(page: string): string {
  return extensionPageUrl(browser.capabilities.browserName, `${page}.html`);
}

/**
 * How many pages have been opened, so no two navigations share a URL.
 *
 * Navigating to the address the tab already shows does not reload it — the second viewport of a state would be
 * the first one's page, and an edit form that was open would stay open. A query the pages ignore makes each
 * navigation a real one.
 */
let navigations = 0;

function fresh(url: string): string {
  navigations += 1;
  return `${url}?shot=${String(navigations)}`;
}

/** Sets the viewport and compares what is on screen with the baseline of `tag`. */
async function shoot(
  page: string,
  state: string,
  locale: Locale,
  viewport: Viewport,
): Promise<void> {
  await browser.setViewport(VIEWPORTS[viewport]);
  await compareCurrent(page, state, locale, viewport);
}

/** Compares what is on screen, without touching the viewport: a state reached by clicking must keep its scroll. */
async function compareCurrent(
  page: string,
  state: string,
  locale: Locale,
  viewport: Viewport,
): Promise<void> {
  const tag = screenTag(page, state, locale, viewport);
  const shot = await compareScreen(tag, viewport.startsWith('full'));
  comparisons.push({ name: `${tag}.png`, mismatch: shot.misMatchPercentage });
  expect(shot.misMatchPercentage).toBeLessThanOrEqual(MISMATCH_TOLERANCE);
}

/** Opens one of the extension's own pages at each viewport and compares it. */
async function capturePage(
  page: string,
  state: string,
  locale: Locale,
  viewports: readonly Viewport[],
): Promise<void> {
  for (const viewport of viewports) {
    await browser.url(fresh(extensionPage(page)));
    await expect($('#app')).toBeExisting();
    await shoot(page, state, locale, viewport);
  }
}

/** Opens one of the extension's own pages and compares all of it, at both widths. */
async function captureWholePage(page: string, state: string, locale: Locale): Promise<void> {
  await capturePage(page, state, locale, WHOLE_PAGE);
}

/**
 * Saves one application through the page's own form and waits for the page to say so.
 *
 * The state worth photographing is the moment after the click: the confirmation under the form and the new card
 * marked in the list, wherever the page scrolled to show them.
 */
async function saveThroughForm(): Promise<void> {
  const form = $('form.fields:has(#field-label)');
  await form.$('#field-label').setValue(FIRST_APPLICATION.label);
  await form.$('#field-nie').setValue(FIRST_APPLICATION.nie);
  await form.$('#field-numero').setValue(FIRST_APPLICATION.numero);
  await form.$('#field-year').setValue(FIRST_APPLICATION.year);
  await form.$('#field-birthDate').setValue(FIRST_APPLICATION.birthDate);
  await form.$('button.primary').click();
  await expect($('.just-added .badge')).toBeExisting();
}

/**
 * The card of a fresh save shows the minute it was saved, and a clock in an image is a baseline that never matches
 * twice: the date is replaced, in the page, by a fixed one.
 */
async function maskSavedDates(): Promise<void> {
  await browser.execute(() => {
    for (const meta of document.querySelectorAll('.app-card .meta')) {
      meta.textContent = (meta.textContent ?? '').replace(
        /\d{1,2} \S+ \d{4}, \d{2}:\d{2}/,
        '1 Jan 2026, 10:00',
      );
    }
  });
}

/** Runs `capture` once per locale, with the page in that language. */
async function perLocale(capture: (locale: Locale) => Promise<void>): Promise<void> {
  for (const locale of LOCALES) {
    await setStoredLanguage(locale);
    await capture(locale);
  }
}

/** The extension API this spec needs: the tab it is in, and the result payloads of a run. */
interface ExtensionApi {
  readonly tabs: {
    getCurrent(): Promise<{ id?: number } | undefined>;
    query(query: Record<string, unknown>): Promise<Array<{ id?: number }>>;
  };
  readonly storage: {
    readonly session: {
      get(key: string | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
}

/**
 * Copies the payload of the last run under this tab's own key, so the result page draws it.
 *
 * The background keys a result by the tab it happened in and writes it when the run ends in the window it
 * opened. Copying it here is what lets the result page be screenshotted like any other page, instead of
 * photographing a window the browser opened and the session cannot address.
 */
async function adoptLastRunResult(): Promise<void> {
  await browser.execute(async () => {
    const api = (globalThis as { chrome?: ExtensionApi }).chrome;
    if (api === undefined) throw new Error('This page has no extension API: it is not one of ours');

    const stored = await api.storage.session.get(null);
    const keys = Object.keys(stored).filter((key) => key.startsWith('naciocheck:result:'));
    const current = (await api.tabs.getCurrent()) ?? (await api.tabs.query({ active: true }))[0];
    const mine = `naciocheck:result:${String(current?.id)}`;
    const source = keys.filter((key) => key !== mine).at(-1);
    if (source === undefined) throw new Error('The run left no result payload to show');
    await api.storage.session.set({ [mine]: stored[source] });
  });
}

/** Shows the result page of the last run in this tab, at each viewport. */
async function captureResult(
  state: string,
  locale: Locale,
  viewports: readonly Viewport[],
): Promise<void> {
  await browser.url(fresh(extensionPage('result')));
  await adoptLastRunResult();
  for (const viewport of viewports) {
    // The page asks the background for its payload while loading, so it is opened again with the payload there.
    await browser.url(fresh(extensionPage('result')));
    await expect($('#app')).toBeExisting();
    await shoot('result', state, locale, viewport);
  }
}

describe('screenshots', () => {
  it('onboarding: nothing saved yet', async () => {
    await resetExtensionStorage();
    await perLocale(async (locale) => {
      await capturePage('onboarding', 'empty', locale, EVERYWHERE);
      await captureWholePage('onboarding', 'empty', locale);
    });
  });

  it('onboarding: encryption on', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await enableEncryptionThroughUi(PASSPHRASE);
    await perLocale(async (locale) => {
      await capturePage('onboarding', 'encrypted', locale, EVERYWHERE);
    });
  });

  it('onboarding: an application just saved', async () => {
    await perLocale(async (locale) => {
      for (const viewport of EVERYWHERE) {
        // One save per image: the page is photographed at the moment after the click, so each starts from nothing.
        await resetExtensionStorage();
        await setStoredLanguage(locale);
        await browser.setViewport(VIEWPORTS[viewport]);
        await browser.url(fresh(extensionPage('onboarding')));
        await expect($('#app')).toBeExisting();
        await saveThroughForm();
        await maskSavedDates();
        await compareCurrent('onboarding', 'saved', locale, viewport);
      }
    });
  });

  it('options: an application just saved', async () => {
    await perLocale(async (locale) => {
      for (const viewport of EVERYWHERE) {
        await resetExtensionStorage();
        await setStoredLanguage(locale);
        await browser.setViewport(VIEWPORTS[viewport]);
        await browser.url(fresh(extensionPage('options')));
        await expect($('#app')).toBeExisting();
        await saveThroughForm();
        await maskSavedDates();
        await compareCurrent('options', 'added', locale, viewport);
      }
    });
  });

  it('popup: nothing saved yet', async () => {
    await resetExtensionStorage();
    await perLocale(async (locale) => {
      await capturePage('popup', 'empty', locale, WITH_POPUP_WIDTH);
    });
  });

  it('popup: one application with a check', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);
    await freezeStoredDates();
    await perLocale(async (locale) => {
      await capturePage('popup', 'one', locale, WITH_POPUP_WIDTH);
    });
  });

  it('popup: two applications with checks', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await addApplicationThroughUi(SECOND_APPLICATION);
    await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);
    await seedPreviousCheck(SECOND_APPLICATION.label, 'Abierto - En tramitación.', null);
    await freezeStoredDates();
    await perLocale(async (locale) => {
      await capturePage('popup', 'several', locale, WITH_POPUP_WIDTH);
    });
  });

  it('popup: a change nobody has seen yet', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);
    await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - En tramitación.', null);
    await freezeStoredDates();
    await perLocale(async (locale) => {
      await capturePage('popup', 'changed', locale, WITH_POPUP_WIDTH);
    });
  });

  it('options: nothing saved yet', async () => {
    await resetExtensionStorage();
    await perLocale(async (locale) => {
      await capturePage('options', 'empty', locale, EVERYWHERE);
    });
  });

  it('options: two applications and their history', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await addApplicationThroughUi(SECOND_APPLICATION);
    await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);
    await seedPreviousCheck(SECOND_APPLICATION.label, 'Abierto - En tramitación.', null);
    await freezeStoredDates();
    await perLocale(async (locale) => {
      await capturePage('options', 'several', locale, EVERYWHERE);
      await captureWholePage('options', 'several', locale);
    });
  });

  it('options: encryption on', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await enableEncryptionThroughUi(PASSPHRASE);
    await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);
    await freezeStoredDates();
    await perLocale(async (locale) => {
      await capturePage('options', 'encrypted', locale, EVERYWHERE);
    });
  });

  it('options: editing an application', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await freezeStoredDates();
    await perLocale(async (locale) => {
      for (const viewport of EVERYWHERE) {
        // The edit form replaces the card, so the page is opened again for each viewport.
        await browser.url(fresh(extensionPage('options')));
        // The first action of the card, by position: its label is in the language being photographed.
        const [edit] = await $$('ul.apps .app-card .row button');
        if (edit === undefined) throw new Error('The application card offers no edit action');
        await edit.click();
        // Scoped to the card: the page also has the "add" form, which uses the same field ids.
        await expect($('ul.apps .app-card').$('#field-label')).toBeExisting();
        await shoot('options', 'editing', locale, viewport);
      }
    });
  });

  it('status guide: every section', async () => {
    await resetExtensionStorage();
    await perLocale(async (locale) => {
      await capturePage('statuses', 'guide', locale, EVERYWHERE);
    });
  });

  it('unlock: an encrypted store and no passphrase in the session', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await enableEncryptionThroughUi(PASSPHRASE);
    await lockExtensionSession();
    await perLocale(async (locale) => {
      await capturePage('unlock', 'locked', locale, EVERYWHERE);
    });
  });

  it('result: a status that is the same as before', async () => {
    for (const locale of LOCALES) {
      await resetExtensionStorage();
      await addApplicationThroughUi(FIRST_APPLICATION);
      await freezeStoredDates();
      await setStoredLanguage(locale);
      serveFakeSede({ results: [capturedResultPage()] });
      const checkWindow = await startCheckFromPopup();
      await finishCheck(checkWindow);
      await captureResult('status', locale, EVERYWHERE);
    }
  });

  it('result: a status that changed', async () => {
    for (const locale of LOCALES) {
      await resetExtensionStorage();
      await addApplicationThroughUi(FIRST_APPLICATION);
      await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);
      await freezeStoredDates();
      await setStoredLanguage(locale);
      serveFakeSede({
        results: [
          capturedResultPage({
            status: 'Abierto - En tramitación.',
            subStatus: 'Su expediente se encuentra en tramitación.',
          }),
        ],
      });
      const checkWindow = await startCheckFromPopup();
      await finishCheck(checkWindow);
      await captureResult('changed', locale, [...EVERYWHERE, ...WHOLE_PAGE]);
    }
  });

  it('result: a check that could not be completed', async () => {
    for (const locale of LOCALES) {
      await resetExtensionStorage();
      await addApplicationThroughUi(FIRST_APPLICATION);
      await freezeStoredDates();
      await setStoredLanguage(locale);
      serveFakeSede({ results: [capturedPage('result-error-captcha.htm')] });
      const checkWindow = await startCheckFromPopup();
      await finishCheck(checkWindow);
      await captureResult('error', locale, EVERYWHERE);
    }
  });

  it('fake form: the saved applications offered when it is opened by hand', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    await addApplicationThroughUi(SECOND_APPLICATION);
    serveFakeSede({ form: capturedPage('form.html'), results: [] });
    await perLocale(async (locale) => {
      for (const viewport of EVERYWHERE) {
        await browser.url(fresh(SEDE_FORM_URL));
        await expect($('#naciocheck-picker')).toBeExisting();
        await shoot('form', 'picker', locale, viewport);
      }
    });
  });

  it('fake form: only the captcha left, after choosing a saved application', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    serveFakeSede({ form: capturedPage('form.html'), results: [] });
    await perLocale(async (locale) => {
      for (const viewport of EVERYWHERE) {
        await browser.url(fresh(SEDE_FORM_URL));
        await $('#naciocheck-picker button').click();
        await expect($('#naciocheck-captcha-only')).toBeExisting();
        await shoot('form', 'captcha', locale, viewport);
      }
    });
  });

  it('fake form: the fallback hint, with the page left whole', async () => {
    await resetExtensionStorage();
    await addApplicationThroughUi(FIRST_APPLICATION);
    serveFakeSede({ form: capturedPage('form.html'), results: [] });
    await setFallbackSwitch(true);
    try {
      await perLocale(async (locale) => {
        for (const viewport of EVERYWHERE) {
          await browser.url(fresh(SEDE_FORM_URL));
          await $('#naciocheck-picker button').click();
          await expect($('#naciocheck-hint-style')).toBeExisting();
          await shoot('form', 'hint', locale, viewport);
        }
      });
    } finally {
      await setFallbackSwitch(false);
    }
  });

  /**
   * `index.md`, after every run (the plan's 6.3). Written here rather than by a separate command, so the list
   * and the run that produced it cannot disagree.
   */
  after(async () => {
    const rows: string[] = [];
    let above = 0;
    for (const comparison of comparisons) {
      const metadata = await sharp(join(BASELINE_DIR, comparison.name)).metadata();
      if (comparison.mismatch > MISMATCH_TOLERANCE) above += 1;
      rows.push(
        `| \`${comparison.name}\` | ${String(metadata.width)}×${String(metadata.height)} | ${comparison.mismatch} % |`,
      );
    }

    const index = [
      '# Screenshot index',
      '',
      'Written by `e2e/specs/visual.e2e.ts` after every run. Baselines are tracked by git (D3): an image that',
      'changes is a change to review, so its new version belongs in the history next to the code that made it.',
      '',
      `- **Images**: ${comparisons.length} — 2 locales × 50: onboarding 3 states × 2 viewports (6), popup 4 × 3 (12),`,
      '  options 5 × 2 (10), statuses 1 × 2 (2), result 3 × 2 (6), unlock 1 × 2 (2), the fake form 3 overlays × 2 (6),',
      '  and the long pages whole: onboarding (empty), options (two applications) and the changed-status alert,',
      '  × 2 widths (6).',
      '- **Viewports**: desktop 1280×800, phone 412×915, popup 380×600 (popup only); `full1280` and `full412` are the',
      '  whole page, scrolled and stitched, at those two widths.',
      `- **Tolerance**: ${MISMATCH_TOLERANCE} % of the pixels; above it the spec fails and a diff is written next`,
      '  to the actual image.',
      '- **Fonts** (recorded 2026-11-16): `fc-list | wc -l` → 835; `fc-match system-ui` → DejaVu Sans Book;',
      '  `fc-match sans-serif` → DejaVu Sans Book. A machine with other fonts renders other pixels.',
      `- **Browser**: Chrome for Testing ${String(browser.capabilities.browserVersion)}, headless (\`--headless=new\`), with reduced motion forced, so the animated logo is at rest.`,
      `- **Files**: baselines in \`e2e/baselines/${VISUAL_BROWSER}/\`; what the run saw in`,
      `  \`e2e/.artifacts/screenshots/actual/${VISUAL_BROWSER}/\` and its diffs in`,
      `  \`e2e/.artifacts/screenshots/diff/${VISUAL_BROWSER}/\`.`,
      `- **Above tolerance in this run**: ${above}.`,
      '- **RTL**: the `qps` pseudo-locale is not in this matrix (the options select does not offer it); the',
      '  direction is checked in `pages.e2e.ts` instead.',
      '',
      '| Image | Dimensions | Mismatch |',
      '| --- | --- | --- |',
      ...rows,
      '',
    ].join('\n');

    writeFileSync(join(SCREENSHOT_DIR, 'index.md'), index, 'utf8');
    expect(above).toBe(0);
  });
});
