import { describe, expect, it } from 'vitest';
import { isValidIdentity, validateIdentity } from '../src/core/validation';

const VALID = {
  nie: 'X0000000X',
  numero: 'R500001',
  year: '2015',
  birthDate: '1990-01-01',
};

describe('validateIdentity', () => {
  it('accepts a well-formed identity', () => {
    expect(validateIdentity(VALID)).toEqual({});
    expect(isValidIdentity(VALID)).toBe(true);
  });

  it('accepts a NIE with or without the leading XYZ letter, in either case', () => {
    for (const nie of ['12345678L', 'X1234567L', 'x1234567l', 'Y0000001A', 'Z9999999Z']) {
      expect(validateIdentity({ ...VALID, nie }).nie, nie).toBeUndefined();
    }
  });

  it('rejects a NIE without its letter or too short', () => {
    for (const nie of ['', '1234567', 'X123456L', '1234567-L']) {
      expect(validateIdentity({ ...VALID, nie }).nie, nie).toBeDefined();
    }
  });

  it('rejects a número without the leading letter', () => {
    expect(validateIdentity({ ...VALID, numero: '500001' }).numero).toBeDefined();
    expect(validateIdentity({ ...VALID, numero: '' }).numero).toBeDefined();
  });

  it('rejects a year that is not four digits', () => {
    expect(validateIdentity({ ...VALID, year: '15' }).year).toBeDefined();
    expect(validateIdentity({ ...VALID, year: '20150' }).year).toBeDefined();
  });

  it('rejects a date that is not a real AAAA-MM-DD', () => {
    expect(validateIdentity({ ...VALID, birthDate: '01/01/1990' }).birthDate).toBeDefined();
    expect(validateIdentity({ ...VALID, birthDate: '1990-13-01' }).birthDate).toBeDefined();
  });

  it('reports every bad field at once', () => {
    expect(
      Object.keys(validateIdentity({ nie: '', numero: '', year: '', birthDate: '' })),
    ).toHaveLength(4);
  });
});
