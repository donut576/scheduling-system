import React, { useMemo } from 'react';
import { Form, Select, Tag, Typography } from 'antd';
import { useRegionAreas } from '@/queries/useRegionQueries';
import { getGroupColor } from '@/utils/groupColor';
import { isRealApi } from '@/utils/dataSource';

const { Text } = Typography;

export interface CityDistrictFieldsProps {
  /** 表單裡縣市欄位的名稱，預設 city */
  cityName?: string;
  /** 表單裡行政區欄位的名稱，預設 district */
  districtName?: string;
}

/**
 * 縣市／行政區連動下拉（客戶表單用）。
 * - 選項來自後端 GET /regions/areas，只列出服務轄區內的縣市與行政區。
 * - 換縣市時行政區會清空。
 * - 選好行政區後，在下方顯示系統自動算出的所屬群組（北早、北一晚…）。
 * - 接真後端（VITE_USE_MOCK_API=false）時必填；模擬資料模式為選填，避免影響既有流程與測試。
 */
export const CityDistrictFields: React.FC<CityDistrictFieldsProps> = ({
  cityName = 'city',
  districtName = 'district',
}) => {
  const form = Form.useFormInstance();
  const { data, isLoading } = useRegionAreas();
  const city = Form.useWatch(cityName, form) as string | undefined;
  const district = Form.useWatch(districtName, form) as string | undefined;

  const cityOptions = useMemo(
    () => (data?.cities ?? []).map((c) => ({ label: c.city, value: c.city })),
    [data],
  );
  const districtOptions = useMemo(
    () =>
      (data?.cities.find((c) => c.city === city)?.districts ?? []).map((d) => ({
        label: d.district,
        value: d.district,
      })),
    [data, city],
  );
  const groups = useMemo(
    () =>
      data?.cities.find((c) => c.city === city)?.districts.find((d) => d.district === district)
        ?.regions ?? [],
    [data, city, district],
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 12 }}>
        <Form.Item
          name={cityName}
          label="縣市"
          style={{ flex: 1 }}
          rules={[{ required: isRealApi, message: '請選擇縣市' }]}
        >
          <Select
            showSearch
            allowClear
            placeholder="請選擇縣市"
            loading={isLoading}
            options={cityOptions}
            data-testid="customer-city"
            onChange={() => form.setFieldValue(districtName, undefined)}
          />
        </Form.Item>
        <Form.Item
          name={districtName}
          label="行政區"
          style={{ flex: 1 }}
          rules={[{ required: isRealApi, message: '請選擇行政區' }]}
        >
          <Select
            showSearch
            allowClear
            placeholder={city ? '請選擇行政區' : '請先選擇縣市'}
            disabled={!city}
            options={districtOptions}
            data-testid="customer-district"
          />
        </Form.Item>
      </div>
      {groups.length > 0 ? (
        <div style={{ marginTop: -8, marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            所屬群組：
          </Text>
          {groups.map((g) => (
            <Tag key={g} color={getGroupColor(g)} style={{ marginLeft: 4 }}>
              {g}
            </Tag>
          ))}
        </div>
      ) : null}
    </>
  );
};

export default CityDistrictFields;

const normalizeTw = (s: string) => s.replace(/臺/g, '台').replace(/\s/g, '');

export interface AddressHintProps {
  /** 表單裡縣市／行政區／地址欄位的名稱 */
  cityName?: string;
  districtName?: string;
  addressName?: string;
}

/**
 * 地址欄位下方的提醒（只提醒，不擋送出）。
 * 所屬群組是依「縣市＋行政區」計算，不看地址文字，所以地址與上面選的縣市、行政區不一致時要提醒使用者。
 */
export const AddressHint: React.FC<AddressHintProps> = ({
  cityName = 'city',
  districtName = 'district',
  addressName = 'address',
}) => {
  const form = Form.useFormInstance();
  const city = Form.useWatch(cityName, form) as string | undefined;
  const district = Form.useWatch(districtName, form) as string | undefined;
  const address = Form.useWatch(addressName, form) as string | undefined;

  const mismatch =
    Boolean(city && district && address?.trim()) &&
    !normalizeTw(address as string).includes(normalizeTw(district as string));

  return (
    <div style={{ fontSize: 12 }}>
      <Text type="secondary">
        請填完整地址（含縣市、行政區）。所屬群組依上方「縣市、行政區」計算，不會看地址文字。
      </Text>
      {mismatch ? (
        <div style={{ color: '#d46b08', marginTop: 2 }}>
          ⚠️ 地址裡沒有「{district}」，請確認縣市、行政區與地址是否一致
        </div>
      ) : null}
    </div>
  );
};
