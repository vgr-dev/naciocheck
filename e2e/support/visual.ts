import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { browser } from '@wdio/globals';
// The service's types are what put `checkScreen` on the browser object; a type-only import is enough.
import type {} from '@wdio/visual-service';

/**
 * The visual suite's folders and knobs, in one place because both the WebdriverIO config and the spec need them.
 *
 * Baselines are tracked by git (D3): a screenshot that changes is a fact to review, so its new version belongs
 * in the history next to the code that changed it. What a run captures and what it diffs are run artefacts and
 * live in `.artifacts/` with the rest of them.
 */

/** Where the baselines live: `chrome/<page>-<state>-<locale>-<viewport>.png`. */
export const BASELINE_DIR = resolve(import.meta.dirname, '../baselines');

/** Where a run writes the images it took and the diff it found: git-ignored. */
export const SCREENSHOT_DIR = resolve(import.meta.dirname, '../.artifacts/screenshots');

/**
 * The browser the visual matrix is taken in. Chrome only (D1): the run's own browser would otherwise appear in
 * every name, and Firefox cannot render extension pages under Marionette.
 */
export const VISUAL_BROWSER = 'chrome';

/**
 * The image name the plan fixes: `<browser>/<page>-<state>-<locale>-<viewport>`.
 *
 * It is the whole name, because the service's `formatImageName` is `{tag}`: the folders the baseline sits in and
 * the name `index.md` lists both come from here.
 */
export function screenTag(page: string, state: string, locale: string, viewport: string): string {
  return `${VISUAL_BROWSER}/${page}-${state}-${locale}-${viewport}`;
}

/**
 * Creates the folders the service writes into, once per run.
 *
 * The service creates the folder it is configured with but not the browser-named one inside it, which is part of
 * the image name; without this the first run fails copying the baseline it just took.
 */
export function createVisualFolders(): void {
  for (const dir of [BASELINE_DIR, join(SCREENSHOT_DIR, 'actual'), join(SCREENSHOT_DIR, 'diff')]) {
    mkdirSync(join(dir, VISUAL_BROWSER), { recursive: true });
  }
}

/**
 * How much of an image may differ before it counts as a change, in percent.
 *
 * `0.01 %` (about 100 pixels of a desktop image). It began at `0.1 %`, which let a popup that had lost its width
 * through (the change moved a few card borders, 0.09 %). With the animated logo held at rest two consecutive runs
 * agree to the pixel, so every difference above this is a change somebody made.
 */
export const MISMATCH_TOLERANCE = 0.01;

/** True when the run is regenerating baselines instead of comparing against them. */
export function updatingBaselines(): boolean {
  return process.env.E2E_UPDATE_BASELINES === '1';
}

/**
 * The service's options.
 *
 * The image name is the tag alone, and the tag already carries the browser, the page, the state, the locale and
 * the viewport, because that is the name the plan fixes for the baselines and for `index.md`.
 *
 * `autoSaveBaseline` is on only while baselines are being regenerated: in a normal run an image with no baseline
 * has to be a failing image, never a silently new one.
 */
export function visualServiceOptions(): Record<string, unknown> {
  return {
    baselineFolder: BASELINE_DIR,
    screenshotPath: SCREENSHOT_DIR,
    formatImageName: '{tag}',
    clearRuntimeFolder: true,
    autoSaveBaseline: updatingBaselines(),
    // A caret blinking or a spinner mid-frame would make every run differ from the last.
    disableCSSAnimation: true,
    disableBlinkingCursor: true,
    waitForFontsLoaded: true,
    hideScrollBars: true,
    saveAboveTolerance: 0,
  };
}

/** What one screenshot reported: the image, and how much of it differs from its baseline. */
export interface ScreenComparison {
  /** The image name, without folders: the tag the spec passed. */
  readonly fileName: string;
  /** How much of the image differs from the baseline, in percent. */
  readonly misMatchPercentage: number;
}

/**
 * Compares the viewport that is current in the session against the baseline of `tag`, or the whole page,
 * scrolled and stitched, when `fullPage` is set.
 *
 * The service answers with a percentage when it is not asked for everything, and with the whole result when it
 * is; this keeps the second shape and fails loudly if the service ever changes it.
 */
export async function compareScreen(tag: string, fullPage = false): Promise<ScreenComparison> {
  const options = { returnAllCompareData: true };
  const result = fullPage
    ? await browser.checkFullPageScreen(tag, options)
    : await browser.checkScreen(tag, options);
  if (typeof result !== 'object' || result === null) {
    throw new Error(`The comparison of ${tag} answered with a bare number, not a result`);
  }
  const comparison = result as Partial<ScreenComparison>;
  if (typeof comparison.misMatchPercentage !== 'number') {
    throw new Error(`The comparison of ${tag} reported no mismatch percentage`);
  }
  return {
    fileName: String(comparison.fileName),
    misMatchPercentage: comparison.misMatchPercentage,
  };
}
