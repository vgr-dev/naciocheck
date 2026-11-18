export const EXPECTED_PERMISSIONS: readonly string[];
export const EXPECTED_HOST_PERMISSIONS: readonly string[];
export const EXPECTED_CONTENT_SCRIPT_MATCHES: readonly string[];
export const PACKAGE_NOTICE_FILES: readonly string[];

export function manifestProblems(manifest: Record<string, unknown>, name?: string): string[];
export function textProblems(
  file: string,
  text: string,
  allowedPrefixes: readonly string[],
): string[];
export function packageNoticeProblems(
  directory: string,
  canonicalFiles: Record<string, string>,
  name?: string,
): Promise<string[]>;
