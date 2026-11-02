import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

// 需要可連線的 PostgreSQL（見 .env 的 DATABASE_URL）
// 資料庫連線池整個檔案只關一次（兩個測試共用同一個 pool）
after(() => pool.end());

test('GET /api/v1/health 回傳統一格式且 code 為 0', async (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  const { port } = server.address();
  const res = await fetch(`http://localhost:${port}/api/v1/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.db, 'up');
});

test('不存在的路徑回 404 與統一格式', async (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  const { port } = server.address();
  const res = await fetch(`http://localhost:${port}/api/v1/nope`);
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.data, null);
});