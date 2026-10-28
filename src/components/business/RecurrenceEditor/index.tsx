/**
 * RecurrenceEditor 元件
 *
 * 業務用途：於任務表單中設定週期任務之重複規則。
 * 以「每 N 週／月／季施作一次」設定，並預覽施作日期供組長確認。
 */
import React, { useCallback, useMemo } from 'react';
import { Radio, InputNumber, Checkbox, DatePicker, Space, Typography, Alert } from 'antd';
import type { RadioChangeEvent, GetProp } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { RecurrenceRule } from '@/types/task';
import { generateRecurrenceInstances } from '@/utils/recurrence';
import { HOLIDAYS_2026 } from '@/constants/holidays';

export interface RecurrenceEditorProps {
  value?: RecurrenceRule;
  onChange?: (rule: RecurrenceRule) => void;
  disabled?: boolean;
  /** 任務首次日期（YYYY-MM-DD），用於預設星期／每月日期與預覽 */
  startDate?: string;
}

const { Text } = Typography;

type Unit = 'weekly' | 'monthly' | 'quarterly';
const UNITS: Unit[] = ['weekly', 'monthly', 'quarterly'];
const MAX_INTERVAL: Record<Unit, number> = { weekly: 52, monthly: 12, quarterly: 4 };
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const PREVIEW_COUNT = 5;

const DEFAULT_RULE: RecurrenceRule = { frequency: 'weekly', interval: 1, endType: 'never' };

