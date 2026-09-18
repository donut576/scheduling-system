/**
 * 應用程式進入點（Entry Point）。
 * 負責在開發環境下依環境變數決定是否啟用 MSW（Mock Service Worker）模擬 API，
 * 並將 React 應用程式（App）掛載到 DOM 上的 #root 節點。
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 動態更新頁籤圖示，破除瀏覽器對 localhost 的圖示快取
if (typeof document !== 'undefined') {
  const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (link) {
    link.href = '/favicon-128.png?v=2026';
  }
}

/**
 * 依環境變數啟用瀏覽器端的 API Mock（MSW）。
 * 預設啟用 worker 模擬 API（或當 VITE_USE_MOCK_API !== 'false' 時），
 * 讓前端在無真實後端或部署至 Vercel 展示環境下可完整獨立運作。
 */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK_API !== 'false') {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
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
