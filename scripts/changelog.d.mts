export interface ReleaseSection {
  heading: string;
  items: string[];
}

export interface Release {
  /** `Unreleased` or `x.y.z`. */
  version: string;
  /** `YYYY-MM-DD`, or null for `Unreleased`. */
  date: string | null;
  sections: ReleaseSection[];
}

export interface ChangelogStrings {
  /** The line shown when there is no dated release yet. */
  noReleases: string;
  /** The text of the link to a release's GitHub page. */
  githubRelease: string;
}

export interface RenderOptions {
  lang: string;
  strings: ChangelogStrings;
  repositoryPublic: boolean;
}

export const SECTION_HEADINGS: readonly string[];

export function parseChangelog(text: string): Release[];
export function renderChangelog(releases: readonly Release[], options: RenderOptions): string;
