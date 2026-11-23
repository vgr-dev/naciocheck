export const LANGUAGES: readonly string[];
export const REQUIRED_PAGES: readonly string[];

export function pageProblems(name: string, text: string): string[];
export function assetProblems(name: string, text: string): string[];
export function binaryProblems(name: string, bytes: Uint8Array): string[];
export function parityProblems(pages: string[], present?: readonly string[]): string[];
export function siteProblems(siteDir?: string): string[];
