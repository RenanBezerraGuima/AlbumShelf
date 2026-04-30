/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { decryptArl, encryptArl, maskArl } from './arl-crypto';

const TEST_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

describe('Deezer ARL crypto', () => {
  it('encrypts and decrypts ARL values without storing plaintext', () => {
    const arl = 'a'.repeat(64);
    const encrypted = encryptArl(arl, TEST_KEY);

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain(arl);
    expect(decryptArl(encrypted, TEST_KEY)).toBe(arl);
  });

  it('rejects decryption with a different key', () => {
    const encrypted = encryptArl('b'.repeat(64), TEST_KEY);
    const otherKey = 'YmJjZGVmMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlh';

    expect(() => decryptArl(encrypted, otherKey)).toThrow();
  });

  it('masks ARL values for status responses', () => {
    expect(maskArl('abcd1234wxyz')).toBe('...wxyz');
    expect(maskArl('short')).toBe('****');
  });
});
