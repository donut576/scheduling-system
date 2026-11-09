import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql，以及 migrate-employee-email.sql）。
// 會新增員工編號以 __EMPD 開頭的員工與備註為 __EMPD 的任務，測試結束會清掉。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const NO = '__EMPD';

const cleanup = async () => {
  await pool.query(`DELETE FROM task_assignees WHERE user_id IN (SELECT id FROM users WHERE employee_no LIKE $1)`, [`${NO}%`]);
  await pool.query('DELETE FROM tasks WHERE remarks = $1', [NO]);
  await pool.query(`UPDATE regions SET leader_id = NULL WHERE leader_id IN (SELECT id FROM users WHERE employee_no LIKE $1)`, [`${NO}%`]);
  await pool.query('DELETE FROM users WHERE employee_no LIKE $1', [`${NO}%`]);
};
test.before(cleanup);
test.after(async () => {
  await cleanup();
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
const BODY = (n) => ({
  name: `停用測試${n}`, phone: '0900-333-444', email: `empd${n}@example.com`, employeeNo: `${NO}${n}`,
  position: 'STAFF', shift: '早班', licenses: ['PEST_CONTROL'],
});
const create = async (base, admin, n) => {
  const res = await call(base, 'POST', '/employees', admin, BODY(n));
  assert.equal(res.status, 200);
  return (await res.json()).data;
};

test('停用員工需要登入與 employee:delete 權限（只有管理員）', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = await create(base, admin, '1');
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, null)).status, 401);
  const manager = await login(base, 'manager', 'manager123');
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, manager)).status, 403);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, staff)).status, 403);
  // 被擋下的員工還在
  assert.equal((await call(base, 'GET', `/employees/${emp.id}`, admin)).status, 200);
});

test('停用成功：從列表與詳情消失，再停用一次回 404', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = await create(base, admin, '2');

  const res = await call(base, 'DELETE', `/employees/${emp.id}`, admin);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data, null);

  assert.equal((await call(base, 'GET', `/employees/${emp.id}`, admin)).status, 404);
  const list = await (await call(base, 'GET', '/employees?keyword=empd2%40example&pageSize=100', admin)).json();
  assert.ok(!list.data.list.some((e) => e.id === emp.id));
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, admin)).status, 404);

  // 資料還在資料庫，只是停用（保留歷史紀錄）
  const row = await pool.query('SELECT is_active FROM users WHERE id = $1::bigint', [emp.id]);
  assert.equal(row.rows[0].is_active, false);
});

test('找不到的員工回 404', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  assert.equal((await call(base, 'DELETE', '/employees/999999999', admin)).status, 404);
});

test('不能停用自己的帳號', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const me = await pool.query(`SELECT id FROM users WHERE employee_no = 'ADMIN01'`);
  if (me.rows.length === 0) return t.skip('資料庫沒有 ADMIN01');
  const res = await call(base, 'DELETE', `/employees/${me.rows[0].id}`, admin);
  assert.equal(res.status, 422);
  assert.match((await res.json()).message, /自己/);
  const still = await pool.query('SELECT is_active FROM users WHERE id = $1::bigint', [me.rows[0].id]);
  assert.equal(still.rows[0].is_active, true);
});

test('還有未完成的指派任務不能停用；任務取消後才可以', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = await create(base, admin, '3');
  const customer = await pool.query('SELECT id FROM customers ORDER BY id LIMIT 1');
  const task = await pool.query(
    `INSERT INTO tasks (customer_id, task_type, status, task_date, time_mode, remarks)
     VALUES ($1, 'ONETIME', 'SCHEDULED', current_date + 30, 'FLEXIBLE', $2) RETURNING id`,
    [customer.rows[0].id, NO]);
  await pool.query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2::bigint)', [task.rows[0].id, emp.id]);

  const blockedRes = await call(base, 'DELETE', `/employees/${emp.id}`, admin);
  assert.equal(blockedRes.status, 422);
  assert.match((await blockedRes.json()).message, /1 筆未完成的任務/);
  assert.equal((await call(base, 'GET', `/employees/${emp.id}`, admin)).status, 200);

  await pool.query(`UPDATE tasks SET status = 'CANCELLED' WHERE id = $1`, [task.rows[0].id]);
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, admin)).status, 200);
});

test('過去的任務不擋停用', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = await create(base, admin, '4');
  const customer = await pool.query('SELECT id FROM customers ORDER BY id LIMIT 1');
  const task = await pool.query(
    `INSERT INTO tasks (customer_id, task_type, status, task_date, time_mode, remarks)
     VALUES ($1, 'ONETIME', 'CONFIRMED', current_date - 30, 'FLEXIBLE', $2) RETURNING id`,
    [customer.rows[0].id, NO]);
  await pool.query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2::bigint)', [task.rows[0].id, emp.id]);
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, admin)).status, 200);
});

test('還是組別負責主任的人不能停用；換掉組長後才可以', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = await create(base, admin, '5');
  const region = await pool.query('SELECT id, name, leader_id FROM regions ORDER BY id LIMIT 1');
  const { id: regionId, name: regionName, leader_id: oldLeader } = region.rows[0];
  t.after(() => pool.query('UPDATE regions SET leader_id = $1 WHERE id = $2', [oldLeader, regionId]));

  await pool.query('UPDATE regions SET leader_id = $1::bigint WHERE id = $2', [emp.id, regionId]);
  const res = await call(base, 'DELETE', `/employees/${emp.id}`, admin);
  assert.equal(res.status, 422);
  const message = (await res.json()).message;
  assert.match(message, /負責主任/);
  assert.ok(message.includes(regionName));

  await pool.query('UPDATE regions SET leader_id = $1 WHERE id = $2', [oldLeader, regionId]);
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, admin)).status, 200);
});

test('停用後員工編號與信箱仍被占用（避免同編號重複建立）', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = await create(base, admin, '6');
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, admin)).status, 200);
  const again = await call(base, 'POST', '/employees', admin, BODY('6'));
  assert.equal(again.status, 422);
});
