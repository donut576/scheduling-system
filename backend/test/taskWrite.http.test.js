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
const body = (branchId) => ({ branchId: String(branchId), taskType: 'CONTRACT', date: '2026-12-15', startTime: '09:00', endTime: '11:00',
  headcount: 1, shift: '早班', contents: ['P'], assignees: [], remarks: MARK });

test('新增、修改、取消需要登入與權限', async (t) => {
  const base = start(t);
  assert.equal((await call(base, 'POST', '/tasks', null, {})).status, 401);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal((await call(base, 'POST', '/tasks', staff, {})).status, 403);
  assert.equal((await call(base, 'PATCH', '/tasks/1', staff, {})).status, 403);
});

test('新增 → 修改 → 取消 的完整流程', async (t) => {
  const base = start(t);
  const token = await login(base, 'manager', 'manager123');
  const created = await (await call(base, 'POST', '/tasks', token, body(await firstBranch()))).json();
  assert.equal(created.code, 0);
  assert.equal(created.data.status, 'UNSCHEDULED'); // 沒有指派人員
  assert.deepEqual(created.data.contents, ['P']);
  const id = created.data.id;

  const edited = await (await call(base, 'PATCH', `/tasks/${id}`, token, { route: 'A路' })).json();
  assert.equal(edited.data.route, 'A路');

  const cancelled = await (await call(base, 'PATCH', `/tasks/${id}`, token, { status: 'CANCELLED', remarks: MARK })).json();
  assert.equal(cancelled.data.status, 'CANCELLED');
  assert.equal((await call(base, 'PATCH', `/tasks/${id}`, token, { route: 'B路' })).status, 422); // 已取消不能再改
});

test('錯誤的資料回 422，不會寫進資料庫', async (t) => {
  const base = start(t);
  const token = await login(base, 'admin', 'admin123');
  const ok = body(await firstBranch());
  for (const bad of [{ ...ok, taskType: 'XXX' }, { ...ok, contents: [] }, { ...ok, endTime: '' }, { ...ok, shift: '不存在班' },
    { ...ok, assignees: ['999999'] }, { ...ok, recurrence: { frequency: 'weekly', interval: 1, endType: 'never' } }]) {
    assert.equal((await call(base, 'POST', '/tasks', token, bad)).status, 422);
  }
  assert.equal((await call(base, 'PATCH', '/tasks/999999', token, { route: 'x' })).status, 404);
});

test('客戶、員工讀取：副理看全部，主任範圍較小；員工看不到別區', async (t) => {
  const base = start(t);
  const manager = await login(base, 'manager', 'manager123');
  const leader = await login(base, 'leader', 'leader123');
  const staff = await login(base, 'staff', 'staff123');
  const total = async (token, path) => (await (await call(base, 'GET', path, token)).json()).data.total;
  assert.ok((await total(leader, '/customers')) <= (await total(manager, '/customers')));
  assert.ok((await total(staff, '/employees')) <= (await total(leader, '/employees')));
  assert.ok((await total(leader, '/employees')) <= (await total(manager, '/employees')));
  const groups = await (await call(base, 'GET', '/customers/groups', manager)).json();
  assert.ok(Array.isArray(groups.data) && groups.data[0].branches.length > 0);
  assert.equal((await call(base, 'GET', '/employees/999999', manager)).status, 404);
  assert.equal((await call(base, 'GET', '/employees', null)).status, 401);
});
