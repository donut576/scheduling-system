import { withTransaction } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { getScope, customerScopeCondition } from './scope.js';
import { TASK_TYPES, getTask } from './tasks.js';
import { enforceAlerts, recordAlerts } from './alerts.js';

const REPORT_TYPES = ['APP', 'EDM', 'PAPER', 'PHOTO'];

// 前端 TaskFormData 的欄位（沒列在這裡的，例如照片欄位、前端自己算的 status，會被忽略）
export const BODY_SCHEMA = {
  branchId: { type: 'string', max: 18 },
  taskType: { type: 'enum', values: TASK_TYPES },
  date: { type: 'date' },
  startTime: { type: 'time' },
  endTime: { type: 'time' },
  timeMode: { type: 'enum', values: ['FIXED', 'FLEXIBLE'] },
  timeRemark: { type: 'string', max: 200 },
  headcount: { type: 'int', min: 1, max: 99 },
  shift: { type: 'string', max: 20 },
  route: { type: 'string', max: 50 },
  contents: { type: 'array', max: 20, of: { type: 'string', max: 30 } },
  otherContentNote: { type: 'string', max: 200 },
  assignees: { type: 'array', max: 50, of: { type: 'string', max: 18 } },
  remarks: { type: 'string', max: 1000 },
  isMakeup: { type: 'boolean' },
  originalDate: { type: 'date' },
  makeupReason: { type: 'string', max: 200 },
  reportTypes: { type: 'array', max: 4, of: { type: 'enum', values: REPORT_TYPES } },
  reportNotes: { type: 'string', max: 1000 },
  overrideRemark: { type: 'string', max: 500 },
};

// 修改時，這些欄位傳空字串或 null 代表「清空」（validate 會把空值丟掉，所以要另外記下來）
const CLEARABLE = ['date', 'startTime', 'endTime', 'timeRemark', 'shift', 'route', 'otherContentNote',
  'remarks', 'originalDate', 'makeupReason', 'reportNotes', 'overrideRemark'];

export const fail = (msg) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, msg);

// 前端「已排班」的判斷：人數到齊、有日期、時間齊全（彈性任務不需要時間）。其餘都是未排班。
export const isFullyScheduled = ({ date, timeMode, startTime, endTime, headcount, assigneeCount }) =>
  assigneeCount > 0 && assigneeCount >= headcount && Boolean(date)
  && (timeMode === 'FLEXIBLE' || Boolean(startTime && endTime));

// 新增：條件齊全 → 已排班，否則未排班
export const statusForCreate = (s) => (isFullyScheduled(s) ? 'SCHEDULED' : 'UNSCHEDULED');

// 修改：條件不齊 → 未排班；原本未排班變齊全 → 已排班；原本已排班的再改動 → 已更改
export const statusForUpdate = (oldStatus, s) => {
  if (!isFullyScheduled(s)) return 'UNSCHEDULED';
  return oldStatus === 'UNSCHEDULED' ? 'SCHEDULED' : 'MODIFIED';
};

// 固定時段需要起訖時間；結束早於開始 = 跨夜
export const checkTimes = ({ timeMode, startTime, endTime }) => {
  if (timeMode === 'FLEXIBLE') return { startTime: null, endTime: null, isOvernight: false };
  if (!startTime || !endTime) throw fail('資料驗證失敗：固定時段必須填寫開始與結束時間');
  return { startTime, endTime, isOvernight: endTime < startTime };
};

const rejectRecurrence = (raw) => {
  if (raw && raw.recurrence !== undefined && raw.recurrence !== null) {
    throw fail('循環任務尚未支援，請先取消「循環」後以單筆任務建立');
  }
};

const parseIds = (list, label) => list.map((v) => {
  try { return parseId(v); } catch { throw fail(`資料驗證失敗：${label} id 格式錯誤`); }
});

export const currentUserId = async (q, user) => {
  const r = await q('SELECT id FROM users WHERE employee_no = $1', [user.no ?? '']);
  return r.rows[0]?.id ?? null;
};

