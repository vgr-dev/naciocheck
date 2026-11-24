import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAIN_PATH_STATES } from '../src/core/paths';

/**
 * The landing page sources in es, en and ca (`site/index.html`, `site/en/index.html`, `site/ca/index.html`),
 * read as they are written, before the build expands the markers. Each one must carry the seven sections of
 * the spec in order, the status teaser in the catalogue's order with its "not official" note, the install
 * marker, a clean heading outline, `alt` text on every image and no script. The landing stylesheet is checked
 * too: tokens only, nothing loaded, no section motion, and AA contrast for the colour pairs it adds on top of
 * base.css. The brand badge handles reduced motion within its SVG.
 */

const SITE = resolve(import.meta.dirname, '../site');

const PAGES = [
  {
    lang: 'es',
    file: 'index.html',
    notOfficial: /no oficial/i,
    agency: 'https://vgr.cat/es/',
    screens: 'es',
    tagline: 'Tu expediente de nacionalidad, al día.',
  },
  {
    lang: 'en',
    file: 'en/index.html',
    notOfficial: /not official/i,
    agency: 'https://vgr.cat/',
    screens: 'en',
    tagline: 'Your nationality application, up to date.',
  },
  {
    lang: 'ca',
    file: 'ca/index.html',
    notOfficial: /no oficial/i,
    agency: 'https://vgr.cat/ca/',
    // The extension has no Catalan locale yet, so the Catalan page shows the Spanish screenshots.
    screens: 'es',
    tagline: 'El teu expedient de nacionalitat, al dia.',
  },
] as const;

/** Sections 1–6 by id, in order; the seventh is the shared footer, which the footer marker brings in. */
const SECTION_IDS = ['hero', 'how-it-works', 'statuses', 'privacy', 'faq', 'agencies'];

