/**
 * 通用格式化工具模組。
 *
 * 提供電話號碼、數字千分位、文字截斷、檔案大小等常用顯示格式化函式。
 */

/**
 * 格式化台灣手機號碼（09xx-xxx-xxx 格式）。
 * 若輸入非標準之 10 位數 09 開頭手機號碼，則原樣回傳不做轉換。
 *
 * @param phone 原始電話號碼字串（可能含符號或空格）
 * @returns 格式化後之電話號碼字串
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  // 移除所有非數字字元（如括號、空格、破折號）
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
};

/**
 * 將數字格式化為含千分位逗號之字串（依繁體中文/台灣慣例）。
 *
 * @param num 欲格式化之數字
 * @returns 含千分位逗號之字串
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-TW');
};

/**
 * 將文字截斷至指定長度，超出部分以省略號 (...) 表示。
 *
 * @param text 原始文字
 * @param maxLength 允許之最大長度
 * @returns 截斷後之文字；若原文字未超出長度則原樣回傳
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * 將檔案大小（位元組）格式化為易讀之單位字串（B/KB/MB/GB）。
 * 演算法：以 1024 為底取對數，決定應使用之單位層級，再換算數值並四捨五入至小數點後一位。
 *
 * @param bytes 檔案大小（位元組數）
 * @returns 格式化後之檔案大小字串，例如 "1.5 MB"
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  // log_1024(bytes) 取整數部分，即為對應之單位索引（0=B, 1=KB, 2=MB, 3=GB）
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};
