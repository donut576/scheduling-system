-- 管理員「重設員工密碼」權限（employee:reset_password），只有系統管理員（ADMIN）。
-- users.password / password_format / must_change_password 欄位本來就存在，不需要改資料表。可以重複執行。
BEGIN;
INSERT INTO permissions (code, name) VALUES ('employee:reset_password', '員工：重設密碼')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ADMIN' AND p.code = 'employee:reset_password'
ON CONFLICT DO NOTHING;
COMMIT;
