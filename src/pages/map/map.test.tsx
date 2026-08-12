import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapPage from './index';
import type { Customer, CustomerGroup } from '@/types/customer';

// Mock the heavy MapView (which itself wraps react-leaflet) so this test can
// focus on MapPage's filter panel + data wiring, exposing the filtered
// customers list passed down for assertions.
vi.mock('@/components/business/MapView', () => ({
  default: ({ customers }: { customers: Customer[] }) => (
    <div data-testid="mock-map-view">
      {customers.map((c) => (
        <div key={c.id} data-testid={`mock-marker-${c.id}`}>
          {c.groupName}-{c.branchName}
        </div>
      ))}
    </div>
  ),
}));

let mockLocationState: { groupId?: string; branchId?: string } | null = null;

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: mockLocationState }),
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

vi.mock('@/queries/useCustomerQueries', () => ({
  useCustomerGroups: () => ({ data: customerGroups, isLoading: false }),
  useCustomerList: () => ({
    data: { list: customers, total: customers.length, page: 1, pageSize: 1000 },
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
  });

  it('renders the filter panel with group and branch selects', () => {
    renderWithProviders();

    expect(screen.getByTestId('map-filter-panel')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '集團篩選' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '分店篩選' })).toBeInTheDocument();
  });

  it('shows all customers when no filter is applied', () => {
    renderWithProviders();

    expect(screen.getByTestId('mock-marker-cust-1')).toBeInTheDocument();
    expect(screen.getByTestId('mock-marker-cust-2')).toBeInTheDocument();
    expect(screen.getByTestId('mock-marker-cust-3')).toBeInTheDocument();
  });

  it('applies group filter and only shows matching customers', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const groupSelect = screen.getByRole('combobox', { name: '集團篩選' });
    await user.click(groupSelect);
    await user.click(await screen.findByTitle('集團B'));

    await waitFor(() => {
      expect(screen.queryByTestId('mock-marker-cust-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-marker-cust-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('mock-marker-cust-3')).toBeInTheDocument();
    });
  });

  it('applies both group and branch filters', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const groupSelect = screen.getByRole('combobox', { name: '集團篩選' });
    await user.click(groupSelect);
    await user.click(await screen.findByTitle('集團A'));

    const branchSelect = screen.getByRole('combobox', { name: '分店篩選' });
    await user.click(branchSelect);
    await user.click(await screen.findByTitle('分店A2'));

    await waitFor(() => {
      expect(screen.queryByTestId('mock-marker-cust-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('mock-marker-cust-2')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-marker-cust-3')).not.toBeInTheDocument();
    });
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
});
