/**
 * 應用程式根元件（App）。
 * 負責掛載全域的 Provider（React Query、Ant Design ConfigProvider、路由），
 * 並依據使用者選擇的語系（locale）同步 Ant Design 的介面語言與 i18next 的翻譯語言。
 */
import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/queries/queryClient';
import { router } from '@/routes';
import { antdTheme } from '@/styles/antd-theme';
import i18n from '@/i18n';

/**
 * App 元件：整個應用程式的最外層容器。
 * - 提供 React Query 的 QueryClientProvider，供全站共用資料快取。
 * - 鎖定繁體中文（zh-TW）介面。
 * - 透過 RouterProvider 掛載路由設定（router）。
 * - 開發模式（DEV）下額外顯示 React Query Devtools 方便除錯。
 */
function App() {
  useEffect(() => {
    if (i18n.language !== 'zh-TW') {
      void i18n.changeLanguage('zh-TW');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhTW} theme={antdTheme}>
        <RouterProvider router={router} />
      </ConfigProvider>
      {/* 僅在開發環境顯示 React Query Devtools，方便觀察查詢/快取狀態 */}
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}

export default App;
