// 審批流程頁面 (ApprovalPage) 單元測試
// 測試對象：src/pages/approval/index.tsx，涵蓋審批列表呈現、關鍵字搜尋、項目對照詳情、彈窗內核准與駁回二次確認
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ApprovalPage from './index';
import type { Approval } from '@/types/notification';
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

const mockApproveMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockRejectMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockSendNotificationMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/queries/useApprovalQueries', () => ({
  useApprovalList: vi.fn(),
  useApproveRequest: vi.fn(),
  useRejectRequest: vi.fn(),
}));

vi.mock('@/queries/useNotificationQueries', () => ({
  useSendNotification: vi.fn(),
}));

import { useApprovalList, useApproveRequest, useRejectRequest } from '@/queries/useApprovalQueries';
import { useSendNotification } from '@/queries/useNotificationQueries';

const taskChangeApproval: Approval = {
  id: 'approval-001',
  taskId: 't1',
  type: 'TASK_CHANGE',
  status: 'PENDING',
  requestedBy: 'u1',
  requestedByName: '王組長',
  changeSummary: '調整施作時段與人數需求',
  diff: [
    { field: 'time', label: '服務時段', before: '09:00 ~ 12:00', after: '14:00 ~ 18:00' },
    { field: 'headcount', label: '人數需求', before: '1 人', after: '2 人' },
  ],
  approvers: [
    {
      approverId: 'ap1',
      approverName: '陳組長',
      role: 'LEADER',
      status: 'PENDING',
    },
  ],
  createdAt: '2026-08-01T10:00:00+08:00',
  updatedAt: '2026-08-01T10:00:00+08:00',
};

const alertOverrideApproval: Approval = {
  id: 'approval-002',
  taskId: 't2',
  type: 'ALERT_OVERRIDE',
  status: 'PENDING',
  requestedBy: 'u2',
  requestedByName: '李組長',
  changeSummary: '夜間跨日排班證照違規覆蓋',
  overrideRemark: '經理評估現場有主管陪同施作，核准覆蓋',
  violatedRules: ['連續工作天數達上限警示'],
  approvers: [
    {
      approverId: 'ap3',
      approverName: '林經理',
      role: 'MANAGER',
      status: 'PENDING',
    },
  ],
  createdAt: '2026-08-02T14:30:00+08:00',
  updatedAt: '2026-08-02T14:30:00+08:00',
};

function mockListData(list: Approval[]): PaginatedResponse<Approval> {
  return { list, total: list.length, page: 1, pageSize: 20 };
}

/**
 * Unit Tests for 異動核准頁面 (Approval Workflow Page)
 */
describe('ApprovalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApprovalList).mockReturnValue({
      data: mockListData([taskChangeApproval, alertOverrideApproval]),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useApprovalList>);

    vi.mocked(useApproveRequest).mockReturnValue({
      mutateAsync: mockApproveMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useApproveRequest>);

    vi.mocked(useRejectRequest).mockReturnValue({
      mutateAsync: mockRejectMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useRejectRequest>);

    vi.mocked(useSendNotification).mockReturnValue({
      mutateAsync: mockSendNotificationMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useSendNotification>);
  });

  describe('異動核准列表呈現與欄位配置', () => {
    it('renders table with required columns (申請單編號、狀態、類型、建立時間、申請人、功能)', () => {
      render(<ApprovalPage />);

      expect(screen.getAllByText('申請單編號').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('狀態').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('類型').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('建立時間').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('申請人').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('功能').length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText('approval-001')).toBeInTheDocument();
      expect(screen.getByText('approval-002')).toBeInTheDocument();
      expect(screen.getByText('任務變更')).toBeInTheDocument();
      expect(screen.getByText('警示覆蓋')).toBeInTheDocument();
      expect(screen.getByText('王組長')).toBeInTheDocument();
      expect(screen.getByText('李組長')).toBeInTheDocument();

      // Actions only contain 檢視變更 in table rows
      expect(screen.getAllByText('檢視變更').length).toBeGreaterThanOrEqual(2);
    });

    it('renders search bar in top left for quick fuzzy search', async () => {
      const user = userEvent.setup();
      render(<ApprovalPage />);

      const searchInput = screen.getByPlaceholderText('請輸入申請單編號或申請人搜尋');
      expect(searchInput).toBeInTheDocument();

      await user.type(searchInput, 'approval-001{enter}');

      expect(useApprovalList).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'approval-001' }),
      );
    });
  });

  describe('項目對照與彈窗內審批流程', () => {
    it('opens diff modal and shows item comparison for task change', async () => {
      const user = userEvent.setup();
      render(<ApprovalPage />);

      const viewButtons = screen.getAllByText('檢視變更');
      await user.click(viewButtons[0]!);

      expect(screen.getByText('異動變更詳情')).toBeInTheDocument();
      expect(screen.getByText('📋 項目對照')).toBeInTheDocument();
      expect(screen.getByText('服務時段')).toBeInTheDocument();
      expect(screen.getByText('09:00 ~ 12:00')).toBeInTheDocument();
      expect(screen.getByText('14:00 ~ 18:00')).toBeInTheDocument();
    });

    it('allows approving from inside the diff modal with secondary confirmation', async () => {
      const user = userEvent.setup();
      render(<ApprovalPage />);

      const viewButtons = screen.getAllByText('檢視變更');
      await user.click(viewButtons[0]!);

      // Click 核准 inside the diff modal
      const approveInModal = screen.getByRole('button', { name: /核准/ });
      await user.click(approveInModal);

      // Approve confirmation modal opens
      expect(screen.getByText('核准確認')).toBeInTheDocument();
      expect(screen.getByText(/確定要核准申請單【approval-001】嗎？/)).toBeInTheDocument();

      const modal = screen.getAllByRole('dialog');
      const confirmModal = modal[modal.length - 1]!;
      await user.click(within(confirmModal).getByRole('button', { name: /確定/ }));

      await waitFor(() => {
        expect(mockApproveMutateAsync).toHaveBeenCalledWith({
          id: 'approval-001',
          comment: undefined,
        });
      });

      await waitFor(() => {
        expect(mockSendNotificationMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ taskId: 't1' }),
        );
      });
    });

    it('allows rejecting from inside the diff modal with comment requirement', async () => {
      const user = userEvent.setup();
      render(<ApprovalPage />);

      const viewButtons = screen.getAllByText('檢視變更');
      await user.click(viewButtons[0]!);

      // Click 駁回 inside the diff modal
      const rejectInModal = screen.getByRole('button', { name: /駁回/ });
      await user.click(rejectInModal);

      // Reject confirmation modal opens
      expect(screen.getByText('駁回確認')).toBeInTheDocument();

      const modal = screen.getAllByRole('dialog');
      const confirmModal = modal[modal.length - 1]!;

      // Click confirm without comment -> blocked
      await user.click(within(confirmModal).getByRole('button', { name: /確定/ }));
      expect(mockRejectMutateAsync).not.toHaveBeenCalled();

      // Enter comment and submit
      const textarea = screen.getByLabelText('駁回原因');
      await user.type(textarea, '時段與其他客戶衝突');
      await user.click(within(confirmModal).getByRole('button', { name: /確定/ }));

      await waitFor(() => {
        expect(mockRejectMutateAsync).toHaveBeenCalledWith({
          id: 'approval-001',
          comment: '時段與其他客戶衝突',
        });
      });
    });
  });
});
