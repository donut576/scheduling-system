// 待定時間客戶管理頁面 (PendingCustomerPage) 單元測試
// 測試對象：src/pages/pending-customer/index.tsx，涵蓋列表呈現、新增/編輯、
// 排定正式任務流程與 Excel 匯出
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PendingCustomerPage from './index';
import type { PendingCustomer } from '@/types/customer';
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

const mockCreateMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockUpdateMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockConvertMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/queries/usePendingCustomerQueries', () => ({
  usePendingCustomerList: vi.fn(),
  useCreatePendingCustomer: vi.fn(),
  useUpdatePendingCustomer: vi.fn(),
  useConvertPendingCustomer: vi.fn(),
}));

vi.mock('@/queries/useCustomerQueries', () => ({
  useCustomerGroups: vi.fn(),
}));

import {
  usePendingCustomerList,
  useCreatePendingCustomer,
  useUpdatePendingCustomer,
  useConvertPendingCustomer,
} from '@/queries/usePendingCustomerQueries';
import { useCustomerGroups } from '@/queries/useCustomerQueries';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/queries/useEmployeeQueries', () => ({
  useEmployeeList: () => ({
    data: { list: [], total: 0, page: 1, pageSize: 500 },
    isLoading: false,
  }),
}));

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const pendingCustomers: PendingCustomer[] = [
  {
    id: 'p1',
    groupId: 'g1',
    groupName: '集團A',
    branchId: 'b1',
    branchName: '分店A',
    status: 'PENDING',
    headcount: 2,
    contents: ['P'],
    route: '第一路',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    groupId: 'g2',
    groupName: '集團B',
    branchId: 'b2',
    branchName: '分店B',
    status: 'PENDING',
    date: '2024-02-10',
    startTime: '09:00',
    endTime: '12:00',
    headcount: 3,
    shift: '早班',
    route: '第一路',
    contents: ['P'],
    assignees: [{ employeeId: 'emp-1', employeeName: '王大明' }],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'p3',
    groupId: 'g1',
    groupName: '集團A',
    branchId: 'b1',
    branchName: '分店A',
    status: 'PENDING',
    date: '2024-03-01',
    startTime: '08:00',
    endTime: '10:00',
    headcount: 1,
    shift: '早班',
    route: '第一路',
    contents: ['P'],
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
  },
];

const listResult: PaginatedResponse<PendingCustomer> = {
  list: pendingCustomers,
  total: pendingCustomers.length,
  page: 1,
  pageSize: 20,
};

const customerGroups = [
  {
    id: 'g1',
    name: '集團A',
    branches: [
      {
        id: 'b1',
        groupId: 'g1',
        name: '分店A',
        address: '',
        contactName: '',
        contactPhone: '',
        requiredLicenses: [],
      },
    ],
  },
  {
    id: 'g2',
    name: '集團B',
    branches: [
      {
        id: 'b2',
        groupId: 'g2',
        name: '分店B',
        address: '',
        contactName: '',
        contactPhone: '',
        requiredLicenses: [],
      },
    ],
  },
];

/**
 * Unit Tests for 待定時間客戶管理頁面 (Pending Customer Management Page)
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4
 */
