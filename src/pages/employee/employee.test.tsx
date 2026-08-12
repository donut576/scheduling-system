import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

vi.mock('@/queries/useEmployeeQueries', () => ({
  useEmployeeList: vi.fn(),
  useCreateEmployee: vi.fn(),
  useUpdateEmployee: vi.fn(),
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
  });

  describe('員工資料列表 - Requirement 11.1', () => {
    it('renders table with required columns and data', () => {
      render(<EmployeePage />);

      expect(screen.getAllByText('姓名').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('電話').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('員工編號').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('職位').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('群組').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('指定休假').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('證照').length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText('王大明')).toBeInTheDocument();
      expect(screen.getByText('李小華')).toBeInTheDocument();
    });

    it('renders group as a colored tag - Requirement 11.4', () => {
      render(<EmployeePage />);

      const groupTag = screen.getByText('北區');
      expect(groupTag).toBeInTheDocument();
      // Ant Design Tag applies the color via inline style/className
      expect(groupTag.closest('.ant-tag')).toBeTruthy();
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
