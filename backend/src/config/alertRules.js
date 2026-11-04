// 排班警示規則的門檻值（暫定，沿用前端 src/utils/alertRules.ts 的數字）
// PE 確認規定後，只需要改這個檔案。
export const ALERT_LIMITS = {
  // 員工最長可連續上班天數；超過（第 8 天）就違規
  maxConsecutiveDays: 7,
  // 員工單日工時上限（分鐘）；加總超過 600（10 小時）才違規，剛好 10 小時不違規
  maxDailyMinutes: 600,
};
