import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

/**
 * 通知管理頁面所使用之純日期判斷工具函式。
 *
 * 這些函式獨立抽出為純函式（而非直接寫在頁面元件內），
 * 目的是讓 task 16.3（Property 23: 通知發送日期區間啟用）
 * 能夠獨立進行 property-based 測試，不需渲染 React 元件。
 */

/**
 * 檢查指定日期是否落在「手動發送通知」的可用區間內：
 * 每月 20 日至 31 日（含頭尾）。
 *
 * Validates: Requirements 12.2
 *
 * @param date 欲檢查之日期，預設為目前時間
 * @returns 是否落在 20-31 日之區間內
 */
export const isManualSendWindow = (date: Dayjs | string | Date = dayjs()): boolean => {
  const day = dayjs(date).date();
  return day >= 20 && day <= 31;
};

/**
 * 判斷「手動發送通知」按鈕是否應為啟用狀態。
 *
 * 依據 Requirement 12.2，手動發送應「若且唯若」同時滿足以下兩條件才啟用：
 * (1) 目前日期落在 20-31 日區間內，且 (2) 存在需要通知之新排班資料。
 * 由於 API 並未提供專屬的「有新排班」訊號，
 * 我們以目前通知資料集中是否存在 NOT_NOTIFIED / CHANGED_NOT_NOTIFIED
 * 狀態之記錄，作為「新排班已產生待發送通知」的替代判斷依據
 * （這兩種狀態代表通知尚未實際發送給收件人）。
 *
 * Validates: Requirements 12.2
 *
 * @param hasPendingNotifications 是否存在待發送（未通知/變更未通知）之通知記錄
 * @param date 欲檢查之日期，預設為目前時間
 * @returns 手動發送按鈕是否應啟用
 */
export const isManualSendEnabled = (
  hasPendingNotifications: boolean,
  date: Dayjs | string | Date = dayjs(),
): boolean => isManualSendWindow(date) && hasPendingNotifications;

/**
 * 檢查指定日期是否為每月 15 日，此為系統應提醒組長進行排班之日期。
 *
 * Validates: Requirements 12.1
 *
 * @param date 欲檢查之日期，預設為目前時間
 * @returns 是否為每月 15 日
 */
export const isScheduleReminderDay = (date: Dayjs | string | Date = dayjs()): boolean =>
  dayjs(date).date() === 15;
