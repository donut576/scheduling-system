import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import MainLayout from './MainLayout';
import { useAppStore } from '@/stores/useAppStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useUserStore } from '@/stores/useUserStore';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Mock window.matchMedia for Ant Design responsive components (Popover, etc.)
// and for MainLayout's useIsMobile hook (max-width: 767px breakpoint query).
// `setMockMatches` allows tests to simulate viewport width changes by firing a
// media query 'change' event scoped to the mobile breakpoint query only,
// matching how useMediaQuery/useIsMobile actually detects breakpoint changes
// (via MediaQueryList's change event, not window resize).
const MOBILE_QUERY_FRAGMENT = '767';
let currentMobileMatches = false;
const mockMediaQueryListeners: Array<{
  query: string;
  cb: (event: MediaQueryListEvent) => void;
}> = [];

function setMockMatches(matches: boolean) {
  currentMobileMatches = matches;
  mockMediaQueryListeners
    .filter((entry) => entry.query.includes(MOBILE_QUERY_FRAGMENT))
    .forEach((entry) => entry.cb({ matches } as MediaQueryListEvent));
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query.includes(MOBILE_QUERY_FRAGMENT) ? currentMobileMatches : false;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (event: string, cb: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') mockMediaQueryListeners.push({ query, cb });
      },
      removeEventListener: (_event: string, cb: (e: MediaQueryListEvent) => void) => {
        const idx = mockMediaQueryListeners.findIndex((entry) => entry.cb === cb);
        if (idx >= 0) mockMediaQueryListeners.splice(idx, 1);
      },
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock notification query so AppHeader's bell badge/NotificationCenter don't hit real API
vi.mock('@/queries/useNotificationQueries', () => ({
  useNotificationList: () => ({
    data: {
      list: [
        {
          id: 'notif-1',
          type: 'CUSTOMER_NOTIFY',
          recipientType: 'CUSTOMER',
          recipientId: 'cust-1',
          recipientName: '藝康股份有限公司',
          subject: '12月排班通知',
          content: '通知內容',
          status: 'NOT_NOTIFIED',
          createdAt: '2024-11-20T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    },
    isLoading: false,
  }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderLayout(initialPath = '/dashboard') {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route path="dashboard" element={<div>Dashboard Content</div>} />
            <Route path="task" element={<div>Task Content</div>} />
            <Route path="schedule" element={<div>Schedule Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MainLayout', () => {
  beforeEach(() => {
    // Reset stores
    useAppStore.setState({
      sidebarCollapsed: false,
      locale: 'zh-TW',
      tabs: [{ key: '/dashboard', label: '儀表板', closable: false }],
    });
    usePermissionStore.setState({
      menuTree: [
        { key: '/dashboard', label: '儀表板' },
        { key: '/task', label: '任務管理' },
        { key: '/schedule', label: '班表總覽' },
      ],
    });
    useUserStore.setState({
      user: {
        id: '1',
        name: '測試用戶',
        employeeNo: 'E001',
        role: 'ADMIN',
        permissions: [],
      },
      token: 'test-token',
    });
    // Reset to non-mobile viewport by default
    setMockMatches(false);
    mockMediaQueryListeners.length = 0;
  });

  it('renders Sidebar with menu items', () => {
    renderLayout();
    // '儀表板' also appears in the Tabs bar (default dashboard tab), so scope the
    // assertion to the sidebar menu specifically.
    const sidebarMenu = document.querySelector('.ant-menu');
    expect(sidebarMenu).not.toBeNull();
    expect(sidebarMenu!.textContent).toContain('儀表板');
    expect(screen.getByText('任務管理')).toBeInTheDocument();
    expect(screen.getByText('班表總覽')).toBeInTheDocument();
  });

  it('renders AppHeader with user name', () => {
    renderLayout();
    expect(screen.getByText('測試用戶')).toBeInTheDocument();
  });

  it('renders brand name EcoLab in sidebar', () => {
    renderLayout();
    expect(screen.getByText('EcoLab')).toBeInTheDocument();
  });

  it('toggles sidebar collapsed state on button click', () => {
    renderLayout();
    const toggleBtn = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(toggleBtn);
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
  });

  it('renders Drawer when window is < 768px', () => {
    setMockMatches(true);

    // Need to re-render to pick up mobile state
    useAppStore.setState({ sidebarCollapsed: false });
    renderLayout();

    // Ant Design Drawer renders into document.body via portal
    expect(document.querySelector('.ant-drawer')).toBeInTheDocument();
  });

  it('collapses sidebar on resize to mobile', () => {
    useAppStore.setState({ sidebarCollapsed: false });
    renderLayout();

    act(() => {
      setMockMatches(true);
    });

    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
  });

  it('renders locale switch button', () => {
    renderLayout();
    expect(screen.getByText('中文')).toBeInTheDocument();
  });

  it('shows unread notification badge count on bell icon', () => {
    renderLayout();
    // Badge count reflects unread notifications (1 NOT_NOTIFIED item from mock)
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('opens NotificationCenter when bell icon is clicked', async () => {
    const user = userEvent.setup();
    renderLayout();

    const bellButton = screen.getByLabelText('notification.center');
    await user.click(bellButton);

    expect(await screen.findByRole('region', { name: '通知中心' })).toBeInTheDocument();
    expect(screen.getByText('12月排班通知')).toBeInTheDocument();
  });

  describe('巢狀路由 Outlet 渲染', () => {
    it('renders the matched child route content inside the layout shell', () => {
      renderLayout('/dashboard');
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      // Sidebar/Header persist alongside the routed content
      expect(screen.getByText('EcoLab')).toBeInTheDocument();
      expect(screen.getByText('測試用戶')).toBeInTheDocument();
    });

    it('renders different child content when navigating to another nested route', () => {
      renderLayout('/task');
      expect(screen.getByText('Task Content')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
    });
  });

  describe('Tab 多頁籤功能', () => {
    it('adds a tab for the current route on initial navigation', () => {
      renderLayout('/task');
      // Tab bar should show both the default dashboard tab and the newly visited task tab
      expect(useAppStore.getState().tabs.map((t) => t.key)).toEqual(
        expect.arrayContaining(['/dashboard', '/task']),
      );
      expect(screen.getByTestId('page-tabs')).toBeInTheDocument();
    });

    it('marks the dashboard tab as non-closable and other tabs as closable', () => {
      renderLayout('/task');
      const dashboardTab = useAppStore.getState().tabs.find((t) => t.key === '/dashboard');
      const taskTab = useAppStore.getState().tabs.find((t) => t.key === '/task');
      expect(dashboardTab?.closable).toBe(false);
      expect(taskTab?.closable).toBe(true);
    });

    it('does not duplicate a tab when revisiting the same route', () => {
      renderLayout('/dashboard');
      const countBefore = useAppStore.getState().tabs.length;
      renderLayout('/dashboard');
      expect(useAppStore.getState().tabs.length).toBe(countBefore);
    });

    it('navigates to the tab path when a tab is clicked', async () => {
      useAppStore.setState({
        tabs: [
          { key: '/dashboard', label: '儀表板', closable: false },
          { key: '/task', label: '任務管理', closable: true },
        ],
      });
      const user = userEvent.setup();
      renderLayout('/dashboard');

      const tabsBar = screen.getByTestId('page-tabs');
      const taskTabButton = tabsBar.querySelector('.ant-tabs-tab[data-node-key="/task"]');
      expect(taskTabButton).toBeTruthy();
      await user.click(taskTabButton!.querySelector('.ant-tabs-tab-btn') as HTMLElement);

      expect(screen.getByText('Task Content')).toBeInTheDocument();
    });

    it('removes a tab and navigates to a remaining tab when closing the active tab', async () => {
      useAppStore.setState({
        tabs: [
          { key: '/dashboard', label: '儀表板', closable: false },
          { key: '/task', label: '任務管理', closable: true },
        ],
      });
      const user = userEvent.setup();
      renderLayout('/task');

      const tabsBar = screen.getByTestId('page-tabs');
      const taskTabButton = tabsBar.querySelector('.ant-tabs-tab[data-node-key="/task"]');
      const closeBtn = taskTabButton!.querySelector('.ant-tabs-tab-remove') as HTMLElement;
      await user.click(closeBtn);

      expect(useAppStore.getState().tabs.find((t) => t.key === '/task')).toBeUndefined();
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
  });
});
