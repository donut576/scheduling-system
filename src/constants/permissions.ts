/**
 * 權限代碼與角色預設權限對照表
 *
 * PERMISSIONS 定義系統中所有權限代碼常數（供路由與 UI 元素存取控制使用）；
 * ROLE_PERMISSIONS 定義各角色預設擁有之權限代碼清單，
 * 於登入或還原登入狀態時與 API 授予之權限合併使用（見 usePermissionStore.buildPermissions）。
 */
// Permission codes for route and UI element access control
export const PERMISSIONS = {
  // Task Management
  TASK_VIEW: 'task:view',
  TASK_CREATE: 'task:create',
  TASK_EDIT: 'task:edit',
  TASK_DELETE: 'task:delete',
  TASK_EXPORT: 'task:export',
  TASK_OVERRIDE_ALERT: 'task:override_alert',

  // Schedule
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_EDIT: 'schedule:edit',
  SCHEDULE_APPROVE: 'schedule:approve',

  // Customer
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_EDIT: 'customer:edit',
  CUSTOMER_DELETE: 'customer:delete',

  // Employee
  EMPLOYEE_VIEW: 'employee:view',
  EMPLOYEE_CREATE: 'employee:create',
  EMPLOYEE_EDIT: 'employee:edit',
  EMPLOYEE_DESIGNATE_LEAVE: 'employee:designate_leave',

  // Notification
  NOTIFICATION_VIEW: 'notification:view',
  NOTIFICATION_SEND: 'notification:send',
  NOTIFICATION_MANAGE_TEMPLATE: 'notification:manage_template',

  // Approval
  APPROVAL_VIEW: 'approval:view',
  APPROVAL_APPROVE: 'approval:approve',

  // Pending Customer
  PENDING_CUSTOMER_VIEW: 'pending_customer:view',
  PENDING_CUSTOMER_CREATE: 'pending_customer:create',
  PENDING_CUSTOMER_CONVERT: 'pending_customer:convert',

  // Map
  MAP_VIEW: 'map:view',

  // System
  SYSTEM_AUDIT: 'system:audit',
  SYSTEM_SETTINGS: 'system:settings',
} as const;

/** 角色預設權限對照表（角色代碼 -> 該角色預設擁有之權限代碼清單） */
// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Admin：全部的功能
  ADMIN: Object.values(PERMISSIONS),

  // 行政：任務建立、客戶資料、通知、異動追蹤
  ADMIN_STAFF: [
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.PENDING_CUSTOMER_VIEW,
    PERMISSIONS.PENDING_CUSTOMER_CREATE,
    PERMISSIONS.PENDING_CUSTOMER_CONVERT,
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_MANAGE_TEMPLATE,
    PERMISSIONS.APPROVAL_VIEW,
    PERMISSIONS.SYSTEM_AUDIT,
  ],

  // 經理：檢視/編輯/核准班表、跨組管理
  MANAGER: [
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_EDIT,
    PERMISSIONS.SCHEDULE_APPROVE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_EDIT,
    PERMISSIONS.TASK_OVERRIDE_ALERT,
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_EDIT,
    PERMISSIONS.EMPLOYEE_DESIGNATE_LEAVE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.APPROVAL_VIEW,
    PERMISSIONS.APPROVAL_APPROVE,
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.MAP_VIEW,
  ],

  // 組長：建立任務、排班、編輯、可鍵入指定排休功能
  LEADER: [
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_EDIT,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_EDIT,
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_DESIGNATE_LEAVE,
  ],

  // 一般員工：檢視本人與同班別班表、接收通知
  STAFF: [PERMISSIONS.SCHEDULE_VIEW, PERMISSIONS.NOTIFICATION_VIEW],
};
