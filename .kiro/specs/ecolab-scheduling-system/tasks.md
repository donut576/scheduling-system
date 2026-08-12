# Implementation Plan: 藝康排班系統前端 (EcoLab Scheduling System)

## Overview

本實作計畫將設計文件轉化為可執行的編碼任務，按照開發階段逐步推進。每個任務均為可由程式碼生成 LLM 執行之具體編碼步驟，任務間具備遞增依賴關係，最終階段將所有模組整合串接。

技術棧：React 18+, TypeScript, Vite 5+, Ant Design 5, FullCalendar v6, React Router 6+, TanStack Query v5, Zustand 4+, Axios, Day.js, fast-check, Vitest, React Testing Library

## Tasks

- [x] 1. 專案初始化與基礎架構建立
  - [x] 1.1 初始化 Vite + React + TypeScript 專案
    - 使用 `npm create vite@latest` 建立專案，配置 `tsconfig.json` 嚴格模式
    - 安裝核心依賴：react, react-dom, typescript, antd, @ant-design/icons
    - 安裝開發依賴：vitest, @testing-library/react, fast-check, msw, eslint, prettier
    - 建立 `.env.development` 與 `.env.production` 環境變數檔案
    - 配置 `vite.config.ts` 含 proxy、路徑別名、build 選項
    - _Requirements: 17.1, 18.1_

  - [x] 1.2 建立目錄結構與型別定義
    - 按設計文件建立完整目錄結構：api/, components/base/, components/business/, pages/, routes/, queries/, stores/, constants/, utils/, styles/, types/, i18n/
    - 實作所有核心型別定義檔案：types/auth.ts, types/task.ts, types/schedule.ts, types/customer.ts, types/employee.ts, types/notification.ts, types/alert.ts, types/common.ts
    - 定義 RoleType, TaskType, TaskStatus, AlertStatus, ShiftType, TaskContent, LicenseType, PositionType 等列舉型別
    - _Requirements: 3.1, 7.1, 11.3, 12.3_

  - [x] 1.3 建立常數定義與設計 Token
    - 實作 constants/permissions.ts（權限代碼映射）
    - 實作 constants/taskStatus.ts, licenseTypes.ts, positions.ts, notificationTypes.ts, errorCodes.ts
    - 實作 styles/tokens.ts（設計 Token：色彩、間距、字型、圓角）
    - 實作 styles/antd-theme.ts（Ant Design 主題覆蓋配置）
    - 實作 styles/global.css（全域樣式與 CSS 變數）
    - _Requirements: 16.6, 18.1_

  - [x] 1.4 配置國際化架構
    - 安裝 i18next, react-i18next
    - 建立 i18n/index.ts 初始化配置（預設 zh-TW）
    - 建立 i18n/zh-TW/ 目錄含各模組翻譯檔案
    - 建立 i18n/en-US/ 目錄含骨架翻譯檔案（預留架構）
    - _Requirements: 18.1, 18.2_

  - [x] 1.5 Write property test for 色彩對比度合規
    - **Property 28: 色彩對比度合規**
    - 實作 utils/colorContrast.ts 含 calculateContrastRatio 函式
    - 驗證所有 designTokens 中前景/背景色彩組合之對比度 ≥ 4.5:1
    - **Validates: Requirements 16.6**

