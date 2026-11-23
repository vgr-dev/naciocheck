import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { browser, expect } from '@wdio/globals';
import {
  extensionPageUrl,
  openExtensionContext,
  openPageUrls,
  waitForNewPage,
  waitForPageUrl,
} from '../support/extension';
import {
  SEDE_FORM_URL,
  awaitFakePage,
  capturedPage,
  serveFakeSede,
  solveStubCaptcha,
  type FakeSede,
} from '../support/fake-sede';
import { failOnLeakedRequest } from '../support/guard-hooks';
import {
  FIRST_APPLICATION,
  type FakeIdentity,
  PASSPHRASE,
  SECOND_APPLICATION,
  addApplicationThroughUi,
  enableEncryptionThroughUi,
  lockExtensionSession,
  readStoredStore,
  readStoredStoreText,
  resetExtensionStorage,
  seedPreviousCheck,
  setFallbackSwitch,
  setStoredLanguage,
} from '../support/seed';

failOnLeakedRequest();

/**
 * The extension's own pages, in Chrome, on the shipped build: onboarding, popup, options, the status guide, the
 * result page and the content script's fallback.
 *
 * The check flow itself (popup → captcha-only window → result) has its own spec; this one covers what the pages
 * do around it. Every identity here is invented, and the only hosts the browser can resolve are the three the
 * local fake site answers on (D10).
 */

/** The captured result page, with every personal value a placeholder: only fake values go in. */
const RESULT_VALUES = {
  expendiente: 'R500001',
  year: '2015',
  NIE: 'X0000000X',
  names: 'NOMBRE',
  surname: 'APELLIDO',
  status: 'Abierto - Registrado.',
  subStatus: 'Su expediente ha sido registrado correctamente.',
};

function resultPage(values: Record<string, string> = {}): ReturnType<typeof capturedPage> {
  return capturedPage('result-format.htm', { ...RESULT_VALUES, ...values });
}

/**
 * WCAG contrast of an `rgb(r, g, b)` colour on white (relative luminance, WCAG 2.x). The page reports the colour it
 * computed; the ratio is worked out here so the number in a failure message is the one a reviewer can check.
 */
function contrastOnWhite(rgb: string): number {
  const channels = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  if (channels.length < 3) throw new Error(`Not an rgb() colour: ${rgb}`);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
    const unit = channel / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return 1.05 / (luminance + 0.05);
}

function extensionPage(page: string): string {
  return extensionPageUrl(browser.capabilities.browserName, page);
}

/** Waits until some tab or window points at `url`, then returns it: the extension opens its own pages. */
async function waitForOpenPage(
  url: string,
  timeoutMsg: string,
): Promise<WebdriverIO.BrowsingContext> {
  return browser.waitUntil(
    async () => {
      let found: WebdriverIO.BrowsingContext | undefined;
      for (const context of await browser.browsingContexts()) {
        const current = await context.getUrl().catch(() => null);
        if (found === undefined && current === url) found = context;
      }
      return found ?? false;
    },
    { timeoutMsg },
  );
}

/** Waits until the first match of `selector` reads exactly `text`: a redraw replaces the node, so handles age. */
async function waitForText(
  scope: WebdriverIO.BrowsingContext,
  selector: string,
  text: string,
  timeoutMsg: string,
): Promise<void> {
  await browser.waitUntil(
    async () => {
      const element = scope.$(selector);
      if (!(await element.isExisting())) return false;
      return (await element.getText()).trim() === text;
    },
    { timeoutMsg },
  );
}

/** The error messages the page is showing right now; the hidden ones carry the text of every other field. */
async function visibleErrors(scope: WebdriverIO.BrowsingContext): Promise<string[]> {
  const shown: string[] = [];
  for (const error of await scope.$$('span.error')) {
    if (await error.isDisplayed()) shown.push((await error.getText()).trim());
  }
  return shown;
}

/** Fills the identity fields of one form; the caller submits it. */
async function fillFields(
  scope: WebdriverIO.BrowsingContext,
  identity: FakeIdentity,
): Promise<void> {
  await scope.$('#field-label').setValue(identity.label);
  await scope.$('#field-nie').setValue(identity.nie);
  await scope.$('#field-numero').setValue(identity.numero);
  await scope.$('#field-year').setValue(identity.year);
  await scope.$('#field-birthDate').setValue(identity.birthDate);
}

/**
 * Presses "check now" in the popup and returns the check window showing the fake form.
 *
 * The popup closes its own window as soon as the run starts, so it gets one of its own; the window the extension
 * opens for the check is the one a person gets, at the real URL, answered by the local fake site.
 */
async function startRunFromPopup(): Promise<WebdriverIO.BrowsingContext> {
  const before = await openPageUrls();
  await browser.newWindow(extensionPage('popup.html'));
  const popup = await waitForNewPage(extensionPage('popup.html'), before, 'The popup did not open');
  await popup.$('li.app-card button').click();
  const checkWindow = await waitForNewPage(SEDE_FORM_URL, before, 'The check window did not open');
  if (!(await awaitFakePage(checkWindow))) {
    throw new Error('The check window never showed the fake form');
  }
  return checkWindow;
}

/** Waits for the run to finish: the check window itself turns into the result page. */
async function waitForResult(
  checkWindow: WebdriverIO.BrowsingContext,
): Promise<WebdriverIO.BrowsingContext> {
  await waitForPageUrl(checkWindow, extensionPage('result.html'), 'The result page did not open');
  return checkWindow;
}

/** One check to a stored success, so a test can talk about what the popup and the result page then show. */
async function runOneCheck(sede: FakeSede): Promise<WebdriverIO.BrowsingContext> {
  expect(sede.posts).toHaveLength(0);
  const checkWindow = await startRunFromPopup();
  await expect(checkWindow.$('#naciocheck-captcha-only')).toBeExisting();
  await solveStubCaptcha(checkWindow);
  return waitForResult(checkWindow);
}

/** The feedback page the panel's Continue button opens; the report travels after the `#`. */
const FEEDBACK_ES = 'https://naciocheck.vgr.cat/feedback/#';
const FEEDBACK_EN = 'https://naciocheck.vgr.cat/en/feedback/#';

/**
 * Replaces `chrome.tabs.create` in the page with a recorder, so pressing Continue opens nothing: no tab loads the
 * feedback page and no request can reach the network guard. Call it before the click; `recordedTabs` reads it.
 */
async function recordTabCreation(page: WebdriverIO.BrowsingContext): Promise<void> {
  await page.execute(() => {
    const holder = globalThis as unknown as {
      chrome: { tabs: { create: (properties: { url?: string }) => Promise<unknown> } };
      recordedTabs?: string[];
    };
    const urls: string[] = [];
    holder.recordedTabs = urls;
    holder.chrome.tabs.create = (properties) => {
      urls.push(properties.url ?? '');
      return Promise.resolve({});
    };
  });
}

async function recordedTabs(page: WebdriverIO.BrowsingContext): Promise<string[]> {
  return page.execute(
    () => (globalThis as unknown as { recordedTabs?: string[] }).recordedTabs ?? [],
  );
}

