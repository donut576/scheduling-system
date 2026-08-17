// 測試對象：MainLayout 主版面配置元件
// 涵蓋頂部導覽列渲染、側邊選單 Drawer 開關、語言切換、使用者選單、
// 以及巢狀路由 Outlet 內容渲染等情境
import { render, screen, fireEvent } from '@testing-library/react';
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
    t: (key: string) =>
      ({
        'menu.dashboard': '儀表板',
        'menu.task': '任務管理',
        'menu.schedule': '班表總覽',
        'auth.logout': '登出',
        'employee.employeeNo': '員工編號',
        'employee.position': '職位',
      })[key] ?? key,
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

  it('renders top navbar with hamburger, brand, and user dropdown', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
    expect(screen.getByText('Ecolab')).toBeInTheDocument();
    expect(screen.getByText('測試用戶')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /登出/ })).not.toBeInTheDocument();
  });

  it('opens sidebar drawer from hamburger with menu items', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open sidebar' }));

    expect(document.querySelector('.ant-drawer')).toBeInTheDocument();
    expect(screen.getByText('儀表板')).toBeInTheDocument();
    expect(screen.getByText('任務管理')).toBeInTheDocument();
    expect(screen.getByText('班表總覽')).toBeInTheDocument();
  });

  it('shows account details and logout in the user dropdown', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: /測試用戶/ }));

    expect(await screen.findByText('員工編號：E001')).toBeInTheDocument();
    expect(screen.getByText('職位：ADMIN')).toBeInTheDocument();
    expect(screen.getByText('登出')).toBeInTheDocument();
  });

  it('toggles sidebar state on hamburger click', () => {
    renderLayout();
    const toggleBtn = screen.getByRole('button', { name: 'Open sidebar' });
    fireEvent.click(toggleBtn);
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });

  it('closes the sidebar after menu navigation', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open sidebar' }));
    await user.click(screen.getByText('任務管理'));

    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    expect(screen.getByText('Task Content')).toBeInTheDocument();
  });

  describe('巢狀路由 Outlet 渲染', () => {
    it('renders the matched child route content inside the layout shell', () => {
      renderLayout('/dashboard');
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      expect(screen.getByText('Ecolab')).toBeInTheDocument();
    });

    it('renders different child content when navigating to another nested route', () => {
      renderLayout('/task');
      expect(screen.getByText('Task Content')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
    });
  });
});