- [x] 2. API 層與 HTTP 基礎設施
  - [x] 2.1 建立 Axios 實例與攔截器
    - 實作 api/instance.ts 含 baseURL、timeout(30s)、Content-Type 配置
    - 實作請求攔截器：從 useUserStore 取得 Token 附加至 Authorization 標頭
    - 實作回應攔截器：401 導向登入、403 提示、422 表單錯誤映射、429 頻率限制、500+ 伺服器錯誤、Network 離線提示
    - 實作 handleApiError 全域錯誤處理函式
    - _Requirements: 1.5, 1.6, 19.4_

  - [x] 2.2 Write property test for API Bearer Token 附加
    - **Property 2: API 請求 Bearer Token 附加**
    - 驗證：for any 有效 Token，Axios 實例發出之請求 Authorization 標頭格式為 `Bearer <token>`
    - **Validates: Requirements 1.6, 19.4**

  - [x] 2.3 實作各業務領域 API 模組
    - 實作 api/auth.ts（login, getProfile）
    - 實作 api/task.ts（list, create, update, validate, overrideWarning）
    - 實作 api/schedule.ts（get, update）
    - 實作 api/customer.ts（list, create, update, delete）
    - 實作 api/employee.ts（list, create, update）
    - 實作 api/notification.ts（list, send, getTemplates, updateTemplate）
    - 實作 api/approval.ts（list, approve, reject）
    - 實作 api/pending-customer.ts（list, create, update, convert, export）
    - 所有 API 函式支援 AbortSignal 參數用於請求取消
    - _Requirements: 3.1, 4.1, 10.2, 11.2, 12.4, 13.1, 14.2, 17.5_

- [x] 3. 狀態管理層
  - [x] 3.1 實作使用者與權限 Store
    - 實作 stores/useUserStore.ts（token, user, loginFailCount, login, logout, setToken）
    - Token 持久化至 sessionStorage（記住我功能）
    - 實作 stores/usePermissionStore.ts（accessibleRoutes, menuTree, permissionCodes, buildPermissions, hasPermission, hasRole）
    - 根據角色建立路由清單與選單樹
    - _Requirements: 1.3, 1.4, 2.1, 2.3_

  - [x] 3.2 Write property test for 登入後使用者資料儲存完整性
    - **Property 1: 登入後使用者資料儲存完整性 (Login Profile Round-Trip)**
    - 驗證：for any UserProfile，存入 useUserStore 後取出之資料應完全一致
    - **Validates: Requirements 1.4**

  - [x] 3.3 Write property test for 角色路由生成正確性
    - **Property 3: 角色路由生成正確性**
    - 驗證：for any RoleType，生成之可存取路由清單為全域路由表之合法子集
    - **Validates: Requirements 2.1**

  - [x] 3.4 實作字典與應用程式 Store
    - 實作 stores/useDictStore.ts（taskTypes, shifts, routes, contents, licenses, positions, groups, loadDict）
    - 實作 stores/useAppStore.ts（sidebarCollapsed, theme, locale, tabs, toggleSidebar, setLocale, addTab, removeTab）
    - _Requirements: 17.2, 18.1_

  - [x] 3.5 實作任務與排班 Store
    - 實作 stores/useTaskStore.ts（filters, formDraft, alertResults, setFilters, setFormDraft, setAlertResults）
    - 實作 stores/useScheduleStore.ts（currentView, dimension, dateRange, changeBuffer, conflictList, undoStack, setView, setDimension, pushChange, undo）
    - _Requirements: 17.2, 8.1, 9.2_

