import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeUrl } from './security';

describe('Security Hardening: Disruptive Characters', () => {
  describe('sanitizeText', () => {
    it('should strip C1 control characters (\x80-\x9F)', () => {
      const input = 'Hello\x80World\x9F';
      // Current behavior (before fix): might not strip these
      // Target behavior: should strip them
      expect(sanitizeText(input)).toBe('HelloWorld');
    });

    it('should strip bidirectional (Bidi) formatting characters', () => {
      const input = 'User\u202E (admin)\u202C'; // RLO and POP
      // These can be used to spoof file extensions or roles in UI
      expect(sanitizeText(input)).toBe('User (admin)');
    });
  });

  describe('sanitizeUrl', () => {
    it('should reject URLs with C1 control characters', () => {
      expect(sanitizeUrl('https://example.com/path\x80')).toBeUndefined();
    });

    it('should reject URLs with bidirectional formatting characters', () => {
      expect(sanitizeUrl('https://example.com/\u202Eabc.exe')).toBeUndefined();
    });

    it('should reject URLs with percent-encoded C1 control characters', () => {
      expect(sanitizeUrl('https://example.com/path%80')).toBeUndefined();
      expect(sanitizeUrl('https://example.com/path%9F')).toBeUndefined();
    });

    it('should still allow valid URLs', () => {
        expect(sanitizeUrl('https://example.com/safe')).toBe('https://example.com/safe');
    });
  });
});
