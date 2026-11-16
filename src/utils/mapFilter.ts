/**
 * 地圖標記篩選工具模組。
 *
 * 提供地圖頁面使用之純篩選邏輯，依目前選定的集團與/或分店條件，
 * 決定應顯示哪些客戶分店標記。
 *
 * 設計原則 (Property 27: 地圖篩選正確性)：
 * 一筆客戶記錄會被納入結果，若且唯若它符合所有「啟用中」（有明確指定值）
 * 的篩選條件。若某個篩選維度的值為 undefined，代表該維度不設限
 * （所有值皆視為符合）。此設計使函式為全函式（total function）且無副作用，
 * 因此可獨立於 React/Leaflet 渲染層之外進行 property-based 測試。
 *
 * Validates: Requirements 15.3
 */

import type { Customer } from '@/types/customer';
import type { Task } from '@/types/task';

export interface MapFilterCriteria {
  groupId?: string;
  branchId?: string;
}

/**
 * 將 `customers` 篩選為僅符合 `filters` 中所有啟用篩選條件之子集。
 * 若某篩選維度為 `undefined`，則該維度視為「不設限」。
 *
 * @param customers 欲篩選之完整客戶分店清單
 * @param filters 篩選條件（groupId/branchId），undefined 代表不限制該條件
 * @returns 符合所有啟用篩選條件之 `customers` 子集
 */
export function filterCustomersByLocation(
  customers: Customer[],
  filters: MapFilterCriteria,
): Customer[] {
  const { groupId, branchId } = filters;

  return customers.filter((c) => {
    // groupId 為 truthy 時才啟用篩選；未指定 (undefined/空字串) 代表不限制集團
    if (groupId && c.groupId !== groupId) return false;
    // 同理，branchId 未指定時不限制分店
    if (branchId && c.branchId !== branchId) return false;
    return true;
  });
}

/** 地圖的時間篩選條件：日期為 YYYY-MM-DD，時間為 HH:mm；未填代表該端不設限 */
export interface MapTimeCriteria {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

/**
 * 依日期、時段篩選任務。
 * - 日期：任務日期落在 [startDate, endDate]（含頭尾）。
 * - 時段：任務時間與所選時段「有重疊」即保留；沒填時段就不看時間（彈性時間的任務也會保留）。
 *   有填時段時，沒有開始時間的任務不顯示。跨日任務（結束時間早於開始時間）視為隔天結束。
 */
export function filterTasksByTime(tasks: Task[], criteria: MapTimeCriteria): Task[] {
  const { startDate, endDate, startTime, endTime } = criteria;
  const hasTimeWindow = !!startTime || !!endTime;
  const windowStart = startTime ? toMinutes(startTime) : 0;
  let windowEnd = endTime ? toMinutes(endTime) : 24 * 60;
  if (windowEnd < windowStart) windowEnd += 24 * 60;

  return tasks.filter((task) => {
    if (!task.date) return false;
    if (startDate && task.date < startDate) return false;
    if (endDate && task.date > endDate) return false;
    if (!hasTimeWindow) return true;
    if (!task.startTime) return false;
    const s = toMinutes(task.startTime);
    let e = task.endTime ? toMinutes(task.endTime) : s;
    if (e < s || task.isOvernight) e += 24 * 60;
    return s <= windowEnd && e >= windowStart;
  });
}
