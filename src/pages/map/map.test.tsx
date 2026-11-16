// 地圖檢視頁面 (MapPage) 單元測試
// 測試對象：src/pages/map/index.tsx，涵蓋篩選面板、標記顏色計算與導覽帶入定位
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapPage from './index';
import type { Customer, CustomerGroup } from '@/types/customer';
import type { Employee } from '@/types/employee';
import type { Task } from '@/types/task';
import { getToday } from '@/utils/date';

// Mock the heavy MapView (which itself wraps react-leaflet) so this test can
// focus on MapPage's filter panel + data wiring, exposing the filtered
// customers list passed down for assertions.
vi.mock('@/components/business/MapView', () => ({
  default: ({
    customers,
    markerColorByCustomerId,
    renderPopup,
  }: {
    customers: Customer[];
    markerColorByCustomerId?: Record<string, string>;
    renderPopup?: (customer: Customer) => ReactNode;
  }) => (
    <div data-testid="mock-map-view">
      {customers.map((c) => (
        <div
          key={c.id}
          data-testid={`mock-marker-${c.id}`}
          data-color={markerColorByCustomerId?.[c.id]}
        >
          {c.groupName}-{c.branchName}
          {renderPopup?.(c)}
        </div>
      ))}
    </div>
  ),
}));

let mockLocationState: { groupId?: string; branchId?: string } | null = null;

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: mockLocationState }),
}));

// 地圖預設日期為今天；測試資料的日期都以今天為準，避免隨時間過期
const TODAY = getToday();
const PAST_DATE = '2020-01-01';

let mockUser: { id: string; role: string } | null = null;

vi.mock('@/stores/useUserStore', () => ({
  useUserStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}));

const customers: Customer[] = [
  {
    id: 'cust-1',
    groupId: 'group-1',
    groupName: '集團A',
    branchId: 'branch-1',
    branchName: '分店A1',
    address: '台北市',
    latitude: 25.03,
    longitude: 121.56,
    contactName: '王先生',
    contactPhone: '0912345678',
    requiredLicenses: [],
  },
  {
    id: 'cust-2',
    groupId: 'group-1',
    groupName: '集團A',
    branchId: 'branch-2',
    branchName: '分店A2',
    address: '新北市',
    latitude: 25.05,
    longitude: 121.5,
    contactName: '李先生',
    contactPhone: '0923456789',
    requiredLicenses: [],
  },
  {
    id: 'cust-3',
    groupId: 'group-2',
    groupName: '集團B',
    branchId: 'branch-3',
    branchName: '分店B1',
    address: '桃園市',
    latitude: 24.99,
    longitude: 121.3,
    contactName: '陳先生',
    contactPhone: '0934567890',
    requiredLicenses: [],
  },
];

const customerGroups: CustomerGroup[] = [
  {
    id: 'group-1',
    name: '集團A',
    branches: [
      {
        id: 'branch-1',
        groupId: 'group-1',
        name: '分店A1',
        address: '台北市',
        contactName: '王先生',
        contactPhone: '0912345678',
        requiredLicenses: [],
      },
      {
        id: 'branch-2',
        groupId: 'group-1',
        name: '分店A2',
        address: '新北市',
        contactName: '李先生',
        contactPhone: '0923456789',
        requiredLicenses: [],
      },
    ],
  },
  {
    id: 'group-2',
    name: '集團B',
    branches: [
      {
        id: 'branch-3',
        groupId: 'group-2',
        name: '分店B1',
        address: '桃園市',
        contactName: '陳先生',
        contactPhone: '0934567890',
        requiredLicenses: [],
      },
    ],
  },
];

const employees: Employee[] = [
  {
    id: 'emp-1',
    name: '王大明',
    phone: '0912345678',
    employeeNo: 'E001',
    position: 'STAFF',
    groupId: 'area-1',
    groupName: '北區',
    area: '台北',
    shift: '早班',
    groupColor: '#fa8c16',
    designatedLeaves: [],
    licenses: [],
    isActive: true,
  },
];

const buildTask = (
  id: string,
  branchId: string,
  date: string,
  employeeId: string,
  employeeName: string,
): Task => ({
  id,
  groupId: 'group-1',
  groupName: '集團A',
  branchId,
  branchName: '',
  taskType: 'CONTRACT',
  date,
  startTime: '09:00',
  endTime: '10:00',
  isOvernight: false,
  headcount: 1,
  shift: '早班',
  route: '',
  contents: ['P'],
  assignees: [{ employeeId, employeeName, licenses: [] }],
  status: 'SCHEDULED',
  alertStatus: 'CLEAN',
  createdBy: 'admin',
  createdAt: '2026-08-12T09:00:00+08:00',
  updatedAt: '2026-08-12T09:00:00+08:00',
});

let tasks: Task[] = [];

vi.mock('@/queries/useCustomerQueries', () => ({
  useCustomerGroups: () => ({ data: customerGroups, isLoading: false }),
  useCustomerList: () => ({
    data: { list: customers, total: customers.length, page: 1, pageSize: 1000 },
    isLoading: false,
  }),
}));

vi.mock('@/queries/useTaskQueries', () => ({
  useTaskList: () => ({
    data: { list: tasks, total: tasks.length, page: 1, pageSize: 1000 },
    isLoading: false,
  }),
}));

