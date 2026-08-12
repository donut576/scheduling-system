/**
 * 群組色彩指派工具模組。
 *
 * 以決定性（deterministic）方式為每個員工群組指派一個唯一的顏色代碼。
 *
 * 設計原則 (Property 21: 群組色彩唯一性)：
 * 顏色依群組識別碼「第一次出現」之順序，從固定且有序的調色盤中依序指派。
 * 只要不重複的群組數量不超過調色盤長度 (`GROUP_COLOR_PALETTE.length`)，
 * 即可保證每個群組獲得之顏色皆與其他群組不同（兩兩唯一）。
 * 若不重複的群組數量超過調色盤長度，顏色會循環重複使用（取模運算），
 * 此時無法再保證唯一性——若系統需支援比調色盤更多的同時存在群組，
 * 應擴充調色盤內容。
 *
 * Validates: Requirements 11.4
 */

/**
 * 群組色彩指派所使用之固定調色盤。
 * 所有顏色在視覺上皆可清楚區分，且適合用作 Ant Design `Tag` 元件之顏色。
 */
export const GROUP_COLOR_PALETTE: readonly string[] = [
  '#1890FF',
  '#52C41A',
  '#FAAD14',
  '#F5222D',
  '#722ED1',
  '#13C2C2',
  '#EB2F96',
  '#FA8C16',
  '#A0D911',
  '#2F54EB',
  '#08979C',
  '#C41D7F',
  '#D4380D',
  '#531DAB',
  '#237804',
  '#AD6800',
  '#0050B3',
  '#9E1068',
  '#5B8C00',
  '#391085',
];

/**
 * 純函式：依「第一次出現」之順序，為 `groupIds` 中每個不重複的群組識別碼指派一個唯一顏色。
 *
 * 保證：若不重複的群組識別碼數量 <= GROUP_COLOR_PALETTE.length，
 * 則所有指派之顏色皆兩兩唯一（不會有兩個不同群組共用同一顏色）。
 *
 * @param groupIds 群組識別碼清單（可包含重複值；順序會影響指派結果）
 * @returns 由群組識別碼對應至指派之 hex 色碼的 Map
 */
export function assignGroupColors(groupIds: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  let nextIndex = 0;

  for (const groupId of groupIds) {
    if (!colorMap.has(groupId)) {
      // 依調色盤長度取模，確保索引超出調色盤長度時能循環使用
      const color = GROUP_COLOR_PALETTE[nextIndex % GROUP_COLOR_PALETTE.length] as string;
      colorMap.set(groupId, color);
      nextIndex += 1;
    }
  }

  return colorMap;
}

/**
 * 模組層級的顏色註冊表，用於在整個應用程式生命週期中記憶（memoize）顏色指派結果，
 * 確保同一個群組識別碼一旦指派過顏色後，之後查詢都會回傳相同顏色，
 * 且呼叫端不需每次都傳入完整的已知群組清單。
 */
const groupColorRegistry = new Map<string, string>();
let registryNextIndex = 0;

/**
 * 取得 `groupId` 對應之顏色。
 * 若該群組識別碼尚未被指派過顏色，則從 `GROUP_COLOR_PALETTE`
 * 依「第一次出現」順序指派一個新顏色並快取起來。
 *
 * 主要用於後端/模擬資料未提供 `groupColor` 欄位時之備援方案。
 *
 * @param groupId 群組識別碼
 * @returns 指派給該群組之 hex 色碼
 */
export function getGroupColor(groupId: string): string {
  const cached = groupColorRegistry.get(groupId);
  if (cached) {
    return cached;
  }

  const color = GROUP_COLOR_PALETTE[registryNextIndex % GROUP_COLOR_PALETTE.length] as string;
  registryNextIndex += 1;
  groupColorRegistry.set(groupId, color);
  return color;
}

/**
 * 清空模組層級的顏色註冊表。主要用於測試時重置狀態，避免測試間互相污染。
 */
export function resetGroupColorRegistry(): void {
  groupColorRegistry.clear();
  registryNextIndex = 0;
}
