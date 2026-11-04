import { ALERT_LIMITS } from '../config/alertRules.js';

// 排班警示規則（純函式，不碰資料庫，方便測試）。
// 規則內容與前端 src/utils/alertRules.ts 一致；後端用資料庫的完整資料判斷，前端只看得到同日任務。
//
// task：要檢查的任務
//   { date: 'YYYY-MM-DD'|null, timeMode: 'FIXED'|'FLEXIBLE', startTime: 'HH:MM'|null, endTime: 'HH:MM'|null,
//     headcount: number, assigneeIds: string[], requiredLicenses: string[] }
// ctx：檢查需要的資料（由 alerts.js 從資料庫載入）
//   { licensesByEmployee: { [id]: string[] }   // 排班日當天有效的證照代碼
//     onLeave: string[]                        // 排班日當天指定休假的員工 id
//     otherTasks: [{ date, timeMode, startTime, endTime, assigneeIds }] }  // 這些員工的其他任務（已排除自己與已取消）

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// 時長（分鐘）；結束不晚於開始 = 跨夜，算到隔天
export const durationMinutes = (start, end) => {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return e <= s ? 1440 - s + e : e - s;
};

// 兩個時段是否重疊（含跨夜）
export const timesOverlap = (start1, end1, start2, end2) => {
  const s1 = toMinutes(start1); const e1 = toMinutes(end1);
  const s2 = toMinutes(start2); const e2 = toMinutes(end2);
  const over1 = e1 <= s1;
  const over2 = e2 <= s2;
  if (!over1 && !over2) return s1 < e2 && s2 < e1;
  if (over1 && !over2) return s2 < e1 || s1 < e2;
  if (!over1 && over2) return s1 < e2 || s2 < e1;
  return true;
};

const dayNumber = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

// 包含 date 這一天的那段「連續上班」共幾天（dates 為其他任務的日期）
export const consecutiveRunLength = (dates, date) => {
  const days = new Set([...dates, date].map(dayNumber));
  const center = dayNumber(date);
  let run = 1;
  for (let d = center - 1; days.has(d); d -= 1) run += 1;
  for (let d = center + 1; days.has(d); d += 1) run += 1;
  return run;
};

const violation = (ruleId, message, details, affectedEmployees) => ({
  ruleId,
  severity: 'BLOCKING', // 目前六條規則一律是阻擋（可特許放行）
  message,
  details,
  ...(affectedEmployees ? { affectedEmployees } : {}),
});

const tasksOf = (ctx, empId) => (ctx.otherTasks || []).filter((t) => t.assigneeIds.includes(empId));

const checkLicense = (task, ctx) => {
  const required = task.requiredLicenses || [];
  if (required.length === 0) return null;
  // 只要有一位指派員工同時持有全部要求證照即可
  const ok = task.assigneeIds.some((id) => {
    const have = ctx.licensesByEmployee?.[id] || [];
    return required.every((lic) => have.includes(lic));
  });
  if (ok) return null;
  return violation('LICENSE_REQUIRED', '指派員工中無人持有客戶要求之證照', { required }, task.assigneeIds);
};

const checkHeadcount = (task) => {
  if (task.assigneeIds.length >= task.headcount) return null;
  return violation('HEADCOUNT_BELOW_MIN', '指派人數低於最低需求人數',
    { required: task.headcount, actual: task.assigneeIds.length });
};

const checkConsecutive = (task, ctx) => {
  const bad = task.assigneeIds.filter((id) => {
    const dates = tasksOf(ctx, id).map((t) => t.date).filter(Boolean);
    return consecutiveRunLength(dates, task.date) > ALERT_LIMITS.maxConsecutiveDays;
  });
  if (bad.length === 0) return null;
  return violation('CONSECUTIVE_DAYS', '指派員工連續工作超過七日',
    { maxAllowed: ALERT_LIMITS.maxConsecutiveDays }, bad);
};

const sameDayFixed = (ctx, empId, date) =>
  tasksOf(ctx, empId).filter((t) => t.date === date && t.timeMode !== 'FLEXIBLE' && t.startTime && t.endTime);

const checkDailyHours = (task, ctx) => {
  if (task.timeMode === 'FLEXIBLE') return null; // 彈性任務不算工時
  const bad = task.assigneeIds.filter((id) => {
    let total = durationMinutes(task.startTime, task.endTime);
    for (const t of sameDayFixed(ctx, id, task.date)) total += durationMinutes(t.startTime, t.endTime);
    return total > ALERT_LIMITS.maxDailyMinutes; // 跨夜任務的工時算在開始那天
  });
  if (bad.length === 0) return null;
  return violation('DAILY_HOURS_EXCEEDED', '指派員工當日工時超過十小時',
    { maxAllowed: ALERT_LIMITS.maxDailyMinutes / 60 }, bad);
};

const checkDuplicateSlot = (task, ctx) => {
  if (task.timeMode === 'FLEXIBLE') return null;
  const bad = task.assigneeIds.filter((id) =>
    sameDayFixed(ctx, id, task.date).some((t) => timesOverlap(task.startTime, task.endTime, t.startTime, t.endTime)));
  if (bad.length === 0) return null;
  return violation('DUPLICATE_SLOT', '指派員工於相同時段已有排班', {}, bad);
};

const checkLeave = (task, ctx) => {
  const bad = task.assigneeIds.filter((id) => (ctx.onLeave || []).includes(id));
  if (bad.length === 0) return null;
  return violation('DESIGNATED_LEAVE', '指派員工於指定休假日被排班', {}, bad);
};

// 沒有任何指派人員就不檢查（和前端一致）；沒有日期時只檢查證照與人數，其餘規則都需要日期
export const evaluateAlerts = (task, ctx) => {
  if (!task.assigneeIds || task.assigneeIds.length === 0) {
    return { isValid: true, violations: [], canOverride: true };
  }
  const checks = task.date
    ? [checkLicense, checkConsecutive, checkDailyHours, checkDuplicateSlot, checkLeave, checkHeadcount]
    : [checkLicense, checkHeadcount];
  const violations = checks.map((fn) => fn(task, ctx)).filter(Boolean);
  return { isValid: violations.length === 0, violations, canOverride: true };
};
