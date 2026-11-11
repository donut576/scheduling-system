-- Ecolab PE 排班系統 資料庫設計（提案 v0.5，PostgreSQL 16，共 30 張表）
-- 命名：snake_case、複數表名；主鍵 id（bigint identity）；時間用 timestamptz；日期用 date

-- ========== 1. 字典表（取代前端寫死的列舉）==========
CREATE TABLE regions (            -- 群組（舊稱轄區）：北早、北一晚、北二晚、桃一早、桃二早、桃竹晚、中區、嘉義、南區
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text,                     -- 轄區顯示顏色（班表、地圖共用）
  leader_id bigint                -- 負責主任；刻意不加 UNIQUE，保留一位主任管多區的彈性，「一人一區」由後端檢查；稍後補 FK
);
-- 群組與行政區的對照：一個行政區可以同時屬於多個群組（例：士林同時屬於北早、北一晚）；
-- district 為 NULL 代表整個縣市（例：台中市、基隆市）。客戶的群組由客戶的 city、district 比對這張表算出，不再手動選。
CREATE TABLE region_areas (
  region_id bigint NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  city text NOT NULL,             -- 縣市，例：新北市（用「台」不用「臺」，與前端一致）
  district text,                  -- 行政區，例：淡水區；NULL = 整個縣市
  UNIQUE NULLS NOT DISTINCT (region_id, city, district)
);
CREATE INDEX idx_region_areas_area ON region_areas(city, district);
CREATE TABLE positions (          -- 職位
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,      -- STAFF / CONTRACT_STAFF / LEADER(主任) / MANAGER(副理) / ADMIN_STAFF
  name text NOT NULL
);
CREATE TABLE shifts (             -- 班別
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,      -- 例：早班、晚班（不含地區，地區另由轄區表示）
  start_time time, end_time time
);
CREATE TABLE licenses (           -- 證照（專技、施藥、火蟻防治…）
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,      -- PROFESSIONAL / PEST_CONTROL / FIRE_ANT ...
  license_name text NOT NULL      -- 證照名稱
);
CREATE TABLE service_contents (   -- 服務項目（P、R、S、白蟻…）
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false  -- 內部任務（如 TRAINING）
);
CREATE TABLE holidays (           -- 放假日（官方備註有名稱的日期，含落在週末的）；補班日 2026 起不存在
  holiday_date date PRIMARY KEY,
  name text NOT NULL,             -- 如 開國紀念日、春節、補假
  source text NOT NULL DEFAULT 'OFFICIAL' CHECK (source IN ('OFFICIAL','COMPANY'))
);

-- ========== 2. 角色與權限（登入帳號即員工編號，帳號資料在 users）==========
CREATE TABLE roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,      -- EMPLOYEE / LEADER(主任) / MANAGER(副理) / ADMIN
  name text NOT NULL
);
CREATE TABLE permissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,      -- 例：task:create
  name text NOT NULL
);
CREATE TABLE role_permissions (
  role_id bigint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ========== 3. 使用者（員工與登入帳號合併）==========
CREATE TABLE users (              -- 每位員工即一個使用者；登入帳號 = 員工編號
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_no text NOT NULL UNIQUE,                 -- 員工編號，同時是登入帳號
  name text NOT NULL,
  phone text,
  email text,
  password text NOT NULL DEFAULT 'Ecolab1234',      -- 目前存明碼；預設密碼 Ecolab1234
  password_format text NOT NULL DEFAULT 'PLAIN' CHECK (password_format IN ('PLAIN','BCRYPT')), -- 日後改存雜湊用
  role_id bigint NOT NULL REFERENCES roles(id),     -- 權限
  position_id bigint NOT NULL REFERENCES positions(id), -- 身分（一般／約聘／主任／副理／行政）
  region_id bigint REFERENCES regions(id),          -- 所屬轄區（組別）
  shift_id bigint REFERENCES shifts(id),
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true, -- 首次登入或使用預設密碼時為 true，登入後強制改密碼
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email)) WHERE email IS NOT NULL;
CREATE TABLE password_reset_tokens (  -- 忘記密碼寄信的重設連結（只存 token 的雜湊）
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,            -- 用過或被新申請作廢時填入
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC);
ALTER TABLE regions ADD CONSTRAINT fk_region_leader FOREIGN KEY (leader_id) REFERENCES users(id);

CREATE TABLE user_licenses (      -- 持有證照與期限
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_id bigint NOT NULL REFERENCES licenses(id),
  effective_on date,              -- 證書生效日；排班時須在生效日之後才算有效
  expires_on date,                -- 到期日；空白 = 長期有效
  PRIMARY KEY (user_id, license_id),
  CHECK (expires_on IS NULL OR effective_on IS NULL OR expires_on >= effective_on)
);
CREATE TABLE user_leaves (        -- 指定排休：一天或一段期間（一天則起訖同日）
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  leave_type text NOT NULL CHECK (leave_type IN ('REGULAR_LEAVE','ANNUAL_LEAVE','OTHER_LEAVE')),
  CHECK (end_date >= start_date)
);

