-- 班別只保留「早班」「晚班」：大夜班改名為晚班，午班的任務與員工併入早班（開始時間 18:00 前算早班）
BEGIN;
UPDATE tasks SET shift_id = (SELECT id FROM shifts WHERE name = '早班')
  WHERE shift_id = (SELECT id FROM shifts WHERE name = '午班');
UPDATE users SET shift_id = (SELECT id FROM shifts WHERE name = '早班')
  WHERE shift_id = (SELECT id FROM shifts WHERE name = '午班');
UPDATE pending_customers SET shift_id = (SELECT id FROM shifts WHERE name = '早班')
  WHERE shift_id = (SELECT id FROM shifts WHERE name = '午班');
-- 待排任務的還原快照裡記的班別名稱也一併換掉
UPDATE tasks SET pending_snapshot = replace(replace(pending_snapshot::text, '"午班"', '"早班"'), '"大夜班"', '"晚班"')::jsonb
  WHERE pending_snapshot IS NOT NULL;
DELETE FROM shifts WHERE name = '午班';
UPDATE shifts SET name = '晚班' WHERE name = '大夜班';
COMMIT;
