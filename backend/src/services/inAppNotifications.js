import { query } from '../db.js';
import { AppError } from '../utils/response.js';
import { parsePaging, toPage } from '../utils/pagination.js';

// 站內通知（員工的「近期任務異動」、主任的系統通知）。
// 員工的任務異動是即時的：同一位員工、同一個任務只有一筆通知，之後的異動更新同一筆——
// 標籤改成最新動作、時間更新、重設為未讀，歷程記在 history。

const ACTION_OF = { CREATED: 'CREATED', UPDATED: 'UPDATED', DELETED: 'CANCELED' };
const TYPE_OF = { CREATED: 'TASK_CREATED', UPDATED: 'TASK_UPDATED', CANCELED: 'TASK_CANCELED' };
const ACTION_TEXT = { CREATED: '新增', UPDATED: '修改', CANCELED: '取消' };
export const HISTORY_LIMIT = 20;
const NOT_FOUND_CODE = 40404; // 前端 errorCodes 沒有通用的「找不到」，用 404xx 系列的新代碼

const hhmm = (t) => (t ? t.replace(':', '') : undefined);
const mmdd = (d) => (d ? d.slice(5).replace('-', '/') : '');

// 後端的欄位名 → 前端 TaskChangeField
const FIELD_OF = { date: 'date', timeMode: 'time', startTime: 'time', endTime: 'time', timeRemark: 'timeRemark',
  address: 'location', branchId: 'location', contents: 'contents', remarks: 'remarks' };
const toChangedFields = (fields = []) => [...new Set(fields.map((f) => FIELD_OF[f]).filter(Boolean))];

// 被修改欄位的「原本內容」（前端用淺灰＋刪除線顯示）
const previousOf = (before, changed) => {
  const p = {};
  if (changed.includes('date')) p.date = before.date ?? undefined;
  if (changed.includes('time')) { p.time = hhmm(before.startTime); p.flexible = before.timeMode === 'FLEXIBLE'; }
  if (changed.includes('timeRemark')) p.timeRemark = before.timeRemark ?? undefined;
  if (changed.includes('location')) p.address = before.address ?? undefined;
  if (changed.includes('contents')) p.contents = before.contents;
  if (changed.includes('remarks')) p.remarks = before.remarks ?? undefined;
  return p;
};

// 組出前端 TaskChangePayload（純函式）。state：取消時用取消前的內容
export const buildPayload = (action, state, event) => {
  const changedFields = action === 'UPDATED' ? toChangedFields(event.detail.changedFields) : [];
  return {
    kind: 'TASK_CHANGE',
    groupName: state.groupName, branchName: state.branchName, taskType: state.taskType,
    date: state.date, time: hhmm(state.startTime), flexible: state.timeMode === 'FLEXIBLE',
    timeRemark: state.timeRemark ?? undefined, address: state.address ?? undefined,
    contents: state.contents, remarks: state.remarks ?? undefined, assignees: state.assignees,
    changedFields,
    previous: action === 'UPDATED' ? previousOf(event.detail.before, changedFields) : undefined,
  };
};

// 把這次異動接到歷程後面（純函式）；最多留 HISTORY_LIMIT 筆，舊的丟掉
export const appendHistory = (history, entry) => [...(history ?? []), entry].slice(-HISTORY_LIMIT);

