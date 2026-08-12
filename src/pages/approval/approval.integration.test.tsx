import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import ApprovalPage from './index';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { Approval } from '@/types/notification';
import type { SendNotificationData } from '@/api/notification';

/**
 * Integration test for the 排班變更審批流程 (schedule/shift change approval
 * workflow): 排班變更 → 通知 → 審批操作 → 狀態更新.
 *
 * Unlike approval.test.tsx (unit tests that mock useApprovalList,
 * useApproveRequest, useRejectRequest and useSendNotification directly),
 * this test exercises the REAL TanStack Query hooks and lets requests hit
 * the network layer, which is intercepted by MSW (src/test/mocks/server.ts).
 * Per-test handlers are installed via server.use(...) to provide
 * deterministic approval fixtures, following the convention established in
 * TaskForm.integration.test.tsx.
 *
 * Validates: Requirements 13.1, 13.3
 */

// Mock matchMedia for Ant Design responsive components (keeps BaseTable in
// desktop table mode rather than mobile card mode).
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

const ok = <T,>(data: T): ApiResponse<T> => ({ code: 0, message: 'success', data });

const paginated = <T,>(list: T[]): PaginatedResponse<T> => ({
  list,
  total: list.length,
  page: 1,
  pageSize: 20,
});

const scheduleChangeApproval: Approval = {
  id: 'int-a1',
  taskId: 'int-t1',
  type: 'SCHEDULE_CHANGE',
  status: 'PENDING',
  requestedBy: 'u1',
  requestedByName: '王組長',
  approvers: [
    {
      approverId: 'ap1',
      approverName: '陳組長',
      role: 'LEADER',
      status: 'PENDING',
    },
  ],
  createdAt: '2026-01-01T00:00:00+08:00',
  updatedAt: '2026-01-01T00:00:00+08:00',
};

const shiftChangeApproval: Approval = {
  id: 'int-a2',
  taskId: 'int-t2',
  type: 'SHIFT_CHANGE',
  status: 'PENDING',
  requestedBy: 'u2',
  requestedByName: '李組長',
  approvers: [
    {
      approverId: 'ap3',
      approverName: '林經理',
      role: 'MANAGER',
      status: 'PENDING',
    },
  ],
  createdAt: '2026-01-02T00:00:00+08:00',
  updatedAt: '2026-01-02T00:00:00+08:00',
};

let capturedNotificationBody: SendNotificationData | undefined;

/** Installs a handler capturing the request body sent to the notification-send endpoint. */
const captureNotificationSend = () => {
  server.use(
    http.post('*/api/v1/notifications/send', async ({ request }) => {
      capturedNotificationBody = (await request.json()) as SendNotificationData;
      return HttpResponse.json(ok<null>(null));
    }),
  );
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('ApprovalPage integration - 排班變更審批流程', () => {
  beforeEach(() => {
    capturedNotificationBody = undefined;
    captureNotificationSend();
  });

  it('SCHEDULE_CHANGE：核准後單一審批即完成，觸發客戶重新通知 (Requirements 13.1, 13.3)', async () => {
    server.use(
      http.get('*/api/v1/approvals', () =>
        HttpResponse.json(ok(paginated<Approval>([scheduleChangeApproval]))),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<ApprovalPage />);

    expect(await screen.findByText('排班變更')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '核准' }));

    // 狀態更新：審批操作成功訊息
    expect((await screen.findAllByText('審批已核准')).length).toBeGreaterThanOrEqual(1);

    // 通知：SCHEDULE_CHANGE 單一審批完成後自動重新通知客戶，主旨帶「【已核准】」前綴
    await waitFor(() => {
      expect(capturedNotificationBody).toMatchObject({
        taskId: 'int-t1',
      });
    });
    expect(capturedNotificationBody?.variables?.subject).toContain('【已核准】');
  });

  it('SHIFT_CHANGE：核准後單一審批即完成，觸發客戶重新通知 (Requirements 13.1, 13.3)', async () => {
    server.use(
      http.get('*/api/v1/approvals', () =>
        HttpResponse.json(ok(paginated<Approval>([shiftChangeApproval]))),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<ApprovalPage />);

    expect(await screen.findByText('班別變更')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '核准' }));

    // 審批操作本身成功（經理核准動作已送出）。antd 的 message 提示為全域 portal，
    // 前一個測試殘留之提示可能尚未消失，故以 findAllByText 容忍多筆相同文字存在。
    expect((await screen.findAllByText('審批已核准')).length).toBeGreaterThanOrEqual(1);

    // 所有審批類型皆為單一審批人核准即完成，故應觸發客戶重新通知。
    await waitFor(() => {
      expect(capturedNotificationBody).toMatchObject({
        taskId: 'int-t2',
      });
    });
    expect(capturedNotificationBody?.variables?.subject).toContain('【已核准】');
  });

  it('駁回流程：需填寫備註才可送出，成功後狀態更新為已駁回 (state update to REJECTED)', async () => {
    server.use(
      http.get('*/api/v1/approvals', () =>
        HttpResponse.json(ok(paginated<Approval>([scheduleChangeApproval]))),
      ),
    );

    let capturedRejectBody: { comment: string } | undefined;
    server.use(
      http.post('*/api/v1/approvals/:id/reject', async ({ request }) => {
        capturedRejectBody = (await request.json()) as { comment: string };
        return HttpResponse.json(ok<null>(null));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ApprovalPage />);

    expect(await screen.findByText('排班變更')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '駁回' }));

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText('駁回審批')).toBeInTheDocument();

    // 未填寫備註時點擊確定，不應送出駁回請求（表單驗證阻擋）
    await user.click(within(modal).getByText('OK'));
    expect(capturedRejectBody).toBeUndefined();

    // 填寫備註後再次確認，應成功送出駁回請求並更新狀態
    const textarea = screen.getByLabelText('駁回原因');
    await user.type(textarea, '人力調度不合理');
    await user.click(within(modal).getByText('OK'));

    await waitFor(() => {
      expect(capturedRejectBody).toEqual({ comment: '人力調度不合理' });
    });
    expect(await screen.findByText('審批已駁回')).toBeInTheDocument();
  });
});
