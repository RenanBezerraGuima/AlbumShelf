import { describe, it, expect } from 'vitest';
import { sanitizeText } from './security';

describe('Security: sanitizeText', () => {
  it('should truncate text to default MAX_TEXT_LENGTH (200)', () => {
    const longText = 'A'.repeat(300);
    const sanitized = sanitizeText(longText);
    expect(sanitized.length).toBe(200);
    expect(sanitized).toBe('A'.repeat(200));
  });

  it('should truncate text to custom maxLength', () => {
    const longText = 'A'.repeat(300);
    const sanitized = sanitizeText(longText, 50);
    expect(sanitized.length).toBe(50);
    expect(sanitized).toBe('A'.repeat(50));
  });

  it('should strip control characters but preserve spaces and international characters', () => {
    // \x00 (Null), \x0A (Newline), \x1F (Unit Separator), \x7F (Delete)
    const dangerousText = 'Safe Text\x00\x0A\x1F\x7F with 日本語 and 𝄞 music';
    const sanitized = sanitizeText(dangerousText);
    expect(sanitized).toBe('Safe Text with 日本語 and 𝄞 music');
  });

  it('should handle non-string inputs gracefully', () => {
    expect(sanitizeText(123)).toBe('123');
    expect(sanitizeText(true)).toBe('true');
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText({ toString: () => 'custom' })).toBe('custom');
  });

  it('should handle empty strings', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('should not strip valid whitespace characters other than control chars', () => {
    const textWithSpaces = '  leading and trailing  ';
    expect(sanitizeText(textWithSpaces)).toBe(textWithSpaces);
  });
});