/** Opens a closed report panel the way a keyboard user does: focus its summary and press Enter. */
async function openPanelWithKeyboard(panel: WebdriverIO.Element): Promise<void> {
  expect(await panel.getProperty('open')).toBe(false);
  const summary = await panel.$('summary');
  await browser.execute((node) => {
    node.focus();
  }, summary);
  await summary.addValue('');
  await browser.waitUntil(async () => (await panel.getProperty('open')) === true, {
    timeoutMsg: 'The panel did not open from the keyboard',
  });
}

/** Values the seeded fake application holds: none of them may ever appear in a report. */
function identityValues(identity: FakeIdentity): string[] {
  return [
    identity.label,
    identity.nie,
    identity.numero,
    identity.year,
    identity.birthDate,
    identity.birthDate.split('-').reverse().join('/'),
  ];
}

describe('extension pages', () => {
  /**
   * First of all, and before anything writes to storage: an install opens the first run page by itself
   * (`runtime.onInstalled`, reason `install`). The session's profile is new, so the extension is installed once
   * per run.
   */
  it('opens the first run page when the extension is installed', async () => {
    const onboarding = await waitForOpenPage(
      extensionPage('onboarding.html'),
      'No first run page opened on install',
    );

    await expect(onboarding.$('#app h1')).toBeExisting();
    await expect(onboarding.$('#app form.fields')).toBeExisting();
    await expect(onboarding.$('#app #field-nie')).toBeExisting();

    // What it does, what it does not do, the application, the optional encryption and the reminder.
    const sections = await onboarding.$$('#app h2.section');
    expect(sections.length).toBeGreaterThanOrEqual(5);

    // The page sets the document language from the stored choice, whatever the browser's own language is.
    const lang = await onboarding.execute(() => document.documentElement.lang);
    expect(['es', 'en']).toContain(lang);
  });

  /**
   * The logo on the onboarding and result pages is an animated SVG that draws itself in, and a screenshot taken at
   * any frame of it is a different image each run (a notch in the ring, a half-drawn check). The browser runs with
   * reduced motion, which the SVG honours by showing the finished icon at once.
   */
  it('runs with reduced motion, so the animated logo is photographed at rest', async () => {
    const page = await openExtensionContext('statuses.html');
    await expect(page.$('#app h1.title')).toBeExisting();
    const reduced = await page.execute(
      () => globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    expect(reduced).toBe(true);
  });

  describe('onboarding', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
    });

    /**
     * The same silence on the first page a person sees: nothing showed that the application was kept. A list of what
     * is saved sits under the form with the newest marked, and the confirmations sit next to the control that caused
     * them, not at the end of the page (Phase 14).
     */
    it('lists what was saved under the form and confirms next to the buttons', async () => {
      const page = await openExtensionContext('onboarding.html');
      const form = page.$('#app form.fields');
      await expect(form).toBeExisting();
      await expect(page.$('.saved-applications li')).not.toBeExisting();

      await fillFields(page, FIRST_APPLICATION);
      await form.$('button.primary').click();
      await expect(page.$('.saved-applications li .label')).toHaveText(
        expect.stringContaining(FIRST_APPLICATION.label),
      );
      await expect(page.$('.saved-applications .badge')).toHaveText('Recién añadida');

      await fillFields(page, SECOND_APPLICATION);
      await form.$('button.primary').click();
      await expect(page.$$('.saved-applications li')).toBeElementsArrayOfSize(2);
      await expect(page.$$('.saved-applications .badge')).toBeElementsArrayOfSize(1);

      const placement = await page.execute(() => {
        const note = document.querySelector('p.saved');
        const list = document.querySelector('.saved-applications');
        if (note === null || list === null) throw new Error('No confirmation or no list');
        const box = list.getBoundingClientRect();
        return {
          noteAfterForm: note.previousElementSibling?.tagName === 'FORM',
          role: note.getAttribute('role'),
          listAfterNote: note.nextElementSibling === list,
          inView: box.top >= 0 && box.top <= window.innerHeight,
        };
      });
      expect(placement.noteAfterForm).toBe(true);
      expect(placement.listAfterNote).toBe(true);
      expect(placement.role).toBe('status');
      expect(placement.inView).toBe(true);

      // The reminder's confirmation sits under the presets, not at the bottom of the page.
      await page.$('button=Laborables a las 10:00').click();
      await expect(page.$('p.saved')).toHaveText(/Recordatorio guardado/);
      const afterPresets = await page.execute(() => {
        const note = document.querySelector('p.saved');
        return note?.previousElementSibling?.classList.contains('row') ?? false;
      });
      expect(afterPresets).toBe(true);
    });

    /**
     * Five solid buttons on one page told a person nothing about which one finishes the flow. The two reminder
     * presets are choices, drawn like the secondary buttons of options; Save and Finish stay solid.
     */
    it('draws the reminder presets as secondary buttons and keeps Save and Finish solid', async () => {
      const page = await openExtensionContext('onboarding.html');
      await expect(page.$('#app form.fields')).toBeExisting();
      const fills = await page.execute(() => {
        const fill = (label: string) => {
          const control = [...document.querySelectorAll('button')].find((candidate) =>
            (candidate.textContent ?? '').includes(label),
          );
          return control === undefined ? null : getComputedStyle(control).backgroundColor;
        };
        return {
          preset: fill('Laborables a las 10:00'),
          save: fill('Guardar solicitud'),
          finish: fill('Terminar'),
        };
      });
      const SOLID = 'rgb(15, 118, 110)';
      expect(fills.save).toBe(SOLID);
      expect(fills.finish).toBe(SOLID);
      expect(fills.preset).not.toBeNull();
      expect(fills.preset).not.toBe(SOLID);
    });

    it('adds two applications, sets a reminder and leaves no identity readable', async () => {
      const page = await openExtensionContext('onboarding.html');
      const form = page.$('#app form.fields');
      await expect(form).toBeExisting();

      await fillFields(page, FIRST_APPLICATION);
      await page.$('#app form.fields button.primary').click();
      await waitForText(
        page,
        '#app p.saved',
        `Solicitud «${FIRST_APPLICATION.label}» guardada.`,
        'The first application was not saved',
      );

      await fillFields(page, SECOND_APPLICATION);
      await page.$('#app form.fields button.primary').click();
      await waitForText(
        page,
        '#app p.saved',
        `Solicitud «${SECOND_APPLICATION.label}» guardada.`,
        'The second application was not saved',
      );

      // The reminder: the first preset, which the page announces in the same place.
      await page.$('button=Laborables a las 10:00').click();
      await waitForText(
        page,
        '#app p.saved',
        'Recordatorio guardado para los laborables a las 10:00.',
        'The reminder was not saved',
      );

      // The optional step, with the passphrase asked twice and the section redrawn once it is on. The page was
      // drawn before these two applications existed, so this also proves the section acts on the store as it is.
      await page.$('#app #passphrase').setValue(PASSPHRASE);
      await page.$('#app #passphrase-repeat').setValue(PASSPHRASE);
      await page.$('button=Cifrar los datos').click();
      await expect(page.$('button=Quitar el cifrado')).toBeExisting();
      await expect(page.$('.encryption + p[role="status"]')).toHaveText(
        'Datos cifrados. Guarda la contraseña en un sitio seguro.',
      );

      const store = await readStoredStore();
      expect(store.applications.map((application) => application.label)).toEqual([
        FIRST_APPLICATION.label,
        SECOND_APPLICATION.label,
      ]);
      expect(store.applications.map((application) => application.identity.kind)).toEqual([
        'encrypted',
        'encrypted',
      ]);
      expect(store.settings.reminders).toEqual({
        enabled: true,
        weekdays: [1, 2, 3, 4, 5],
        time: '10:00',
      });

      // Read from one of the extension's own pages, as text: no NIE, no birth date, and no passphrase.
      const stored = await readStoredStoreText();
      for (const identity of [FIRST_APPLICATION, SECOND_APPLICATION]) {
        expect(stored).not.toContain(identity.nie);
        expect(stored).not.toContain(identity.numero);
        expect(stored).not.toContain(identity.birthDate);
      }
      expect(stored).not.toContain(PASSPHRASE);
    });
  });

  describe('popup', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
    });

    it('lists every application with its latest status and a check button', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      await addApplicationThroughUi(SECOND_APPLICATION);
      await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);

      const popup = await openExtensionContext('popup.html');
      await expect(popup.$('ul.apps')).toBeExisting();

      const labels: string[] = [];
      const statuses: string[] = [];
      const cards = await popup.$$('ul.apps .app-card');
      for (const card of cards) {
        labels.push((await card.$('.label').getText()).trim());
        statuses.push((await card.$('.status').getText()).trim());
        await expect(card.$('button=Comprobar ahora')).toBeExisting();
      }
      expect(labels).toEqual([FIRST_APPLICATION.label, SECOND_APPLICATION.label]);
      expect(statuses).toEqual(['Abierto - Registrado.', 'Sin comprobaciones todavía']);

      await expect(popup.$('ul.apps .app-card .meta')).toHaveText(/Comprobado el/);
      await expect(popup.$('button=Comprobar todo')).toBeExisting();
    });

    /**
     * The toolbar sizes a popup to its content, and a page with no width of its own shrinks to its narrowest
     * unbreakable content: about 140 px, a scrollbar and a status wrapped over three lines. The spec cannot open
     * the toolbar popup, so it measures what the toolbar measures: the width the body takes when it is shrunk to
     * its minimum content.
     */
    it('has a width of its own, so the toolbar does not shrink it to its content', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const popup = await openExtensionContext('popup.html');
      await expect(popup.$('ul.apps')).toBeExisting();

      const width = await popup.execute(() => {
        document.body.style.width = 'min-content';
        return document.body.getBoundingClientRect().width;
      });
      expect(width).toBeGreaterThanOrEqual(320);
      expect(width).toBeLessThanOrEqual(480);
    });

    /** "Check all" and the card's own "Check now" did the same with one application: it appears from two up (13.17). */
    it('offers "Check all" only when there is more than one application', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const one = await openExtensionContext('popup.html');
      await expect(one.$('ul.apps')).toBeExisting();
      await expect(one.$('div.row > button.primary')).not.toBeExisting();
      await expect(one.$('.links')).toBeExisting();

      await addApplicationThroughUi(SECOND_APPLICATION);
      const two = await openExtensionContext('popup.html');
      await expect(two.$('ul.apps')).toBeExisting();
      await expect(two.$('div.row > button.primary')).toBeExisting();
    });

    /** Left-aligned in a wide window the 380 px popup looked pushed into a corner; it is centred like the other pages. */
    it('centres the popup column in a window wider than the popup', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const popup = await openExtensionContext('popup.html');
      await expect(popup.$('ul.apps')).toBeExisting();
      const box = await popup.execute(() => {
        const app = document.getElementById('app');
        if (app === null) throw new Error('Missing #app');
        const own = app.getBoundingClientRect();
        return {
          left: own.left,
          right: window.innerWidth - own.right,
          wide: window.innerWidth > 420,
        };
      });
      expect(box.wide).toBe(true);
      expect(box.left).toBeGreaterThan(0);
      expect(Math.abs(box.left - box.right)).toBeLessThanOrEqual(1);
    });

    /**
     * "Options" and "What each status means" used to share the button's line, about 8 px apart: in English they
     * read as one phrase, and in Spanish the second one wrapped. They sit on a row of their own, apart from each
     * other, and are as tall as a tap target.
     */
    it('keeps the links on a row of their own, apart and tap-sized', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      await addApplicationThroughUi(SECOND_APPLICATION);
      const popup = await openExtensionContext('popup.html');
      await expect(popup.$('ul.apps')).toBeExisting();

      const layout = await popup.execute(() => {
        const checkAll = document.querySelector('div.row > button.primary');
        if (checkAll === null) throw new Error('No check-all button');
        const links = [...document.querySelectorAll('a.link')].map((anchor) =>
          anchor.getBoundingClientRect(),
        );
        return {
          buttonBottom: checkAll.getBoundingClientRect().bottom,
          linkTops: links.map((box) => box.top),
          linkHeights: links.map((box) => box.height),
          gap: links.length > 1 ? (links[1]?.left ?? 0) - (links[0]?.right ?? 0) : -1,
        };
      });
      const underlines = await popup.execute(() =>
        [...document.querySelectorAll('a.link')].map(
          (anchor) => getComputedStyle(anchor).textDecorationLine,
        ),
      );
      expect(underlines).toHaveLength(2);
      for (const line of underlines) expect(line).toContain('underline');
      expect(layout.linkTops).toHaveLength(2);
      for (const top of layout.linkTops) expect(top).toBeGreaterThanOrEqual(layout.buttonBottom);
      for (const height of layout.linkHeights) expect(height).toBeGreaterThanOrEqual(44);
      expect(layout.gap).toBeGreaterThanOrEqual(12);
    });
  });

  describe('options', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
    });

    /**
     * Saving used to write a one-line note at the very end of the page and leave the list as it was: nothing on the
     * screen said the application had been added. Now the list gains the card at once, marked and in view, and the
     * confirmation sits right under the form it came from (Phase 14).
     */
    it('puts a saved application in the list at once, marked and in view', async () => {
      const page = await openExtensionContext('options.html');
      const form = page.$('form.fields:has(#field-label)');
      await expect(form).toBeExisting();
      await fillFields(page, FIRST_APPLICATION);
      await form.$('button.primary').click();

      // No reload: the card is there because the page drew it.
      await expect(page.$('ul.apps .app-card .label')).toHaveText(
        expect.stringContaining(FIRST_APPLICATION.label),
      );
      await expect(page.$('ul.apps .app-card .badge')).toHaveText('Recién añadida');

      const placement = await page.execute(() => {
        const card = document.querySelector('ul.apps .app-card');
        const note = document.querySelector('p.saved');
        if (card === null || note === null) throw new Error('No card or no confirmation');
        const box = card.getBoundingClientRect();
        return {
          marked: card.classList.contains('just-added'),
          inView: box.top >= 0 && box.bottom <= window.innerHeight,
          noteAfterForm: note.previousElementSibling?.tagName === 'FORM',
          role: note.getAttribute('role'),
        };
      });
      expect(placement.marked).toBe(true);
      expect(placement.inView).toBe(true);
      expect(placement.noteAfterForm).toBe(true);
      expect(placement.role).toBe('status');

      // A second one joins the first; only the newest is marked.
      await fillFields(page, SECOND_APPLICATION);
      await form.$('button.primary').click();
      await expect(page.$$('ul.apps .app-card')).toBeElementsArrayOfSize(2);
      await expect(page.$$('ul.apps .app-card .badge')).toBeElementsArrayOfSize(1);
      const labels = await page.execute(() =>
        // The label's own text: the newest card also carries its badge inside the label.
        [...document.querySelectorAll('ul.apps .app-card .label')].map(
          (label) => label.firstChild?.textContent,
        ),
      );
      expect(labels).toEqual([FIRST_APPLICATION.label, SECOND_APPLICATION.label]);
    });

    /**
     * The form's own validation: what is wrong with which field, all at once, and nothing written.
     *
     * A birth date after today is a real date and still not one anybody was born on, so it takes a second
     * submission: the field itself cannot tell the two apart.
     */
    /**
     * Measured on the real page: Edit and Delete were 35 px tall and the reminder day boxes 13 px, too small for a
     * thumb. Buttons and the day labels are at least 44 px, and the boxes themselves 20 px.
     */
    it('gives buttons and checkboxes a tap-sized hit area', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const page = await openExtensionContext('options.html');
      await expect(page.$('.app-card')).toBeExisting();

      const sizes = await page.execute(() => ({
        buttons: [...document.querySelectorAll('button')]
          .map((control) => control.getBoundingClientRect())
          .filter((box) => box.height > 0)
          .map((box) => box.height),
        labels: [...document.querySelectorAll('.checks label')].map((label) => {
          const box = label.getBoundingClientRect();
          return [box.width, box.height];
        }),
        boxes: [...document.querySelectorAll('.checks input')].map(
          (input) => input.getBoundingClientRect().width,
        ),
      }));

      expect(sizes.buttons.length).toBeGreaterThan(0);
      for (const height of sizes.buttons) expect(height).toBeGreaterThanOrEqual(44);
      expect(sizes.labels).toHaveLength(7);
      for (const [width = 0, height = 0] of sizes.labels) {
        expect(width).toBeGreaterThanOrEqual(44);
        expect(height).toBeGreaterThanOrEqual(44);
      }
      for (const width of sizes.boxes) expect(width).toBeGreaterThanOrEqual(20);
    });

    /** WCAG 1.4.11: the edge of a field that says where to type is a graphical object and needs 3:1 on white. */
    it('draws the edge of every field at 3:1 or better against the page', async () => {
      const page = await openExtensionContext('options.html');
      await expect(page.$('h1.title')).toBeExisting();

      const borders = await page.execute(() =>
        [...document.querySelectorAll('.field input, .field select')]
          .filter((control) => control.getBoundingClientRect().height > 0)
          .map((control) => getComputedStyle(control).borderTopColor),
      );
      expect(borders.length).toBeGreaterThan(3);
      for (const colour of borders) expect(contrastOnWhite(colour)).toBeGreaterThanOrEqual(3);
    });

    /**
     * The non-affiliation line is the one a person must not miss. It was 13 px grey text, a size under the page's own
     * 14 px; it is now at least body size and set off from what is above it by a rule.
     */
    it('sets the disclaimer off at body size', async () => {
      const page = await openExtensionContext('options.html');
      await expect(page.$('p.disclaimer')).toBeExisting();
      const style = await page.execute(() => {
        const note = document.querySelector('p.disclaimer');
        if (note === null) throw new Error('No disclaimer');
        const own = getComputedStyle(note);
        return { size: parseFloat(own.fontSize), rule: parseFloat(own.borderTopWidth) };
      });
      expect(style.size).toBeGreaterThanOrEqual(14);
      expect(style.rule).toBeGreaterThanOrEqual(1);
    });

    /**
     * Seven single letters, two of them T and two S, tell a screen reader nothing: each box carries the full name of
     * its day, and the label shows it as a tooltip.
     */
    it('lines the reminder checkboxes up with the fields, and leaves no gap for an empty message', async () => {
      const page = await openExtensionContext('options.html');
      await expect(page.$('.checks')).toBeExisting();
      const layout = await page.execute(() => {
        const edge =
          document.querySelector('input[type="time"]')?.getBoundingClientRect().left ?? -1;
        const first = (selector: string) =>
          document.querySelector(selector)?.getBoundingClientRect().left ?? -1;
        return {
          edge,
          notify: first('form.fields > .check input'),
          days: first('.checks input'),
          hidden: [...document.querySelectorAll('p.hint')]
            .filter((note) => (note.textContent ?? '') === '')
            .map((note) => getComputedStyle(note).display),
        };
      });
      expect(layout.edge).toBeGreaterThan(0);
      expect(Math.abs(layout.notify - layout.edge)).toBeLessThanOrEqual(1);
      expect(Math.abs(layout.days - layout.edge)).toBeLessThanOrEqual(1);
      // The message lines under the forms are empty until something happens; empty, they take no room.
      expect(layout.hidden.length).toBeGreaterThan(0);
      for (const display of layout.hidden) expect(display).toBe('none');
    });

    it('names every reminder day in full for assistive technology', async () => {
      const page = await openExtensionContext('options.html');
      await expect(page.$('.checks')).toBeExisting();
      const names = await page.execute(() =>
        [...document.querySelectorAll('.checks label')].map((label) => ({
          title: label.getAttribute('title'),
          aria: label.querySelector('input')?.getAttribute('aria-label') ?? null,
        })),
      );
      expect(names).toHaveLength(7);
      const spoken = names.map((entry) => entry.aria ?? '');
      expect(new Set(spoken).size).toBe(7);
      for (const entry of names) {
        expect(entry.aria ?? '').not.toBe('');
        expect(entry.title).toBe(entry.aria);
      }
      expect(spoken[0]).toBe('lunes');
    });

    /** The link under "Historial" was bare text with no margin, a few pixels under the heading. */
    it('puts the link to the status guide in a paragraph of its own under the history heading', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const page = await openExtensionContext('options.html');
      await expect(page.$('.app-card')).toBeExisting();
      const parent = await page.execute(() => {
        const anchor = [...document.querySelectorAll('a.link')].find((candidate) =>
          (candidate.textContent ?? '').includes('Qué significa'),
        );
        return anchor === undefined ? null : (anchor.parentElement?.className ?? null);
      });
      expect(parent).toBe('hint');
    });

    /** A submit button in a form stretched to the form's width while the section buttons did not: one rule, natural width. */
    it('keeps every button at its natural width, in forms too', async () => {
      const page = await openExtensionContext('options.html');
      await expect(page.$('h1.title')).toBeExisting();
      const widths = await page.execute(() =>
        [...document.querySelectorAll('form.fields > button')].map((control) => ({
          label: control.textContent,
          button: control.getBoundingClientRect().width,
          form: (control.parentElement ?? control).getBoundingClientRect().width,
        })),
      );
      expect(widths.length).toBeGreaterThan(0);
      for (const entry of widths) expect(entry.button).toBeLessThan(entry.form - 100);
    });

    /** Unlock stretched edge to edge while options and onboarding sit in a column: one product, one page frame. */
    it('draws the unlock page in the same column as the other pages', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      await enableEncryptionThroughUi(PASSPHRASE);
      await lockExtensionSession();

      const unlock = await openExtensionContext('unlock.html');
      await expect(unlock.$('#passphrase')).toBeExisting();
      await expect(unlock.$('.brand .brand-name')).toHaveText('NacioCheck');
      const column = await unlock.execute(() => {
        const app = document.getElementById('app');
        if (app === null) throw new Error('Missing #app');
        const own = getComputedStyle(app);
        return { maxWidth: own.maxWidth, centred: own.marginLeft === own.marginRight };
      });
      expect(column.maxWidth).not.toBe('none');
      expect(column.centred).toBe(true);
    });

    /**
     * Every place that names a status prints the site's own text, whatever the language of the interface: the status
     * is what the official page showed, and a translation of it could be taken for something the site said.
     */
    it("shows the site's own status text on every page when the language is English", async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);
      await setStoredLanguage('en');

      const options = await openExtensionContext('options.html');
      await expect(options.$('ul.history li')).toHaveText(/Abierto - Registrado\./);
      expect(await options.$('ul.history li').getText()).not.toContain('Open - Registered');

      const popup = await openExtensionContext('popup.html');
      await expect(popup.$('.app-card .status')).toHaveText('Abierto - Registrado.');
    });

    it('names every bad field and writes nothing', async () => {
      const page = await openExtensionContext('options.html');
      const form = page.$('form.fields:has(#field-label)');

      await form.$('#field-label').setValue('');
      await form.$('#field-nie').setValue('X123');
      await form.$('#field-numero').setValue(FIRST_APPLICATION.numero);
      await form.$('#field-year').setValue(FIRST_APPLICATION.year);
      // The birth date is left empty: a date input refuses anything that is not a real date, so this is the
      // state a person reaches by typing one the field cannot take.
      await form.$('button.primary').click();

      await browser.waitUntil(async () => (await visibleErrors(page)).length === 3, {
        timeoutMsg: 'The form did not report every bad field',
      });
      expect(await visibleErrors(page)).toEqual([
        'Ponle un nombre para reconocerla.',
        'Escribe el NIE con letra final, por ejemplo X1234567L.',
        'La fecha de nacimiento va como AAAA-MM-DD.',
      ]);
      expect(await form.$('#field-nie').getAttribute('aria-invalid')).toBe('true');
      expect((await readStoredStore()).applications).toEqual([]);

      // Everything valid except the date, which is in the future.
      const nextYear = `${String(new Date().getFullYear() + 1)}-01-01`;
      await form.$('#field-label').setValue(FIRST_APPLICATION.label);
      await form.$('#field-nie').setValue(FIRST_APPLICATION.nie);
      await form.$('#field-birthDate').setValue(nextYear);
      await form.$('button.primary').click();

      await browser.waitUntil(
        async () =>
          (await visibleErrors(page)).includes('La fecha de nacimiento no puede ser futura.'),
        { timeoutMsg: 'A birth date in the future was accepted' },
      );
      expect((await readStoredStore()).applications).toEqual([]);
    });

    /*
     * The order a first run takes, in options: the page is drawn, the application is added on it, and only then
     * is encryption turned on. Nothing is reloaded, so the section has to act on the store as it is now.
     */
    it('encrypts an application added to a page that was already open', async () => {
      const page = await openExtensionContext('options.html');

      await fillFields(page, FIRST_APPLICATION);
      await page.$('form.fields:has(#field-label) button.primary').click();
      await waitForText(
        page,
        '#app p.saved',
        `Solicitud «${FIRST_APPLICATION.label}» guardada.`,
        'The application was not saved',
      );

      await page.$('#passphrase').setValue(PASSPHRASE);
      await page.$('#passphrase-repeat').setValue(PASSPHRASE);
      await page.$('button=Cifrar los datos').click();
      await expect(page.$('button=Quitar el cifrado')).toBeExisting();
      await expect(page.$('.encryption + p[role="status"]')).toHaveText(
        'Datos cifrados. Guarda la contraseña en un sitio seguro.',
      );

      const store = await readStoredStore();
      expect(store.applications.map((application) => application.identity.kind)).toEqual([
        'encrypted',
      ]);

      await page.$('#passphrase').setValue(PASSPHRASE);
      await page.execute('window.confirm = () => false;');
      await page.$('button=Quitar el cifrado').click();
      expect((await readStoredStore()).applications[0]?.identity.kind).toBe('encrypted');
      // The storage helper navigates this shared context, so the password field is new again.
      await page.$('#passphrase').setValue(PASSPHRASE);
      await page.execute('window.confirm = () => true;');
      await page.$('button=Quitar el cifrado').click();
      await expect(page.$('.encryption + p[role="status"]')).toHaveText('Cifrado desactivado.');
      expect((await readStoredStore()).applications[0]?.identity.kind).toBe('plain');
    });

    it('edits a plain application, cancels an edit and deletes one', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const page = await openExtensionContext('options.html');

      const card = page.$('ul.apps .app-card');
      await card.$('button=Editar').click();
      // A plain identity is prefilled: there is nothing to unlock.
      await expect(card.$('#field-label')).toBeExisting();
      await expect(card.$('#field-nie')).toHaveValue(FIRST_APPLICATION.nie);

      await card.$('#field-label').setValue('Solicitud renombrada');
      await card.$('button=Guardar cambios').click();
      await waitForText(
        page,
        'ul.apps .app-card .label',
        'Solicitud renombrada',
        'The edited label was not shown',
      );

      const metas: string[] = [];
      for (const meta of await page.$$('p.meta')) metas.push((await meta.getText()).trim());
      expect(metas.some((text) => text.startsWith('Editada el'))).toBe(true);

      // Cancelling puts the summary back without touching the store.
      const reopened = page.$('ul.apps .app-card');
      await reopened.$('button=Editar').click();
      await expect(reopened.$('#field-label')).toBeExisting();
      await reopened.$('button=Cancelar').click();
      await expect(reopened.$('#field-label')).not.toBeExisting();
      await expect(reopened.$('.label')).toHaveText('Solicitud renombrada');

      await page.execute('window.confirm = () => false;');
      await reopened.$('button=Borrar').click();
      expect((await readStoredStore()).applications).toHaveLength(1);
      await page.execute('window.confirm = () => true;');
      await reopened.$('button=Borrar').click();
      await browser.waitUntil(async () => !(await page.$('ul.apps').isExisting()), {
        timeoutMsg: 'The application was not deleted',
      });

      const store = await readStoredStore();
      expect(store.applications).toEqual([]);
    });

    it('keeps an encrypted identity locked until the passphrase opens it', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      await enableEncryptionThroughUi(PASSPHRASE);

      const page = await openExtensionContext('options.html');
      const card = page.$('ul.apps .app-card');
      await card.$('button=Editar').click();

      // Locked: the identity cannot be shown before the passphrase has opened it, but the label can change.
      await expect(card.$('#field-passphrase')).toBeExisting();
      expect(await card.$('#field-nie').isEnabled()).toBe(false);
      expect(await card.$('#field-nie').getValue()).toBe('');

      await card.$('#field-passphrase').setValue('no es la contrasena');
      await card.$('button=Mostrar los datos').click();
      await browser.waitUntil(
        async () =>
          (await visibleErrors(page)).includes('Esa no es la contraseña: no se ha guardado nada.'),
        { timeoutMsg: 'A wrong passphrase said nothing' },
      );
      expect(await card.$('#field-nie').isEnabled()).toBe(false);

      await card.$('#field-passphrase').setValue(PASSPHRASE);
      await card.$('button=Mostrar los datos').click();
      await browser.waitUntil(async () => card.$('#field-nie').isEnabled(), {
        timeoutMsg: 'The passphrase did not reveal the identity',
      });
      await expect(card.$('#field-nie')).toHaveValue(FIRST_APPLICATION.nie);

      // Saving with the identity revealed re-encrypts it: nothing is written in clear while encryption is on.
      await card.$('#field-label').setValue('Solicitud cifrada renombrada');
      await card.$('button=Guardar cambios').click();
      await waitForText(
        page,
        'ul.apps .app-card .label',
        'Solicitud cifrada renombrada',
        'The edited label was not shown',
      );

      const [application] = (await readStoredStore()).applications;
      expect(application?.label).toBe('Solicitud cifrada renombrada');
      expect(application?.identity.kind).toBe('encrypted');
    });

    it('saves a reminder of its own', async () => {
      const page = await openExtensionContext('options.html');

      await page.$('#reminder-time').setValue('09:30');
      const checkboxes = await page.$$('form.fields:has(#reminder-time) input[type="checkbox"]');
      const [enabled, sunday] = [checkboxes[0], checkboxes[7]];
      if (enabled === undefined || sunday === undefined) {
        throw new Error('The reminder form has no checkboxes');
      }
      await enabled.click();
      // Sunday is off by default: adding it is what proves the chosen days are the ones saved.
      await sunday.click();
      await page.$('button=Guardar recordatorio').click();

      await waitForText(
        page,
        'form.fields:has(#reminder-time) p.hint',
        'Recordatorio guardado.',
        'The reminder was not saved',
      );

      const { settings } = await readStoredStore();
      expect(settings.reminders.enabled).toBe(true);
      expect(settings.reminders.time).toBe('09:30');
      expect(settings.reminders.weekdays).toEqual([1, 2, 3, 4, 5, 7]);
    });

    it('applies the language choice to every page and keeps the direction', async () => {
      const page = await openExtensionContext('options.html');

      await page.$('#language').selectByAttribute('value', 'en');
      await waitForText(
        page,
        '#app h1',
        'NacioCheck · Options',
        'The options page did not switch to English',
      );
      expect(await page.execute(() => document.documentElement.lang)).toBe('en');
      expect(await page.execute(() => document.documentElement.dir)).toBe('ltr');

      await page.$('#language').selectByAttribute('value', 'es');
      await waitForText(
        page,
        '#app h1',
        'NacioCheck · Opciones',
        'The options page did not switch back to Spanish',
      );
      expect(await page.execute(() => document.documentElement.lang)).toBe('es');

      // `qps` is the pseudo-RTL locale the select deliberately does not offer: it is what proves `dir`.
      await setStoredLanguage('qps');
      await page.refresh();
      await expect(page.$('#app h1')).toBeExisting();
      expect(await page.execute(() => document.documentElement.lang)).toBe('qps');
      expect(await page.execute(() => document.documentElement.dir)).toBe('rtl');

      // Back to Spanish: what the next test in this session finds is what this one leaves.
      await setStoredLanguage('es');
    });
  });

  describe('status guide', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
    });

    it('renders every section and keeps its sources as plain links', async () => {
      const page = await openExtensionContext('statuses.html');
      // Source links are underlined here as they are on the result page: a link is not told apart by colour alone.
      const underline = await page.execute(() => {
        const anchor = document.querySelector('#app a.link');
        return anchor === null ? null : getComputedStyle(anchor).textDecorationLine;
      });
      expect(underline).toContain('underline');
      // A heading that wraps on a phone does not leave one word alone on its second line (13.17).
      const wrap = await page.execute(() => {
        const heading = document.querySelector('#app h1.title');
        if (heading === null) throw new Error('No heading');
        return getComputedStyle(heading).getPropertyValue('text-wrap');
      });
      expect(wrap).toContain('balance');
      await expect(page.$('#app h1.title')).toHaveText('NacioCheck · Qué significa cada estado');

      const sections: string[] = [];
      for (const heading of await page.$$('#app h2.section')) {
        sections.push((await heading.getText()).trim());
      }
      expect(sections).toEqual([
        'El camino habitual',
        'Ramas conocidas',
        'Estados que solo documentan los despachos',
      ]);

      const cards = await page.$$('#app div.card');
      expect(cards.length).toBeGreaterThan(5);

      const links = await page.$$('#app ul.sources a');
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(await link.getAttribute('href')).toMatch(/^https:\/\//);
        expect(await link.getAttribute('rel')).toContain('noreferrer');
        expect((await link.getText()).trim().length).toBeGreaterThan(0);
      }

      // What was seen on real files is labelled, never linked: there is no page to open for it.
      const observed: string[] = [];
      for (const item of await page.$$('#app ul.sources li')) {
        if (!(await item.$('a').isExisting())) observed.push((await item.getText()).trim());
      }
      expect(observed).toContain('Observado en expedientes reales, no oficial');
    });

    it('names each status in Spanish with an English gloss when the language is English', async () => {
      await setStoredLanguage('en');
      const page = await openExtensionContext('statuses.html');

      const first = (await page.$$('#app div.card'))[0];
      if (first === undefined) throw new Error('No status card');
      await expect(first.$('h3')).toHaveAttribute('lang', 'es');
      await expect(first.$('h3')).toHaveText('Abierto - Registrado');
      await expect(first.$('h3 + p.gloss')).toHaveText('Open - Registered');
    });

    it('has no gloss in Spanish', async () => {
      const page = await openExtensionContext('statuses.html');

      const headings = await page.$$('#app div.card h3');
      expect(headings.length).toBeGreaterThan(5);
      expect(await page.$$('#app p.gloss')).toHaveLength(0);
      expect(await headings[0]?.getAttribute('lang')).toBeNull();
    });

    it('offers a closed "explanation looks wrong" panel on every card', async () => {
      const page = await openExtensionContext('statuses.html');

      const cards = await page.$$('#app div.card');
      expect(cards.length).toBeGreaterThan(5);
      for (const card of cards) {
        const panel = await card.$('details.report-panel');
        await expect(panel).toBeExisting();
        expect(await panel.getProperty('open')).toBe(false);
        await expect(panel.$('summary')).toHaveText('¿Esta explicación parece incorrecta?');
      }
      // One panel per card and none elsewhere: the guide reads as before until a panel is opened.
      expect(await page.$$('#app details.report-panel')).toHaveLength(cards.length);
    });

    it('fills a card panel with its key and explanation, and continues in the language of the page', async () => {
      await setStoredLanguage('en');
      const page = await openExtensionContext('statuses.html');
      await recordTabCreation(page);

      const first = (await page.$$('#app div.card'))[0];
      if (first === undefined) throw new Error('No status card');
      const panel = await first.$('details.report-panel');
      await openPanelWithKeyboard(panel);

      const text = panel.$('textarea');
      const report = await text.getValue();
      expect(report).toContain('NacioCheck report');
      expect(report).toContain('status key: ');
      expect(report).toMatch(/explanation: \S/);

      // One line: a typed newline is not kept by every driver, and the point is that the edited text travels.
      const edited = 'Edited report: the explanation reads wrong & unclear';
      await text.setValue(edited);
      await panel.$('button=Continue on the website').click();
      const urls = await recordedTabs(page);
      expect(urls).toHaveLength(1);
      expect(urls[0]?.startsWith(FEEDBACK_EN)).toBe(true);
      expect(decodeURIComponent((urls[0] ?? '').slice(FEEDBACK_EN.length))).toBe(edited);

      // Back to Spanish: what the next test in this session finds is what this one leaves.
      await setStoredLanguage('es');
    });
  });

  describe('result page', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
    });

    it('acknowledges a change', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);
      const sede = serveFakeSede({
        results: [
          resultPage({
            status: 'Abierto - En tramitación.',
            subStatus: 'Su expediente se encuentra en tramitación.',
          }),
        ],
      });

      const result = await runOneCheck(sede);
      await expect(result.$('.banner.changed')).toBeExisting();

      // The button that dismisses the alert is on the first screen, not after the explanation and the sources (13.13).
      const placement = await result.execute(() => {
        const button = [...document.querySelectorAll('button')].find(
          (candidate) => candidate.textContent === 'Entendido',
        );
        return {
          bottom: button?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
          screen: window.innerHeight,
        };
      });
      expect(placement.bottom).toBeLessThanOrEqual(placement.screen);
      // The alert's banner carries the mark already: no second brand header over it (13.15).
      await expect(result.$('.brand')).not.toBeExisting();

      await result.$('button=Entendido').click();
      await browser.waitUntil(async () => !(await result.$('button=Entendido').isExisting()), {
        timeoutMsg: 'The change was not acknowledged',
      });
      expect(await result.$('.banner').getAttribute('class')).not.toContain('changed');

      const { checks } = await readStoredStore();
      expect(checks).toHaveLength(2);
      expect(checks.at(-1)?.acknowledged).toBe(true);
    });

    /**
     * The view's class on the page container used to be `status`, which is also the heading's class: the heading's
     * size, colour and margins then applied to the whole page and its centring was lost. The container has to
     * keep the page's own text size and colour.
     */
    it('draws the status view at the page text size, not at the heading size', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const sede = serveFakeSede({ results: [resultPage()] });

      const result = await runOneCheck(sede);
      await expect(result.$('h1.status')).toHaveText('Abierto - Registrado.');
      // Every result page but the alert names the product at the top (13.15).
      await expect(result.$('.brand .brand-name')).toHaveText('NacioCheck');
      await expect(result.$('.brand img')).toBeExisting();

      const style = await result.execute(() => {
        const app = document.getElementById('app');
        if (app === null) throw new Error('Missing #app');
        const own = getComputedStyle(app);
        const page = getComputedStyle(document.body);
        return {
          size: own.fontSize,
          pageSize: page.fontSize,
          color: own.color,
          pageColor: page.color,
          marginTop: own.marginTop,
        };
      });
      expect(style.size).toBe(style.pageSize);
      expect(style.color).toBe(style.pageColor);
      expect(style.marginTop).toBe('0px');

      // The non-affiliation line is at least 14 px and set off by a rule (13.7).
      const note = await result.execute(() => {
        const disclaimer = document.querySelector('p.disclaimer');
        if (disclaimer === null) throw new Error('No disclaimer');
        const own = getComputedStyle(disclaimer);
        return { size: parseFloat(own.fontSize), rule: parseFloat(own.borderTopWidth) };
      });
      expect(note.size).toBeGreaterThanOrEqual(14);
      expect(note.rule).toBeGreaterThanOrEqual(1);
    });

    /**
     * The status, the sentence under it and the page's error messages are the site's own words, kept verbatim
     * (13.16, D12), whatever the language of the interface. The sentence carries a label that says so, in the language of the page, so they read
     * as deliberate and can be matched to what the official page printed.
     */
    it("labels the site's own sentence, in the language of the page", async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const sede = serveFakeSede({ results: [resultPage()] });

      const result = await runOneCheck(sede);
      await expect(result.$('p.sub-status .site-label')).toHaveText('Tal como la muestra la sede:');
      await expect(result.$('p.sub-status')).toHaveText(
        /Su expediente ha sido registrado correctamente/,
      );

      await setStoredLanguage('en');
      await result.refresh();
      // The label is drawn by the page, in its language; the status text is the site's, as read when the check ran.
      await expect(result.$('h1.status')).toHaveText('Abierto - Registrado.');
      await expect(result.$('p.sub-status .site-label')).toHaveText('As the site printed it:');
      await expect(result.$('p.sub-status')).toHaveText(
        /Su expediente ha sido registrado correctamente/,
      );
    });

    /**
     * The report holds the outcome and the status key, never what the site printed for the person (Q2) and never
     * the application's own values. Continue is exercised against a recorder: no feedback page is ever loaded.
     */
    it('offers a closed report panel on an error and continues with the edited text', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const sede = serveFakeSede({ results: [capturedPage('result-error-captcha.htm')] });

      const result = await runOneCheck(sede);
      await expect(result.$('.banner.error')).toBeExisting();

      const panel = await result.$('details.report-panel');
      await expect(panel).toBeExisting();
      await expect(panel.$('summary')).toHaveText('Informar de un problema');
      // After the disclaimer and before the buttons: the page keeps its reading order.
      const order = await result.execute(() => {
        const disclaimer = document.querySelector('p.disclaimer');
        const found = document.querySelector('details.report-panel');
        const retry = [...document.querySelectorAll('button')].find(
          (candidate) => candidate.textContent === 'Volver a intentarlo',
        );
        if (disclaimer === null || found === null || retry === undefined) {
          throw new Error('Missing disclaimer, panel or retry button');
        }
        return {
          afterDisclaimer: Boolean(
            disclaimer.compareDocumentPosition(found) & Node.DOCUMENT_POSITION_FOLLOWING,
          ),
          beforeRetry: Boolean(
            found.compareDocumentPosition(retry) & Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        };
      });
      expect(order).toEqual({ afterDisclaimer: true, beforeRetry: true });

      await openPanelWithKeyboard(panel);
      const text = panel.$('textarea');
      const report = await text.getValue();
      expect(report).toContain('Informe de NacioCheck');
      expect(report).toContain('resultado: error');
      expect(report).toContain('clave de estado: unknown');
      expect(await text.getAttribute('spellcheck')).toBe('false');

      // Only the outcome and the key: not what the site printed, not one value of the saved application.
      const { checks } = await readStoredStore();
      const printed = [checks[0]?.raw, checks[0]?.subStatus, 'Abierto - Registrado.'].filter(
        (value): value is string => value !== undefined && value !== null && value !== '',
      );
      for (const value of [...printed, ...identityValues(FIRST_APPLICATION)]) {
        expect(report).not.toContain(value);
      }

      await recordTabCreation(result);
      // One line: a typed newline is not kept by every driver, and the point is that the edited text travels.
      const edited = 'Informe editado: lo vi después de pulsar enviar & más';
      await text.setValue(edited);
      await panel.$('button=Continuar en la web').click();

      const urls = await recordedTabs(result);
      expect(urls).toHaveLength(1);
      expect(urls[0]?.startsWith(FEEDBACK_ES)).toBe(true);
      expect(decodeURIComponent((urls[0] ?? '').slice(FEEDBACK_ES.length))).toBe(edited);
      // The panel never left the page: the result is still showing and nothing was sent.
      await expect(result.$('.banner.error')).toBeExisting();
      expect(sede.posts).toHaveLength(1);
    });

    it("offers the panel on a status with an anomaly note, without the site's own sentence", async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      await seedPreviousCheck(
        FIRST_APPLICATION.label,
        'Abierto - Concedido. Enviada notificación.',
        null,
      );
      const sede = serveFakeSede({ results: [resultPage()] });

      const result = await runOneCheck(sede);
      await expect(result.$('p.anomaly')).toHaveText(/no se había observado hasta ahora/);

      const panel = await result.$('details.report-panel');
      await expect(panel).toBeExisting();
      expect(await panel.getProperty('open')).toBe(false);
      await openPanelWithKeyboard(panel);
      const report = await panel.$('textarea').getValue();
      expect(report).toContain('resultado: status');
      expect(report).toContain('nota: ');
      for (const value of [
        RESULT_VALUES.status,
        RESULT_VALUES.subStatus,
        'Abierto - Concedido',
        ...identityValues(FIRST_APPLICATION),
      ]) {
        expect(report).not.toContain(value);
      }
    });

    it('offers no panel on a normal status', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const sede = serveFakeSede({ results: [resultPage()] });

      const result = await runOneCheck(sede);
      await expect(result.$('h1.status')).toHaveText('Abierto - Registrado.');
      await expect(result.$('p.anomaly')).not.toBeExisting();
      await expect(result.$('details.report-panel')).not.toBeExisting();
    });

    it('retries a failed check and finishes the run', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const sede = serveFakeSede({
        results: [capturedPage('result-error-captcha.htm'), resultPage()],
      });

      const checkWindow = await startRunFromPopup();
      await solveStubCaptcha(checkWindow);
      const failed = await waitForResult(checkWindow);
      await expect(failed.$('.banner.error')).toBeExisting();
      await expect(failed.$('.brand .brand-name')).toHaveText('NacioCheck');
      await expect(failed.$('p.site-said')).toHaveText('Tal como la muestra la sede:');
      // The result page has its own button style; its buttons are tap-sized like the rest (13.4).
      expect(await failed.$('button=Volver a intentarlo').getSize('height')).toBeGreaterThanOrEqual(
        44,
      );

      await failed.$('button=Volver a intentarlo').click();
      await waitForPageUrl(checkWindow, SEDE_FORM_URL, 'The retry did not go back to the form');
      if (!(await awaitFakePage(checkWindow))) {
        throw new Error('The retried form never loaded');
      }
      await expect(checkWindow.$('#naciocheck-captcha-only')).toBeExisting();

      await solveStubCaptcha(checkWindow);
      const retried = await waitForResult(checkWindow);
      await expect(retried.$('h1.status')).toHaveText('Abierto - Registrado.');
      expect(sede.posts).toHaveLength(2);

      const { checks } = await readStoredStore();
      expect(checks.map((check) => check.outcome)).toEqual(['error', 'status']);
    });
  });

  describe('backup', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
    });

    it('exports the store and imports the exported file back', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      await addApplicationThroughUi(SECOND_APPLICATION);
      const before = (await readStoredStore()).applications;

      const page = await openExtensionContext('options.html');
      // Both answers a person gives: the warning before exporting plain identities and the merge question.
      // Passed as strings because the test transform names function expressions, and the page has no `__name`.
      await page.execute('window.confirm = () => true;');
      // The export hands a Blob to an anchor; capturing its text is what lets the test import exactly what was
      // exported, without a download directory or a second window.
      await page.execute(`
        globalThis.__exportedBackup = null;
        URL.createObjectURL = (blob) => {
          blob.text().then((text) => { globalThis.__exportedBackup = text; });
          return 'blob:naciocheck-e2e';
        };
      `);

      await page.$('button=Exportar').click();
      const exported = await browser.waitUntil(
        async () => {
          const text = await page.execute('return globalThis.__exportedBackup;');
          return typeof text === 'string' && text.length > 0 ? text : false;
        },
        { timeoutMsg: 'The export produced no file' },
      );

      const parsed = JSON.parse(exported) as {
        format: string;
        store: { applications: Array<{ id: string; label: string }> };
      };
      expect(parsed.format).toBe('naciocheck-backup');
      expect(parsed.store.applications.map((application) => application.label)).toEqual([
        FIRST_APPLICATION.label,
        SECOND_APPLICATION.label,
      ]);

      const artifacts = resolve('e2e/.artifacts/backup');
      mkdirSync(artifacts, { recursive: true });
      const file = join(artifacts, 'naciocheck-copia.json');
      writeFileSync(file, exported, 'utf8');

      // An empty store, then the file a person would pick: the round trip ends where it started.
      await resetExtensionStorage();
      const reopened = await openExtensionContext('options.html');
      await reopened.execute('window.confirm = () => true;');
      await reopened.$('#import-file').setValue(file);
      await reopened.$('button=Importar el archivo elegido').click();

      await browser.waitUntil(
        async () => {
          const hints: string[] = [];
          for (const hint of await reopened.$$('#app p.hint')) {
            hints.push((await hint.getText()).trim());
          }
          return hints.includes('Importado y combinado.');
        },
        { timeoutMsg: 'The import was not confirmed' },
      );

      const after = (await readStoredStore()).applications;
      expect(after.map((application) => application.id)).toEqual(
        before.map((application) => application.id),
      );
      expect(after.map((application) => application.identity.kind)).toEqual(['plain', 'plain']);
    });
  });

  describe('content script fallback', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
      await setFallbackSwitch(true);
    });

    afterEach(async () => {
      await setFallbackSwitch(false);
    });

    /**
     * The MVP plan's manual item: with the hiding switched off through the content script's own debug flag, the
     * page keeps its whole form, the hint says the query has to be sent by hand, and the check still completes
     * once the person presses the page's own button.
     */
    it('leaves the page whole, says so, and still records the check', async () => {
      await addApplicationThroughUi(FIRST_APPLICATION);
      const sede = serveFakeSede({ results: [resultPage()] });

      const checkWindow = await startRunFromPopup();

      await expect(checkWindow.$('#naciocheck-hint-style')).toBeExisting();
      await expect(checkWindow.$('#naciocheck-captcha-only')).not.toBeExisting();
      await expect(checkWindow.$('#naciocheck-hint')).toHaveText(/envía la consulta a mano/);
      await expect(checkWindow.$('#idFormuNac')).toBeDisplayed();

      await checkWindow.$('#submitNac').click();

      const result = await waitForResult(checkWindow);
      await expect(result.$('h1.status')).toHaveText('Abierto - Registrado.');
      expect(sede.posts).toHaveLength(1);

      const { checks } = await readStoredStore();
      expect(checks.map((check) => check.outcome)).toEqual(['status']);
    });
  });
});
