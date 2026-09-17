/**
 * 客戶與集團防呆與相似度檢查工具函式
 * 用於新增/編輯客戶集團與分店時之防呆、重複判定與相似集團提示
 */

export interface GroupSummary {
  name: string;
  branchCount: number;
  sampleBranches?: string[];
}

export interface CustomerValidationResult {
  /** 是否存在完全相同之集團與分店名稱客戶 */
  isExactCustomerDuplicate: boolean;
  /** 完全相同的客戶名稱（若有） */
  exactCustomerName?: string;
  /** 是否有完全相同名稱之集團 */
  exactGroupMatch?: GroupSummary;
  /** 相似之集團清單（不含完全相同者） */
  similarGroups: GroupSummary[];
}

/**
 * 計算兩字串之 Levenshtein 編輯距離
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prevRow: number[] = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    const currRow: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const prevDiag = prevRow[j - 1] ?? 0;
      const prevUp = prevRow[j] ?? 0;
      const prevLeft = currRow[j - 1] ?? 0;

      if (a[i - 1] === b[j - 1]) {
        currRow.push(prevDiag);
      } else {
        currRow.push(Math.min(prevUp + 1, prevLeft + 1, prevDiag + 1));
      }
    }
    prevRow = currRow;
  }

  return prevRow[n] ?? 0;
}

/**
 * 清理並正規化集團名稱以利相似比對
 */
export function normalizeGroupName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\-_()（）[\]【】]/g, '')
    .replace(/集團|企業|公司|股份有限公司|門市|餐飲/g, '');
}

/**
 * 判斷兩個集團名稱是否高度相似
 */
export function isSimilarGroupName(nameA: string, nameB: string): boolean {
  const cleanA = nameA.trim().toLowerCase();
  const cleanB = nameB.trim().toLowerCase();

  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;

  const normA = normalizeGroupName(nameA);
  const normB = normalizeGroupName(nameB);

  // 若清理後完全相同（例如 "王品" 與 "王品集團"、"王品企業"）
  if (normA && normB && normA === normB) {
    return true;
  }

  // 包含關係：任一詞長度 >= 2 且包含另一詞（例如 "乾杯" 與 "乾杯燒肉"、"瓦城" 與 "瓦城泰統"）
  if (cleanA.length >= 2 && cleanB.length >= 2) {
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
      return true;
    }
  }

  if (normA && normB) {
    if (normA.length >= 2 && normB.length >= 2) {
      if (normA.includes(normB) || normB.includes(normA)) {
        return true;
      }

      const distance = getLevenshteinDistance(normA, normB);
      const maxLen = Math.max(normA.length, normB.length);

      // 至少 3 個字以上才依編輯距離判定（例如 "統一超商" 與 "統一商"）
      if (maxLen >= 3 && distance <= 1) {
        return true;
      }
      if (maxLen >= 5 && distance <= 2) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 驗證並檢查新輸入的集團／分店名稱是否在現有資料中有重複或相似
 */
export function checkCustomerDuplicate(
  inputGroupName: string,
  inputBranchName: string,
  existingGroups: { name: string; branches?: { name: string }[] }[],
): CustomerValidationResult {
  const trimmedGroup = inputGroupName.trim();
  const trimmedBranch = inputBranchName.trim();

  if (!trimmedGroup) {
    return {
      isExactCustomerDuplicate: false,
      similarGroups: [],
    };
  }

  let isExactCustomerDuplicate = false;
  let exactCustomerName: string | undefined;
  let exactGroupMatch: GroupSummary | undefined;
  const similarGroups: GroupSummary[] = [];

  for (const group of existingGroups) {
    const isSameGroupName = group.name.trim().toLowerCase() === trimmedGroup.toLowerCase();
    const branches = group.branches || [];

    if (isSameGroupName) {
      exactGroupMatch = {
        name: group.name,
        branchCount: branches.length,
        sampleBranches: branches.map((b) => b.name).slice(0, 3),
      };

      // 檢查是否有同集團且同分店名稱
      if (trimmedBranch) {
        const hasSameBranch = branches.some(
          (b) => b.name.trim().toLowerCase() === trimmedBranch.toLowerCase(),
        );
        if (hasSameBranch) {
          isExactCustomerDuplicate = true;
          exactCustomerName = `${group.name} - ${trimmedBranch}`;
        }
      }
    } else if (isSimilarGroupName(trimmedGroup, group.name)) {
      similarGroups.push({
        name: group.name,
        branchCount: branches.length,
        sampleBranches: branches.map((b) => b.name).slice(0, 3),
      });
    }
  }

  return {
    isExactCustomerDuplicate,
    exactCustomerName,
    exactGroupMatch,
    similarGroups,
  };
}
