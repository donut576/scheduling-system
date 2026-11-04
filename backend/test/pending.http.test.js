import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。測試建立的任務備註固定為 MARK，結束後會刪除。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__自動測試__';
test.after(async () => {
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
const firstBranch = async () => (await pool.query('SELECT id FROM customers WHERE is_active ORDER BY id LIMIT 1')).rows[0].id;
const anEmployee = async () => (await pool.query("SELECT id FROM users WHERE is_active AND employee_no LIKE 'E%' ORDER BY id LIMIT 1")).rows[0].id;
const newUnscheduled = (base, token, branchId) => call(base, 'POST', '/tasks', token, {
  branchId: String(branchId), taskType: 'ONETIME', startTime: '09:00', endTime: '11:00', headcount: 1, shift: '早班', contents: ['P'], remarks: MARK,
}).then((r) => r.json());
const inPending = async (base, token, id) => (await (await call(base, 'GET', '/pending-customers?pageSize=100', token)).json()).data.list.some((p) => p.id === id);

test('待排任務需要登入與權限', async (t) => {
  const base = start(t);
  assert.equal((await call(base, 'GET', '/pending-customers', null)).status, 401);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal((await call(base, 'GET', '/pending-customers', staff)).status, 403);
});

test('未排班的任務出現在待排；排定後（日期、時間、人員齊全）從待排消失', async (t) => {
  const base = start(t);
  const token = await login(base, 'manager', 'manager123');
  const created = await newUnscheduled(base, token, await firstBranch());
  assert.equal(created.data.status, 'UNSCHEDULED');
  const id = created.data.id;
  assert.equal(await inPending(base, token, id), true);

  const edited = await (await call(base, 'PATCH', `/pending-customers/${id}`, token, { route: '第一路' })).json();
  assert.equal(edited.data.route, '第一路');
  assert.equal(edited.data.status, 'PENDING');

  assert.equal((await call(base, 'POST', `/pending-customers/${id}/convert`, token, { startTime: '09:00', endTime: '11:00' })).status, 422); // 缺日期
  assert.equal((await call(base, 'POST', `/pending-customers/${id}/convert`, token, { date: '2031-03-17', startTime: '09:00', endTime: '11:00' })).status, 422); // 沒人員
  const emp = String(await anEmployee());
  const done = await (await call(base, 'POST', `/pending-customers/${id}/convert`, token,
    { date: '2031-03-17', startTime: '09:00', endTime: '11:00', assignees: [{ employeeId: emp, employeeName: 'x' }] })).json();
  assert.equal(done.data.status, 'SCHEDULED');
  assert.equal(await inPending(base, token, id), false);
  assert.equal((await call(base, 'PATCH', `/pending-customers/${id}`, token, { route: 'x' })).status, 404); // 已不是待排
});

test('刪除待排 = 取消任務；不存在的回 404', async (t) => {
  const base = start(t);
  const token = await login(base, 'admin', 'admin123');
  const created = await newUnscheduled(base, token, await firstBranch());
  assert.equal((await call(base, 'DELETE', `/pending-customers/${created.data.id}`, token)).status, 200);
  const task = await (await call(base, 'GET', `/tasks/${created.data.id}`, token)).json();
  assert.equal(task.data.status, 'CANCELLED');
  assert.equal((await call(base, 'GET', '/pending-customers?status=BAD', token)).status, 422);
  assert.equal((await call(base, 'DELETE', '/pending-customers/999999', token)).status, 404);
});
