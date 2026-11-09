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

test('指定休假：連續日期合併成一段存入，列表仍展開成每一天', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const days = ['2030-02-10', '2030-02-11', '2030-02-12', '2030-02-20'];
  const emp = (await (await call(base, 'POST', '/employees', admin, BODY('10', { designatedLeaves: days }))).json()).data;
  assert.deepEqual(emp.designatedLeaves, days);
  const rows = await pool.query('SELECT start_date::text AS s, end_date::text AS e FROM user_leaves WHERE user_id = $1::bigint ORDER BY start_date', [emp.id]);
  assert.deepEqual(rows.rows.map((r) => [r.s, r.e]), [['2030-02-10', '2030-02-12'], ['2030-02-20', '2030-02-20']]);
});

test('證照期限：licenseDetails 寫入後原樣回傳，licenses 只含「今天有效」的', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const details = [
    { code: 'PROFESSIONAL', effectiveOn: '2020-01-01', expiresOn: '2020-12-31' }, // 已到期
    { code: 'PEST_CONTROL', effectiveOn: '2020-01-01', expiresOn: null },         // 長期有效
    { code: 'FIRE_ANT', effectiveOn: '2099-01-01', expiresOn: '2099-12-31' },     // 還沒生效
  ];
  const res = await call(base, 'POST', '/employees', admin, BODY('11', { licenses: undefined, licenseDetails: details }));
  assert.equal(res.status, 200);
  const emp = (await res.json()).data;
  assert.deepEqual(emp.licenseDetails, details);
  assert.deepEqual(emp.licenses, ['PEST_CONTROL']);

  // 詳情與列表的內容一致
  const detail = (await (await call(base, 'GET', `/employees/${emp.id}`, admin)).json()).data;
  assert.deepEqual(detail.licenseDetails, details);
});

test('證照期限：更新會整批取代；排班日當天有效與否由後端判斷', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = (await (await call(base, 'POST', '/employees', admin, BODY('12', { licenses: undefined,
    licenseDetails: [{ code: 'PEST_CONTROL', effectiveOn: null, expiresOn: '2030-06-30' }] }))).json()).data;

  const row = (sql) => pool.query(sql, [emp.id]);
  const validOn = async (date) => (await row(`SELECT l.code FROM user_licenses ul JOIN licenses l ON l.id = ul.license_id
    WHERE ul.user_id = $1::bigint AND (ul.effective_on IS NULL OR ul.effective_on <= '${date}'::date)
      AND (ul.expires_on IS NULL OR ul.expires_on >= '${date}'::date)`)).rows.map((r) => r.code);
  assert.deepEqual(await validOn('2030-06-30'), ['PEST_CONTROL']); // 到期日當天仍有效
  assert.deepEqual(await validOn('2030-07-01'), []);               // 隔天起無效

  const res = await call(base, 'PATCH', `/employees/${emp.id}`, admin, { licenseDetails: [{ code: 'SAFETY_6HR' }] });
  const updated = (await res.json()).data;
  assert.deepEqual(updated.licenseDetails, [{ code: 'SAFETY_6HR', effectiveOn: null, expiresOn: null }]);

  // 送空清單 = 清除全部證照
  const cleared = (await (await call(base, 'PATCH', `/employees/${emp.id}`, admin, { licenseDetails: [] })).json()).data;
  assert.deepEqual(cleared.licenseDetails, []);
});

test('證照期限：格式錯誤回 422（到期早於生效、不認識的證照、重複、NONE、日期格式）', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const bad = [
    [{ code: 'PEST_CONTROL', effectiveOn: '2026-05-01', expiresOn: '2026-04-30' }],
    [{ code: 'NOT_A_LICENSE' }],
    [{ code: 'FIRE_ANT' }, { code: 'FIRE_ANT' }],
    [{ code: 'NONE' }],
    [{ code: 'FIRE_ANT', expiresOn: '2026/05/01' }],
  ];
  for (const [i, licenseDetails] of bad.entries()) {
    const res = await call(base, 'POST', '/employees', admin, BODY(`2${i}`, { licenses: undefined, licenseDetails }));
    assert.equal(res.status, 422, `第 ${i} 組應為 422`);
  }
  // 驗證失敗不能留下半筆員工
  const left = await pool.query("SELECT count(*)::int AS n FROM users WHERE employee_no LIKE $1", [`${NO}2%`]);
  assert.equal(left.rows[0].n, 0);
});

test('證照期限：一般員工不能改自己的證照，副理可以', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const manager = await login(base, 'manager', 'manager123');
  const emp = (await (await call(base, 'POST', '/employees', admin, BODY('13', { licenses: undefined, licenseDetails: [{ code: 'FIRE_ANT' }] }))).json()).data;

  const byManager = await call(base, 'PATCH', `/employees/${emp.id}`, manager, { licenseDetails: [{ code: 'PEST_CONTROL', expiresOn: '2031-01-01' }] });
  assert.equal(byManager.status, 200);
  assert.deepEqual((await byManager.json()).data.licenseDetails, [{ code: 'PEST_CONTROL', effectiveOn: null, expiresOn: '2031-01-01' }]);

  const staff = await login(base, 'staff', 'staff123');
  const byStaff = await call(base, 'PATCH', `/employees/${emp.id}`, staff, { licenseDetails: [] });
  assert.equal(byStaff.status, 403); // 不是本人
});

test('證照期限：只送 licenses（舊寫法）不會清掉已填的期限，新增的證照沒有日期', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const emp = (await (await call(base, 'POST', '/employees', admin, BODY('14', { licenses: undefined,
    licenseDetails: [{ code: 'PEST_CONTROL', effectiveOn: '2024-03-01', expiresOn: '2027-02-28' }] }))).json()).data;

  const res = await call(base, 'PATCH', `/employees/${emp.id}`, admin, { licenses: ['PEST_CONTROL', 'FIRE_ANT'], phone: '0911-222-333' });
  const updated = (await res.json()).data;
  assert.deepEqual(updated.licenseDetails, [
    { code: 'PEST_CONTROL', effectiveOn: '2024-03-01', expiresOn: '2027-02-28' }, // 期限保留
    { code: 'FIRE_ANT', effectiveOn: null, expiresOn: null },                      // 新增的沒有日期
  ]);

  // 取消選取的證照會被移除
  const removed = (await (await call(base, 'PATCH', `/employees/${emp.id}`, admin, { licenses: ['FIRE_ANT'] })).json()).data;
  assert.deepEqual(removed.licenseDetails, [{ code: 'FIRE_ANT', effectiveOn: null, expiresOn: null }]);
});
