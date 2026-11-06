CREATE INDEX IF NOT EXISTS idx_tasks_status_date ON tasks(status, task_date);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_alerts_task ON task_alerts(task_id);
ANALYZE;
