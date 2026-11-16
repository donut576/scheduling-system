import { query } from '../db.js';
import { upsertTaskNotification } from './inAppNotifications.js';

// 任務異動事件層：任務有「建立／修改／取消／換人」時，在同一個資料庫交易裡記一筆待通知（notification_changes）。
// 之後由「站內通知」與「每日合併寄信」讀這張表，不需要再去比對任務。
//
// 規則：
// - 只有「已排班」的任務（SCHEDULED／MODIFIED／CONFIRMED）才會通知；待排、待核准、已取消都視為「看不到」。
// - 變成看得到 → 所有收件人 CREATED；變成看不到（取消、移回待排）→ 所有收件人 DELETED。
// - 一直看得到但內容有變 → 兩邊都在的收件人 UPDATED；只在新的 → CREATED；只在舊的（被換掉）→ DELETED。
// - 收件人：任務的施作同仁（EMPLOYEE）＋客戶的聯絡人（CUSTOMER）。
// 最後實際標成「新增／修改／取消」，要等寄出時比對「上次寄出的版本」才決定，這裡只記事實。

export const VISIBLE_STATUSES = ['SCHEDULED', 'MODIFIED', 'CONFIRMED'];

// 員工只在這些欄位變動時才算「修改」；客戶看不到施作同仁，所以 assignees 只對員工算
const TASK_FIELDS = ['branchId', 'date', 'timeMode', 'startTime', 'endTime', 'timeRemark', 'address', 'contents', 'remarks'];

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// 讀出一筆任務目前「與通知有關」的完整狀態；任務不存在回傳 null
export const snapshotTask = async (q, taskId) => {
  const r = await q(`SELECT t.id::text AS id, t.status, t.task_type AS "taskType", t.customer_id::text AS "branchId",
      t.task_date::text AS date, t.time_mode AS "timeMode",
      to_char(t.start_time, 'HH24:MI') AS "startTime", to_char(t.end_time, 'HH24:MI') AS "endTime",
      t.time_remark AS "timeRemark", t.remarks, sh.name AS shift, c.address, c.name AS "branchName", g.name AS "groupName",
      COALESCE((SELECT array_agg(sc.code ORDER BY sc.code) FROM task_contents tc JOIN service_contents sc ON sc.id = tc.content_id
        WHERE tc.task_id = t.id), '{}') AS contents,
      COALESCE((SELECT json_agg(json_build_object('employeeId', u.id::text, 'employeeName', u.name) ORDER BY u.id)
        FROM task_assignees ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = t.id), '[]'::json) AS assignees,
      COALESCE((SELECT array_agg(cc.id::text ORDER BY cc.id) FROM customer_contacts cc WHERE cc.customer_id = t.customer_id), '{}') AS "contactIds"
    FROM tasks t JOIN customers c ON c.id = t.customer_id JOIN customer_groups g ON g.id = c.group_id
    LEFT JOIN shifts sh ON sh.id = t.shift_id
    WHERE t.id = $1::bigint`, [taskId]);
  return r.rows[0] ?? null;
};

export const isVisible = (s) => Boolean(s && VISIBLE_STATUSES.includes(s.status));

const recipientsOf = (s) => {
  const m = new Map();
  if (!isVisible(s)) return m;
  for (const a of s.assignees) m.set(`E${a.employeeId}`, { type: 'EMPLOYEE', id: a.employeeId });
  for (const id of s.contactIds) m.set(`C${id}`, { type: 'CUSTOMER', id });
  return m;
};

// 任務屬於哪個群組（寄信用哪位主任的發送時間、日曆與儀表板的任務顏色都用這個）：
// 由「客戶分店地址（縣市＋行政區）」找出涵蓋的群組，再挑出一個。
// 同一個行政區可能同時屬於早班群組與晚班群組（例：士林同時是北早、北一晚），所以挑選順序是：
//   1. 群組名稱結尾與「任務班別」相符（早班 → 「…早」、晚班 → 「…晚」）——任務本身的班別優先，
//      所以早班同仁去支援晚班任務，任務仍屬於晚班群組
//   2. 同班別還有多個群組時（例：北一晚、北二晚），有施作同仁所屬的群組優先
//   3. id 最小的
// 早班、晚班因此落在不同群組（不同 region_id），寄信時不會合併成同一封。
export const pickRegion = (candidates, { assigneeRegionIds = [], shift = null } = {}) => {
  if (candidates.length === 0) return null;
  const suffix = shift === '早班' ? '早' : shift === '晚班' ? '晚' : null;
  const score = (c) => (suffix && c.name.endsWith(suffix) ? 0 : 2) + (assigneeRegionIds.includes(c.id) ? 0 : 1);
  return [...candidates].sort((a, b) => score(a) - score(b) || Number(a.id) - Number(b.id))[0].id;
};

