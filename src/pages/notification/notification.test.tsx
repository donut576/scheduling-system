import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import NotificationPage from './index';
import type { NotificationTemplate } from '@/types/notification';

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

const mockUpdateTemplateMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/queries/useNotificationQueries', () => ({
  useNotificationTemplates: vi.fn(),
  useUpdateTemplate: vi.fn(),
  useNotificationList: vi.fn(),
}));

import {
  useNotificationTemplates,
  useUpdateTemplate,
  useNotificationList,
} from '@/queries/useNotificationQueries';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { PERMISSIONS } from '@/constants/permissions';

const templates: NotificationTemplate[] = [
  {
    id: 'tpl1',
    name: '客戶通知範本',
    type: 'CUSTOMER_NOTIFY',
    subject: 'Ecolab 服務排程確認通知',
    content: '客戶通知內容 {{客戶名稱}}',
    variables: ['{{客戶名稱}}'],
  },
  {
    id: 'tpl2',
    name: '員工指派通知範本',
    type: 'EMPLOYEE_DISPATCH',
    subject: 'Ecolab 新服務任務指派通知',
    content: '員工派工內容 {{客戶名稱}}',
    variables: ['{{客戶名稱}}'],
  },
];

describe('NotificationPage - 通知管理設定', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissionStore.getState().buildPermissions(Object.values(PERMISSIONS), 'ADMIN');

    vi.mocked(useNotificationList).mockReturnValue({
      data: { list: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationList>);

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

  it('renders page title, subtitle and save button', () => {
    render(<NotificationPage />);

    expect(screen.getByText('通知管理設定')).toBeInTheDocument();
    expect(screen.getByText('設定電子郵件通知範本與自動化發送規則')).toBeInTheDocument();
    expect(screen.getByTestId('save-settings-btn')).toBeInTheDocument();
  });

  it('renders auto notification switch banner and allows toggling', async () => {
    const user = userEvent.setup();
    render(<NotificationPage />);

    expect(screen.getByText('自動通知開關')).toBeInTheDocument();
    expect(
      screen.getByText('當管理員新增排班後，系統是否自動寄送郵件給客戶與負責員工'),
    ).toBeInTheDocument();

    const switchBtn = screen.getByTestId('auto-notify-switch');
    expect(switchBtn).toBeInTheDocument();
    await user.click(switchBtn);
    expect(switchBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('renders tabs for customer and employee notification templates', () => {
    render(<NotificationPage />);

    expect(screen.getByText('客戶通知範本')).toBeInTheDocument();
    expect(screen.getByText('員工指派通知範本')).toBeInTheDocument();
  });

  it('shows live email preview and updates when editing recipient, subject and content', async () => {
    const user = userEvent.setup();
    render(<NotificationPage />);

    // Default active tab is employee
    expect(screen.getByText('EMAIL PREVIEW')).toBeInTheDocument();
    expect(screen.getByText('收件人：')).toBeInTheDocument();
    expect(screen.getByText('employee@ecolab.com')).toBeInTheDocument();

    const recipientInput = screen.getByTestId('recipient-input') as HTMLInputElement;
    expect(recipientInput.value).toBe('employee@ecolab.com');

    await user.clear(recipientInput);
    await user.type(recipientInput, 'custom-staff@ecolab.com');
    expect(screen.getByText('custom-staff@ecolab.com')).toBeInTheDocument();

    const subjectInput = screen.getByTestId('subject-input') as HTMLInputElement;
    expect(subjectInput.value).toBe('Ecolab 新服務任務指派通知');

    await user.clear(subjectInput);
    await user.type(subjectInput, '客製化主旨');

    expect(screen.getAllByText('客製化主旨').length).toBeGreaterThanOrEqual(1);

    // Save changes
    await user.click(screen.getByTestId('save-settings-btn'));

    await waitFor(() => {
      expect(mockUpdateTemplateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tpl2',
          data: expect.objectContaining({ subject: '客製化主旨' }),
        }),
      );
    });
  });

  it('switches to customer template tab and displays customer preview', async () => {
    const user = userEvent.setup();
    render(<NotificationPage />);

    await user.click(screen.getByText('客戶通知範本'));

    expect(screen.getByText('client@din-tai-fung.com')).toBeInTheDocument();
    const subjectInput = screen.getByTestId('subject-input') as HTMLInputElement;
    expect(subjectInput.value).toBe('Ecolab 服務排程確認通知');
  });
});
