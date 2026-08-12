import type { LicenseType } from './alert';

export interface Customer {
  id: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  requiredLicenses: LicenseType[];
  remarks?: string;
}

export interface CustomerGroup {
  id: string;
  name: string;
  branches: CustomerBranch[];
}

export interface CustomerBranch {
  id: string;
  groupId: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  requiredLicenses: LicenseType[];
}

export interface PendingCustomer {
  id: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  status: PendingCustomerStatus;
  date?: string;
  startTime?: string;
  endTime?: string;
  headcount: number;
  shift?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type PendingCustomerStatus = 'PENDING' | 'CONFIRMED' | 'CONVERTED';
