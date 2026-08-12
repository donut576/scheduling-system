/**
 * 日期與時間處理工具模組。
 *
 * 提供日期格式化、時間區間計算（含跨日/夜班情境）、時段重疊偵測，
 * 以及連續工作天數計算等功能，是排班相關演算法的核心基礎函式庫。
 * 所有需要顯示給使用者之日期時間均統一使用 Asia/Taipei 時區。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import isBetween from 'dayjs/plugin/isBetween';

// 設定 Day.js 所需插件（UTC、時區、ISO 週、區間判斷）
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(isBetween);

const DEFAULT_TIMEZONE = 'Asia/Taipei';

/**
 * 將日期格式化為顯示用字串（預設格式 YYYY-MM-DD）。
 *
 * @param date 日期字串或 Date 物件
 * @param format 輸出格式，預設為 'YYYY-MM-DD'
 * @returns 依 Asia/Taipei 時區格式化後之字串
 */
export const formatDate = (date: string | Date, format = 'YYYY-MM-DD'): string => {
  return dayjs(date).tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * 將日期格式化為含時區之 ISO 8601 字串（預設格式 YYYY-MM-DDTHH:mm:ssZ）。
 *
 * @param date 日期字串或 Date 物件
 * @param format 輸出格式，預設為 ISO 8601 含時區格式
 * @returns 依 Asia/Taipei 時區格式化後之字串
 */
export const formatDateTime = (date: string | Date, format = 'YYYY-MM-DDTHH:mm:ssZ'): string => {
  return dayjs(date).tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * 格式化時間字串（HH:mm）。
 * 由於輸入已為 HH:mm 格式，此函式僅作為語意化包裝，直接回傳原值。
 */
export const formatTime = (time: string): string => {
  return time; // 已經是 HH:mm 格式，不需再轉換
};

/**
 * 判斷任務是否為跨日（夜班）任務。
 * 規則：若結束時間 <= 開始時間（以分鐘數比較），代表結束時間落在次日，屬於跨日任務。
 *
 * @param startTime 開始時間（HH:mm）
 * @param endTime 結束時間（HH:mm）
 * @returns 是否為跨日任務
 */
export const isOvernight = (startTime: string, endTime: string): boolean => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMinutes = (sh ?? 0) * 60 + (sm ?? 0);
  const endMinutes = (eh ?? 0) * 60 + (em ?? 0);
  return endMinutes <= startMinutes;
};

/**
 * 計算開始與結束時間之間的時長（以分鐘為單位）。
 * 會自動處理跨日（夜班）情境。
 * 回傳精確整數，避免除以 60 轉換小時所產生的浮點數精度誤差
 * （例如在 10 小時 / 600 分鐘邊界附近的誤判）。
 *
 * @param startTime 開始時間（HH:mm）
 * @param endTime 結束時間（HH:mm）
 * @returns 時長（分鐘）
 */
export const calculateDurationMinutes = (startTime: string, endTime: string): number => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMinutes = (sh ?? 0) * 60 + (sm ?? 0);
  const endMinutes = (eh ?? 0) * 60 + (em ?? 0);

  if (endMinutes <= startMinutes) {
    // 跨日情境：先計算到當日 24:00 (1440 分) 之剩餘時間，再加上次日到結束時間之時長
    return 1440 - startMinutes + endMinutes;
  }
  return endMinutes - startMinutes;
};

/**
 * 計算開始與結束時間之間的時長（以小時為單位）。
 * 內部委派 calculateDurationMinutes 計算後再換算為小時，會自動處理跨日情境。
 *
 * @param startTime 開始時間（HH:mm）
 * @param endTime 結束時間（HH:mm）
 * @returns 時長（小時，可能含小數）
 */
export const calculateDuration = (startTime: string, endTime: string): number => {
  return calculateDurationMinutes(startTime, endTime) / 60;
};

/**
 * 判斷兩個時間區間是否重疊。
 * 區間以自午夜起算之分鐘數表示（範圍 0-1439，不處理跨日）。
 * 重疊條件：start1 < end2 且 start2 < end1。
 *
 * @param start1 區間一開始分鐘數
 * @param end1 區間一結束分鐘數
 * @param start2 區間二開始分鐘數
 * @param end2 區間二結束分鐘數
 * @returns 兩區間是否重疊
 */
