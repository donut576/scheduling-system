// 客戶資料管理頁面 (CustomerPage) 單元測試
// 測試對象：src/pages/customer/index.tsx，涵蓋客戶列表卡片呈現、新增/編輯、刪除確認、
// 搜尋篩選與行動裝置卡片模式
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from 'antd';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CustomerPage from './index';
import type { Customer } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';

// Mock window.matchMedia for Ant Design responsive components and for
// BaseTable's useIsMobile hook (max-width: 767px). `mockIsMobile` lets tests
// simulate the < 768px breakpoint (Requirement 16.1 card mode).
let mockIsMobile = false;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query.includes('767') ? mockIsMobile : false;
    },
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
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/queries/useCustomerQueries', () => ({
  useCustomerList: vi.fn(),
  useCreateCustomer: vi.fn(),
  useUpdateCustomer: vi.fn(),
  useDeleteCustomer: vi.fn(),
}));

import {
  useCustomerList,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from '@/queries/useCustomerQueries';

const customers: Customer[] = [
  {
    id: 'c1',
    groupId: 'g1',
    groupName: '集團A',
    branchId: 'b1',
    branchName: '分店A',
    address: '台北市信義路 1 號',
    contactName: '王小明',
    contactPhone: '0900000000',
    requiredLicenses: ['PEST_CONTROL'],
    remarks: '備註A',
  },
  {
    id: 'c2',
    groupId: 'g2',
    groupName: '集團B',
    branchId: 'b2',
    branchName: '分店B',
    address: '台中市中山路 2 號',
    contactName: '陳小華',
    contactPhone: '0911111111',
    requiredLicenses: [],
  },
];

const listResult: PaginatedResponse<Customer> = {
  list: customers,
  total: customers.length,
  page: 1,
  pageSize: 20,
};

/**
 * Unit Tests for 客戶資料管理頁面 (Customer Management Page)
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
describe('CustomerPage', () => {
  afterEach(() => {
    Modal.destroyAll();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobile = false;

    vi.mocked(useCustomerList).mockReturnValue({
      data: listResult,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useCustomerList>);

    vi.mocked(useCreateCustomer).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
    } as unknown as ReturnType<typeof useCreateCustomer>);

    vi.mocked(useUpdateCustomer).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
    } as unknown as ReturnType<typeof useUpdateCustomer>);

    vi.mocked(useDeleteCustomer).mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
    } as unknown as ReturnType<typeof useDeleteCustomer>);
  });

  describe('客戶資料列表 - Requirement 10.1', () => {
    it('renders customer records as cards with required data', () => {
      render(<CustomerPage />);

      expect(screen.getByTestId('customer-card-c1')).toBeInTheDocument();
      expect(screen.getByTestId('customer-card-c2')).toBeInTheDocument();
      expect(screen.getByText('集團A')).toBeInTheDocument();
      expect(screen.getByText('分店A')).toBeInTheDocument();
      expect(screen.getByText('集團B')).toBeInTheDocument();
      expect(screen.getByText('分店B')).toBeInTheDocument();
      expect(screen.getByText('台北市信義路 1 號')).toBeInTheDocument();
      expect(screen.getByText('聯絡窗口：王小明')).toBeInTheDocument();
      expect(screen.getByText('電話：0900000000')).toBeInTheDocument();
    });
  });

  describe('新增/編輯客戶 - Requirement 10.2, 10.3', () => {
    it('opens create modal with empty form when 新增客戶 is clicked', async () => {
      const user = userEvent.setup();
      render(<CustomerPage />);

      await user.click(screen.getByText('新增客戶'));

      expect(screen.getByText('新增客戶資料')).toBeInTheDocument();
      const groupInput = screen.getByLabelText('集團名稱') as HTMLInputElement;
      expect(groupInput.value).toBe('');
    });

    it('opens edit modal pre-filled with row data when row is clicked', async () => {
      const user = userEvent.setup();
      render(<CustomerPage />);

      await user.click(screen.getByTestId('customer-card-c1'));

      await waitFor(() => {
        expect(screen.getByText('編輯客戶資料')).toBeInTheDocument();
      });
      const groupInput = screen.getByLabelText('集團名稱') as HTMLInputElement;
      expect(groupInput.value).toBe('集團A');
    });

    it('renders license type multi-select in the form', async () => {
      const user = userEvent.setup();
      render(<CustomerPage />);

      await user.click(screen.getByText('新增客戶'));

      expect(screen.getByLabelText('證照限制')).toBeInTheDocument();
    });

    it('submits create mutation with form values when saving a new customer', async () => {
      const user = userEvent.setup();
      render(<CustomerPage />);

      await user.click(screen.getByText('新增客戶'));

      await user.type(screen.getByLabelText('集團名稱'), '集團C');
      await user.type(screen.getByLabelText('分店名稱'), '分店C');
      await user.type(screen.getByLabelText('地址'), '台南市');
      await user.type(screen.getByLabelText('聯絡窗口'), '林小美');
      await user.type(screen.getByLabelText('電話'), '0922222222');

      const modal = screen.getByRole('dialog');
      await user.click(within(modal).getByText('OK'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            groupName: '集團C',
            branchName: '分店C',
            address: '台南市',
            contactName: '林小美',
            contactPhone: '0922222222',
          }),
        );
      });
    });
  });

  describe('刪除客戶 - Requirement 10.2', () => {
    it('shows confirmation dialog before deleting', async () => {
      const user = userEvent.setup();
      render(<CustomerPage />);

      const deleteButtons = screen.getAllByLabelText('刪除客戶');
      await user.click(deleteButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText('確定要刪除「集團A 分店A」的客戶資料嗎？')).toBeInTheDocument();
      });
      expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
    });

    it('calls delete mutation after confirming', async () => {
      const user = userEvent.setup();
      render(<CustomerPage />);

      const deleteButtons = screen.getAllByLabelText('刪除客戶');
      await user.click(deleteButtons[0]!);

      await waitFor(() => {
        expect(screen.getAllByText('確定刪除').length).toBeGreaterThanOrEqual(1);
      });
      const confirmButtons = screen.getAllByText('確定刪除');
      await user.click(confirmButtons[confirmButtons.length - 1]!);

      await waitFor(() => {
        expect(mockDeleteMutateAsync).toHaveBeenCalledWith('c1');
      });
    });
  });

  describe('搜尋篩選 - Requirement 10.4', () => {
    it('renders search input for group/branch keyword', () => {
      render(<CustomerPage />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('triggers search with keyword input', async () => {
      const user = userEvent.setup();
      render(<CustomerPage />);

      const input = screen.getByRole('combobox');
      await user.type(input, '集團A');
      await user.click(screen.getByText('搜尋'));

      await waitFor(() => {
        const calls = vi.mocked(useCustomerList).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall?.[0]).toMatchObject({ keyword: '集團A' });
      });
    });
  });

  describe('響應式卡片模式 - Requirement 16.1', () => {
    it('renders customer records as cards instead of a table when viewport < 768px', () => {
      mockIsMobile = true;
      render(<CustomerPage />);

      expect(screen.getByTestId('customer-card-c1')).toBeInTheDocument();
      expect(screen.getByTestId('customer-card-c2')).toBeInTheDocument();
      // Card content includes key fields
      expect(screen.getByText('集團A')).toBeInTheDocument();
      expect(screen.getByText('台北市信義路 1 號')).toBeInTheDocument();
    });

    it('opens edit modal when a card is clicked on mobile', async () => {
      mockIsMobile = true;
      const user = userEvent.setup();
      render(<CustomerPage />);

      await user.click(screen.getByTestId('customer-card-c1'));

      await waitFor(() => {
        expect(screen.getByText('編輯客戶資料')).toBeInTheDocument();
      });
    });
  });
});