- [x] 4. Checkpoint - 確認基礎架構完整性
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 工具函式與警示引擎
  - [x] 5.1 實作日期與格式化工具函式
    - 實作 utils/date.ts：安裝 dayjs + timezone + isoWeek 插件
    - 實作 formatDateTime, formatDate, formatTime, isOvernight, calculateDuration, getMaxConsecutiveDays, isHoliday 函式
    - 實作跨日時間區間計算邏輯：endTime ≤ startTime 時視為跨日
    - 實作 utils/format.ts：數字格式化、電話格式化、地址格式化
    - _Requirements: 3.4, 8.5, 18.3, 18.4_

  - [x] 5.2 Write property test for 跨日時間區間計算
    - **Property 7: 跨日時間區間計算**
    - 驗證：for any 起訖時間組合，若 endTime ≤ startTime 則時長 = (24:00 - startTime) + endTime
    - **Validates: Requirements 3.4**

  - [x] 5.3 Write property test for ISO 8601 日期格式
    - **Property 30: ISO 8601 日期格式**
    - 驗證：for any 系統產生之日期時間值，格式符合 ISO 8601 並包含時區資訊
    - **Validates: Requirements 18.4**

  - [x] 5.4 實作安全性工具函式
    - 實作 utils/validation.ts：表單驗證規則（必填、長度、格式）
    - 實作 XSS 輸入跳脫函式 escapeHtml（處理 <, >, &, ", ' 字元）
    - 實作 sanitizeInput 用於所有使用者輸入之前處理
    - _Requirements: 19.2, 19.3_

  - [x] 5.5 Write property test for XSS 輸入跳脫
    - **Property 31: XSS 輸入跳脫**
    - 驗證：for any 包含 HTML 特殊字元之字串，經跳脫後應轉換為安全實體且文字語義不變
    - **Validates: Requirements 19.2**

  - [x] 5.6 實作警示規則引擎
    - 實作 utils/alertRules.ts 含六項規則檢查純函式：
    - checkLicenseRequired：證照要求檢查
    - checkConsecutiveDays：連續七日檢查（含 getMaxConsecutiveDays 輔助函式）
    - checkDailyHoursExceeded：日工時十小時檢查（含 calculateTotalHours 輔助函式）
    - checkDuplicateSlot：同時段重複排班檢查（含 isTimeOverlap 輔助函式）
    - checkDesignatedLeave：指定休假日檢查
    - checkHeadcountBelowMin：人數不足檢查
    - 實作 runAlertChecks 主執行函式，聚合所有規則結果
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 5.7 Write property test for 證照要求規則
    - **Property 13: 證照要求規則**
    - 驗證：for any 具有證照要求之客戶任務與指派員工集合，違規 iff 無人持有全部要求證照
    - **Validates: Requirements 7.1**

  - [x] 5.8 Write property test for 連續工作日規則
    - **Property 14: 連續工作日規則**
    - 驗證：for any 員工排班日期集合與新任務日期，違規 iff 連續工作日 > 7
    - **Validates: Requirements 7.2**

  - [x] 5.9 Write property test for 每日工時規則
    - **Property 15: 每日工時規則**
    - 驗證：for any 員工同日所有任務時段（含新任務），違規 iff 總工時 > 10 小時
    - **Validates: Requirements 7.3**

  - [x] 5.10 Write property test for 時間重疊偵測
    - **Property 16: 時間重疊偵測**
    - 驗證：for any 兩時間區間 [s1,e1] 與 [s2,e2]，overlap iff s1 < e2 且 s2 < e1
    - **Validates: Requirements 7.4**

  - [x] 5.11 Write property test for 指定休假規則
    - **Property 17: 指定休假規則**
    - 驗證：for any 員工指定休假日集合與任務日期，違規 iff 日期在休假集合中
    - **Validates: Requirements 7.5**

  - [x] 5.12 Write property test for 人數需求規則
    - **Property 18: 人數需求規則**
    - 驗證：for any 最低需求人數與實際指派數量，違規 iff 指派人數 < 需求人數
    - **Validates: Requirements 7.6**

  - [x] 5.13 Write property test for 警示驗證閘門
    - **Property 9: 警示驗證閘門**
    - 驗證：for any 任務表單資料，儲存成功 iff (無違規 OR 已提供覆蓋備註)
    - **Validates: Requirements 3.8, 7.7**

  - [x] 5.14 實作 Excel 匯出工具
    - 安裝 SheetJS (xlsx)
    - 實作 utils/excel.ts：exportToExcel 函式，支援欄位映射與檔案下載
    - _Requirements: 6.1, 6.2_

  - [x] 5.15 Write property test for 匯出資料一致性
    - **Property 12: 匯出資料一致性**
    - 驗證：for any 篩選條件與任務資料集，匯出內容與篩選結果完全一致
    - **Validates: Requirements 6.1**

  - [x] 5.16 實作防抖與請求取消工具
    - 實作 utils/debounce.ts：含 useDebouncedCallback hook（200ms 延遲）
    - 整合 AbortController 用於取消進行中之查詢請求
    - _Requirements: 17.5, 17.6_

  - [x] 5.17 Write property test for 防抖行為
    - **Property 29: 防抖行為**
    - 驗證：for any 200ms 內連續輸入序列，驗證請求僅在最後一次輸入後觸發一次
    - **Validates: Requirements 17.6**

