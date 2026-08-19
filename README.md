# 智慧排班與派遣管理系統 (Intelligent Scheduling System)

一套基於 React 18 與 TypeScript 開發的現代化前端排班與派遣管理平台，專為多案場、多班別及專業派遣巡檢業務設計。系統涵蓋任務派工、視覺化時間軸調度、即時合規防護引擎、多階層審批與地理派工等核心功能，支援桌面與行動裝置。

---

## 🌟 核心特色

- **⏱️ 視覺化排班總覽**：整合 FullCalendar 資源時間軸，提供日／週／月檢視，支援「全區總覽」、「客戶案場」、「組別員工」三大維度彈性調度。
- **🛡️ 智慧排班合規引擎**：前端即時預檢工時上限、連續工作天數、專業證照資格與指定排休衝突，大幅降低人為排班疏漏。
- **👥 精細化四大角色權限 (RBAC)**：針對系統管理員 (`Admin`)、主管 (`Manager`)、組長 (`Leader`) 與現場專員 (`Staff`) 提供客製化工作台與選單權限。
- **⚖️ 特許覆蓋與審批流程**：支援緊急調度的特許覆蓋申請、主管審批駁回防呆與申請人一鍵撤回機制。
- **📬 智慧通知與範本管理**：支援客戶排程通知與員工派工通知範本維護、動態變數插值與即時郵件預覽。
- **🗺️ 全域地理派工檢視**：畫面右下角全域浮球，一鍵展開全區客戶案場據點分布與即時派工位置。

---

## 🛠️ 技術棧

| 類別               | 技術選型                                                                    |
| :----------------- | :-------------------------------------------------------------------------- |
| **核心框架**       | React 18, TypeScript 5, Vite 6                                              |
| **UI 元件庫**      | Ant Design 5, @ant-design/icons                                             |
| **時間軸行事曆**   | FullCalendar v6 (`resource-timeline`, `timegrid`, `daygrid`, `interaction`) |
| **地理圖資**       | Leaflet, React-Leaflet                                                      |
| **路由導航**       | React Router 7                                                              |
| **伺服器狀態管理** | TanStack Query v5 (React Query)                                             |
| **全域狀態管理**   | Zustand 5                                                                   |
| **網路請求**       | Axios                                                                       |
| **日期處理**       | Day.js                                                                      |
| **國際化 (i18n)**  | i18next, react-i18next（繁體中文預設、英文）                                |
| **檔案匯出**       | SheetJS (xlsx)                                                              |
| **測試框架**       | Vitest, React Testing Library, fast-check (Property-Based Testing), MSW     |
| **程式碼規範**     | ESLint, Prettier, Husky, lint-staged                                        |

---

## 📁 目錄結構

```
src/
├── api/                     # 業務領域 API 模組（auth, task, schedule, customer, employee, notification, approval, pending-customer）
│   ├── instance.ts          # Axios 實例與請求/回應攔截器
│   └── ...                  # 各業務領域 API 函式定義
├── components/
│   ├── base/                # 基礎共用元件（BaseTable, BaseModal, BaseSearchForm, BaseUpload, PageErrorBoundary, RouteLoadingIndicator）
│   ├── business/            # 業務元件（TaskForm, ScheduleCalendar, EmployeeSelect, TimeSelect, ConflictPanel, AlertBadge, RecurrenceEditor, NotificationCenter, MapView）
│   └── layout/              # 版面元件（MainLayout, AppHeader, SideMenu, MapFloatingButton）
├── constants/               # 常數定義（權限碼、角色對照、任務狀態、證照類型、職位、組別地區、通知類型、審批類型、錯誤碼）
├── hooks/                   # 共用 Hooks（如 useMediaQuery 響應式裝置偵測）
├── i18n/                    # 國際化配置（全站繁體中文 zh-TW 預設、en-US）
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

---

## 🔐 四大權限角色矩陣

| 功能模組 / 操作權限                    |    系統管理員 (`admin`)     |      主管 (`manager`)       |       組長 (`leader`)       |       員工 (`staff`)        |
| :------------------------------------- | :-------------------------: | :-------------------------: | :-------------------------: | :-------------------------: |
| **儀表板 (`/dashboard`)**              |      全功能概況與日誌       |     全區概況與審核待辦      |     組內概況與申請進度      |   今日個人任務與近期通知    |
| **任務建立及一覽 (`/task`)**           |  新增 / 編輯 / 覆蓋 / 匯出  |  新增 / 編輯 / 覆蓋 / 匯出  |  新增 / 編輯 / 覆蓋 / 匯出  |      ❌ 無選單（隱藏）      |
| **班表總覽 (`/schedule`)**             |   跨區調度 / 編輯 / 刪除    |   跨區調度 / 編輯 / 刪除    |   組內調度 / 編輯 / 刪除    | 👁️ 組內班表（個人置頂高亮） |
| **客戶案場管理 (`/customer`)**         |     新增 / 編輯 / 刪除      |     新增 / 編輯 / 刪除      |     新增 / 編輯 / 刪除      |        👁️ 純檢視資料        |
| **待排客戶管理 (`/pending-customer`)** | 新增 / 編輯 / 轉任務 / 匯出 | 新增 / 編輯 / 轉任務 / 匯出 | 新增 / 編輯 / 轉任務 / 匯出 |      ❌ 無權限（隱藏）      |
| **員工資料管理 (`/employee`)**         |     CRUD + 指定排休設定     |     CRUD + 指定排休設定     |     CRUD + 指定排休設定     | 個人資料維護（排休欄唯讀）  |
| **通知管理 (`/notification`)**         | 範本編輯 / 自動開關 / 儲存  | 範本編輯 / 自動開關 / 儲存  | 範本編輯 / 自動開關 / 儲存  |   ❌ 隱藏（由儀表板檢閱）   |
| **異動核准 (`/approval`)**             |   全域審核（核准 / 駁回）   |   全域審批（核准 / 駁回）   |   本人申請進度追蹤 / 撤回   |      ❌ 無權限（隱藏）      |
| **全域地圖檢視 (`/map`)**              |       右下角浮動按鈕        |       右下角浮動按鈕        |       右下角浮動按鈕        |       右下角浮動按鈕        |

---

## 🚀 快速開始

### 環境需求

- Node.js 18.0+
- npm 9.0+

### 安裝依賴

```bash
npm install
```

### 啟動開發伺服器

```bash
npm run dev
```

啟動後瀏覽器造訪 `http://localhost:5173`。

### 專案建置

```bash
npm run build
```

產出靜態檔案至 `dist/` 目錄。

### 執行自動化測試

```bash
npm run test        # 執行 Vitest 測試套件
npm run test:watch  # 監聽模式執行
```

---

## 🧪 測試架構

專案採用三層測試保障策略：

1. **單元測試 (Unit Tests)**：驗證工具函式、客製 Hooks 與狀態 Store 邏輯。
2. **元件與整合測試 (Integration Tests)**：透過 React Testing Library 與 MSW 模擬真實 API 交互。
3. **屬性基礎測試 (Property-Based Testing, PBT)**：使用 `fast-check` 驗證工時排班演算法、連續排班防呆與資料轉換的數學不變性。

---

## 📄 授權說明

本專案採用 [MIT License](LICENSE) 開源授權，歡迎學習與交流。\n
