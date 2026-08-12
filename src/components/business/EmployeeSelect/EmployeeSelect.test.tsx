import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmployeeSelect from './index';
import type { Employee } from '@/types/employee';

// Mock the useEmployeeList hook
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

  it('renders the employee select with filter controls and main select', () => {
    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} />);

    // Filter selects should be present
    expect(screen.getByText('篩選群組')).toBeInTheDocument();
    expect(screen.getByText('篩選證照')).toBeInTheDocument();
    expect(screen.getByText('休假狀態')).toBeInTheDocument();
    // Main employee select should show placeholder
    expect(screen.getByText('請選擇指派員工')).toBeInTheDocument();
  });

  it('shows employees in the dropdown when clicked', async () => {
    const user = userEvent.setup();

    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} />);

    // Click on the main employee select (use the placeholder text area)
    const selectInput = screen.getByRole('combobox', { name: '指派員工' });
    await user.click(selectInput);

    await waitFor(() => {
      expect(screen.getByText('王大明')).toBeInTheDocument();
      expect(screen.getByText('李小華')).toBeInTheDocument();
      expect(screen.getByText('陳志成')).toBeInTheDocument();
    });
  });

  it('marks employees on leave as disabled when date is provided', async () => {
    const user = userEvent.setup();

    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} date="2024-12-25" />);

    const selectInput = screen.getByRole('combobox', { name: '指派員工' });
    await user.click(selectInput);

    await waitFor(() => {
      // 王大明 and 陳志成 are on leave on 2024-12-25
      const disabledOptions = document.querySelectorAll('.ant-select-item-option-disabled');
      expect(disabledOptions.length).toBe(2);
    });
  });

  it('highlights employees matching required licenses with star icon', async () => {
    const user = userEvent.setup();

    renderWithProvider(
      <EmployeeSelect value={[]} onChange={onChange} requiredLicenses={['PROFESSIONAL']} />,
    );

    const selectInput = screen.getByRole('combobox', { name: '指派員工' });
    await user.click(selectInput);

    await waitFor(() => {
      // 王大明 has PROFESSIONAL license - should show star
      expect(screen.getByLabelText('符合客戶要求證照')).toBeInTheDocument();
    });
  });

  it('calls onChange when employees are selected', async () => {
    const user = userEvent.setup();

    renderWithProvider(<EmployeeSelect value={[]} onChange={onChange} />);

    const selectInput = screen.getByRole('combobox', { name: '指派員工' });
    await user.click(selectInput);

    await waitFor(() => {
      expect(screen.getByText('李小華')).toBeInTheDocument();
    });

    await user.click(screen.getByText('李小華'));
    expect(onChange).toHaveBeenCalledWith(['emp-2']);
  });

  it('renders selected employees as tags', () => {
    renderWithProvider(
      <EmployeeSelect
        value={['emp-1', 'emp-2']}
        onChange={onChange}
        requiredLicenses={['PROFESSIONAL']}
      />,
    );

    // Selected employees should be visible as tags
    expect(screen.getByText('王大明')).toBeInTheDocument();
    expect(screen.getByText('李小華')).toBeInTheDocument();
  });
});
