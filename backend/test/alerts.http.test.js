import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。測試建立的任務備註固定為 MARK，結束後會刪除（連同稽核紀錄）。
// 日期固定用 2031 年，避免和手動測試留下的任務撞時段。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
// 和其他 http 測試檔不同的標記：node --test 會同時跑多個測試檔，共用標記的話，別的檔案結束時的清理會把這裡的任務刪掉
const MARK = '__警示自動測試__';
test.after(async () => {
  const ids = (await pool.query('SELECT id FROM tasks WHERE remarks = $1', [MARK])).rows.map((r) => String(r.id));
  if (ids.length) await pool.query("DELETE FROM audit_logs WHERE action_type = 'ALERT_OVERRIDE' AND target_id = ANY($1::text[])", [ids]);
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
const cleanRows = (sql) => pool.query(sql).then((r) => r.rows[0]?.id);
// 要求施藥證照的客戶，以及沒有施藥證照的員工
const strictBranch = () => cleanRows("SELECT id FROM customers WHERE is_active AND license_restriction = 'PEST_CONTROL' ORDER BY id LIMIT 1");
const unlicensedEmployee = () => cleanRows(`SELECT u.id FROM users u WHERE u.is_active AND u.employee_no LIKE 'E%'
  AND NOT EXISTS (SELECT 1 FROM user_licenses ul JOIN licenses l ON l.id = ul.license_id WHERE ul.user_id = u.id AND l.code = 'PEST_CONTROL')
  ORDER BY u.id LIMIT 1`);
const body = (branch, emp, extra = {}) => ({
  branchId: String(branch), taskType: 'ONETIME', date: '2031-03-17', startTime: '09:00', endTime: '11:00',
  headcount: 1, shift: '早班', contents: ['P'], assignees: [String(emp)], remarks: MARK, ...extra,
});

test('預檢與特許需要登入與權限', async (t) => {
  const base = start(t);
  assert.equal((await call(base, 'POST', '/tasks/validate', null, {})).status, 401);
  assert.equal((await call(base, 'POST', '/tasks/1/override-warning', null, { remark: 'x' })).status, 401);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal((await call(base, 'POST', '/tasks/validate', staff, {})).status, 403);
  assert.equal((await call(base, 'POST', '/tasks/1/override-warning', staff, { remark: 'x' })).status, 403);
});

test('預檢只檢查不寫入；存檔遇到警示回 422，帶特許備註才能存', async (t) => {
  const branch = await strictBranch(); const emp = await unlicensedEmployee();
  if (!branch || !emp) return t.skip('資料庫沒有符合條件的客戶或員工');
  const base = start(t);
  const token = await login(base, 'manager', 'manager123');

  const pre = await (await call(base, 'POST', '/tasks/validate', token, body(branch, emp))).json();
  assert.equal(pre.data.isValid, false);
  assert.equal(pre.data.canOverride, true);
  assert.ok(pre.data.violations.some((v) => v.ruleId === 'LICENSE_REQUIRED'));
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM tasks WHERE remarks = $1', [MARK])).rows[0].n, 0);

  const blocked = await call(base, 'POST', '/tasks', token, body(branch, emp));
  assert.equal(blocked.status, 422);
  assert.equal((await blocked.json()).code, 42203);

  const saved = await (await call(base, 'POST', '/tasks', token, body(branch, emp, { overrideRemark: '人手調度中' }))).json();
  assert.equal(saved.data.alertStatus, 'OVERRIDDEN');
  assert.equal(saved.data.overrideRemark, '人手調度中');
  const audit = await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE action_type = 'ALERT_OVERRIDE' AND target_id = $1", [String(saved.data.id)]);
  assert.equal(audit.rows[0].n, 1);
});

test('修改任務時不會和自己衝突；特許備註可補寫，沒有警示則不需要特許', async (t) => {
  const branch = await strictBranch(); const emp = await unlicensedEmployee();
  if (!branch || !emp) return t.skip('資料庫沒有符合條件的客戶或員工');
  const base = start(t);
  const token = await login(base, 'manager', 'manager123');

  const saved = await (await call(base, 'POST', '/tasks', token,
    body(branch, emp, { date: '2031-03-18', overrideRemark: '先建立' }))).json();
  const id = saved.data.id;
  // 只改備註：不重新檢查，不會被舊警示擋住
  assert.equal((await call(base, 'PATCH', `/tasks/${id}`, token, { remarks: MARK, route: 'A' })).status, 200);
  // 同一員工改時間：不該和自己這筆衝突，但證照警示仍在 → 沒帶備註要 422
  assert.equal((await call(base, 'PATCH', `/tasks/${id}`, token, { startTime: '09:30', endTime: '11:30' })).status, 422);
  assert.equal((await call(base, 'PATCH', `/tasks/${id}`, token, { startTime: '09:30', endTime: '11:30', overrideRemark: '改時間' })).status, 200);

  assert.equal((await call(base, 'POST', `/tasks/${id}/override-warning`, token, { remark: '' })).status, 422);
  assert.equal((await call(base, 'POST', `/tasks/${id}/override-warning`, token, { remark: '主管同意' })).status, 200);

  // 沒有警示的任務（沒指派人員）不需要特許
  const clean = await (await call(base, 'POST', '/tasks', token, body(branch, emp, { date: '2031-03-19', assignees: [] }))).json();
  assert.equal(clean.data.alertStatus, 'CLEAN');
  assert.equal((await call(base, 'POST', `/tasks/${clean.data.id}/override-warning`, token, { remark: 'x' })).status, 422);
});