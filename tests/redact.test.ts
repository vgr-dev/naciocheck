import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { redact } from '../src/core/redact';
import { redact as redactFromReport } from '../src/core/report';

describe('redact module', () => {
  it('has no import, so the Worker typecheck never reaches storage or crypto', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core', 'redact.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\bimport\s*\(/);
  });

  it('is the function report.ts re-exports', () => {
    expect(redactFromReport).toBe(redact);
  });

  it('still masks an identifier', () => {
    expect(redact('NIE X1234567L')).toBe('NIE [NIE]');
  });
});
