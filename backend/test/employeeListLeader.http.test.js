import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql）。
// 主任（leader 帳號，員工編號 LDR01）看員工列表時，不含自己；分頁與總數也要扣掉自己。
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
const list = async (base, token, query) => {
  const res = await fetch(`${base}/employees?${query}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  return (await res.json()).data;
};

test('主任的員工列表不含自己，管理員看得到', async (t) => {
  const base = start(t);
  const leader = await login(base, 'leader', 'leader123');
  const admin = await login(base, 'admin', 'admin123');

  const mine = await list(base, leader, 'pageSize=100');
  assert.ok(mine.list.length > 0);
  assert.ok(!mine.list.some((e) => e.employeeNo === 'LDR01'));

  const all = await list(base, admin, 'pageSize=100');
  assert.ok(all.list.some((e) => e.employeeNo === 'LDR01'));
});

test('主任的列表：總數扣掉自己，每頁筆數固定，各頁加起來等於總數', async (t) => {
  const base = start(t);
  const leader = await login(base, 'leader', 'leader123');
  const full = await list(base, leader, 'pageSize=100');
  assert.equal(full.total, full.list.length);

  const size = 5;
  const pages = Math.ceil(full.total / size);
  const seen = [];
  for (let p = 1; p <= pages; p += 1) {
    const page = await list(base, leader, `page=${p}&pageSize=${size}`);
    assert.equal(page.total, full.total);
    if (p < pages) assert.equal(page.list.length, size); // 不是最後一頁就要滿
    seen.push(...page.list.map((e) => e.id));
  }
  assert.equal(seen.length, full.total);
  assert.equal(new Set(seen).size, full.total); // 沒有重複
});

test('主任只看到一般員工、約聘員工、主任；管理員與經理看得到副理與行政', async (t) => {
  const base = start(t);
  const leader = await login(base, 'leader', 'leader123');
  const admin = await login(base, 'admin', 'admin123');

  const mine = await list(base, leader, 'pageSize=100');
  const allowed = ['STAFF', 'CONTRACT_STAFF', 'LEADER'];
  assert.ok(mine.list.every((e) => allowed.includes(e.position)));

  const all = await list(base, admin, 'pageSize=100');
  assert.ok(all.list.some((e) => e.position === 'MANAGER' || e.position === 'ADMIN_STAFF'));

  // 主任用職位篩選副理，結果是空的（不是洩漏出來）
  const manager = await list(base, leader, 'position=MANAGER');
  assert.equal(manager.total, 0);
});
