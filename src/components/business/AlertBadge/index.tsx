import React from 'react';
import { Tag, Tooltip } from 'antd';
import { CheckCircleFilled, WarningFilled, ExclamationCircleFilled } from '@ant-design/icons';

export interface AlertBadgeProps {
  status: 'normal' | 'warning' | 'overridden' | 'recurring';
  tooltip?: string;
}

/**
 * Status configuration mapping
 */
const STATUS_CONFIG: Record<
  AlertBadgeProps['status'],
  { color: string; icon: React.ReactNode; label: string }
> = {
  normal: {
    color: 'success',
    icon: <CheckCircleFilled />,
    label: '正常',
  },
  warning: {
    color: 'error',
    icon: <WarningFilled />,
    label: '警示',
  },
  overridden: {
    color: 'warning',
    icon: <ExclamationCircleFilled />,
    label: '已覆蓋',
  },
  recurring: {
    color: 'processing',
    icon: <span aria-hidden="true">∞</span>,
    label: '週期任務',
  },
};

/**
 * AlertBadge - 警示標記元件，用於行事曆事件方塊上
 *
 * 狀態圖標：
 * - normal：綠色（無問題）
 * - warning：紅色（有違規）
 * - overridden：橘色（違規已覆蓋）
 * - recurring：∞ 符號（週期任務）
 *
 * Validates: Requirements 5.3, 7.8
 */
const AlertBadge: React.FC<AlertBadgeProps> = ({ status, tooltip }) => {
  const config = STATUS_CONFIG[status];
  const tooltipText = tooltip ?? config.label;

  const badge = (
    <Tag
      color={config.color}
      icon={config.icon}
      style={{ margin: 0, lineHeight: '20px', fontSize: 12 }}
      data-testid={`alert-badge-${status}`}
      aria-label={tooltipText}
    >
      {config.label}
    </Tag>
  );

  return <Tooltip title={tooltipText}>{badge}</Tooltip>;
};

export default AlertBadge;
