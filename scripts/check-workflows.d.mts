export const ALLOWED_ACTIONS: readonly string[];

export function workflowProblems(name: string, text: string): string[];
export function dependabotProblems(name: string, text: string): string[];
export function checkRepository(root: string): Promise<{
  files: string[];
  problems: string[];
  note: string;
}>;
