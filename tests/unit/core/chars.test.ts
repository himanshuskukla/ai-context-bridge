import { describe, it, expect } from 'vitest';
import { charCount, truncateToChars, formatChars } from '../../../src/utils/chars.js';

describe('chars', () => {
  describe('charCount', () => {
    it('counts characters accurately', () => {
      expect(charCount('hello')).toBe(5);
      expect(charCount('')).toBe(0);
      expect(charCount('a'.repeat(1000))).toBe(1000);
    });
  });

  describe('truncateToChars', () => {
    it('returns text unchanged if within budget', () => {
      expect(truncateToChars('hello', 100)).toBe('hello');
    });

    it('truncates text exceeding budget', () => {
      const long = 'x'.repeat(1000);
      const result = truncateToChars(long, 100);
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).toContain('truncated');
    });
  });

  describe('formatChars', () => {
    it('formats small counts', () => {
      expect(formatChars(500)).toBe('500 chars');
    });

    it('formats kilobyte-range counts', () => {
      expect(formatChars(2500)).toMatch(/K chars/);
    });

    it('formats megabyte-range counts', () => {
      expect(formatChars(2_000_000)).toMatch(/M chars/);
    });
  });
});
