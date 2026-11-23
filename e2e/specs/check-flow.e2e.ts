import { browser, expect } from '@wdio/globals';
import {
  extensionPageUrl,
  newPageUrls,
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
  syntheticPage,
  type FakeSede,
} from '../support/fake-sede';
import { failOnLeakedRequest } from '../support/guard-hooks';
import { networkGuard } from '../support/network-guard';
import {
  FIRST_APPLICATION,
  type FakeIdentity,
  PASSPHRASE,
  SECOND_APPLICATION,
  addApplicationThroughUi,
  enableEncryptionThroughUi,
  lockExtensionSession,
  readStoredStore,
  resetExtensionStorage,
  seedPreviousCheck,
} from '../support/seed';

failOnLeakedRequest();

/**
 * The whole check run, in Chrome, against the fake sede: popup → check window with only the captcha → the
 * human solves the stub captcha → the extension submits → the result page → the check in storage.
 *
 * Every identity, status and page here is fake. The extension itself is the shipped build, and the only hosts
 * the browser can resolve are the three the local fake site answers on (D10).
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

function identityValues(identity: FakeIdentity): Record<string, string> {
  return {
    nie: identity.nie,
    numero: identity.numero,
    year: identity.year,
    birthDate: identity.birthDate,
  };
}

function extensionPage(page: string): string {
  return extensionPageUrl(browser.capabilities.browserName, page);
}

/** The four fields as the official form holds them; a field the page lacks reads empty. */
async function formValues(scope: WebdriverIO.BrowsingContext): Promise<Record<string, string>> {
  // No helper function inside the callback: the test transform names a function assigned to a variable, and
  // that name helper does not exist in the page.
  return scope.execute(() => {
    const values = [
      'formuNac.codigoNieCompleto',
      'formuNac.numero',
      'formuNac.yearSolicitud',
      'formuNac.fechaNacimiento',
    ].map((name) => {
      const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      return input === null ? '' : input.value;
    });
    return {
      nie: values[0] ?? '',
      numero: values[1] ?? '',
      year: values[2] ?? '',
      birthDate: values[3] ?? '',
    };
  });
}

/**
 * Presses the run button in the popup and returns the check window showing the fake form.
 *
 * The popup is opened in a window of its own on purpose: it closes that window as soon as the run starts, so it
 * must not be the tab the rest of the test goes on using. The window the extension opens for the check is the one
 * the user gets, at the real URL, answered by the local fake site.
 */
