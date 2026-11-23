export interface SiteConfig {
  /** The Chrome Web Store listing, or null until it exists. Must start `https://chromewebstore.google.com/`. */
  chromeStoreUrl: string | null;
  /** The Firefox add-on listing, or null until it exists. Must start `https://addons.mozilla.org/`. */
  firefoxStoreUrl: string | null;
  /** While false, the source links and the per-release GitHub links are left out. */
  repositoryPublic: boolean;
}

export interface BuildOptions {
  /** The hand-written pages and `_build/`. */
  sourceDir: string;
  /** Wiped and rewritten. */
  outDir: string;
  /** Defaults to `<sourceDir>/_build/config.json`. */
  config?: SiteConfig;
  /** The text of `CHANGELOG.md`. Defaults to the repository's file (empty when it is missing). */
  changelog?: string;
  /** Render the images with `writeSiteAssets`. Defaults to true. */
  writeAssets?: boolean;
}

export interface BuildResult {
  /** The `.html` pages written, relative to `outDir`. */
  pages: string[];
  /** The generated files written, relative to `outDir`. */
  assets: string[];
}

export const SOURCE_DIR: string;
export const OUT_DIR: string;
export const SITE_ORIGIN: string;
export const MARKERS: readonly string[];

export function loadConfig(sourceDir: string): Promise<SiteConfig>;
export function buildSite(options: BuildOptions): Promise<BuildResult>;
