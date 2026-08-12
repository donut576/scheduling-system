import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import NotificationPage from './index';
import type { Notification, NotificationTemplate } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

// Mock window.matchMedia for Ant Design responsive components
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

const mockSendMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockUpdateTemplateMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/queries/useNotificationQueries', () => ({
  useNotificationList: vi.fn(),
  useSendNotification: vi.fn(),
  useNotificationTemplates: vi.fn(),
  useUpdateTemplate: vi.fn(),
}));

import {
  useNotificationList,
  useSendNotification,
  useNotificationTemplates,
  useUpdateTemplate,
} from '@/queries/useNotificationQueries';

const notifiedNotification: Notification = {
  id: 'n1',
  type: 'CUSTOMER_NOTIFY',
  templateId: 't1',
  recipientType: 'CUSTOMER',
  recipientId: 'c1',
  recipientName: '客戶A',
  subject: '排班通知',
  content: '內容',
  status: 'NOTIFIED',
  createdAt: '2024-01-01T00:00:00+08:00',
};

const notNotifiedNotification: Notification = {
  id: 'n2',
  type: 'EMPLOYEE_DISPATCH',
  templateId: 't2',
  recipientType: 'EMPLOYEE',
  recipientId: 'e1',
  recipientName: '員工A',
  subject: '派工通知',
  content: '內容',
  status: 'NOT_NOTIFIED',
  createdAt: '2024-01-02T00:00:00+08:00',
};

const templates: NotificationTemplate[] = [
  {
    id: 'tpl1',
    name: '客戶通知範本',
    type: 'CUSTOMER_NOTIFY',
    subject: '客戶通知主旨',
    content: '客戶通知內容',
    variables: [],
  },
  {
    id: 'tpl2',
    name: '員工派工範本',
    type: 'EMPLOYEE_DISPATCH',
    subject: '員工派工主旨',
    content: '員工派工內容',
    variables: [],
  },
];

function mockListData(list: Notification[]): PaginatedResponse<Notification> {
  return { list, total: list.length, page: 1, pageSize: 20 };
}

/**
 * Unit Tests for 通知管理頁面 (Notification Management Page)
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */
describe('NotificationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNotificationList).mockReturnValue({
      data: mockListData([notifiedNotification, notNotifiedNotification]),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationList>);

    vi.mocked(useSendNotification).mockReturnValue({
      mutateAsync: mockSendMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useSendNotification>);

    vi.mocked(useNotificationTemplates).mockReturnValue({
      data: templates,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationTemplates>);

    vi.mocked(useUpdateTemplate).mockReturnValue({
      mutateAsync: mockUpdateTemplateMutateAsync,
    } as unknown as ReturnType<typeof useUpdateTemplate>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('通知列表與狀態追蹤 - Requirement 12.3', () => {
    it('renders table with required columns and status tags', () => {
      render(<NotificationPage />);

      expect(screen.getAllByText('類型').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('收件者').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('主旨').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('狀態').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('時間').length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText('客戶A')).toBeInTheDocument();
      expect(screen.getByText('員工A')).toBeInTheDocument();
      expect(screen.getByText('已通知')).toBeInTheDocument();
      expect(screen.getByText('未通知')).toBeInTheDocument();
    });
  });

  describe('手動通知發送 - Requirement 12.2', () => {
    it('disables manual send button when date is outside the 20-31 window even with pending notifications', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-10T10:00:00+08:00'));

      render(<NotificationPage />);

      expect(screen.getByTestId('manual-send-button')).toBeDisabled();
    });

    it('disables manual send button when in window but no pending notifications exist', () => {
      vi.mocked(useNotificationList).mockReturnValue({
        data: mockListData([notifiedNotification]),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useNotificationList>);

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-25T10:00:00+08:00'));

      render(<NotificationPage />);

      expect(screen.getByTestId('manual-send-button')).toBeDisabled();
    });

    it('enables manual send button when date is within 20-31 window and pending notifications exist', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-25T10:00:00+08:00'));

      render(<NotificationPage />);

      expect(screen.getByTestId('manual-send-button')).toBeEnabled();
    });

    it('sends pending notifications when manual send button is clicked', async () => {
      vi.setSystemTime(new Date('2024-01-31T10:00:00+08:00'));
      const user = userEvent.setup();

      render(<NotificationPage />);

      await user.click(screen.getByTestId('manual-send-button'));

      await waitFor(() => {
        expect(mockSendMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ recipientIds: ['e1'] }),
        );
      });
    });
  });

  describe('通知範本管理 - Requirement 12.4', () => {
    it('renders template list with names and types', async () => {
      const user = userEvent.setup();
      render(<NotificationPage />);

      await user.click(screen.getByText('通知範本管理'));

      expect(screen.getByText('客戶通知範本')).toBeInTheDocument();
      expect(screen.getByText('員工派工範本')).toBeInTheDocument();
    });

    it('opens edit modal pre-filled with template data and saves changes', async () => {
      const user = userEvent.setup();
      render(<NotificationPage />);

      await user.click(screen.getByText('通知範本管理'));
      const editButtons = screen.getAllByText('編輯');
      await user.click(editButtons[0]!);

      expect(screen.getByText('編輯通知範本')).toBeInTheDocument();
      const subjectInput = screen.getByLabelText('主旨') as HTMLInputElement;
      expect(subjectInput.value).toBe('客戶通知主旨');

      await user.clear(subjectInput);
      await user.type(subjectInput, '更新後主旨');

      const modal = screen.getByRole('dialog');
      await user.click(within(modal).getByText('OK'));

      await waitFor(() => {
        expect(mockUpdateTemplateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'tpl1',
            data: expect.objectContaining({ subject: '更新後主旨' }),
          }),
        );
      });
    });
  });

  describe('每月 15 日排班提醒 - Requirement 12.1', () => {
    it('shows the schedule reminder banner on the 15th of the month', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00+08:00'));

      render(<NotificationPage />);

      expect(screen.getByTestId('schedule-reminder-banner')).toBeInTheDocument();
    });

    it('hides the schedule reminder banner on days other than the 15th', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-16T10:00:00+08:00'));

      render(<NotificationPage />);

      expect(screen.queryByTestId('schedule-reminder-banner')).not.toBeInTheDocument();
    });
  });
});
