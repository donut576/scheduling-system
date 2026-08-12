import type { LicenseType } from './alert';

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

export type PositionType = 'STAFF' | 'LEADER' | 'MANAGER' | 'ADMIN_STAFF';
