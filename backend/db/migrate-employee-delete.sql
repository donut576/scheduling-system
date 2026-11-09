-- 員工「刪除（停用）」權限：只有系統管理員（ADMIN）可以停用員工。
-- users.is_active 欄位本來就存在，不需要改資料表；這裡只新增權限並授權給管理員。可以重複執行。
BEGIN;
INSERT INTO permissions (code, name) VALUES ('employee:delete', '員工：刪除（停用）')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ADMIN' AND p.code = 'employee:delete'
ON CONFLICT DO NOTHING;
COMMIT;
