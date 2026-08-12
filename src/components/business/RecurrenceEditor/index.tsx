import React, { useCallback } from 'react';
import { Radio, InputNumber, Checkbox, DatePicker, Space, Typography } from 'antd';
import type { RadioChangeEvent, GetProp } from 'antd';
import dayjs from 'dayjs';
import type { RecurrenceRule } from '@/types/task';

export interface RecurrenceEditorProps {
  value?: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
}

const { Text } = Typography;

const FREQUENCY_OPTIONS: { label: string; value: RecurrenceRule['frequency'] }[] = [
  { label: '每日', value: 'daily' },
  { label: '每週', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '自訂', value: 'custom' },
];

const DAYS_OF_WEEK_OPTIONS: { label: string; value: number }[] = [
  { label: '日', value: 0 },
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
];

const END_TYPE_OPTIONS: { label: string; value: RecurrenceRule['endType'] }[] = [
  { label: '永不結束', value: 'never' },
  { label: '指定日期', value: 'date' },
  { label: '指定次數', value: 'count' },
];

const DEFAULT_RULE: RecurrenceRule = {
  frequency: 'daily',
  interval: 1,
  endType: 'never',
};

/**
 * 週期任務編輯器 - 類似 Outlook 週期設定介面
 * 支援 daily/weekly/monthly/custom 頻率
 * 支援 interval、daysOfWeek、dayOfMonth、endType（never/date/count）
 *
 * Validates: Requirements 5.1
 */
const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({ value, onChange }) => {
  const rule = value ?? DEFAULT_RULE;

  const updateRule = useCallback(
    (partial: Partial<RecurrenceRule>) => {
      onChange({ ...rule, ...partial });
    },
    [rule, onChange],
  );

  const handleFrequencyChange = (e: RadioChangeEvent) => {
    const frequency = e.target.value as RecurrenceRule['frequency'];
    const updated: RecurrenceRule = {
      ...rule,
      frequency,
      interval: rule.interval || 1,
    };

    // Clear irrelevant fields based on frequency
    if (frequency === 'daily') {
      delete updated.daysOfWeek;
      delete updated.dayOfMonth;
    } else if (frequency === 'weekly') {
      delete updated.dayOfMonth;
      if (!updated.daysOfWeek || updated.daysOfWeek.length === 0) {
        updated.daysOfWeek = [];
      }
    } else if (frequency === 'monthly') {
      delete updated.daysOfWeek;
      if (!updated.dayOfMonth) {
        updated.dayOfMonth = 1;
      }
    }
    // 'custom' keeps all fields available

    onChange(updated);
  };

  const handleIntervalChange = (val: number | null) => {
    updateRule({ interval: val ?? 1 });
  };

  const handleDaysOfWeekChange = (checkedValues: GetProp<typeof Checkbox.Group, 'value'>) => {
    updateRule({ daysOfWeek: checkedValues as number[] });
  };

  const handleDayOfMonthChange = (val: number | null) => {
    updateRule({ dayOfMonth: val ?? 1 });
  };

  const handleEndTypeChange = (e: RadioChangeEvent) => {
    const endType = e.target.value as RecurrenceRule['endType'];
    const updated: RecurrenceRule = {
      ...rule,
      endType,
    };

    // Clear irrelevant end fields
    if (endType === 'never') {
      delete updated.endDate;
      delete updated.endCount;
    } else if (endType === 'date') {
      delete updated.endCount;
      if (!updated.endDate) {
        updated.endDate = dayjs().add(1, 'month').format('YYYY-MM-DD');
      }
    } else if (endType === 'count') {
      delete updated.endDate;
      if (!updated.endCount) {
        updated.endCount = 10;
      }
    }

    onChange(updated);
  };

  const handleEndDateChange = (_date: dayjs.Dayjs | null, dateString: string | string[]) => {
    const dateStr = Array.isArray(dateString) ? dateString[0] : dateString;
    updateRule({ endDate: dateStr || undefined });
  };

  const handleEndCountChange = (val: number | null) => {
    updateRule({ endCount: val ?? 1 });
  };

  const getIntervalLabel = (): string => {
    switch (rule.frequency) {
      case 'daily':
        return '天';
      case 'weekly':
        return '週';
      case 'monthly':
        return '月';
      case 'custom':
        return '天';
      default:
        return '天';
    }
  };

  const showDaysOfWeek = rule.frequency === 'weekly' || rule.frequency === 'custom';
  const showDayOfMonth = rule.frequency === 'monthly' || rule.frequency === 'custom';

  return (
    <Space
      direction="vertical"
      style={{ width: '100%' }}
      size="middle"
      data-testid="recurrence-editor"
    >
      {/* Frequency selection */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }} id="frequency-label">
          重複頻率
        </Text>
        <Radio.Group
          value={rule.frequency}
          onChange={handleFrequencyChange}
          optionType="button"
          buttonStyle="solid"
          options={FREQUENCY_OPTIONS}
          aria-labelledby="frequency-label"
        />
      </div>

      {/* Interval */}
      <div>
        <Space align="center">
          <Text>每</Text>
          <InputNumber
            min={1}
            max={365}
            value={rule.interval}
            onChange={handleIntervalChange}
            style={{ width: 80 }}
            aria-label="間隔數"
          />
          <Text>{getIntervalLabel()}</Text>
        </Space>
      </div>

      {/* Days of week (for weekly/custom) */}
      {showDaysOfWeek && (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }} id="days-of-week-label">
            週幾
          </Text>
          <Checkbox.Group
            value={rule.daysOfWeek ?? []}
            onChange={handleDaysOfWeekChange}
            options={DAYS_OF_WEEK_OPTIONS}
            aria-labelledby="days-of-week-label"
          />
        </div>
      )}

      {/* Day of month (for monthly/custom) */}
      {showDayOfMonth && (
        <div>
          <Space align="center">
            <Text strong>每月</Text>
            <InputNumber
              min={1}
              max={31}
              value={rule.dayOfMonth ?? 1}
              onChange={handleDayOfMonthChange}
              style={{ width: 80 }}
              aria-label="每月幾號"
            />
            <Text>號</Text>
          </Space>
        </div>
      )}

      {/* End type */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }} id="end-type-label">
          結束條件
        </Text>
        <Radio.Group
          value={rule.endType}
          onChange={handleEndTypeChange}
          aria-labelledby="end-type-label"
        >
          {END_TYPE_OPTIONS.map((opt) => (
            <Radio key={opt.value} value={opt.value}>
              {opt.label}
            </Radio>
          ))}
        </Radio.Group>
      </div>

      {/* End date picker */}
      {rule.endType === 'date' && (
        <div>
          <Space align="center">
            <Text>結束日期：</Text>
            <DatePicker
              value={rule.endDate ? dayjs(rule.endDate) : null}
              onChange={handleEndDateChange}
              format="YYYY-MM-DD"
              aria-label="結束日期"
              disabledDate={(current) => current && current.isBefore(dayjs(), 'day')}
            />
          </Space>
        </div>
      )}

      {/* End count input */}
      {rule.endType === 'count' && (
        <div>
          <Space align="center">
            <Text>重複</Text>
            <InputNumber
              min={1}
              max={999}
              value={rule.endCount ?? 10}
              onChange={handleEndCountChange}
              style={{ width: 80 }}
              aria-label="重複次數"
            />
            <Text>次後結束</Text>
          </Space>
        </div>
      )}
    </Space>
  );
};

export default RecurrenceEditor;
