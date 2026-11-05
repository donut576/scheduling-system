import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
test.after(() => pool.end());

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

test('任務列表需要登入', async (t) => {
  assert.equal((await get(start(t), '/tasks')).status, 401);
});

test('一般員工可以讀任務（班表用），但只看得到已排班的，看不到待排與已取消', async (t) => {
  const base = start(t);
  const token = await login(base, 'staff', 'staff123');
  const res = await get(base, '/tasks?pageSize=100', token);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.data.list.every((x) => x.status !== 'UNSCHEDULED' && x.status !== 'CANCELLED'));
  // 指定要看待排也查不到
  const pending = await (await get(base, '/tasks?status=UNSCHEDULED', token)).json();
  assert.equal(pending.data.total, 0);
  // 單筆：已排班的可以看
  if (body.data.list.length) {
    assert.equal((await get(base, `/tasks/${body.data.list[0].id}`, token)).status, 200);
  }
});

test('管理員取得任務列表，格式為分頁結構', async (t) => {
  const base = start(t);
  const token = await login(base, 'admin', 'admin123');
  const body = await (await get(base, '/tasks?page=1&pageSize=5', token)).json();
  assert.equal(body.code, 0);
  assert.equal(body.data.page, 1);
  assert.equal(body.data.pageSize, 5);
  assert.ok(Array.isArray(body.data.list));
  assert.ok(body.data.list.length <= 5);
  if (body.data.list.length) {
    const first = body.data.list[0];
    for (const k of ['id', 'branchName', 'groupName', 'status', 'contents', 'assignees']) assert.ok(k in first, k);
  }
});

test('主任看到的筆數不會比副理多；不存在的任務回 404；錯誤參數回 422', async (t) => {
  const base = start(t);
  const leader = await (await get(base, '/tasks', await login(base, 'leader', 'leader123'))).json();
  const manager = await (await get(base, '/tasks', await login(base, 'manager', 'manager123'))).json();
  assert.ok(leader.data.total <= manager.data.total);
  const adminToken = await login(base, 'admin', 'admin123');
  assert.equal((await get(base, '/tasks/999999', adminToken)).status, 404);
  assert.equal((await get(base, '/tasks?status=BAD', adminToken)).status, 422);
  assert.equal((await get(base, '/tasks/abc', adminToken)).status, 422);
});
