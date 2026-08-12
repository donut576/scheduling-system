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

export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  children?: MenuItem[];
  permission?: string;
  /** 若為 true，此項目仍計入權限與路由表，但不會出現在側邊選單中（例如改以全域浮動按鈕呈現）。 */
  hideFromMenu?: boolean;
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
