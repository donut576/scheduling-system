import type { CustomerGroup, CustomerBranch } from '@/types/customer';

/**
 * 集團分店連動篩選
 * 根據選定的集團 ID，回傳該集團下的所有分店。
 *
 * @param groups - 所有集團（含其分店資料）
 * @param groupId - 選定的集團 ID
 * @returns 該集團下的所有分店，若集團不存在則回傳空陣列
 */
export function getBranchesForGroup(groups: CustomerGroup[], groupId: string): CustomerBranch[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.branches;
}
