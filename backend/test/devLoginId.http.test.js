import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
test.after(() => pool.end());

test('固定帳號登入回傳的 id 是資料庫的 users.id（前端靠它找「指派給我的任務」）', async (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}/api/v1`;
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'staff', password: 'staff123' }) });
  const { data } = await res.json();
  const db = (await pool.query(`SELECT id::text AS id FROM users WHERE employee_no = 'STAFF01'`)).rows[0];
  assert.equal(data.user.id, db.id);
  // 之後用 token 取個人資料，id 也一樣
  const me = await (await fetch(`${base}/auth/profile`, { headers: { Authorization: `Bearer ${data.accessToken}` } })).json();
  assert.equal(me.data.id, db.id);
});
