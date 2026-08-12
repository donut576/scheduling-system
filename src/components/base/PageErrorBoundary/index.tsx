import { Component, type ReactNode } from 'react';
import { Result, Button } from 'antd';

export interface PageErrorBoundaryProps {
  children: ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
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

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 錯誤回報：可替換為實際監控服務（例如 Sentry）
    console.error('[PageError]', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="頁面發生錯誤"
          subTitle={this.state.error?.message}
          extra={
            <Button type="primary" onClick={this.handleReload}>
              重新載入
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

export default PageErrorBoundary;
