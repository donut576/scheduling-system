-- 站內通知：notifications 表加欄位，讓「員工的任務異動」同一任務只留一筆、後續異動更新同一筆。
-- 可重複執行。
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'EMAIL';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action text;        -- 最新動作：CREATED／UPDATED／CANCELED
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payload jsonb;      -- 前端卡片用的內容（TaskChangePayload、LicenseExpiryPayload）
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'; -- 這個任務的異動歷程（舊→新）
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT chk_notifications_channel CHECK (channel IN ('IN_APP','EMAIL'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT chk_notifications_action CHECK (action IS NULL OR action IN ('CREATED','UPDATED','CANCELED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- 同一位員工、同一個任務，站內通知只會有一筆（之後的異動更新這一筆）
CREATE UNIQUE INDEX IF NOT EXISTS uq_inapp_user_task ON notifications (recipient_user_id, task_id)
  WHERE channel = 'IN_APP' AND task_id IS NOT NULL AND recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (recipient_user_id, channel, created_at DESC);
-- 任務刪除時，相關通知一併刪除；通知刪除時，異動記錄只清掉對應欄位
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_task_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE notification_changes DROP CONSTRAINT IF EXISTS notification_changes_notification_id_fkey;
ALTER TABLE notification_changes ADD CONSTRAINT notification_changes_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE SET NULL;
