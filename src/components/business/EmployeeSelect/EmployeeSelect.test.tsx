/**
 * 測試對象：EmployeeSelect 元件
 * 驗證篩選控制項與員工按鈕渲染、休假員工停用邏輯、
 * 證照符合／不符合圖示顯示，以及選取/取消選取回呼行為。
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmployeeSelect from './index';
import type { Employee } from '@/types/employee';

const mockEmployees: Employee[] = [
  {
    id: 'emp-1',
    name: '王大明',
    phone: '0912345678',
    employeeNo: 'E001',
    position: 'STAFF',
    groupId: 'group-a',
    groupName: 'A組',
    groupColor: '#1890ff',
    designatedLeaves: ['2024-12-25'],
    licenses: ['PROFESSIONAL', 'PEST_CONTROL'],
    isActive: true,
  },
  {
    id: 'emp-2',
    name: '李小華',
    phone: '0923456789',
    employeeNo: 'E002',
    position: 'LEADER',
    groupId: 'group-b',
    groupName: 'B組',
    groupColor: '#52c41a',
    designatedLeaves: [],
    licenses: ['SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-3',
    name: '陳志成',
    phone: '0934567890',
    employeeNo: 'E003',
    position: 'STAFF',
    groupId: 'group-a',
    groupName: 'A組',
    groupColor: '#1890ff',
    designatedLeaves: ['2024-12-25', '2024-12-31'],
    licenses: ['NONE'],
    isActive: true,
  },
];

vi.mock('@/queries/useEmployeeQueries', () => ({
  useEmployeeList: () => ({
    data: { list: mockEmployees, total: 3, page: 1, pageSize: 500 },
    isLoading: false,
  }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithProvider = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('EmployeeSelect', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it('renders the filter controls and a toggle button per employee', () => {
    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} />);

    expect(screen.getByText('篩選群組')).toBeInTheDocument();
    expect(screen.getByText('篩選證照')).toBeInTheDocument();
    expect(screen.getByText('休假狀態')).toBeInTheDocument();

    expect(screen.getByRole('group', { name: '指派員工' })).toBeInTheDocument();
    expect(screen.getByText('王大明')).toBeInTheDocument();
    expect(screen.getByText('李小華')).toBeInTheDocument();
    expect(screen.getByText('陳志成')).toBeInTheDocument();
  });

  it('marks employees on leave as disabled (not clickable) when date is provided', () => {
    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} date="2024-12-25" />);

    // 王大明 and 陳志成 are on leave on 2024-12-25
    expect(screen.getAllByText('休假')).toHaveLength(2);
  });

  it('highlights employees matching required licenses with a qualified icon', () => {
    renderWithProvider(
      <EmployeeSelect value={[]} onChange={onChange} requiredLicenses={['PROFESSIONAL']} />,
    );

    // 王大明 has PROFESSIONAL license - should show star
    expect(screen.getByLabelText('符合客戶要求證照')).toBeInTheDocument();
  });

  it('shows a warning icon for employees missing required licenses', () => {
    renderWithProvider(
      <EmployeeSelect value={[]} onChange={onChange} requiredLicenses={['PROFESSIONAL']} />,
    );

    // 李小華 and 陳志成 don't have PROFESSIONAL license
    expect(screen.getAllByLabelText('不符合客戶要求證照')).toHaveLength(2);
  });

  it('calls onChange with the employee added when a toggle button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} />);

    await user.click(screen.getByText('李小華'));
    expect(onChange).toHaveBeenCalledWith(['emp-2']);
  });

  it('calls onChange with the employee removed when an already-selected button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<EmployeeSelect value={['emp-1', 'emp-2']} onChange={onChange} />);

    await user.click(screen.getByText('李小華'));
    expect(onChange).toHaveBeenCalledWith(['emp-1']);
  });

  it('does not call onChange when clicking an employee on leave', () => {
    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} date="2024-12-25" />);

    // The button is styled with pointer-events: none (blocking real user clicks);
    // fireEvent bypasses that hit-testing to directly verify the handler's own guard.
    fireEvent.click(screen.getByText('王大明'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('filters the visible employees by group', async () => {
    const user = userEvent.setup();
    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} />);

    const groupFilter = screen.getByRole('combobox', { name: '篩選群組' });
    await user.click(groupFilter);
    await user.click(await screen.findByTitle('A組'));

    expect(screen.getByText('王大明')).toBeInTheDocument();
    expect(screen.getByText('陳志成')).toBeInTheDocument();
    expect(screen.queryByText('李小華')).not.toBeInTheDocument();
  });
});
