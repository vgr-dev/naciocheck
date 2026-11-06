import { browser, expect } from '@wdio/globals';
import { extensionPageUrl } from '../support/extension';
import { failOnLeakedRequest } from '../support/guard-hooks';

failOnLeakedRequest();

/**
 * The first thing that has to work: the built extension loads in this browser, its pages are reachable at
 * the derived URL, and they render. Everything else in the suite depends on that.
 */
describe('built extension', () => {
  for (const page of ['popup.html', 'statuses.html'] as const) {
    it(`renders ${page}`, async () => {
      await browser.url(extensionPageUrl(browser.capabilities.browserName, page));

      const heading = $('h1');
      await expect(heading).toBeExisting();

      const text = (await heading.getText()).trim();
      expect(text.length).toBeGreaterThan(0);
    });
  }
});
