-- 種子資料（初版，依前端 src/constants 現況整理）
-- 注意：權限與角色對照取自前端現有設定，PE 的權限規則（SO、互看範圍）確認後需調整；群組與行政區對照見檔案最後。
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


-- 群組（轄區）與行政區對照：PE 提供的新規則（2026-11）。中區、嘉義、南區各分早、晚班，行政區範圍相同，只有人員與主任不同。沒有列到的縣市、行政區，系統視為不存在。
-- 林口區依指示只放桃區（桃一早、桃竹晚）。「東區」暫定為新竹市東區，待 PE 確認。
INSERT INTO regions (name, color) VALUES
  ('北早','#7a69c0'),
  ('北一晚','#5d4ba8'),
  ('北二晚','#9a8bd6'),
  ('桃一早','#69c0a5'),
  ('桃二早','#4fa88c'),
  ('桃竹晚','#8fd3bd'),
  ('中區早','#c09569'),
  ('中區晚','#a87a4d'),
  ('嘉義早','#69a5c0'),
  ('嘉義晚','#4a87a3'),
  ('南區早','#c06984'),
  ('南區晚','#a24a67');
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='北早'),'台北市','士林區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','北投區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','內湖區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','中山區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','松山區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','大同區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','淡水區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','五股區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','蘆洲區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','三重區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','泰山區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','新莊區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','中正區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','萬華區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','大安區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','文山區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','信義區'),
  ((SELECT id FROM regions WHERE name='北早'),'台北市','南港區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','樹林區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','土城區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','三峽區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','中和區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','永和區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','新店區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','汐止區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','鶯歌區'),
  ((SELECT id FROM regions WHERE name='北早'),'新北市','板橋區'),
  ((SELECT id FROM regions WHERE name='北早'),'基隆市',NULL);
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='北一晚'),'台北市','士林區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'台北市','北投區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'台北市','內湖區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'台北市','中山區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'台北市','松山區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'台北市','大同區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'新北市','淡水區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'新北市','五股區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'新北市','蘆洲區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'新北市','三重區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'新北市','泰山區'),
  ((SELECT id FROM regions WHERE name='北一晚'),'新北市','新莊區');
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='北二晚'),'台北市','中正區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'台北市','萬華區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'台北市','大安區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'台北市','文山區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'台北市','信義區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'台北市','南港區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','樹林區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','土城區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','三峽區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','中和區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','永和區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','新店區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','汐止區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','鶯歌區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'新北市','板橋區'),
  ((SELECT id FROM regions WHERE name='北二晚'),'基隆市',NULL);
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='桃一早'),'新北市','林口區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','復興區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','觀音區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','新屋區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','蘆竹區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','八德區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','大園區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','大溪區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','桃園區'),
  ((SELECT id FROM regions WHERE name='桃一早'),'桃園市','龜山區');
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='桃二早'),'桃園市','龍潭區'),
  ((SELECT id FROM regions WHERE name='桃二早'),'桃園市','平鎮區'),
  ((SELECT id FROM regions WHERE name='桃二早'),'桃園市','楊梅區'),
  ((SELECT id FROM regions WHERE name='桃二早'),'桃園市','中壢區'),
  ((SELECT id FROM regions WHERE name='桃二早'),'新竹縣','竹北市'),
  ((SELECT id FROM regions WHERE name='桃二早'),'苗栗縣','竹南鎮'),
  ((SELECT id FROM regions WHERE name='桃二早'),'新竹市','東區'),
  ((SELECT id FROM regions WHERE name='桃二早'),'新竹縣','湖口鄉'),
  ((SELECT id FROM regions WHERE name='桃二早'),'新竹縣','新埔鎮'),
  ((SELECT id FROM regions WHERE name='桃二早'),'新竹縣','新豐鄉');
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='桃竹晚'),'新北市','林口區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','復興區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','觀音區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','新屋區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','蘆竹區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','八德區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','大園區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','大溪區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','桃園區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','龜山區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','龍潭區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','平鎮區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','楊梅區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'桃園市','中壢區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'新竹縣','竹北市'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'苗栗縣','竹南鎮'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'新竹市','東區'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'新竹縣','湖口鄉'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'新竹縣','新埔鎮'),
  ((SELECT id FROM regions WHERE name='桃竹晚'),'新竹縣','新豐鄉');
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='中區早'),'台中市',NULL),
  ((SELECT id FROM regions WHERE name='中區晚'),'台中市',NULL),
  ((SELECT id FROM regions WHERE name='中區早'),'彰化縣',NULL),
  ((SELECT id FROM regions WHERE name='中區晚'),'彰化縣',NULL),
  ((SELECT id FROM regions WHERE name='中區早'),'南投縣',NULL),
  ((SELECT id FROM regions WHERE name='中區晚'),'南投縣',NULL);
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='嘉義早'),'雲林縣',NULL),
  ((SELECT id FROM regions WHERE name='嘉義晚'),'雲林縣',NULL),
  ((SELECT id FROM regions WHERE name='嘉義早'),'嘉義市',NULL),
  ((SELECT id FROM regions WHERE name='嘉義晚'),'嘉義市',NULL),
  ((SELECT id FROM regions WHERE name='嘉義早'),'嘉義縣',NULL),
  ((SELECT id FROM regions WHERE name='嘉義晚'),'嘉義縣',NULL);
INSERT INTO region_areas (region_id, city, district) VALUES
  ((SELECT id FROM regions WHERE name='南區早'),'台南市',NULL),
  ((SELECT id FROM regions WHERE name='南區晚'),'台南市',NULL),
  ((SELECT id FROM regions WHERE name='南區早'),'高雄市',NULL),
  ((SELECT id FROM regions WHERE name='南區晚'),'高雄市',NULL),
  ((SELECT id FROM regions WHERE name='南區早'),'屏東縣',NULL),
  ((SELECT id FROM regions WHERE name='南區晚'),'屏東縣',NULL),
  ((SELECT id FROM regions WHERE name='南區早'),'台東縣',NULL),
  ((SELECT id FROM regions WHERE name='南區晚'),'台東縣',NULL),
  ((SELECT id FROM regions WHERE name='南區早'),'澎湖縣',NULL),
  ((SELECT id FROM regions WHERE name='南區晚'),'澎湖縣',NULL);

COMMIT;
