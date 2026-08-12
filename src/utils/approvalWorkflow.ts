import type { Approval } from '@/types/notification';

/**
 * 雙重審批完成判斷（Requirement 13.2）
 *
 * 業務規則：僅「班別變更（SHIFT_CHANGE）」類型之審批單需要主任（DIRECTOR）與經理
 * （MANAGER）角色審批人皆核准後才視為整體完成。其他審批類型（排班變更
 * SCHEDULE_CHANGE、警示覆蓋 ALERT_OVERRIDE）僅需單一審批人核准即完成，不受此限制，
 * 故一律回傳 true。
 *
 * @param approval 審批申請單
 * @returns 若非 SHIFT_CHANGE 類型則回傳 true（不受雙重審批限制）；若為 SHIFT_CHANGE
 *   且審批人清單中同時存在已核准（APPROVED）之 DIRECTOR 與 MANAGER 角色審批人，則回傳
 *   true；否則（任一角色尚未核准或不存在於清單中）回傳 false。
 */
export function isDualApprovalComplete(approval: Approval): boolean {
  if (approval.type !== 'SHIFT_CHANGE') {
    return true;
  }

  const directorApproved = approval.approvers.some(
    (step) => step.role === 'DIRECTOR' && step.status === 'APPROVED',
  );
  const managerApproved = approval.approvers.some(
    (step) => step.role === 'MANAGER' && step.status === 'APPROVED',
  );

  return directorApproved && managerApproved;
}

/**
 * 於前端模擬「下一位待審核（PENDING）審批人核准」後的審批單狀態。
 *
 * 背景：approvalApi.approve 僅回傳 `{ code, message, data: null }`，未包含更新後的審批單
 * 物件，前端因此無法直接得知呼叫後最新的審批人清單狀態。由於後端契約未明確定義「操作
 * 使用者」與「審批人清單中特定一筆記錄」之對應關係，這裡採用合理假設：畫面上按下
 * 「核准」時，即代表審批人清單中第一位仍為 PENDING 狀態者做出核准。
 *
 * 此函式回傳模擬後的審批單（不含副作用），供呼叫端搭配 isDualApprovalComplete 判斷是否
 * 已達成整體核准，進而決定是否觸發 Requirement 13.3 之通知重新發送流程。實際串接後端後
 * 應改以後端回傳之最新審批單狀態為準。
 *
 * @param approval 核准操作前的審批單
 * @returns 模擬核准後的審批單（第一筆 PENDING 審批人被標記為 APPROVED）
 */
export function markNextPendingApproverApproved(approval: Approval): Approval {
  let marked = false;
  const approvers = approval.approvers.map((step) => {
    if (!marked && step.status === 'PENDING') {
      marked = true;
      return {
        ...step,
        status: 'APPROVED' as const,
        decidedAt: new Date().toISOString(),
      };
    }
    return step;
  });

  return { ...approval, approvers };
}
