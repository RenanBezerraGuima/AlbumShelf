import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeUrl } from './security';

describe('Security: Invisible Characters and Soft Hyphen', () => {
  const invisibleChars = [
    { char: '\u00AD', name: 'Soft Hyphen' },
    { char: '\u200B', name: 'Zero Width Space' },
    { char: '\u200C', name: 'Zero Width Non-Joiner' },
    { char: '\u200D', name: 'Zero Width Joiner' },
    { char: '\u200E', name: 'Left-To-Right Mark' },
    { char: '\u200F', name: 'Right-To-Left Mark' },
    { char: '\u2060', name: 'Word Joiner' },
    { char: '\uFEFF', name: 'Byte Order Mark' },
  ];

  describe('sanitizeText', () => {
    it('should strip invisible characters and soft hyphen', () => {
      invisibleChars.forEach(({ char, name }) => {
        const input = `Safe${char}Text`;
        const sanitized = sanitizeText(input);
        expect(sanitized).toBe('SafeText');
      });
    });

    it('should strip multiple invisible characters', () => {
      const input = 'S\u200Ba\u00ADf\uFEFFe';
      expect(sanitizeText(input)).toBe('Safe');
    });
  });

  describe('sanitizeUrl', () => {
    it('should reject URLs containing invisible characters or soft hyphen', () => {
      invisibleChars.forEach(({ char }) => {
        const input = `https://example.com/path${char}with-invisible`;
        const sanitized = sanitizeUrl(input);
        expect(sanitized).toBeUndefined();
      });
    });

    it('should reject URLs containing encoded soft hyphen', () => {
      const input = 'https://example.com/path%ADwith-encoded-sh';
      expect(sanitizeUrl(input)).toBeUndefined();
    });
  });
});
