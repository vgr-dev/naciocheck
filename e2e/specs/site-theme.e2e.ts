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

/**
 * Forced colours (Windows high contrast) replace the page palette with the system one. The wordmark must
 * follow that palette, whatever theme is stored; the language cue must not rely on colour alone.
 * The system scheme and the forced palette are emulated together so they agree, as they do on a real system.
 */
describe('site theme under forced colours', () => {
  beforeEach(async () => {
    await open('/');
    await clearPreference();
  });

  afterEach(async () => {
    await clearPreference();
  });

  async function emulateForced(scheme: Scheme): Promise<() => Promise<void>> {
    const restoreScheme = await browser.emulate('colorScheme', scheme);
    const restoreForced = await browser.emulate('forcedColors', scheme);
    return async () => {
      await restoreForced();
      await restoreScheme();
    };
  }

  function readForcedLogos() {
    return browser.execute(() => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'Canvas';
      document.body.append(probe);
      const canvas = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const channels = canvas.match(/\d+(?:\.\d+)?/g) ?? [];
      const [red = 0, green = 0, blue = 0] = channels.map(Number);
      const visible = [
        ...document.querySelectorAll<HTMLImageElement>('img.logo-for-light, img.logo-for-dark'),
      ]
        .filter((img) => getComputedStyle(img).display !== 'none')
        .map((img) => new URL(img.src).pathname);
      return {
        forced: matchMedia('(forced-colors: active)').matches,
        prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
        canvas,
        canvasIsDark: 0.2126 * red + 0.7152 * green + 0.0722 * blue < 128,
        stored: document.documentElement.dataset.theme ?? null,
        visible,
        total: document.querySelectorAll('img.logo-for-light, img.logo-for-dark').length,
      };
    });
  }

  for (const scheme of ['light', 'dark'] as const) {
    for (const stored of ['auto', 'light', 'dark'] as const) {
      it(`shows only the wordmark that suits the ${scheme} forced palette with ${stored} stored`, async () => {
        const restore = await emulateForced(scheme);
        try {
          for (const path of ['/en/', '/en/privacy/']) {
            await open(path);
            await choose(stored);
            await expect(browser.$('#site-theme')).toHaveValue(stored);
            // Drive a frame so the emulated palette is applied before sampling computed styles.
            await browser.takeScreenshot();
            let last: Awaited<ReturnType<typeof readForcedLogos>> | undefined;
            try {
              await browser.waitUntil(
                async () => {
                  last = await readForcedLogos();
                  return (
                    last.forced &&
                    last.canvasIsDark === (scheme === 'dark') &&
                    last.visible.length > 0
                  );
                },
                { timeout: 2_000, interval: 50 },
              );
            } catch (cause) {
              throw new Error(
                `Forced palette did not settle for ${scheme} with ${stored} on ${path}: ${JSON.stringify(last)}`,
                { cause },
              );
            }
            const result = await readForcedLogos();
            expect(result.stored).toBe(stored === 'auto' ? null : stored);
            // One variant per wordmark: the header, and on the landing page the hero as well.
            expect(result.visible).toHaveLength(result.total / 2);
            expect(result.visible.length).toBe(path === '/en/' ? 2 : 1);
            // A light palette gets the dark-ink wordmark; a dark palette gets the light one.
            for (const logo of result.visible) expect(logo).toBe(`/img/logo-${scheme}.svg`);
          }
        } finally {
          await restore();
        }
      });
    }
  }

  function readLanguageCue() {
    return browser.execute(() => {
      const links = [...document.querySelectorAll<HTMLAnchorElement>('.lang-switch a')];
      const styleOf = (link: HTMLAnchorElement) => {
        const style = getComputedStyle(link);
        return {
          weight: Number(style.fontWeight),
          underline: style.textDecorationLine.includes('underline'),
          thickness: style.textDecorationThickness,
          touchAction: style.touchAction,
        };
      };
      const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
      const others = links.filter((link) => link.getAttribute('aria-current') !== 'page');
      return {
        currentLangs: current.map((link) => link.hreflang),
        current: current[0] ? styleOf(current[0]) : null,
        others: others.map(styleOf),
        forced: matchMedia('(forced-colors: active)').matches,
      };
    });
  }

  async function expectLanguageCue(forced: boolean): Promise<void> {
    // Park the pointer away from the links: hovering a link underlines it.
    await browser.$('main').moveTo({ xOffset: 0, yOffset: 0 });
    await browser.takeScreenshot();
    const cue = await readLanguageCue();
    expect(cue.forced).toBe(forced);
    expect(cue.currentLangs).toEqual(['en']);
    expect(cue.current?.underline).toBe(true);
    expect(cue.current?.thickness).toBe('2px');
    expect(cue.current?.weight).toBeGreaterThanOrEqual(700);
    expect(cue.others).toHaveLength(2);
    for (const other of cue.others) {
      expect(other.weight).toBeLessThan(cue.current?.weight ?? 0);
      expect(other.underline).toBe(false);
    }
    for (const link of [cue.current, ...cue.others]) expect(link?.touchAction).toBe('manipulation');
  }

  for (const scheme of ['light', 'dark'] as const) {
    it(`marks the current language by weight and underline, not colour alone, in the ${scheme} theme`, async () => {
      const restore = await browser.emulate('colorScheme', scheme);
      try {
        await open('/en/');
        await choose(scheme);
        await expectTheme(scheme, scheme);
        await expectLanguageCue(false);
      } finally {
        await restore();
      }
    });

    it(`keeps that cue in the ${scheme} forced palette`, async () => {
      const restore = await emulateForced(scheme);
      try {
        await open('/en/');
        await expectLanguageCue(true);
      } finally {
        await restore();
      }
    });
  }
});
