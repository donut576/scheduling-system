import { describe, it, expect } from 'vitest';
import { formatPhone, formatNumber, truncateText, formatFileSize } from './format';

describe('formatPhone', () => {
  it('formats Taiwan mobile number', () => {
    expect(formatPhone('0912345678')).toBe('0912-345-678');
  });

  it('returns original for non-standard length', () => {
    expect(formatPhone('02-12345678')).toBe('02-12345678');
  });

  it('returns empty string for empty input', () => {
    expect(formatPhone('')).toBe('');
  });

  it('strips non-digit characters before formatting', () => {
    expect(formatPhone('0912-345-678')).toBe('0912-345-678');
  });
});

describe('formatNumber', () => {
  it('formats number with locale separators', () => {
    const result = formatNumber(1234567);
    expect(result).toBe('1,234,567');
  });

  it('does not format small numbers', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

describe('truncateText', () => {
  it('returns original text if within limit', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates and adds ellipsis', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });

  it('returns original when exactly at limit', () => {
    expect(truncateText('hello', 5)).toBe('hello');
  });
});

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500.0 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });
});
