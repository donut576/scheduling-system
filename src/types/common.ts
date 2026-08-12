/**
 * 共用型別定義
 *
 * 提供分頁回應、API 統一回應格式、下拉選單選項、選單項目與路由設定等
 * 跨模組共用的型別。
 */
import type { ReactNode } from 'react';

/** 分頁列表回應格式 */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** API 統一回應格式（code/message/data） */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 下拉選單選項（支援巢狀 children，用於樹狀選單） */
export interface SelectOption {
  label: string;
  value: string | number;
  children?: SelectOption[];
  disabled?: boolean;
}

/** 側邊選單項目設定 */
export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  children?: MenuItem[];
  permission?: string;
  /** 若為 true，此項目仍計入權限與路由表，但不會出現在側邊選單中（例如改以全域浮動按鈕呈現）。 */
  hideFromMenu?: boolean;
}

/** 路由設定（含權限、角色與頁面標題等中繼資料） */
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
