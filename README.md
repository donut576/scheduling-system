# 藝康排班系統前端 (EcoLab Scheduling System)

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
├── api/                    # 業務領域 API 模組（auth, task, schedule, customer, employee, notification, approval, pending-customer）
│   └── instance.ts         # Axios 實例與請求/回應攔截器
├── components/
│   ├── base/                # 基礎共用元件（BaseTable, BaseModal, BaseSearchForm, BaseUpload, PageErrorBoundary, RouteLoadingIndicator）
│   ├── business/             # 業務元件（TaskForm, ScheduleCalendar, EmployeeSelect, ConflictPanel, AlertBadge, RecurrenceEditor, NotificationCenter, MapView）
│   └── layout/                # 版面元件（MainLayout, AppHeader, SideMenu）
├── constants/               # 常數定義（權限碼、任務狀態、證照類型、職位、通知類型、錯誤碼）
├── hooks/                   # 共用 Hooks（如 useMediaQuery）
├── i18n/                    # 國際化設定（zh-TW 預設、en-US 骨架）
├── pages/                   # 頁面（login, dashboard, task, schedule, customer, employee, notification, approval, pending-customer, map, 403）
├── queries/                  # TanStack Query hooks（各業務領域的資料查詢/變更）
├── routes/                  # 路由設定與權限守衛（guards.tsx、modules/ 依業務切分路由）
├── stores/                  # Zustand 狀態管理（使用者、權限、字典、任務、排班、應用程式狀態）
├── styles/                  # 設計 Token、Ant Design 主題覆蓋、全域樣式
├── test/                     # 測試基礎設施（setup、MSW mock handlers）
├── types/                     # TypeScript 型別定義
├── utils/                    # 工具函式（日期處理、警示規則引擎、Excel 匯出、驗證、防抖等）
├── App.tsx
└── main.tsx
```

## 核心功能模組

- **認證與權限**：登入、Token 管理、角色權限路由守衛（`src/routes`、`src/stores/useUserStore.ts`、`usePermissionStore.ts`）
- **任務管理**：任務建立/列表/搜尋/匯出、週期任務（`src/pages/task`、`src/components/business/TaskForm`）
- **警示引擎**：前端即時預檢排班規則（證照、連續工作日、日工時、時段重疊、指定休假、人數需求），詳見 `src/utils/alertRules.ts`
- **排班總覽**：日/週/月檢視、客戶與員工維度切換，基於 FullCalendar（`src/pages/schedule`、`src/components/business/ScheduleCalendar`）
- **客戶與員工資料管理**：`src/pages/customer`、`src/pages/employee`
- **通知與審批**：通知發送、範本管理、變更審批流程（`src/pages/notification`、`src/pages/approval`）
- **待定客戶管理**：`src/pages/pending-customer`
- **地圖檢視**：客戶分店位置與人員分布（`src/pages/map`、`src/components/business/MapView`）

## 測試

本專案採用單元測試、整合測試與 Property-Based Testing（PBT，使用 fast-check）並行的測試策略：

```bash
npm run test        # 執行一次
npm run test:watch  # watch 模式
```

- 測試設定：`vitest.config.ts`（若存在）、`src/test/setup.ts`
- API 模擬：`src/test/mocks/`（MSW handlers）
- 各模組之 `*.test.ts(x)` 為對應功能之單元/整合測試
- `alertRules.test.ts`、`recurrence.test.ts` 等含 Property-Based Testing，驗證設計文件中定義之正確性屬性

更完整的需求、設計與正確性屬性說明請參考 `.kiro/specs/ecolab-scheduling-system/` 目錄下的規格文件。

## 瀏覽器支援

支援 Chrome、Edge、Safari、Firefox 最新兩個版本，並針對 < 768px 寬度提供響應式版面（表格轉卡片、行事曆切換個人/每日檢視、側邊欄摺疊為 Drawer）。
