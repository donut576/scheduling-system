/**
 * LicenseChip 元件
 *
 * 業務用途：在員工卡片、表格上顯示一張證照，並依到期狀態變色。
 * - 已到期：紅色；30 天內到期：黃色並顯示剩幾天；尚未生效：灰色；其他維持一般標籤。
 * 滑過標籤會顯示完整的有效期間。
 */
import React from 'react';
import { Tag, Tooltip } from 'antd';
import { ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { LicenseDetail } from '@/types/employee';
import { getLicenseState } from '@/utils/licenseExpiry';

export interface LicenseChipProps {
  /** 證照代碼與有效期間 */
  detail: LicenseDetail;
  /** 證照顯示名稱（例如「專技」） */
  label: string;
}

const LicenseChip: React.FC<LicenseChipProps> = ({ detail, label }) => {
  const { t } = useTranslation();
  const state = getLicenseState(detail);
  const period = `${detail.effectiveOn ?? '—'} ~ ${detail.expiresOn ?? t('employee.licensePermanent')}`;

  let color: string | undefined;
  let icon: React.ReactNode;
  let suffix = '';
  if (state.status === 'expired') {
    color = 'error';
    icon = <WarningOutlined />;
    suffix = t('employee.licenseExpired');
  } else if (state.status === 'expiring') {
    color = 'warning';
    icon = <ClockCircleOutlined />;
    suffix = t('employee.licenseDaysLeft', { days: state.daysLeft ?? 0 });
  } else if (state.status === 'notYet') {
    suffix = t('employee.licenseNotYet');
  }

  return (
    <Tooltip title={period}>
      <Tag color={color} icon={icon}>
        {suffix ? `${label} ${suffix}` : label}
      </Tag>
    </Tooltip>
  );
};

export default LicenseChip;
