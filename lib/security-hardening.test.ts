import { describe, it, expect } from 'vitest';
import { sanitizeUrl, sanitizeImageUrl, sanitizeSyncState } from './security';

describe('Security Hardening', () => {
  describe('DoS Protection: Trimming', () => {
    it('should protect against massive whitespace strings in sanitizeUrl', () => {
      const massiveWhitespace = ' '.repeat(10 * 1024 * 1024) + 'https://example.com';
      const start = Date.now();
      const result = sanitizeUrl(massiveWhitespace);
      const end = Date.now();

      // Should return undefined because length after slice and trim still exceeds MAX_URL_LENGTH (2048)
      // or because the slice removes the valid part at the end.
      expect(result).toBeUndefined();
      // Should be reasonably fast even with 10MB input (avoiding massive string copies)
      expect(end - start).toBeLessThan(100);
    });

    it('should protect against massive whitespace strings in sanitizeImageUrl', () => {
      const massiveWhitespace = ' '.repeat(10 * 1024 * 1024) + 'data:image/png;base64,AAA';
      const start = Date.now();
      const result = sanitizeImageUrl(massiveWhitespace);
      const end = Date.now();

      expect(result).toBeUndefined();
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('State Validation: Sane Bounds', () => {
    it('should reject future-dated timestamps in sanitizeSyncState', () => {
      const farFuture = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000); // 10 years
      const state = {
        spotifyTokenTimestamp: farFuture,
        lastUpdated: farFuture
      };

      const sanitized = sanitizeSyncState(state);
      expect(sanitized.spotifyTokenTimestamp).toBeNull();
      // lastUpdated falls back to Date.now() if invalid
      expect(sanitized.lastUpdated).toBeLessThan(farFuture);
    });

    it('should reject excessively long expiry in sanitizeSyncState', () => {
      const longExpiry = 10 * 365 * 24 * 60 * 60; // 10 years
      const state = {
        spotifyTokenExpiry: longExpiry
      };

      const sanitized = sanitizeSyncState(state);
      expect(sanitized.spotifyTokenExpiry).toBeNull();
    });

    it('should allow sane timestamps and expiries', () => {
      const now = Date.now();
      const oneHour = 3600;
      const state = {
        spotifyTokenTimestamp: now,
        spotifyTokenExpiry: oneHour,
        lastUpdated: now
      };

      const sanitized = sanitizeSyncState(state);
      expect(sanitized.spotifyTokenTimestamp).toBe(now);
      expect(sanitized.spotifyTokenExpiry).toBe(oneHour);
      expect(sanitized.lastUpdated).toBe(now);
    });
  });

  describe('State Validation: Strict Types', () => {
    it('should reject non-string spotifyToken', () => {
      const state = {
        spotifyToken: { token: 'malicious' }
      };

      const sanitized = sanitizeSyncState(state);
      expect(sanitized.spotifyToken).toBeNull();
    });

    it('should reject non-string selectedFolderId', () => {
      const state = {
        selectedFolderId: ['id']
      };

      const sanitized = sanitizeSyncState(state);
      expect(sanitized.selectedFolderId).toBeNull();
    });
  });
});
