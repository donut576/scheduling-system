import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。只讀，不會寫入資料。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
test.after(async () => { await pool.end(); });

const start = (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  return `http://localhost:${server.address().port}/api/v1`;
};
const login = async (base, account, password) => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password }) });
  return (await res.json()).data.accessToken;
};
const get = (base, path, token) => fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const RANGE = 'startDate=2026-11-01&endDate=2026-11-30';

test('排班查詢需要登入；缺日期、範圍錯誤、維度錯誤回 422', async (t) => {
  const base = start(t);
  assert.equal((await get(base, `/schedule?${RANGE}`)).status, 401);
  const token = await login(base, 'manager', 'manager123');
  assert.equal((await get(base, '/schedule?endDate=2026-11-30', token)).status, 422);
  assert.equal((await get(base, '/schedule?startDate=2026-11-30&endDate=2026-11-01', token)).status, 422);
  assert.equal((await get(base, '/schedule?startDate=2026-01-01&endDate=2026-12-31', token)).status, 422);
  assert.equal((await get(base, `/schedule?${RANGE}&dimension=x`, token)).status, 422);
});

test('三種維度：總覽沒有資源列、客戶維度的資源是集團含分店、員工維度的資源是員工', async (t) => {
  const base = start(t);
  const token = await login(base, 'manager', 'manager123');
  const overview = (await (await get(base, `/schedule?${RANGE}&dimension=overview`, token)).json()).data;
  assert.deepEqual(overview.resources, []);
  assert.ok(Array.isArray(overview.events));

  const customer = (await (await get(base, `/schedule?${RANGE}&dimension=customer`, token)).json()).data;
  assert.ok(customer.resources.length > 0);
  assert.ok(Array.isArray(customer.resources[0].children));
  const branchIds = new Set(customer.resources.flatMap((g) => g.children.map((b) => b.id)));
  assert.ok(customer.events.every((e) => branchIds.has(e.resourceId)));

  const employee = (await (await get(base, `/schedule?${RANGE}&dimension=employee`, token)).json()).data;
  const empIds = new Set(employee.resources.map((r) => r.id));
  assert.ok(employee.events.every((e) => empIds.has(e.resourceId)));
});

test('事件格式：有起訖時間與任務資料；未排班與已取消的任務不會出現', async (t) => {
  const base = start(t);
  const token = await login(base, 'admin', 'admin123');
  const { events } = (await (await get(base, `/schedule?${RANGE}&dimension=overview`, token)).json()).data;
  for (const e of events) {
    assert.match(e.start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
    assert.ok(e.end >= e.start);
    assert.ok(!['UNSCHEDULED', 'CANCELLED'].includes(e.extendedProps.task.status));
  }
});

test('主任看到的事件不會比副理多', async (t) => {
  const base = start(t);
  const manager = await login(base, 'manager', 'manager123');
  const leader = await login(base, 'leader', 'leader123');
  const m = (await (await get(base, `/schedule?${RANGE}&dimension=overview`, manager)).json()).data.events.length;
  const l = (await (await get(base, `/schedule?${RANGE}&dimension=overview`, leader)).json()).data.events.length;
  assert.ok(l <= m);
});
