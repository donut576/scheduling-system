// API 模組統一匯出入口
// 匯總各業務領域的 API 呼叫層與相關型別，方便外部統一從此檔案匯入
export { authApi } from './auth';
export { taskApi } from './task';
export { scheduleApi } from './schedule';
export type { ScheduleUpdateData } from './schedule';
export { customerApi } from './customer';
export type { CustomerListParams, CustomerFormData } from './customer';
export { employeeApi } from './employee';
export type { EmployeeListParams, EmployeeFormData } from './employee';
export { notificationApi } from './notification';
export type { NotificationListParams, SendNotificationData } from './notification';
export { approvalApi } from './approval';
export type { ApprovalListParams } from './approval';
export { pendingCustomerApi } from './pending-customer';
export type {
  PendingCustomerListParams,
  PendingCustomerFormData,
  ConvertToTaskData,
} from './pending-customer';
// 匯出共用的 Axios 實例與相關輔助函式（錯誤處理、Token 取得器、未授權處理器設定）
export {
  default as apiInstance,
  handleApiError,
  setTokenGetter,
  setUnauthorizedHandler,
} from './instance';