- [x] 6. Checkpoint - 確認工具函式與警示引擎正確性
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 路由與認證模組
  - [x] 7.1 實作路由系統
    - 安裝 react-router-dom
    - 實作 routes/index.tsx：完整路由配置含 lazy loading
    - 建立路由模組：routes/modules/ 按業務切分（task, schedule, customer, employee, notification, approval, pending-customer, map）
    - 實作 routes/guards.tsx：RouteGuard 元件含 token 檢查、角色檢查、權限碼檢查
    - 實作 403.tsx 無權限頁面
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 7.2 Write property test for 未授權路由阻擋
    - **Property 4: 未授權路由阻擋**
    - 驗證：for any 角色與不在可存取清單中之路徑，路由守衛導向 403
    - **Validates: Requirements 2.2**

  - [x] 7.3 Write property test for 權限代碼 UI 控制
    - **Property 5: 權限代碼 UI 控制**
    - 驗證：for any 權限代碼集合，受保護 UI 元素之顯示狀態與權限代碼存在性完全對應
    - **Validates: Requirements 2.3**

  - [x] 7.4 實作登入頁面與認證流程
    - 實作 pages/login/index.tsx：帳號/密碼表單、圖形驗證碼（失敗 3 次後顯示）、記住我勾選
    - 實作登入邏輯：呼叫 authApi.login → 儲存 Token → 取得 Profile → buildPermissions → 導向首頁
    - 實作 Token 過期自動登出邏輯（回應攔截器 401 處理）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 7.5 Write unit tests for 登入頁面
    - 測試表單渲染、驗證碼觸發條件、Token 儲存至 sessionStorage
    - 測試登入失敗計數遞增行為
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 8. 基礎元件庫
  - [x] 8.1 實作 BaseTable 元件
    - 實作 components/base/BaseTable/index.tsx
    - 封裝 Ant Design Table 含分頁邏輯（page, pageSize）
    - 實作響應式卡片模式：< 768px 時透過 cardRender 顯示卡片列表
    - 支援排序、queryHook 整合、exportable 旗標
    - 支援 rowKey 與 onRowClick 回調
    - _Requirements: 4.3, 16.1_

  - [x] 8.2 實作 BaseModal 元件
    - 實作 components/base/BaseModal/index.tsx
    - 統一確認/取消按鈕行為、loading 狀態、寬度控制
    - _Requirements: 9.1, 10.2_

  - [x] 8.3 實作 BaseSearchForm 元件
    - 實作 components/base/BaseSearchForm/index.tsx
    - 支援多欄位類型：input, select, datePicker, rangePicker, cascader
    - 實作搜尋與重置按鈕，整合 loading 狀態
    - _Requirements: 4.2, 10.4_

  - [x] 8.4 實作 BaseUpload 元件
    - 實作 components/base/BaseUpload/index.tsx
    - 檔案大小限制（環境變數 VITE_UPLOAD_MAX_SIZE）
    - 上傳進度顯示
    - _Requirements: 10.2_

  - [x] 8.5 實作主版面 Layout 元件
    - 實作 MainLayout：Sidebar + Header + Content 結構
    - 實作 SideMenu：根據 usePermissionStore.menuTree 動態渲染選單
    - 實作 AppHeader：使用者資訊、通知鈴鐺、語系切換、登出按鈕
    - 響應式：< 768px 時 Sidebar 摺疊為 Drawer
    - _Requirements: 2.1, 16.2_

