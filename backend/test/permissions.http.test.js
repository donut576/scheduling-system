import test from 'node:test';
import assert from 'node:assert/strict';

// 需要資料庫（已執行 schema.sql、seed.sql，以及所有 migrate-*.sql）。
// 權限改從資料庫讀取；這裡確認「資料庫」與「程式預設值」一致、權限真的來自資料庫、改權限後會生效。
process.env.ENABLE_DEV_LOGIN = 'true';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { ROLE_PERMISSIONS } = await import('../src/data/rolePermissions.js');
const { invalidatePermissions, loadPermissions, permissionsOf } = await import('../src/services/permissions.js');

test.after(async () => {
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
const login = async (base, account, password) =>
  (await (await call(base, 'POST', '/auth/login', null, { account, password })).json()).data;

test('資料庫的角色權限與 data/rolePermissions.js 的預設值一致（避免漏跑 migration）', async () => {
  const map = await loadPermissions();
  for (const [role, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const fromDb = [...(map.get(role) || [])].sort();
    assert.deepEqual(fromDb, [...codes].sort(), `${role} 的權限與資料庫不一致（可能漏跑 migrate 或 seed）`);
  }
});

test('登入回傳的權限清單來自資料庫', async (t) => {
  const base = start(t);
  const data = await login(base, 'staff', 'staff123');
  assert.deepEqual([...data.user.permissions].sort(), [...permissionsOf('STAFF')].sort());
  const leader = await login(base, 'leader', 'leader123');
  assert.ok(leader.user.permissions.includes('task:create'));
  assert.ok(!leader.user.permissions.includes('approval:approve'));
});

test('在資料庫收回權限後，不用重啟，該角色立刻被擋；恢復後又放行', async (t) => {
  const base = start(t);
  const manager = (await login(base, 'manager', 'manager123')).accessToken;
  assert.equal((await call(base, 'GET', '/approvals', manager)).status, 200);

  const grant = `SELECT ro.id AS role_id, p.id AS permission_id FROM roles ro, permissions p
    WHERE ro.code = 'MANAGER' AND p.code = 'approval:view'`;
  const { role_id: roleId, permission_id: permissionId } = (await pool.query(grant)).rows[0];
  t.after(async () => {
    await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleId, permissionId]);
    invalidatePermissions();
  });

  await pool.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permissionId]);
  invalidatePermissions();
  assert.equal((await call(base, 'GET', '/approvals', manager)).status, 403);

  await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleId, permissionId]);
  invalidatePermissions();
  assert.equal((await call(base, 'GET', '/approvals', manager)).status, 200);
});

test('資料庫角色 EMPLOYEE 對應程式裡的 STAFF', async (t) => {
  const base = start(t);
  const staff = await login(base, 'staff', 'staff123');
  assert.equal(staff.user.role, 'STAFF');
  assert.ok(staff.user.permissions.length > 0);
  assert.ok(!staff.user.permissions.includes('task:create'));
});
