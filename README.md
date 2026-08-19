# EcoLab Scheduling System

藝康排班系統為一套以 React SPA 架構開發的前端應用程式，涵蓋客戶任務派工、員工排班、警示預防、通知審批等核心業務流程，支援桌面與行動瀏覽器。

## 技術棧

| 類別        | 技術選型                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| 框架        | React 18, TypeScript 5, Vite 6                                           |
| UI 框架     | Ant Design 5                                                             |
| 行事曆      | FullCalendar v6（resource-timeline / daygrid / interaction）             |
| 地圖        | Leaflet / React-Leaflet                                                  |
| 路由        | React Router 7                                                           |
| 伺服器狀態  | TanStack Query v5                                                        |
| 本地狀態    | Zustand 5                                                                |
| HTTP 客戶端 | Axios                                                                    |
| 日期處理    | Day.js                                                                   |
| 國際化      | i18next / react-i18next                                                  |
| 匯出        | SheetJS (xlsx)                                                           |
| 測試        | Vitest, React Testing Library, fast-check（Property-Based Testing）, MSW |
| 程式碼標準  | ESLint, Prettier, Husky, lint-staged                                     |

## 環境需求

- Node.js 18 以上版本
- npm（隨 Node.js 安裝）

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

> **注意**：`xlsx`（SheetJS）套件的 npm registry 版本停留在 0.18.5 且含有已知安全漏洞，官方修復版本僅發布於 [SheetJS 官方 CDN](https://cdn.sheetjs.com/)，因此 `package.json` 中 `xlsx` 的版本為 CDN tarball 網址而非一般版本號，這是預期行為。

### 2. 設定環境變數

專案已提供 `.env.development` 與 `.env.production`，開發時可依需求調整：

```dotenv
VITE_API_BASE_URL=http://localhost:3000   # 後端 API 位址
VITE_WS_URL=ws://localhost:3000           # WebSocket 位址
VITE_APP_TITLE=藝康排班系統
VITE_UPLOAD_MAX_SIZE=10485760             # 上傳檔案大小限制（bytes）
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

啟動後預設於 `http://localhost:5173` 提供服務。開發模式下，所有 `/api` 開頭的請求會透過 `vite.config.ts` 中的 proxy 轉發至 `http://localhost:3000`（後端服務位址），如有不同請自行調整 `vite.config.ts` 或 `VITE_API_BASE_URL`。

### 4. 建置生產版本

```bash
npm run build
```

建置產物輸出至 `dist/` 目錄，內含 `vendor`、`antd` 等手動分包（manual chunks）以優化載入效能。

### 5. 預覽生產建置

```bash
npm run preview
```

## 常用指令

| 指令                 | 說明                                 |
| -------------------- | ------------------------------------ |
| `npm run dev`        | 啟動開發伺服器（Vite）               |
| `npm run build`      | TypeScript 型別檢查 + 生產建置       |
| `npm run preview`    | 本地預覽生產建置結果                 |
| `npm run lint`       | 執行 ESLint 檢查                     |
| `npm run format`     | 使用 Prettier 格式化 `src/` 下的檔案 |
| `npm run test`       | 執行一次性測試（Vitest）             |
| `npm run test:watch` | 以 watch 模式執行測試                |

> 專案已透過 Husky + lint-staged 設定 pre-commit hook，commit 前會自動對變更檔案執行 lint 與格式化。

## 目錄結構

```
src/
├── api/                     # 業務領域 API 模組（auth, task, schedule, customer, employee, notification, approval, pending-customer）
│   ├── instance.ts          # Axios 實例與請求/回應攔截器
│   └── ...                  # 各業務領域 API 定義
├── components/
│   ├── base/                # 基礎共用元件（BaseTable, BaseModal, BaseSearchForm, BaseUpload, PageErrorBoundary, RouteLoadingIndicator）
│   ├── business/            # 業務元件（TaskForm, ScheduleCalendar, EmployeeSelect, TimeSelect, ConflictPanel, AlertBadge, RecurrenceEditor, NotificationCenter, MapView）
│   └── layout/              # 版面元件（MainLayout, AppHeader, SideMenu, MapFloatingButton）
├── constants/               # 常數定義（權限碼、角色對照、任務狀態、證照類型、職位、組別地區、通知類型、審批類型、錯誤碼）
├── hooks/                   # 共用 Hooks（如 useMediaQuery 響應式裝置偵測）
├── i18n/                    # 國際化設定（全站繁體中文 zh-TW 預設、en-US）
├── pages/                   # 頁面元件（login, dashboard, task, schedule, customer, employee, notification, approval, pending-customer, map, 403）
├── queries/                 # TanStack Query hooks（各業務領域資料快取與變更管理）
├── routes/                  # 路由設定與權限守衛（guards.tsx、modules/ 依業務切分子路由）
├── stores/                  # Zustand 狀態管理（使用者、權限、字典、任務、排班、應用程式狀態）
├── styles/                  # 設計 Token、Ant Design 主題覆蓋、全域樣式
├── test/                    # 測試基礎設施（setup、MSW mock handlers 與 server）
├── types/                   # TypeScript 型別定義（auth, task, schedule, customer, employee, notification, approval, pending-customer, audit）
├── utils/                   # 工具函式庫（日期處理、警示規則引擎、Excel 匯出、證照驗證、模糊搜尋、防抖等）
├── App.tsx                  # 應用程式入口根元件
└── main.tsx                 # 渲染入口與 Provider 配置
```

## 核心功能模組

### 1. 認證與四大權限角色體系

- **企業內部帳號體系**：以「帳號」直接輸入員工編號（如 `STAFF01`、`LEADER01`），具備輸入提示、密碼登入、連續登入失敗防護驗證碼、忘記密碼申請與首次登入啟用流程。
- **頂部 Header 與導航**：全域頂部導覽列展示 **`Ecolab`** 品牌 Logo，點擊可直接返回儀表板首頁。
- **四大權限角色矩陣表**：

| 功能模組 / 操作權限                    |          系統管理員 (`admin`)          |            經理 (`manager`)            |            組長 (`leader`)             |         員工 (`staff`)          |
| :------------------------------------- | :------------------------------------: | :------------------------------------: | :------------------------------------: | :-----------------------------: |
| **儀表板 (`/dashboard`)**              |           全功能（查看細項）           |       全區概況與審核（前往審核）       |       組內概況與進度（查看進度）       |     今日個人任務與近期通知      |
| **任務建立及一覽 (`/task`)**           |       新增 / 編輯 / 覆蓋 / 匯出        |       新增 / 編輯 / 覆蓋 / 匯出        |       新增 / 編輯 / 覆蓋 / 匯出        |        ❌ 無選單（隱藏）        |
| **班表總覽 (`/schedule`)**             |           檢視 / 編輯 / 刪除           |           檢視 / 編輯 / 刪除           |           檢視 / 編輯 / 刪除           |  👁️ 組內同仁班表總覽（純檢視）  |
| **客戶資料管理 (`/customer`)**         |           新增 / 編輯 / 刪除           |           新增 / 編輯 / 刪除           |           新增 / 編輯 / 刪除           | 👁️ 純檢視資料（選單：客戶資料） |
| **待排客戶管理 (`/pending-customer`)** | 新增 / 編輯 / 刪除 / 轉正式任務 / 匯出 | 新增 / 編輯 / 刪除 / 轉正式任務 / 匯出 | 新增 / 編輯 / 刪除 / 轉正式任務 / 匯出 |        ❌ 無權限（隱藏）        |
| **員工資料管理 (`/employee`)**         |            CRUD + 指定排休             |            CRUD + 指定排休             |            CRUD + 指定排休             |  個人資料維護（指定排休反灰）   |
| **通知管理 (`/notification`)**         |       範本編輯 / 自動開關 / 儲存       |       範本編輯 / 自動開關 / 儲存       |       範本編輯 / 自動開關 / 儲存       | ❌ 無選單（隱藏，由儀表板檢視） |
| **異動核准 (`/approval`)**             |        全域審核（核准 / 駁回）         |        全域審批（核准 / 駁回）         |        本人申請進度追蹤 / 撤回         |         無權限（隱藏）          |
| **全域地圖檢視 (`/map`)**              |               右下角浮球               |               右下角浮球               |               右下角浮球               |           右下角浮球            |

### 2. 儀表板總覽（Dashboard）

- **個人化歡迎問候**：主頁頂部展示 `Hi, {姓名}！`（如 `Hi, Demo 員工！`），副標題統一呈現 **「歡迎使用藝康排班系統」**。
- **角色化卡片分工與佈局**：
  - **管理端 (Admin / Manager / Leader)**：
    - **今日排班概要**：顯示今日任務總數，僅呈現「正常」與「已覆蓋」標籤；點擊「已覆蓋」可展開特許任務與主管備註彈窗。
    - **待審核項目**：即時掌握待審批之排班異動與特許覆蓋申請單（Admin 顯示「查看細項」、Manager 顯示「前往審核」、Leader 顯示「查看進度」）。
    - **近期通知發送紀錄**：
      - Admin：展示寄件人 Tag 與收件人姓名。
      - Manager / Leader：僅展示收件對象姓名，隱藏寄件人。
      - 點擊列表項可展開郵件詳細內容彈窗。
  - **員工端 (Staff)**：
    - **今日個人任務**：統計指派給該員工本人的今日任務數。
    - **自動隱藏待審核區塊**，畫面呈現雙大卡片平衡佈局。
    - **近期通知**：展示指派給本人的通知，呈現寄件人 Tag 並隱藏收件對象，點擊可開啟明細彈窗。

### 3. 任務管理與排班總覽

- **任務管理**：
  - 採 4 大 Card 區塊架構（基本資訊、時間與班別、指派人員、施作內容與備註）。
  - 整合 24 小時 15 分鐘段自訂時間選擇器（`TimeSelect`）。
  - 員工指派選單支援依營運地區（台北、新竹、台中、台南）與班別分層過濾。
  - 支援四大標準班次（早班、午班、晚班、大夜班）與週期性任務規則。
- **排班總覽**：
  - 基於 FullCalendar 提供日/週/月檢視。
  - **管理端**：支援「總覽」、「集團」、「員工」三大維度自由切換與完整編輯、調度、刪除功能。
  - **員工端**：
    - 自動以「員工組別維度」呈現，左側直列呈現同組工作同仁名單。
    - 登入員工本人自動**置頂排序第一行**，並以淡藍底色高亮（`#f0f7ff`）標記，快速辨識。
    - 右側時間軸清晰呈現同組同仁 24 小時無重疊之服務排班區塊，點擊任務卡展開完整派工詳情。

### 4. 警示引擎與異動核准

- **前端即時預檢排班規則**：證照資格驗證、連續工作日上限、日工時上限、時段重疊衝突、指定休假衝突、人數需求檢核（`src/utils/alertRules.ts`）。
- **異動核准與撤回**：
  - 管理主管可審核全體申請單並進行核准或駁回。
  - 組長模式下自動過濾為僅顯示本人申請之案件，隱藏重複之申請人欄位。
  - 支援申請人一鍵「撤回申請」（`WITHDRAWN`），提供防呆確認與即時狀態更新。

### 5. 客戶與員工資料管理

- **客戶管理**：集團與分店階層資料維護、營運狀態與聯絡資訊。
- **待排客戶管理**：最左側懸停刪除叉叉、右側按鈕依「編輯」與「排定任務」直觀排列。
- **員工管理**：
  - 管理端：基本資料維護、證照管理（含「僅有施藥證」提醒）、指定排休編輯。
  - 員工端：直接載入個人資料表單，指定排休欄位反灰並明確標註「此欄位僅限組長以上職位編輯」，更新後即時同步更新全站各端資料與全域狀態。

### 6. 通知中心與地圖檢視

- **通知中心**：支援「客戶排程通知」與「員工派工通知」雙範本設定、動態變數插值、深色即時郵件預覽與發送開關。員工端側邊欄自動隱藏，統一於儀表板檢閱個人通知。
- **地圖檢視**：畫面右下角全域浮球（`MapFloatingButton`）一鍵開啟全台客戶分店地理分布與即時人員派工位置。

## 測試

本專案採用單元測試、整合測試與 Property-Based Testing（PBT，使用 fast-check）並行的測試策略：

```bash
npm run test        # 執行一次
npm run test:watch  # watch 模式
```

- 測試設定：`vitest.config.ts`、`src/test/setup.ts`
- API 模擬：`src/test/mocks/`（MSW handlers）
- 各模組之 `*.test.ts(x)` 為對應功能之單元/整合測試
- `alertRules.test.ts`、`recurrence.test.ts` 等含 Property-Based Testing，驗證設計文件中定義之正確性屬性

更完整的需求、設計與正確性屬性說明請參考 `.kiro/specs/ecolab-scheduling-system/` 目錄下的規格文件。

## 瀏覽器支援

支援 Chrome、Edge、Safari、Firefox 最新兩個版本，並針對 < 768px 寬度提供響應式版面（表格轉卡片、行事曆切換個人/每日檢視、側邊欄摺疊為 Drawer）。

## 帳號權限與資料流 Trace 指南

1. **登入與驗證**：[`src/pages/login/index.tsx`](file:///Users/yunhsuan/scheduling-system/src/pages/login/index.tsx) 呼叫 `authApi.login()`。
2. **Mock 處理**：[`src/test/mocks/handlers.ts`](file:///Users/yunhsuan/scheduling-system/src/test/mocks/handlers.ts) 攔截並回傳使用者角色與預設權限。
3. **狀態保存**：[`src/stores/useUserStore.ts`](file:///Users/yunhsuan/scheduling-system/src/stores/useUserStore.ts) 保存 Token 與使用者資料。
4. **選單與權限計算**：[`src/stores/usePermissionStore.ts`](file:///Users/yunhsuan/scheduling-system/src/stores/usePermissionStore.ts) 對照 [`src/constants/permissions.ts`](file:///Users/yunhsuan/scheduling-system/src/constants/permissions.ts) 計算可見選單樹。
5. **路由防護**：[`src/routes/guards.tsx`](file:///Users/yunhsuan/scheduling-system/src/routes/guards.tsx) 執行登入檢查與未授權 403 攔截。

## 授權條款 (License)

本專案為 **企業內部專用專有軟體（Proprietary and Confidential）**。詳細條款請參閱根目錄下的 [`LICENSE`](file:///Users/yunhsuan/scheduling-system/LICENSE) 檔案。未經授權禁止複製、散布、修改或作任何外部公開用途。
