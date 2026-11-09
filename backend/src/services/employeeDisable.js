import { withTransaction } from '../db.js';
import { parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';

const blocked = (msg) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, msg);

// 「刪除」＝停用：保留歷史任務、核准與通知紀錄，員工從列表消失（和客戶的刪除一致）。
// 只有管理員可以做（路由要求 employee:delete）。以下情況不能停用，要先處理：
//   1. 自己的帳號  2. 還有未完成（今天以後或沒有日期）的指派任務  3. 還是某個組別的負責主任
//   4. 最後一位啟用中的系統管理員
export const disableEmployee = async (user, rawId) => {
  const targetId = parseId(rawId);
  await withTransaction(async (q) => {
    const found = await q(`SELECT u.id, u.name, u.employee_no, ro.code AS role
      FROM users u JOIN roles ro ON ro.id = u.role_id
      WHERE u.id = $1::bigint AND u.is_active FOR UPDATE OF u`, [targetId]);
    if (found.rows.length === 0) throw new AppError(404, ERROR_CODES.EMPLOYEE_NOT_FOUND, '找不到此員工');
    const target = found.rows[0];

    if (user.no && user.no === target.employee_no) throw blocked('不能停用自己的帳號');

    const open = await q(`SELECT count(*)::int AS n FROM task_assignees ta JOIN tasks t ON t.id = ta.task_id
      WHERE ta.user_id = $1::bigint AND t.status <> 'CANCELLED' AND (t.task_date IS NULL OR t.task_date >= current_date)`, [targetId]);
    if (open.rows[0].n > 0) throw blocked(`${target.name} 還有 ${open.rows[0].n} 筆未完成的任務，請先取消或改派`);

    const led = await q('SELECT name FROM regions WHERE leader_id = $1::bigint ORDER BY name', [targetId]);
    if (led.rows.length > 0) throw blocked(`${target.name} 是 ${led.rows.map((r) => r.name).join('、')} 的負責主任，請先更換組長`);

    if (target.role === 'ADMIN') {
      const others = await q(`SELECT count(*)::int AS n FROM users u JOIN roles ro ON ro.id = u.role_id
        WHERE ro.code = 'ADMIN' AND u.is_active AND u.id <> $1::bigint`, [targetId]);
      if (others.rows[0].n === 0) throw blocked('至少要保留一位啟用中的系統管理員');
    }

    await q('UPDATE users SET is_active = FALSE, updated_at = now() WHERE id = $1::bigint', [targetId]);
  });
  return null;
};
