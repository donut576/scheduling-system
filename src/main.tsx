/**
 * 應用程式進入點（Entry Point）。
 * 負責在開發環境下依環境變數決定是否啟用 MSW（Mock Service Worker）模擬 API，
 * 並將 React 應用程式（App）掛載到 DOM 上的 #root 節點。
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * 依環境變數啟用瀏覽器端的 API Mock（MSW）。
 * 僅在開發環境（DEV）且 VITE_USE_MOCK_API 設為 'true' 時才會動態載入並啟動 worker，
 * 讓前端可在沒有真實後端的情況下進行開發與測試。
 * onUnhandledRequest: 'bypass' 表示未被 mock 攔截到的請求會直接放行，不會報錯。
 */
async function enableMocking() {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
}

// 先完成 Mock 設定（若有啟用），再將應用程式渲染到畫面上，
// 確保渲染時 API 請求已經可以被正確攔截
enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
