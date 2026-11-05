import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。會新增、停用一筆名稱以 __客戶寫入自動測試__ 開頭的客戶，測試結束會刪掉。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__客戶寫入自動測試__';
test.after(async () => {
  await pool.query('DELETE FROM customers WHERE name LIKE $1', [`${MARK}%`]);
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
const BODY = { groupName: '誠品生活股份有限公司', branchName: `${MARK}美術館店`, city: '嘉義市', district: '西區', address: '嘉義市西區廣寧街101號' };

test('GET /regions/areas：需登入，回 12 個群組與縣市行政區', async (t) => {
  const base = start(t);
  assert.equal((await call(base, 'GET', '/regions/areas')).status, 401);
  const token = await login(base, 'staff', 'staff123');
  const d = (await (await call(base, 'GET', '/regions/areas', token)).json()).data;
  assert.equal(d.regions.length, 12);
  const chiayi = d.cities.find((c) => c.city === '嘉義市');
  assert.deepEqual(chiayi.districts.map((x) => x.district), ['東區', '西區']);
});

test('客戶新增／修改／停用：權限、驗證、群組自動計算', async (t) => {
  const base = start(t);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal((await call(base, 'POST', '/customers', staff, BODY)).status, 403);

  const admin = await login(base, 'admin', 'admin123');
  assert.equal((await call(base, 'POST', '/customers', admin, { ...BODY, city: '宜蘭縣', district: '礁溪鄉' })).status, 422);
  assert.equal((await call(base, 'POST', '/customers', admin, { ...BODY, district: '' })).status, 422);

  const created = await call(base, 'POST', '/customers', admin, BODY);
  assert.equal(created.status, 200);
  const c = (await created.json()).data;
  assert.deepEqual(c.regions, ['嘉義早', '嘉義晚']);
  assert.equal((await call(base, 'POST', '/customers', admin, BODY)).status, 422); // 同集團同名

  const moved = (await (await call(base, 'PATCH', `/customers/${c.id}`, admin, { city: '台北市', district: '士林區' })).json()).data;
  assert.deepEqual(moved.regions, ['北一晚', '北早']);

  assert.equal((await call(base, 'DELETE', `/customers/${c.id}`, admin)).status, 200);
  assert.equal((await call(base, 'PATCH', `/customers/${c.id}`, admin, { remarks: 'x' })).status, 404);
});