- [x] 9. Checkpoint - 確認路由守衛與基礎元件正常運作
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. TanStack Query Hooks 層
  - [x] 10.1 配置 TanStack Query Client
    - 安裝 @tanstack/react-query, @tanstack/react-query-devtools
    - 配置 QueryClient：retry 3 次、retryDelay 指數退避、staleTime 5 分鐘、gcTime 10 分鐘
    - mutations 配置：retry 0、全域 onError 處理
    - 在 App.tsx 中設置 QueryClientProvider
    - _Requirements: 17.1, 17.3, 17.4_

  - [x] 10.2 實作任務與排班 Query Hooks
    - 實作 queries/useTaskQueries.ts：useTaskList（含分頁、篩選、AbortSignal）、useTaskDetail、useCreateTask、useUpdateTask、useValidateTask
    - 實作 queries/useScheduleQueries.ts：useScheduleData（含 dimension, dateRange, filters, AbortSignal）、useUpdateSchedule
    - _Requirements: 4.1, 4.3, 8.7, 17.5_

  - [x] 10.3 實作客戶、員工、通知 Query Hooks
    - 實作 queries/useCustomerQueries.ts：useCustomerList, useCreateCustomer, useUpdateCustomer, useDeleteCustomer
    - 實作 queries/useEmployeeQueries.ts：useEmployeeList, useCreateEmployee, useUpdateEmployee
    - 實作 queries/useNotificationQueries.ts：useNotificationList, useSendNotification, useNotificationTemplates
    - 實作 queries/usePendingCustomerQueries.ts：usePendingCustomerList, useCreatePendingCustomer, useConvertPendingCustomer
    - _Requirements: 10.1, 11.1, 12.1, 14.1_

- [x] 11. 任務管理業務元件與頁面
  - [x] 11.1 實作 EmployeeSelect 業務元件
    - 實作 components/business/EmployeeSelect/index.tsx
    - 多選模式，支援群組、證照、休假狀態篩選
    - 高亮符合客戶要求證照之員工
    - 指定日期之休假員工灰顯標示
    - _Requirements: 3.6_

  - [x] 11.2 Write property test for 員工多條件篩選
    - **Property 8: 員工多條件篩選**
    - 驗證：for any 篩選組合，結果僅包含同時滿足所有條件之員工
    - **Validates: Requirements 3.6**

  - [x] 11.3 實作 RecurrenceEditor 業務元件
    - 實作 components/business/RecurrenceEditor/index.tsx
    - 類似 Outlook 週期設定介面：daily/weekly/monthly/custom
    - 支援 interval、daysOfWeek、dayOfMonth、endType（never/date/count）
    - _Requirements: 5.1_

  - [x] 11.4 Write property test for 週期任務生成
    - **Property 11: 週期任務生成**
    - 驗證：for any RecurrenceRule，生成之重複實例符合頻率、間隔、結束條件
    - **Validates: Requirements 5.2**

  - [x] 11.5 實作 ConflictPanel 業務元件
    - 實作 components/business/ConflictPanel/index.tsx
    - 顯示 AlertViolation 列表（規則名稱、嚴重度、訊息、影響員工）
    - 覆蓋功能：權限檢查（canOverride）、備註輸入、確認覆蓋按鈕
    - _Requirements: 3.8, 7.7_

  - [x] 11.6 實作 AlertBadge 業務元件
    - 實作 components/business/AlertBadge/index.tsx
    - 狀態圖標：normal（綠）、warning（紅）、overridden（橘）、recurring（∞ 符號）
    - Tooltip 顯示簡要描述
    - _Requirements: 5.3, 7.8_

  - [x] 11.7 實作 TaskForm 業務元件
    - 實作 components/business/TaskForm/index.tsx
    - 表單欄位：集團（連動分店）、任務類型、分店、日期（假日紅標）、起訖時間（24hr/跨日）、人數、班別、路線、工作內容（多選）、備註、指派員工（EmployeeSelect）、週期設定（RecurrenceEditor）
    - 儲存前整合 runAlertChecks 前端預檢
    - 若存在違規顯示 ConflictPanel
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 11.8 Write property test for 集團分店連動篩選
    - **Property 6: 集團分店連動篩選**
    - 驗證：for any 選定集團，分店選項僅包含且不遺漏該集團之分店
    - **Validates: Requirements 3.2**

  - [x] 11.9 實作任務列表頁面
    - 實作 pages/task/index.tsx：整合 BaseTable + BaseSearchForm
    - 表格欄位：集團、任務類型、分店、日期、起訖時間、人數、班別、路線、工作內容、指派人員、週期、備註
    - 模糊搜尋：集團/分店關鍵字
    - 分頁功能（支援 1000 筆效能需求）
    - 點擊列開啟任務詳情/編輯
    - 匯出按鈕（整合 exportToExcel）
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.3_

  - [x] 11.10 Write property test for 模糊搜尋結果正確性
    - **Property 10: 模糊搜尋結果正確性**
    - 驗證：for any 搜尋關鍵字，結果中每筆記錄之集團或分店名稱包含該關鍵字（不區分大小寫）
    - **Validates: Requirements 4.2, 10.4**

  - [x] 11.11 實作週期任務功能
    - 在 TaskForm 中整合 RecurrenceEditor
    - 儲存時依 RecurrenceRule 生成重複任務實例
    - 編輯週期任務時提供「僅此次」或「此次及之後」修改範圍選項
    - _Requirements: 5.1, 5.2, 5.4_

