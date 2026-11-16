-- 證照到期通知：同一位主任、同一張證照（同一個到期日）只會有一筆通知，之後每天更新剩餘天數。可重複執行。
CREATE UNIQUE INDEX IF NOT EXISTS uq_license_notice ON notifications (recipient_user_id, (payload->>'key'))
  WHERE type = 'LICENSE_EXPIRY' AND channel = 'IN_APP';