-- ========== 4. 客戶 ==========
CREATE TABLE customer_groups (    -- 集團／公司
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);
CREATE TABLE customers (          -- 分店／服務場域
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES customer_groups(id),
  name text NOT NULL,
  city text,                      -- 縣市；與 district 一起決定客戶屬於哪些群組（見 region_areas）
  district text,                  -- 行政區
  address text,
  latitude numeric(9,6), longitude numeric(9,6),
  license_restriction text NOT NULL DEFAULT 'NONE' CHECK (license_restriction IN ('NONE','PEST_CONTROL','PROFESSIONAL','CUSTOM')), -- 無／需施藥／需專技／其他
  license_restriction_note text,                    -- 選「其他」時必填
  CONSTRAINT chk_license_note CHECK (license_restriction <> 'CUSTOM' OR length(trim(coalesce(license_restriction_note,''))) > 0),
  remarks text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 同一集團下的分店名稱只對「啟用中」的資料要求唯一，停用後可重新建立同名分店
CREATE UNIQUE INDEX uq_customers_group_name_active ON customers(group_id, name) WHERE is_active;
CREATE TABLE customer_contacts (  -- 聯絡人：每位各自一個 email，最多 2 位
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot IN (1,2)),   -- 1=主要（必填）2=次要（選填）
  name text NOT NULL,
  phone text,
  email text NOT NULL,
  UNIQUE (customer_id, slot)
);

-- ========== 5. 任務 ==========
CREATE TABLE recurrence_series (  -- 循環任務母規則（由後端展開成多筆 tasks）
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  frequency text NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly')),
  interval_n int NOT NULL DEFAULT 1 CHECK (interval_n > 0),
  days_of_week smallint[] CHECK (days_of_week IS NULL OR cardinality(days_of_week) = 1),  -- 目前限單選；日後放寬只需移除此限制
  day_of_month smallint,
  end_type text NOT NULL CHECK (end_type IN ('never','date','count')),
  end_date date,
  end_count int,
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id),
  series_id bigint REFERENCES recurrence_series(id),
  task_type text NOT NULL CHECK (task_type IN ('CONTRACT','ONETIME','ESR')),
  status text NOT NULL DEFAULT 'UNSCHEDULED'
    CHECK (status IN ('UNSCHEDULED','SCHEDULED','MODIFIED','CONFIRMED','PENDING_APPROVAL','CANCELLED')),
  alert_status text NOT NULL DEFAULT 'CLEAN' CHECK (alert_status IN ('CLEAN','VIOLATED','OVERRIDDEN','REJECTED')),
  task_date date,
  time_mode text NOT NULL DEFAULT 'FIXED' CHECK (time_mode IN ('FIXED','FLEXIBLE')),
  start_time time, end_time time,
  is_overnight boolean NOT NULL DEFAULT false,
  time_remark text,               -- 彈性任務「說明（選填）」
  headcount int NOT NULL DEFAULT 1 CHECK (headcount > 0),
  shift_id bigint REFERENCES shifts(id),
  route text,
  other_content_note text,
  remarks text,
  is_makeup boolean NOT NULL DEFAULT false,
  original_date date, makeup_reason text,
  report_types text[],
  report_notes text,
  override_remark text,
  from_pending_id bigint,         -- 稍後補 FK
  reject_reason text,             -- 副總駁回原因；駁回後任務回待排區，重新排班（已排班）後清除
  rejected_assignees text,        -- 駁回時被移除的指派人員姓名（頓號分隔），顯示用
  pending_snapshot jsonb,         -- 待排任務第一次拖進日曆前的排班欄位，移回待排時還原
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 固定時段必須有起訖；彈性任務不需要
  CONSTRAINT chk_fixed_needs_time CHECK (time_mode = 'FLEXIBLE' OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);
CREATE INDEX idx_tasks_date ON tasks(task_date);
CREATE INDEX idx_tasks_customer ON tasks(customer_id);
CREATE INDEX idx_tasks_series ON tasks(series_id);
CREATE INDEX idx_tasks_status_date ON tasks(status, task_date);

CREATE TABLE task_contents (
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content_id bigint NOT NULL REFERENCES service_contents(id),
  PRIMARY KEY (task_id, content_id)
);
CREATE TABLE task_assignees (
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id),
  assigned_by bigint REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX idx_task_assignees_emp ON task_assignees(user_id);

