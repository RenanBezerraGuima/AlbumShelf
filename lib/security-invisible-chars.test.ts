import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeUrl } from './security';

describe('Security: Invisible Characters', () => {
  const invisibleChars = [
    '\xAD',     // Soft Hyphen
    '\u200B',   // Zero Width Space
    '\u200C',   // Zero Width Non-Joiner
    '\u200D',   // Zero Width Joiner
    '\u200E',   // LRM
    '\u200F',   // RLM
    '\u2060',   // Word Joiner
    '\uFEFF',   // Byte Order Mark
  ];

  describe('sanitizeText', () => {
    it('should strip invisible characters from text', () => {
      invisibleChars.forEach(char => {
        const text = `A${char}B`;
        expect(sanitizeText(text)).toBe('AB');
      });
    });

    it('should strip multiple invisible characters from text', () => {
      const text = `A${invisibleChars.join('')}B`;
      expect(sanitizeText(text)).toBe('AB');
    });
  });

  describe('sanitizeUrl', () => {
    it('should reject URLs containing invisible characters', () => {
      invisibleChars.forEach(char => {
        const url = `https://example.com/path${char}to`;
        expect(sanitizeUrl(url)).toBeUndefined();
      });
    });

    it('should reject URLs containing percent-encoded soft hyphen', () => {
      const url = 'https://example.com/path%ADto';
      expect(sanitizeUrl(url)).toBeUndefined();
    });

    it('should reject URLs containing percent-encoded C1 control characters', () => {
      // %80 to %9F
      expect(sanitizeUrl('https://example.com/path%80to')).toBeUndefined();
      expect(sanitizeUrl('https://example.com/path%9Fto')).toBeUndefined();
    });
  });
});
