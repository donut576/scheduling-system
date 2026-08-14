/**
 * 員工相關型別定義
 *
 * 定義員工基本資料（含職位、群組、持有證照、指定排休日）與職位類型。
 */
import type { LicenseType } from './alert';

/** 休假類型 */
export type LeaveType = 'REGULAR_LEAVE' | 'ANNUAL_LEAVE' | 'OTHER_LEAVE';

/** 休假類型對應顯示文字 */
export const LEAVE_TYPE_MAP: Record<LeaveType, string> = {
  REGULAR_LEAVE: '例假',
  ANNUAL_LEAVE: '年假',
  OTHER_LEAVE: '其他',
};

/** 員工資料 */
export interface Employee {
  id: string;
  name: string;
  phone: string;
  employeeNo: string;
  position: PositionType;
  groupId: string;
  groupName: string;
  area: string;
  shift: string;
  groupColor: string;
  leaveType?: LeaveType;
  designatedLeaves: string[];
  licenses: LicenseType[];
  isActive: boolean;
}

/** 員工職位類型 */
export type PositionType = 'STAFF' | 'LEADER' | 'MANAGER' | 'ADMIN_STAFF';
