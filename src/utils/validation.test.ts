import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeInput,
  isRequired,
  isValidPhone,
  isValidEmail,
  isValidTime,
  isWithinMaxLength,
  isInRange,
} from './validation';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('escapes all special characters together', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#x27;&lt;/a&gt;',
    );
  });

  it('does not modify safe strings', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('sanitizeInput', () => {
  it('trims and escapes', () => {
    expect(sanitizeInput('  <script>  ')).toBe('&lt;script&gt;');
  });
});

describe('isRequired', () => {
  it('returns false for null', () => {
    expect(isRequired(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isRequired(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isRequired('')).toBe(false);
  });

  it('returns false for whitespace only', () => {
    expect(isRequired('   ')).toBe(false);
  });

  it('returns true for non-empty string', () => {
    expect(isRequired('hello')).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(isRequired([])).toBe(false);
  });

  it('returns true for non-empty array', () => {
    expect(isRequired([1])).toBe(true);
  });

  it('returns true for number 0', () => {
    expect(isRequired(0)).toBe(true);
  });
});

describe('isValidPhone', () => {
  it('validates Taiwan mobile', () => {
    expect(isValidPhone('0912345678')).toBe(true);
  });

  it('validates Taiwan landline', () => {
    expect(isValidPhone('02-12345678')).toBe(true);
  });

  it('rejects invalid phone', () => {
    expect(isValidPhone('123')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('validates correct email', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
  });
});

describe('isValidTime', () => {
  it('validates HH:mm format', () => {
    expect(isValidTime('09:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('00:00')).toBe(true);
  });

  it('rejects invalid time', () => {
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:30')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
  });
});

describe('isWithinMaxLength', () => {
  it('returns true when within limit', () => {
    expect(isWithinMaxLength('hello', 10)).toBe(true);
  });

  it('returns false when exceeding limit', () => {
    expect(isWithinMaxLength('hello world', 5)).toBe(false);
  });
});

describe('isInRange', () => {
  it('returns true when in range', () => {
    expect(isInRange(5, 1, 10)).toBe(true);
  });

  it('returns false when out of range', () => {
    expect(isInRange(15, 1, 10)).toBe(false);
  });

  it('returns true at boundaries', () => {
    expect(isInRange(1, 1, 10)).toBe(true);
    expect(isInRange(10, 1, 10)).toBe(true);
  });
});

import fc from 'fast-check';

/**
 * Property 31: XSS 輸入跳脫
 * For any 包含 HTML 特殊字元之使用者輸入字串，經過跳脫處理函式後應將所有危險字元轉換為安全實體，
 * 且原始文字語義不變。
 *
 * **Validates: Requirements 19.2**
 */
describe('Property 31: XSS 輸入跳脫', () => {
  // Helper: unescape HTML entities back to the original characters
  const unescapeHtml = (str: string): string => {
    return str
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  };

  // Generator for arbitrary strings that include HTML special characters
  const stringWithHtmlCharsArb = fc.stringOf(
    fc.oneof(fc.char(), fc.constantFrom('<', '>', '&', '"', "'")),
    { minLength: 0, maxLength: 200 },
  );

  it('should not contain any raw HTML special characters after escaping', () => {
    fc.assert(
      fc.property(stringWithHtmlCharsArb, (input) => {
        const escaped = escapeHtml(input);

        // After escaping, there should be no raw dangerous characters
        // We need to check that <, >, ", ' don't appear outside of entity sequences
        // And & only appears as part of entity sequences (&amp; &lt; &gt; &quot; &#x27;)
        const withoutEntities = escaped
          .replace(/&amp;/g, '')
          .replace(/&lt;/g, '')
          .replace(/&gt;/g, '')
          .replace(/&quot;/g, '')
          .replace(/&#x27;/g, '');

        expect(withoutEntities).not.toMatch(/[<>"']/);
        // Any remaining & must not be from the original special chars (they are all encoded)
        // Since we removed all known entities, remaining & would be from non-special-char content
        // which shouldn't exist since escapeHtml encodes ALL & characters
        expect(withoutEntities).not.toContain('&');
      }),
      { numRuns: 200 },
    );
  });

  it('should preserve text semantic meaning (unescaping returns the original)', () => {
    fc.assert(
      fc.property(stringWithHtmlCharsArb, (input) => {
        const escaped = escapeHtml(input);
        const roundTripped = unescapeHtml(escaped);

        expect(roundTripped).toBe(input);
      }),
      { numRuns: 200 },
    );
  });

  it('should not alter strings that contain no HTML special characters', () => {
    // Generator for strings with only safe characters (no <, >, &, ", ')
    const safeStringArb = fc.stringOf(
      fc.char().filter((c) => !['<', '>', '&', '"', "'"].includes(c)),
      { minLength: 0, maxLength: 200 },
    );

    fc.assert(
      fc.property(safeStringArb, (input) => {
        const escaped = escapeHtml(input);

        // Already-safe strings should pass through unchanged
        expect(escaped).toBe(input);
      }),
      { numRuns: 200 },
    );
  });

  it('should be idempotent-safe: escaping an already-escaped string does not corrupt data', () => {
    fc.assert(
      fc.property(stringWithHtmlCharsArb, (input) => {
        const escaped = escapeHtml(input);
        const doubleEscaped = escapeHtml(escaped);

        // Double escaping should still be reversible:
        // unescaping the double-escaped string should give the single-escaped string
        const singleUnescaped = unescapeHtml(doubleEscaped);
        expect(singleUnescaped).toBe(escaped);
      }),
      { numRuns: 200 },
    );
  });
});
