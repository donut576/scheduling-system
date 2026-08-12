/**
 * 稽核日誌相關型別定義 (Requirement 13.4)
 *
 * 系統需針對以下四類可稽核操作建立對應稽核日誌記錄：
 * - SCHEDULE_CHANGE（排班變更）
 * - ALERT_OVERRIDE（警示覆蓋）
 * - PERMISSION_CHANGE（權限變更）
 * - DELETE（刪除操作）
 */
export type AuditActionType = 'SCHEDULE_CHANGE' | 'ALERT_OVERRIDE' | 'PERMISSION_CHANGE' | 'DELETE';

/** 建立稽核日誌所需之操作上下文資訊 */
export interface AuditLogContext {
  /** 執行操作之使用者 ID */
  operatorId: string;
  /** 執行操作之使用者名稱 */
  operatorName: string;
  /** 被操作對象之 ID（如排班 ID、員工 ID 等） */
  targetId: string;
  /** 被操作對象之類型（如 'SCHEDULE'、'EMPLOYEE'、'PERMISSION' 等） */
  targetType: string;
  /** 變更內容之詳細資料 */
  details: Record<string, unknown>;
}

/** 稽核日誌記錄 */
export interface AuditLogEntry {
  /** 稽核日誌記錄之唯一識別碼 */
  id: string;
  /** 操作類型 */
  actionType: AuditActionType;
  /** 執行操作之使用者 ID */
  operatorId: string;
  /** 執行操作之使用者名稱 */
  operatorName: string;
  /** 操作發生時間，格式為 ISO 8601（含時區資訊） */
  timestamp: string;
  /** 被操作對象之 ID */
  targetId: string;
  /** 被操作對象之類型 */
  targetType: string;
  /** 變更內容之詳細資料 */
  details: Record<string, unknown>;
}
