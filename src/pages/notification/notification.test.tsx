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
      screen.getByText(
        '任務新增、修改、取消後，系統每日合併寄送郵件給客戶與負責員工，員工同時會收到站內通知；證照即將到期則自動寄給轄區主任',
      ),
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

  it('shows the merged-digest preview with created, updated and canceled blocks', () => {
    render(<NotificationPage />);

    const preview = screen.getByTestId('email-preview-container');
    expect(preview).toHaveTextContent('新增');
    expect(preview).toHaveTextContent('修改');
    expect(preview).toHaveTextContent('取消');
    // 變數以範例資料取代
    expect(preview).toHaveTextContent('2026/11/12');
    expect(preview).not.toHaveTextContent('{{日期}}');
  });

  it('customer tab can toggle CC to backup contact and preview follows', async () => {
    const user = userEvent.setup();
    render(<NotificationPage />);

    await user.click(screen.getByText('客戶通知範本'));
    expect(screen.getByTestId('preview-cc')).toBeInTheDocument();

    await user.click(screen.getByTestId('cc-backup-switch'));
    expect(screen.queryByTestId('preview-cc')).not.toBeInTheDocument();
  });

  it('leader can only change send time; templates are read-only', () => {
    usePermissionStore
      .getState()
      .buildPermissions(['notification:view', 'notification:send'], 'LEADER');
    render(<NotificationPage />);

    expect(screen.getByTestId('template-readonly-alert')).toBeInTheDocument();
    expect(screen.getByTestId('subject-input')).toBeDisabled();
    expect(screen.getByTestId('header-input')).toBeDisabled();
    expect(screen.getByTestId('created-input')).toBeDisabled();
    expect(screen.getByTestId('auto-notify-switch')).toBeDisabled();
    // 發送時間可以調整
    expect(screen.getByTestId('send-time-select')).toBeInTheDocument();
  });

  it('manager/admin does not see the read-only notice', () => {
    render(<NotificationPage />);
    expect(screen.queryByTestId('template-readonly-alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('subject-input')).not.toBeDisabled();
  });

  it('license tab: recipient is fixed (auto to region leader) and shows license preview', async () => {
    const user = userEvent.setup();
    render(<NotificationPage />);

    await user.click(screen.getByText('證照到期通知範本'));

    expect(screen.getByTestId('recipient-input')).toBeDisabled();
    expect(screen.getByTestId('license-item-input')).toBeInTheDocument();
    expect(screen.queryByTestId('created-input')).not.toBeInTheDocument();
    const preview = screen.getByTestId('email-preview-container');
    expect(preview).toHaveTextContent('登革熱防治證照');
    expect(preview).toHaveTextContent('剩 14 天');
    expect(preview).not.toHaveTextContent('{{證照名稱}}');
  });

  it('leader sees the license template read-only', async () => {
    const user = userEvent.setup();
    usePermissionStore
      .getState()
      .buildPermissions(['notification:view', 'notification:send'], 'LEADER');
    render(<NotificationPage />);

    await user.click(screen.getByText('證照到期通知範本'));
    expect(screen.getByTestId('subject-input')).toBeDisabled();
    expect(screen.getByTestId('license-item-input')).toBeDisabled();
  });
});
