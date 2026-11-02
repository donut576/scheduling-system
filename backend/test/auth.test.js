import test from 'node:test';
import assert from 'node:assert/strict';

// config 在載入時讀環境變數，所以要先設定再動態載入 app
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');

const start = (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  return `http://localhost:${server.address().port}/api/v1`;
};
const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('正確帳密登入成功，回傳 accessToken 與使用者資料', async (t) => {
  const base = start(t);
  const res = await post(`${base}/auth/login`, { account: 'leader', password: 'leader123' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.code, 0);
  assert.ok(body.data.accessToken);
  assert.equal(body.data.user.role, 'LEADER');
  assert.ok(body.data.user.permissions.includes('task:create'));
  assert.ok(!('password' in body.data.user));
});

test('密碼錯誤回 401 與 code 40001', async (t) => {
  const base = start(t);
  const res = await post(`${base}/auth/login`, { account: 'admin', password: 'wrong' });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.code, 40001);
});

test('缺少帳號或密碼回 422', async (t) => {
  const base = start(t);
  const res = await post(`${base}/auth/login`, { account: 'admin' });
  assert.equal(res.status, 422);
});

test('profile 需要 token，帶 token 可取得資料，一般員工權限較少', async (t) => {
  const base = start(t);
  assert.equal((await fetch(`${base}/auth/profile`)).status, 401);
  const login = await (await post(`${base}/auth/login`, { account: 'staff', password: 'staff123' })).json();
  const res = await fetch(`${base}/auth/profile`, { headers: { Authorization: `Bearer ${login.data.accessToken}` } });
  const body = await res.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.role, 'STAFF');
  assert.ok(!body.data.permissions.includes('task:create'));
});
