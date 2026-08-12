/**
 * 表單與輸入驗證工具模組。
 *
 * 提供 XSS 輸入跳脫/淨化、必填檢查，以及電話、Email、時間格式、
 * 字串長度、數值範圍等常見驗證函式。
 */

/**
 * XSS 輸入跳脫：將 HTML 特殊字元轉換為安全的 HTML 實體，
 * 避免使用者輸入之惡意內容被瀏覽器解析為可執行的標籤或屬性。
 *
 * @param str 原始輸入字串
 * @returns 已將 & < > " ' 五種特殊字元轉為對應實體之安全字串
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
 * 淨化使用者輸入：先去除前後空白，再進行 HTML 跳脫處理。
 *
 * @param input 原始使用者輸入
 * @returns 已去除空白並跳脫特殊字元之字串
 */
export const sanitizeInput = (input: string): string => {
  return escapeHtml(input.trim());
};

/**
 * 驗證必填欄位是否有值。
 * 規則：null/undefined 視為未填；字串需去除空白後長度 > 0；
 * 陣列需長度 > 0；其他型別（包含數字 0、布林 false）皆視為已填。
 *
 * @param value 欲驗證之值
 * @returns 是否符合必填要求
 */
export const isRequired = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/**
 * 驗證電話號碼格式是否符合台灣手機或市話格式。
 * 手機：09 開頭共 10 位數字；市話：0 開頭 1-2 位區碼，可選接破折號，接 6-8 位數字。
 *
 * @param phone 欲驗證之電話號碼字串
 * @returns 是否符合台灣電話號碼格式
 */
export const isValidPhone = (phone: string): boolean => {
  const taiwanMobile = /^09\d{8}$/;
  const taiwanLandline = /^0\d{1,2}-?\d{6,8}$/;
  return taiwanMobile.test(phone) || taiwanLandline.test(phone);
};

/**
 * 驗證 Email 格式是否合法（簡易規則：需包含 @ 且網域含至少一個點）。
 *
 * @param email 欲驗證之 Email 字串
 * @returns 是否符合基本 Email 格式
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 驗證時間字串是否符合 HH:mm 格式（24 小時制，00:00 - 23:59）。
 *
 * @param time 欲驗證之時間字串
 * @returns 是否符合合法之 HH:mm 格式
 */
export const isValidTime = (time: string): boolean => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
};

/**
 * 驗證字串長度是否未超過指定之最大長度。
 *
 * @param value 欲驗證之字串
 * @param maxLength 允許之最大長度
 * @returns 是否未超出長度限制
 */
export const isWithinMaxLength = (value: string, maxLength: number): boolean => {
  return value.length <= maxLength;
};

/**
 * 驗證數值是否落在指定範圍內（含上下界）。
 *
 * @param value 欲驗證之數值
 * @param min 允許之最小值（含）
 * @param max 允許之最大值（含）
 * @returns 是否落在 [min, max] 範圍內
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};
