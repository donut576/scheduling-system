import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql、dev-sample.sql，以及 migrate-password-reset-tokens.sql）。
// 不設定 SMTP，信件不會真的寄出，內容記在 mailer 的 sentMails，測試從裡面取出連結。
// 會新增員工編號以 __RST 開頭的員工，測試結束會清掉（重設連結隨員工一併刪除）。
process.env.ENABLE_DEV_LOGIN = 'true';
process.env.SMTP_HOST = ''; // 測試不能真的寄信（即使 .env 設定了 SMTP）；信件改記在 mailer 的 sentMails
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { sentMails } = await import('../src/services/mailer.js');
const NO = '__RST';

const cleanup = async () => {
  await pool.query('DELETE FROM users WHERE employee_no LIKE $1', [`${NO}%`]);
};
test.before(cleanup);
test.after(async () => {
  await cleanup();
  await pool.end();
});

const start = (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  return `http://localhost:${server.address().port}/api/v1`;
};
const call = (base, method, path, token, body) => fetch(`${base}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
const devAdmin = async (base) =>
  (await (await call(base, 'POST', '/auth/login', null, { account: 'admin', password: 'admin123' })).json()).data.accessToken;
const create = async (base, admin, n, extra = {}) => {
  const res = await call(base, 'POST', '/employees', admin, {
    name: `重設測試${n}`, phone: '0900-777-888', email: `rst${n}@example.com`, employeeNo: `${NO}${n}`,
    position: 'STAFF', shift: '早班', licenses: ['PEST_CONTROL'], ...extra,
  });
  assert.equal(res.status, 200);
  return (await res.json()).data;
};
const forgot = (base, account) => call(base, 'POST', '/auth/forgot-password', null, { account });
const tokenFromLastMail = (to) => {
  const mail = [...sentMails].reverse().find((m) => m.to === to);
  assert.ok(mail, `找不到寄給 ${to} 的信`);
  const link = mail.text.match(/https?:\/\/\S+/)[0];
  return { link, token: decodeURIComponent(new URL(link).searchParams.get('token')) };
};
const loginStatus = async (base, account, password) =>
  (await call(base, 'POST', '/auth/login', null, { account, password })).status;
// 把某位員工的重設連結都改成「很久以前建立」，避免被頻率限制擋住
const expireRateLimit = (no) => pool.query(
  `UPDATE password_reset_tokens SET created_at = created_at - interval '1 hour'
   WHERE user_id = (SELECT id FROM users WHERE employee_no = $1)`, [no]);

test('申請重設：員工存在時寄出含連結的信；資料庫只存雜湊，不存 token 本身', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '1');
  const before = sentMails.length;
  const res = await forgot(base, `${NO}1`);
  assert.equal(res.status, 200);
  assert.equal(sentMails.length, before + 1);

  const { link, token } = tokenFromLastMail('rst1@example.com');
  assert.ok(link.includes('/reset-password?token='));
  const rows = await pool.query(
    `SELECT t.token_hash FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE u.employee_no = $1`, [`${NO}1`]);
  assert.equal(rows.rows.length, 1);
  assert.notEqual(rows.rows[0].token_hash, token);
  assert.ok(!rows.rows[0].token_hash.includes(token));
});

test('員工編號不存在、停用、沒有信箱：都回一樣的結果，而且不寄信', async (t) => {
  const base = start(t);
  const admin = await devAdmin(base);
  const noMail = await create(base, admin, '2');
  await pool.query('UPDATE users SET email = NULL WHERE employee_no = $1', [`${NO}2`]); // 舊員工可以沒有信箱（新增時一定要填）
  const gone = await create(base, admin, '3');
  await call(base, 'DELETE', `/employees/${gone.id}`, admin);

  const before = sentMails.length;
  const known = await (await forgot(base, `${NO}NOPE`)).json();
  for (const account of [`${NO}2`, `${NO}3`]) {
    const res = await forgot(base, account);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).message, known.message);
  }
  assert.equal(sentMails.length, before);
  assert.ok(noMail.id);
});

test('沒填員工編號回 422', async (t) => {
  const base = start(t);
  assert.equal((await forgot(base, '')).status, 422);
  assert.equal((await call(base, 'POST', '/auth/forgot-password', null, {})).status, 422);
});

test('同一位員工短時間內重複申請，只會寄一封', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '4');
  const before = sentMails.length;
  await forgot(base, `${NO}4`);
  await forgot(base, `${NO}4`);
  await forgot(base, `${NO}4`);
  assert.equal(sentMails.length, before + 1);
});

test('用連結設定新密碼：成功後新密碼可登入、舊密碼不行、不再被要求改密碼', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '5');
  await forgot(base, `${NO}5`);
  const { token } = tokenFromLastMail('rst5@example.com');

  const check = await call(base, 'GET', `/auth/reset-password/check?token=${encodeURIComponent(token)}`);
  assert.equal(check.status, 200);
  assert.equal((await check.json()).data.employeeNo, `${NO}5`);

  const res = await call(base, 'POST', '/auth/reset-password', null, { token, newPassword: 'Newpass88' });
  assert.equal(res.status, 200);

  assert.equal(await loginStatus(base, `${NO}5`, 'Ecolab1234'), 401);
  const login = await (await call(base, 'POST', '/auth/login', null, { account: `${NO}5`, password: 'Newpass88' })).json();
  assert.equal(login.data.user.mustChangePassword, false);
});

test('連結只能用一次；用過後檢查與重設都失敗', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '6');
  await forgot(base, `${NO}6`);
  const { token } = tokenFromLastMail('rst6@example.com');
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token, newPassword: 'Newpass88' })).status, 200);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token, newPassword: 'Another99' })).status, 422);
  assert.equal((await call(base, 'GET', `/auth/reset-password/check?token=${encodeURIComponent(token)}`)).status, 422);
});

test('連結過期、亂填的 token 都失敗', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '7');
  await forgot(base, `${NO}7`);
  const { token } = tokenFromLastMail('rst7@example.com');
  await pool.query(
    `UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute'
     WHERE user_id = (SELECT id FROM users WHERE employee_no = $1)`, [`${NO}7`]);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token, newPassword: 'Newpass88' })).status, 422);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token: 'not-a-real-token', newPassword: 'Newpass88' })).status, 422);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { newPassword: 'Newpass88' })).status, 422);
  assert.equal((await call(base, 'GET', '/auth/reset-password/check')).status, 422);
});

test('重新申請後，舊連結失效，只有最新的連結能用', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '8');
  await forgot(base, `${NO}8`);
  const first = tokenFromLastMail('rst8@example.com').token;
  await expireRateLimit(`${NO}8`);
  await forgot(base, `${NO}8`);
  const second = tokenFromLastMail('rst8@example.com').token;
  assert.notEqual(first, second);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token: first, newPassword: 'Newpass88' })).status, 422);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token: second, newPassword: 'Newpass88' })).status, 200);
});

test('新密碼要符合規則：至少 8 碼、不能是預設密碼；不符合時連結仍可再用', async (t) => {
  const base = start(t);
  await create(base, await devAdmin(base), '9');
  await forgot(base, `${NO}9`);
  const { token } = tokenFromLastMail('rst9@example.com');
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token, newPassword: 'short' })).status, 422);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token, newPassword: 'Ecolab1234' })).status, 422);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token })).status, 422);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token, newPassword: 'Newpass88' })).status, 200);
});

test('申請後員工被停用，連結失效', async (t) => {
  const base = start(t);
  const admin = await devAdmin(base);
  const emp = await create(base, admin, '10');
  await forgot(base, `${NO}10`);
  const { token } = tokenFromLastMail('rst10@example.com');
  assert.equal((await call(base, 'DELETE', `/employees/${emp.id}`, admin)).status, 200);
  assert.equal((await call(base, 'POST', '/auth/reset-password', null, { token, newPassword: 'Newpass88' })).status, 422);
});
