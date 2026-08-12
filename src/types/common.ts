import type { ReactNode } from 'react';

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface SelectOption {
  label: string;
  value: string | number;
  children?: SelectOption[];
  disabled?: boolean;
}

export interface TabItem {
  key: string;
  label: string;
  closable?: boolean;
}

export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  children?: MenuItem[];
  permission?: string;
}

export interface RouteConfig {
  path: string;
  element?: ReactNode;
  children?: RouteConfig[];
  permission?: string;
  roles?: string[];
  meta?: {
    title: string;
    icon?: string;
  };
}