async function startRun(
  options: { checkAll?: boolean } = {},
): Promise<WebdriverIO.BrowsingContext> {
  const before = await openPageUrls();
  await browser.newWindow(extensionPage('popup.html'));
  const popup = await waitForNewPage(extensionPage('popup.html'), before, 'The popup did not open');
  await popup.$(options.checkAll === true ? '.row button.primary' : 'li.app-card button').click();
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

/** Runs one check to completion against the fake sede and returns the result page. */
async function runOneCheck(sede: FakeSede): Promise<WebdriverIO.BrowsingContext> {
  expect(sede.posts).toHaveLength(0);
  const checkWindow = await startRun();
  await expect(checkWindow.$('#naciocheck-captcha-only')).toBeExisting();
  await solveStubCaptcha(checkWindow);
  await waitForResult(checkWindow);
  return checkWindow;
}

describe('check run', () => {
  beforeEach(async () => {
    await resetExtensionStorage();
  });

  it('fills the form, hides everything but the captcha and stores the status', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    const sede = serveFakeSede({ results: [resultPage()] });

    const checkWindow = await startRun();

    await expect(checkWindow.$('#naciocheck-captcha-only')).toBeExisting();
    await expect(checkWindow.$('#naciocheck-hint')).toHaveText(/Marca la casilla del captcha/);
    expect(await formValues(checkWindow)).toEqual(identityValues(FIRST_APPLICATION));

    // Nothing has been sent: the fields are filled, the form is waiting for the human.
    expect(sede.posts).toHaveLength(0);

    await solveStubCaptcha(checkWindow);

    const result = await waitForResult(checkWindow);
    await expect(result.$('h1.status')).toHaveText('Abierto - Registrado.');
    // The first check is not a change, so no alert banner.
    await expect(result.$('.banner')).not.toBeExisting();
    expect(sede.posts).toHaveLength(1);

    const store = await readStoredStore();
    expect(store.checks).toHaveLength(1);
    expect(store.checks[0]?.outcome).toBe('status');
    expect(store.checks[0]?.raw).toBe('Abierto - Registrado.');
    expect(store.checks[0]?.subStatus).toBe('Su expediente ha sido registrado correctamente.');
  });

  it('never submits while the captcha is unsolved', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    const sede = serveFakeSede({ results: [resultPage()] });

    const checkWindow = await startRun();
    await expect(checkWindow.$('#naciocheck-captcha-only')).toBeExisting();

    // The content script polls every 400 ms: a full second is more than two intervals with nothing to send.
    await browser.pause(1_000);
    expect(sede.posts).toHaveLength(0);
    expect(await checkWindow.getUrl()).toBe(SEDE_FORM_URL);

    // The same run does submit once the token exists, so the wait above was not a page that never loads.
    await solveStubCaptcha(checkWindow);
    await waitForResult(checkWindow);
    expect(sede.posts).toHaveLength(1);
  });

  it('reports a change along the main path with the meaning observed for it', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    const sede = serveFakeSede({
      results: [
        resultPage({
          status: 'Abierto - En tramitación.',
          subStatus: 'Su expediente se encuentra en tramitación.',
        }),
      ],
    });
    await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - Registrado.', null);

    const result = await runOneCheck(sede);

    await expect(result.$('.banner.changed')).toBeExisting();
    await expect(result.$('h1.status')).toHaveText('Abierto - En tramitación.');
    await expect(result.$('p.previous')).toHaveText(/Abierto - Registrado\./);
    await expect(result.$('p.observed-meaning')).toHaveText(/Tramitación en curso/);
    await expect(result.$('p.anomaly')).not.toBeExisting();
  });

  it('reports a known branch without calling it unusual', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    const sede = serveFakeSede({
      results: [
        resultPage({
          status: 'Abierto - En tramitación.',
          subStatus: 'Su expediente se encuentra en estudio',
        }),
      ],
    });
    await seedPreviousCheck(FIRST_APPLICATION.label, 'Abierto - En calificación.', null);

    const result = await runOneCheck(sede);

    await expect(result.$('.banner.changed')).toBeExisting();
    await expect(result.$('p.observed-meaning')).toHaveText(/suele seguirle una petición/);
    await expect(result.$('p.anomaly')).not.toBeExisting();
  });

  it('marks a move no observation places on the path', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    const sede = serveFakeSede({ results: [resultPage()] });
    await seedPreviousCheck(
      FIRST_APPLICATION.label,
      'Abierto - Concedido. Enviada notificación.',
      null,
    );

    const result = await runOneCheck(sede);

    await expect(result.$('.banner.changed')).toBeExisting();
    await expect(result.$('p.anomaly')).toHaveText(/no se había observado hasta ahora/);
    await expect(result.$('p.observed-meaning')).not.toBeExisting();
  });

  it('shows the page error verbatim and does not record it as a status', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    const sede = serveFakeSede({ results: [capturedPage('result-error-captcha.htm')] });

    const result = await runOneCheck(sede);

    await expect(result.$('.banner.error')).toBeExisting();
    const messages: string[] = [];
    for (const item of await result.$$('.errors li')) {
      messages.push((await item.getText()).trim());
    }
    expect(messages).toEqual([
      'El campo "NIE" no se corresponde con un número de NIE correcto',
      'Error en la verificación del captcha',
    ]);

    const store = await readStoredStore();
    expect(store.checks).toHaveLength(1);
    expect(store.checks[0]?.outcome).toBe('error');
    expect(store.checks[0]?.statusKey).toBe('unknown');
  });

  it('falls back to the hint on a form it does not recognise', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    const sede = serveFakeSede({
      form: syntheticPage('synthetic-unknown-form.html'),
      results: [],
    });

    const checkWindow = await startRun();

    await expect(checkWindow.$('#naciocheck-hint-style')).toBeExisting();
    await expect(checkWindow.$('#naciocheck-captcha-only')).not.toBeExisting();
    await expect(checkWindow.$('#naciocheck-hint')).toHaveText(/envía la consulta a mano/);
    // The page stays whole; only the field it has was filled.
    await expect(checkWindow.$('h2')).toBeDisplayed();
    expect(await formValues(checkWindow)).toEqual({
      ...identityValues(FIRST_APPLICATION),
      numero: '',
      year: '',
      birthDate: '',
    });

    await browser.pause(1_000);
    expect(sede.posts).toHaveLength(0);
  });

  it('offers the saved applications when the form is opened by hand', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    serveFakeSede({ results: [] });

    // The form opened by hand, in a tab of its own: no run, so no application to fill.
    const before = await openPageUrls();
    await browser.newWindow(SEDE_FORM_URL);
    const form = await waitForNewPage(SEDE_FORM_URL, before, 'The fake form did not open');
    expect(await awaitFakePage(form)).toBe(true);

    await expect(form.$('#naciocheck-picker')).toBeExisting();
    const [choice] = await form.$$('#naciocheck-picker button');
    if (choice === undefined) throw new Error('The picker listed no application');
    await expect(choice).toHaveText(FIRST_APPLICATION.label);

    await choice.click();
    await expect(form.$('#naciocheck-captcha-only')).toBeExisting();
    expect(await formValues(form)).toEqual(identityValues(FIRST_APPLICATION));
  });

  it('asks for the passphrase of an encrypted application, and only accepts the right one', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    await enableEncryptionThroughUi(PASSPHRASE);
    await lockExtensionSession();
    const sede = serveFakeSede({ results: [resultPage()] });

    const before = await openPageUrls();
    await browser.newWindow(extensionPage('popup.html'));
    const popup = await waitForNewPage(
      extensionPage('popup.html'),
      before,
      'The popup did not open',
    );
    await popup.$('li.app-card:first-child button').click();

    const unlockPage = await waitForNewPage(
      extensionPage('unlock.html'),
      before,
      'The unlock page did not open',
    );

    // A wrong passphrase says so and opens no check window.
    await unlockPage.$('#passphrase').setValue('no es la contrasena');
    await unlockPage.$('button.primary').click();
    await expect(unlockPage.$('p.hint:last-of-type')).toHaveText(/No se ha podido desbloquear/);
    await browser.pause(1_000);
    expect((await newPageUrls(before)).filter((url) => url.startsWith(SEDE_FORM_URL))).toEqual([]);

    await unlockPage.$('#passphrase').setValue(PASSPHRASE);
    await unlockPage.$('button.primary').click();

    const checkWindow = await waitForNewPage(
      SEDE_FORM_URL,
      before,
      'The check window did not open after unlock',
    );
    expect(await awaitFakePage(checkWindow)).toBe(true);
    await expect(checkWindow.$('#naciocheck-captcha-only')).toBeExisting();
    expect(await formValues(checkWindow)).toEqual(identityValues(FIRST_APPLICATION));

    await solveStubCaptcha(checkWindow);
    await waitForResult(checkWindow);
    expect(sede.posts).toHaveLength(1);
  });

  it('checks the encrypted application that was chosen, not every saved one, after unlocking', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    await addApplicationThroughUi(SECOND_APPLICATION);
    await enableEncryptionThroughUi(PASSPHRASE);
    await lockExtensionSession();
    const sede = serveFakeSede({ results: [resultPage({ expendiente: 'R500002' })] });

    const before = await openPageUrls();
    await browser.newWindow(extensionPage('popup.html'));
    const popup = await waitForNewPage(
      extensionPage('popup.html'),
      before,
      'The popup did not open',
    );
    const cards = await popup.$$('li.app-card');
    expect(cards).toHaveLength(2);
    const secondCard = cards[1];
    if (secondCard === undefined) throw new Error('The second application is not in the popup');
    await secondCard.$('button').click();

    const unlockPage = await waitForNewPage(
      extensionPage('unlock.html'),
      before,
      'The unlock page did not open',
    );
    await unlockPage.$('#passphrase').setValue(PASSPHRASE);
    await unlockPage.$('button.primary').click();

    const checkWindow = await waitForNewPage(
      SEDE_FORM_URL,
      before,
      'The check window did not open after unlock',
    );
    expect(await awaitFakePage(checkWindow)).toBe(true);
    await expect(checkWindow.$('#naciocheck-captcha-only')).toBeExisting();
    // The selected application, not the first one in the store: unlocking must not start every saved one.
    expect(await formValues(checkWindow)).toEqual(identityValues(SECOND_APPLICATION));

    await solveStubCaptcha(checkWindow);
    await waitForResult(checkWindow);
    expect(sede.posts).toHaveLength(1);

    const store = await readStoredStore();
    const second = store.applications.find(
      (application) => application.label === SECOND_APPLICATION.label,
    );
    expect(second).toBeDefined();
    expect(store.checks).toHaveLength(1);
    expect(store.checks[0]?.applicationId).toBe(second?.id);
  });

  it('never starts every application from a cancelled or missing unlock selection', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    await addApplicationThroughUi(SECOND_APPLICATION);
    await enableEncryptionThroughUi(PASSPHRASE);
    await lockExtensionSession();
    const sede = serveFakeSede({ results: [resultPage()] });
    const before = await openPageUrls();
    await browser.newWindow(extensionPage('popup.html'));
    const popup = await waitForNewPage(
      extensionPage('popup.html'),
      before,
      'The popup did not open',
    );
    await popup.$('li.app-card:first-child button').click();
    const pending = await waitForNewPage(
      extensionPage('unlock.html'),
      before,
      'The unlock page did not open',
    );
    await expect(pending.$('#passphrase')).toBeExisting();

    await lockExtensionSession();
    await browser.waitUntil(
      async () =>
        !(await openPageUrls()).some((url) => url.startsWith(extensionPage('unlock.html'))),
      {
        timeoutMsg: 'Locking did not close the pending unlock prompt',
      },
    );

    // Even reopening an obsolete prompt cannot turn an absent selection into "check all".
    const afterLock = await openPageUrls();
    await browser.newWindow(extensionPage('unlock.html'));
    const stale = await waitForNewPage(
      extensionPage('unlock.html'),
      afterLock,
      'The stale prompt did not open',
    );
    await stale.$('#passphrase').setValue(PASSPHRASE);
    await stale.$('button.primary').click();
    await expect(stale.$('p.hint:last-of-type')).toHaveText(/No se ha podido desbloquear/);
    expect((await newPageUrls(before)).filter((url) => url.startsWith(SEDE_FORM_URL))).toEqual([]);
    expect(sede.posts).toHaveLength(0);
  });

  it('checks a second application in the same window after the first', async () => {
    await addApplicationThroughUi(FIRST_APPLICATION);
    await addApplicationThroughUi(SECOND_APPLICATION);
    const sede = serveFakeSede({
      results: [resultPage(), resultPage({ expendiente: 'R500002' })],
    });

    const firstWindow = await startRun({ checkAll: true });
    await expect(firstWindow.$('#naciocheck-captcha-only')).toBeExisting();
    expect(await formValues(firstWindow)).toEqual(identityValues(FIRST_APPLICATION));

    await solveStubCaptcha(firstWindow);
    const firstResult = await waitForResult(firstWindow);
    // The queue has a second application, so the result page offers to go on.
    await firstResult.$('button=Continuar con la siguiente solicitud').click();

    // The same window goes back to the form for the second application.
    await waitForPageUrl(firstWindow, SEDE_FORM_URL, 'The run did not return to the form');
    await expect(firstWindow.$('#naciocheck-captcha-only')).toBeExisting();
    expect(await formValues(firstWindow)).toEqual(identityValues(SECOND_APPLICATION));

    await solveStubCaptcha(firstWindow);
    const secondResult = await waitForResult(firstWindow);
    await expect(secondResult.$('h1.status')).toHaveText('Abierto - Registrado.');
    expect(sede.posts).toHaveLength(2);

    const store = await readStoredStore();
    expect(store.checks).toHaveLength(2);
    expect(new Set(store.checks.map((check) => check.applicationId)).size).toBe(2);
  });

  /**
   * The boundary the whole suite rests on: only the three mapped hosts resolve, so a request to any other host
   * cannot reach the network — and the guard, which only observes, is what says so.
   */
  it('cannot reach a host outside the fake site', async () => {
    const options = await openExtensionContext('options.html');

    const outcome = await options.execute(async () => {
      try {
        await fetch('https://example.org/', { cache: 'no-store' });
        return 'reached';
      } catch (error) {
        return `blocked: ${String(error)}`;
      }
    });
    expect(outcome).toMatch(/^blocked/);

    // The probe is the one request outside the fake site a test asks for, so it takes it and the guard stays
    // quiet at the end of the test.
    await browser.pause(500);
    const outside = networkGuard().takeUnexpected();
    expect(outside.filter((url) => url.startsWith('https://example.org/'))).toHaveLength(1);
  });
});