// 員工的任務異動 → 新增或更新同一筆站內通知。回傳通知 id。
export const upsertTaskNotification = async (q, taskId, event) => {
  const action = ACTION_OF[event.changeType];
  const state = event.changeType === 'DELETED' ? event.detail.before : event.detail.after;
  const payload = buildPayload(action, state, event);
  const subject = `任務${ACTION_TEXT[action]}：${state.groupName} · ${state.branchName} ${mmdd(state.date)}`;
  const content = `${ACTION_TEXT[action]}：${mmdd(state.date)} ${state.timeMode === 'FLEXIBLE' ? '彈性' : hhmm(state.startTime) ?? ''} ${state.groupName} · ${state.branchName}`.trim();
  const entry = { action, at: new Date().toISOString(), changedFields: payload.changedFields, previous: payload.previous };
  // 先鎖住既有的那一筆，再合併歷程
  const cur = await q(`SELECT id, history FROM notifications WHERE channel = 'IN_APP' AND recipient_user_id = $1::bigint AND task_id = $2::bigint FOR UPDATE`,
    [event.id, taskId]);
  if (cur.rows[0]) {
    await q(`UPDATE notifications SET type = $2, action = $3, subject = $4, content = $5, payload = $6::jsonb, history = $7::jsonb,
        is_read = false, read_at = NULL, created_at = now(), updated_at = now() WHERE id = $1::bigint`,
    [cur.rows[0].id, TYPE_OF[action], action, subject, content, JSON.stringify(payload), JSON.stringify(appendHistory(cur.rows[0].history, entry))]);
    return String(cur.rows[0].id);
  }
  const ins = await q(`INSERT INTO notifications (type, channel, action, recipient_user_id, task_id, subject, content, payload, history)
    VALUES ($1, 'IN_APP', $2, $3::bigint, $4::bigint, $5, $6, $7::jsonb, $8::jsonb) RETURNING id`,
  [TYPE_OF[action], action, event.id, taskId, subject, content, JSON.stringify(payload), JSON.stringify([entry])]);
  return String(ins.rows[0].id);
};

const SELECT = `SELECT n.id::text AS id, n.type, n.recipient_user_id::text AS "recipientId", u.name AS "recipientName",
    n.subject, n.content, n.task_id::text AS "taskId", n.is_read AS "isRead", n.read_at AS "readAt",
    n.created_at AS "createdAt", n.payload, n.history, n.action
  FROM notifications n JOIN users u ON u.id = n.recipient_user_id`;

const toDto = (r) => ({
  ...r, recipientType: 'EMPLOYEE', status: 'NOTIFIED', sentAt: r.createdAt,
  readAt: r.readAt ?? undefined, payload: r.payload ? { ...r.payload, history: r.history } : undefined,
});

const myId = async (user) => (await query('SELECT id FROM users WHERE employee_no = $1', [user.no ?? ''])).rows[0]?.id;

// 站內通知只看自己的（員工、主任、副理都一樣）；channel 以外的「郵件通知紀錄」之後由寄信那一步提供
export const listMyNotifications = async (user, rawQuery) => {
  const paging = parsePaging(rawQuery);
  if (rawQuery.channel !== 'IN_APP') return toPage([], 0, paging);
  const me = await myId(user);
  const values = [me];
  let where = `n.channel = 'IN_APP' AND n.recipient_user_id = $1::bigint`;
  if (rawQuery.type) { values.push(String(rawQuery.type)); where += ` AND n.type = $${values.length}`; }
  const total = (await query(`SELECT count(*)::int AS c FROM notifications n WHERE ${where}`, values)).rows[0].c;
  values.push(paging.limit, paging.offset);
  const r = await query(`${SELECT} WHERE ${where} ORDER BY n.created_at DESC, n.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return toPage(r.rows.map(toDto), total, paging);
};

export const markRead = async (user, id) => {
  if (!/^\d+$/.test(String(id))) throw new AppError(404, NOT_FOUND_CODE, '找不到此通知');
  const r = await query(`UPDATE notifications SET is_read = true, read_at = COALESCE(read_at, now())
    WHERE id = $1::bigint AND channel = 'IN_APP' AND recipient_user_id = $2::bigint RETURNING id`, [id, await myId(user)]);
  if (r.rows.length === 0) throw new AppError(404, NOT_FOUND_CODE, '找不到此通知');
  return null;
};

export const markAllRead = async (user) => {
  await query(`UPDATE notifications SET is_read = true, read_at = now()
    WHERE channel = 'IN_APP' AND recipient_user_id = $1::bigint AND NOT is_read`, [await myId(user)]);
  return null;
};
