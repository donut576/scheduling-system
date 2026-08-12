# 需求文件：藝康排班系統前端

## 簡介

藝康排班系統為一套以 React SPA 架構開發的前端應用程式，涵蓋客戶任務派工、員工排班、警示預防、通知審批等核心業務流程。系統支援桌面與行動瀏覽器，第一階段以手動排班搭配預防流程為主，提供直覺化的排班管理介面。

## 詞彙表

- **系統 (System)**：藝康排班系統前端應用程式整體
- **任務管理模組 (Task_Manager)**：負責任務建立、列表、編輯、匯出及週期任務的模組
- **排班總覽模組 (Schedule_Viewer)**：負責日/週/月檢視、客戶與員工維度呈現的模組
- **客戶資料模組 (Customer_Manager)**：負責客戶集團、分店、地址、聯絡人、證照限制管理的模組
- **員工資料模組 (Employee_Manager)**：負責員工職位、權限、群組、指定休假、證照管理的模組
- **警示引擎 (Alert_Engine)**：前端即時預檢排班規則違規的模組
- **通知模組 (Notification_Manager)**：負責通知發送、審批流程、狀態追蹤的模組
- **待定時間模組 (Pending_Customer_Manager)**：負責年約預排但尚未確定時間之客戶管理的模組
- **認證模組 (Auth_Manager)**：負責使用者登入、權限驗證、Token 管理的模組
- **行事曆元件 (Calendar_Component)**：基於 FullCalendar v6 的排班行事曆顯示元件
- **地圖檢視模組 (Map_Viewer)**：負責客戶分店地點顯示與基本篩選的模組
- **集團 (Group)**：客戶所屬之集團組織
- **分店 (Branch)**：集團下之個別服務據點
- **證照 (License)**：員工持有之專業證照類別（無/專業/病媒/火蟻/6hr安衛/甲乙丙安衛管理師）
- **指定休假 (Designated_Leave)**：員工被指定之固定休假日
- **工作內容 (Task_Content)**：任務之服務項目（P、R、S、白蟻、火蟻、臭蟲、車維、訓練/會議、其他）
- **班別 (Shift)**：任務所屬的工作時段分類
- **路線 (Route)**：任務所屬的服務路線
- **覆蓋備註 (Override_Remark)**：授權人員覆蓋警示時所填寫之說明

## 需求

---

### 需求 1：使用者認證與會話管理

**使用者故事：** 身為系統使用者，我希望能安全登入系統並維持會話，以便存取我被授權的功能。

#### 驗收條件

1. THE Auth_Manager SHALL 提供帳號/員工編號與密碼之登入表單
2. WHEN 使用者連續登入失敗三次，THE Auth_Manager SHALL 顯示圖形驗證碼
3. WHEN 使用者勾選「記住我」並成功登入，THE Auth_Manager SHALL 將 Token 持久化至 sessionStorage
4. WHEN 登入成功，THE Auth_Manager SHALL 取得使用者角色與權限代碼並存入 useUserStore
5. WHEN Token 過期或無效，THE Auth_Manager SHALL 導向登入頁面並清除本地會話資料
6. THE Auth_Manager SHALL 於所有 API 請求之 Authorization 標頭附帶 Bearer Token

---

### 需求 2：權限路由守衛

**使用者故事：** 身為系統管理者，我希望不同角色僅能存取其授權之頁面與操作，以確保資料安全。

#### 驗收條件

1. WHEN 使用者登入成功，THE 系統 SHALL 根據角色建立可存取路由清單與選單樹
2. WHEN 使用者嘗試存取未授權之路由，THE 系統 SHALL 導向 403 無權限頁面
3. THE 系統 SHALL 根據權限代碼控制頁面中按鈕與操作之顯示與隱藏
4. WHEN 使用者登出或 Token 失效，THE 系統 SHALL 清除權限快取並重新導向登入頁面

---

### 需求 3：任務建立

**使用者故事：** 身為組長/行政人員，我希望能建立新任務並指派員工，以便安排客戶服務工作。

#### 驗收條件

