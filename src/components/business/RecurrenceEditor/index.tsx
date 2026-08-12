/**
 * RecurrenceEditor 元件
 *
 * 業務用途：於任務表單中設定週期任務之重複規則，讓使用者選擇重複頻率
 * （每日/每週/每月/自訂）、重複間隔、週幾或每月幾號重複，以及結束條件
 * （永不結束/指定日期結束/指定次數後結束）。
 */
import React, { useCallback } from 'react';
import { Radio, InputNumber, Checkbox, DatePicker, Space, Typography } from 'antd';
import type { RadioChangeEvent, GetProp } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { RecurrenceRule } from '@/types/task';

/**
 * RecurrenceEditorProps
 * - value：目前的週期規則，未提供時使用預設值（每日、間隔 1、永不結束）
 * - onChange：規則變更時的回呼，帶入更新後的完整 RecurrenceRule
 */
export interface RecurrenceEditorProps {
  value?: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
}

const { Text } = Typography;

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
  const { t } = useTranslation();
  const rule = value ?? DEFAULT_RULE;
  const frequencyOptions: { label: string; value: RecurrenceRule['frequency'] }[] = [
    { label: t('recurrence.daily'), value: 'daily' },
    { label: t('recurrence.weekly'), value: 'weekly' },
    { label: t('recurrence.monthly'), value: 'monthly' },
    { label: t('recurrence.custom'), value: 'custom' },
  ];
  const daysOfWeekOptions: { label: string; value: number }[] = [
    { label: t('recurrence.sun'), value: 0 },
    { label: t('recurrence.mon'), value: 1 },
    { label: t('recurrence.tue'), value: 2 },
    { label: t('recurrence.wed'), value: 3 },
    { label: t('recurrence.thu'), value: 4 },
    { label: t('recurrence.fri'), value: 5 },
    { label: t('recurrence.sat'), value: 6 },
  ];
  const endTypeOptions: { label: string; value: RecurrenceRule['endType'] }[] = [
    { label: t('recurrence.never'), value: 'never' },
    { label: t('recurrence.byDate'), value: 'date' },
    { label: t('recurrence.byCount'), value: 'count' },
  ];

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

    // 依頻率清除不相關欄位，避免切換頻率後殘留舊設定造成規則語意混淆
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
    // 'custom'（自訂）頻率保留所有欄位，允許同時設定週幾與每月幾號

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

    // 依結束條件類型清除不相關欄位，避免同時存在 endDate 與 endCount 造成規則歧義
    if (endType === 'never') {
      delete updated.endDate;
      delete updated.endCount;
    } else if (endType === 'date') {
      delete updated.endCount;
      if (!updated.endDate) {
        // 預設結束日期為一個月後，提供合理初始值
        updated.endDate = dayjs().add(1, 'month').format('YYYY-MM-DD');
      }
    } else if (endType === 'count') {
      delete updated.endDate;
      if (!updated.endCount) {
        // 預設重複 10 次後結束
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
        return t('recurrence.days');
      case 'weekly':
        return t('recurrence.weeks');
      case 'monthly':
        return t('recurrence.months');
      case 'custom':
        return t('recurrence.days');
      default:
        return t('recurrence.days');
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
          {t('recurrence.frequency')}
        </Text>
        <Radio.Group
          value={rule.frequency}
          onChange={handleFrequencyChange}
          optionType="button"
          buttonStyle="solid"
          options={frequencyOptions}
          aria-labelledby="frequency-label"
        />
      </div>

      {/* Interval */}
      <div>
        <Space align="center">
          <Text>{t('recurrence.every')}</Text>
          <InputNumber
            min={1}
            max={365}
            value={rule.interval}
            onChange={handleIntervalChange}
            style={{ width: 80 }}
            aria-label={t('recurrence.interval')}
          />
          <Text>{getIntervalLabel()}</Text>
        </Space>
      </div>

      {/* Days of week (for weekly/custom) */}
      {showDaysOfWeek && (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }} id="days-of-week-label">
            {t('recurrence.daysOfWeek')}
          </Text>
          <Checkbox.Group
            value={rule.daysOfWeek ?? []}
            onChange={handleDaysOfWeekChange}
            options={daysOfWeekOptions}
            aria-labelledby="days-of-week-label"
          />
        </div>
      )}

      {/* Day of month (for monthly/custom) */}
      {showDayOfMonth && (
        <div>
          <Space align="center">
            <Text strong>{t('recurrence.monthlyOn')}</Text>
            <InputNumber
              min={1}
              max={31}
              value={rule.dayOfMonth ?? 1}
              onChange={handleDayOfMonthChange}
              style={{ width: 80 }}
              aria-label={t('recurrence.dayOfMonth')}
            />
            <Text>{t('recurrence.daySuffix')}</Text>
          </Space>
        </div>
      )}

      {/* End type */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }} id="end-type-label">
          {t('recurrence.endCondition')}
        </Text>
        <Radio.Group
          value={rule.endType}
          onChange={handleEndTypeChange}
          aria-labelledby="end-type-label"
        >
          {endTypeOptions.map((opt) => (
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
            <Text>{t('recurrence.endDate')}：</Text>
            <DatePicker
              value={rule.endDate ? dayjs(rule.endDate) : null}
              onChange={handleEndDateChange}
              format="YYYY-MM-DD"
              aria-label={t('recurrence.endDate')}
              disabledDate={(current) => current && current.isBefore(dayjs(), 'day')}
            />
          </Space>
        </div>
      )}

      {/* End count input */}
      {rule.endType === 'count' && (
        <div>
          <Space align="center">
            <Text>{t('recurrence.repeat')}</Text>
            <InputNumber
              min={1}
              max={999}
              value={rule.endCount ?? 10}
              onChange={handleEndCountChange}
              style={{ width: 80 }}
              aria-label={t('recurrence.repeatCount')}
            />
            <Text>{t('recurrence.timesThenEnd')}</Text>
          </Space>
        </div>
      )}
    </Space>
  );
};

export default RecurrenceEditor;
