import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { browser } from '@wdio/globals';

/**
 * The tests load what WXT built, never `src/`: the same artefact `npm run check:privacy` scans, with the
 * manifest exactly as shipped — no test-only permissions, no host patterns, no `key`.
 */
export const OUTPUT_DIR = resolve('.output');
export const CHROME_BUILD_DIR = join(OUTPUT_DIR, 'chrome-mv3');
export const FIREFOX_BUILD_DIR = join(OUTPUT_DIR, 'firefox-mv3');

/**
 * The add-on id can never change after the first upload to addons.mozilla.org (`brand/README.md`,
 * `GECKO_ID` in `wxt.config.ts`). `onPrepare` fails the run when the build disagrees with this constant.
 */
export const GECKO_ID = 'naciocheck@vgr.cat';

/**
 * The `extensions.webextensions.uuids` pref pins `moz-extension://<uuid>/` for the add-on, so a test can
 * open an extension page without discovering a per-profile UUID. Mozilla's own tests use this pref; it is
 * not a public interface, so it is pinned here explicitly instead of being assumed.
 */
export const FIREFOX_EXTENSION_UUID = '2f7b9c46-1d3e-4a58-9b60-7c8e5f1a2d39';

/**
 * Chrome derives the id of an unpacked extension from the absolute path it was loaded from: the first
 * 16 bytes of its SHA-256, each hex digit mapped `0-9` → `a-j` and `a-f` → `k-p`. Deriving it here keeps
 * the manifest free of a `key`, which would change what the stores receive.
 */
export function chromeExtensionId(absoluteDir: string): string {
  const digest = createHash('sha256').update(absoluteDir, 'utf8').digest('hex').slice(0, 32);
  return [...digest]
    .map((nibble) => String.fromCharCode(nibble.charCodeAt(0) + (nibble <= '9' ? 49 : 10)))
    .join('');
}

/** The origin of the extension's own pages in the running browser. */
export function extensionBaseUrl(browserName: string | undefined): string {
  if (browserName === 'firefox') return `moz-extension://${FIREFOX_EXTENSION_UUID}`;
  if (browserName === 'chrome') return `chrome-extension://${chromeExtensionId(CHROME_BUILD_DIR)}`;
  throw new Error(`The E2E suite only knows chrome and firefox, not '${String(browserName)}'.`);
}

/** The absolute URL of one of the extension's pages, e.g. `popup.html`. */
export function extensionPageUrl(browserName: string | undefined, page: string): string {
  return `${extensionBaseUrl(browserName)}/${page}`;
}

/**
 * The archive geckodriver installs. WXT writes `<package>-<version>-firefox.zip` next to the builds; the
 * newest one wins, so a stale zip from an earlier version cannot be picked up by accident.
 */
export function firefoxExtensionZip(): string {
  const zips = existsSync(OUTPUT_DIR)
    ? readdirSync(OUTPUT_DIR)
        .filter((name) => name.endsWith('-firefox.zip'))
        .map((name) => join(OUTPUT_DIR, name))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    : [];
  const [newest] = zips;
  if (newest === undefined) {
    throw new Error(
      `No Firefox zip in ${OUTPUT_DIR}. Build it first: npm run build:firefox and npx wxt zip -b firefox.`,
    );
  }
  return newest;
}

/** The URLs of every open tab and window, taken before a test opens one of its own. */
export async function openPageUrls(): Promise<string[]> {
  const urls: string[] = [];
  for (const context of await browser.browsingContexts()) {
    const url = await urlOf(context);
    if (url !== null) urls.push(url);
  }
  return urls;
}

/**
 * Waits for a tab or window that was not open in `before` and that points at `prefix`.
 *
 * A test must not mistake a window an earlier test left behind for the one it just opened, so it takes the
 * snapshot first and only what is new is returned.
 */
