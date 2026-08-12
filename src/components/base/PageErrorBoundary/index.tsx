/**
 * PageErrorBoundary - 頁面層級的錯誤邊界元件
 *
 * 使用 React Class Component 實作 Error Boundary（目前 React 尚未提供 Hooks
 * 版本的錯誤邊界 API），用於包裹整個頁面或路由層級的子元件樹，攔截渲染過程中
 * 拋出的例外，顯示友善的錯誤畫面並提供重新載入按鈕，避免單一頁面的錯誤導致
 * 整個應用程式白屏崩潰。
 */
import { Component, type ReactNode } from 'react';
import { Result, Button } from 'antd';
import i18n from '@/i18n';

export interface PageErrorBoundaryProps {
  /** 受此錯誤邊界保護的子元件樹 */
  children: ReactNode;
}

interface PageErrorBoundaryState {
  /** 是否已攔截到錯誤，true 時會渲染錯誤畫面取代 children */
  hasError: boolean;
  /** 攔截到的錯誤物件，用於顯示錯誤訊息 */
  error: Error | null;
}

/**
 * Page-level error boundary.
 *
 * Catches JavaScript errors thrown anywhere in its child component tree
 * during rendering, in lifecycle methods, and in constructors. Renders a
 * fallback UI (Ant Design `Result`) instead of crashing the whole app, and
 * reports the error (console.error, can be swapped for a real monitoring
 * service later).
 *
 * Requirements: 17.3, 17.4
 */
class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  // React 錯誤邊界生命週期方法：當子元件樹在渲染期間拋出錯誤時，
  // React 會呼叫此靜態方法，並用其回傳值更新 state，觸發改為渲染錯誤畫面
  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  // 錯誤邊界生命週期方法：用於側效處理（例如記錄錯誤），
  // 不應在此方法中回傳值來改變渲染結果
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 錯誤回報：可替換為實際監控服務（例如 Sentry）
    console.error('[PageError]', error, errorInfo);
  }

  // 重新載入整個頁面：先重置錯誤狀態，再觸發瀏覽器重新載入
  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    // 若已攔截到錯誤，改渲染錯誤畫面（含錯誤訊息與重新載入按鈕），
    // 不再渲染原本可能持續拋出錯誤的 children
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={i18n.t('error.pageError')}
          subTitle={this.state.error?.message}
          extra={
            <Button type="primary" onClick={this.handleReload}>
              {i18n.t('error.reload')}
            </Button>
          }
        />
      );
    }

    // 沒有錯誤時，正常渲染子元件樹
    return this.props.children;
  }
}

export default PageErrorBoundary;
