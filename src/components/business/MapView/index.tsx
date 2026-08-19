import type { FC } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { Customer } from '@/types/customer';
import 'leaflet/dist/leaflet.css';

export interface MapViewProps {
  /** 客戶分店清單（已套用篩選），僅具有效經緯度之項目會顯示標記 */
  customers: Customer[];
  /** 地圖中心點，未提供時使用預設值（台灣中心附近） */
  center?: { lat: number; lng: number };
  zoom?: number;
  markerColorByCustomerId?: Record<string, string>;
  onMarkerClick?: (customer: Customer) => void;
}

/** 預設地圖中心（台灣本島中心） */
const DEFAULT_CENTER: { lat: number; lng: number } = { lat: 23.8, lng: 120.97 };
const DEFAULT_ZOOM = 8;
const ECOLAB_BLUE = '#0067a0';

/** 台灣地理邊界限制 (SW to NE) */
const TAIWAN_BOUNDS: [[number, number], [number, number]] = [
  [21.5, 118.5],
  [26.2, 122.8],
];

/**
 * MapView - 地圖檢視元件
 *
 * 於地圖上顯示客戶分店位置標記，並以群組色彩區分標記。
 *
 * 色彩區分之解讀（Requirement 15.2）：
 * Customer 資料型別代表「客戶分店」而非「員工指派紀錄」，資料中並無每個分店對應
 * 之「主要指派員工群組」欄位。因此標記色彩以客戶本身之集團識別碼（groupId，即
 * 需求中「集團」概念）透過 getGroupColor 進行色碼指派，作為「群組色彩區分」之
 * 實務對應：同一集團之分店標記使用相同色彩，不同集團則使用不同色彩。
 *
 * Validates: Requirements 15.1, 15.2
 */
const MapView: FC<MapViewProps> = ({
  customers,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  markerColorByCustomerId = {},
  onMarkerClick,
}) => {
  // 僅保留具有效經緯度之客戶分店，缺少座標資料的分店不繪製標記
  const markers = customers.filter(
    (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number',
  );

  return (
    <div data-testid="map-view" style={{ width: '100%', height: '100%' }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={7}
        maxZoom={18}
        maxBounds={TAIWAN_BOUNDS}
        maxBoundsViscosity={0.8}
        style={{ width: '100%', height: '100%', minHeight: 400 }}
        data-testid="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((customer) => {
          const markerColor = markerColorByCustomerId[customer.id] ?? ECOLAB_BLUE;

          return (
            <CircleMarker
              key={customer.id}
              center={[customer.latitude as number, customer.longitude as number]}
              radius={8}
              pathOptions={{
                color: markerColor,
                fillColor: markerColor,
                fillOpacity: 0.8,
              }}
              eventHandlers={{
                click: () => onMarkerClick?.(customer),
              }}
              data-testid={`map-marker-${customer.id}`}
            >
              <Popup>
                <div data-testid={`map-popup-${customer.id}`} style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                    {customer.groupName}
                  </div>
                  <div
                    style={{
                      color: '#1677ff',
                      fontWeight: 600,
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    {customer.branchName}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>{customer.address}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
