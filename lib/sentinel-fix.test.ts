import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from './security';

describe('sanitizeUrl Reproduction', () => {
  it('should reject URLs with encoded credentials in the fast-path', () => {
    // This URL contains %40 which is an encoded '@'.
    // The current fast-path only checks for literal '@'.
    const maliciousUrl = 'https://example.com%40evil.com';

    // We expect this to be rejected (return undefined) because it contains credentials.
    // If it's NOT rejected, it means the fast-path bypassed the robust URL parser.
    expect(sanitizeUrl(maliciousUrl)).toBeUndefined();
  });

  it('should reject URLs with literal credentials', () => {
    const maliciousUrl = 'https://user:pass@example.com';
    expect(sanitizeUrl(maliciousUrl)).toBeUndefined();
  });
});
