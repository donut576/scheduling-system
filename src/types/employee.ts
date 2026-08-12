/**
 * 員工相關型別定義
 *
 * 定義員工基本資料（含職位、群組、持有證照、指定排休日）與職位類型。
 */
import type { LicenseType } from './alert';

/** 員工資料 */
export interface Employee {
  id: string;
  name: string;
  phone: string;
  employeeNo: string;
  position: PositionType;
  groupId: string;
  groupName: string;
  groupColor: string;
  designatedLeaves: string[];
  licenses: LicenseType[];
  isActive: boolean;
}

/** 員工職位類型 */
export type PositionType = 'STAFF' | 'LEADER' | 'MANAGER' | 'ADMIN_STAFF';
