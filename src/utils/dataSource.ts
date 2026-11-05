/**
 * 資料來源判斷。
 *
 * VITE_USE_MOCK_API 設為 'false' 代表連接真正的後端：轄區範圍由後端依登入者決定，
 * 前端不再用「台北／新竹…」這類舊的四大轄區自行篩選或送出 area 條件。
 * 其他情況（預設、測試）維持使用 MSW 模擬資料與舊的篩選方式。
 */
export const isRealApi = import.meta.env.VITE_USE_MOCK_API === 'false';

/** 舊四大轄區的預設值：真後端不需要，模擬資料模式才使用 */
export const LEGACY_DEFAULT_AREA: string | undefined = isRealApi ? undefined : '台北';
