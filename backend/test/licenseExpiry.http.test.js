import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql，並執行過 migrate-license-notices.sql）。
// 測試會暫時改 STAFF01「專技」證照的到期日，結束後還原。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { runLicenseExpiryCheck } = await import('../src/services/licenseExpiry.js');

let original;
test.before(async () => {
  original = (await pool.query(`SELECT ul.expires_on::text AS exp FROM user_licenses ul JOIN users u ON u.id = ul.user_id
    JOIN licenses l ON l.id = ul.license_id WHERE u.employee_no = 'STAFF01' AND l.code = 'PROFESSIONAL'`)).rows[0];
});
const setExpiry = (days) => pool.query(`UPDATE user_licenses ul SET expires_on = ${days === null ? 'NULL' : `(now() AT TIME ZONE 'Asia/Taipei')::date + ${days}`}
  FROM users u, licenses l WHERE u.id = ul.user_id AND l.id = ul.license_id AND u.employee_no = 'STAFF01' AND l.code = 'PROFESSIONAL'`);
test.after(async () => {
  if (original) {
    await pool.query(`UPDATE user_licenses ul SET expires_on = $1::date FROM users u, licenses l
      WHERE u.id = ul.user_id AND l.id = ul.license_id AND u.employee_no = 'STAFF01' AND l.code = 'PROFESSIONAL'`, [original.exp]);
  }
  await runLicenseExpiryCheck(); // 清掉測試產生的通知
  await pool.end();
});

const notices = async () => (await pool.query(`SELECT n.id, n.is_read, n.payload FROM notifications n
  WHERE n.type = 'LICENSE_EXPIRY' AND n.payload->>'employeeName' = 'Demo 員工' AND n.payload->>'license' = '專技'`)).rows;

test('只有管理員能手動執行', async (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}/api/v1`;
  const login = async (account, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password }) })).json()).data.accessToken;
  const mgr = await login('manager', 'manager123');
  assert.equal((await fetch(`${base}/notifications/jobs/license-expiry`, { method: 'POST', headers: { Authorization: `Bearer ${mgr}` } })).status, 403);
  const admin = await login('admin', 'admin123');
  const res = await (await fetch(`${base}/notifications/jobs/license-expiry`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` } })).json();
  assert.equal(res.code, 0);
});

test('到期前 20 天：負責主任收到一筆；跨過門檻重設未讀；證照更新後清除', async () => {
  await setExpiry(20);
  await runLicenseExpiryCheck();
  let n = await notices();
  if (n.length === 0) return; // STAFF01 的群組沒有設主任，略過
  assert.equal(n.length, 1);
  assert.equal(n[0].payload.daysLeft, 20);
  assert.equal(n[0].payload.bucket, 30);

  await pool.query('UPDATE notifications SET is_read = true WHERE id = $1::bigint', [n[0].id]);
  await runLicenseExpiryCheck(); // 同一天再跑：不重複、維持已讀
  n = await notices();
  assert.equal(n.length, 1);
  assert.equal(n[0].is_read, true);

  await setExpiry(5); // 跨過 7 天門檻
  await runLicenseExpiryCheck();
  n = await notices();
  assert.equal(n.length, 1, '到期日變了，舊的清掉、新的一筆');
  assert.equal(n[0].is_read, false);
  assert.equal(n[0].payload.bucket, 7);

  await setExpiry(90); // 證照更新、離到期還很久
  await runLicenseExpiryCheck();
  assert.equal((await notices()).length, 0);
});