// 客戶必須啟用中、且在登入者可看的轄區內；否則一律回「找不到客戶」
export const requireCustomer = async (q, scope, customerId) => {
  const values = [customerId];
  const cond = customerScopeCondition(scope, values);
  const r = await q(`SELECT c.id FROM customers c
    WHERE c.id = $1::bigint AND c.is_active ${cond ? `AND ${cond}` : ''}`, values);
  if (r.rows.length === 0) throw new AppError(404, ERROR_CODES.CUSTOMER_NOT_FOUND, '找不到此客戶');
};

const shiftIdByName = async (q, name) => {
  if (!name) return null;
  const r = await q('SELECT id FROM shifts WHERE name = $1', [name]);
  if (r.rows.length === 0) throw fail(`資料驗證失敗：找不到班別「${name}」`);
  return r.rows[0].id;
};

const contentIdsByCode = async (q, codes) => {
  const uniq = [...new Set(codes)];
  const r = await q('SELECT id, code FROM service_contents WHERE code = ANY($1::text[])', [uniq]);
  const found = new Set(r.rows.map((x) => x.code));
  const missing = uniq.filter((c) => !found.has(c));
  if (missing.length) throw fail(`資料驗證失敗：找不到任務內容 ${missing.join('、')}`);
  return r.rows.map((x) => x.id);
};

export const assigneeIds = async (q, ids) => {
  const uniq = [...new Set(parseIds(ids, '指派人員'))];
  if (uniq.length === 0) return [];
  const r = await q('SELECT id FROM users WHERE id = ANY($1::bigint[]) AND is_active', [uniq]);
  if (r.rows.length !== uniq.length) throw fail('資料驗證失敗：指派人員不存在或已停用');
  return uniq;
};

const replaceRelations = async (q, taskId, { contentIds, assigneeIdList, by }) => {
  if (contentIds) {
    await q('DELETE FROM task_contents WHERE task_id = $1::bigint', [taskId]);
    if (contentIds.length) {
      await q('INSERT INTO task_contents (task_id, content_id) SELECT $1::bigint, unnest($2::bigint[])', [taskId, contentIds]);
    }
  }
  if (assigneeIdList) {
    await q('DELETE FROM task_assignees WHERE task_id = $1::bigint', [taskId]);
    if (assigneeIdList.length) {
      await q('INSERT INTO task_assignees (task_id, user_id, assigned_by) SELECT $1::bigint, unnest($2::bigint[]), $3::bigint',
        [taskId, assigneeIdList, by]);
    }
  }
};

export const createTask = async (user, raw) => {
  rejectRecurrence(raw);
  const b = validate(raw, BODY_SCHEMA);
  if (!b.branchId) throw fail('資料驗證失敗：branchId 必填');
  if (!b.taskType) throw fail('資料驗證失敗：taskType 必填');
  if (!b.contents || b.contents.length === 0) throw fail('資料驗證失敗：contents 至少選一個任務內容');
  const timeMode = b.timeMode || 'FIXED';
  if (timeMode === 'FLEXIBLE' && !b.date) throw fail('資料驗證失敗：彈性任務必須填寫日期');
  const times = checkTimes({ timeMode, startTime: b.startTime, endTime: b.endTime });
  const branchId = parseId(b.branchId);
  const scope = await getScope(user);

  const taskId = await withTransaction(async (q) => {
    await requireCustomer(q, scope, branchId);
    // 同一個連線上的查詢依序執行
    const shiftId = await shiftIdByName(q, b.shift);
    const contentIds = await contentIdsByCode(q, b.contents);
    const assigneeIdList = await assigneeIds(q, b.assignees || []);
    const by = await currentUserId(q, user);
    const headcount = b.headcount ?? 1;
    const status = statusForCreate({
      date: b.date, timeMode, startTime: times.startTime, endTime: times.endTime, headcount, assigneeCount: assigneeIdList.length,
    });
    // 排班警示：有違規又沒帶特許備註 → 422，整筆不會寫入
    const enforced = await enforceAlerts(q, user, {
      taskId: null, customerId: String(branchId), date: b.date || null, timeMode,
      startTime: times.startTime, endTime: times.endTime, headcount, assigneeIds: assigneeIdList.map(String),
    }, b.overrideRemark);
    const ins = await q(`INSERT INTO tasks (customer_id, task_type, status, task_date, time_mode, start_time, end_time,
        is_overnight, time_remark, headcount, shift_id, route, other_content_note, remarks, is_makeup, original_date,
        makeup_reason, report_types, report_notes, override_remark, created_by)
      VALUES ($1::bigint, $2, $3, $4::date, $5, $6::time, $7::time, $8, $9, $10, $11::bigint, $12, $13, $14, $15,
        $16::date, $17, $18::text[], $19, $20, $21::bigint) RETURNING id`,
    [branchId, b.taskType, status, b.date ?? null, timeMode, times.startTime, times.endTime, times.isOvernight,
      b.timeRemark ?? null, headcount, shiftId, b.route ?? null, b.otherContentNote ?? null, b.remarks ?? null,
      b.isMakeup ?? false, b.originalDate ?? null, b.makeupReason ?? null, b.reportTypes ?? [], b.reportNotes ?? null,
      b.overrideRemark ?? null, by]);
    const id = ins.rows[0].id;
    await replaceRelations(q, id, { contentIds, assigneeIdList, by });
    await recordAlerts(q, by, id, enforced, b.overrideRemark);
    return id;
  });
  return getTask(user, String(taskId));
};

