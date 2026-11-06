-- 壓力測試用：灌 10 萬筆假任務。請只在獨立的測試資料庫（例如 scheduling_perf）執行，不要灌進正式使用的資料庫。
-- 前提：該資料庫已跑過 schema.sql、seed.sql、dev-sample.sql（有客戶、班別、員工）。
BEGIN;

-- 假任務：日期散在今天前後各約一年；狀態比例約 已排班 55%、已取消 15%、未排班 25%、待核准 5%
INSERT INTO tasks (customer_id, task_type, status, task_date, time_mode, start_time, end_time, headcount, shift_id,
                   route, remarks, report_notes, created_by)
SELECT
  (SELECT id FROM customers ORDER BY id OFFSET (g % (SELECT count(*) FROM customers)) LIMIT 1),
  (ARRAY['CONTRACT','ONETIME','ESR'])[1 + g % 3],
  st,
  CASE WHEN st = 'UNSCHEDULED' AND g % 3 = 0 THEN NULL
       ELSE current_date + ((g % 730) - 365) END,
  'FIXED',
  (time '06:00' + ((g % 12) * interval '1 hour')),
  (time '06:00' + ((g % 12) * interval '1 hour') + interval '4 hours')::time,
  1 + g % 3,
  (SELECT id FROM shifts ORDER BY id OFFSET (g % 2) LIMIT 1),
  '第' || (1 + g % 6) || '路',
  repeat('備註文字', 5 + g % 20),
  repeat('報告內容', g % 30),
  (SELECT id FROM users ORDER BY id LIMIT 1)
FROM (
  SELECT g,
    CASE WHEN g % 100 < 55 THEN 'SCHEDULED' WHEN g % 100 < 70 THEN 'CANCELLED'
         WHEN g % 100 < 95 THEN 'UNSCHEDULED' ELSE 'PENDING_APPROVAL' END AS st
  FROM generate_series(1, 100000) AS g
) x;

-- 已排班的任務各指派 1 位員工
INSERT INTO task_assignees (task_id, user_id)
SELECT t.id, (SELECT id FROM users ORDER BY id OFFSET (t.id % (SELECT count(*) FROM users)) LIMIT 1)
FROM tasks t WHERE t.status = 'SCHEDULED'
ON CONFLICT DO NOTHING;

-- 部分任務有警示紀錄、待核准的任務各有一筆核准申請
INSERT INTO task_alerts (task_id, rule_id, severity, message)
SELECT id, 'LICENSE_REQUIRED', 'BLOCKING', '指派員工中無人持有客戶要求之證照' FROM tasks WHERE id % 20 = 0;

INSERT INTO approvals (task_id, type, status, requested_by)
SELECT id, 'ALERT_OVERRIDE', 'PENDING', (SELECT id FROM users ORDER BY id LIMIT 1) FROM tasks WHERE status = 'PENDING_APPROVAL';

COMMIT;
ANALYZE;   -- 更新統計資料，查詢計畫才準
SELECT status, count(*) FROM tasks GROUP BY status ORDER BY 2 DESC;
