import { browser, expect } from '@wdio/globals';
import { failOnLeakedRequest } from '../support/guard-hooks';
import { siteUrl } from '../support/site-server';

failOnLeakedRequest();

type Mode = 'auto' | 'light' | 'dark';
type Scheme = Exclude<Mode, 'auto'>;
const STORAGE_KEY = 'naciocheck-theme';
const COLORS = {
  light: { background: 'rgb(255, 255, 255)', chrome: '#ffffff' },
  dark: { background: 'rgb(17, 24, 39)', chrome: '#111827' },
};

async function open(path: string): Promise<void> {
  await browser.url(siteUrl(path));
  await browser.$('#site-theme').waitForDisplayed();
}

async function clearPreference(): Promise<void> {
  await browser.execute((key: string) => localStorage.removeItem(key), STORAGE_KEY);
}

async function choose(mode: Mode): Promise<void> {
  await browser.$('#site-theme').selectByAttribute('value', mode);
}

function readTheme() {
  return browser.execute(() => {
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    const bodyStyle = getComputedStyle(document.body);
    const chromeColors = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
      .filter((meta) => matchMedia(meta.media).matches)
      .map((meta) => meta.content);
    const visibleLogos = [...document.querySelectorAll<HTMLImageElement>('.site-logo img')]
      .filter((img) => getComputedStyle(img).display !== 'none')
      .map((img) => new URL(img.src).pathname);
    return {
      override: root.dataset.theme ?? null,
      background: bodyStyle.backgroundColor,
      colorScheme: rootStyle.colorScheme,
      chromeColors,
      visibleLogos,
      bodyColorScheme: bodyStyle.colorScheme,
      backgroundToken: bodyStyle.getPropertyValue('--bg').trim(),
      rootBackgroundToken: rootStyle.getPropertyValue('--bg').trim(),
      prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
      print: matchMedia('print').matches,
    };
  });
}

async function expectTheme(mode: Mode, scheme: Scheme): Promise<void> {
  await expect(browser.$('#site-theme')).toHaveValue(mode);
  // Drive a headless Chromium frame before sampling scheme-dependent computed colors.
  await browser.takeScreenshot();
  const expected = {
    override: mode === 'auto' ? null : mode,
    background: COLORS[scheme].background,
    colorScheme: mode === 'auto' ? 'light dark' : scheme,
    chromeColor: COLORS[scheme].chrome,
    logo: `/img/logo-${scheme}.svg`,
  };
  let last: Awaited<ReturnType<typeof readTheme>> | undefined;
  try {
    await browser.waitUntil(
      async () => {
        last = await readTheme();
        return (
          last.override === expected.override &&
          last.background === expected.background &&
          last.colorScheme === expected.colorScheme &&
          last.chromeColors.length === 1 &&
          last.chromeColors[0] === expected.chromeColor &&
          last.visibleLogos.length === 1 &&
          last.visibleLogos[0] === expected.logo
        );
      },
      { timeout: 2_000, interval: 50 },
    );
  } catch (cause) {
    throw new Error(
      `Theme did not settle for ${mode} in ${scheme}: ${JSON.stringify({ expected, last })}`,
      { cause },
    );
  }
}

describe('site theme selection', () => {
  // Feedback is tested offline in tests/feedback-page.test.ts because its script resources
  // are intentionally unreachable here.
  beforeEach(async () => {
    await open('/');
    await clearPreference();
  });

  afterEach(async () => {
    await clearPreference();
  });

  it('saves explicit overrides across reloads, languages, page types and nested 404s', async () => {
    const restore = await browser.emulate('colorScheme', 'light');
    try {
      await open('/');
      await expectTheme('auto', 'light');
      await choose('dark');
      await expectTheme('dark', 'dark');
      await browser.refresh();
      await expectTheme('dark', 'dark');
      await browser.$('.lang-switch a[hreflang="en"]').click();
      await expectTheme('dark', 'dark');
      expect(await browser.execute(() => document.documentElement.lang)).toBe('en');
      await open('/ca/privacy/');
      await expectTheme('dark', 'dark');
      await open('/en/changelog/');
      await expectTheme('dark', 'dark');
      await open('/ca/level/nonexistent');
      await expectTheme('dark', 'dark');
      expect(await browser.execute(() => document.documentElement.lang)).toBe('ca');
    } finally {
      await restore();
    }
  });

  it('follows live system changes in Auto and keeps an explicit Light choice under Dark', async () => {
    let restore = await browser.emulate('colorScheme', 'light');
    try {
      await open('/en/privacy/');
      await expectTheme('auto', 'light');
      restore = await browser.emulate('colorScheme', 'dark');
      await expectTheme('auto', 'dark');
      await choose('light');
      await expectTheme('light', 'light');
      await open('/ca/');
      await expectTheme('light', 'light');
      await choose('auto');
      await expectTheme('auto', 'dark');
      restore = await browser.emulate('colorScheme', 'light');
      await expectTheme('auto', 'light');
    } finally {
      await restore();
    }
  });
});
