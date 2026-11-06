import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { browser } from '@wdio/globals';
import {
  assertGeckoIdMatchesBuild,
  CHROME_BUILD_DIR,
  FIREFOX_EXTENSION_UUID,
  firefoxExtensionZip,
  GECKO_ID,
} from './support/extension';
import { networkGuard } from './support/network-guard';

/**
 * WebdriverIO drives both browsers, headless by default, against the real production build. A headed run
 * (`E2E_HEADED=1`) opens real windows under WSLg for debugging.
 */
const headed = process.env.E2E_HEADED === '1';

/** Restrict the run to one browser (`E2E_BROWSER=chrome|firefox`); the npm scripts set this. */
const onlyBrowser = process.env.E2E_BROWSER;

/**
 * Chrome for Testing is the only Chrome that still honours `--load-extension` (branded Chrome 137+
 * ignores it), which is why the suite downloads it instead of using the host's browser.
 */
const CHROME_EXTENSION_ARGS = [
  `--disable-extensions-except=${CHROME_BUILD_DIR}`,
  `--load-extension=${CHROME_BUILD_DIR}`,
  '--no-first-run',
  '--no-default-browser-check',
  ...(headed ? [] : ['--headless=new']),
];

function chromeCapability(): WebdriverIO.Capabilities {
  return {
    browserName: 'chrome',
    // `stable` makes WebdriverIO download Chrome for Testing plus the matching chromedriver.
    browserVersion: 'stable',
    'goog:chromeOptions': { args: CHROME_EXTENSION_ARGS },
  };
}

function firefoxCapability(): WebdriverIO.Capabilities {
  return {
    browserName: 'firefox',
    'moz:firefoxOptions': {
      args: headed ? [] : ['-headless'],
      prefs: {
        // Pins the moz-extension UUID, so extension page URLs are the same on every run.
        'extensions.webextensions.uuids': JSON.stringify({ [GECKO_ID]: FIREFOX_EXTENSION_UUID }),
      },
    },
  };
}

function capabilitiesForRun(): WebdriverIO.Config['capabilities'] {
  const all = [chromeCapability(), firefoxCapability()];
  if (onlyBrowser === undefined) return all;
  const selected = all.filter((capability) => capability.browserName === onlyBrowser);
  if (selected.length === 0) {
    throw new Error(`E2E_BROWSER must be 'chrome' or 'firefox', not '${onlyBrowser}'.`);
  }
  return selected;
}

function buildExtension(): void {
  execFileSync('npm', ['run', 'build:chrome'], { stdio: 'inherit' });
  execFileSync('npm', ['run', 'build:firefox'], { stdio: 'inherit' });
  // geckodriver installs a zip; WXT only produces one through `zip`, which builds again by design.
  execFileSync('npx', ['wxt', 'zip', '-b', 'firefox'], { stdio: 'inherit' });
  assertGeckoIdMatchesBuild();
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [resolve(import.meta.dirname, 'specs/**/*.e2e.ts')],
  maxInstances: 1,
  capabilities: capabilitiesForRun(),
  logLevel: 'warn',
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 180_000,
  },

  /** Tests always run the real build: both browsers are rebuilt, and the Firefox zip is refreshed. */
  onPrepare() {
    buildExtension();
  },

  async before() {
    if (browser.capabilities.browserName === 'firefox') {
      // Temporary install: unsigned is fine, and nothing survives the session.
      const zip = readFileSync(firefoxExtensionZip()).toString('base64');
      await browser.installAddOn(zip, true);
    }
  },

  /**
   * One catch-all guard per test. A test that registers mocks of its own has to call `install()` again
   * afterwards: WebdriverIO's arbiter prefers the mock registered first, so the catch-all must be the newest.
   */
  async beforeTest() {
    await networkGuard().install();
  },
};
