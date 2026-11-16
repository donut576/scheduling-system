-- 每日合併寄信：寄件佇列（email_outbox）補欄位、新增「上次寄出的版本」表。可重複執行。
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS recipient_type text;       -- CUSTOMER／EMPLOYEE
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS recipient_user_id bigint REFERENCES users(id);
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS recipient_contact_id bigint REFERENCES customer_contacts(id);
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS recipient_name text;       -- 客戶＝集團 - 分店；員工＝姓名
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS region_id bigint REFERENCES regions(id);  -- 這封信屬於哪個群組（早、晚班不合併）
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS leader_id bigint REFERENCES users(id);    -- 負責寄出的主任（發送紀錄只看自己的用）
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]';        -- 信裡每個任務與標籤（新增／修改／取消），發送紀錄用
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS html text;
CREATE INDEX IF NOT EXISTS idx_outbox_sent ON email_outbox (sent_at DESC) WHERE status = 'SENT';

-- 上次寄給某位收件人的版本：決定下一封信這個任務該標「新增」「修改」還是「取消」
CREATE TABLE IF NOT EXISTS mail_task_state (
  recipient_key text NOT NULL,                 -- 'E' + 員工 id，或 'C' + 客戶聯絡人 id
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  last_action text NOT NULL CHECK (last_action IN ('CREATED','UPDATED','CANCELED')),
  snapshot jsonb NOT NULL,                     -- 上次寄出時的任務內容
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_key, task_id)
);
