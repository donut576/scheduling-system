-- 1) 取消「已更改」狀態，舊資料一律改為已排班
-- 2) 任務新增駁回資訊欄位（駁回後回待排區，顯示原因與被移除的人員）
BEGIN;
UPDATE tasks SET status = 'SCHEDULED' WHERE status = 'MODIFIED';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rejected_assignees text;
COMMIT;