export async function waitForNewPage(
  prefix: string,
  before: readonly string[],
  timeoutMsg: string,
): Promise<WebdriverIO.BrowsingContext> {
  return browser.waitUntil(
    async () => {
      const contexts = await browser.browsingContexts();
      const known = [...before];
      let found: WebdriverIO.BrowsingContext | undefined;
      for (const context of contexts) {
        const url = await urlOf(context);
        if (url === null) continue;
        const already = known.indexOf(url);
        if (already !== -1) {
          known.splice(already, 1);
          continue;
        }
        if (found === undefined && url.startsWith(prefix)) found = context;
      }
      return found ?? false;
    },
    { timeoutMsg },
  );
}

/** The URLs of the tabs and windows opened after the `before` snapshot: what the test's own action opened. */
export async function newPageUrls(before: readonly string[]): Promise<string[]> {
  const known = [...before];
  const opened: string[] = [];
  for (const context of await browser.browsingContexts()) {
    const url = await urlOf(context);
    if (url === null) continue;
    const already = known.indexOf(url);
    if (already === -1) {
      opened.push(url);
      continue;
    }
    known.splice(already, 1);
  }
  return opened;
}

/** Waits until one tab or window points at `prefix` by itself, without opening another. */
export async function waitForPageUrl(
  context: WebdriverIO.BrowsingContext,
  prefix: string,
  timeoutMsg: string,
): Promise<void> {
  await browser.waitUntil(async () => (await context.getUrl()).startsWith(prefix), { timeoutMsg });
}

/**
 * One of the extension's own pages, in a tab the suite holds on to, navigated to `page`.
 *
 * Every command goes to that tab, never to the session's current one: the popup closes its own window as soon
 * as a run starts, and a session whose current tab is gone cannot navigate anything afterwards. The tab is
 * picked once — from the pages the extension opens itself, never from one that closes itself — and reused, so
 * a stale window left behind by an earlier test is never mistaken for it.
 */
let driverContext: WebdriverIO.BrowsingContext | undefined;

/** Pages that close their own window: they must never become the tab the suite drives. */
const SELF_CLOSING_PAGES = ['/popup.html', '/unlock.html'];

export async function openExtensionContext(page: string): Promise<WebdriverIO.BrowsingContext> {
  const url = extensionPageUrl(browser.capabilities.browserName, page);
  const driver = driverContext ?? (await pickDriverContext());
  driverContext = driver;
  await driver.navigate(url);
  return driver;
}

async function pickDriverContext(): Promise<WebdriverIO.BrowsingContext> {
  const base = extensionBaseUrl(browser.capabilities.browserName);
  for (const context of await browser.browsingContexts()) {
    const url = await urlOf(context);
    if (url === null || !url.startsWith(base)) continue;
    if (SELF_CLOSING_PAGES.some((closing) => url.endsWith(closing))) continue;
    return context;
  }
  const before = await openPageUrls();
  await browser.newWindow(extensionPageUrl(browser.capabilities.browserName, 'options.html'));
  return waitForNewPage(
    extensionPageUrl(browser.capabilities.browserName, 'options.html'),
    before,
    'The options page did not open',
  );
}

/** A context's URL, or `null` when the tab is already gone. */
async function urlOf(context: WebdriverIO.BrowsingContext): Promise<string | null> {
  try {
    return await context.getUrl();
  } catch {
    return null;
  }
}

/** Fails the run when the Firefox build and this module disagree about the add-on id. */
export function assertGeckoIdMatchesBuild(): void {
  const manifest = JSON.parse(readFileSync(join(FIREFOX_BUILD_DIR, 'manifest.json'), 'utf8')) as {
    browser_specific_settings?: { gecko?: { id?: string } };
  };
  const built = manifest.browser_specific_settings?.gecko?.id;
  if (built !== GECKO_ID) {
    throw new Error(
      `The Firefox build declares gecko id '${String(built)}' but the E2E suite pins '${GECKO_ID}'.`,
    );
  }
}