export const isTimeOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): boolean => {
  return start1 < end2 && start2 < end1;
};

/**
 * 判斷兩個時間字串（HH:mm 格式）所代表之時段是否重疊。
 * 會分別判斷各區間是否為跨日（夜班）情境，並依不同組合套用對應之重疊判斷邏輯。
 *
 * @param startTime1 時段一開始時間
 * @param endTime1 時段一結束時間
 * @param startTime2 時段二開始時間
 * @param endTime2 時段二結束時間
 * @returns 兩時段是否重疊
 */
export const isTimeStringOverlap = (
  startTime1: string,
  endTime1: string,
  startTime2: string,
  endTime2: string,
): boolean => {
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const s1 = toMinutes(startTime1);
  const e1 = toMinutes(endTime1);
  const s2 = toMinutes(startTime2);
  const e2 = toMinutes(endTime2);

  // 分別判斷兩個區間是否為跨日情境
  const isOvernightInterval1 = e1 <= s1;
  const isOvernightInterval2 = e2 <= s2;

  if (!isOvernightInterval1 && !isOvernightInterval2) {
    // 兩者皆非跨日：套用標準重疊判斷公式
    return s1 < e2 && s2 < e1;
  }

  if (isOvernightInterval1 && !isOvernightInterval2) {
    // 區間一跨日：實際涵蓋 [s1, 1440) 與 [0, e1) 兩段，
    // 只要區間二與其中任一段重疊即視為重疊
    return s2 < e1 || s1 < e2;
  }

  if (!isOvernightInterval1 && isOvernightInterval2) {
    // 區間二跨日：邏輯與上方對稱
    return s1 < e2 || s2 < e1;
  }

  // 兩者皆為跨日：由於都涵蓋午夜前後，必定重疊
  return true;
};

/**
 * 計算某員工「連續工作天數」之最大值。
 * 將既有任務日期與新任務日期合併、去重並排序後，
 * 逐一比較相鄰日期之天數差：若差 1 天代表連續，累加計數；
 * 若差大於 1 天則代表中斷，重新從 1 開始計算；差為 0 代表同一天，忽略不計。
 *
 * @param existingDates 該員工既有任務日期清單（YYYY-MM-DD）
 * @param newDate 欲新增之任務日期（YYYY-MM-DD）
 * @returns 合併新日期後之最長連續工作天數
 */
export const getMaxConsecutiveDays = (existingDates: string[], newDate: string): number => {
  // 合併既有日期與新日期，去除重複並依時間先後排序
  const allDates = [...new Set([...existingDates, newDate])].sort();
  if (allDates.length === 0) return 0;

  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < allDates.length; i++) {
    const prevDay = dayjs(allDates[i - 1]);
    const currDay = dayjs(allDates[i]);
    const diff = currDay.diff(prevDay, 'day');

    if (diff === 1) {
      // 與前一天相差恰好 1 天，視為連續工作，累加計數並更新最大值
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else if (diff > 1) {
      // 中間有間隔（休息日），連續計數重新起算
      currentConsecutive = 1;
    }
    // diff === 0 代表同一天重複出現，略過不處理
  }

  return maxConsecutive;
};

/**
 * 判斷指定日期是否為假日（依傳入之假日清單比對）。
 *
 * @param date 欲檢查之日期
 * @param holidays 假日日期清單（YYYY-MM-DD 格式）
 * @returns 是否為假日
 */
export const isHoliday = (date: string, holidays: string[]): boolean => {
  return holidays.includes(dayjs(date).format('YYYY-MM-DD'));
};

/**
 * 取得今日日期（依 Asia/Taipei 時區，ISO 格式 YYYY-MM-DD）。
 */
export const getToday = (): string => {
  return dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD');
};

/**
 * 取得指定日期為當月的第幾日（1-31）。若未傳入日期則以今日計算。
 *
 * @param date 欲查詢之日期（可省略，預設為今日）
 * @returns 當月日期數值（1-31）
 */
export const getDayOfMonth = (date?: string): number => {
  return dayjs(date).tz(DEFAULT_TIMEZONE).date();
};

export { dayjs };