- [x] 12. Checkpoint - 確認任務管理模組完整功能
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. 排班總覽模組
  - [x] 13.1 實作 ScheduleCalendar 業務元件
    - 安裝 @fullcalendar/react, @fullcalendar/resource-timeline, @fullcalendar/daygrid, @fullcalendar/interaction
    - 實作 components/business/ScheduleCalendar/index.tsx
    - 支援三種檢視模式：day, week, month
    - 支援兩種維度：customer（集團_分店）、employee（員工_區域）
    - 事件方塊顯示：集團名稱、分店名稱、時間區間
    - 跨日事件延伸至隔日顯示
    - AlertBadge 整合：overridden 事件顯示警示色彩、recurring 事件顯示 ∞ 符號
    - 國定假日紅色標示
    - 效能需求：100 人 × 31 天首次渲染 ≤ 1.5 秒（使用虛擬化/延遲載入）
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 5.3, 7.8_

  - [x] 13.2 Write property test for 行事曆事件方塊資訊完整性
    - **Property 19: 行事曆事件方塊資訊完整性**
    - 驗證：for any ScheduleEvent，渲染之事件方塊包含集團名稱、分店名稱與時間區間
    - **Validates: Requirements 8.4**

  - [x] 13.3 Write property test for 跨日事件時間跨度
    - **Property 20: 跨日事件時間跨度**
    - 驗證：for any 跨日任務（endTime ≤ startTime），事件跨越兩日顯示，結束日期為起始日+1
    - **Validates: Requirements 8.5**

  - [x] 13.4 實作排班總覽頁面
    - 實作 pages/schedule/index.tsx
    - 工具列：檢視切換（日/週/月）、期間選擇、集團篩選、分店篩選、員工/區域篩選、地圖按鈕
    - 整合 ScheduleCalendar 元件
    - 事件點擊：開啟詳情抽屜/浮動面板
    - 詳情面板：完整任務資訊、編輯按鈕、取消按鈕
    - 編輯功能：開啟 TaskForm 帶入當前資料
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_

  - [x] 13.5 Write unit tests for 排班總覽頁面
    - 測試檢視切換、工具列篩選、事件點擊開啟詳情面板
    - _Requirements: 8.1, 8.2, 9.1_

