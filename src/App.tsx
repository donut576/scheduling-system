/**
 * 應用程式根元件（App）。
 * 負責掛載全域的 Provider（React Query、Ant Design ConfigProvider、路由），
 * 並依據使用者選擇的語系（locale）同步 Ant Design 的介面語言與 i18next 的翻譯語言。
 */
import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import enUS from 'antd/locale/en_US';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/queries/queryClient';
import { router } from '@/routes';
import { useAppStore } from '@/stores/useAppStore';
import { antdTheme } from '@/styles/antd-theme';
import i18n from '@/i18n';

/**
 * App 元件：整個應用程式的最外層容器。
 * - 提供 React Query 的 QueryClientProvider，供全站共用資料快取。
 * - 依據全域狀態（useAppStore）中的 locale 設定 Ant Design 的介面語言。
 * - 透過 RouterProvider 掛載路由設定（router）。
 * - 開發模式（DEV）下額外顯示 React Query Devtools 方便除錯。
 */
function App() {
  // 從全域狀態取得目前語系設定（例如 'zh-TW' 或 'en-US'）
  const locale = useAppStore((state) => state.locale);
  // 依語系選擇對應的 Ant Design 內建語言包
  const antdLocale = locale === 'en-US' ? enUS : zhTW;

  // 當全域語系與 i18next 目前語言不一致時，同步切換 i18next 語言，
  // 確保畫面上的翻譯文字與 Ant Design 元件語言一致
  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [locale]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={antdLocale} theme={antdTheme}>
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
