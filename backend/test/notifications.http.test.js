import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql，並執行過 migrate-in-app-notifications.sql）。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__站內通知自動測試__';
test.after(async () => {
  await pool.query('DELETE FROM tasks WHERE remarks = $1', [MARK]); // 通知與異動記錄跟著 CASCADE 刪除
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
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
}).then((r) => r.json());

test('需要登入', async (t) => {
  const base = start(t);
  const res = await fetch(`${base}/notifications?channel=IN_APP`);
  assert.equal(res.status, 401);
});

test('員工被指派 → 修改 → 取消：同一任務只有一筆通知，標籤跟著最新動作，並重設未讀', async (t) => {
  const base = start(t);
  const mgr = await login(base, 'manager', 'manager123');
  const emp = (await pool.query(`SELECT u.id, u.employee_no FROM users u JOIN roles r ON r.id = u.role_id
    WHERE u.is_active AND r.code = 'EMPLOYEE' AND u.employee_no = 'staff' LIMIT 1`)).rows[0]
    ?? (await pool.query(`SELECT u.id, u.employee_no FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_active AND r.code = 'EMPLOYEE' ORDER BY u.id LIMIT 1`)).rows[0];
  const branch = (await pool.query('SELECT id FROM customers WHERE is_active ORDER BY id LIMIT 1')).rows[0].id;
  const created = await call(base, 'POST', '/tasks', mgr, { branchId: String(branch), taskType: 'CONTRACT', date: '2026-12-18',
    startTime: '09:00', endTime: '11:00', headcount: 1, shift: '早班', contents: ['P'], assignees: [String(emp.id)], remarks: MARK });
  assert.equal(created.code, 0, JSON.stringify(created));
  if (created.data.status !== 'SCHEDULED') return t.skip('排班警示導致任務不是已排班，略過');
  const id = created.data.id;

  const rows = async () => (await pool.query(
    'SELECT type, action, is_read, history FROM notifications WHERE channel = $1 AND recipient_user_id = $2::bigint AND task_id = $3::bigint',
    ['IN_APP', emp.id, id])).rows;

  let r = await rows();
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'TASK_CREATED');
  assert.equal(r[0].is_read, false);

  await pool.query('UPDATE notifications SET is_read = true WHERE task_id = $1::bigint', [id]); // 模擬已讀
  await call(base, 'PATCH', `/tasks/${id}`, mgr, { startTime: '10:00', remarks: MARK });
  r = await rows();
  assert.equal(r.length, 1, '同一任務仍只有一筆');
  assert.equal(r[0].type, 'TASK_UPDATED');
  assert.equal(r[0].is_read, false, '有新異動要重設為未讀');
  assert.equal(r[0].history.length, 2);

  await call(base, 'PATCH', `/tasks/${id}`, mgr, { status: 'CANCELLED', remarks: MARK });
  r = await rows();
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'TASK_CANCELED');
  assert.equal(r[0].history.length, 3);
});

test('只能看、只能標記自己的通知；全部已讀', async (t) => {
  const base = start(t);
  const mgr = await login(base, 'manager', 'manager123');
  const staff = await login(base, 'staff', 'staff123');
  const mine = await call(base, 'GET', '/notifications?channel=IN_APP', staff);
  assert.equal(mine.code, 0);
  assert.ok(mine.data.list.every((n) => n.isRead !== undefined));
  // 別人的通知：用副理的 token 查不到員工的
  const theirs = await call(base, 'GET', '/notifications?channel=IN_APP', mgr);
  const staffIds = new Set(mine.data.list.map((n) => n.id));
  assert.ok(theirs.data.list.every((n) => !staffIds.has(n.id)));
  // 標記別人的通知 → 404
  if (mine.data.list[0]) {
    const res = await fetch(`${base}/notifications/${mine.data.list[0].id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${mgr}` } });
    assert.equal(res.status, 404);
  }
  assert.equal((await call(base, 'POST', '/notifications/read-all', staff)).code, 0);
  const after = await call(base, 'GET', '/notifications?channel=IN_APP', staff);
  assert.ok(after.data.list.every((n) => n.isRead === true));
});
