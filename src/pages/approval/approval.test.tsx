import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ApprovalPage from './index';
import { isDualApprovalComplete } from '@/utils/approvalWorkflow';
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

const scheduleChangeApproval: Approval = {
  id: 'a1',
  taskId: 't1',
  type: 'SCHEDULE_CHANGE',
  status: 'PENDING',
  requestedBy: 'u1',
  requestedByName: '王組長',
  approvers: [
    {
      approverId: 'ap1',
      approverName: '陳主任',
      role: 'DIRECTOR',
      status: 'PENDING',
    },
  ],
  createdAt: '2024-01-01T00:00:00+08:00',
  updatedAt: '2024-01-01T00:00:00+08:00',
};

const shiftChangeApproval: Approval = {
  id: 'a2',
  taskId: 't2',
  type: 'SHIFT_CHANGE',
  status: 'PENDING',
  requestedBy: 'u2',
  requestedByName: '李組長',
  approvers: [
    {
      approverId: 'ap2',
      approverName: '陳主任',
      role: 'DIRECTOR',
      status: 'PENDING',
    },
    {
      approverId: 'ap3',
      approverName: '林經理',
      role: 'MANAGER',
      status: 'PENDING',
    },
  ],
  createdAt: '2024-01-02T00:00:00+08:00',
  updatedAt: '2024-01-02T00:00:00+08:00',
};

function mockListData(list: Approval[]): PaginatedResponse<Approval> {
  return { list, total: list.length, page: 1, pageSize: 20 };
}

/**
 * Unit Tests for 審批流程頁面 (Approval Workflow Page)
 * Validates: Requirements 13.1, 13.2, 13.3
 */
describe('ApprovalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApprovalList).mockReturnValue({
      data: mockListData([scheduleChangeApproval, shiftChangeApproval]),
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

  describe('審批列表 - Requirement 13.1', () => {
    it('renders table with required columns and approval rows', () => {
      render(<ApprovalPage />);

      expect(screen.getAllByText('類型').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('申請人').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('狀態').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('審批人').length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText('排班變更')).toBeInTheDocument();
      expect(screen.getByText('班別變更')).toBeInTheDocument();
      expect(screen.getByText('王組長')).toBeInTheDocument();
      expect(screen.getByText('李組長')).toBeInTheDocument();
    });

    it('displays approvers with their role and status', () => {
      render(<ApprovalPage />);

      expect(screen.getAllByText(/陳主任.*主任.*待審批/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/林經理.*經理.*待審批/)).toBeInTheDocument();
    });
  });

  describe('核准操作 - Requirement 13.3', () => {
    it('approves a SCHEDULE_CHANGE request and triggers customer re-notification since single approval completes it', async () => {
      const user = userEvent.setup();
      render(<ApprovalPage />);

      const approveButtons = screen.getAllByText('核准');
      await user.click(approveButtons[0]!);

      await waitFor(() => {
        expect(mockApproveMutateAsync).toHaveBeenCalledWith({ id: 'a1' });
      });

      await waitFor(() => {
        expect(mockSendNotificationMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ taskId: 't1' }),
        );
      });
    });

    it('does not trigger customer re-notification for SHIFT_CHANGE when only one of two approvers has approved', async () => {
      const user = userEvent.setup();
      render(<ApprovalPage />);

      const approveButtons = screen.getAllByText('核准');
      // Second row corresponds to the SHIFT_CHANGE approval (a2)
      await user.click(approveButtons[1]!);

      await waitFor(() => {
        expect(mockApproveMutateAsync).toHaveBeenCalledWith({ id: 'a2' });
      });

      expect(mockSendNotificationMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('駁回操作', () => {
    it('requires a comment before rejecting a request', async () => {
      const user = userEvent.setup();
      render(<ApprovalPage />);

      const rejectButtons = screen.getAllByText('駁回');
      await user.click(rejectButtons[0]!);

      expect(screen.getByText('駁回審批')).toBeInTheDocument();

      const modal = screen.getByRole('dialog');
      await user.click(within(modal).getByText('OK'));

      // Validation should block submission without a comment
      expect(mockRejectMutateAsync).not.toHaveBeenCalled();

      const textarea = screen.getByLabelText('駁回原因');
      await user.type(textarea, '人力調度不合理');
      await user.click(within(modal).getByText('OK'));

      await waitFor(() => {
        expect(mockRejectMutateAsync).toHaveBeenCalledWith({
          id: 'a1',
          comment: '人力調度不合理',
        });
      });
    });
  });

  describe('雙重審批完成判斷 - Requirement 13.2 (isDualApprovalComplete)', () => {
    it('returns true for non-SHIFT_CHANGE types regardless of approver status', () => {
      expect(isDualApprovalComplete(scheduleChangeApproval)).toBe(true);
    });

    it('returns false for SHIFT_CHANGE when only DIRECTOR has approved', () => {
      const approval: Approval = {
        ...shiftChangeApproval,
        approvers: [
          { ...shiftChangeApproval.approvers[0]!, status: 'APPROVED' },
          shiftChangeApproval.approvers[1]!,
        ],
      };
      expect(isDualApprovalComplete(approval)).toBe(false);
    });

    it('returns false for SHIFT_CHANGE when only MANAGER has approved', () => {
      const approval: Approval = {
        ...shiftChangeApproval,
        approvers: [
          shiftChangeApproval.approvers[0]!,
          { ...shiftChangeApproval.approvers[1]!, status: 'APPROVED' },
        ],
      };
      expect(isDualApprovalComplete(approval)).toBe(false);
    });

    it('returns true for SHIFT_CHANGE when both DIRECTOR and MANAGER have approved', () => {
      const approval: Approval = {
        ...shiftChangeApproval,
        approvers: [
          { ...shiftChangeApproval.approvers[0]!, status: 'APPROVED' },
          { ...shiftChangeApproval.approvers[1]!, status: 'APPROVED' },
        ],
      };
      expect(isDualApprovalComplete(approval)).toBe(true);
    });
  });
});
