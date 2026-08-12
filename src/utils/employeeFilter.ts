import type { Employee } from '@/types/employee';
import type { LicenseType } from '@/types/alert';

/**
 * 員工篩選條件
 */
export interface EmployeeFilterCriteria {
  /** 群組 ID 篩選 */
  groupId?: string;
  /** 證照類型篩選 */
  licenseType?: LicenseType;
  /** 是否隱藏休假員工 */
  hideOnLeave?: boolean;
  /** 休假檢查日期（配合 hideOnLeave 使用） */
  date?: string;
}

/**
 * 純函式：根據篩選條件過濾員工列表
 *
 * 規則：
 * - 若 groupId 有值，僅保留該群組之員工
 * - 若 licenseType 有值，僅保留持有該證照之員工
 * - 若 hideOnLeave 為 true 且 date 有值，排除在該日期指定休假之員工
 * - 所有啟用的條件必須同時滿足（AND 邏輯）
 *
 * Validates: Requirements 3.6
 */
export function filterEmployees(
  employees: Employee[],
  criteria: EmployeeFilterCriteria,
): Employee[] {
  return employees.filter((emp) => {
    // 群組篩選
    if (criteria.groupId && emp.groupId !== criteria.groupId) {
      return false;
    }

    // 證照篩選
    if (criteria.licenseType && !emp.licenses.includes(criteria.licenseType)) {
      return false;
    }

    // 休假篩選
    if (criteria.hideOnLeave && criteria.date) {
      if (emp.designatedLeaves.includes(criteria.date)) {
        return false;
      }
    }

    return true;
  });
}
