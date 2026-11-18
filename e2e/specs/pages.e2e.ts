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

  describe('onboarding', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
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
  });

  describe('options', () => {
    beforeEach(async () => {
      await resetExtensionStorage();
    });

    /**
     * The form's own validation: what is wrong with which field, all at once, and nothing written.
     *
     * A birth date after today is a real date and still not one anybody was born on, so it takes a second
     * submission: the field itself cannot tell the two apart.
     */
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

      const store = await readStoredStore();
      expect(store.applications.map((application) => application.identity.kind)).toEqual([
        'encrypted',
      ]);
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
      await expect(page.$('#app h1.title')).toHaveText('Qué significa cada estado');

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
      await expect(result.$('h1.status')).toHaveText('Abierto - Registrado');

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

      await failed.$('button=Volver a intentarlo').click();
      await waitForPageUrl(checkWindow, SEDE_FORM_URL, 'The retry did not go back to the form');
      if (!(await awaitFakePage(checkWindow))) {
        throw new Error('The retried form never loaded');
      }
      await expect(checkWindow.$('#naciocheck-captcha-only')).toBeExisting();

      await solveStubCaptcha(checkWindow);
      const retried = await waitForResult(checkWindow);
      await expect(retried.$('h1.status')).toHaveText('Abierto - Registrado');
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
      await expect(result.$('h1.status')).toHaveText('Abierto - Registrado');
      expect(sede.posts).toHaveLength(1);

      const { checks } = await readStoredStore();
      expect(checks.map((check) => check.outcome)).toEqual(['status']);
    });
  });
});
