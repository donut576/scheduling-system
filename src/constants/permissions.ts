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
  // 1. 系統管理員 (ADMIN)：全部功能
  ADMIN: Object.values(PERMISSIONS),

  // 2. 經理 / 審批主管 (MANAGER)：審批核准、特許覆蓋、全區調度、班表管理
  MANAGER: [
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_EDIT,
    PERMISSIONS.SCHEDULE_APPROVE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_EDIT,
    PERMISSIONS.TASK_EXPORT,
    PERMISSIONS.TASK_OVERRIDE_ALERT,
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_EDIT,
    PERMISSIONS.EMPLOYEE_DESIGNATE_LEAVE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.APPROVAL_VIEW,
    PERMISSIONS.APPROVAL_APPROVE,
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.MAP_VIEW,
  ],

  // 3. 排班組長 / 行政 (LEADER)：任務建立、排班編輯、客戶維護、指定排休、待排客戶、通知發送
  LEADER: [
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_EDIT,
    PERMISSIONS.TASK_EXPORT,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_EDIT,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.PENDING_CUSTOMER_VIEW,
    PERMISSIONS.PENDING_CUSTOMER_CREATE,
    PERMISSIONS.PENDING_CUSTOMER_CONVERT,
    PERMISSIONS.EMPLOYEE_VIEW,
    PERMISSIONS.EMPLOYEE_DESIGNATE_LEAVE,
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_MANAGE_TEMPLATE,
    PERMISSIONS.MAP_VIEW,
  ],

  // 4. 現場專員 / 一般員工 (STAFF)：檢視本人與同班別班表、接收通知
  STAFF: [PERMISSIONS.SCHEDULE_VIEW, PERMISSIONS.NOTIFICATION_VIEW],
};
