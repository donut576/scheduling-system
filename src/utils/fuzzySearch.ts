/**
 * 模糊搜尋工具函式
 * 依集團或分店名稱關鍵字進行不區分大小寫的篩選
 */

export interface SearchableRecord {
  groupName: string;
  branchName: string;
}

/**
 * 根據關鍵字篩選記錄，回傳 groupName 或 branchName 包含該關鍵字的記錄（不區分大小寫）
 * 若關鍵字為空字串，回傳所有記錄
 */
export function filterByKeyword<T extends SearchableRecord>(records: T[], keyword: string): T[] {
  if (keyword === '') {
    return records;
  }

  const lowerKeyword = keyword.toLowerCase();

  return records.filter(
    (record) =>
      record.groupName.toLowerCase().includes(lowerKeyword) ||
      record.branchName.toLowerCase().includes(lowerKeyword),
  );
}