const regionOfTask = async (q, customerId, state) => {
  const cand = await q(`SELECT DISTINCT r.id::text AS id, r.name FROM customers c
    JOIN region_areas ra ON ra.city = c.city AND (ra.district IS NULL OR ra.district = c.district)
    JOIN regions r ON r.id = ra.region_id AND r.leader_id IS NOT NULL
    WHERE c.id = $1::bigint`, [customerId]);
  const ids = state.assignees.map((a) => a.employeeId);
  const own = ids.length
    ? (await q('SELECT DISTINCT region_id::text AS id FROM users WHERE id = ANY($1::bigint[]) AND region_id IS NOT NULL', [ids])).rows.map((r) => r.id)
    : [];
  return pickRegion(cand.rows, { assigneeRegionIds: own, shift: state.shift });
};

export const diffFields = (before, after, isEmployee) => {
  const fields = TASK_FIELDS.filter((k) => !same(before[k], after[k]));
  if (isEmployee && !same(before.assignees, after.assignees)) fields.push('assignees');
  return fields;
};

// 計算兩個狀態之間要記的事件（純函式，方便測試）。before 為 null 代表剛建立。
export const diffTaskChanges = (before, after) => {
  const was = recipientsOf(before);
  const now = recipientsOf(after);
  const events = [];
  for (const [key, rcp] of now) {
    if (!was.has(key)) {
      events.push({ ...rcp, changeType: 'CREATED', detail: { after } });
      continue;
    }
    const fields = diffFields(before, after, rcp.type === 'EMPLOYEE');
    if (fields.length > 0) events.push({ ...rcp, changeType: 'UPDATED', detail: { changedFields: fields, before, after } });
  }
  for (const [key, rcp] of was) {
    if (!now.has(key)) events.push({ ...rcp, changeType: 'DELETED', detail: { before, after } });
  }
  return events;
};

// 把異動寫進 notification_changes。呼叫端在「改動之前」先 snapshotTask 取得 before，改動完成後呼叫這個函式。
export const recordTaskChange = async (q, taskId, before) => {
  const after = await snapshotTask(q, taskId);
  if (!after) return [];
  const events = diffTaskChanges(before, after);
  if (events.length === 0) return [];
  // 取消時施作同仁仍在任務上，所以用改完的狀態即可；員工被換掉時，新舊同仁都納入判斷
  const regionId = await regionOfTask(q, after.branchId, { ...after, assignees: [...after.assignees, ...(before?.assignees ?? [])] });
  const changeDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  for (const e of events) {
    // eslint-disable-next-line no-await-in-loop
    const ins = await q(`INSERT INTO notification_changes (task_id, change_type, recipient_type, recipient_user_id, recipient_contact_id, region_id, change_date, detail)
      VALUES ($1::bigint, $2, $3, $4::bigint, $5::bigint, $6::bigint, $7::date, $8::jsonb) RETURNING id`,
    [taskId, e.changeType, e.type, e.type === 'EMPLOYEE' ? e.id : null, e.type === 'CUSTOMER' ? e.id : null,
      regionId, changeDate, JSON.stringify(e.detail)]);
    // 員工的站內通知是即時的：馬上寫（或更新）。這筆異動仍維持 PENDING，等每日合併寄信時一起寄給員工（信件是另一條路）
    if (e.type === 'EMPLOYEE') {
      // eslint-disable-next-line no-await-in-loop
      const notificationId = await upsertTaskNotification(q, taskId, e);
      // eslint-disable-next-line no-await-in-loop
      await q('UPDATE notification_changes SET notification_id = $2::bigint WHERE id = $1::bigint', [ins.rows[0].id, notificationId]);
    }
  }
  return events;
};

export const listPendingChanges = (taskId) => query(
  'SELECT * FROM notification_changes WHERE task_id = $1::bigint ORDER BY id', [taskId]);
