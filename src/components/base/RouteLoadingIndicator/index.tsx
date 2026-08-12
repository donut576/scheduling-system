import { useEffect } from 'react';
import { useNavigation } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Disable the built-in spinner icon; we only want the top progress bar.
NProgress.configure({ showSpinner: false });

/**
 * RouteLoadingIndicator - 全域路由載入指示器
 *
 * 使用 React Router 資料路由（createBrowserRouter）提供的 useNavigation() 監控
 * 導航狀態。當路由切換（navigation.state !== 'idle'）時顯示 NProgress 頂部進度條，
 * 導航完成後隱藏。此元件應被渲染於路由樹的根層級（例如作為根路由的 element），
 * 確保任何頁面間的路由跳轉皆會觸發全域載入指示器。
 *
 * Validates: Requirements 17.3（路由切換時，僅顯示全域載入指示器）
 */
function RouteLoadingIndicator() {
  // navigation.state 可能為 'idle'、'loading' 或 'submitting'，
  // 只要不是 'idle' 就代表正在進行路由切換或表單提交，需顯示進度條
  const navigation = useNavigation();

  useEffect(() => {
    if (navigation.state !== 'idle') {
      NProgress.start();
    } else {
      NProgress.done();
    }
  }, [navigation.state]);

  return null;
}

export default RouteLoadingIndicator;
