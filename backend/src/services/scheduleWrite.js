import { withTransaction } from '../db.js';
import { validate } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { hasPermission } from '../middleware/permission.js';
import { getScope } from './scope.js';
import { createTaskTx, updateTaskTx } from './taskWrite.js';

export const MAX_CHANGES = 200;
const CHANGE_TYPES = ['add', 'update', 'remove'];

const CHANGE_SCHEMA = {
  type: { type: 'enum', values: CHANGE_TYPES, required: true },
  taskId: { type: 'string', max: 40 },
};

// 每種變更需要的權限（和單筆的 POST／PATCH /tasks 一致）；PATCH /schedule 本身還需要 schedule:edit
const PERMISSION_OF = { add: 'task:create', update: 'task:edit', remove: 'task:edit' };

const fail = (msg, details = null) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, `資料驗證失敗：${msg}`, details);

// 前端傳來的變更清單 → 檢查格式，回傳乾淨的陣列
export const parseChanges = (body) => {
  const list = body && typeof body === 'object' ? body.changes : undefined;
  if (!Array.isArray(list) || list.length === 0) throw fail('changes 必須是至少一筆的清單');
  if (list.length > MAX_CHANGES) throw fail(`changes 一次最多 ${MAX_CHANGES} 筆`);
  return list.map((raw, i) => {
    const c = validate(raw, CHANGE_SCHEMA);
    const data = raw && typeof raw.data === 'object' && raw.data !== null && !Array.isArray(raw.data) ? raw.data : undefined;
    if (c.type === 'add' && !data) throw fail(`第 ${i + 1} 筆（add）必須帶 data`);
    if (c.type !== 'add' && !c.taskId) throw fail(`第 ${i + 1} 筆（${c.type}）必須帶 taskId`);
    if (c.type === 'update' && !data) throw fail(`第 ${i + 1} 筆（update）必須帶 data`);
    return { type: c.type, taskId: c.taskId, data };
  });
};

// 把單筆變更失敗包成「第 N 筆失敗」，狀態碼與錯誤碼維持原樣（例如 42202 排班警示），
// data.errors 帶出是哪一筆、原本的違規清單，前端才能指出是哪個事件有問題
const withIndex = (err, index, change) => {
  if (!(err instanceof AppError)) return err;
  const label = change.type === 'add' ? '新增' : change.type === 'update' ? '修改' : '取消';
  return new AppError(err.status, err.code, `第 ${index + 1} 筆變更（${label}）失敗：${err.message}`, [
    { index, type: change.type, taskId: change.taskId ?? null, errors: err.details ?? null },
  ]);
};

// 批次排班：全部成功才寫入，任何一筆失敗整批復原（同一個資料庫交易）。
//   add    → 新增任務（data 同 POST /tasks）
//   update → 修改任務（taskId + data 同 PATCH /tasks/:id，例如拖曳改日期、時間、指派人員）
//   remove → 取消任務（狀態改為已取消，保留紀錄；data.remarks 可當取消原因）
// 排班警示逐筆檢查，而且看得到同一批裡前面已套用的變更。
export const applyScheduleChanges = async (user, body) => {
  const changes = parseChanges(body);
  for (const [i, c] of changes.entries()) {
    if (!hasPermission(user, PERMISSION_OF[c.type])) {
      throw new AppError(403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, `權限不足：第 ${i + 1} 筆變更（${c.type}）沒有對應權限`);
    }
  }
  const scope = await getScope(user);
  return withTransaction(async (q) => {
    const touched = [];
    for (const [i, c] of changes.entries()) {
      try {
        if (c.type === 'add') touched.push(await createTaskTx(q, user, scope, c.data));
        else if (c.type === 'update') touched.push(await updateTaskTx(q, user, scope, c.taskId, c.data));
        else touched.push(await updateTaskTx(q, user, scope, c.taskId, { ...(c.data ?? {}), status: 'CANCELLED' }));
      } catch (err) {
        throw withIndex(err, i, c);
      }
    }
    return { applied: changes.length, taskIds: touched.map(String) };
  });
};
