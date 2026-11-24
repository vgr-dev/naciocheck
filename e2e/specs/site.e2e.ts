import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { browser, expect } from '@wdio/globals';
import { failOnLeakedRequest } from '../support/guard-hooks';
import { siteUrl } from '../support/site-server';

failOnLeakedRequest();

/**
 * The built site in Chrome: the landing, privacy, changelog and 404 pages in Spanish, English and Catalan, served
 * from `.output/site/` on the mapped host `site.naciocheck.test` (see `../support/site-server.ts`).
 *
 * Each page must load in its language, serve its favicon, show its images and pass an accessibility audit in the
 * light and the dark scheme. The feedback pages are left out: they load Turnstile from a host the suite cannot
 * and must not reach (plan Q6); the jsdom tests cover them. `axe-core` is read from `node_modules` and injected
 * into the page, so nothing is fetched, and the network guard has to stay at 0 requests outside the mapped hosts.
 */

interface Language {
  readonly lang: 'es' | 'en' | 'ca';
  /** The path prefix of the language: Spanish lives at the root. */
  readonly prefix: string;
}

const LANGUAGES: readonly Language[] = [
  { lang: 'es', prefix: '' },
  { lang: 'en', prefix: '/en' },
  { lang: 'ca', prefix: '/ca' },
];

/** The pages every language has. The 404 is reached through a path that does not exist, as a visitor does. */
const PAGES = [
  { name: 'landing', path: '/' },
  { name: 'privacy', path: '/privacy/' },
  { name: 'changelog', path: '/changelog/' },
  { name: '404', path: '/no-such-page' },
] as const;

const SCHEMES = ['light', 'dark'] as const;

interface AxeViolation {
  readonly id: string;
  readonly impact: string | null;
  readonly help: string;
  readonly targets: readonly string[];
}

/** A check axe could not decide (text over a gradient or an image, say): a person has to judge it. */
interface AxeIncomplete {
  readonly id: string;
  readonly impact: string | null;
  readonly targets: readonly string[];
}

interface AxeReport {
  readonly violations: AxeViolation[];
  readonly incomplete: AxeIncomplete[];
  readonly passes: number;
}

/** The `incomplete` results of one audited page, kept for the manual AA check. */
interface IncompleteRecord {
  readonly lang: string;
  readonly page: string;
  readonly path: string;
  readonly scheme: string;
  readonly incomplete: readonly AxeIncomplete[];
}

/** Where the `incomplete` results are written. Git-ignored with the rest of `e2e/.artifacts/`. */
const INCOMPLETE_REPORT = resolve(import.meta.dirname, '../.artifacts/axe-incomplete.json');

const incompleteRecords: IncompleteRecord[] = [];

/** The axe-core build in `node_modules`: the one source injected into every page. */
const AXE_SOURCE = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

async function openSitePage(path: string): Promise<void> {
  await browser.url(siteUrl(path));
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    {
      timeoutMsg: `${path} did not finish loading`,
    },
  );
}

/** Injects axe and returns what it reports, reduced to what a person needs to find the element. */
async function runAxe(): Promise<AxeReport> {
  await browser.execute(AXE_SOURCE);
  return browser.execute(async () => {
    const axe = (window as unknown as { axe: { run: () => Promise<AxeRun> } }).axe;
    interface AxeRun {
      passes: unknown[];
      violations: {
        id: string;
        impact?: string | null;
        help: string;
        nodes: { target: unknown[] }[];
      }[];
      incomplete: {
        id: string;
        impact?: string | null;
        nodes: { target: unknown[]; impact?: string | null }[];
      }[];
    }
    const result = await axe.run();
    return {
      passes: result.passes.length,
      violations: result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        help: violation.help,
        targets: violation.nodes.map((node) => node.target.flat().join(' ')),
      })),
      incomplete: result.incomplete.map((item) => ({
        id: item.id,
        impact: item.impact ?? item.nodes.find((node) => node.impact)?.impact ?? null,
        targets: item.nodes.map((node) => node.target.flat().join(' ')),
      })),
    };
  });
}

