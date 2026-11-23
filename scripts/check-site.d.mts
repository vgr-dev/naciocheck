export const REQUIRED_PAGES: readonly string[];

export function pageProblems(name: string, text: string): string[];
export function assetProblems(name: string, text: string): string[];
export function siteProblems(siteDir?: string): string[];
