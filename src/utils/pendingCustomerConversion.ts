import type { PendingCustomer } from '@/types/customer';
import type { ConvertToTaskData } from '@/api/pending-customer';

/**
 * 待定客戶轉換為正式任務後之資料結構。
 *
 * 保留原始待定客戶之集團/分店識別資訊（groupId/groupName/branchId/branchName），
 * 並以使用者確認之服務時間相關欄位（date/startTime/endTime/shift/headcount）
 * 覆蓋待定客戶原本（可能未設定）之對應欄位。
 *
 * 註：PendingCustomer 型別（見 src/types/customer.ts）本身未包含聯絡人
 * （contactName/contactPhone）欄位 — 這些欄位僅存在於 Customer / CustomerBranch
 * 型別中，屬於分店資料而非待定客戶記錄。因此本函式所稱「保留聯絡人」係以
 * groupId/groupName/branchId/branchName 作為待轉換之身份識別依據；若待定客戶
 * 未來擴充聯絡人欄位，應同步納入此保留清單。
 */
export interface ConvertedTaskData {
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  date: string;
  startTime: string;
  endTime: string;
  shift: string;
  headcount: number;
}

/**
 * 建立待定客戶轉換為正式任務所需之資料結構。
 *
 * 純函式：不執行任何 API 呼叫或副作用，僅依據輸入合併/組裝輸出資料，
 * 便於單元測試與屬性測試驗證轉換邏輯之正確性。
 *
 * Validates: Requirements 14.3
 * Property 26: 待定客戶轉換正確性
 * 驗證：for any 待定客戶轉換，保留原始集團/分店/聯絡人，日期時間符合確認值
 *
 * @param pendingCustomer 原始待定客戶記錄
 * @param confirmedValues 使用者確認之服務時間/人數/班別資訊
 * @returns 合併後之轉換資料，集團/分店資訊來自原始記錄，日期時間/班別/人數來自確認值
 */
export function buildConvertedTaskData(
  pendingCustomer: PendingCustomer,
  confirmedValues: ConvertToTaskData,
): ConvertedTaskData {
  return {
    groupId: pendingCustomer.groupId,
    groupName: pendingCustomer.groupName,
    branchId: pendingCustomer.branchId,
    branchName: pendingCustomer.branchName,
    date: confirmedValues.date,
    startTime: confirmedValues.startTime,
    endTime: confirmedValues.endTime,
    shift: confirmedValues.shift,
    headcount: confirmedValues.headcount,
  };
}
