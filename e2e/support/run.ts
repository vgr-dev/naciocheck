import { browser } from '@wdio/globals';
import { extensionPageUrl, openPageUrls, waitForNewPage, waitForPageUrl } from './extension';
import { SEDE_FORM_URL, awaitFakePage, solveStubCaptcha } from './fake-sede';

/**
 * One check run, for the specs that need what a run produces but not the run itself.
 *
 * The popup closes its own window as soon as a run starts, so it gets one of its own; the window the extension
 * opens for the check is the one a person gets, at the real URL, answered by the local fake site (D10).
 */

/** Presses "check now" in the popup and returns the check window showing the fake form. */
export async function startCheckFromPopup(): Promise<WebdriverIO.BrowsingContext> {
  const before = await openPageUrls();
  const popupUrl = extensionPageUrl(browser.capabilities.browserName, 'popup.html');
  await browser.newWindow(popupUrl);
  const popup = await waitForNewPage(popupUrl, before, 'The popup did not open');
  await popup.$('li.app-card button').click();
  const checkWindow = await waitForNewPage(SEDE_FORM_URL, before, 'The check window did not open');
  if (!(await awaitFakePage(checkWindow))) {
    throw new Error('The check window never showed the fake form');
  }
  return checkWindow;
}

/** Solves the stub captcha and waits for the run to finish: the check window itself turns into the result page. */
export async function finishCheck(
  checkWindow: WebdriverIO.BrowsingContext,
): Promise<WebdriverIO.BrowsingContext> {
  await solveStubCaptcha(checkWindow);
  const resultUrl = extensionPageUrl(browser.capabilities.browserName, 'result.html');
  await waitForPageUrl(checkWindow, resultUrl, 'The result page did not open');
  return checkWindow;
}
