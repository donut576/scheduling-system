import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。會新增、取消、複製一些備註為 __批次排班自動測試__ 的任務，結束時刪除。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const MARK = '__批次排班自動測試__';
test.after(async () => {
  await pool.query('DELETE FROM tasks WHERE remarks = $1', [MARK]);
  await pool.query("DELETE FROM audit_logs WHERE target_type = 'schedule' AND details->>'action' = 'COPY' AND details->'source'->>0 = '2031-03-01'");
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
const task = (o) => ({ branchId: '8', taskType: 'CONTRACT', date: '2031-01-05', startTime: '09:00', endTime: '11:00', headcount: 1, shift: '早班', contents: ['P'], remarks: MARK, ...o });

test('批次排班與複製班表需要登入與權限', async (t) => {
  const base = start(t);
  assert.equal((await call(base, 'PATCH', '/schedule', null, { changes: [] })).status, 401);
  assert.equal((await call(base, 'POST', '/schedule/copy', null, {})).status, 401);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal((await call(base, 'PATCH', '/schedule', staff, { changes: [{ type: 'add', data: task() }] })).status, 403);
  assert.equal((await call(base, 'POST', '/schedule/copy', staff, {})).status, 403);
});

test('批次排班：新增、改日期、取消；任何一筆失敗整批不寫入', async (t) => {
  const base = start(t);
  const token = await login(base, 'admin', 'admin123');
  assert.equal((await call(base, 'PATCH', '/schedule', token, { changes: [] })).status, 422);

  const added = await call(base, 'PATCH', '/schedule', token, { changes: [{ type: 'add', data: task() }, { type: 'add', data: task({ date: '2031-01-06' }) }] });
  assert.equal(added.status, 200);
  const [a, b] = (await added.json()).data.taskIds;

  // 第 2 筆沒填內容 → 整批復原，第 1 筆也不會被改
  const bad = await call(base, 'PATCH', '/schedule', token, { changes: [{ type: 'update', taskId: a, data: { date: '2031-01-07' } }, { type: 'add', data: task({ contents: [] }) }] });
  assert.equal(bad.status, 422);
  const still = (await (await call(base, 'GET', `/tasks/${a}`, token)).json()).data;
  assert.equal(still.date, '2031-01-05');

  const moved = await call(base, 'PATCH', '/schedule', token, { changes: [{ type: 'update', taskId: a, data: { date: '2031-01-07' } }, { type: 'remove', taskId: b }] });
  assert.equal(moved.status, 200);
  assert.equal((await (await call(base, 'GET', `/tasks/${a}`, token)).json()).data.date, '2031-01-07');
  assert.equal((await (await call(base, 'GET', `/tasks/${b}`, token)).json()).data.status, 'CANCELLED');
});

test('複製班表：不帶人員、日期平移、可重複複製、參數錯誤回 422', async (t) => {
  const base = start(t);
  const token = await login(base, 'admin', 'admin123');
  const added = await call(base, 'PATCH', '/schedule', token, { changes: [{ type: 'add', data: task({ date: '2031-03-01', assignees: ['6'] }) }] });
  assert.equal(added.status, 200);

  const params = { sourceStartDate: '2031-03-01', sourceEndDate: '2031-03-07', targetStartDate: '2031-03-08', targetEndDate: '2031-03-14', taskTypes: ['CONTRACT'] };
  assert.equal((await call(base, 'POST', '/schedule/copy', token, { ...params, targetStartDate: '2031-03-01', targetEndDate: '2031-03-07' })).status, 422);

  for (let i = 0; i < 2; i += 1) { // 目標日已有任務也照樣新增
    const res = await call(base, 'POST', '/schedule/copy', token, params);
    assert.equal(res.status, 200);
    const r = (await res.json()).data;
    assert.equal(r.copiedCount, 1);
    assert.equal(r.tasks[0].date, '2031-03-08');
    assert.equal(r.tasks[0].status, 'UNSCHEDULED');
    assert.deepEqual(r.tasks[0].assignees, []);
  }
});
