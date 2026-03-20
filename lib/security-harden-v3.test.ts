import { describe, it, expect } from 'vitest';
import { sanitizeUrl, sanitizeSyncState, sanitizeText } from './security';

describe('Security Hardening v3', () => {
  describe('NBSP and Soft Hyphen Protection', () => {
    it('should block literal NBSP in URLs', () => {
      const urlWithNbsp = 'https://example.com/path\u00A0with\u00A0nbsp';
      expect(sanitizeUrl(urlWithNbsp)).toBeUndefined();
    });

    it('should strip literal NBSP from text', () => {
      const textWithNbsp = 'Hello\u00A0World';
      expect(sanitizeText(textWithNbsp)).toBe('HelloWorld');
    });

    it('should block percent-encoded NBSP (%A0) in URLs', () => {
      const urlWithEncodedNbsp = 'https://example.com/path%A0with%A0nbsp';
      expect(sanitizeUrl(urlWithEncodedNbsp)).toBeUndefined();
    });

    it('should block percent-encoded Soft Hyphen (%AD) in URLs', () => {
      const urlWithEncodedSoftHyphen = 'https://example.com/path%ADwith%ADshy';
      expect(sanitizeUrl(urlWithEncodedSoftHyphen)).toBeUndefined();
    });
  });

  describe('Stricter Timestamp Validation', () => {
    it('should reject timestamps more than 5 minutes in the future', () => {
      const now = Date.now();
      const future10Min = now + (10 * 60 * 1000);
      const state = { lastUpdated: future10Min };
      const sanitized = sanitizeSyncState(state);
      // It should fallback to current time
      expect(sanitized.lastUpdated).toBeLessThanOrEqual(Date.now() + 100);
      expect(sanitized.lastUpdated).toBeGreaterThanOrEqual(now - 100);
    });

    it('should accept timestamps within 5 minutes in the future', () => {
      const now = Date.now();
      const future2Min = now + (2 * 60 * 1000);
      const state = { lastUpdated: future2Min };
      const sanitized = sanitizeSyncState(state);
      expect(sanitized.lastUpdated).toBe(future2Min);
    });

    it('should reject timestamps in the far future (previously allowed)', () => {
      const farFuture = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
      const state = { lastUpdated: farFuture };
      const sanitized = sanitizeSyncState(state);
      expect(sanitized.lastUpdated).not.toBe(farFuture);
    });
  });
});
