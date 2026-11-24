import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { browser } from '@wdio/globals';
import {
  assertGeckoIdMatchesBuild,
  CHROME_BUILD_DIR,
  FIREFOX_EXTENSION_UUID,
  firefoxExtensionZip,
  GECKO_ID,
} from './support/extension';
import {
  FAKE_HOSTS,
  TLS_CERT,
  TLS_DIR,
  TLS_KEY,
  fakeSedePort,
  startFakeSede,
  stopFakeSede,
} from './support/fake-sede';
import { networkGuard } from './support/network-guard';
import { SITE_HOST, siteServerPort, startSiteServer, stopSiteServer } from './support/site-server';
import { createVisualFolders, visualServiceOptions } from './support/visual';

/**
 * WebdriverIO drives both browsers, headless by default, against the real production build. A headed run
 * (`E2E_HEADED=1`) opens real windows under WSLg for debugging.
 *
 * The automated suite is Chrome-only (D1): `npm run test:e2e` runs every spec in Chrome for Testing, and
 * Firefox gets the smoke spec alone, whose header records why the rest cannot run there yet. Firefox desktop
 * is covered by `docs/manual-firefox-checklist.md`.
 */
const headed = process.env.E2E_HEADED === '1';

/** Restrict the run to one browser (`E2E_BROWSER=chrome|firefox`); the npm scripts set this. */
const onlyBrowser = process.env.E2E_BROWSER;

/**
 * Restrict the Chrome run to one spec (`E2E_SPEC=visual` → `specs/visual.e2e.ts`).
 *
 * `npm run test:e2e:update-baselines` needs the visual spec alone: regenerating baselines while the other specs
 * run would only make the same run slower.
 */
const onlySpec = process.env.E2E_SPEC;

/** Chrome runs the whole suite, or the one spec `E2E_SPEC` names. */
const CHROME_SPECS = [
  resolve(
    import.meta.dirname,
    onlySpec === undefined ? 'specs/**/*.e2e.ts' : `specs/${onlySpec}.e2e.ts`,
  ),
];

/** Firefox keeps the smoke spec: Marionette refuses to navigate to `moz-extension://` pages (D1). */
const FIREFOX_SPECS = [resolve(import.meta.dirname, 'specs/smoke.e2e.ts')];

/**
 * Where the browser is told to find the fake site: the three hosts the captured pages use go to the local
 * server, every other host resolves to nothing, and loopback itself is never remapped. Reason: the suite must
 * be unable to reach any real server, without intercepting a single request (D10).
 */
const HOST_RULES = [
  ...FAKE_HOSTS.map((host) => `MAP ${host} 127.0.0.1:${fakeSedePort()}`),
  // The built site is a fourth mapped host, served over http by `support/site-server.ts`.
  `MAP ${SITE_HOST} 127.0.0.1:${siteServerPort()}`,
  'MAP * ~NOTFOUND',
  'EXCLUDE 127.0.0.1',
].join(', ');

/**
 * Chrome for Testing is the only Chrome that still honours `--load-extension` (branded Chrome 137+
 * ignores it), which is why the suite downloads it instead of using the host's browser.
 */
const CHROME_EXTENSION_ARGS = [
  `--disable-extensions-except=${CHROME_BUILD_DIR}`,
  `--load-extension=${CHROME_BUILD_DIR}`,
  `--host-resolver-rules=${HOST_RULES}`,
  '--no-first-run',
  '--no-default-browser-check',
  // The logo on two of the pages is an animated SVG that honours reduced motion: without this a screenshot catches
  // it at some frame of its draw-in, and the baselines differ from run to run.
  '--force-prefers-reduced-motion',
  ...(headed ? [] : ['--headless=new']),
];

function chromeCapability(): WebdriverIO.Capabilities {
  return {
    browserName: 'chrome',
    // `stable` makes WebdriverIO download Chrome for Testing plus the matching chromedriver.
    browserVersion: 'stable',
    // The fake site's certificate is generated per run and is not in any trust store.
    acceptInsecureCerts: true,
    'goog:chromeOptions': { args: CHROME_EXTENSION_ARGS },
    'wdio:specs': CHROME_SPECS,
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
    'wdio:specs': FIREFOX_SPECS,
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

/** The site specs serve `.output/site/`, so it is rebuilt with the extension. */
function buildSite(): void {
  execFileSync('npm', ['run', 'build:site'], { stdio: 'inherit' });
}

/**
 * Writes the certificate the fake site uses, once per run.
 *
 * Generated here and never committed: no key material belongs in a repository that is going to be public, and a
 * certificate that outlived its run would only hide that it is throwaway. Two days is longer than any run and
 * short enough that a stale file cannot be reused by accident.
 */
function writeCertificate(): void {
  mkdirSync(TLS_DIR, { recursive: true });
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      TLS_KEY,
      '-out',
      TLS_CERT,
      '-days',
      '2',
      '-subj',
      `/CN=${FAKE_HOSTS[0]}`,
      '-addext',
      `subjectAltName=${FAKE_HOSTS.map((host) => `DNS:${host}`).join(',')}`,
    ],
    { stdio: 'inherit' },
  );
  chmodSync(TLS_KEY, 0o600);
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [resolve(import.meta.dirname, 'specs/**/*.e2e.ts')],
  maxInstances: 1,
  capabilities: capabilitiesForRun(),
  /** The visual service: screenshots, baselines and diffs, with its folders in `support/visual.ts`. */
  services: [['visual', visualServiceOptions()]],
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
    buildSite();
    writeCertificate();
    createVisualFolders();
  },

  async before() {
    // The fake site first: the browser is told where to find it, and the guard is what proves nothing else is
    // reachable. Firefox gets neither the mapping nor the certificate, so it only runs the smoke spec (D1).
    await startFakeSede();
    await startSiteServer();
    await networkGuard().attach([...FAKE_HOSTS, SITE_HOST]);

    if (browser.capabilities.browserName === 'firefox') {
      // Temporary install: unsigned is fine, and nothing survives the session.
      const zip = readFileSync(firefoxExtensionZip()).toString('base64');
      await browser.installAddOn(zip, true);
    }
  },

  /** Each test starts with nothing reported: what a test asks for is what it answers for. */
  beforeTest() {
    networkGuard().reset();
  },

  /** The run's network summary, and the fake site put down again. */
  async after() {
    console.log(networkGuard().summary());
    await stopFakeSede();
    await stopSiteServer();
  },
};