- [x] 14. 客戶與員工資料模組
  - [x] 14.1 實作客戶資料管理頁面
    - 實作 pages/customer/index.tsx：整合 BaseTable + BaseSearchForm
    - 欄位：集團名稱、分店名稱、地址、聯絡窗口、電話、證照限制、備註
    - CRUD 操作：新增/編輯（BaseModal + 表單）、刪除（確認對話框）
    - 證照限制多選介面
    - 搜尋：依集團或分店名稱篩選
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 14.2 實作員工資料管理頁面
    - 實作 pages/employee/index.tsx：整合 BaseTable
    - 欄位：姓名、電話、員工編號、職位、群組（色彩編碼）、指定休假、證照
    - CRUD 操作：新增/編輯員工
    - 群組色彩編碼區分
    - 指定休假日設定介面（DatePicker 多選）
    - 證照類型多選介面（無/專業/病媒/火蟻/6hr安衛/甲乙丙安衛管理師）
    - 證照衝突驗證
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 14.3 Write property test for 群組色彩唯一性
    - **Property 21: 群組色彩唯一性**
    - 驗證：for any 兩個不同員工群組，系統指派之色彩編碼互不相同
    - **Validates: Requirements 11.4**

  - [x] 14.4 Write property test for 證照衝突驗證
    - **Property 22: 證照衝突驗證**
    - 驗證：for any 員工證照組合，若違反衝突規則則回傳錯誤訊息
    - **Validates: Requirements 11.6**

- [x] 15. Checkpoint - 確認排班總覽與客戶員工模組功能
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. 通知與審批模組
  - [x] 16.1 實作通知中心元件
    - 實作 components/business/NotificationCenter/index.tsx
    - 應用程式內通知中心介面（AppHeader 鈴鐺圖標觸發）
    - 通知列表：類型、收件者、主旨、狀態、時間
    - 未讀標記與計數
    - _Requirements: 12.6_

  - [x] 16.2 實作通知管理頁面
    - 實作 pages/notification/index.tsx：整合 BaseTable
    - 通知狀態追蹤（已通知/未通知/已變更+已通知/已變更+未通知）
    - 手動通知發送功能（每月 20-31 日且有新排班時啟用）
    - 通知範本管理（客戶通知、員工派工、變更審批範本）
    - 每月 15 日排班提醒指示
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 16.3 Write property test for 通知發送日期區間啟用
    - **Property 23: 通知發送日期區間啟用**
    - 驗證：for any 當月日期，手動發送啟用 iff 日期介於 20-31 日且存在新排班
    - **Validates: Requirements 12.2**

  - [x] 16.4 Write property test for 通知狀態合法性
    - **Property 24: 通知狀態合法性**
    - 驗證：for any 通知記錄，狀態為合法值之一且轉換符合狀態機規則
    - **Validates: Requirements 12.3**

  - [x] 16.5 實作審批流程頁面
    - 實作 pages/approval/index.tsx：審批列表與操作介面
    - 排班變更通知主任與 SO
    - 班別變更：主任與經理雙重審批
    - 審批通過後自動更新通知主旨並重新發送
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 16.6 Write property test for 稽核日誌建立
    - **Property 25: 稽核日誌建立**
    - 驗證：for any 可稽核操作（排班變更、警示覆蓋、權限變更、刪除），系統建立對應稽核記錄
    - **Validates: Requirements 13.4**

- [x] 17. 待定客戶與地圖模組
  - [x] 17.1 實作待定客戶管理頁面
    - 實作 pages/pending-customer/index.tsx：整合 BaseTable
    - 待定時間客戶列表與管理（新增/編輯）
    - 確認服務時間後轉換為正式任務功能
    - 匯出待定客戶列表為 Excel
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 17.2 Write property test for 待定客戶轉換正確性
    - **Property 26: 待定客戶轉換正確性**
    - 驗證：for any 待定客戶轉換，保留原始集團/分店/聯絡人，日期時間符合確認值
    - **Validates: Requirements 14.3**

  - [x] 17.3 實作地圖檢視元件與頁面
    - 實作 components/business/MapView/index.tsx
    - 地圖上顯示客戶分店位置標記
    - 群組色彩區分不同指派人員標記
    - 基本篩選功能：依集團、分店、群組
    - 實作 pages/map/index.tsx：整合 MapView 與篩選面板
    - 從任務列表/排班總覽/任務建立點擊地圖按鈕後定位至相關位置
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 17.4 Write property test for 地圖篩選正確性
    - **Property 27: 地圖篩選正確性**
    - 驗證：for any 篩選條件組合，地圖標記僅包含符合所有條件之分店
    - **Validates: Requirements 15.3**

