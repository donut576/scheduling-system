// 員工資料管理頁面 (EmployeePage) 單元測試
// 測試對象：src/pages/employee/index.tsx，涵蓋員工列表、群組色彩標示、
// 新增/編輯/刪除、證照多選與衝突驗證、指定休假日設定
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from 'antd';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EmployeePage from './index';
import type { Employee } from '@/types/employee';
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
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/queries/useEmployeeQueries', () => ({
  useEmployeeList: vi.fn(),
  useCreateEmployee: vi.fn(),
  useUpdateEmployee: vi.fn(),
  useDeleteEmployee: vi.fn(),
}));

vi.mock('@/stores/useDictStore', () => ({
  useDictStore: (selector: (state: { groups: unknown[] }) => unknown) =>
    selector({
      groups: [
        { label: '北區', value: 'group-a' },
        { label: '南區', value: 'group-b' },
      ],
    }),
}));

import {
  useEmployeeList,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from '@/queries/useEmployeeQueries';

const employees: Employee[] = [
  {
    id: 'e1',
    name: '王大明',
    phone: '0912345678',
    employeeNo: 'E001',
    position: 'STAFF',
    groupId: 'group-a',
    groupName: '北區',
    groupColor: '#1890ff',
    designatedLeaves: ['2025-01-01'],
    licenses: ['PROFESSIONAL'],
    isActive: true,
  },
  {
    id: 'e2',
    name: '李小華',
    phone: '0923456789',
    employeeNo: 'E002',
    position: 'LEADER',
    groupId: 'group-b',
    groupName: '南區',
    groupColor: '#52c41a',
    designatedLeaves: [],
    licenses: [],
    isActive: true,
  },
];

const listResult: PaginatedResponse<Employee> = {
  list: employees,
  total: employees.length,
  page: 1,
  pageSize: 20,
};

/**
 * Unit Tests for 員工資料管理頁面 (Employee Management Page)
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */
describe('EmployeePage', () => {
  afterEach(() => {
    Modal.destroyAll();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useEmployeeList).mockReturnValue({
      data: listResult,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeList>);

    vi.mocked(useCreateEmployee).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
    } as unknown as ReturnType<typeof useCreateEmployee>);

    vi.mocked(useUpdateEmployee).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
    } as unknown as ReturnType<typeof useUpdateEmployee>);

    vi.mocked(useDeleteEmployee).mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
    } as unknown as ReturnType<typeof useDeleteEmployee>);
  });

  describe('員工資料列表 - Requirement 11.1', () => {
    it('renders employee records as cards with required data', () => {
      render(<EmployeePage />);

      expect(screen.getByTestId('employee-card-e1')).toBeInTheDocument();
      expect(screen.getByTestId('employee-card-e2')).toBeInTheDocument();
      expect(screen.getByText('王大明')).toBeInTheDocument();
      expect(screen.getByText('李小華')).toBeInTheDocument();
      expect(screen.getByText('員工編號：E001')).toBeInTheDocument();
      expect(screen.getByText('指定休假：2025-01-01')).toBeInTheDocument();
    });

    it('renders group as a colored tag - Requirement 11.4', () => {
      render(<EmployeePage />);

      const groupTag = screen.getByText('北區');
      expect(groupTag).toBeInTheDocument();
      // Ant Design Tag applies the color via inline style/className
      expect(groupTag.closest('.ant-tag')).toBeTruthy();
    });

    it('filters employees by keyword without rendering reset button', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      expect(screen.queryByText('重置')).not.toBeInTheDocument();

      await user.type(screen.getByPlaceholderText('搜尋姓名/員工編號'), 'E001');
      await user.click(screen.getByRole('button', { name: /搜尋/ }));

      await waitFor(() => {
        expect(useEmployeeList).toHaveBeenLastCalledWith(
          expect.objectContaining({ keyword: 'E001' }),
        );
      });
    });
  });

  describe('刪除員工 - Requirement 11.2', () => {
    it('shows delete action on employee cards and asks for confirmation', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      const deleteButtons = screen.getAllByLabelText('刪除員工');
      await user.click(deleteButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText('確定要刪除「王大明 E001」的員工資料嗎？')).toBeInTheDocument();
      });
      expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
    });

    it('calls delete mutation after confirming', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      const deleteButtons = screen.getAllByLabelText('刪除員工');
      await user.click(deleteButtons[0]!);

      await waitFor(() => {
        expect(screen.getAllByText('確定刪除').length).toBeGreaterThanOrEqual(1);
      });
      const confirmButtons = screen.getAllByText('確定刪除');
      await user.click(confirmButtons[confirmButtons.length - 1]!);

      await waitFor(() => {
        expect(mockDeleteMutateAsync).toHaveBeenCalledWith('e1');
      });
    });
  });

  describe('新增/編輯員工 - Requirement 11.2', () => {
    it('opens create modal with empty form when 新增員工 is clicked', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('新增員工'));

      expect(screen.getByText('新增員工資料')).toBeInTheDocument();
      const nameInput = screen.getByLabelText('姓名') as HTMLInputElement;
      expect(nameInput.value).toBe('');
    });

    it('opens edit modal pre-filled with row data when row is clicked', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('王大明'));

      await waitFor(() => {
        expect(screen.getByText('編輯員工資料')).toBeInTheDocument();
      });
      const nameInput = screen.getByLabelText('姓名') as HTMLInputElement;
      expect(nameInput.value).toBe('王大明');
    });

    it('submits create mutation with form values when saving a new employee', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('新增員工'));

      await user.type(screen.getByLabelText('姓名'), '陳小美');
      await user.type(screen.getByLabelText('電話'), '0933333333');
      await user.type(screen.getByLabelText('員工編號'), 'E003');

      await user.click(screen.getByLabelText('職位'));
      await user.click(screen.getByTitle('一般員工'));

      await user.click(screen.getByLabelText('群組'));
      await user.click(screen.getByTitle('北區'));

      const modal = screen.getByRole('dialog');
      await user.click(within(modal).getByText('OK'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '陳小美',
            phone: '0933333333',
            employeeNo: 'E003',
          }),
        );
      });
    });
  });

  describe('證照類型多選介面 - Requirement 11.3', () => {
    it('renders license multi-select in the form', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('新增員工'));

      expect(screen.getByLabelText('證照')).toBeInTheDocument();
    });

    it('shows license options when opened', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('新增員工'));

      const licenseSelect = screen.getByLabelText('證照');
      await user.click(licenseSelect);

      await waitFor(() => {
        expect(screen.getByTitle('無')).toBeInTheDocument();
        expect(screen.getByTitle('專技')).toBeInTheDocument();
        expect(screen.getByTitle('施藥')).toBeInTheDocument();
      });
    });
  });

  describe('證照衝突驗證 - Requirement 11.6', () => {
    it('shows validation error when NONE is combined with another license', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('新增員工'));

      const licenseSelect = screen.getByLabelText('證照');
      await user.click(licenseSelect);

      await waitFor(() => {
        expect(screen.getByTitle('無')).toBeInTheDocument();
      });
      await user.click(screen.getByTitle('無'));
      await user.click(screen.getByTitle('專技'));

      // Close the dropdown to trigger blur/validation
      await user.keyboard('{Escape}');

      const modal = screen.getByRole('dialog');
      await user.click(within(modal).getByText('OK'));

      await waitFor(() => {
        expect(screen.getByText('證照設定衝突')).toBeInTheDocument();
      });
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('指定休假日設定介面 - Requirement 11.5', () => {
    it('renders designated leave date picker for adding dates', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('新增員工'));

      expect(screen.getByLabelText('新增指定休假日期')).toBeInTheDocument();
    });

    it('shows existing designated leaves as removable tags when editing', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('王大明'));

      await waitFor(() => {
        expect(screen.getByText('編輯員工資料')).toBeInTheDocument();
      });

      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText('2025-01-01')).toBeInTheDocument();
      expect(screen.getByLabelText('移除休假日 2025-01-01')).toBeInTheDocument();
    });

    it('removes a designated leave tag when its close icon is clicked', async () => {
      const user = userEvent.setup();
      render(<EmployeePage />);

      await user.click(screen.getByText('王大明'));

      const modal = await screen.findByRole('dialog');
      await waitFor(() => {
        expect(within(modal).getByText('2025-01-01')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('移除休假日 2025-01-01'));

      await waitFor(() => {
        expect(within(modal).queryByText('2025-01-01')).not.toBeInTheDocument();
      });
    });
  });
});
