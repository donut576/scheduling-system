import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import NotificationCenter from './index';
import type { Notification } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

// Mock window.matchMedia for Ant Design responsive components
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'CUSTOMER_NOTIFY',
    recipientType: 'CUSTOMER',
    recipientId: 'cust-1',
    recipientName: '藝康股份有限公司',
    subject: '12月排班通知',
    content: '您的12月排班已確認',
    status: 'NOT_NOTIFIED',
    createdAt: '2024-11-20T10:00:00+08:00',
  },
  {
    id: 'notif-2',
    type: 'EMPLOYEE_DISPATCH',
    recipientType: 'EMPLOYEE',
    recipientId: 'emp-1',
    recipientName: '王大明',
    subject: '派工通知',
    content: '您已被指派新任務',
    status: 'NOTIFIED',
    createdAt: '2024-11-19T09:00:00+08:00',
  },
  {
    id: 'notif-3',
    type: 'CHANGE_APPROVAL',
    recipientType: 'EMPLOYEE',
    recipientId: 'emp-2',
    recipientName: '李小華',
    subject: '排班異動待審核',
    content: '有一筆排班異動待您審核',
    status: 'CHANGED_NOT_NOTIFIED',
    createdAt: '2024-11-18T08:00:00+08:00',
  },
];

let mockData: PaginatedResponse<Notification> = {
  list: mockNotifications,
  total: mockNotifications.length,
  page: 1,
  pageSize: 10,
};

vi.mock('@/queries/useNotificationQueries', () => ({
  useNotificationList: () => ({
    data: mockData,
    isLoading: false,
  }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithProvider = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('NotificationCenter', () => {
  it('renders notification list with type, recipient, subject, status and time', () => {
    renderWithProvider(<NotificationCenter />);

    // Type column (via NOTIFICATION_TYPE_MAP)
    expect(screen.getByText('客戶通知')).toBeInTheDocument();
    expect(screen.getByText('員工指派通知')).toBeInTheDocument();
    expect(screen.getByText('異動核准通知')).toBeInTheDocument();

    // Recipient
    expect(screen.getByText('收件者：藝康股份有限公司')).toBeInTheDocument();
    expect(screen.getByText('收件者：王大明')).toBeInTheDocument();

    // Subject
    expect(screen.getByText('12月排班通知')).toBeInTheDocument();
    expect(screen.getByText('派工通知')).toBeInTheDocument();

    // Status (via NOTIFICATION_STATUS_MAP)
    expect(screen.getByText('未通知')).toBeInTheDocument();
    expect(screen.getByText('已通知')).toBeInTheDocument();
    expect(screen.getByText('有異動未通知')).toBeInTheDocument();

    // Time (formatted)
    expect(screen.getByText('2024-11-20 10:00')).toBeInTheDocument();
  });

  it('marks NOT_NOTIFIED and CHANGED_NOT_NOTIFIED notifications as unread', () => {
    renderWithProvider(<NotificationCenter />);

    const unreadIndicators = screen.getAllByTestId('unread-indicator');
    // notif-1 (NOT_NOTIFIED) and notif-3 (CHANGED_NOT_NOTIFIED) are unread
    expect(unreadIndicators).toHaveLength(2);
  });

  it('does not mark NOTIFIED notifications as unread', () => {
    renderWithProvider(<NotificationCenter />);

    const notifiedItem = screen.getByTestId('notification-item-notif-2');
    expect(notifiedItem.querySelector('[data-testid="unread-indicator"]')).toBeNull();
  });

  it('renders empty state when there are no notifications', () => {
    mockData = { list: [], total: 0, page: 1, pageSize: 10 };
    renderWithProvider(<NotificationCenter />);
    expect(screen.getByText('尚無通知')).toBeInTheDocument();
    mockData = {
      list: mockNotifications,
      total: mockNotifications.length,
      page: 1,
      pageSize: 10,
    };
  });
});