1. THE Task_Manager SHALL 提供任務建立表單，包含集團（必填，連動分店）、任務類型（合約/單次/ESR）、分店（必填）、日期、起訖時間、人數、班別、路線、工作內容、備註、指派員工欄位
2. WHEN 使用者選擇集團，THE Task_Manager SHALL 連動篩選該集團下之分店選項
3. WHEN 使用者選擇日期，THE Task_Manager SHALL 以紅色標示國定假日
4. THE Task_Manager SHALL 支援起訖時間採 24 小時制且允許跨日設定
5. WHEN 使用者選擇工作內容，THE Task_Manager SHALL 提供多選介面包含 P、R、S、白蟻、火蟻、臭蟲、車維、訓練/會議、其他
6. WHEN 使用者選擇指派員工，THE Task_Manager SHALL 提供依群組、證照、休假狀態篩選之員工選擇介面
7. WHEN 使用者儲存任務，THE Alert_Engine SHALL 執行即時預檢並回報違規項目
8. IF 即時預檢發現阻擋等級違規且無授權覆蓋，THEN THE Task_Manager SHALL 阻止任務儲存並顯示違規詳情

---

### 需求 4：任務列表與搜尋

**使用者故事：** 身為組長/行政人員，我希望能瀏覽與搜尋所有任務，以便快速找到需要處理的工作。

#### 驗收條件

1. THE Task_Manager SHALL 以表格形式顯示任務列表，欄位包含集團、任務類型、分店、日期、起訖時間、人數、班別、路線、工作內容、指派人員、週期、備註
2. THE Task_Manager SHALL 提供依集團與分店關鍵字之模糊搜尋功能
3. WHEN 任務列表超過單頁顯示數量，THE Task_Manager SHALL 提供分頁功能
4. THE Task_Manager SHALL 支援 1000 筆任務之分頁列表效能需求
5. WHEN 使用者點擊任務列，THE Task_Manager SHALL 開啟任務詳情與編輯介面

---

### 需求 5：週期任務

**使用者故事：** 身為組長，我希望能設定週期性重複任務，以便自動化例行客戶服務的排程。

#### 驗收條件

1. THE Task_Manager SHALL 提供類似 Outlook 之週期設定介面（每日/每週/每月/自訂）
2. WHEN 使用者設定週期規則並儲存，THE Task_Manager SHALL 依規則產生對應之重複任務
3. THE Calendar_Component SHALL 以 ∞ 符號標示週期任務之任務方塊
4. WHEN 使用者編輯週期任務之單一實例，THE Task_Manager SHALL 提供「僅此次」或「此次及之後」之修改範圍選項

---

### 需求 6：任務匯出

**使用者故事：** 身為行政人員，我希望能將任務資料匯出為 Excel，以便進行離線分析與報告。

#### 驗收條件

1. WHEN 使用者點擊匯出按鈕，THE Task_Manager SHALL 依當前篩選條件將任務列表匯出為 .xlsx 格式檔案
2. THE Task_Manager SHALL 使用 SheetJS 產生包含所有列表欄位之 Excel 檔案
3. WHILE 匯出作業進行中，THE Task_Manager SHALL 顯示局部載入指示器

---

### 需求 7：排班警示規則預檢

**使用者故事：** 身為組長，我希望系統能在儲存排班時即時檢查違規，以便預防不合規的排班安排。

#### 驗收條件

1. WHEN 任務儲存時，THE Alert_Engine SHALL 檢查該任務是否至少有一名持有所需證照之人員指派，違規時產生阻擋等級警示
2. WHEN 任務儲存時，THE Alert_Engine SHALL 檢查指派員工是否連續工作超過七日，違規時產生阻擋等級警示
3. WHEN 任務儲存時，THE Alert_Engine SHALL 檢查指派員工當日工時是否超過十小時，違規時產生阻擋等級警示
4. WHEN 任務儲存時，THE Alert_Engine SHALL 檢查指派員工於相同時段是否已有重複排班，違規時產生阻擋等級警示
5. WHEN 任務儲存時，THE Alert_Engine SHALL 檢查指派員工是否於指定休假日被排班，違規時產生阻擋等級警示
6. WHEN 任務儲存時，THE Alert_Engine SHALL 檢查指派人數是否低於最低需求人數，違規時產生阻擋等級警示
7. WHEN 授權使用者填寫覆蓋備註後確認覆蓋，THE Alert_Engine SHALL 允許該任務儲存並標記為已覆蓋狀態
8. WHEN 任務被覆蓋儲存後，THE Calendar_Component SHALL 以特殊警示色彩或標記顯示該任務方塊

---

### 需求 8：排班總覽 — 日/週/月檢視

**使用者故事：** 身為組長/主管，我希望能以不同時間維度瀏覽排班狀況，以便全面掌握人力配置。

#### 驗收條件

