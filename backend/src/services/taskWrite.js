import { withTransaction } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { getScope, customerScopeCondition } from './scope.js';
import { TASK_TYPES, getTask } from './tasks.js';
import { enforceAlerts, recordAlerts, submitApproval } from './alerts.js';
import { expandRecurrence } from './recurrence.js';

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
  // 拖曳排班用：snapshotPending = 從待排拖進日曆（先存下原本的排班欄位）；restorePending = 整筆移回待排（還原排班欄位）
  snapshotPending: { type: 'boolean' },
  restorePending: { type: 'boolean' },
  // 循環任務的修改／取消範圍：this = 僅此次；thisAndFuture = 此次及之後
  recurrenceModifyScope: { type: 'enum', values: ['this', 'thisAndFuture'] },
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

// 修改：條件齊全 → 已排班，否則未排班（不再有「已更改」狀態，改過的已排任務仍是已排班）
export const statusForUpdate = (_oldStatus, s) => (isFullyScheduled(s) ? 'SCHEDULED' : 'UNSCHEDULED');

// 固定時段需要起訖時間；結束早於開始 = 跨夜
export const checkTimes = ({ timeMode, startTime, endTime }) => {
  if (timeMode === 'FLEXIBLE') return { startTime: null, endTime: null, isOvernight: false };
  if (!startTime || !endTime) throw fail('資料驗證失敗：固定時段必須填寫開始與結束時間');
  return { startTime, endTime, isOvernight: endTime < startTime };
};

const hasRecurrence = (raw) => Boolean(raw) && raw.recurrence !== undefined && raw.recurrence !== null;

