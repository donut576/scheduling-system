import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。測試建立的任務備註固定為 MARK，結束後會刪除。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__跨轄區自己的任務自動測試__';
test.after(async () => {
  await pool.query('DELETE FROM tasks WHERE remarks = $1', [MARK]);
  await pool.end();
});

const login = async (base, account, password) => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password }) });
  return (await res.json()).data.accessToken;
};
const call = (base, method, path, token, body) => fetch(`${base}${path}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined,
}).then((r) => r.json());

test('員工被指派到「別的轄區」的客戶，仍看得到自己的任務；別人的同轄區外任務看不到', async (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}/api/v1`;
  const staff = (await pool.query(`SELECT u.id, rg.name AS region FROM users u JOIN regions rg ON rg.id = u.region_id WHERE u.employee_no = 'STAFF01'`)).rows[0];
  // 找一個不屬於 STAFF01 轄區、且沒有證照限制的客戶（避免被證照警示擋住）
  const out = (await pool.query(`SELECT c.id FROM customers c WHERE c.is_active AND c.license_restriction = 'NONE' AND NOT EXISTS (
      SELECT 1 FROM region_areas ra JOIN regions rg ON rg.id = ra.region_id
      WHERE rg.name = $1 AND ra.city = c.city AND (ra.district IS NULL OR ra.district = c.district)) ORDER BY c.id LIMIT 1`, [staff.region])).rows[0];
  if (!out) return t.skip('找不到轄區外的客戶，略過');
  const mgr = await login(base, 'manager', 'manager123');
  const created = await call(base, 'POST', '/tasks', mgr, { branchId: String(out.id), taskType: 'CONTRACT', date: '2026-12-21',
    startTime: '09:00', endTime: '11:00', headcount: 1, shift: '早班', contents: ['P'], assignees: [String(staff.id)], remarks: MARK });
  assert.equal(created.code, 0, JSON.stringify(created));
  if (created.data.status !== 'SCHEDULED') return t.skip('排班警示導致任務不是已排班，略過');

  const token = await login(base, 'staff', 'staff123');
  const mine = await call(base, 'GET', '/schedule?dimension=overview&startDate=2026-12-21&endDate=2026-12-21', token);
  assert.ok(mine.data.events.some((e) => e.taskId === String(created.data.id)), '指派給自己的任務要看得到');

  // 同一天、同一個客戶，另一位員工（不是 STAFF01）的任務，STAFF01 不該看到
  const other = (await pool.query(`SELECT id FROM users WHERE is_active AND employee_no = 'TPA02'`)).rows[0];
  if (other) {
    const c2 = await call(base, 'POST', '/tasks', mgr, { branchId: String(out.id), taskType: 'CONTRACT', date: '2026-12-21',
      startTime: '13:00', endTime: '15:00', headcount: 1, shift: '早班', contents: ['P'], assignees: [String(other.id)], remarks: MARK });
    if (c2.code === 0 && c2.data.status === 'SCHEDULED') {
      const again = await call(base, 'GET', '/schedule?dimension=overview&startDate=2026-12-21&endDate=2026-12-21', token);
      assert.ok(!again.data.events.some((e) => e.taskId === String(c2.data.id)), '別人的轄區外任務不該看到');
    }
  }
});
