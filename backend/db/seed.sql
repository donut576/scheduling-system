-- 種子資料（初版，依前端 src/constants 現況整理）
-- 注意：權限與角色對照取自前端現有設定，PE 的權限規則（SO、互看範圍）確認後需調整；轄區待 PE 提供，這裡不建立。
BEGIN;

INSERT INTO roles (code, name) VALUES ('EMPLOYEE','員工'),('LEADER','主任'),('MANAGER','副理'),('ADMIN','系統管理員');
INSERT INTO positions (code, name) VALUES ('STAFF','一般員工'),('CONTRACT_STAFF','約聘員工'),('LEADER','主任'),('MANAGER','副理'),('ADMIN_STAFF','行政');
INSERT INTO shifts (name) VALUES ('早班'),('午班'),('大夜班');  -- 起訖時間待 PE 提供
INSERT INTO licenses (code, license_name) VALUES ('PROFESSIONAL','專技'),('PEST_CONTROL','施藥'),('FIRE_ANT','火蟻防治'),('SAFETY_6HR','一般安全衛生6小時'),('SAFETY_MANAGER_A','甲級勞安主管'),('SAFETY_MANAGER_B','乙級勞安主管'),('SAFETY_MANAGER_C','丙級勞安主管');
INSERT INTO service_contents (code, name, is_internal) VALUES ('P','P',false),('R','R',false),('S','S',false),('TERMITE','白蟻',false),('FIRE_ANT','火蟻',false),('BED_BUG','臭蟲',false),('VEHICLE_MAINTENANCE','車輛保養',false),('TRAINING','培訓',true),('OTHER','其他',false);  -- 內部標籤規則待 PE 確認，is_internal 暫定
INSERT INTO permissions (code, name) VALUES
  ('task:view','任務：檢視'),
  ('task:create','任務：新增'),
  ('task:edit','任務：編輯'),
  ('task:delete','任務：刪除'),
  ('task:export','任務：匯出'),
  ('task:override_alert','任務：覆蓋警示'),
  ('schedule:view','排班：檢視'),
  ('schedule:edit','排班：編輯'),
  ('schedule:approve','排班：核准'),
  ('customer:view','客戶：檢視'),
  ('customer:create','客戶：新增'),
  ('customer:edit','客戶：編輯'),
  ('customer:delete','客戶：刪除'),
  ('employee:view','員工：檢視'),
  ('employee:create','員工：新增'),
  ('employee:edit','員工：編輯'),
  ('employee:designate_leave','員工：指定排休'),
  ('notification:view','通知：檢視'),
  ('notification:send','通知：發送'),
  ('notification:manage_template','通知：管理範本'),
  ('approval:view','核准：檢視'),
  ('approval:approve','核准：核准'),
  ('pending_customer:view','待排任務：檢視'),
  ('pending_customer:create','待排任務：新增'),
  ('pending_customer:convert','待排任務：排定'),
  ('pending_customer:delete','待排任務：刪除'),
  ('map:view','地圖：檢視'),
  ('system:audit','系統：稽核'),
  ('system:settings','系統：設定');
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.code='ADMIN' AND p.code IN ('task:view','task:create','task:edit','task:delete','task:export','task:override_alert','schedule:view','schedule:edit','schedule:approve','customer:view','customer:create','customer:edit','customer:delete','employee:view','employee:create','employee:edit','employee:designate_leave','notification:view','notification:send','notification:manage_template','approval:view','approval:approve','pending_customer:view','pending_customer:create','pending_customer:convert','pending_customer:delete','map:view','system:audit','system:settings');
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.code='MANAGER' AND p.code IN ('schedule:view','schedule:approve','task:view','task:create','task:edit','task:export','task:override_alert','customer:view','customer:create','customer:edit','customer:delete','pending_customer:view','pending_customer:create','pending_customer:convert','pending_customer:delete','employee:view','employee:edit','employee:designate_leave','approval:view','approval:approve','notification:view','notification:send','notification:manage_template','map:view');
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.code='LEADER' AND p.code IN ('task:view','task:create','task:edit','task:export','task:override_alert','schedule:view','schedule:edit','customer:view','customer:create','customer:edit','customer:delete','pending_customer:view','pending_customer:create','pending_customer:convert','pending_customer:delete','employee:view','employee:designate_leave','approval:view','notification:view','notification:send','notification:manage_template','map:view');
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.code='EMPLOYEE' AND p.code IN ('schedule:view','notification:view','map:view','customer:view','employee:view','employee:edit');
INSERT INTO system_settings (key, value, description) VALUES ('notify_default_time','17:00','預設每日通知發送時間（主任沒有自己的設定時使用）');

COMMIT;
