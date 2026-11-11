import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql，以及 migrate-employee-email.sql）。
// 會新增員工編號以 __AUTH 開頭的員工，測試結束會清掉。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const NO = '__AUTH';

const cleanup = async () => {
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
const call = (base, method, path, token, body) => fetch(`${base}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
const login = (base, account, password) => call(base, 'POST', '/auth/login', null, { account, password });
const devAdmin = async (base) => (await (await login(base, 'admin', 'admin123')).json()).data.accessToken;
const create = async (base, admin, n) => {
  const res = await call(base, 'POST', '/employees', admin, {
    name: `登入測試${n}`, phone: '0900-555-666', email: `auth${n}@example.com`, employeeNo: `${NO}${n}`,
    position: 'STAFF', shift: '早班', licenses: ['PEST_CONTROL'],
  });
  assert.equal(res.status, 200);
  return (await res.json()).data;
};

test('新員工用預設密碼登入成功，並被標記需要改密碼', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '1');
  const res = await login(base, `${NO}1`, 'Ecolab1234');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.user.employeeNo, `${NO}1`);
  assert.equal(body.data.user.role, 'STAFF');
  assert.equal(body.data.user.mustChangePassword, true);
  assert.ok(body.data.user.permissions.length > 0);
  assert.ok(!('password' in body.data.user));
});

test('帳號不存在與密碼錯誤回同一句訊息', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '2');
  const wrong = await login(base, `${NO}2`, 'nope');
  const missing = await login(base, `${NO}NOPE`, 'Ecolab1234');
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.equal((await wrong.json()).message, (await missing.json()).message);
});

test('還沒改密碼前，除了改密碼與個人資料，其他 API 回 403（40303）', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '3');
  const token = (await (await login(base, `${NO}3`, 'Ecolab1234')).json()).data.accessToken;
  const blocked = await call(base, 'GET', '/dict', token);
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).code, 40303);
  const profile = await call(base, 'GET', '/auth/profile', token);
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).data.mustChangePassword, true);
});

test('改密碼：規則檢查，成功後解除限制，舊密碼失效', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '4');
  const token = (await (await login(base, `${NO}4`, 'Ecolab1234')).json()).data.accessToken;
  const change = (body) => call(base, 'POST', '/auth/change-password', token, body);

  assert.equal((await change({ currentPassword: 'wrong', newPassword: 'Abcdef12' })).status, 422);
  assert.equal((await change({ currentPassword: 'Ecolab1234', newPassword: 'Ecolab1234' })).status, 422);
  assert.equal((await change({ currentPassword: 'Ecolab1234', newPassword: 'short' })).status, 422);
  assert.equal((await change({ currentPassword: 'Ecolab1234' })).status, 422);

  const okRes = await change({ currentPassword: 'Ecolab1234', newPassword: 'Newpass88' });
  assert.equal(okRes.status, 200);

  assert.equal((await call(base, 'GET', '/dict', token)).status, 200);
  assert.equal((await login(base, `${NO}4`, 'Ecolab1234')).status, 401);
  const again = await (await login(base, `${NO}4`, 'Newpass88')).json();
  assert.equal(again.data.user.mustChangePassword, false);
});

test('改密碼需要登入；固定登入帳號不能改密碼', async (t) => {
  const base = start(t);
  assert.equal((await call(base, 'POST', '/auth/change-password', null, {})).status, 401);
  const dev = await devAdmin(base);
  const res = await call(base, 'POST', '/auth/change-password', dev, { currentPassword: 'admin123', newPassword: 'Newpass88' });
  assert.equal(res.status, 422);
});

test('帳號已停用：密碼正確回 403，密碼錯誤仍回 401；舊 token 立刻失效', async (t) => {
  const base = start(t);
  const admin = await devAdmin(base);
  const emp = await create(base, admin, '5');
  const token = (await (await login(base, `${NO}5`, 'Ecolab1234')).json()).data.accessToken;
  assert.equal((await call(base, 'GET', '/auth/profile', token)).status, 200);

  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, admin)).status, 200);

  const right = await login(base, `${NO}5`, 'Ecolab1234');
  assert.equal(right.status, 403);
  assert.match((await right.json()).message, /停用/);
  assert.equal((await login(base, `${NO}5`, 'wrong')).status, 401);
  assert.equal((await call(base, 'GET', '/auth/profile', token)).status, 401);
});

test('管理員重設密碼：員工密碼回到預設並再次被要求改密碼；非管理員不行', async (t) => {
  const base = start(t);
  const admin = await devAdmin(base);
  const emp = await create(base, admin, '6');
  const token = (await (await login(base, `${NO}6`, 'Ecolab1234')).json()).data.accessToken;
  await call(base, 'POST', '/auth/change-password', token, { currentPassword: 'Ecolab1234', newPassword: 'Newpass88' });
  assert.equal((await login(base, `${NO}6`, 'Newpass88')).status, 200);

  const staff = (await (await login(base, 'staff', 'staff123')).json()).data.accessToken;
  assert.equal((await call(base, 'POST', `/employees/${emp.id}/reset-password`, staff)).status, 403);
  assert.equal((await call(base, 'POST', `/employees/${emp.id}/reset-password`, null)).status, 401);
  assert.equal((await call(base, 'POST', '/employees/999999999/reset-password', admin)).status, 404);

  assert.equal((await call(base, 'POST', `/employees/${emp.id}/reset-password`, admin)).status, 200);
  assert.equal((await login(base, `${NO}6`, 'Newpass88')).status, 401);
  const after = await (await login(base, `${NO}6`, 'Ecolab1234')).json();
  assert.equal(after.data.user.mustChangePassword, true);
});

test('固定登入帳號（開發用）仍可登入，且不受改密碼限制', async (t) => {
  const base = start(t);
  const res = await login(base, 'leader', 'leader123');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.user.mustChangePassword, false);
  assert.equal((await call(base, 'GET', '/dict', body.data.accessToken)).status, 200);
});