CREATE TABLE pending_customers (  -- 待排任務（排定後轉成正式任務）
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id),
  task_type text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CONVERTED')),
  headcount int NOT NULL DEFAULT 1,
  shift_id bigint REFERENCES shifts(id),
  route text, remarks text,
  converted_task_id bigint REFERENCES tasks(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tasks ADD CONSTRAINT fk_task_pending FOREIGN KEY (from_pending_id) REFERENCES pending_customers(id);

-- ========== 6. 警示與核准 ==========
CREATE TABLE task_alerts (        -- 任務違反的警示規則
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  rule_id text NOT NULL CHECK (rule_id IN ('LICENSE_REQUIRED','CONSECUTIVE_DAYS','DAILY_HOURS_EXCEEDED','DUPLICATE_SLOT','DESIGNATED_LEAVE','HEADCOUNT_BELOW_MIN')),
  severity text NOT NULL CHECK (severity IN ('BLOCKING','WARNING','INFO')),
  message text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_alerts_task ON task_alerts(task_id);
CREATE TABLE approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id bigint NOT NULL REFERENCES tasks(id),
  type text NOT NULL CHECK (type IN ('TASK_CHANGE','ALERT_OVERRIDE','SCHEDULE_CHANGE','SHIFT_CHANGE')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  requested_by bigint NOT NULL REFERENCES users(id),
  change_summary text,
  diff jsonb,                     -- [{field,label,before,after}]
  override_remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_approvals_task   ON approvals(task_id);
CREATE INDEX idx_approvals_status ON approvals(status, created_at DESC);
CREATE TABLE approval_steps (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  approval_id bigint NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  step_no smallint NOT NULL,
  approver_id bigint NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  comment text,
  decided_at timestamptz,
  UNIQUE (approval_id, step_no)
);

-- ========== 7. 通知（站內／紀錄）與寄信（發送）拆開 ==========
CREATE TABLE notification_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('SCHEDULE_REMINDER','CUSTOMER_NOTIFY','EMPLOYEE_DISPATCH','CHANGE_APPROVAL','APPROVAL_RESULT','CHANGE_DIGEST')),
  subject text NOT NULL,
  content text NOT NULL,
  variables text[]
);
CREATE TABLE notifications (      -- 「通知」：系統要告知誰什麼事（站內訊息／通知紀錄）
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL,
  template_id bigint REFERENCES notification_templates(id),
  recipient_user_id bigint REFERENCES users(id),
  recipient_contact_id bigint REFERENCES customer_contacts(id),
  task_id bigint REFERENCES tasks(id),
  subject text NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (recipient_user_id IS NOT NULL OR recipient_contact_id IS NOT NULL)
);
CREATE TABLE email_outbox (       -- 「寄信」：實際寄出的信件佇列，含重試與結果
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id bigint REFERENCES notifications(id),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENDING','SENT','FAILED')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_status ON email_outbox(status, scheduled_at);

-- 每日合併通知：任務有建立／修改／刪除時先記一筆待通知，每天由主任設定的時間統一合併寄出
CREATE TABLE system_settings (    -- 全域設定（key／value）
  key text PRIMARY KEY,           -- 全域備用設定，例：notify_default_time（預設 17:00）；自動通知開關與發送時間是每位主任各自的，放 notification_schedules
  value text NOT NULL,
  description text,
  updated_by bigint REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_schedules ( -- 每位主任各自的每日通知設定（發送時間＋自動通知開關）
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- 主任（LEADER）
  send_time time NOT NULL,        -- 每天幾點統一發送
  is_enabled boolean NOT NULL DEFAULT true, -- 這位主任的自動通知開關；關閉時其轄區的異動不寄信
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_changes ( -- 待合併的異動：同收件人同一天的多筆合併成一封
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('CREATED','UPDATED','DELETED')),
  recipient_type text NOT NULL CHECK (recipient_type IN ('CUSTOMER','EMPLOYEE')),
  recipient_user_id bigint REFERENCES users(id),             -- 員工收件人
  recipient_contact_id bigint REFERENCES customer_contacts(id), -- 客戶聯絡人收件人
  region_id bigint REFERENCES regions(id),                   -- 決定用哪位主任的發送時間
  change_date date NOT NULL,      -- 異動發生的日期（同收件人同日期合併）
  detail jsonb,                   -- 異動摘要（改了哪些欄位、前後值）
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','CANCELLED')),
  notification_id bigint REFERENCES notifications(id),       -- 合併寄出後對應的通知
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((recipient_type = 'EMPLOYEE' AND recipient_user_id IS NOT NULL AND recipient_contact_id IS NULL)
      OR (recipient_type = 'CUSTOMER' AND recipient_contact_id IS NOT NULL AND recipient_user_id IS NULL))
);
CREATE INDEX idx_changes_pending ON notification_changes(status, change_date);

-- ========== 8. 稽核 ==========
CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action_type text NOT NULL CHECK (action_type IN ('SCHEDULE_CHANGE','ALERT_OVERRIDE','PERMISSION_CHANGE','DELETE')),
  operator_id bigint REFERENCES users(id),
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id);
