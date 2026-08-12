/**
 * Zustand store 統一匯出入口
 *
 * 集中匯出所有全域狀態管理 store，方便其他模組以 `@/stores` 單一路徑引用。
 */

// 使用者登入狀態（token、個人資料）store
export { useUserStore } from './useUserStore';
// 權限與可存取路由/選單 store
export { usePermissionStore } from './usePermissionStore';
// 下拉選單字典資料（班次、路線、證照等）store
export { useDictStore } from './useDictStore';
// 任務列表查詢條件與表單草稿 store
export { useTaskStore } from './useTaskStore';
// 排班檢視狀態與變更緩衝區 store
export { useScheduleStore } from './useScheduleStore';
// 應用程式全域設定（側邊欄、主題、語系）store
export { useAppStore } from './useAppStore';