describe('PendingCustomerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(usePendingCustomerList).mockReturnValue({
      data: listResult,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePendingCustomerList>);

    vi.mocked(useCreatePendingCustomer).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
    } as unknown as ReturnType<typeof useCreatePendingCustomer>);

    vi.mocked(useUpdatePendingCustomer).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
    } as unknown as ReturnType<typeof useUpdatePendingCustomer>);

    vi.mocked(useConvertPendingCustomer).mockReturnValue({
      mutateAsync: mockConvertMutateAsync,
    } as unknown as ReturnType<typeof useConvertPendingCustomer>);

    vi.mocked(useCustomerGroups).mockReturnValue({
      data: customerGroups,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useCustomerGroups>);
  });

  describe('待定客戶列表 - Requirement 14.1', () => {
    it('renders table with required columns and data', () => {
      renderWithClient(<PendingCustomerPage />);

      expect(screen.getAllByText('建立時間').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('集團').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('分店').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('日期').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('人數需求').length).toBeGreaterThanOrEqual(1);

      expect(screen.getAllByText('集團A').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('集團B')).toBeInTheDocument();
    });

    it('renders pending placeholders for unassigned date and time', () => {
      renderWithClient(<PendingCustomerPage />);

      expect(screen.getAllByText('待排').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('新增/編輯待定客戶 - Requirement 14.2', () => {
    it('opens create modal with empty form when 新增待排客戶 is clicked', async () => {
      const user = userEvent.setup();
      renderWithClient(<PendingCustomerPage />);

      await user.click(screen.getByRole('button', { name: /新增待排客戶/ }));

      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText('新增待排客戶表單')).toBeInTheDocument();
      expect(within(modal).getByRole('combobox', { name: '集團' })).toBeInTheDocument();
      expect(within(modal).getByLabelText('人數需求')).toBeInTheDocument();
    });

    it('opens edit modal pre-filled with row data when row is clicked', async () => {
      const user = userEvent.setup();
      renderWithClient(<PendingCustomerPage />);

      const rows = screen.getAllByText('集團A');
      await user.click(rows[0]!);

      await waitFor(() => {
        expect(screen.getByText('編輯待排客戶表單')).toBeInTheDocument();
      });
    });

    it('submits create mutation with form values when saving a new pending customer', async () => {
      const user = userEvent.setup();
      renderWithClient(<PendingCustomerPage />);

      await user.click(screen.getByRole('button', { name: /新增待排客戶/ }));

      const modal = screen.getByRole('dialog');
      await user.click(within(modal).getByRole('combobox', { name: '集團' }));
      const groupOptions = await screen.findAllByText('集團A');
      await user.click(groupOptions[groupOptions.length - 1]!);

      await user.click(within(modal).getByRole('combobox', { name: '分店' }));
      const branchOptions = await screen.findAllByText('分店A');
      await user.click(branchOptions[branchOptions.length - 1]!);

      const headcountInput = within(modal).getByLabelText('人數需求');
      await user.clear(headcountInput);
      await user.type(headcountInput, '5');

      await user.click(within(modal).getByRole('button', { name: /確定/ }));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            groupId: 'g1',
            branchId: 'b1',
            headcount: 5,
          }),
        );
      });
    });
  });

  describe('排定任務 - Requirement 14.3', () => {
    it('shows 排定任務 action buttons for pending rows', () => {
      renderWithClient(<PendingCustomerPage />);

      const convertButtons = screen.getAllByRole('button', { name: /排定任務/ });
      expect(convertButtons.length).toBe(3);
    });

    it('opens convert modal pre-filled with existing values and submits convert mutation', async () => {
      const user = userEvent.setup();
      renderWithClient(<PendingCustomerPage />);

      const convertButtons = screen.getAllByRole('button', { name: /排定任務/ });
      await user.click(convertButtons[1]!); // p2 has date/startTime/endTime/shift pre-filled

      await waitFor(() => {
        expect(screen.getByText('排定任務表單')).toBeInTheDocument();
      });

      const modal = screen.getByRole('dialog');
      await user.click(within(modal).getByRole('button', { name: /確定/ }));

      await waitFor(() => {
        expect(mockConvertMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'p2',
            data: expect.objectContaining({
              date: '2024-02-10',
              startTime: '09:00',
              endTime: '12:00',
              shift: '早班',
              headcount: 3,
            }),
          }),
        );
      });
    });
  });

  describe('匯出 Excel - Requirement 14.4', () => {
    it('renders export button with 列表匯出', () => {
      renderWithClient(<PendingCustomerPage />);

      expect(screen.getByText('列表匯出')).toBeInTheDocument();
    });
  });
});
