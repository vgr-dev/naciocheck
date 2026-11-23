import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The site's shared stylesheet (`site/_build/partials/base.css`) defines its colours as tokens on `:root`, and
 * again under `@media (prefers-color-scheme: dark)`. This test reads both blocks and checks WCAG 2.2 AA for
 * every pairing the stylesheet uses: 4.5:1 for text, 3:1 for focus rings and control boundaries. A new
 * pairing in the CSS needs a new line in `PAIRS`.
 */

const CSS = readFileSync(resolve(import.meta.dirname, '../site/_build/partials/base.css'), 'utf8');
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const LIGHT_BLOCK = /^:root\s*\{([^}]*)\}/m.exec(SOURCE)?.[1] ?? '';
const DARK_BLOCK =
  /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/.exec(SOURCE)?.[1] ??
  '';

function colourTokens(block: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(match[1] ?? '', (match[2] ?? '').toLowerCase());
  }
  return tokens;
}

const THEMES = {
  light: colourTokens(LIGHT_BLOCK),
  dark: colourTokens(DARK_BLOCK),
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
];

describe('site colour tokens', () => {
  it('finds both theme blocks', () => {
    expect(THEMES.light.size).toBeGreaterThan(10);
    expect(THEMES.dark.size).toBeGreaterThan(10);
  });

  it('redefines every colour token for the dark theme, and adds none', () => {
    expect([...THEMES.dark.keys()].sort()).toEqual([...THEMES.light.keys()].sort());
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
  const outsideTokens = SOURCE.replace(LIGHT_BLOCK, '').replace(DARK_BLOCK, '');

  it('uses colours only through the tokens', () => {
    expect(outsideTokens).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(outsideTokens).not.toMatch(/\brgba?\(|\bhsla?\(/);
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
    ]) {
      expect(SOURCE, selector).toContain(selector);
    }
  });
});
