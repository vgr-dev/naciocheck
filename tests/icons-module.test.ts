import { describe, expect, it } from 'vitest';
import type { PublicPathEntry, Wxt } from 'wxt';
import iconsModule, { GENERATED_ICON_PATHS, ICON_SIZES } from '../modules/icons';

/**
 * `npm ci` runs `wxt prepare` before any build has generated `public/icon/`, and CI typechecks before it
 * builds. The module must register the generated paths so `browser.runtime.getURL('/icon/128.png')`
 * typechecks on a clean checkout.
 */
describe('icons module public paths', () => {
  type PublicPathsHook = (wxt: Wxt, paths: PublicPathEntry[]) => unknown;
  const hooks = iconsModule.hooks as Record<string, PublicPathsHook | undefined> | undefined;
  const hook = hooks?.['prepare:publicPaths'];

  const run = async (paths: PublicPathEntry[]) => {
    expect(hook).toBeTypeOf('function');
    await hook?.({} as Wxt, paths);
    return paths.map((entry) => (typeof entry === 'string' ? entry : entry.path));
  };

  it('lists every generated icon', () => {
    expect(GENERATED_ICON_PATHS).toEqual([
      ...ICON_SIZES.map((size) => `icon/${size}.png`),
      'icon/icon-animated.svg',
    ]);
  });

  it('adds the generated icons when public/icon does not exist yet', async () => {
    expect(await run(['popup.html'])).toEqual(['popup.html', ...GENERATED_ICON_PATHS]);
  });

  it('does not duplicate icons that a build already generated', async () => {
    const paths = await run(['popup.html', ...GENERATED_ICON_PATHS]);
    expect(paths).toHaveLength(1 + GENERATED_ICON_PATHS.length);
  });
});
