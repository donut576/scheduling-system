import { withTransaction, query } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { parsePaging, toPage } from '../utils/pagination.js';
import { hasPermission } from '../middleware/permission.js';
import { fail, currentUserId, isFullyScheduled } from './taskWrite.js';
import { APPROVE_PERMISSION } from './alerts.js';

// 異動核准：排班警示（任何一條規則違規）的特許要核准（核准人 = 經理，也就是副總）。
// 申請時任務存成「待核准」（不出現在班表與待排）；核准 → 依任務內容變成已排班；駁回 → 任務取消。

const LIST_SCHEMA = {
  status: { type: 'enum', values: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] },
  type: { type: 'enum', values: ['TASK_CHANGE', 'ALERT_OVERRIDE', 'SCHEDULE_CHANGE', 'SHIFT_CHANGE'] },
  keyword: { type: 'string', max: 100 },
  requestedBy: { type: 'string', max: 50 },
};
const COMMENT_SCHEMA = { comment: { type: 'string', max: 500 } };

const notFound = () => new AppError(404, ERROR_CODES.TASK_NOT_FOUND, '找不到此核准申請');
const iso = (d) => (d instanceof Date ? d.toISOString() : d);
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const SELECT = `SELECT a.id::text AS id, a.task_id::text AS task_id, a.type, a.status, a.requested_by::text AS requested_by,
    ru.name AS requested_by_name, a.change_summary, a.diff, a.override_remark, a.created_at, a.updated_at,
    COALESCE((SELECT array_agg(ta.rule_id ORDER BY ta.id) FROM task_alerts ta WHERE ta.task_id = a.task_id), '{}') AS rules,
    COALESCE((SELECT json_agg(json_build_object('approverId', s.approver_id::text, 'approverName', su.name,
      'role', sr.code, 'status', s.status, 'comment', s.comment, 'decidedAt', s.decided_at) ORDER BY s.step_no)
      FROM approval_steps s JOIN users su ON su.id = s.approver_id JOIN roles sr ON sr.id = su.role_id
      WHERE s.approval_id = a.id), '[]') AS approvers
  FROM approvals a JOIN users ru ON ru.id = a.requested_by`;