const notFound = () => new AppError(404, ERROR_CODES.TASK_NOT_FOUND, '找不到此任務');

export const updateTask = async (user, id, raw) => {
  const taskId = parseId(id);
  rejectRecurrence(raw);
  const isCancel = raw && raw.status === 'CANCELLED';
  const b = validate(raw, BODY_SCHEMA);
  const cleared = new Set(CLEARABLE.filter((k) => raw && (raw[k] === '' || raw[k] === null)));
  const scope = await getScope(user);

  await withTransaction(async (q) => {
    // 鎖住這筆任務，避免兩個人同時修改；同時檢查它在登入者的轄區範圍內
    const values = [taskId];
    const cond = customerScopeCondition(scope, values);
    const found = await q(`SELECT t.id, t.status, t.customer_id, t.task_date::text AS date, t.time_mode,
        to_char(t.start_time, 'HH24:MI') AS start_time, to_char(t.end_time, 'HH24:MI') AS end_time,
        t.headcount, t.shift_id, s.name AS shift
      FROM tasks t JOIN customers c ON c.id = t.customer_id
      LEFT JOIN shifts s ON s.id = t.shift_id
      WHERE t.id = $1::bigint ${cond ? `AND ${cond}` : ''} FOR UPDATE OF t`, values);
    if (found.rows.length === 0) throw notFound();
    const old = found.rows[0];

    if (old.status === 'CANCELLED') throw fail('已取消的任務不能修改');

    if (isCancel) {
      // 取消 = 狀態改為「已取消」；若一併帶了備註（取消原因），就寫進備註
      await q(`UPDATE tasks SET status = 'CANCELLED', remarks = COALESCE($2, remarks), updated_at = now() WHERE id = $1::bigint`,
        [taskId, b.remarks ?? null]);
      return;
    }

    if (b.branchId) await requireCustomer(q, scope, parseId(b.branchId));
    const pick = (key, oldValue) => (cleared.has(key) ? '' : (b[key] ?? oldValue ?? ''));
    const timeMode = b.timeMode || old.time_mode;
    const date = pick('date', old.date);
    const times = checkTimes({ timeMode, startTime: pick('startTime', old.start_time), endTime: pick('endTime', old.end_time) });
    if (timeMode === 'FLEXIBLE' && !date) throw fail('資料驗證失敗：彈性任務必須填寫日期');
    const headcount = b.headcount ?? old.headcount;

    const by = await currentUserId(q, user);
    if (b.contents && b.contents.length === 0) throw fail('資料驗證失敗：contents 至少選一個任務內容');
    const contentIds = b.contents ? await contentIdsByCode(q, b.contents) : null;
    const assigneeIdList = b.assignees ? await assigneeIds(q, b.assignees) : null;
    const oldAssigneeIds = (await q('SELECT user_id::text AS id FROM task_assignees WHERE task_id = $1::bigint', [taskId]))
      .rows.map((r) => r.id);
    const finalAssigneeIds = assigneeIdList ? assigneeIdList.map(String) : oldAssigneeIds;
    const assigneeCount = finalAssigneeIds.length;
    const status = statusForUpdate(old.status, { date, timeMode, startTime: times.startTime, endTime: times.endTime, headcount, assigneeCount });

    // 排班警示：只有「客戶、日期、時間、人數、指派人員」其中之一有變動才重新檢查，
    // 這樣只改備註之類的欄位，不會被舊的、已特許過的警示擋住
    const customerId = b.branchId ? String(parseId(b.branchId)) : String(old.customer_id);
    const sameAssignees = finalAssigneeIds.length === oldAssigneeIds.length
      && finalAssigneeIds.every((x) => oldAssigneeIds.includes(x));
    const unchanged = customerId === String(old.customer_id) && (date || null) === (old.date || null)
      && timeMode === old.time_mode && times.startTime === (old.start_time || null)
      && times.endTime === (old.end_time || null) && headcount === old.headcount && sameAssignees;
    const enforced = unchanged ? null : await enforceAlerts(q, user, {
      taskId: String(taskId), customerId, date: date || null, timeMode,
      startTime: times.startTime, endTime: times.endTime, headcount, assigneeIds: finalAssigneeIds,
    }, cleared.has('overrideRemark') ? null : b.overrideRemark);

    let shiftId = old.shift_id;
    if (cleared.has('shift')) shiftId = null;
    else if (b.shift) shiftId = await shiftIdByName(q, b.shift);

    await q(`UPDATE tasks SET
        customer_id = COALESCE($2::bigint, customer_id), task_type = COALESCE($3, task_type), status = $4,
        task_date = $5::date, time_mode = $6, start_time = $7::time, end_time = $8::time, is_overnight = $9,
        headcount = $10, shift_id = $11::bigint,
        time_remark = CASE WHEN $12::boolean THEN NULL ELSE COALESCE($13, time_remark) END,
        route = CASE WHEN $14::boolean THEN NULL ELSE COALESCE($15, route) END,
        other_content_note = CASE WHEN $16::boolean THEN NULL ELSE COALESCE($17, other_content_note) END,
        remarks = CASE WHEN $18::boolean THEN NULL ELSE COALESCE($19, remarks) END,
        is_makeup = COALESCE($20::boolean, is_makeup),
        original_date = CASE WHEN $21::boolean THEN NULL ELSE COALESCE($22::date, original_date) END,
        makeup_reason = CASE WHEN $23::boolean THEN NULL ELSE COALESCE($24, makeup_reason) END,
        report_types = COALESCE($25::text[], report_types),
        report_notes = CASE WHEN $26::boolean THEN NULL ELSE COALESCE($27, report_notes) END,
        override_remark = CASE WHEN $28::boolean THEN NULL ELSE COALESCE($29, override_remark) END,
        updated_at = now()
      WHERE id = $1::bigint`,
    [taskId, b.branchId ? parseId(b.branchId) : null, b.taskType ?? null, status,
      date || null, timeMode, times.startTime, times.endTime, times.isOvernight,
      headcount, shiftId,
      cleared.has('timeRemark'), b.timeRemark ?? null, cleared.has('route'), b.route ?? null,
      cleared.has('otherContentNote'), b.otherContentNote ?? null, cleared.has('remarks'), b.remarks ?? null,
      b.isMakeup ?? null, cleared.has('originalDate'), b.originalDate ?? null,
      cleared.has('makeupReason'), b.makeupReason ?? null, b.reportTypes ?? null,
      cleared.has('reportNotes'), b.reportNotes ?? null, cleared.has('overrideRemark'), b.overrideRemark ?? null]);
    await replaceRelations(q, taskId, { contentIds, assigneeIdList, by });
    if (enforced) await recordAlerts(q, by, taskId, enforced, b.overrideRemark);
  });
  return getTask(user, taskId);
};
