export interface SettingResponse {
  status: number;
  body: unknown;
}

export type SettingResponses = Record<string, SettingResponse>;

export type SettingOutcome =
  undefined | { drift: string } | { unavailable: string } | { error: string };

export interface ExpectedSetting {
  id: string;
  endpoint: string;
  extraEndpoints?: readonly string[];
  describe: string;
  missingIsDrift?: boolean;
  check(body: unknown, responses: SettingResponses): SettingOutcome;
}

export interface SettingFinding {
  id: string;
  describe: string;
}

export interface SettingsComparison {
  ok: string[];
  drift: (SettingFinding & { actual: string })[];
  unavailable: (SettingFinding & { reason: string })[];
  errors: (SettingFinding & { reason: string })[];
}

export const REQUIRED_CHECKS: readonly string[];
export const ADMIN_ROLE_ACTOR_ID: number;
export const EXPECTED_SETTINGS: readonly ExpectedSetting[];

export function endpointsToCollect(): string[];
export function compareSettings(responses: SettingResponses): SettingsComparison;
export function parseRemote(url: string): string | undefined;
export function parseHttpResponse(text: string): SettingResponse;
