import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。測試建立的任務備註固定為 MARK，結束後連同核准申請、稽核紀錄一併刪除。
// 日期固定用 2031 年，避免和手動測試留下的任務撞時段。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__核准自動測試__';
test.after(async () => {
  const ids = (await pool.query('SELECT id FROM tasks WHERE remarks = $1', [MARK])).rows.map((r) => String(r.id));
  if (ids.length) {
    await pool.query("DELETE FROM audit_logs WHERE action_type = 'ALERT_OVERRIDE' AND target_id = ANY($1::text[])", [ids]);
    await pool.query('DELETE FROM approvals WHERE task_id = ANY($1::bigint[])', [ids]);
  }
  await pool.query('DELETE FROM tasks WHERE remarks = $1', [MARK]);
  await pool.end();
});

const start = (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  return `http://localhost:${server.address().port}/api/v1`;
};
const login = async (base, account, password) => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password }) });
  return (await res.json()).data.accessToken;
};
const call = (base, method, path, token, body) => fetch(`${base}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
// 組長（leader）看得到、要求施藥證照的客戶；以及沒有施藥證照的員工
const leaderBranch = async (base, token) => {
  const list = (await (await call(base, 'GET', '/customers?pageSize=100', token)).json()).data.list;
  return list.find((c) => c.requiredLicenses?.includes('PEST_CONTROL'))?.id;
};
const unlicensedEmployee = () => pool.query(`SELECT u.id FROM users u WHERE u.is_active AND u.employee_no LIKE 'E%'
  AND NOT EXISTS (SELECT 1 FROM user_licenses ul JOIN licenses l ON l.id = ul.license_id WHERE ul.user_id = u.id AND l.code = 'PEST_CONTROL')
  ORDER BY u.id LIMIT 1`).then((r) => r.rows[0]?.id);
const body = (branch, emp, date, extra = {}) => ({
  branchId: String(branch), taskType: 'ONETIME', date, startTime: '09:00', endTime: '11:00',
  headcount: 1, shift: '早班', contents: ['P'], assignees: [String(emp)], remarks: MARK, ...extra,
});

test('核准 API 需要登入與權限；一般員工不能看', async (t) => {
  const base = start(t);
  assert.equal((await call(base, 'GET', '/approvals', null)).status, 401);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal((await call(base, 'GET', '/approvals', staff)).status, 403);
  const leader = await login(base, 'leader', 'leader123');
  assert.equal((await call(base, 'POST', '/approvals/1/approve', leader, {})).status, 403); // 組長只能申請，不能核准
  assert.equal((await call(base, 'POST', '/approvals/1/reject', leader, { comment: 'x' })).status, 403);
});

test('證照不符：組長送出 → 待核准 → 經理核准變已排班；經理自己存檔直接放行', async (t) => {
  const base = start(t);
  const leader = await login(base, 'leader', 'leader123');
  const manager = await login(base, 'manager', 'manager123');
  const branch = await leaderBranch(base, leader); const emp = await unlicensedEmployee();
  if (!branch || !emp) return t.skip('資料庫沒有符合條件的客戶或員工');

  // 沒帶備註 → 422（證照違規）
  const blocked = await call(base, 'POST', '/tasks', leader, body(branch, emp, '2031-05-05'));
  assert.equal(blocked.status, 422);
  assert.equal((await blocked.json()).code, 42203);

  // 帶備註 → 存成待核准，不會出現在待排與班表
  const sent = await (await call(base, 'POST', '/tasks', leader, body(branch, emp, '2031-05-05', { overrideRemark: '人手調度中' }))).json();
  assert.equal(sent.data.status, 'PENDING_APPROVAL');
  const taskId = sent.data.id;
  const sched = await (await call(base, 'GET', '/schedule?startDate=2031-05-05&endDate=2031-05-05&dimension=overview', leader)).json();
  assert.ok(!JSON.stringify(sched.data).includes(`"taskId":"${taskId}"`));
  // 待核准時不能修改
  assert.equal((await call(base, 'PATCH', `/tasks/${taskId}`, leader, { remarks: MARK })).status, 422);

  // 組長看得到自己的申請；經理看得到全部
  const mine = (await (await call(base, 'GET', '/approvals?status=PENDING', leader)).json()).data.list.find((a) => a.taskId === taskId);
  assert.ok(mine);
  assert.deepEqual(mine.violatedRules, ['LICENSE_REQUIRED']);
  assert.ok((await (await call(base, 'GET', '/approvals?status=PENDING', manager)).json()).data.list.some((a) => a.id === mine.id));

  // 經理核准 → 已排班、已特許；不能重複處理
  assert.equal((await call(base, 'POST', `/approvals/${mine.id}/approve`, manager, { comment: '同意' })).status, 200);
  const after = (await (await call(base, 'GET', `/tasks/${taskId}`, manager)).json()).data;
  assert.equal(after.status, 'SCHEDULED');
  assert.equal(after.alertStatus, 'OVERRIDDEN');
  assert.equal((await call(base, 'POST', `/approvals/${mine.id}/approve`, manager, {})).status, 422);

  // 經理（副總）自己存檔：不用再核准，直接放行
  const direct = await (await call(base, 'POST', '/tasks', manager, body(branch, emp, '2031-05-06', { overrideRemark: '副總直接放行' }))).json();
  assert.equal(direct.data.status, 'SCHEDULED');
  assert.equal(direct.data.alertStatus, 'OVERRIDDEN');
});

test('駁回 → 任務取消（要填原因）；申請人可撤回；取消任務會一併撤回申請', async (t) => {
  const base = start(t);
  const leader = await login(base, 'leader', 'leader123');
  const manager = await login(base, 'manager', 'manager123');
  const branch = await leaderBranch(base, leader); const emp = await unlicensedEmployee();
  if (!branch || !emp) return t.skip('資料庫沒有符合條件的客戶或員工');
  const send = async (date) => {
    const task = (await (await call(base, 'POST', '/tasks', leader, body(branch, emp, date, { overrideRemark: '申請' }))).json()).data;
    const list = (await (await call(base, 'GET', '/approvals?status=PENDING', manager)).json()).data.list;
    return { taskId: task.id, approvalId: list.find((a) => a.taskId === task.id).id };
  };
  const status = async (id) => (await (await call(base, 'GET', `/tasks/${id}`, manager)).json()).data.status;

  const a = await send('2031-05-07');
  assert.equal((await call(base, 'POST', `/approvals/${a.approvalId}/reject`, manager, {})).status, 422); // 沒填原因
  assert.equal((await call(base, 'POST', `/approvals/${a.approvalId}/reject`, manager, { comment: '不同意' })).status, 200);
  // 駁回後任務回待排區（未排班）、清掉指派人員、保留日期，並記下駁回原因
  const rejected = (await (await call(base, 'GET', `/tasks/${a.taskId}`, manager)).json()).data;
  assert.equal(rejected.status, 'UNSCHEDULED');
  assert.equal(rejected.assignees.length, 0);
  assert.equal(rejected.date, '2031-05-07');
  assert.equal(rejected.rejectReason, '不同意');
  assert.ok(rejected.rejectedAssignees);

  const b = await send('2031-05-08');
  assert.equal((await call(base, 'POST', `/approvals/${b.approvalId}/withdraw`, leader)).status, 200);
  assert.equal(await status(b.taskId), 'CANCELLED');

  const c = await send('2031-05-09');
  assert.equal((await call(base, 'PATCH', `/tasks/${c.taskId}`, leader, { status: 'CANCELLED' })).status, 200);
  const all = (await (await call(base, 'GET', '/approvals?status=WITHDRAWN', manager)).json()).data.list;
  assert.ok(all.some((x) => x.id === c.approvalId));
});

test('其他警示（例如同時段重複排班）也要經理核准；經理自己存檔直接放行', async (t) => {
  const base = start(t);
  const leader = await login(base, 'leader', 'leader123');
  const manager = await login(base, 'manager', 'manager123');
  const list = (await (await call(base, 'GET', '/customers?pageSize=100', leader)).json()).data.list;
  const branch = list.find((c) => !c.requiredLicenses?.length || c.requiredLicenses.every((x) => x === '無'))?.id;
  const emp = await pool.query("SELECT id FROM users WHERE is_active AND employee_no LIKE 'E%' ORDER BY id LIMIT 1").then((r) => r.rows[0]?.id);
  if (!branch || !emp) return t.skip('資料庫沒有符合條件的客戶或員工');

  assert.equal((await call(base, 'POST', '/tasks', leader, body(branch, emp, '2031-05-12'))).status, 200); // 第一筆沒有違規
  const blocked = await call(base, 'POST', '/tasks', leader, body(branch, emp, '2031-05-12')); // 同時段重複
  assert.equal(blocked.status, 422);
  assert.equal((await blocked.json()).code, 42202);
  const sent = await (await call(base, 'POST', '/tasks', leader, body(branch, emp, '2031-05-12', { overrideRemark: '臨時加派' }))).json();
  assert.equal(sent.data.status, 'PENDING_APPROVAL');
  const pending = (await (await call(base, 'GET', '/approvals?status=PENDING', manager)).json()).data.list.find((a) => a.taskId === sent.data.id);
  assert.deepEqual(pending.violatedRules, ['DUPLICATE_SLOT']);

  const direct = await (await call(base, 'POST', '/tasks', manager, body(branch, emp, '2031-05-12', { overrideRemark: '副總直接放行' }))).json();
  assert.equal(direct.data.status, 'SCHEDULED');
});
