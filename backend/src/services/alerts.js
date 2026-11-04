import { AppError, ERROR_CODES } from '../utils/response.js';
import { hasPermission } from '../middleware/permission.js';
import { evaluateAlerts } from './alertRules.js';

// 客戶的證照限制 → 要求的證照代碼（與客戶 API 的 requiredLicenses 同一套對應）
const REQUIRED_BY_RESTRICTION = { PEST_CONTROL: ['PEST_CONTROL'], PROFESSIONAL: ['PROFESSIONAL'] };

export const OVERRIDE_PERMISSION = 'task:override_alert';

// 從資料庫載入檢查需要的資料。注意：這裡查的是這些員工「全部」的任務，不套用登入者的可視範圍，
// 否則看不到的轄區任務會造成漏判。
export const loadAlertContext = async (q, state) => {
  const ids = state.assigneeIds;
  const ctx = { licensesByEmployee: {}, onLeave: [], otherTasks: [] };
  if (ids.length === 0) return ctx;

  // 證照：排班日當天有效（沒有日期就以今天為準）
  const lic = await q(`SELECT ul.user_id::text AS uid, l.code FROM user_licenses ul JOIN licenses l ON l.id = ul.license_id
    WHERE ul.user_id = ANY($1::bigint[])
      AND (ul.effective_on IS NULL OR ul.effective_on <= COALESCE($2::date, CURRENT_DATE))
      AND (ul.expires_on IS NULL OR ul.expires_on >= COALESCE($2::date, CURRENT_DATE))`, [ids, state.date]);
  for (const r of lic.rows) (ctx.licensesByEmployee[r.uid] ||= []).push(r.code);

  if (!state.date) return ctx; // 沒有日期：休假、連續天數、工時、時段都無法判斷

  const leave = await q(`SELECT DISTINCT user_id::text AS uid FROM user_leaves
    WHERE user_id = ANY($1::bigint[]) AND $2::date BETWEEN start_date AND end_date`, [ids, state.date]);
  ctx.onLeave = leave.rows.map((r) => r.uid);

  // 前後各 7 天的其他任務就足夠判斷連續天數；排除自己與已取消的任務
  const tasks = await q(`SELECT t.id::text AS id, t.task_date::text AS date, t.time_mode,
      to_char(t.start_time, 'HH24:MI') AS start_time, to_char(t.end_time, 'HH24:MI') AS end_time,
      array_agg(ta.user_id::text) AS assignee_ids
    FROM tasks t JOIN task_assignees ta ON ta.task_id = t.id
    WHERE ta.user_id = ANY($1::bigint[]) AND t.status <> 'CANCELLED' AND t.task_date IS NOT NULL
      AND t.task_date BETWEEN ($2::date - 7) AND ($2::date + 7)
      AND ($3::bigint IS NULL OR t.id <> $3::bigint)
    GROUP BY t.id`, [ids, state.date, state.taskId ?? null]);
  ctx.otherTasks = tasks.rows.map((r) => ({
    date: r.date,
    timeMode: r.time_mode,
    startTime: r.start_time,
    endTime: r.end_time,
    assigneeIds: r.assignee_ids.filter((x) => ids.includes(x)),
  }));
  return ctx;
};

const requiredLicensesOf = async (q, customerId) => {
  const r = await q('SELECT license_restriction FROM customers WHERE id = $1::bigint', [customerId]);
  return REQUIRED_BY_RESTRICTION[r.rows[0]?.license_restriction] || [];
};

// state：{ taskId?, customerId, date, timeMode, startTime, endTime, headcount, assigneeIds }（id 都是字串）
export const runAlerts = async (q, state) => {
  const ctx = await loadAlertContext(q, state);
  const requiredLicenses = state.assigneeIds.length > 0 ? await requiredLicensesOf(q, state.customerId) : [];
  return evaluateAlerts({ ...state, requiredLicenses }, ctx);
};

const conflictError = (violations) => {
  const onlyLicense = violations.every((v) => v.ruleId === 'LICENSE_REQUIRED');
  const code = onlyLicense ? ERROR_CODES.LICENSE_CONFLICT : ERROR_CODES.SCHEDULE_CONFLICT;
  const text = violations.map((v) => v.message).join('；');
  return new AppError(422, code, `排班警示：${text}（如需放行請填寫特許備註）`, violations);
};

// 存檔前的檢查。沒有違規 → CLEAN；有違規且沒帶特許備註 → 422；帶了備註但沒有特許權限 → 403。
export const enforceAlerts = async (q, user, state, overrideRemark) => {
  const result = await runAlerts(q, state);
  if (result.violations.length === 0) return { result, alertStatus: 'CLEAN' };
  if (!overrideRemark) throw conflictError(result.violations);
  if (!hasPermission(user, OVERRIDE_PERMISSION)) {
    throw new AppError(403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, '權限不足：沒有特許排班警示的權限');
  }
  return { result, alertStatus: 'OVERRIDDEN' };
};

// 把結果寫進資料庫：任務的警示狀態、違規清單（task_alerts）；特許時另記稽核紀錄（audit_logs）
// by：操作者的使用者 id
export const recordAlerts = async (q, by, taskId, enforced, overrideRemark) => {
  const { result, alertStatus } = enforced;
  await q('UPDATE tasks SET alert_status = $2 WHERE id = $1::bigint', [taskId, alertStatus]);
  await q('DELETE FROM task_alerts WHERE task_id = $1::bigint', [taskId]);
  for (const v of result.violations) {
    await q(`INSERT INTO task_alerts (task_id, rule_id, severity, message, details)
      VALUES ($1::bigint, $2, $3, $4, $5::jsonb)`,
    [taskId, v.ruleId, v.severity, v.message, JSON.stringify({ ...v.details, affectedEmployees: v.affectedEmployees ?? [] })]);
  }
  if (alertStatus === 'OVERRIDDEN') {
    await q(`INSERT INTO audit_logs (action_type, operator_id, target_type, target_id, details)
      VALUES ('ALERT_OVERRIDE', $1::bigint, 'TASK', $2, $3::jsonb)`,
    [by, String(taskId), JSON.stringify({ remark: overrideRemark, rules: result.violations.map((v) => v.ruleId) })]);
  }
};

