import { validate } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { listTasks, getTask } from './tasks.js';
import { updateTask, fail } from './taskWrite.js';

// 「待排任務」不是獨立的資料：它就是狀態為「未排班」（UNSCHEDULED）的任務。
// 任務表單存成未排班就會出現在這裡；補上日期、時間、足夠的人員後會自動變成「已排班」，從待排消失。
// 這裡只是用待排頁面前端習慣的格式（PendingCustomer）包裝任務的讀取與修改，不另存資料。
export const PENDING_STATUSES = ['PENDING', 'CONFIRMED', 'CONVERTED'];

const LIST_SCHEMA = { status: { type: 'enum', values: PENDING_STATUSES } };

const notFound = () => new AppError(404, ERROR_CODES.TASK_NOT_FOUND, '找不到此待排任務');

// 任務 → 前端 PendingCustomer 格式（未排班 = PENDING，其餘 = CONVERTED）
export const mapTaskToPending = (t) => ({
  id: t.id,
  groupId: t.groupId,
  groupName: t.groupName,
  branchId: t.branchId,
  branchName: t.branchName,
  taskType: t.taskType,
  status: t.status === 'UNSCHEDULED' ? 'PENDING' : 'CONVERTED',
  date: t.date,
  startTime: t.startTime,
  endTime: t.endTime,
  isOvernight: t.isOvernight,
  headcount: t.headcount,
  shift: t.shift,
  route: t.route,
  contents: t.contents,
  otherContentNote: t.otherContentNote,
  assignees: t.assignees.map((a) => ({ employeeId: a.employeeId, employeeName: a.employeeName })),
  isRecurring: false, // 循環任務尚未支援
  remarks: t.remarks,
  rejectReason: t.rejectReason,
  rejectedAssignees: t.rejectedAssignees,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

// 前端的指派人員是 [{ employeeId, employeeName }]，也接受直接傳 id 字串；姓名以資料庫為準
export const assigneeIdsFromBody = (raw) => {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw fail('資料驗證失敗：assignees 必須是清單');
  return raw.map((a) => (a && typeof a === 'object' ? a.employeeId : a)).map((v) => String(v ?? ''));
};

// 把待排頁面送來的資料轉成「修改任務」要的格式；groupId、recurrenceRule 等用不到的欄位不帶過去
export const toTaskBody = (raw) => {
  const body = { ...(raw || {}) };
  delete body.groupId; delete body.status; delete body.recurrence; delete body.recurrenceRule;
  const ids = assigneeIdsFromBody(raw?.assignees);
  if (ids !== undefined) body.assignees = ids; else delete body.assignees;
  return body;
};

export const listPending = async (user, rawQuery) => {
  const { status } = validate(rawQuery, LIST_SCHEMA);
  // 只有「待處理」會有資料；已轉換的就是一般任務，不會再出現在待排
  if (status && status !== 'PENDING') {
    const page = Math.max(1, parseInt(rawQuery.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(rawQuery.pageSize, 10) || 20));
    return { list: [], total: 0, page, pageSize };
  }
  const result = await listTasks(user, { ...rawQuery, status: 'UNSCHEDULED' });
  return { ...result, list: result.list.map(mapTaskToPending) };
};

// 必須是「在你範圍內、而且還是未排班」的任務，否則一律回找不到
const requirePendingTask = async (user, id) => {
  let task;
  try { task = await getTask(user, id); } catch (e) { if (e.status === 404) throw notFound(); throw e; }
  if (task.status !== 'UNSCHEDULED') throw notFound();
  return task;
};

export const updatePending = async (user, id, raw) => {
  await requirePendingTask(user, id);
  return mapTaskToPending(await updateTask(user, id, toTaskBody(raw)));
};

// 排定：補上日期、起訖時間（人員也可一併指派），任務會變成「已排班」。
// 人員不足就不會變已排班，所以先檢查，不足時回 422，不會寫入任何資料。
export const convertPending = async (user, id, raw) => {
  const task = await requirePendingTask(user, id);
  const body = toTaskBody(raw);
  if (!body.date) throw fail('資料驗證失敗：date 必填');
  if (!body.startTime || !body.endTime) throw fail('資料驗證失敗：排定需要填寫開始與結束時間');
  const headcount = Number.isInteger(body.headcount) ? body.headcount : task.headcount;
  const assigned = body.assignees ? new Set(body.assignees).size : task.assignees.length;
  if (assigned < headcount) throw fail(`資料驗證失敗：排定需要指派足夠的人員（需求 ${headcount} 人，目前 ${assigned} 人）`);
  return updateTask(user, id, body);
};

// 刪除 = 取消任務（任務不實際刪除，狀態改為已取消）
export const deletePending = async (user, id) => {
  await requirePendingTask(user, id);
  await updateTask(user, id, { status: 'CANCELLED' });
  return null;
};