// 單筆新增與批次排班不能帶循環規則；修改也不能改規則（要改規則請取消之後的任務再重新建立循環）
const rejectRecurrence = (raw) => {
  if (hasRecurrence(raw)) {
    throw fail('這裡不能設定循環規則：新增請用新增任務，修改循環規則請取消之後的任務，再重新建立循環');
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

// 在既有的資料庫交易（q）裡新增一筆任務，回傳新任務 id。單筆新增與批次排班（PATCH /schedule）共用。
export const createTaskTx = async (q, user, scope, raw) => {
  rejectRecurrence(raw);
  const b = validate(raw, BODY_SCHEMA);
  if (!b.branchId) throw fail('資料驗證失敗：branchId 必填');
  if (!b.taskType) throw fail('資料驗證失敗：taskType 必填');
  if (!b.contents || b.contents.length === 0) throw fail('資料驗證失敗：contents 至少選一個任務內容');
  const timeMode = b.timeMode || 'FIXED';
  if (timeMode === 'FLEXIBLE' && !b.date) throw fail('資料驗證失敗：彈性任務必須填寫日期');
  const times = checkTimes({ timeMode, startTime: b.startTime, endTime: b.endTime });
  const branchId = parseId(b.branchId);

  await requireCustomer(q, scope, branchId);
  // 同一個連線上的查詢依序執行
  const shiftId = await shiftIdByName(q, b.shift);
  const contentIds = await contentIdsByCode(q, b.contents);
  const assigneeIdList = await assigneeIds(q, b.assignees || []);
  const by = await currentUserId(q, user);
  const headcount = b.headcount ?? 1;
  const plannedStatus = statusForCreate({
    date: b.date, timeMode, startTime: times.startTime, endTime: times.endTime, headcount, assigneeCount: assigneeIdList.length,
  });
  // 排班警示：有違規又沒帶特許備註 → 422，整筆不會寫入
  const enforced = await enforceAlerts(q, user, {
    taskId: null, customerId: String(branchId), date: b.date || null, timeMode,
    startTime: times.startTime, endTime: times.endTime, headcount, assigneeIds: assigneeIdList.map(String),
  }, b.overrideRemark);
  // 證照違規要副總核准：先存成「待核准」，核准後才變已排班，駁回則取消
  const status = enforced.needsApproval ? 'PENDING_APPROVAL' : plannedStatus;
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
  if (enforced.needsApproval) await submitApproval(q, by, id, enforced.result.violations, b.overrideRemark);
  return id;
};

// 循環任務：依規則一次展開成多筆任務（最多 104 筆），只有第一筆帶指派人員（其餘建好後再逐筆拖曳指派，每筆各自檢查警示）。
// 全部在同一個交易裡，任何一筆失敗整批不寫入。
const createRecurringTx = async (q, user, scope, raw) => {
  const { recurrence, assignees, overrideRemark, ...rest } = raw;
  const { rule, dates } = expandRecurrence(rest.date, recurrence);
  const by = await currentUserId(q, user);
  const days = rule.frequency === 'weekly' ? [rule.dayOfWeek] : null;
  const series = await q(`INSERT INTO recurrence_series (frequency, interval_n, days_of_week, day_of_month, end_type, end_date, end_count, created_by)
    VALUES ($1, $2, $3::smallint[], $4, $5, $6::date, $7, $8::bigint) RETURNING id`,
  [rule.frequency, rule.interval, days, rule.dayOfMonth ?? null, rule.endType, rule.endDate ?? null, rule.endCount ?? null, by]);
  const seriesId = series.rows[0].id;
  const ids = [];
  for (const [i, date] of dates.entries()) {
    // 只有第一筆帶指派人員（與特許備註，警示只檢查第一筆）；其餘筆建好後再逐筆指派
    const first = i === 0;
    // eslint-disable-next-line no-await-in-loop
    ids.push(await createTaskTx(q, user, scope, {
      ...rest, date, assignees: first ? (assignees || []) : [], overrideRemark: first ? overrideRemark : undefined,
    }));
  }
  await q('UPDATE tasks SET series_id = $1::bigint WHERE id = ANY($2::bigint[])', [seriesId, ids]);
  return { firstId: ids[0], count: ids.length };
};

export const createTask = async (user, raw) => {
  const scope = await getScope(user);
  if (hasRecurrence(raw)) {
    const { firstId, count } = await withTransaction((q) => createRecurringTx(q, user, scope, raw));
    return { ...(await getTask(user, String(firstId))), recurrenceCount: count };
  }
  const taskId = await withTransaction((q) => createTaskTx(q, user, scope, raw));
  return getTask(user, String(taskId));
};

const notFound = () => new AppError(404, ERROR_CODES.TASK_NOT_FOUND, '找不到此任務');

// 在既有的資料庫交易（q）裡修改（或取消）一筆任務。單筆修改與批次排班（PATCH /schedule）共用。
// 待排任務被拖進日曆前的排班欄位（還原時用）；只含「拖曳會改到」的欄位，備註、路線等不在內
const snapshotOf = (old) => ({
  branchId: String(old.customer_id), date: old.date || null, timeMode: old.time_mode,
  startTime: old.start_time || null, endTime: old.end_time || null, shift: old.shift || null,
  isMakeup: old.is_makeup, originalDate: old.original_date || null, makeupReason: old.makeup_reason || null,
  timeRemark: old.time_remark || null,
});

// 把快照轉成「修改請求」的欄位；空值用空字串代表清空
const restoreFields = (snap) => ({
  branchId: snap.branchId, date: snap.date ?? '', timeMode: snap.timeMode,
  startTime: snap.startTime ?? '', endTime: snap.endTime ?? '', shift: snap.shift ?? '',
  isMakeup: snap.isMakeup, originalDate: snap.originalDate ?? '', makeupReason: snap.makeupReason ?? '',
  timeRemark: snap.timeRemark ?? '', assignees: [],
});

export const updateTaskTx = async (q, user, scope, id, rawInput) => {
  const taskId = parseId(id);
  // 修改時不能改循環規則：raw.recurrence 會被忽略（要改規則請取消之後的任務，再重新建立循環）
  validate(rawInput, BODY_SCHEMA); // 先驗證請求內容（格式錯誤不用查資料庫）
  let raw = rawInput;
  const isCancel = raw && raw.status === 'CANCELLED';
  // 鎖住這筆任務，避免兩個人同時修改；同時檢查它在登入者的轄區範圍內
  const values = [taskId];
  const cond = customerScopeCondition(scope, values);
  const found = await q(`SELECT t.id, t.status, t.customer_id, t.task_date::text AS date, t.time_mode,
      to_char(t.start_time, 'HH24:MI') AS start_time, to_char(t.end_time, 'HH24:MI') AS end_time,
      t.headcount, t.shift_id, s.name AS shift, t.is_makeup, t.original_date::text AS original_date,
      t.makeup_reason, t.time_remark, t.pending_snapshot
    FROM tasks t JOIN customers c ON c.id = t.customer_id
    LEFT JOIN shifts s ON s.id = t.shift_id
    WHERE t.id = $1::bigint ${cond ? `AND ${cond}` : ''} FOR UPDATE OF t`, values);
  if (found.rows.length === 0) throw notFound();
  const old = found.rows[0];

  if (old.status === 'CANCELLED') throw fail('已取消的任務不能修改');

  // 整筆移回待排：把排班欄位換回第一次拖進日曆之前的樣子（備註、路線等手動編輯過的內容保留）
  const restoring = Boolean(raw && raw.restorePending === true && old.pending_snapshot);
  if (restoring) raw = { ...raw, ...restoreFields(old.pending_snapshot) };
  const b = validate(raw, BODY_SCHEMA);
  const cleared = new Set(CLEARABLE.filter((k) => raw && (raw[k] === '' || raw[k] === null)));

  if (old.status === 'PENDING_APPROVAL' && !isCancel) {
    throw fail('此任務正在等待副總核准，暫時不能修改；如要取消請直接取消任務');
  }

  if (isCancel) {
    // 取消時，還在等待的核准申請一併撤回
    await q(`UPDATE approvals SET status = 'WITHDRAWN', updated_at = now() WHERE task_id = $1::bigint AND status = 'PENDING'`, [taskId]);
    // 取消 = 狀態改為「已取消」；若一併帶了備註（取消原因），就寫進備註
    await q(`UPDATE tasks SET status = 'CANCELLED', remarks = COALESCE($2, remarks), updated_at = now() WHERE id = $1::bigint`,
      [taskId, b.remarks ?? null]);
    return taskId;
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
  const plannedStatus = statusForUpdate(old.status, { date, timeMode, startTime: times.startTime, endTime: times.endTime, headcount, assigneeCount });

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

  const status = enforced?.needsApproval ? 'PENDING_APPROVAL' : plannedStatus;

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
  // 快照：從待排第一次拖進日曆時保存（已有快照不覆蓋）；還原後清除
  if (restoring) {
    await q('UPDATE tasks SET pending_snapshot = NULL WHERE id = $1::bigint', [taskId]);
  } else if (b.snapshotPending === true && old.status === 'UNSCHEDULED' && !old.pending_snapshot) {
    await q('UPDATE tasks SET pending_snapshot = $2::jsonb WHERE id = $1::bigint', [taskId, JSON.stringify(snapshotOf(old))]);
  }
  await replaceRelations(q, taskId, { contentIds, assigneeIdList, by });
  // 重新排班（變回已排班）後，清除駁回提示
  if (status === 'SCHEDULED') await q('UPDATE tasks SET reject_reason = NULL, rejected_assignees = NULL WHERE id = $1::bigint', [taskId]);
  if (enforced) await recordAlerts(q, by, taskId, enforced, b.overrideRemark);
  if (enforced?.needsApproval) await submitApproval(q, by, taskId, enforced.result.violations, b.overrideRemark);
  return taskId;
};

// 循環任務「此次及之後」：這一筆照一般修改；之後的每一筆只改共同欄位（時段、班別、人數、路線、內容、備註、回報），
// 不動日期、指派人員、狀態；取消則是之後每一筆都取消。已取消或待核准的任務會略過。
// 之後某一筆若因為時間或人數改變而違反警示規則，整批不會儲存（請改用「僅此次」逐筆處理）。
const SHARED_FIELDS = ['timeMode', 'startTime', 'endTime', 'shift', 'headcount', 'route', 'contents', 'otherContentNote',
  'remarks', 'reportTypes', 'reportNotes'];

const updateSeriesTx = async (q, user, scope, id, raw) => {
  const taskId = parseId(id);
  const cur = await q('SELECT series_id, task_date::text AS date FROM tasks WHERE id = $1::bigint', [taskId]);
  if (cur.rows.length === 0) throw notFound();
  await updateTaskTx(q, user, scope, id, raw);
  const { series_id: seriesId, date } = cur.rows[0];
  if (!seriesId || !date) return taskId;
  const later = await q(`SELECT id FROM tasks WHERE series_id = $1::bigint AND task_date > $2::date AND id <> $3::bigint
      AND status NOT IN ('CANCELLED', 'PENDING_APPROVAL') ORDER BY task_date, id`, [seriesId, date, taskId]);
  const isCancel = raw.status === 'CANCELLED';
  const shared = isCancel
    ? { status: 'CANCELLED', ...(raw.remarks ? { remarks: raw.remarks } : {}) }
    : Object.fromEntries(SHARED_FIELDS.filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]));
  if (Object.keys(shared).length === 0) return taskId;
  for (const row of later.rows) {
    // eslint-disable-next-line no-await-in-loop
    await updateTaskTx(q, user, scope, String(row.id), shared);
  }
  return taskId;
};

export const updateTask = async (user, id, raw) => {
  const scope = await getScope(user);
  const taskId = await withTransaction((q) => (raw?.recurrenceModifyScope === 'thisAndFuture'
    ? updateSeriesTx(q, user, scope, id, raw)
    : updateTaskTx(q, user, scope, id, raw)));
  return getTask(user, taskId);
};
