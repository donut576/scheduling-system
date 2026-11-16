import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql，並執行過步驟 2、4 的 migration）。
// 不會真的寄信：這個測試把 SMTP_HOST 清空，信件只印在終端機。測試建立的任務備註固定為 MARK，結束後刪除。
process.env.SMTP_HOST = '';
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { runDailyMail } = await import('../src/services/mailDigest.js');
const MARK = '__每日合併寄信自動測試__';
let outboxStart;
test.before(async () => {
  outboxStart = (await pool.query('SELECT coalesce(max(id), 0)::bigint AS m FROM email_outbox')).rows[0].m;
  await runDailyMail({ force: true }); // 先把既有的待寄異動處理掉，避免影響這次測試
});
test.after(async () => {
  await pool.query('DELETE FROM tasks WHERE remarks = $1', [MARK]); // 異動與「上次寄出版本」跟著刪除
  await pool.query('DELETE FROM email_outbox WHERE id > $1::bigint', [outboxStart]);
  await pool.end();
});

const start = (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  return `http://localhost:${server.address().port}/api/v1`;
};
const login = async (base, account, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password }) })).json()).data.accessToken;
const call = (base, method, path, token, body) => fetch(`${base}${path}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined,
}).then((r) => r.json());
const mails = async () => (await pool.query(
  'SELECT id, recipient_type, status, subject, body, items FROM email_outbox WHERE id > $1::bigint ORDER BY id', [outboxStart])).rows;
const actionsOf = (rows, type) => rows.filter((m) => m.recipient_type === type).flatMap((m) => m.items.map((i) => i.action));

test('新增 → 寄出（新增）→ 修改 → 寄出（修改）→ 取消 → 寄出（取消）；寄出前新增又取消不寄', async (t) => {
  const base = start(t);
  const mgr = await login(base, 'manager', 'manager123');
  const emp = (await pool.query(`SELECT id FROM users WHERE employee_no = 'STAFF01'`)).rows[0];
  const branch = (await pool.query(`SELECT c.id FROM customers c JOIN customer_contacts cc ON cc.customer_id = c.id WHERE c.is_active ORDER BY c.id LIMIT 1`)).rows[0].id;
  const body = { branchId: String(branch), taskType: 'CONTRACT', date: '2026-12-23', startTime: '09:00', endTime: '11:00', headcount: 1, shift: '早班',
    contents: ['P'], assignees: [String(emp.id)], remarks: MARK };

  // 1) 新增，寄出前又改過一次 → 只寄最新版，標「新增」
  const created = await call(base, 'POST', '/tasks', mgr, body);
  assert.equal(created.code, 0, JSON.stringify(created));
  if (created.data.status !== 'SCHEDULED') return t.skip('排班警示導致任務不是已排班，略過');
  const id = created.data.id;
  await call(base, 'PATCH', `/tasks/${id}`, mgr, { startTime: '10:00', remarks: MARK });
  await runDailyMail({ force: true });
  let m = await mails();
  assert.ok(actionsOf(m, 'CUSTOMER').every((a) => a === 'CREATED') && actionsOf(m, 'CUSTOMER').length >= 1, '客戶：新增');
  assert.ok(actionsOf(m, 'EMPLOYEE').every((a) => a === 'CREATED') && actionsOf(m, 'EMPLOYEE').length >= 1, '員工：新增');
  assert.ok(m.every((x) => x.status === 'SENT'));
  assert.match(m[0].body, /【新增】/);

  // 2) 寄出後修改 → 下一封標「修改」
  const before = m.length;
  const edited = await call(base, 'PATCH', `/tasks/${id}`, mgr, { startTime: '13:00', endTime: '15:00', remarks: MARK });
  assert.equal(edited.code, 0, JSON.stringify(edited));
  await runDailyMail({ force: true });
  m = (await mails()).slice(before);
  assert.ok(actionsOf(m, 'CUSTOMER').includes('UPDATED'));
  assert.ok(actionsOf(m, 'EMPLOYEE').includes('UPDATED'));

  // 3) 寄出後取消 → 標「取消」
  const before2 = (await mails()).length;
  await call(base, 'PATCH', `/tasks/${id}`, mgr, { status: 'CANCELLED', remarks: MARK });
  await runDailyMail({ force: true });
  m = (await mails()).slice(before2);
  assert.ok(actionsOf(m, 'CUSTOMER').includes('CANCELED'));
  assert.ok(actionsOf(m, 'EMPLOYEE').includes('CANCELED'));

  // 4) 新增後、寄出前就取消 → 不寄
  const before3 = (await mails()).length;
  const c2 = await call(base, 'POST', '/tasks', mgr, { ...body, date: '2026-12-24' });
  await call(base, 'PATCH', `/tasks/${c2.data.id}`, mgr, { status: 'CANCELLED', remarks: MARK });
  await runDailyMail({ force: true });
  assert.equal((await mails()).length, before3, '寄出前新增又取消，不該有信');
});

test('發送紀錄：主任只看自己寄的；員工看不到；通知設定可讀寫', async (t) => {
  const base = start(t);
  const admin = await login(base, 'admin', 'admin123');
  const staff = await login(base, 'staff', 'staff123');
  const leader = await login(base, 'leader', 'leader123');
  const all = await call(base, 'GET', '/notifications?page=1&pageSize=50', admin);
  assert.equal(all.code, 0);
  assert.ok(all.data.list.every((n) => n.isRead === undefined && ['CUSTOMER_NOTIFY', 'EMPLOYEE_DISPATCH'].includes(n.type)));
  const mine = await call(base, 'GET', '/notifications?page=1&pageSize=50', leader);
  const me = (await pool.query(`SELECT id::text AS id FROM users WHERE employee_no = 'LDR01'`)).rows[0].id;
  assert.ok(mine.data.list.every((n) => n.sentBy === me));
  assert.equal((await call(base, 'GET', '/notifications?page=1&pageSize=50', staff)).data.list.length, 0);

  const saved = await call(base, 'PUT', '/notification-settings/me', leader, { sendTime: '18:30', autoNotifyEnabled: true });
  assert.equal(saved.code, 0);
  assert.equal((await call(base, 'GET', '/notification-settings/me', leader)).data.sendTime, '18:30');
  assert.equal((await call(base, 'PUT', '/notification-settings/me', leader, { sendTime: '25:99', autoNotifyEnabled: true })).code, 42201);
  await pool.query(`DELETE FROM notification_schedules WHERE user_id = $1::bigint`, [me]);
});