vi.mock('@/queries/useEmployeeQueries', () => ({
  useEmployeeList: () => ({
    data: { list: employees, total: employees.length, page: 1, pageSize: 1000 },
    isLoading: false,
  }),
}));

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderWithProviders = () => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MapPage />
    </QueryClientProvider>,
  );
};

describe('MapPage', () => {
  beforeEach(() => {
    mockLocationState = null;
    mockUser = null;
    tasks = [
      buildTask('task-1', 'branch-1', TODAY, 'emp-1', '王大明'),
      buildTask('task-2', 'branch-2', TODAY, 'emp-2', '李小華'),
      buildTask('task-3', 'branch-3', TODAY, 'emp-1', '王大明'),
    ];
  });

  it('renders the date and time range filters instead of group/branch selects', () => {
    renderWithProviders();

    expect(screen.getByTestId('map-filter-panel')).toBeInTheDocument();
    expect(screen.getByText('日期')).toBeInTheDocument();
    expect(screen.getByText('時段')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '集團／公司篩選' })).not.toBeInTheDocument();
  });

  it('shows all customers when no filter is applied', () => {
    renderWithProviders();

    expect(screen.getByTestId('mock-marker-cust-1')).toBeInTheDocument();
    expect(screen.getByTestId('mock-marker-cust-2')).toBeInTheDocument();
    expect(screen.getByTestId('mock-marker-cust-3')).toBeInTheDocument();
  });

  it('colors map markers by assigned employee group when a task has assignees', () => {
    renderWithProviders();

    expect(screen.getByTestId('mock-marker-cust-1').getAttribute('data-color')).toBe('#7a69c0');
  });

  it('reads and applies location.state (groupId/branchId) on mount', async () => {
    mockLocationState = { groupId: 'group-2', branchId: 'branch-3' };
    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByTestId('mock-marker-cust-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-marker-cust-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('mock-marker-cust-3')).toBeInTheDocument();
    });
  });

  it('lets the user clear the branch limit that came from navigation', async () => {
    const user = userEvent.setup();
    mockLocationState = { groupId: 'group-2', branchId: 'branch-3' };
    renderWithProviders();

    const tag = await screen.findByTestId('map-location-limit');
    expect(tag).toHaveTextContent('集團B 分店B1');
    await user.click(tag.querySelector('.anticon-close') as Element);

    await waitFor(() => {
      expect(screen.getByTestId('mock-marker-cust-1')).toBeInTheDocument();
      expect(screen.getByTestId('mock-marker-cust-3')).toBeInTheDocument();
    });
  });

  it('shows task details and the contact in the popup, with an edit button for non-staff', () => {
    mockUser = { id: 'emp-admin', role: 'ADMIN' };
    renderWithProviders();

    const popup = screen.getByTestId('map-popup-cust-1');
    expect(popup).toHaveTextContent('集團A · 分店A1');
    expect(popup).toHaveTextContent('此時段 1 項任務');
    expect(popup).toHaveTextContent('09:00–10:00');
    expect(popup).toHaveTextContent('王大明');
    expect(popup).toHaveTextContent('聯絡窗口');
    expect(screen.getByTestId('map-popup-edit-task-1')).toBeInTheDocument();
  });

  it('does not show the edit button to staff', () => {
    mockUser = { id: 'emp-1', role: 'STAFF' };
    renderWithProviders();

    expect(screen.queryByTestId('map-popup-edit-task-1')).not.toBeInTheDocument();
  });

  it('shows the task and location count', () => {
    renderWithProviders();

    expect(screen.getByTestId('map-summary')).toHaveTextContent('共 3 項任務、3 個地點');
  });

  it('shows the empty hint when no task matches the date range', () => {
    tasks = [buildTask('task-1', 'branch-1', PAST_DATE, 'emp-1', '王大明')];
    renderWithProviders();

    expect(screen.getByTestId('map-summary')).toHaveTextContent('目前沒有符合條件的任務');
  });

  it('does not show customers whose tasks are all in the past', () => {
    tasks = [
      buildTask('task-1', 'branch-1', PAST_DATE, 'emp-1', '王大明'),
      buildTask('task-2', 'branch-2', TODAY, 'emp-1', '王大明'),
    ];
    renderWithProviders();

    expect(screen.queryByTestId('mock-marker-cust-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-marker-cust-2')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-marker-cust-3')).not.toBeInTheDocument();
  });

  it('shows every customer with tasks in the date range to non-staff roles', () => {
    mockUser = { id: 'emp-admin', role: 'ADMIN' };
    renderWithProviders();

    expect(screen.getByTestId('mock-marker-cust-1')).toBeInTheDocument();
    expect(screen.getByTestId('mock-marker-cust-2')).toBeInTheDocument();
    expect(screen.getByTestId('mock-marker-cust-3')).toBeInTheDocument();
  });

  it('shows staff only the customers of tasks assigned to themselves', () => {
    mockUser = { id: 'emp-1', role: 'STAFF' };
    renderWithProviders();

    expect(screen.getByTestId('mock-marker-cust-1')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-marker-cust-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-marker-cust-3')).toBeInTheDocument();
  });
});
