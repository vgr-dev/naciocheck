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

/** The footer switcher's three radios, in their fixed order. */
const MODES: Mode[] = ['auto', 'light', 'dark'];

/** One radio of the switcher: the real native input, which is what a pointer or a key reaches. */
const radio = (mode: Mode) => browser.$(`.site-footer input[name="site-theme"][value="${mode}"]`);

async function open(path: string): Promise<void> {
  await browser.url(siteUrl(path));
  // The switcher stays hidden until the script is ready, so this also waits for the bootstrap.
  await browser.$('.site-footer .theme-switch').waitForDisplayed();
}

async function clearPreference(): Promise<void> {
  await browser.execute((key: string) => localStorage.removeItem(key), STORAGE_KEY);
}

/** Picks a mode the way a person does: a pointer click on its segment. */
async function choose(mode: Mode): Promise<void> {
  const input = await radio(mode);
  await input.scrollIntoView({ block: 'center' });
  await input.click();
}

/** The values of every checked radio of the switcher. */
function checkedModes(): Promise<string[]> {
  return browser.execute(() =>
    [...document.querySelectorAll<HTMLInputElement>('input[name="site-theme"]')]
      .filter((input) => input.checked)
      .map((input) => input.value),
  );
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
  await expect(radio(mode)).toBeChecked();
  expect(await checkedModes()).toEqual([mode]);
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
  // The feedback pages (and their footer switcher) are tested offline in tests/feedback-page.test.ts
  // because their script resources are intentionally unreachable here.
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

const NAMES: Record<string, { group: string; modes: [string, string, string] }> = {
  '/': { group: 'Tema', modes: ['Automático', 'Claro', 'Oscuro'] },
  '/en/': { group: 'Theme', modes: ['Auto', 'Light', 'Dark'] },
  '/ca/': { group: 'Tema', modes: ['Automàtic', 'Clar', 'Fosc'] },
};

/** The footer switcher is a real control: native radios, named, in the footer, never in the header. */
describe('site theme switcher', () => {
  beforeEach(async () => {
    await open('/');
    await clearPreference();
  });

  afterEach(async () => {
    await clearPreference();
  });

  for (const [path, names] of Object.entries(NAMES)) {
    it(`names the group and each option in ${path}`, async () => {
      await open(path);
      const group = await browser.$('.site-footer fieldset.theme-switch');
      expect(await group.getComputedRole()).toBe('group');
      expect(await group.getComputedLabel()).toBe(names.group);
      for (const [index, mode] of MODES.entries()) {
        const input = await radio(mode);
        expect(await input.getComputedRole()).toBe('radio');
        expect(await input.getComputedLabel()).toBe(names.modes[index]);
      }
      // The icons add nothing to the names: they are hidden from assistive technology.
      const icons = await browser.execute(() =>
        [...document.querySelectorAll('.theme-switch svg')].map((svg) => ({
          hidden: svg.getAttribute('aria-hidden'),
          focusable: svg.getAttribute('focusable'),
          stroke: svg.getAttribute('stroke'),
        })),
      );
      expect(icons).toEqual(
        MODES.map(() => ({ hidden: 'true', focusable: 'false', stroke: 'currentColor' })),
      );
    });
  }

  for (const path of ['/', '/en/privacy/', '/ca/changelog/', '/ca/level/nonexistent']) {
    it(`keeps the control in the footer, not the header, with one radio checked on ${path}`, async () => {
      await open(path);
      const where = await browser.execute(() => ({
        inHeader: document.querySelectorAll(
          'header select, header input, header fieldset, header .theme-switch, #site-theme',
        ).length,
        inFooter: document.querySelectorAll('.site-footer .theme-switch input[type="radio"]')
          .length,
        groups: document.querySelectorAll('.theme-switch').length,
        names: [
          ...new Set(
            [...document.querySelectorAll<HTMLInputElement>('.theme-switch input')].map(
              (i) => i.name,
            ),
          ),
        ],
      }));
      expect(where).toEqual({ inHeader: 0, inFooter: 3, groups: 1, names: ['site-theme'] });
      expect(await checkedModes()).toEqual(['auto']);
    });
  }

  it('sizes the segments for a finger and lays them out in one row, after the footer links', async () => {
    await open('/en/');
    const layout = await browser.execute(() => {
      const options = [...document.querySelectorAll<HTMLElement>('.theme-option')];
      const boxes = options.map((option) => option.getBoundingClientRect());
      const inputs = options.map((option) =>
        option.querySelector('input')?.getBoundingClientRect(),
      );
      const group = document.querySelector('.theme-switch')?.getBoundingClientRect();
      return {
        sizes: boxes.map((box) => [box.width, box.height]),
        inputSizes: inputs.map((box) => [box?.width, box?.height]),
        sameRow: new Set(boxes.map((box) => Math.round(box.top))).size,
        touch: options.map((option) => getComputedStyle(option).touchAction),
        groupBorder: group
          ? getComputedStyle(document.querySelector('.theme-switch')!).borderTopWidth
          : '',
        iconBox: [...document.querySelectorAll('.theme-option svg')].map(
          (svg) => svg.getBoundingClientRect().width,
        ),
      };
    });
    for (const [width, height] of [...layout.sizes, ...layout.inputSizes]) {
      expect(width).toBeGreaterThanOrEqual(32);
      expect(height).toBeGreaterThanOrEqual(32);
    }
    expect(layout.sameRow).toBe(1);
    expect(layout.touch).toEqual(['manipulation', 'manipulation', 'manipulation']);
    expect(layout.groupBorder).toBe('1px');
    expect(layout.iconBox).toEqual([20, 20, 20]);
  });

  it('moves and selects with the arrow keys, and rings only the keyboard-focused segment', async () => {
    const restore = await browser.emulate('colorScheme', 'light');
    try {
      await open('/en/');
      await choose('auto');
      await expectTheme('auto', 'light');
      // A pointer focus is not a keyboard focus: no ring after the click.
      const ring = () =>
        browser.execute(() => {
          const active = document.activeElement as HTMLInputElement | null;
          const label = active?.closest('.theme-option');
          return {
            value: active?.value ?? null,
            labelOutline: label ? getComputedStyle(label).outlineWidth : null,
            labelOutlineStyle: label ? getComputedStyle(label).outlineStyle : null,
            inputOutlineStyle: active ? getComputedStyle(active).outlineStyle : null,
          };
        });
      expect(await ring()).toMatchObject({ value: 'auto', labelOutlineStyle: 'none' });

      await browser.keys(['ArrowRight']);
      await expectTheme('light', 'light');
      expect(await ring()).toEqual({
        value: 'light',
        labelOutline: '3px',
        labelOutlineStyle: 'solid',
        inputOutlineStyle: 'none',
      });
      await browser.keys(['ArrowRight']);
      await expectTheme('dark', 'dark');
      // The group does not wrap focus out of it by accident: the last radio goes round to the first.
      await browser.keys(['ArrowRight']);
      await expectTheme('auto', 'light');
      await browser.keys(['ArrowLeft']);
      await expectTheme('dark', 'dark');
      await browser.keys(['ArrowUp']);
      await expectTheme('light', 'light');
      await browser.keys(['ArrowDown']);
      await expectTheme('dark', 'dark');
      // The choice from the keyboard is the one saved.
      expect(await browser.execute((key: string) => localStorage.getItem(key), STORAGE_KEY)).toBe(
        'dark',
      );
      await browser.refresh();
      await browser.$('.site-footer .theme-switch').waitForDisplayed();
      await expectTheme('dark', 'dark');
    } finally {
      await restore();
    }
  });

  it('shows the checked segment by a fill and an edge, not by colour alone', async () => {
    await open('/en/');
    await choose('light');
    // Drive a frame so headless Chrome does not report a stale computed style.
    await browser.takeScreenshot();
    const [checked, unchecked] = await browser.execute(() =>
      ['light', 'dark'].map((mode) => {
        const input = document.querySelector<HTMLInputElement>(
          `input[name="site-theme"][value="${mode}"]`,
        )!;
        const style = getComputedStyle(input);
        return { background: style.backgroundColor, shadow: style.boxShadow };
      }),
    );
    expect(checked?.shadow).not.toBe('none');
    expect(unchecked?.shadow).toBe('none');
    expect(checked?.background).not.toBe(unchecked?.background);
  });

  it('keeps the footer switcher visible and operable at a phone width', async () => {
    await browser.setWindowSize(390, 800);
    try {
      await open('/ca/');
      await choose('dark');
      await expectTheme('dark', 'dark');
      const fits = await browser.execute(() => {
        const box = document.querySelector('.theme-switch')!.getBoundingClientRect();
        return {
          right: box.right <= window.innerWidth,
          scroll: document.documentElement.scrollWidth <= window.innerWidth,
        };
      });
      expect(fits).toEqual({ right: true, scroll: true });
    } finally {
      await browser.setWindowSize(1280, 900);
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
            await expect(radio(stored)).toBeChecked();
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

  for (const scheme of ['light', 'dark'] as const) {
    it(`outlines only the checked segment with Highlight in the ${scheme} forced palette`, async () => {
      const restore = await emulateForced(scheme);
      try {
        await open('/en/');
        await choose('light');
        // Drive a frame so the emulated palette is applied before sampling computed styles.
        await browser.takeScreenshot();
        const read = () =>
          browser.execute(() => {
            const probe = document.createElement('span');
            probe.style.color = 'Highlight';
            document.body.append(probe);
            const highlight = getComputedStyle(probe).color;
            probe.remove();
            return {
              forced: matchMedia('(forced-colors: active)').matches,
              highlight,
              segments: [
                ...document.querySelectorAll<HTMLInputElement>('input[name="site-theme"]'),
              ].map((input) => {
                const style = getComputedStyle(input);
                return {
                  value: input.value,
                  checked: input.checked,
                  outline: `${style.outlineStyle} ${style.outlineWidth}`,
                  outlineColor: style.outlineColor,
                  offset: style.outlineOffset,
                };
              }),
            };
          });
        let last: Awaited<ReturnType<typeof read>> | undefined;
        try {
          await browser.waitUntil(
            async () => {
              last = await read();
              return last.forced;
            },
            { timeout: 2_000, interval: 50 },
          );
        } catch (cause) {
          throw new Error(`Forced colours did not apply: ${JSON.stringify(last)}`, { cause });
        }
        const result = await read();
        for (const segment of result.segments) {
          if (segment.checked) {
            expect(segment.value).toBe('light');
            expect(segment.outline).toBe('solid 2px');
            expect(segment.outlineColor).toBe(result.highlight);
            expect(segment.offset).toBe('-2px');
          } else {
            expect(segment.outline).not.toMatch(/^solid/);
          }
        }
        expect(result.segments.filter((segment) => segment.checked)).toHaveLength(1);
      } finally {
        await restore();
      }
    });
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