const toApproval = (r) => ({
  id: r.id,
  taskId: r.task_id,
  type: r.type,
  status: r.status,
  requestedBy: r.requested_by,
  requestedByName: r.requested_by_name,
  changeSummary: r.change_summary ?? undefined,
  diff: r.diff ?? undefined,
  overrideRemark: r.override_remark ?? undefined,
  violatedRules: r.rules,
  approvers: r.approvers.map((s) => ({ ...s, comment: s.comment ?? undefined, decidedAt: s.decidedAt ?? undefined })),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

// 列表：能核准的人（經理、管理員）看全部；其他人（組長）只看自己送出的申請
export const listApprovals = async (user, rawQuery) => {
  const f = validate(rawQuery, LIST_SCHEMA);
  const paging = parsePaging(rawQuery);
  const me = await currentUserId(query, user);
  const where = []; const values = [];
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };
  if (!hasPermission(user, APPROVE_PERMISSION)) add('a.requested_by = ?::bigint', me ?? -1);
  else if (f.requestedBy) {
    values.push(f.requestedBy);
    where.push(`(a.requested_by::text = $${values.length} OR ru.name = $${values.length})`);
  }
  if (f.status) add('a.status = ?', f.status);
  if (f.type) add('a.type = ?', f.type);
  if (f.keyword) {
    values.push(`%${likeEscape(f.keyword)}%`);
    const n = values.length;
    where.push(`(a.id::text LIKE $${n} ESCAPE '\\' OR ru.name LIKE $${n} ESCAPE '\\' OR a.change_summary LIKE $${n} ESCAPE '\\')`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query(`SELECT count(*)::int AS n FROM approvals a JOIN users ru ON ru.id = a.requested_by ${w}`, values)).rows[0].n;
  const rows = await query(`${SELECT} ${w} ORDER BY a.created_at DESC, a.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, paging.limit, paging.offset]);
  return toPage(rows.rows.map(toApproval), total, paging);
};

// 鎖住申請與任務；申請必須還在「待核准」
const lockPending = async (q, id) => {
  const approvalId = parseId(id);
  const a = await q('SELECT id, task_id, status, requested_by FROM approvals WHERE id = $1::bigint FOR UPDATE', [approvalId]);
  if (a.rows.length === 0) throw notFound();
  if (a.rows[0].status !== 'PENDING') throw fail('此申請已處理過，不能再操作');
  return a.rows[0];
};

const finish = async (q, approvalId, status, by, comment) => {
  await q('UPDATE approvals SET status = $2, updated_at = now() WHERE id = $1::bigint', [approvalId, status]);
  // 實際處理的人記在步驟上（任何有核准權限的人都能處理）
  await q(`UPDATE approval_steps SET status = $2, approver_id = COALESCE($3::bigint, approver_id), comment = $4, decided_at = now()
    WHERE approval_id = $1::bigint`, [approvalId, status, by, comment ?? null]);
};

const audit = (q, by, taskId, details) => q(`INSERT INTO audit_logs (action_type, operator_id, target_type, target_id, details)
  VALUES ('ALERT_OVERRIDE', $1::bigint, 'TASK', $2, $3::jsonb)`, [by, String(taskId), JSON.stringify(details)]);

// 核准：任務依內容變成已排班（人數、日期、時間齊全），警示狀態記為已特許
export const approve = async (user, id, raw) => {
  const { comment } = validate(raw, COMMENT_SCHEMA);
  await withTransaction(async (q) => {
    const a = await lockPending(q, id);
    const t = await q(`SELECT t.status, t.task_date::text AS date, t.time_mode, t.start_time, t.end_time, t.headcount,
        (SELECT count(*)::int FROM task_assignees WHERE task_id = t.id) AS n
      FROM tasks t WHERE t.id = $1::bigint FOR UPDATE`, [a.task_id]);
    const task = t.rows[0];
    if (!task || task.status !== 'PENDING_APPROVAL') throw fail('任務已不在待核准狀態，無法核准');
    const status = isFullyScheduled({ date: task.date, timeMode: task.time_mode, startTime: task.start_time, endTime: task.end_time,
      headcount: task.headcount, assigneeCount: task.n }) ? 'SCHEDULED' : 'UNSCHEDULED';
    await q(`UPDATE tasks SET status = $2, alert_status = 'OVERRIDDEN', updated_at = now() WHERE id = $1::bigint`, [a.task_id, status]);
    const by = await currentUserId(q, user);
    await finish(q, a.id, 'APPROVED', by, comment);
    await audit(q, by, a.task_id, { result: 'APPROVED', approvalId: String(a.id), comment: comment ?? null });
  });
  return null;
};

// 駁回：任務回到待排區（未排班），清掉違規的指派人員，保留原日期與時段；
// 駁回原因與被移除的人員記在任務上，一直顯示到重新排班（變回已排班）為止。駁回原因必填。
export const reject = async (user, id, raw) => {
  const { comment } = validate(raw, COMMENT_SCHEMA);
  if (!comment) throw fail('資料驗證失敗：駁回需要填寫原因（comment）');
  await withTransaction(async (q) => {
    const a = await lockPending(q, id);
    const t = await q('SELECT status FROM tasks WHERE id = $1::bigint FOR UPDATE', [a.task_id]);
    if (!t.rows[0] || t.rows[0].status !== 'PENDING_APPROVAL') throw fail('任務已不在待核准狀態，無法駁回');
    const names = await q(`SELECT string_agg(u.name, '、' ORDER BY u.name) AS names
      FROM task_assignees ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = $1::bigint`, [a.task_id]);
    await q('DELETE FROM task_assignees WHERE task_id = $1::bigint', [a.task_id]);
    await q('DELETE FROM task_alerts WHERE task_id = $1::bigint', [a.task_id]);
    await q(`UPDATE tasks SET status = 'UNSCHEDULED', alert_status = 'CLEAN', override_remark = NULL,
        reject_reason = $2, rejected_assignees = $3, updated_at = now() WHERE id = $1::bigint`,
    [a.task_id, comment, names.rows[0]?.names ?? null]);
    const by = await currentUserId(q, user);
    await finish(q, a.id, 'REJECTED', by, comment);
    await audit(q, by, a.task_id, { result: 'REJECTED', approvalId: String(a.id), comment });
  });
  return null;
};

// 撤回：只有申請人本人，或有核准權限的人可以；撤回後任務取消（沒有核准就不能留在班表）
export const withdraw = async (user, id) => {
  await withTransaction(async (q) => {
    const a = await lockPending(q, id);
    const by = await currentUserId(q, user);
    if (String(a.requested_by) !== String(by) && !hasPermission(user, APPROVE_PERMISSION)) {
      throw new AppError(403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, '權限不足：只能撤回自己送出的申請');
    }
    await q(`UPDATE tasks SET status = 'CANCELLED', updated_at = now() WHERE id = $1::bigint`, [a.task_id]);
    await finish(q, a.id, 'WITHDRAWN', null, null);
  });
  return null;
};