const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({
  value,
  onChange,
  disabled = false,
  startDate,
}) => {
  const { t } = useTranslation();
  const rule = value ?? DEFAULT_RULE;
  const unit = UNITS.includes(rule.frequency as Unit) ? (rule.frequency as Unit) : undefined;
  const start = startDate && dayjs(startDate).isValid() ? dayjs(startDate) : undefined;

  const effectiveDays =
    rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : start ? [start.day()] : [];
  const dayOfMonth = rule.dayOfMonth ?? start?.date() ?? 1;

  const updateRule = useCallback(
    (partial: Partial<RecurrenceRule>) => onChange?.({ ...rule, ...partial }),
    [rule, onChange],
  );

  const handleUnitChange = (e: RadioChangeEvent) => {
    const frequency = e.target.value as Unit;
    const updated: RecurrenceRule = {
      ...rule,
      frequency,
      interval: Math.min(rule.interval || 1, MAX_INTERVAL[frequency]),
    };
    if (frequency === 'weekly') {
      delete updated.dayOfMonth;
      updated.daysOfWeek = effectiveDays;
    } else {
      delete updated.daysOfWeek;
      updated.dayOfMonth = dayOfMonth;
    }
    onChange?.(updated);
  };

  const handleEndTypeChange = (e: RadioChangeEvent) => {
    const endType = e.target.value as RecurrenceRule['endType'];
    const updated: RecurrenceRule = { ...rule, endType };
    if (endType === 'never') {
      delete updated.endDate;
      delete updated.endCount;
    } else if (endType === 'date') {
      delete updated.endCount;
      if (!updated.endDate) updated.endDate = dayjs().add(1, 'month').format('YYYY-MM-DD');
    } else {
      delete updated.endDate;
      if (!updated.endCount) updated.endCount = 10;
    }
    onChange?.(updated);
  };

  const handleEndDateChange = (_d: dayjs.Dayjs | null, s: string | string[]) => {
    const str = Array.isArray(s) ? s[0] : s;
    updateRule({ endDate: str || undefined });
  };

  const summary = useMemo(() => {
    if (!unit || !start) return '';
    const n = rule.interval || 1;
    const days = [...effectiveDays]
      .sort((a, b) => a - b)
      .map((d) => t(`recurrence.${DAY_KEYS[d]}`))
      .join('、');
    const base =
      unit === 'weekly'
        ? t('recurrence.summaryWeekly', { n, days })
        : unit === 'monthly'
          ? t('recurrence.summaryMonthly', { n, day: dayOfMonth })
          : t('recurrence.summaryQuarterly', { n, months: n * 3, day: dayOfMonth });
    const from = t('recurrence.summaryFrom', { date: start.format('MM/DD') });
    const end =
      rule.endType === 'never'
        ? t('recurrence.never')
        : rule.endType === 'date'
          ? t('recurrence.endByDate', { date: rule.endDate ?? '' })
          : t('recurrence.endByCount', { n: rule.endCount ?? 10 });
    return `${base}；${from}，${end}`;
  }, [unit, start, rule, effectiveDays, dayOfMonth, t]);

  const upcoming = useMemo(() => {
    if (!unit || !start) return [];
    const finalRule: RecurrenceRule =
      unit === 'weekly' ? { ...rule, daysOfWeek: effectiveDays } : { ...rule, dayOfMonth };
    return generateRecurrenceInstances(start.format('YYYY-MM-DD'), finalRule).slice(
      0,
      PREVIEW_COUNT,
    );
  }, [unit, start, rule, effectiveDays, dayOfMonth]);

  return (
    <Space
      direction="vertical"
      style={{ width: '100%' }}
      size="middle"
      data-testid="recurrence-editor"
    >
      {!unit && <Alert type="warning" showIcon message={t('recurrence.legacyNotice')} />}

      <Space align="center" wrap>
        <Text>{t('recurrence.every')}</Text>
        <InputNumber
          min={1}
          max={unit ? MAX_INTERVAL[unit] : 52}
          value={rule.interval}
          onChange={(v) => updateRule({ interval: v ?? 1 })}
          disabled={disabled}
          style={{ width: 80 }}
          aria-label={t('recurrence.interval')}
        />
        <Radio.Group
          value={unit}
          onChange={handleUnitChange}
          optionType="button"
          buttonStyle="solid"
          disabled={disabled}
          options={[
            { label: t('recurrence.weeks'), value: 'weekly' },
            { label: t('recurrence.months'), value: 'monthly' },
            { label: t('recurrence.quarters'), value: 'quarterly' },
          ]}
        />
        <Text>{t('recurrence.doOnce')}</Text>
      </Space>

      {unit === 'weekly' && (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }} id="days-of-week-label">
            {t('recurrence.daysOfWeek')}
          </Text>
          <Checkbox.Group
            value={effectiveDays}
            onChange={(v: GetProp<typeof Checkbox.Group, 'value'>) =>
              updateRule({ daysOfWeek: v as number[] })
            }
            options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({
              label: t(`recurrence.${DAY_KEYS[d]}`),
              value: d,
            }))}
            disabled={disabled}
            aria-labelledby="days-of-week-label"
          />
        </div>
      )}

      {(unit === 'monthly' || unit === 'quarterly') && (
        <Space align="center">
          <Text strong>
            {unit === 'quarterly' ? t('recurrence.quarterlyOn') : t('recurrence.monthlyOn')}
          </Text>
          <InputNumber
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(v) => updateRule({ dayOfMonth: v ?? 1 })}
            disabled={disabled}
            style={{ width: 80 }}
            aria-label={t('recurrence.dayOfMonth')}
          />
          <Text>{t('recurrence.daySuffix')}</Text>
        </Space>
      )}

      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }} id="end-type-label">
          {t('recurrence.endCondition')}
        </Text>
        <Radio.Group
          value={rule.endType}
          onChange={handleEndTypeChange}
          disabled={disabled}
          aria-labelledby="end-type-label"
        >
          <Radio value="never">{t('recurrence.never')}</Radio>
          <Radio value="date">{t('recurrence.byDate')}</Radio>
          <Radio value="count">{t('recurrence.byCount')}</Radio>
        </Radio.Group>
      </div>

      {rule.endType === 'date' && (
        <Space align="center">
          <Text>{t('recurrence.endDate')}：</Text>
          <DatePicker
            value={rule.endDate ? dayjs(rule.endDate) : null}
            onChange={handleEndDateChange}
            format="YYYY-MM-DD"
            disabled={disabled}
            aria-label={t('recurrence.endDate')}
            disabledDate={(c) => c && c.isBefore(dayjs(), 'day')}
          />
        </Space>
      )}

      {rule.endType === 'count' && (
        <Space align="center">
          <Text>{t('recurrence.repeat')}</Text>
          <InputNumber
            min={1}
            max={999}
            value={rule.endCount ?? 10}
            onChange={(v) => updateRule({ endCount: v ?? 1 })}
            disabled={disabled}
            style={{ width: 80 }}
            aria-label={t('recurrence.repeatCount')}
          />
          <Text>{t('recurrence.timesThenEnd')}</Text>
        </Space>
      )}

      {unit && (
        <div
          style={{
            background: '#e6f4ff',
            border: '1px solid #91caff',
            borderRadius: 8,
            padding: '10px 14px',
          }}
        >
          {start ? (
            <>
              <div style={{ color: '#0958d9', fontWeight: 600 }}>{summary}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('recurrence.nextOccurrences', { n: upcoming.length })}
              </Text>
              <div>
                {upcoming.map((d) => {
                  const isHol = HOLIDAYS_2026.includes(d);
                  return (
                    <span
                      key={d}
                      title={isHol ? t('recurrence.holiday') : undefined}
                      style={{
                        display: 'inline-block',
                        margin: '6px 6px 0 0',
                        padding: '2px 10px',
                        borderRadius: 6,
                        background: isHol ? '#fff1f0' : '#fff',
                        border: `1px solid ${isHol ? '#ffa39e' : '#d9d9d9'}`,
                        color: isHol ? '#cf1322' : undefined,
                      }}
                    >
                      {`${dayjs(d).format('MM/DD')}（${t(`recurrence.${DAY_KEYS[dayjs(d).day()]}`)}）`}
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <Text type="secondary">{t('recurrence.needDate')}</Text>
          )}
        </div>
      )}
    </Space>
  );
};

export default RecurrenceEditor;
