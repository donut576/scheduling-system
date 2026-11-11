-- 忘記密碼寄信：重設密碼連結。可以重複執行。
-- 連結裡的 token 是隨機字串，資料庫只存它的 SHA-256 雜湊（token_hash），就算資料表外洩也不能直接拿來重設密碼。
BEGIN;
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,            -- 用過或被新申請作廢時填入
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC);
COMMIT;
