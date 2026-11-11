// 新密碼規則（和後端 backend/src/services/password.js 一致；後端才是最終把關）
export const DEFAULT_PASSWORD = 'Ecolab1234';
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordRuleState {
  /** 至少 8 碼 */
  longEnough: boolean;
  /** 不是預設密碼 */
  notDefault: boolean;
  /** 與目前密碼不同 */
  differentFromCurrent: boolean;
  /** 兩次輸入一致 */
  confirmed: boolean;
}

export function checkPasswordRules(
  current: string,
  next: string,
  confirm: string,
): PasswordRuleState {
  return {
    longEnough: next.length >= MIN_PASSWORD_LENGTH,
    notDefault: next !== DEFAULT_PASSWORD,
    differentFromCurrent: next !== current,
    confirmed: next !== '' && next === confirm,
  };
}

/** 第一個不符合的規則訊息；全部符合回傳 null */
export function firstPasswordError(state: PasswordRuleState): string | null {
  if (!state.longEnough) return `新密碼至少 ${MIN_PASSWORD_LENGTH} 碼`;
  if (!state.notDefault) return '新密碼不能是預設密碼';
  if (!state.differentFromCurrent) return '新密碼不能與目前密碼相同';
  if (!state.confirmed) return '兩次輸入的密碼不一致';
  return null;
}
