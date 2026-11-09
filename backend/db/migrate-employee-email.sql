-- 員工信箱不可重複（不分大小寫）。users.email 欄位本來就存在，這裡只補唯一限制。
-- 執行前先檢查是否已有重複信箱，有的話要先修正，否則建立索引會失敗：
--   SELECT lower(email) AS email, count(*) FROM users WHERE email IS NOT NULL AND email <> '' GROUP BY 1 HAVING count(*) > 1;
BEGIN;
UPDATE users SET email = NULL WHERE email IS NOT NULL AND btrim(email) = '';   -- 空字串視為沒有信箱
UPDATE users SET email = btrim(email) WHERE email IS NOT NULL AND email <> btrim(email);
-- 舊員工還沒有信箱，所以允許 NULL；只有「有填」的信箱才要求唯一
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email)) WHERE email IS NOT NULL;
COMMIT;
