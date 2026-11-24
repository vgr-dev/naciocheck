import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The site's shared stylesheet (`site/_build/partials/base.css`) defines its paired colour tokens on `:root`.
 * This test reads both modes and the light fallback and checks WCAG 2.2 AA for
 * every pairing the stylesheet uses: 4.5:1 for text, 3:1 for focus rings and control boundaries. A new
 * pairing in the CSS needs a new line in `PAIRS`.
 */

const CSS = readFileSync(resolve(import.meta.dirname, '../site/_build/partials/base.css'), 'utf8');
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const PALETTE = /^:root\s*\{([^}]*)\}/m.exec(SOURCE)?.[1] ?? '';
const FALLBACK =
  /@supports not \(color: light-dark\(#000, #fff\)\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/.exec(
    SOURCE,
  )?.[1] ?? '';
const PALETTE_ENTRIES = [
  ...PALETTE.matchAll(
    /--([\w-]+)\s*:\s*light-dark\(\s*(#[\da-f]{6})\s*,\s*(#[\da-f]{6})\s*\)\s*;/gi,
  ),
];
const THEMES = {
  light: new Map(PALETTE_ENTRIES.map(([, name = '', light = '']) => [name, light.toLowerCase()])),
  dark: new Map(PALETTE_ENTRIES.map(([, name = '', , dark = '']) => [name, dark.toLowerCase()])),
} as const;

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;

/** [foreground token, background token, minimum ratio, where the pair appears] */
const PAIRS: [string, string, number, string][] = [
  ['fg', 'bg', TEXT, 'body text'],
  ['fg', 'band', TEXT, 'text on a band and in the footer'],
  ['fg', 'surface', TEXT, 'text in cards, the textarea and a coming-soon label'],
  ['fg', 'code-bg', TEXT, 'inline code'],
  ['muted', 'bg', TEXT, 'lead, tagline, hints, language links'],
  ['muted', 'band', TEXT, 'footer text'],
  ['muted', 'surface', TEXT, 'the coming-soon note'],
  ['heading', 'bg', TEXT, 'section headings'],
  ['heading', 'band', TEXT, 'section headings on a band'],
  ['accent', 'bg', TEXT, 'links'],
  ['accent', 'band', TEXT, 'links on a band and in the footer'],
  ['accent', 'surface', TEXT, 'links in cards and the secondary button'],
  ['accent-hover', 'bg', TEXT, 'hovered links'],
  ['accent-hover', 'band', TEXT, 'hovered links and secondary button on a band'],
  ['accent-hover', 'surface', TEXT, 'hovered links in cards'],
  ['accent-soft-fg', 'accent-soft', TEXT, 'the current language and selected text'],
  ['button-fg', 'button-bg', TEXT, 'buttons, install buttons and the skip link'],
  ['button-fg', 'button-bg-hover', TEXT, 'hovered buttons'],
  ['focus', 'bg', NON_TEXT, 'focus ring'],
  ['focus', 'band', NON_TEXT, 'focus ring on a band and in the footer'],
  ['focus', 'surface', NON_TEXT, 'focus ring in cards'],
  ['control-border', 'bg', NON_TEXT, 'the coming-soon and secondary button boundary'],
  ['control-border', 'surface', NON_TEXT, 'the textarea boundary'],
  ['button-bg', 'bg', NON_TEXT, 'a button against the page'],
  ['button-bg', 'band', NON_TEXT, 'a button against a band'],
  // The theme switcher in the footer (a band): its boundary and its icons, at rest, hovered and checked.
  ['control-border', 'band', NON_TEXT, 'the theme switcher boundary'],
  ['muted', 'band', NON_TEXT, 'a theme icon at rest'],
  ['muted', 'surface', NON_TEXT, 'a theme icon on its hover surface'],
  ['fg', 'surface', NON_TEXT, 'a hovered theme icon on its hover surface'],
  ['accent-soft-fg', 'accent-soft', NON_TEXT, 'the checked theme icon'],
  ['accent', 'accent-soft', NON_TEXT, 'the checked theme segment edge'],
];

describe('site colour tokens', () => {
  it('defines each paired colour once', () => {
    expect(PALETTE_ENTRIES.length).toBeGreaterThan(10);
    expect(THEMES.light.size).toBe(PALETTE_ENTRIES.length);
    expect(
      PALETTE.replaceAll(/light-dark\(\s*#[\da-f]{6}\s*,\s*#[\da-f]{6}\s*\)/gi, ''),
    ).not.toMatch(/#(?:[\da-f]{3}){1,2}\b/i);
  });

  it('uses the same palette and native scheme in the light fallback', () => {
    const fallbackColours = new Map(
      [...FALLBACK.matchAll(/--([\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(
        ([, name = '', colour = '']) => [name, colour.toLowerCase()],
      ),
    );
    expect(fallbackColours).toEqual(THEMES.light);
    expect(FALLBACK).toMatch(/color-scheme:\s*light\s*;/);
  });

  it('keeps the brand teal for links and buttons (brand/README.md)', () => {
    expect(THEMES.light.get('accent')).toBe('#0f766e');
    expect(THEMES.light.get('button-bg')).toBe('#0f766e');
    expect(THEMES.dark.get('accent')).toBe('#5eead4');
  });

  it('names every token PAIRS uses', () => {
    for (const [foreground, background] of PAIRS) {
      expect(THEMES.light.has(foreground), foreground).toBe(true);
      expect(THEMES.light.has(background), background).toBe(true);
    }
  });

  for (const theme of ['light', 'dark'] as const) {
    it.each(PAIRS)(`${theme}: %s on %s reaches %s:1 (%s)`, (foreground, background, minimum) => {
      const tokens = THEMES[theme];
      const ratio = contrast(tokens.get(foreground) ?? '', tokens.get(background) ?? '');
      expect(
        ratio,
        `${foreground} on ${background} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(minimum);
    });
  }
});

describe('site stylesheet rules', () => {
  const supportGuard = '@supports (color: light-dark(#000, #fff))';
  const [withoutSupport = '', withSupport = ''] = SOURCE.split(supportGuard);
  const outsideTokens = SOURCE.replace(PALETTE, '')
    .replace(FALLBACK, '')
    .replaceAll(/light-dark\(#000, #fff\)/g, '');

  it('uses colours only through the tokens', () => {
    expect(outsideTokens).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(outsideTokens).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });

  it('matches the wordmark and native scheme to the effective palette', () => {
    expect(PALETTE).toMatch(/color-scheme:\s*light dark\s*;/);
    expect(withoutSupport).toMatch(/:root \.logo-for-dark\s*\{\s*display:\s*none\s*;/);
    expect(withoutSupport).not.toMatch(/:root\[data-theme|\.logo-for-light/);
    expect(withSupport).toMatch(/:root\[data-theme='light'\]\s*\{\s*color-scheme:\s*light\s*;/);
    expect(withSupport).toMatch(/:root\[data-theme='dark'\]\s*\{\s*color-scheme:\s*dark\s*;/);
    expect(withSupport).toMatch(
      /:root\[data-theme='dark'\] \.logo-for-light\s*\{\s*display:\s*none;/,
    );
    expect(withSupport).toMatch(
      /:root\[data-theme='dark'\] \.logo-for-dark\s*\{\s*display:\s*block;/,
    );
    expect(withSupport).toMatch(
      /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme\]\) \.logo-for-light\s*\{\s*display:\s*none;\s*\}\s*:root:not\(\[data-theme\]\) \.logo-for-dark\s*\{\s*display:\s*block;/,
    );
  });

  it('picks the wordmark from the forced palette, not a stored theme, in forced colours', () => {
    const forced =
      /@media \(forced-colors: active\)\s*\{([\s\S]*?\n {2}\})\s*\}/.exec(withSupport)?.[1] ?? '';
    // Always shown or hidden by the palette's scheme: the selector matches with or without data-theme.
    expect(forced).toMatch(
      /:root:is\(\[data-theme\], :root\) \.logo-for-light\s*\{\s*display:\s*block;[^}]*\}\s*:root:is\(\[data-theme\], :root\) \.logo-for-dark\s*\{\s*display:\s*none;/,
    );
    expect(forced).toMatch(
      /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:is\(\[data-theme\], :root\) \.logo-for-light\s*\{\s*display:\s*none;[^}]*\}\s*:root:is\(\[data-theme\], :root\) \.logo-for-dark\s*\{\s*display:\s*block;/,
    );
    // No stored-theme selector without the `:is()` that also matches pages with no data-theme.
    expect(forced.replaceAll(':is([data-theme], :root)', '')).not.toMatch(/\[data-theme/);
    // The block comes after every rule it has to beat, so a tie in specificity goes to it.
    const forcedAt = withSupport.indexOf('@media (forced-colors: active)');
    expect(forcedAt).toBeGreaterThan(
      withSupport.lastIndexOf(":root[data-theme='dark'] .logo-for-dark"),
    );
    expect(forcedAt).toBeGreaterThan(
      withSupport.lastIndexOf(':root:not([data-theme]) .logo-for-dark'),
    );
  });

  it('marks the current language by more than colour and keeps touch-action on the links', () => {
    const rule = (selector: string) =>
      new RegExp(`${selector.replaceAll(/[[\]().']/g, String.raw`\$&`)}\\s*\\{([^}]*)\\}`).exec(
        SOURCE,
      )?.[1] ?? '';
    const current = rule(".lang-switch a[aria-current='page']");
    expect(current).toMatch(/font-weight:\s*700\s*;/);
    expect(current).toMatch(/text-decoration:\s*underline\s*;/);
    expect(current).toMatch(/text-decoration-thickness:\s*2px\s*;/);
    expect(current).toMatch(/background:\s*var\(--accent-soft\)\s*;/);
    expect(rule('.lang-switch a')).toMatch(/touch-action:\s*manipulation\s*;/);
  });

  describe('the theme switcher', () => {
    const rule = (selector: string) =>
      new RegExp(`${selector.replaceAll(/[[\]().'*:+^]/g, String.raw`\$&`)}\\s*\\{([^}]*)\\}`).exec(
        SOURCE,
      )?.[1] ?? '';

    it('has even segments of at least 32 by 32 px and a 1px control boundary', () => {
      const option = rule('.theme-option');
      for (const side of ['inline-size', 'block-size']) {
        const size = new RegExp(`${side}:\\s*([\\d.]+)rem`).exec(option)?.[1];
        expect(Number(size) * 16, side).toBeGreaterThanOrEqual(32);
      }
      expect(rule('.theme-switch')).toMatch(/border:\s*1px solid var\(--control-border\)/);
      expect(option).toMatch(/touch-action:\s*manipulation\s*;/);
    });

    it('marks the checked segment by a fill and an edge, not by colour alone', () => {
      const checked = rule('.theme-option input:checked');
      expect(checked).toMatch(/background:\s*var\(--accent-soft\)/);
      expect(checked).toMatch(/box-shadow:\s*inset 0 0 0 2px var\(--accent\)/);
      expect(rule('.theme-option input:checked + svg')).toMatch(/color:\s*var\(--accent-soft-fg\)/);
    });

    it('keeps hover quieter than checked', () => {
      const hover = rule('.theme-option input:not(:checked):hover');
      expect(hover).toMatch(/background:\s*var\(--surface\)/);
      expect(hover).not.toMatch(/box-shadow|accent/);
    });

    it('draws the focus ring round the segment on :focus-visible', () => {
      expect(SOURCE).toMatch(
        /@supports selector\(:has\(\*\)\)\s*\{[^@]*\.theme-option:has\(input:focus-visible\)\s*\{[^}]*outline:\s*3px solid var\(--focus\)/,
      );
    });

    it('stays hidden, with its space kept, until the script marks the root ready', () => {
      expect(rule(':root:not([data-theme-ready]) .theme-switch')).toMatch(
        /visibility:\s*hidden\s*;/,
      );
    });

    it('outlines the checked segment with Highlight under forced colours', () => {
      const forced = SOURCE.slice(SOURCE.lastIndexOf('@media (forced-colors: active)'));
      expect(forced).toMatch(
        /\.theme-option input:checked\s*\{[^}]*outline:\s*2px solid Highlight\s*;[^}]*outline-offset:\s*-2px/,
      );
    });

    it('hides the labels and legend from sight only, and the control from print', () => {
      const hidden = rule('.visually-hidden');
      expect(hidden).toMatch(/position:\s*absolute/);
      expect(hidden).toMatch(/clip-path:\s*inset\(50%\)/);
      expect(hidden).not.toMatch(/display:\s*none|visibility:\s*hidden/);
      expect(SOURCE).toMatch(/@media print\s*\{[^@]*\.theme-switch/);
    });
  });

  it('loads nothing: no url(), @import or @font-face', () => {
    expect(SOURCE).not.toMatch(/url\(/i);
    expect(SOURCE).not.toMatch(/@import/i);
    expect(SOURCE).not.toMatch(/@font-face/i);
  });

  it('names no build marker, which the build would try to expand inside the <style>', () => {
    expect(CSS).not.toContain('<!--');
  });

  it('draws a visible focus ring in the focus colour', () => {
    expect(SOURCE).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus\)/);
  });

  it('has a skip link and respects reduced motion', () => {
    expect(SOURCE).toMatch(/\.skip-link\s*\{/);
    expect(SOURCE).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    // Smooth scrolling and transitions are only switched on for people who have not asked for less.
    const outsideNoPreference = SOURCE.replace(
      /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]*\{[^}]*\})*\s*\}/g,
      '',
    );
    expect(outsideNoPreference).not.toMatch(/scroll-behavior:\s*smooth/);
    expect(outsideNoPreference).not.toMatch(/transition:\s*(?!none)/);
    expect(outsideNoPreference).not.toMatch(/animation:\s*(?!none)/);
  });

  it('uses logical properties, so a right-to-left page would mirror', () => {
    expect(SOURCE).not.toMatch(
      /\b(?:margin|padding|border)-(?:left|right|top|bottom)\b|(?:^|[\s;{])(?:left|right|top|bottom)\s*:|text-align:\s*(?:left|right)/m,
    );
  });

  it('styles the markup the build emits', () => {
    for (const selector of [
      '.site-header',
      '.site-logo',
      '.lang-switch',
      "[aria-current='page']",
      '.install',
      '.install.is-soon',
      '.site-footer',
      '.theme-switch',
      '.theme-option',
      '.visually-hidden',
    ]) {
      expect(SOURCE, selector).toContain(selector);
    }
  });
});
