import { AppError, ERROR_CODES } from '../utils/response.js';
import { hasPermission } from '../middleware/permission.js';
import { evaluateAlerts } from './alertRules.js';

// 客戶的證照限制 → 要求的證照代碼（與客戶 API 的 requiredLicenses 同一套對應）
const REQUIRED_BY_RESTRICTION = { PEST_CONTROL: ['PEST_CONTROL'], PROFESSIONAL: ['PROFESSIONAL'] };

export const OVERRIDE_PERMISSION = 'task:override_alert';
// 有這個權限（目前是經理＝副總、管理員）的人自己就能放行違規；其他人只能送出核准申請
export const APPROVE_PERMISSION = 'approval:approve';
export const LICENSE_RULE = 'LICENSE_REQUIRED';

// 有任何警示違規（證照、連續上班、工時、重複排班、指定休假），且登入者不能核准 → 要送副總（經理）核准。
export const needsApprovalFor = (user, violations) =>
  violations.length > 0 && !hasPermission(user, APPROVE_PERMISSION);

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

const conflictError = (user, violations) => {
  const onlyLicense = violations.every((v) => v.ruleId === LICENSE_RULE);
  const code = onlyLicense ? ERROR_CODES.LICENSE_CONFLICT : ERROR_CODES.SCHEDULE_CONFLICT;
  const text = violations.map((v) => v.message).join('；');
  const hint = needsApprovalFor(user, violations)
    ? '需經理（副總）核准，請填寫申請備註後送出核准'
    : '如需放行請填寫特許備註';
  return new AppError(422, code, `排班警示：${text}（${hint}）`, violations);
};

// 存檔前的檢查。沒有違規 → CLEAN；有違規且沒帶特許備註 → 422；帶了備註但沒有特許權限 → 403。
// 帶了備註且有違規、登入者不能核准 → alertStatus 為 VIOLATED、needsApproval 為 true（任務存成「待核准」並建立核准申請）。
export const enforceAlerts = async (q, user, state, overrideRemark) => {
  const result = await runAlerts(q, state);
  if (result.violations.length === 0) return { result, alertStatus: 'CLEAN' };
  if (!overrideRemark) throw conflictError(user, result.violations);
  if (!hasPermission(user, OVERRIDE_PERMISSION)) {
    throw new AppError(403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, '權限不足：沒有特許排班警示的權限');
  }
  const needsApproval = needsApprovalFor(user, result.violations);
  return { result, alertStatus: needsApproval ? 'VIOLATED' : 'OVERRIDDEN', needsApproval };
};

// 送出核准申請：找一位啟用中的經理當核准人（任何有核准權限的人都能處理，處理時會換成實際核准的人）。
// 同一任務原本待核准的申請會先撤回。
export const submitApproval = async (q, by, taskId, violations, remark) => {
  const mgr = await q(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.code = 'MANAGER' AND u.is_active ORDER BY u.id LIMIT 1`);
  if (mgr.rows.length === 0) {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, '目前沒有可核准的經理（副總）帳號，無法送出核准申請');
  }
  await q(`UPDATE approvals SET status = 'WITHDRAWN', updated_at = now() WHERE task_id = $1::bigint AND status = 'PENDING'`, [taskId]);
  const ins = await q(`INSERT INTO approvals (task_id, type, requested_by, change_summary, override_remark)
    VALUES ($1::bigint, 'ALERT_OVERRIDE', $2::bigint, $3, $4) RETURNING id`,
  [taskId, by, `排班警示特許申請：${violations.map((v) => v.message).join('；')}`, remark]);
  await q('INSERT INTO approval_steps (approval_id, step_no, approver_id) VALUES ($1::bigint, 1, $2::bigint)',
    [ins.rows[0].id, mgr.rows[0].id]);
  return ins.rows[0].id;
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

