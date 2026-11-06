import { browser } from '@wdio/globals';
import { networkGuard } from './network-guard';

/** How long to let the browser report a request it made at the very end of the test. */
const SETTLE_MS = 300;

/**
 * Fails each test of the calling spec file when the network guard blocked a request during it.
 *
 * Call it once at the top level of a spec file, outside any `describe`. It has to be a Mocha hook: a
 * WebdriverIO `afterTest` hook only logs its error and leaves the test green, and Mocha's root hooks
 * loaded through `mochaOpts.require` get a separate module instance of the guard.
 */
export function failOnLeakedRequest(): void {
  afterEach(async () => {
    // The browser reports an aborted request after the test body has already returned.
    await browser.pause(SETTLE_MS);
    networkGuard().assertClean();
  });
}
