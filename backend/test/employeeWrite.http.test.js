import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql，以及 migrate-employee-email.sql）。
// 會新增員工編號以 __EMPW 開頭的員工，測試結束會刪掉。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const NO = '__EMPW';
test.after(async () => {
  await pool.query('DELETE FROM users WHERE employee_no LIKE $1', [`${NO}%`]);
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
const BODY = (n, extra = {}) => ({
  name: `測試員工${n}`, phone: '0900-111-222', email: `empw${n}@example.com`, employeeNo: `${NO}${n}`,
  position: 'STAFF', shift: '早班', licenses: ['PEST_CONTROL'], designatedLeaves: ['2030-01-05'], leaveType: 'REGULAR_LEAVE', ...extra,
});

test('新增員工：管理員成功，回傳 email（轉小寫），並可用信箱搜尋', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const res = await call(base, 'POST', '/employees', admin, BODY('1', { email: 'EmpW1@Example.COM' }));
  assert.equal(res.status, 200);
  const emp = (await res.json()).data;
  assert.equal(emp.email, 'empw1@example.com');
  assert.deepEqual(emp.licenses, ['PEST_CONTROL']);
  assert.deepEqual(emp.designatedLeaves, ['2030-01-05']);

  const search = await (await call(base, 'GET', '/employees?keyword=empw1%40example', admin)).json();
  assert.ok(search.data.list.some((e) => e.id === emp.id));
});

test('新增員工：信箱必填、格式錯誤、不可重複（不分大小寫）、員工編號不可重複', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const noEmail = BODY('2'); delete noEmail.email;
  assert.equal((await call(base, 'POST', '/employees', admin, noEmail)).status, 422);
  assert.equal((await call(base, 'POST', '/employees', admin, BODY('2', { email: 'not-an-email' }))).status, 422);

  assert.equal((await call(base, 'POST', '/employees', admin, BODY('3'))).status, 200);
  const dupEmail = await call(base, 'POST', '/employees', admin, BODY('4', { email: 'EMPW3@example.com' }));
  assert.equal(dupEmail.status, 422);
  assert.match((await dupEmail.json()).message, /信箱/);
  const dupNo = await call(base, 'POST', '/employees', admin, BODY('3', { email: 'other3@example.com' }));
  assert.equal(dupNo.status, 422);
  assert.match((await dupNo.json()).message, /員工編號/);
});

test('更新員工：可改信箱；改成別人的信箱被擋；信箱不可清空；改自己原本的信箱不算重複', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const a = (await (await call(base, 'POST', '/employees', admin, BODY('5'))).json()).data;
  const b = (await (await call(base, 'POST', '/employees', admin, BODY('6'))).json()).data;

  const ok = await call(base, 'PATCH', `/employees/${a.id}`, admin, { email: 'new5@example.com' });
  assert.equal((await ok.json()).data.email, 'new5@example.com');
  assert.equal((await call(base, 'PATCH', `/employees/${a.id}`, admin, { email: 'new5@example.com', phone: '0911-000-000' })).status, 200);
  assert.equal((await call(base, 'PATCH', `/employees/${a.id}`, admin, { email: b.email })).status, 422);
  assert.equal((await call(base, 'PATCH', `/employees/${a.id}`, admin, { email: '' })).status, 422);
  assert.equal((await call(base, 'PATCH', '/employees/999999999', admin, { phone: '0900' })).status, 404);
});

test('權限：未登入 401；一般員工不能新增、不能改別人；副理不能改職位', async (t) => {
  const base = start(t);
  assert.equal((await call(base, 'POST', '/employees', null, BODY('7'))).status, 401);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal((await call(base, 'POST', '/employees', staff, BODY('7'))).status, 403);

  const admin = await login(base, 'admin', 'admin123');
  const emp = (await (await call(base, 'POST', '/employees', admin, BODY('8'))).json()).data;
  assert.equal((await call(base, 'PATCH', `/employees/${emp.id}`, staff, { email: 'hack@example.com' })).status, 403);

  const manager = await login(base, 'manager', 'manager123');
  const promote = await call(base, 'PATCH', `/employees/${emp.id}`, manager, { position: 'ADMIN_STAFF' });
  assert.ok([403, 404].includes(promote.status)); // 403：不可改職位；404：不在副理的範圍（此測試員工沒有群組時）
});

test('更新員工：管理員可改職位，登入角色跟著變', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = (await (await call(base, 'POST', '/employees', admin, BODY('9'))).json()).data;
  const res = await call(base, 'PATCH', `/employees/${emp.id}`, admin, { position: 'LEADER' });
  assert.equal((await res.json()).data.position, 'LEADER');
  const role = await pool.query('SELECT r.code FROM users u JOIN roles r ON r.id = u.role_id WHERE u.employee_no = $1', [`${NO}9`]);
  assert.equal(role.rows[0].code, 'LEADER');
});
