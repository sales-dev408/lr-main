import { describe, expect, it } from 'vitest';
import { generateOpaqueToken } from './ids.js';

describe('membership pass tokens', () => {
  it('issues a distinct, URL-safe token per member', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateOpaqueToken(18)));
    expect(tokens.size).toBe(500);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('carries no member or vendor data that a scanner could read', () => {
    const vendorCode = 'LR-VENDOR-25OFF';
    const token = generateOpaqueToken(18);
    expect(token).not.toContain(vendorCode);
    expect(token).not.toMatch(/@/);
  });
});
