-- 要比較的 4 個查詢（和系統實際查詢的形狀相同）。每個跑兩次，看第二次（第一次要暖快取）。
\timing on

\echo '--- Q1 班表：一個月內已排班任務 ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT t.id, t.task_date, t.start_time, c.name
FROM tasks t JOIN customers c ON c.id = t.customer_id
WHERE t.task_date BETWEEN current_date AND current_date + 30
  AND t.status NOT IN ('UNSCHEDULED','CANCELLED','PENDING_APPROVAL');

\echo '--- Q2 待排區：未排班任務前 50 筆 ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT t.id, t.task_date, c.name
FROM tasks t JOIN customers c ON c.id = t.customer_id
WHERE t.status = 'UNSCHEDULED'
ORDER BY t.task_date NULLS FIRST, t.id
LIMIT 50;

\echo '--- Q3 任務列表第 1 頁（系統實際的排序）---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT t.*, c.name AS branch_name
FROM tasks t JOIN customers c ON c.id = t.customer_id
ORDER BY
  (t.task_date IS NOT NULL) ASC,
  COALESCE(t.task_date < current_date, FALSE) ASC,
  CASE WHEN t.task_date >= current_date THEN t.task_date END ASC,
  CASE WHEN t.task_date < current_date THEN t.task_date END DESC,
  (t.status <> 'UNSCHEDULED') ASC,
  t.start_time ASC NULLS LAST,
  t.id ASC
LIMIT 20;

\echo '--- Q4 核准列表：待核准申請與對應警示 ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.id, a.task_id,
  (SELECT json_agg(ta.message) FROM task_alerts ta WHERE ta.task_id = a.task_id)
FROM approvals a
WHERE a.status = 'PENDING'
ORDER BY a.created_at DESC
LIMIT 20;
