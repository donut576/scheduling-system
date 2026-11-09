/**
 * LicensePeriodEditor 元件
 *
 * 業務用途：員工編輯視窗中，替「已選取的證照」設定生效日與到期日。
 * 每張證照一列，用「生效日」「到期日」兩個獨立的日期選擇器（兩個都可以留白，留白代表沒有限制），
 * 右邊即時顯示狀態（有效、剩幾天、已到期）。
 *
 * 搭配 Form.Item 使用：value 是使用者填過的期間清單，licenses 是目前選取的證照代碼。
 * 送出前用 utils/licenseExpiry 的 buildLicenseDetails 把兩者合併。
 */
import React, { useMemo } from 'react';
import { DatePicker, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { LicenseDetail } from '@/types/employee';
import { getLicenseState } from '@/utils/licenseExpiry';

const FORMAT = 'YYYY-MM-DD';

export interface LicensePeriodEditorProps {
  /** 使用者已填過的證照期間 */
  value?: LicenseDetail[];
  onChange?: (value: LicenseDetail[]) => void;
  /** 目前選取的證照代碼（「無」不算） */
  licenses: readonly string[];
  /** 證照代碼對應的顯示名稱 */
  getLabel: (code: string) => string;
  disabled?: boolean;
}

const LicensePeriodEditor: React.FC<LicensePeriodEditorProps> = ({
  value = [],
  onChange,
  licenses,
  getLabel,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const codes = useMemo(() => [...new Set(licenses)].filter((c) => c !== 'NONE'), [licenses]);
  if (codes.length === 0) return null;

  // 生效日、到期日各自獨立：只改其中一個，另一個保持原值（不會被清空）
  const handleChange = (code: string, field: 'effectiveOn' | 'expiresOn', date: Dayjs | null) => {
    const existing = value.find((v) => v.code === code);
    const next: LicenseDetail = {
      code,
      effectiveOn: existing?.effectiveOn ?? null,
      expiresOn: existing?.expiresOn ?? null,
      [field]: date ? date.format(FORMAT) : null,
    };
    onChange?.([...value.filter((v) => v.code !== code), next]);
  };

  return (
    <div
      style={{
        border: '1px dashed var(--ant-color-border, #d9d9d9)',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 16,
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('employee.licensePeriodTitle')}
      </Typography.Text>
      {codes.map((code) => {
        const current = value.find((v) => v.code === code) ?? {
          code,
          effectiveOn: null,
          expiresOn: null,
        };
        const state = getLicenseState(current);
        const tag =
          state.status === 'expired'
            ? { color: 'error', text: t('employee.licenseExpired') }
            : state.status === 'expiring'
              ? {
                  color: 'warning',
                  text: t('employee.licenseDaysLeft', { days: state.daysLeft ?? 0 }),
                }
              : state.status === 'notYet'
                ? { color: 'default', text: t('employee.licenseNotYet') }
                : state.status === 'permanent'
                  ? { color: 'success', text: t('employee.licensePermanent') }
                  : { color: 'success', text: t('employee.licenseValid') };
        return (
          <div
            key={code}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.2fr) 84px',
              gap: 8,
              alignItems: 'center',
              padding: '6px 0',
            }}
          >
            <span>{getLabel(code)}</span>
            <DatePicker
              style={{ width: '100%' }}
              format={FORMAT}
              disabled={disabled}
              placeholder={t('employee.licenseStart')}
              value={current.effectiveOn ? dayjs(current.effectiveOn) : null}
              disabledDate={(d) =>
                current.expiresOn ? d.isAfter(dayjs(current.expiresOn), 'day') : false
              }
              onChange={(d) => handleChange(code, 'effectiveOn', d)}
            />
            <DatePicker
              style={{ width: '100%' }}
              format={FORMAT}
              disabled={disabled}
              placeholder={t('employee.licenseEnd')}
              value={current.expiresOn ? dayjs(current.expiresOn) : null}
              disabledDate={(d) =>
                current.effectiveOn ? d.isBefore(dayjs(current.effectiveOn), 'day') : false
              }
              onChange={(d) => handleChange(code, 'expiresOn', d)}
            />
            <Tag color={tag.color} style={{ margin: 0, textAlign: 'center' }}>
              {tag.text}
            </Tag>
          </div>
        );
      })}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('employee.licensePeriodHint')}
      </Typography.Text>
    </div>
  );
};

export default LicensePeriodEditor;
