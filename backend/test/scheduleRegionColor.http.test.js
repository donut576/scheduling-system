import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。測試建立的任務備註固定為 MARK，結束後會刪除。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__任務群組顏色自動測試__';
test.after(async () => {
  await pool.query('DELETE FROM tasks WHERE remarks = $1', [MARK]);
  await pool.end();
});

const login = async (base) => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'manager', password: 'manager123' }) });
  return (await res.json()).data.accessToken;
};
const call = (base, method, path, token, body) => fetch(`${base}${path}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined,
}).then((r) => r.json());

test('班表事件帶任務所屬群組名稱與顏色；同行政區屬於早、晚群組時依任務班別挑', async (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}/api/v1`;
  const token = await login(base);
  // 找一個同時屬於「…早」與「…晚」群組的客戶（例：士林區同時是北早、北一晚）
  const cust = (await pool.query(`SELECT c.id FROM customers c WHERE c.is_active AND c.license_restriction = 'NONE'
    AND EXISTS (SELECT 1 FROM region_areas ra JOIN regions r ON r.id = ra.region_id WHERE ra.city = c.city AND (ra.district IS NULL OR ra.district = c.district) AND r.name LIKE '%早')
    AND EXISTS (SELECT 1 FROM region_areas ra JOIN regions r ON r.id = ra.region_id WHERE ra.city = c.city AND (ra.district IS NULL OR ra.district = c.district) AND r.name LIKE '%晚')
    ORDER BY c.id LIMIT 1`)).rows[0];
  if (!cust) return t.skip('找不到同時屬於早、晚群組的客戶，略過');
  const emp = (await pool.query(`SELECT id FROM users WHERE employee_no = 'STAFF01'`)).rows[0];
  const make = (shift, startTime, endTime) => call(base, 'POST', '/tasks', token, { branchId: String(cust.id), taskType: 'CONTRACT',
    date: '2026-12-22', startTime, endTime, headcount: 1, shift, contents: ['P'], assignees: [], remarks: MARK });
  const [morning, night] = [await make('早班', '09:00', '11:00'), await make('晚班', '19:00', '21:00')];
  // 先排滿（指派同仁）才會出現在班表；這裡直接用資料庫指派，避免被排班警示擋住
  for (const c of [morning, night]) {
    await pool.query(`INSERT INTO task_assignees (task_id, user_id) VALUES ($1::bigint, $2::bigint)`, [c.data.id, emp.id]);
    await pool.query(`UPDATE tasks SET status = 'SCHEDULED' WHERE id = $1::bigint`, [c.data.id]);
  }
  const sch = await call(base, 'GET', '/schedule?dimension=overview&startDate=2026-12-22&endDate=2026-12-22', token);
  const find = (c) => sch.data.events.find((e) => e.taskId === String(c.data.id));
  assert.ok(find(morning).extendedProps.regionName.endsWith('早'));
  assert.ok(find(night).extendedProps.regionName.endsWith('晚'));
  assert.ok(find(morning).extendedProps.regionColor);
  assert.equal(find(morning).backgroundColor, find(morning).extendedProps.regionColor);
});