- [x] 18. Checkpoint - 確認通知、待定客戶、地圖模組功能
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. 整合串接與全域功能
  - [x] 19.1 整合 Error Boundary 與全域錯誤處理
    - 實作 PageErrorBoundary 元件：頁面層級錯誤捕獲、錯誤回報、重新載入按鈕
    - 包裹所有頁面路由於 ErrorBoundary 中
    - 整合 TanStack Query 全域 mutation 錯誤處理
    - _Requirements: 17.3, 17.4_

  - [x] 19.2 實作響應式適配
    - BaseTable < 768px 卡片模式切換
    - ScheduleCalendar < 768px 個人/每日檢視模式
    - MainLayout < 768px Sidebar 摺疊為 Drawer
    - 確保所有表單具備鍵盤導航
    - 確保所有表單欄位具備關聯標籤
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 19.3 整合載入狀態指示器
    - 全域載入指示器：路由切換時顯示（NProgress 或類似方案）
    - 局部載入指示器：個別操作（表格、表單、匯出）使用 Spin 元件
    - _Requirements: 17.3, 17.4, 6.3_

  - [x] 19.4 實作 Dashboard 首頁
    - 實作 pages/dashboard/index.tsx
    - 顯示今日排班概要、待審核項目、近期警示
    - 快捷入口：任務建立、排班總覽、通知中心
    - _Requirements: 2.1_

  - [x] 19.5 全模組路由串接與選單整合
    - 確認所有頁面路由正確配置與 lazy loading 生效
    - 確認 SideMenu 根據權限動態渲染所有模組入口
    - 確認頁面間導航流暢（任務列表 → 排班總覽 → 地圖 → 通知 等）
    - 確認 Tab 多頁籤功能（useAppStore.tabs）
    - _Requirements: 2.1, 2.3_

- [x] 20. 測試配置與整合測試
  - [x] 20.1 配置測試基礎設施
    - 配置 vitest.config.ts：globals, jsdom 環境, setupFiles
    - 配置 src/test/setup.ts：RTL 清理、MSW 伺服器設置
    - 建立 MSW handlers 模擬所有 API 端點
    - 配置 fast-check 全域設定（numRuns: 100+）
    - _Requirements: 17.1_

  - [x] 20.2 Write integration tests for 完整任務建立流程
    - 測試：開啟 TaskForm → 填寫欄位 → 儲存 → 預檢觸發 → 覆蓋 → 成功
    - 使用 MSW 模擬 API 回應
    - _Requirements: 3.1, 3.7, 3.8, 7.7_

  - [x] 20.3 Write integration tests for 排班變更審批流程
    - 測試：排班變更 → 通知 → 審批操作 → 狀態更新
    - _Requirements: 13.1, 13.2, 13.3_

- [x] 21. Final checkpoint - 確認所有測試通過與功能完整
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each development phase
- Property tests validate universal correctness properties defined in the design document (31 properties total)
- Unit tests and integration tests validate specific examples and edge cases
- The alert engine (Task 5.6) is the core business logic module and should be implemented with full test coverage
- All API modules support AbortSignal for request cancellation (Requirement 17.5)
- TanStack Query manages server state caching; Zustand manages local UI state
- FullCalendar performance target: 100 employees × 31 days ≤ 1.5s first render