1. THE Schedule_Viewer SHALL 提供日檢視、週檢視、月檢視三種切換模式
2. THE Schedule_Viewer SHALL 提供工具列包含檢視切換、期間選擇、集團篩選、分店篩選、員工/區域篩選、地圖按鈕
3. THE Schedule_Viewer SHALL 支援集團_分店維度與員工_區域維度之檢視切換
4. THE Calendar_Component SHALL 於任務方塊顯示集團、分店、時間資訊
5. WHEN 任務為跨日任務，THE Calendar_Component SHALL 將任務方塊延伸至隔日顯示
6. THE Calendar_Component SHALL 以紅色標示國定假日
7. THE Schedule_Viewer SHALL 支援 100 名員工 × 31 天之排班資料於 1.5 秒內完成首次渲染

---

### 需求 9：排班總覽 — 任務互動

**使用者故事：** 身為組長，我希望能在排班總覽中直接查看與編輯任務，以便快速進行排班調整。

#### 驗收條件

1. WHEN 使用者點擊任務方塊，THE Schedule_Viewer SHALL 開啟詳情抽屜或浮動面板顯示完整任務資訊
2. THE Schedule_Viewer SHALL 於詳情面板提供編輯與取消按鈕
3. WHEN 使用者於詳情面板點擊編輯，THE Schedule_Viewer SHALL 開啟任務編輯介面並帶入當前資料

---

### 需求 10：客戶資料管理

**使用者故事：** 身為行政人員，我希望能管理客戶集團與分店資料，以便維護正確的客戶服務資訊。

#### 驗收條件

1. THE Customer_Manager SHALL 提供客戶資料列表，欄位包含集團名稱、分店名稱、地址、聯絡窗口、電話、證照限制、備註
2. THE Customer_Manager SHALL 提供新增、編輯、刪除客戶資料之操作介面
3. WHEN 使用者編輯客戶之證照限制，THE Customer_Manager SHALL 提供證照類型多選介面
4. THE Customer_Manager SHALL 提供依集團或分店名稱之搜尋篩選功能

---

### 需求 11：員工資料管理

**使用者故事：** 身為行政人員/主管，我希望能管理員工基本資料與證照，以便正確進行排班指派。

#### 驗收條件

1. THE Employee_Manager SHALL 提供員工資料列表，欄位包含姓名、電話、員工編號、職位、群組、指定休假、證照
2. THE Employee_Manager SHALL 提供新增、編輯員工資料之操作介面
3. WHEN 使用者設定員工證照，THE Employee_Manager SHALL 提供證照類型多選介面（無/專業/病媒/火蟻/6hr安衛/甲乙丙安衛管理師）
4. WHEN 使用者設定員工群組，THE Employee_Manager SHALL 以色彩編碼區分不同群組
5. THE Employee_Manager SHALL 提供指定休假日之設定介面
6. WHEN 使用者設定之證照組合存在衝突，THE Employee_Manager SHALL 顯示驗證錯誤訊息

---

### 需求 12：通知管理與發送

**使用者故事：** 身為組長/行政人員，我希望能管理與追蹤通知狀態，以便確保客戶與員工及時收到排班資訊。

#### 驗收條件

1. WHEN 每月十五日，THE Notification_Manager SHALL 提醒各組組長進行排班
2. WHILE 日期介於每月二十至三十一日之間且有新排班產生，THE Notification_Manager SHALL 提供手動通知發送功能
3. THE Notification_Manager SHALL 追蹤每筆通知之狀態（已通知、未通知、已變更+已通知、已變更+未通知）
4. THE Notification_Manager SHALL 提供通知範本管理，包含客戶通知、員工派工、變更審批範本
5. WHEN 客戶未回覆通知，THE Notification_Manager SHALL 將該通知視為已確認並記錄狀態可追蹤
6. THE Notification_Manager SHALL 提供應用程式內通知中心介面

---

### 需求 13：排班變更審批

**使用者故事：** 身為主管/經理，我希望排班變更需經過審批流程，以確保變更的合理性與可追溯性。

#### 驗收條件

1. WHEN 排班發生變更，THE Notification_Manager SHALL 通知主任與 SO
2. WHEN 班別變更時，THE Notification_Manager SHALL 要求主任與經理之雙重審批
3. WHEN 審批通過後，THE 系統 SHALL 自動更新通知主旨並重新發送予客戶
4. THE 系統 SHALL 記錄排班變更、警示覆蓋、權限變更、刪除操作之稽核日誌

