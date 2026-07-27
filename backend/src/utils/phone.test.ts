import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('canonicalizes the same US number typed different ways', () => {
    const expected = '+16025551234';
    for (const input of ['6025551234', '(602) 555-1234', '602-555-1234', '1 602 555 1234', '+1 (602) 555-1234']) {
      expect(normalizePhone(input)).toBe(expected);
    }
  });

  it('keeps explicit international numbers', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('rejects values that cannot be phone numbers', () => {
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('not-a-phone')).toBeNull();
    expect(normalizePhone('1234567890123456')).toBeNull();
  });
});
