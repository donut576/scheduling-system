/**
 * TimeSelect 元件
 *
 * 業務用途：提供 24 小時制（00~23 小時）及 15 分鐘間隔（00, 15, 30, 45 分）之
 * 下拉式時間選擇器，輸出格式為 "HH:mm" 字串。
 */
import React, { useMemo, useCallback } from 'react';
import { Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';

export interface TimeSelectProps {
  value?: string;
  onChange?: (time?: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  id?: string;
  disabled?: boolean;
}

// 24 小時制選項（00 ~ 23）
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0');
  return { label: h, value: h };
});

// 15 分鐘一段選項（00, 15, 30, 45）
export const MINUTE_OPTIONS = [
  { label: '00', value: '00' },
  { label: '15', value: '15' },
  { label: '30', value: '30' },
  { label: '45', value: '45' },
];

const TimeSelect: React.FC<TimeSelectProps> = ({
  value,
  onChange,
  'aria-label': ariaLabel,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [selectedHour, selectedMinute] = useMemo(() => {
    if (!value || typeof value !== 'string') return [undefined, undefined];
    const parts = value.split(':');
    if (parts.length < 2) return [undefined, undefined];
    return [parts[0], parts[1]];
  }, [value]);

  const handleHourChange = useCallback(
    (hour?: string) => {
      if (!hour) {
        onChange?.(undefined);
        return;
      }
      const minute = selectedMinute || '00';
      onChange?.(`${hour}:${minute}`);
    },
    [onChange, selectedMinute],
  );

  const handleMinuteChange = useCallback(
    (minute?: string) => {
      const hour = selectedHour || '00';
      const m = minute || '00';
      onChange?.(`${hour}:${m}`);
    },
    [onChange, selectedHour],
  );

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Select
        placeholder={t('task.hour')}
        value={selectedHour}
        onChange={handleHourChange}
        options={HOUR_OPTIONS}
        allowClear
        style={{ width: '55%' }}
        showSearch
        optionFilterProp="label"
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} (小時)` : '小時'}
      />
      <Select
        placeholder={t('task.minute')}
        value={selectedMinute}
        onChange={handleMinuteChange}
        options={MINUTE_OPTIONS}
        style={{ width: '45%' }}
        disabled={disabled || !selectedHour}
        aria-label={ariaLabel ? `${ariaLabel} (分鐘)` : '分鐘'}
      />
    </Space.Compact>
  );
};

export default TimeSelect;
