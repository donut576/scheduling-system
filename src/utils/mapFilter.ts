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
