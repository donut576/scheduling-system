import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。測試建立的任務備註固定為 MARK，結束後會刪除。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__異動事件自動測試__';
test.after(async () => {
  await pool.query('DELETE FROM tasks WHERE remarks = $1', [MARK]); // notification_changes 會跟著 CASCADE 刪除
  await pool.end();
});

const start = (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  return `http://localhost:${server.address().port}/api/v1`;
};
const login = async (base) => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'manager', password: 'manager123' }) });
  return (await res.json()).data.accessToken;
};
const call = (base, method, path, token, body) => fetch(`${base}${path}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined,
}).then((r) => r.json());
const changes = async (id) => (await pool.query(
  'SELECT change_type, recipient_type FROM notification_changes WHERE task_id = $1::bigint ORDER BY id', [id])).rows
  .map((r) => `${r.recipient_type}:${r.change_type}`);

test('新增（排滿）→ 修改 → 取消，依序記下異動事件', async (t) => {
  const base = start(t);
  const token = await login(base);
  const branch = (await pool.query(`SELECT c.id FROM customers c JOIN customer_contacts cc ON cc.customer_id = c.id
    WHERE c.is_active ORDER BY c.id LIMIT 1`)).rows[0].id;
  const emp = (await pool.query('SELECT id FROM users WHERE is_active ORDER BY id LIMIT 1')).rows[0].id;
  const body = { branchId: String(branch), taskType: 'CONTRACT', date: '2026-12-16', startTime: '09:00', endTime: '11:00',
    headcount: 1, shift: '早班', contents: ['P'], assignees: [String(emp)], remarks: MARK };

  const created = await call(base, 'POST', '/tasks', token, body);
  assert.equal(created.code, 0, JSON.stringify(created));
  const id = created.data.id;
  if (created.data.status !== 'SCHEDULED') return t.skip('此測試資料的排班警示導致任務不是已排班，略過');
  assert.ok((await changes(id)).includes('EMPLOYEE:CREATED'));
  assert.ok((await changes(id)).includes('CUSTOMER:CREATED'));

  await call(base, 'PATCH', `/tasks/${id}`, token, { startTime: '10:00', remarks: MARK });
  assert.ok((await changes(id)).includes('EMPLOYEE:UPDATED'));
  assert.ok((await changes(id)).includes('CUSTOMER:UPDATED'));

  await call(base, 'PATCH', `/tasks/${id}`, token, { status: 'CANCELLED', remarks: MARK });
  const all = await changes(id);
  assert.ok(all.includes('EMPLOYEE:DELETED'));
  assert.ok(all.includes('CUSTOMER:DELETED'));
});

test('沒有指派人員的任務（待排）不記事件', async (t) => {
  const base = start(t);
  const token = await login(base);
  const branch = (await pool.query('SELECT id FROM customers WHERE is_active ORDER BY id LIMIT 1')).rows[0].id;
  const created = await call(base, 'POST', '/tasks', token, { branchId: String(branch), taskType: 'CONTRACT', date: '2026-12-17',
    startTime: '09:00', endTime: '11:00', headcount: 1, shift: '早班', contents: ['P'], assignees: [], remarks: MARK });
  assert.equal((await changes(created.data.id)).length, 0);
});