/** One line per violation, so a failed run says which rule broke on which element. */
function describeViolations(violations: readonly AxeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help}\n    ${violation.targets.join('\n    ')}`,
    )
    .join('\n');
}

/** Prints one line per rule axe could not decide, with how many elements it left to a person. */
function summariseIncomplete(records: readonly IncompleteRecord[]): string {
  const lines = records
    .filter((record) => record.incomplete.length > 0)
    .map(
      (record) =>
        `  ${record.lang} ${record.page} ${record.scheme}: ` +
        record.incomplete
          .map((item) => `${item.id} (${item.impact ?? 'n/a'}) x${item.targets.length}`)
          .join(', '),
    );
  const total = records.reduce(
    (sum, record) => sum + record.incomplete.reduce((n, item) => n + item.targets.length, 0),
    0,
  );
  return [
    `axe incomplete (needs a manual AA check): ${total} element(s) in ${lines.length} of ${records.length} audit(s)`,
    ...lines,
    `  full report: ${INCOMPLETE_REPORT}`,
  ].join('\n');
}

// Not a failure: axe could not decide these, so they are recorded for a person to judge.
after(() => {
  if (incompleteRecords.length === 0) return;
  mkdirSync(resolve(INCOMPLETE_REPORT, '..'), { recursive: true });
  writeFileSync(INCOMPLETE_REPORT, `${JSON.stringify(incompleteRecords, null, 2)}\n`);
  console.log(summariseIncomplete(incompleteRecords));
});

for (const { lang, prefix } of LANGUAGES) {
  describe(`site (${lang})`, () => {
    for (const { name, path } of PAGES) {
      const url = `${prefix}${path}`;

      describe(`${name} page`, () => {
        it('loads in its own language', async () => {
          await openSitePage(url);

          expect(await browser.execute(() => document.documentElement.lang)).toBe(lang);
          expect(await browser.execute(() => document.title)).not.toBe('');
          expect(await browser.execute(() => document.querySelectorAll('h1').length)).toBe(1);
        });

        it('serves its favicons', async () => {
          await openSitePage(url);

          const answers = await browser.execute(async () => {
            const hrefs = [
              ...document.querySelectorAll<HTMLLinkElement>(
                'link[rel~="icon"], link[rel="apple-touch-icon"]',
              ),
            ].map((link) => link.href);
            return Promise.all(
              hrefs.map(async (href) => {
                const response = await fetch(href);
                return {
                  href,
                  status: response.status,
                  type: response.headers.get('content-type') ?? '',
                };
              }),
            );
          });

          expect(answers.length).toBeGreaterThanOrEqual(3);
          for (const answer of answers) {
            expect(answer.status).toBe(200);
            expect(answer.type).toMatch(/^image\//);
          }
        });

        for (const scheme of SCHEMES) {
          it(`has no accessibility violations in the ${scheme} scheme`, async () => {
            const restore = await browser.emulate('colorScheme', scheme);
            try {
              await openSitePage(url);
              expect(
                await browser.execute(
                  (wanted: string) => matchMedia(`(prefers-color-scheme: ${wanted})`).matches,
                  scheme,
                ),
              ).toBe(true);

              const { violations, incomplete, passes } = await runAxe();
              incompleteRecords.push({ lang, page: name, path: url, scheme, incomplete });
              // An audit that checked nothing would pass too: it has to have run its rules.
              expect(passes).toBeGreaterThan(10);
              expect(describeViolations(violations)).toBe('');
            } finally {
              await restore();
            }
          });
        }
      });
    }

    describe('landing page images', () => {
      it('shows the localized hero screenshot at phone and desktop widths with a reserved footprint', async () => {
        await openSitePage(`${prefix}/`);
        const screenshotLocale = lang === 'ca' ? 'es' : lang;
        const observations: {
          src: string;
          viewportWidth: number;
          width: number;
          height: number;
        }[] = [];
        for (const viewport of [
          { width: 390, height: 844, minImageWidth: 330 },
          { width: 1280, height: 900, minImageWidth: 400 },
        ]) {
          await browser.setViewport({ width: viewport.width, height: viewport.height });
          await browser.takeScreenshot();
          const observation = await browser.execute(() => {
            const image = document.querySelector<HTMLImageElement>('#hero .hero-art img');
            if (!image) return null;
            const rect = image.getBoundingClientRect();
            return {
              src: image.currentSrc,
              complete: image.complete,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              width: rect.width,
              height: rect.height,
              viewportWidth: window.innerWidth,
              alt: image.alt,
              caption: image.closest('figure')?.querySelector('figcaption')?.textContent?.trim(),
            };
          });
          if (observation === null) throw new Error('Hero screenshot image was not found');
          expect(observation.src).toContain(
            `/img/screens/${screenshotLocale}/options-several-hero-`,
          );
          expect(observation.complete).toBe(true);
          expect(observation.naturalWidth).toBeGreaterThan(0);
          expect(observation.naturalHeight).toBeGreaterThan(0);
          expect(observation.width).toBeGreaterThan(viewport.minImageWidth);
          expect(observation.width).toBeLessThanOrEqual(observation.viewportWidth);
          expect(Math.abs(observation.height - observation.width / 1.6)).toBeLessThan(1);
          expect(observation.alt).toBeTruthy();
          expect(observation.caption).toBeTruthy();
          observations.push({
            src: observation.src,
            viewportWidth: observation.viewportWidth,
            width: observation.width,
            height: observation.height,
          });
        }
        expect(observations).toHaveLength(2);

        const absentImageFootprint = await browser.execute(() => {
          const image = document.querySelector<HTMLImageElement>('#hero .hero-art img');
          if (!image) return null;
          const before = image.getBoundingClientRect();
          image.removeAttribute('srcset');
          image.removeAttribute('src');
          const after = image.getBoundingClientRect();
          return { before: [before.width, before.height], after: [after.width, after.height] };
        });
        expect(absentImageFootprint?.after).toEqual(absentImageFootprint?.before);
        expect(observations).toHaveLength(2);
      });

      it('loads eager images and decodes deferred screenshots on scroll', async () => {
        await openSitePage(`${prefix}/`);

        const images = await browser.execute(() => {
          const hero = document.querySelector('.hero');
          return [...document.images]
            .filter((image) => image.loading !== 'lazy')
            .map((image) => ({
              src: image.currentSrc || image.src,
              hero: hero?.contains(image) ?? false,
              loaded: image.complete && image.naturalWidth > 0,
            }));
        });

        expect(images.some((image) => image.hero)).toBe(true);
        const broken = images.filter((image) => !image.loaded).map((image) => image.src);
        expect(broken).toEqual([]);

        const deferred = await browser.execute(() =>
          [...document.querySelectorAll<HTMLImageElement>('#main img[loading="lazy"]')].map(
            (image, index) => ({ index, src: image.currentSrc || image.src }),
          ),
        );
        expect(deferred.length).toBeGreaterThan(0);
        for (const { index, src } of deferred) {
          await browser.execute((imageIndex: number) => {
            const image = document.querySelectorAll<HTMLImageElement>('#main img[loading="lazy"]')[
              imageIndex
            ];
            image?.scrollIntoView({ block: 'center', behavior: 'instant' });
          }, index);
          // Capture a compositor frame so headless Chromium advances lazy-load observation.
          await browser.takeScreenshot();
          await browser
            .waitUntil(
              async () => {
                const image = await browser.execute((imageIndex: number) => {
                  const element = document.querySelectorAll<HTMLImageElement>(
                    '#main img[loading="lazy"]',
                  )[imageIndex];
                  if (!element) return null;
                  const rect = element.getBoundingClientRect();
                  return {
                    src: element.currentSrc || element.src,
                    complete: element.complete,
                    naturalWidth: element.naturalWidth,
                    naturalHeight: element.naturalHeight,
                    rect: {
                      top: rect.top,
                      bottom: rect.bottom,
                      width: rect.width,
                      height: rect.height,
                    },
                  };
                }, index);
                return image !== null && image.complete && image.naturalWidth > 0;
              },
              {
                timeoutMsg: `Deferred screenshot did not load after scrolling into view: ${src}`,
              },
            )
            .catch(async (error: unknown) => {
              const diagnostics = await browser.execute((imageIndex: number) => {
                const element = document.querySelectorAll<HTMLImageElement>(
                  '#main img[loading="lazy"]',
                )[imageIndex];
                if (!element) return { url: location.href, image: null };
                const rect = element.getBoundingClientRect();
                return {
                  url: location.href,
                  image: {
                    src: element.currentSrc || element.src,
                    complete: element.complete,
                    naturalWidth: element.naturalWidth,
                    naturalHeight: element.naturalHeight,
                    rect: {
                      top: rect.top,
                      bottom: rect.bottom,
                      width: rect.width,
                      height: rect.height,
                    },
                  },
                };
              }, index);
              throw new Error(
                `${String(error)}\nImage diagnostics: ${JSON.stringify(diagnostics)}`,
              );
            });
          await browser.execute(async (imageIndex: number) => {
            const image = document.querySelectorAll<HTMLImageElement>('#main img[loading="lazy"]')[
              imageIndex
            ];
            if (image) await image.decode();
          }, index);
        }
      });
    });

    describe('landing page FAQ', () => {
      for (const [device, viewport] of [
        ['phone', { width: 412, height: 915 }],
        ['desktop', { width: 1280, height: 800 }],
      ] as const) {
        it(`keeps its strokes centered and responds to click and keyboard on ${device}`, async () => {
          await browser.setViewport(viewport);
          await openSitePage(`${prefix}/`);

          const summary = browser.$('.faq details:first-of-type summary');
          const details = browser.$('.faq details:first-of-type');
          const question = summary.$('.faq-question');
          const icon = summary.$('.faq-icon');

          const layout = await browser.execute(
            (summary, question, icon) => {
              // Use the locale's own question to exercise wrapping at each viewport.
              const text = question.textContent?.trim() ?? '';
              question.textContent = Array.from({ length: 6 }, () => text).join(' ');
              summary.scrollIntoView({ block: 'center', behavior: 'instant' });
              const range = document.createRange();
              range.selectNodeContents(question);
              const summaryBox = summary.getBoundingClientRect();
              const iconBox = icon.getBoundingClientRect();
              const styles = getComputedStyle(icon);
              const horizontal = getComputedStyle(icon, '::before');
              const vertical = getComputedStyle(icon, '::after');

              return {
                lines: range.getClientRects().length,
                summaryHeight: summaryBox.height,
                iconOffset:
                  iconBox.top + iconBox.height / 2 - summaryBox.top - summaryBox.height / 2,
                fitsInline: iconBox.right <= summaryBox.right,
                alignment: [styles.alignItems, styles.justifyItems],
                gridSize: [styles.gridTemplateRows, styles.gridTemplateColumns],
                cell: [horizontal.gridArea, vertical.gridArea],
                lengths: [horizontal.width, vertical.height],
                thicknesses: [horizontal.borderBlockStartWidth, vertical.borderInlineStartWidth],
              };
            },
            await summary,
            await question,
            await icon,
          );
          expect(layout.lines).toBeGreaterThan(1);
          expect(layout.summaryHeight).toBeGreaterThanOrEqual(44);
          expect(Math.abs(layout.iconOffset)).toBeLessThan(1);
          expect(layout.fitsInline).toBe(true);
          expect(layout.alignment).toEqual(['center', 'center']);
          expect(layout.gridSize[0]).toBe(layout.gridSize[1]);
          expect(layout.cell[0]).toBe(layout.cell[1]);
          expect(layout.lengths[0]).toBe(layout.lengths[1]);
          expect(layout.thicknesses).toEqual(['2px', '2px']);

          await summary.click();
          expect(await details.getProperty('open')).toBe(true);
          expect(
            await browser.execute(
              (element) => getComputedStyle(element, '::after').display,
              await icon,
            ),
          ).toBe('none');

          await browser.keys('Enter');
          expect(await details.getProperty('open')).toBe(false);
          expect(
            await browser.execute(
              (summary) =>
                summary.matches(':focus-visible') &&
                getComputedStyle(summary).outlineStyle !== 'none',
              await summary,
            ),
          ).toBe(true);

          await browser.keys('Space');
          expect(await details.getProperty('open')).toBe(true);
          await summary.click();
          expect(await details.getProperty('open')).toBe(false);
        });
      }

      it('keeps the round marker and both strokes visible in forced colours', async () => {
        const restore = await browser.emulate('forcedColors', 'dark');
        try {
          await openSitePage(`${prefix}/`);
          const styles = await browser.execute(() => {
            const icon = document.querySelector('.faq-icon');
            if (!icon) return null;
            const buttonText = document.createElement('span');
            buttonText.style.color = 'ButtonText';
            document.body.append(buttonText);
            const expected = getComputedStyle(buttonText).color;
            buttonText.remove();
            return {
              expected,
              active: matchMedia('(forced-colors: active)').matches,
              border: getComputedStyle(icon).borderBlockStartColor,
              horizontal: getComputedStyle(icon, '::before').borderBlockStartColor,
              vertical: getComputedStyle(icon, '::after').borderInlineStartColor,
            };
          });
          expect(styles?.active).toBe(true);
          expect(styles?.border).toBe(styles?.expected);
          expect(styles?.horizontal).toBe(styles?.expected);
          expect(styles?.vertical).toBe(styles?.expected);
        } finally {
          await restore();
        }
      });
    });

    describe('404 page', () => {
      it('answers 404 with the page of its language', async () => {
        await openSitePage(`${prefix}/no-such-page`);

        expect(await browser.execute(() => document.documentElement.lang)).toBe(lang);
        expect(
          await browser.execute(() => fetch(location.href).then((response) => response.status)),
        ).toBe(404);
      });
    });
  });
}

describe('site server', () => {
  it('redirects a folder without its slash, as auto-trailing-slash does', async () => {
    await openSitePage('/en');

    expect(await browser.execute(() => location.pathname)).toBe('/en/');
    expect(await browser.execute(() => document.documentElement.lang)).toBe('en');
  });
});
