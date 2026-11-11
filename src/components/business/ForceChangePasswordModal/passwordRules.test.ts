// 測試對象：新密碼規則（至少 8 碼、不可是預設密碼、不可與目前密碼相同、兩次輸入一致）
import { describe, it, expect } from 'vitest';
import { checkPasswordRules, firstPasswordError } from './passwordRules';

describe('passwordRules', () => {
  it('全部符合時沒有錯誤訊息', () => {
    const state = checkPasswordRules('Ecolab1234', 'Newpass88', 'Newpass88');
    expect(state).toEqual({
      longEnough: true,
      notDefault: true,
      differentFromCurrent: true,
      confirmed: true,
    });
    expect(firstPasswordError(state)).toBeNull();
  });

  it('少於 8 碼不通過', () => {
    const state = checkPasswordRules('Ecolab1234', 'Abc123', 'Abc123');
    expect(state.longEnough).toBe(false);
    expect(firstPasswordError(state)).toBe('新密碼至少 8 碼');
  });

  it('新密碼不能是預設密碼 Ecolab1234', () => {
    const state = checkPasswordRules('Other9999', 'Ecolab1234', 'Ecolab1234');
    expect(state.notDefault).toBe(false);
    expect(firstPasswordError(state)).toBe('新密碼不能是預設密碼');
  });

  it('新密碼不能與目前密碼相同', () => {
    const state = checkPasswordRules('Samepass88', 'Samepass88', 'Samepass88');
    expect(state.differentFromCurrent).toBe(false);
    expect(firstPasswordError(state)).toBe('新密碼不能與目前密碼相同');
  });

  it('兩次輸入不一致不通過；尚未輸入時視為未確認', () => {
    expect(firstPasswordError(checkPasswordRules('a', 'Newpass88', 'Newpass89'))).toBe(
      '兩次輸入的密碼不一致',
    );
    expect(checkPasswordRules('a', '', '').confirmed).toBe(false);
  });
});