---

### 需求 14：待定時間客戶管理

**使用者故事：** 身為行政人員，我希望能管理年約預排但尚未確定服務時間之客戶，以便追蹤並適時確認排程。

#### 驗收條件

1. THE Pending_Customer_Manager SHALL 提供待定時間客戶列表與管理介面
2. THE Pending_Customer_Manager SHALL 提供新增、編輯待定客戶資料之操作
3. WHEN 使用者確認服務時間，THE Pending_Customer_Manager SHALL 支援將待定客戶轉換為正式任務
4. THE Pending_Customer_Manager SHALL 提供匯出待定客戶列表為 Excel 之功能

---

### 需求 15：地圖檢視

**使用者故事：** 身為組長，我希望能在地圖上查看客戶分店位置與指派人員分布，以便直覺化理解服務地理範圍。

#### 驗收條件

1. THE Map_Viewer SHALL 於地圖上顯示客戶分店位置標記
2. THE Map_Viewer SHALL 以群組色彩區分不同指派人員之標記
3. THE Map_Viewer SHALL 提供基本篩選功能（依集團、分店、群組）
4. WHEN 使用者從任務列表、排班總覽或任務建立後點擊地圖按鈕，THE Map_Viewer SHALL 開啟地圖檢視並定位至相關位置

---

### 需求 16：響應式介面設計

**使用者故事：** 身為使用者，我希望系統在不同裝置上都能正常使用，以便在辦公室或外出時皆可存取排班資訊。

#### 驗收條件

1. WHILE 瀏覽器視窗寬度小於 768px，THE 系統 SHALL 將表格轉換為卡片式呈現
2. WHILE 瀏覽器視窗寬度小於 768px，THE Schedule_Viewer SHALL 切換為個人/每日檢視模式
3. THE 系統 SHALL 支援 Chrome、Edge、Safari、Firefox 最新兩個版本
4. THE 系統 SHALL 確保所有表單具備鍵盤導航功能
5. THE 系統 SHALL 確保所有表單欄位具備關聯之標籤元素
6. THE 系統 SHALL 確保色彩對比度達到 WCAG AA 等級（≥ 4.5:1）

---

### 需求 17：狀態管理與資料快取

**使用者故事：** 身為使用者，我希望系統能有效管理狀態與快取，以便獲得流暢的操作體驗。

#### 驗收條件

1. THE 系統 SHALL 使用 TanStack Query 管理所有伺服器狀態之快取與同步
2. THE 系統 SHALL 使用 Zustand 管理本地 UI 狀態（使用者、權限、字典、任務、排班、應用程式狀態）
3. WHEN 路由切換時，THE 系統 SHALL 僅顯示全域載入指示器
4. WHEN 個別操作執行時，THE 系統 SHALL 顯示局部載入指示器
5. THE 系統 SHALL 對查詢請求使用 AbortController 以支援取消進行中之請求
6. THE 系統 SHALL 對即時驗證請求實施 200 毫秒之防抖延遲

---

### 需求 18：國際化與在地化

**使用者故事：** 身為系統管理者，我希望系統預留多語系支援架構，以便未來擴展至其他語言。

#### 驗收條件

1. THE 系統 SHALL 以繁體中文（zh-TW）為預設語系
2. THE 系統 SHALL 預留英文（en-US）語系之架構支援
3. THE 系統 SHALL 使用 Day.js 搭配 timezone 與 isoWeek 插件處理所有日期時間顯示
4. THE 系統 SHALL 以 ISO 8601 格式加時區資訊傳遞所有日期時間資料

---

### 需求 19：安全性要求

**使用者故事：** 身為系統管理者，我希望系統具備基本安全防護，以保護使用者與業務資料。

#### 驗收條件

1. THE 系統 SHALL 透過 HTTPS 傳輸所有資料
2. THE 系統 SHALL 對所有使用者輸入執行跳脫處理以防止 XSS 攻擊
3. THE 系統 SHALL 對敏感資料（如密碼欄位）執行遮罩顯示
4. THE 系統 SHALL 於所有 API 請求中驗證 Bearer Token 之有效性

---

## 未來範圍（P2/P3）

以下需求列為未來規劃參考，不在第一階段實作範圍內：

- **P2**：請假管理、換班流程、出勤異常追蹤、統計報表
- **P3**：自動排班演算法、ESR 距離優先排序、設備整合、工時系統/QR 打卡/RFID 完整整合
