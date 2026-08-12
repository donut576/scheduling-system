/**
 * 測試對象：MapView 元件
 * 驗證僅具有效經緯度之客戶會顯示標記、標記色彩指派（自訂色彩／預設藍色）、
 * 點擊標記彈出視窗內容，以及地圖中心點/縮放層級傳遞是否正確。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MapView from './index';
import type { Customer } from '@/types/customer';

// react-leaflet renders real DOM/canvas elements that jsdom cannot fully support
// (e.g. tile loading, Leaflet's internal DOM measurement). We mock it with
// lightweight stand-ins that expose the props relevant to our assertions,
// following the same approach used for FullCalendar in ScheduleCalendar.test.tsx.
vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    center,
    zoom,
  }: {
    children: React.ReactNode;
    center: [number, number];
    zoom: number;
  }) => (
    <div data-testid="mock-map-container" data-center={JSON.stringify(center)} data-zoom={zoom}>
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  CircleMarker: ({
    children,
    center,
    pathOptions,
    eventHandlers,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    center: [number, number];
    pathOptions: { color: string; fillColor: string };
    eventHandlers?: { click?: () => void };
    'data-testid': string;
  }) => (
    <button
      type="button"
      data-testid={testId}
      data-center={JSON.stringify(center)}
      data-color={pathOptions.color}
      onClick={() => eventHandlers?.click?.()}
    >
      {children}
    </button>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const baseCustomer: Customer = {
  id: 'cust-1',
  groupId: 'group-1',
  groupName: '集團A',
  branchId: 'branch-1',
  branchName: '分店A1',
  address: '台北市信義區',
  latitude: 25.033,
  longitude: 121.5654,
  contactName: '王先生',
  contactPhone: '0912345678',
  requiredLicenses: [],
};

describe('MapView', () => {
  it('renders markers only for customers with valid coordinates', () => {
    const customers: Customer[] = [
      baseCustomer,
      { ...baseCustomer, id: 'cust-2', latitude: undefined, longitude: undefined },
    ];

    render(<MapView customers={customers} />);

    expect(screen.getByTestId('map-marker-cust-1')).toBeInTheDocument();
    expect(screen.queryByTestId('map-marker-cust-2')).not.toBeInTheDocument();
  });

  it('uses provided marker colors and falls back to Ecolab blue', () => {
    const customerA: Customer = { ...baseCustomer, id: 'cust-a', groupId: 'group-a' };
    const customerB: Customer = {
      ...baseCustomer,
      id: 'cust-b',
      groupId: 'group-b',
      latitude: 25.05,
      longitude: 121.55,
    };

    render(
      <MapView
        customers={[customerA, customerB]}
        markerColorByCustomerId={{ 'cust-a': '#fa8c16' }}
      />,
    );

    const markerA = screen.getByTestId('map-marker-cust-a');
    const markerB = screen.getByTestId('map-marker-cust-b');

    expect(markerA.getAttribute('data-color')).toBe('#fa8c16');
    expect(markerB.getAttribute('data-color')).toBe('#0067a0');
  });

  it('shows a popup with group name, branch name and address on marker click', async () => {
    const user = userEvent.setup();
    render(<MapView customers={[baseCustomer]} />);

    const marker = screen.getByTestId('map-marker-cust-1');
    await user.click(marker);

    const popup = screen.getByTestId('map-popup-cust-1');
    expect(popup).toHaveTextContent('集團A');
    expect(popup).toHaveTextContent('分店A1');
    expect(popup).toHaveTextContent('台北市信義區');
  });

  it('calls onMarkerClick with the clicked customer', async () => {
    const user = userEvent.setup();
    const onMarkerClick = vi.fn();
    render(<MapView customers={[baseCustomer]} onMarkerClick={onMarkerClick} />);

    await user.click(screen.getByTestId('map-marker-cust-1'));

    expect(onMarkerClick).toHaveBeenCalledWith(baseCustomer);
  });

  it('uses provided center and default zoom when passed to MapContainer', () => {
    render(<MapView customers={[baseCustomer]} center={{ lat: 24, lng: 121 }} zoom={12} />);

    const container = screen.getByTestId('mock-map-container');
    expect(container.getAttribute('data-center')).toBe(JSON.stringify([24, 121]));
    expect(container.getAttribute('data-zoom')).toBe('12');
  });
});
