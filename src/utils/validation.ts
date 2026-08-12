/**
 * XSS input escaping - converts HTML special characters to safe entities
 */
export const escapeHtml = (str: string): string => {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return str.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
};

/**
 * Sanitize user input before processing
 */
export const sanitizeInput = (input: string): string => {
  return escapeHtml(input.trim());
};

/**
 * Validate required field
 */
export const isRequired = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/**
 * Validate phone number format (Taiwan)
 */
export const isValidPhone = (phone: string): boolean => {
  const taiwanMobile = /^09\d{8}$/;
  const taiwanLandline = /^0\d{1,2}-?\d{6,8}$/;
  return taiwanMobile.test(phone) || taiwanLandline.test(phone);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate time format (HH:mm)
 */
export const isValidTime = (time: string): boolean => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
};

/**
 * Validate that a string does not exceed max length
 */
export const isWithinMaxLength = (value: string, maxLength: number): boolean => {
  return value.length <= maxLength;
};

/**
 * Validate that a number is within range
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};
