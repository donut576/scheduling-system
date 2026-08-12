/**
 * 瀏覽器端 MSW（Mock Service Worker）設定檔。
 * 用於開發模式下模擬 API 回應，讓前端可在沒有真實後端的情況下運作。
 */
import { setupWorker } from 'msw/browser';
import { handlers } from '@/test/mocks/handlers';

// 建立瀏覽器端的 MSW worker，套用與測試環境共用的 API mock handlers
export const worker = setupWorker(...handlers);
