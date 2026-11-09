import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。會新增名稱以 __客戶窗口自動測試__ 開頭的客戶，測試結束會刪掉。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__客戶窗口自動測試__';
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
const BODY = (n, extra = {}) => ({
  groupName: '誠品生活股份有限公司', branchName: `${MARK}${n}`, city: '嘉義市', district: '西區', address: '嘉義市西區廣寧街101號',
  contactName: '王大明', contactPhone: '0912-345-678', contactEmail: 'wang@example.com', ...extra,
});
const BACKUP = { backupName: '李小華', backupPhone: '0922-111-222', backupEmail: 'lee@example.com' };

test('新增客戶：主要聯絡人與備用窗口都存得進去，也讀得出來', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const res = await call(base, 'POST', '/customers', admin, BODY('1', BACKUP));
  assert.equal(res.status, 200);
  const c = (await res.json()).data;
  assert.equal(c.contactName, '王大明');
  assert.equal(c.contactEmail, 'wang@example.com');
  assert.equal(c.backupName, '李小華');
  assert.equal(c.backupPhone, '0922-111-222');
  assert.equal(c.backupEmail, 'lee@example.com');

  const slots = await pool.query('SELECT slot FROM customer_contacts WHERE customer_id = $1::bigint ORDER BY slot', [c.id]);
  assert.deepEqual(slots.rows.map((r) => r.slot), [1, 2]);
});

test('新增客戶：不填備用窗口也可以，備用欄位是空字串', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const res = await call(base, 'POST', '/customers', admin, BODY('2'));
  assert.equal(res.status, 200);
  const c = (await res.json()).data;
  assert.equal(c.backupName, '');
  assert.equal(c.backupEmail, '');
});

test('備用窗口：填了就要填完整、信箱格式要對、要先有主要聯絡人', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const partial = await call(base, 'POST', '/customers', admin, BODY('3', { backupName: '李小華' }));
  assert.equal(partial.status, 422);
  assert.match((await partial.json()).message, /備用窗口/);

  assert.equal((await call(base, 'POST', '/customers', admin, BODY('4', { ...BACKUP, backupEmail: 'not-an-email' }))).status, 422);

  const noPrimary = BODY('5', BACKUP);
  delete noPrimary.contactName; delete noPrimary.contactEmail;
  assert.equal((await call(base, 'POST', '/customers', admin, noPrimary)).status, 422);
});

test('修改客戶：可以改備用窗口、整組清空會刪除、沒帶欄位不動', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const c = (await (await call(base, 'POST', '/customers', admin, BODY('6', BACKUP))).json()).data;

  const edited = (await (await call(base, 'PATCH', `/customers/${c.id}`, admin,
    { backupName: '陳小美', backupPhone: '0933-000-111', backupEmail: 'chen@example.com' })).json()).data;
  assert.equal(edited.backupName, '陳小美');
  assert.equal(edited.backupEmail, 'chen@example.com');

  const untouched = (await (await call(base, 'PATCH', `/customers/${c.id}`, admin, { remarks: '只改備註' })).json()).data;
  assert.equal(untouched.backupName, '陳小美');

  const cleared = (await (await call(base, 'PATCH', `/customers/${c.id}`, admin,
    { backupName: '', backupPhone: '', backupEmail: '' })).json()).data;
  assert.equal(cleared.backupName, '');
  const slots = await pool.query('SELECT slot FROM customer_contacts WHERE customer_id = $1::bigint', [c.id]);
  assert.deepEqual(slots.rows.map((r) => r.slot), [1]); // 主要聯絡人還在
});
