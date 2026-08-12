/**
 * AlertBadge 元件
 *
 * 業務用途：用於在排班行事曆的事件方塊上顯示警示狀態標記（正常／警示／
 * 已覆蓋／週期任務），讓使用者能快速辨識該筆排班是否存在違規或特殊狀態。
 */
import React from 'react';
import { Tag, Tooltip } from 'antd';
import { CheckCircleFilled, WarningFilled, ExclamationCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * AlertBadgeProps
 * - status：警示狀態
 *   - normal：正常，無違規
 *   - warning：有違規（尚未覆蓋）
 *   - overridden：違規已由主管覆蓋
 *   - recurring：週期任務（顯示 ∞ 符號）
 * - tooltip：自訂提示文字，未提供時使用狀態預設文字
 */
export interface AlertBadgeProps {
  status: 'normal' | 'warning' | 'overridden' | 'recurring';
  tooltip?: string;
}

/**
 * 各狀態對應之顯示色彩、圖示與翻譯文字鍵值設定
 */
const STATUS_CONFIG: Record<
  AlertBadgeProps['status'],
  { color: string; icon: React.ReactNode; labelKey: string }
> = {
  normal: {
    color: 'success',
    icon: <CheckCircleFilled />,
    labelKey: 'alert.normal',
  },
  warning: {
    color: 'error',
    icon: <WarningFilled />,
    labelKey: 'alert.warning',
  },
  overridden: {
    color: 'warning',
    icon: <ExclamationCircleFilled />,
    labelKey: 'alert.overridden',
  },
  recurring: {
    color: 'processing',
    icon: <span aria-hidden="true">∞</span>,
    labelKey: 'alert.recurring',
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
 * @param status - 警示狀態，決定顯示色彩與圖示
 * @param tooltip - 滑鼠移入時顯示之提示文字，未提供則使用狀態預設文字
 *
 * Validates: Requirements 5.3, 7.8
 */
const AlertBadge: React.FC<AlertBadgeProps> = ({ status, tooltip }) => {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  const label = t(config.labelKey);
  const tooltipText = tooltip ?? label;

  const badge = (
    <Tag
      color={config.color}
      icon={config.icon}
      style={{ margin: 0, lineHeight: '20px', fontSize: 12 }}
      data-testid={`alert-badge-${status}`}
      aria-label={tooltipText}
    >
      {label}
    </Tag>
  );

  return <Tooltip title={tooltipText}>{badge}</Tooltip>;
};

export default AlertBadge;