function source(file: string): string {
  return readFileSync(resolve(SITE, file), 'utf8');
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe.each(PAGES)('the $lang landing page', (page) => {
  const html = source(page.file);
  const doc = parse(html);
  const main = doc.querySelector('main#main');

  it('is in its language and keeps the build markers for the shared parts', () => {
    expect(doc.documentElement.lang).toBe(page.lang);
    for (const marker of ['@head', '@style landing', '@header', '@install', '@footer']) {
      expect(html, marker).toContain(`<!-- ${marker} -->`);
    }
    expect(html.match(/<!-- @install -->/g)).toHaveLength(1);
  });

  it('has the seven sections in order: six by id inside main, then the footer', () => {
    expect(main).not.toBeNull();
    const ids = [...(main?.children ?? [])].map((child) => child.id);
    expect(ids).toEqual(SECTION_IDS);
    for (const id of SECTION_IDS) expect(doc.getElementById(id)?.tagName, id).toBe('SECTION');

    // The footer marker follows the agency band and closes the page.
    const agencies = html.indexOf('id="agencies"');
    const footer = html.indexOf('<!-- @footer -->');
    expect(agencies).toBeGreaterThan(-1);
    expect(footer).toBeGreaterThan(agencies);
    expect(footer).toBeGreaterThan(html.indexOf('</main>'));
  });

  it('puts the install marker, the animated icon, the logo and the tagline in the hero', () => {
    const hero = html.slice(html.indexOf('id="hero"'), html.indexOf('id="how-it-works"'));
    expect(hero).toContain('<!-- @install -->');
    expect(hero).toContain('src="/img/icon-animated.svg"');
    const wordmark = doc.querySelector('#hero .hero-wordmark[translate="no"]');
    for (const theme of ['light', 'dark']) {
      const logo = wordmark?.querySelector(`.logo-for-${theme}`);
      expect(logo?.getAttribute('src')).toBe(`/img/logo-${theme}.svg`);
      expect(logo?.getAttribute('alt')).toBe('NacioCheck');
    }
    expect(doc.querySelector('#hero .hero-tagline')?.textContent?.trim()).toBe(page.tagline);
  });

  it('shows a localized changed-result banner in the hero at every width, not step 1 again', () => {
    const image = doc.querySelector<HTMLImageElement>('#hero .hero-art img');
    expect(image?.getAttribute('src')).toBe(
      `/img/screens/${page.screens}/result-changed-hero-448.webp`,
    );
    const srcset = (image?.getAttribute('srcset') ?? '').replace(/\s+/g, ' ');
    expect(srcset).toContain(`/img/screens/${page.screens}/result-changed-hero-342.webp 342w`);
    expect(srcset).toContain(`/img/screens/${page.screens}/result-changed-hero-448.webp 448w`);
    expect(image?.getAttribute('sizes')).toBe('(min-width: 52rem) 29.5rem, calc(100vw - 3rem)');
    expect(image?.getAttribute('width')).toBe('448');
    expect(image?.getAttribute('height')).toBe('318');
    // The alt text states the change: the old and the new status as the sede names them.
    const alt = image?.getAttribute('alt') ?? '';
    const statuses =
      page.screens === 'en'
        ? ['Open - Registered', 'Open - In progress']
        : ['Abierto - Registrado', 'Abierto - En tramitación'];
    for (const status of statuses) expect(alt).toContain(status);
    expect(image?.getAttribute('loading')).not.toBe('lazy');
    expect(doc.querySelector('#hero .hero-art figcaption')?.textContent?.trim()).toBeTruthy();
    // Step 1 keeps the saved-applications screen, step 3 the full changed-result screen.
    const steps = [...doc.querySelectorAll('#how-it-works img[srcset]')].map((node) =>
      node.getAttribute('src'),
    );
    expect(steps).toContain(`/img/screens/${page.screens}/options-several-1280.webp`);
    expect(steps).toContain(`/img/screens/${page.screens}/result-changed-1280.webp`);
    expect(html).not.toContain('options-several-hero');
  });

  it('lists the main path states in the order of MAIN_PATH_STATES', () => {
    const states = [...doc.querySelectorAll('#statuses [data-state]')].map((node) => ({
      id: node.getAttribute('data-state'),
      tag: node.tagName,
    }));
    expect(states.map((state) => state.id)).toEqual([...MAIN_PATH_STATES]);
    for (const state of states) expect(state.tag).toBe('LI');
    expect(doc.querySelectorAll('[data-state]')).toHaveLength(MAIN_PATH_STATES.length);
  });

  it('labels the status teaser as orientative and not official', () => {
    const note = doc.querySelector('#statuses .status-note');
    expect(note?.textContent).toMatch(page.notOfficial);
    // The note sits before the list, so nobody reads a state without it.
    const statuses = html.slice(html.indexOf('id="statuses"'));
    expect(statuses.indexOf('status-note')).toBeLessThan(statuses.indexOf('data-state'));
  });

  it('answers the FAQ in disclosure widgets, with no script', () => {
    const questions = doc.querySelectorAll('#faq details > summary');
    expect(questions.length).toBeGreaterThanOrEqual(5);
    for (const question of questions) {
      expect(question.querySelector('.faq-question')?.textContent?.trim()).toBeTruthy();
      expect(question.querySelector('.faq-icon[aria-hidden="true"]')?.textContent).toBe('');
    }
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('uses plain section headings, a privacy list and a quiet agency call to action', () => {
    expect(doc.querySelector('.eyebrow, .agency-art')).toBeNull();
    expect(doc.querySelectorAll('#privacy ul.promises[role="list"] > li')).toHaveLength(4);
    expect(doc.querySelector('#agencies .button')?.textContent?.trim()).toBeTruthy();
  });

  it('has one h1 and no skipped heading level', () => {
    const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((node) =>
      Number(node.tagName.slice(1)),
    );
    expect(headings.filter((level) => level === 1)).toHaveLength(1);
    expect(headings[0]).toBe(1);
    for (let index = 1; index < headings.length; index += 1) {
      const previous = headings[index - 1] ?? 1;
      expect(headings[index] ?? 1, `heading ${String(index)}`).toBeLessThanOrEqual(previous + 1);
    }
  });

  it('gives every image alt text, a width and a height', () => {
    const images = [...doc.querySelectorAll('img')];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      const src = image.getAttribute('src') ?? '';
      expect(image.hasAttribute('alt'), src).toBe(true);
      expect(image.getAttribute('width'), src).toMatch(/^\d+$/);
      expect(image.getAttribute('height'), src).toMatch(/^\d+$/);
    }
    // Only the decorative animated icon may have an empty alt: the logo next to it carries the name.
    const empty = images.filter((image) => image.getAttribute('alt') === '');
    expect(empty.map((image) => image.getAttribute('src'))).toEqual(['/img/icon-animated.svg']);
  });

  it('uses the screenshots of its locale at both widths, and only same-origin images', () => {
    const shots = [...doc.querySelectorAll('img[srcset]')];
    expect(shots.length).toBeGreaterThanOrEqual(3);
    for (const shot of shots) {
      const hero = shot.closest('#hero') !== null;
      const largeWidth = hero ? 448 : 1280;
      const smallWidth = hero ? 342 : 640;
      const name = new RegExp(`^/img/screens/(es|en)/([a-z-]+)-${String(largeWidth)}\\.webp$`).exec(
        shot.getAttribute('src') ?? '',
      );
      expect(name?.[1]).toBe(page.screens);
      const srcset = (shot.getAttribute('srcset') ?? '').replace(/\s+/g, ' ');
      expect(srcset).toContain(
        `/img/screens/${page.screens}/${name?.[2] ?? ''}-${String(smallWidth)}.webp ${String(smallWidth)}w`,
      );
      expect(srcset).toContain(
        `/img/screens/${page.screens}/${name?.[2] ?? ''}-${String(largeWidth)}.webp ${String(largeWidth)}w`,
      );
      expect(shot.getAttribute('sizes')).toBeTruthy();
      if (hero) {
        expect(shot.getAttribute('loading')).not.toBe('lazy');
      } else {
        expect(shot.getAttribute('loading')).toBe('lazy');
      }
    }
    for (const attribute of ['src', 'srcset']) {
      for (const node of doc.querySelectorAll(`[${attribute}]`)) {
        expect(node.getAttribute(attribute), attribute).not.toMatch(/(^|\s|,)(https?:)?\/\//);
      }
    }
    // Q3: no image of the captcha step or the official form.
    expect(html).not.toMatch(/form-(captcha|hint|picker)/);
  });

  it('links the agency band to the locale vgr.cat page, and links out nowhere else but allowed hosts', () => {
    expect(doc.querySelector('#agencies a')?.getAttribute('href')).toBe(page.agency);
    const allowed = [
      'https://vgr.cat/',
      'https://www.linkedin.com/in/vagonzal/',
      'https://github.com/vgr-dev/naciocheck',
    ];
    for (const link of doc.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href') ?? '';
      if (/^[a-z]+:/i.test(href) || href.startsWith('//')) {
        expect(
          allowed.some((prefix) => href.startsWith(prefix)),
          href,
        ).toBe(true);
      }
    }
  });

  it('keeps the repository link inside the repository block', () => {
    const outside = html.replace(/<!-- @if repository -->[\s\S]*?<!-- @endif -->/g, '');
    expect(outside).not.toContain('github.com');
  });

  it('never mentions a paid tier', () => {
    const text = doc.body.textContent ?? '';
    expect(text).not.toMatch(/premium|de pago|paid|pricing|precio|preu|\bpro\b/i);
  });
});

describe('the landing stylesheet', () => {
  const CSS = readFileSync(resolve(SITE, '_build/partials/landing.css'), 'utf8');
  const BASE = readFileSync(resolve(SITE, '_build/partials/base.css'), 'utf8');
  const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

  it('uses colours only through the base tokens and loads nothing', () => {
    expect(RULES).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(RULES).not.toMatch(/\brgba?\(|\bhsla?\(/);
    expect(RULES).not.toMatch(/url\(|@import|@font-face/i);
    expect(CSS).not.toContain('<!--');
    // No token of its own: the theme lives in base.css alone.
    expect(RULES).not.toMatch(/--[\w-]+\s*:/);
  });

  it('names only tokens that base.css defines', () => {
    const defined = new Set([...BASE.matchAll(/--([\w-]+)\s*:/g)].map((match) => match[1]));
    for (const match of RULES.matchAll(/var\(--([\w-]+)\)/g)) {
      expect(defined.has(match[1]), match[1]).toBe(true);
    }
  });

  it('leaves motion to the single-play brand badge', () => {
    expect(RULES).not.toMatch(/\b(?:animation|transition)(?:-[\w-]+)?\s*:/);
    const badge = readFileSync(resolve(SITE, '../brand/icon-animated.svg'), 'utf8');
    expect(badge).toMatch(/animation:\s*pop\b/);
    expect(badge).not.toMatch(/\binfinite\b/);
    expect(badge).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  describe('contrast of the pairs it adds', () => {
    const SOURCE = BASE.replace(/\/\*[\s\S]*?\*\//g, '');
    const palette = /^:root\s*\{([^}]*)\}/m.exec(SOURCE)?.[1] ?? '';
    const entries = [
      ...palette.matchAll(
        /--([\w-]+)\s*:\s*light-dark\(\s*(#[\da-f]{6})\s*,\s*(#[\da-f]{6})\s*\)\s*;/gi,
      ),
    ];

    const luminance = (hex: string) => {
      const channel = (offset: number) => {
        const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    };

    const contrast = (a: string, b: string) => {
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (high + 0.05) / (low + 0.05);
    };

    /** [foreground, background, minimum, where] for the pairs landing.css uses and base.css does not. */
    const PAIRS: [string, string, number, string][] = [
      ['accent-soft-fg', 'accent-soft', 4.5, 'agency band text and the captcha callout'],
      ['button-bg', 'accent-soft', 3, 'the agency button against the band'],
      ['button-bg-hover', 'accent-soft', 3, 'the hovered agency button against the band'],
      ['focus', 'accent-soft', 3, 'the focus ring in the agency band'],
      ['focus', 'bg', 3, 'the focus ring on the privacy link'],
      ['focus', 'band', 3, 'the focus ring on the FAQ questions and hero actions'],
      ['heading', 'bg', 4.5, 'privacy promise headings'],
      ['muted', 'band', 4.5, 'state explanations on the status band'],
      ['heading', 'band', 4.5, 'sub-status lines on the status band'],
      ['accent', 'band', 3, 'timeline dots on the status band'],
      ['fg', 'band', 4.5, 'FAQ questions and answers'],
      ['accent-hover', 'band', 4.5, 'FAQ question hover'],
      ['accent', 'band', 3, 'FAQ plus strokes'],
      ['accent-hover', 'band', 3, 'FAQ open and hovered strokes'],
      ['control-border', 'band', 3, 'FAQ icon outline'],
    ];

    for (const [theme, valueIndex] of [
      ['light', 2],
      ['dark', 3],
    ] as const) {
      const map = new Map(entries.map((entry) => [entry[1] ?? '', entry[valueIndex] ?? '']));
      it.each(PAIRS)(`${theme}: %s on %s reaches %s:1 (%s)`, (foreground, background, minimum) => {
        const ratio = contrast(map.get(foreground) ?? '', map.get(background) ?? '');
        expect(ratio, `${foreground} on ${background}`).toBeGreaterThanOrEqual(minimum);
      });
    }
  });
});
